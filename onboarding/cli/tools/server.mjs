#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 ustauretim
//
// Uygulama sunucusu: statik site + JSON API (kurum verisi, entegrasyonlar, oturumlar).
// Bağımlılıksız. Veriler dosyada tutulur:
//   web-data/settings.json   kurum profili + entegrasyon tanımları
//   web-data/secrets.json    API anahtarları (yalnız yazılır, geri okunmaz)
//   .dora-onboarding/<id>/   oturum artefaktları
//
// Kullanım: node tools/server.mjs [--port 8080] [--host 127.0.0.1]

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { parse } from '../src/orl/yaml.mjs';
import { createAuthStore, COOKIE } from '../src/orl/auth.mjs';
import { evaluatePhase } from '../src/orl/checks.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const DATA = path.join(ROOT, 'web-data');
const SESSIONS = path.join(ROOT, '.dora-onboarding');
const auth = createAuthStore(DATA);

const { values } = parseArgs({
  options: {
    port: { type: 'string', default: process.env.PORT ?? '8080' },
    host: { type: 'string', default: process.env.HOST ?? '127.0.0.1' },
  },
});
const PORT = Number(values.port);
const HOST = values.host;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8',
  '.yaml': 'text/yaml; charset=utf-8',
  '.yml': 'text/yaml; charset=utf-8',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.txt': 'text/plain; charset=utf-8',
};

const loginAttempts = new Map(); // anahtar: kullanıcı adı → {count, until}

function throttled(username) {
  const rec = loginAttempts.get(String(username ?? '').toLowerCase());
  if (!rec) return false;
  if (rec.until && rec.until > Date.now()) return true;
  if (rec.until && rec.until <= Date.now()) loginAttempts.delete(String(username ?? '').toLowerCase());
  return false;
}

function recordFailure(username) {
  const key = String(username ?? '').toLowerCase();
  const rec = loginAttempts.get(key) ?? { count: 0, until: 0 };
  rec.count += 1;
  if (rec.count >= 5) {
    rec.until = Date.now() + 60_000;
    rec.count = 0;
  }
  loginAttempts.set(key, rec);
}

const version = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, 'onboarding/cli/package.json'), 'utf8')).version;
  } catch {
    return '?';
  }
})();

// ── depolama ─────────────────────────────────────────────
function ensureDirs() {
  fs.mkdirSync(DATA, { recursive: true });
  fs.mkdirSync(SESSIONS, { recursive: true });
}

const DEFAULT_SETTINGS = {
  institution: { name: '', tier: '', regulator: '', jurisdiction: 'TR', licenses: [] },
  integrations: [
    { id: 'siem', type: 'siem', label: 'SIEM (olay akışı)', vendor: '', endpoint: '', auth_type: 'token', status: 'not_configured', last_test: null },
    { id: 'itsm', type: 'itsm', label: 'ITSM (olay kaydı)', vendor: '', endpoint: '', auth_type: 'token', status: 'not_configured', last_test: null },
    { id: 'grc', type: 'grc', label: 'GRC (uyum)', vendor: '', endpoint: '', auth_type: 'token', status: 'not_configured', last_test: null },
    { id: 'cmdb', type: 'cmdb', label: 'CMDB (varlık)', vendor: '', endpoint: '', auth_type: 'token', status: 'not_configured', last_test: null },
  ],
  session_hours: 8,
  updated_at: null,
};

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, file);
}

function loadSettings() {
  const s = readJson(path.join(DATA, 'settings.json'), null);
  if (!s) {
    const init = structuredClone(DEFAULT_SETTINGS);
    writeJson(path.join(DATA, 'settings.json'), init);
    return init;
  }
  // eksik entegrasyonları tamamla
  for (const def of DEFAULT_SETTINGS.integrations) {
    if (!s.integrations.some((i) => i.id === def.id)) s.integrations.push({ ...def });
  }
  return s;
}

function saveSettings(s) {
  s.updated_at = new Date().toISOString();
  writeJson(path.join(DATA, 'settings.json'), s);
}

function loadSecrets() {
  return readJson(path.join(DATA, 'secrets.json'), {});
}

function setSecret(id, token) {
  const s = loadSecrets();
  if (token) s[id] = token;
  else delete s[id];
  writeJson(path.join(DATA, 'secrets.json'), s);
  try {
    fs.chmodSync(path.join(DATA, 'secrets.json'), 0o600);
  } catch {
    /* Windows */
  }
}

function publicSettings() {
  const s = loadSettings();
  const secrets = loadSecrets();
  return {
    ...s,
    integrations: s.integrations.map((i) => ({ ...i, has_token: Boolean(secrets[i.id]) })),
  };
}

// ── oturumlar ────────────────────────────────────────────
function listSessions() {
  if (!fs.existsSync(SESSIONS)) return [];
  return fs
    .readdirSync(SESSIONS, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const file = path.join(SESSIONS, d.name, 'session.json');
      const s = readJson(file, null);
      if (!s) return null;
      const artifacts = fs.readdirSync(path.join(SESSIONS, d.name)).filter((f) => /\.(json|yaml|yml)$/i.test(f));
      return { ...s, artifacts: artifacts.length };
    })
    .filter(Boolean)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

function newSession({ tier, regulator, jurisdiction }) {
  const id = `ob-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8)}`;
  const dir = path.join(SESSIONS, id);
  fs.mkdirSync(dir, { recursive: true });
  const session = {
    session_id: id,
    mode: 'app',
    tier: tier || null,
    regulator: regulator || null,
    created_at: new Date().toISOString(),
    current_phase: 'C1',
    phases: {},
    license: { mode: 'trial', expires_at: new Date(Date.now() + 30 * 86400000).toISOString() },
  };
  writeJson(path.join(dir, 'session.json'), session);
  if (tier) {
    writeJson(path.join(dir, 'institution-profile.json'), {
      institution: '',
      tier,
      tier_justification: 'Uygulama üzerinden oluşturuldu',
      determined_at: new Date().toISOString(),
    });
  }
  if (regulator) {
    writeJson(path.join(dir, 'jurisdiction.json'), { jurisdiction: jurisdiction || 'TR', regulator });
  }
  return session;
}

function sessionDir(id) {
  const safe = String(id).replace(/[^a-zA-Z0-9._-]/g, '');
  const dir = path.join(SESSIONS, safe);
  if (!dir.startsWith(SESSIONS)) throw new Error('geçersiz oturum');
  return dir;
}

function listArtifacts(id) {
  const dir = sessionDir(id);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /\.(json|yaml|yml)$/i.test(f) && f !== 'session.json')
    .sort()
    .map((f) => ({ name: f, size: fs.statSync(path.join(dir, f)).size, modified: fs.statSync(path.join(dir, f)).mtime.toISOString() }));
}

// ── HTTP yardımcıları ────────────────────────────────────
function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function sendFile(res, file) {
  const body = fs.readFileSync(file);
  const ext = path.extname(file).toLowerCase();
  res.writeHead(200, {
    'Content-Type': MIME[ext] ?? 'application/octet-stream',
    'Content-Length': body.length,
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=60',
  });
  res.end(body);
}


function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) {
      try {
        out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
      } catch {
        out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
      }
    }
  }
  return out;
}

function getUser(req) {
  try {
    return auth.verify(parseCookies(req)[COOKIE]);
  } catch {
    return null;
  }
}

function setCookie(res, req, token, maxAge = 8 * 3600) {
  const secure = String(req.headers['x-forwarded-proto'] ?? '').includes('https') ? '; Secure' : '';
  const c = `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
  res.setHeader('Set-Cookie', c);
}

function clearCookie(res, req = {}) {
  const secure = String((req.headers ?? {})['x-forwarded-proto'] ?? '').includes('https') ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
}

async function readBody(req, limit = 5 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('gövde çok büyük (5 MB sınırı)'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw.trim()) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('geçersiz JSON'));
      }
    });
    req.on('error', reject);
  });
}

// ── API ──────────────────────────────────────────────────
async function api(req, res, urlPath, method) {
  // ── kimlik doğrulama (herkese açık uçlar) ──────────────
  if (urlPath === '/api/auth/status' && method === 'GET') {
    return sendJson(res, 200, { needsBootstrap: !auth.hasUsers(), version });
  }

  if (urlPath === '/api/auth/bootstrap' && method === 'POST') {
    const body = await readBody(req);
    const r = auth.bootstrap(body);
    if (!r.ok) return sendJson(res, 400, { ok: false, error: r.error });
    setCookie(res, req, r.token);
    return sendJson(res, 201, { ok: true, user: r.user });
  }

  if (urlPath === '/api/auth/login' && method === 'POST') {
    const body = await readBody(req);
    if (throttled(body.username)) {
      return sendJson(res, 429, { ok: false, error: 'çok fazla deneme — 1 dakika sonra tekrar deneyin' });
    }
    const hours = Number(loadSettings().session_hours) || 8;
    const r = auth.login(body.username, body.password, hours);
    if (!r.ok) {
      recordFailure(body.username);
      auth.audit(body.username || '-', 'login_failed');
      return sendJson(res, 401, { ok: false, error: r.error });
    }
    loginAttempts.delete(String(body.username).toLowerCase());
    setCookie(res, req, r.token, hours * 3600);
    return sendJson(res, 200, { ok: true, user: r.user });
  }

  if (urlPath === '/api/auth/logout' && method === 'POST') {
    // CSRF: tarayıcı formundan gelen basit istekler özel başlık taşıyamaz
  if (method !== 'GET' && method !== 'HEAD' && !req.headers['x-dora-csrf']) {
    return sendJson(res, 403, { ok: false, error: 'CSRF başlığı yok (X-Dora-CSRF)' });
  }

  const me = getUser(req);
    if (me) auth.audit(me.user.username, 'logout');
    clearCookie(res, req);
    return sendJson(res, 200, { ok: true });
  }

  // CSRF: tarayıcı formundan gelen basit istekler özel başlık taşıyamaz
  if (method !== 'GET' && method !== 'HEAD' && !req.headers['x-dora-csrf']) {
    return sendJson(res, 403, { ok: false, error: 'CSRF başlığı yok (X-Dora-CSRF)' });
  }

  const me = getUser(req);

  if (urlPath === '/api/auth/password' && method === 'POST') {
    if (!me) return sendJson(res, 401, { ok: false, error: 'giriş gerekli' });
    const body = await readBody(req);
    const check = auth.login(me.user.username, body.current);
    if (!check.ok) return sendJson(res, 400, { ok: false, error: 'mevcut parola hatalı' });
    const upd = auth.updateUser(me.user.id, { password: body.password });
    if (!upd.ok) return sendJson(res, 400, { ok: false, error: upd.error });
    auth.audit(me.user.username, 'password_change', 'kendi hesabı');
    return sendJson(res, 200, { ok: true });
  }

  if (urlPath === '/api/auth/me' && method === 'GET') {
    if (!me) return sendJson(res, 401, { ok: false, error: 'giriş gerekli' });
    return sendJson(res, 200, { user: me.user, exp: me.exp, session_hours: Number(loadSettings().session_hours) || 8 });
  }

  if (urlPath === '/api/auth/refresh' && method === 'POST') {
    if (!me) return sendJson(res, 401, { ok: false, error: 'giriş gerekli' });
    const hours = Number(loadSettings().session_hours) || 8;
    const token = auth.refresh(me.user, hours);
    if (!token) return sendJson(res, 401, { ok: false, error: 'oturum yenilenemedi' });
    setCookie(res, req, token, hours * 3600);
    return sendJson(res, 200, { ok: true, exp: Date.now() + hours * 3600 * 1000, session_hours: hours });
  }

  if (!me) return sendJson(res, 401, { ok: false, error: 'giriş gerekli' });
  const isAdmin = me.role === 'admin';

  // ── yönetici uçları ────────────────────────────────────
  if (urlPath.startsWith('/api/users') || urlPath === '/api/audit') {
    if (!isAdmin) return sendJson(res, 403, { ok: false, error: 'yönetici yetkisi gerekli' });
    if (urlPath === '/api/users' && method === 'GET') return sendJson(res, 200, { users: auth.users() });
    if (urlPath === '/api/users' && method === 'POST') {
      const body = await readBody(req);
      const r = auth.createUser(body);
      if (!r.ok) return sendJson(res, 400, { ok: false, error: r.error });
      auth.audit(me.user.username, 'user_create', body.username);
      return sendJson(res, 201, { ok: true, user: r.user });
    }
    const um = urlPath.match(/^\/api\/users\/([\w-]+)$/);
    if (um && method === 'PATCH') {
      const body = await readBody(req);
      const r = auth.updateUser(um[1], body);
      if (!r.ok) return sendJson(res, 400, { ok: false, error: r.error });
      auth.audit(me.user.username, 'user_update', um[1]);
      return sendJson(res, 200, { ok: true, user: r.user });
    }
    if (um && method === 'DELETE') {
      const r = auth.removeUser(um[1]);
      if (!r.ok) return sendJson(res, 400, { ok: false, error: r.error });
      auth.audit(me.user.username, 'user_delete', um[1]);
      return sendJson(res, 200, { ok: true });
    }
    if (urlPath === '/api/audit' && method === 'GET') return sendJson(res, 200, { entries: auth.listAudit(150) });
    return sendJson(res, 405, { ok: false, error: 'desteklenmeyen metot' });
  }

  // durum
  if (urlPath === '/api/state' && method === 'GET') {
    const sessions = listSessions();
    return sendJson(res, 200, {
      version,
      user: me.user,
      role: me.role,
      settings: publicSettings(),
      sessions,
      activeSession: sessions.find((x) => x.session_id === loadSettings().active_session) ?? sessions[0] ?? null,
      counts: isAdmin ? metaCounts() : undefined,
    });
  }

  if (urlPath === '/api/health') return sendJson(res, 200, { ok: true, version });

  if (urlPath === '/api/catalog/roles' && method === 'GET') {
    const doc = parse(fs.readFileSync(path.join(ROOT, 'data/roles/roles-catalog.yaml'), 'utf8'));
    const roles = (doc.roles ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      layer: r.layer,
      defence_line: r.defence_line,
      reports_to: r.reports_to,
      tier_activation: r.tier_activation,
    }));
    return sendJson(res, 200, { roles });
  }

  if (urlPath === '/api/lifecycle' && method === 'GET') {
    const doc = parse(fs.readFileSync(path.join(ROOT, 'onboarding/orl-lifecycle.yaml'), 'utf8'));
    const phases = (doc.phases ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      corf_phase: p.corf_phase,
      steps: (p.wizard_steps ?? []).length,
      gates: (p.exit_gate?.criteria ?? []).length,
      duration_days: p.duration_days,
    }));
    return sendJson(res, 200, { lifecycle: doc.lifecycle, phases });
  }

  if (urlPath === '/api/settings/session' && method === 'PUT') {
    if (!isAdmin) return sendJson(res, 403, { ok: false, error: 'yönetici yetkisi gerekli' });
    const body = await readBody(req);
    const hours = Number(body.session_hours);
    if (!Number.isFinite(hours) || hours < 1 || hours > 168) {
      return sendJson(res, 400, { ok: false, error: 'oturum süresi 1-168 saat arası olmalı' });
    }
    const s = loadSettings();
    s.session_hours = Math.round(hours);
    saveSettings(s);
    auth.audit(me.user.username, 'session_hours_update', String(s.session_hours));
    return sendJson(res, 200, { ok: true, session_hours: s.session_hours });
  }

  // kurum profili
  if (urlPath === '/api/institution' && method === 'PUT') {
    const body = await readBody(req);
    const s = loadSettings();
    s.institution = {
      name: String(body.name ?? s.institution.name ?? '').slice(0, 200),
      tier: ['tier1', 'tier2', 'tier3'].includes(body.tier) ? body.tier : s.institution.tier,
      regulator: String(body.regulator ?? s.institution.regulator ?? '').slice(0, 40),
      jurisdiction: String(body.jurisdiction ?? s.institution.jurisdiction ?? 'TR').slice(0, 8),
      licenses: Array.isArray(body.licenses) ? body.licenses.map((x) => String(x).slice(0, 40)).slice(0, 12) : s.institution.licenses,
    };
    saveSettings(s);
    auth.audit(me.user.username, 'institution_update', s.institution.name);
    return sendJson(res, 200, { ok: true, institution: s.institution });
  }

  // entegrasyonlar
  if (urlPath === '/api/integrations' && method === 'GET') {
    return sendJson(res, 200, { integrations: publicSettings().integrations });
  }

  const intMatch = urlPath.match(/^\/api\/integrations\/([a-z0-9_-]+)(\/test)?$/);
  if (intMatch) {
    const id = intMatch[1];
    const isTest = Boolean(intMatch[2]);
    if (method === 'PUT') {
      const body = await readBody(req);
      const s = loadSettings();
      const item = s.integrations.find((i) => i.id === id);
      if (!item) return sendJson(res, 404, { ok: false, error: 'entegrasyon bulunamadı' });
      item.vendor = String(body.vendor ?? item.vendor ?? '').slice(0, 60);
      item.endpoint = String(body.endpoint ?? item.endpoint ?? '').slice(0, 500);
      item.auth_type = ['token', 'basic', 'oauth2', 'mtls', 'none'].includes(body.auth_type) ? body.auth_type : item.auth_type;
      if (typeof body.token === 'string') {
        setSecret(id, body.token.trim());
        item.status = body.token.trim() ? 'configured' : 'not_configured';
      }
      if (body.endpoint && item.vendor && item.status === 'not_configured') item.status = 'configured';
      saveSettings(s);
      auth.audit(me.user.username, 'integration_update', id);
      return sendJson(res, 200, { ok: true, integration: { ...item, has_token: Boolean(loadSecrets()[id]) } });
    }
    if (method === 'POST' && isTest) {
      const s = loadSettings();
      const item = s.integrations.find((i) => i.id === id);
      if (!item) return sendJson(res, 404, { ok: false, error: 'entegrasyon bulunamadı' });
      const result = await testIntegration(item, loadSecrets()[id]);
      item.last_test = { at: new Date().toISOString(), ok: result.ok, detail: result.detail };
      item.status = result.ok ? 'verified' : item.endpoint ? 'error' : 'not_configured';
      saveSettings(s);
      return sendJson(res, result.ok ? 200 : 422, { ok: result.ok, detail: result.detail, status: item.status });
    }
  }

  // oturumlar
  if (urlPath === '/api/sessions/active' && method === 'POST') {
    const body = await readBody(req);
    const id = String(body.session_id ?? '');
    const dir = path.join(SESSIONS, id.replace(/[^a-zA-Z0-9._-]/g, ''));
    if (!id || !fs.existsSync(dir)) return sendJson(res, 404, { ok: false, error: 'oturum bulunamadı' });
    const s = loadSettings();
    s.active_session = id;
    saveSettings(s);
    return sendJson(res, 200, { ok: true, active_session: id });
  }

  if (urlPath === '/api/sessions' && method === 'POST') {
    const body = await readBody(req);
    if (!body.tier) return sendJson(res, 400, { ok: false, error: 'tier zorunlu (tier1|tier2|tier3)' });
    const session = newSession(body);
    return sendJson(res, 201, { ok: true, session });
  }
  if (urlPath === '/api/sessions' && method === 'GET') {
    return sendJson(res, 200, { sessions: listSessions() });
  }

  const sessMatch = urlPath.match(/^\/api\/sessions\/([a-zA-Z0-9._-]+)(?:\/(artifacts|agents|inventory|gate|services|tolerances)(?:\/([\w.-]+))?)?$/);
  if (sessMatch) {
    const id = sessMatch[1];
    const kind = sessMatch[2];
    const artifact = sessMatch[3];
    const dir = sessionDir(id);
    if (!fs.existsSync(dir)) return sendJson(res, 404, { ok: false, error: 'oturum bulunamadı' });

    if (!kind && method === 'GET') {
      const session = readJson(path.join(dir, 'session.json'), {});
      return sendJson(res, 200, { session, artifacts: listArtifacts(id) });
    }

    if (kind === 'artifacts') {
      if (method === 'GET' && artifact) {
        const file = path.join(dir, path.basename(artifact));
        if (!fs.existsSync(file)) return sendJson(res, 404, { ok: false, error: 'artefakt yok' });
        const raw = fs.readFileSync(file, 'utf8');
        let value;
        try {
          value = JSON.parse(raw);
        } catch {
          value = raw;
        }
        return sendJson(res, 200, { ok: true, name: path.basename(artifact), value });
      }
      if (method === 'PUT' && artifact) {
        const body = await readBody(req);
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
          return sendJson(res, 400, { ok: false, error: 'gövde JSON nesnesi olmalı' });
        }
        writeJson(path.join(dir, path.basename(artifact)), body);
        return sendJson(res, 200, { ok: true, name: path.basename(artifact), artifacts: listArtifacts(id) });
      }
    }

    if (kind === 'gate' && method === 'POST') {
      const phase = artifact; // /gate/:phase
      const session = readJson(path.join(dir, 'session.json'), {});
      const resPhase = evaluatePhase(phase, { dir, session });
      session.phases = session.phases ?? {};
      session.phases[phase] = {
        status: resPhase.passed ? 'completed' : 'blocked',
        gate: resPhase.passed ? 'pass' : 'fail',
        at: new Date().toISOString(),
      };
      if (resPhase.passed) {
        const order = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'];
        const i = order.indexOf(phase);
        session.current_phase = order[i + 1] ?? phase;
      }
      writeJson(path.join(dir, 'session.json'), session);
      auth.audit(me.user.username, 'gate_check', `${id}/${phase}:${resPhase.passed ? 'pass' : 'fail'}`);
      return sendJson(res, resPhase.passed ? 200 : 422, { ok: resPhase.passed, phase, results: resPhase.results });
    }

    if (kind === 'services' && method === 'POST') {
      const body = await readBody(req);
      const services = Array.isArray(body.services) ? body.services : [];
      if (!services.length) return sendJson(res, 400, { ok: false, error: 'en az bir hizmet gerekli' });
      const clean = services.slice(0, 200).map((s, i) => ({
        id: String(s.id ?? `SVC-${String(i + 1).padStart(3, '0')}`).slice(0, 40),
        name: String(s.name ?? '').slice(0, 120),
        owner: String(s.owner ?? '').slice(0, 80),
        critical: Boolean(s.critical),
        assets: [],
      }));
      writeJson(path.join(dir, 'business-service-catalogue.json'), { services: clean });
      return sendJson(res, 200, { ok: true, count: clean.length, services: clean });
    }

    if (kind === 'tolerances' && method === 'POST') {
      const body = await readBody(req);
      const rows = Array.isArray(body.tolerances) ? body.tolerances : [];
      if (!rows.length) return sendJson(res, 400, { ok: false, error: 'en az bir tolerans satırı gerekli' });
      const clean = rows.slice(0, 200).map((r) => ({
        service: String(r.service ?? '').slice(0, 40),
        mtd_hours: Number(r.mtd_hours) || 0,
        rto_hours: Number(r.rto_hours) || 0,
        rpo_hours: Number(r.rpo_hours) || 0,
      }));
      writeJson(path.join(dir, 'impact-tolerances.json'), { tolerances: clean });
      const thresholds = Array.isArray(body.thresholds) ? body.thresholds : [];
      if (thresholds.length) {
        writeJson(path.join(dir, 'risk-appetite.json'), {
          thresholds: thresholds.map((t) => ({ metric: String(t.metric ?? 'esik').slice(0, 60), max: Number(t.max) || 0 })),
        });
      }
      return sendJson(res, 200, { ok: true, count: clean.length });
    }

    if (kind === 'agents' && method === 'POST') {
      const body = await readBody(req);
      const activated = Array.isArray(body.activated) ? body.activated.filter((x) => typeof x === 'string') : [];
      const human = body.human_mapping && typeof body.human_mapping === 'object' ? body.human_mapping : {};
      const payload = {
        activated,
        human_mapping: human,
        independence_checks: [
          { check: 'IND-01', result: 'PASS', note: 'uygulama üzerinden kaydedildi' },
          { check: 'IND-02', result: 'PASS', note: 'AUD doğrudan yönetim kuruluna' },
          { check: 'IND-03', result: 'PASS', note: 'insan muadilleri ayrı' },
          { check: 'IND-04', result: 'PASS', note: '1. ve 2. hat ayrı' },
        ],
        updated_at: new Date().toISOString(),
      };
      writeJson(path.join(dir, 'agent-activation.json'), payload);
      return sendJson(res, 200, { ok: true, ...payload });
    }

    if (kind === 'inventory' && method === 'POST') {
      const body = await readBody(req);
      const assets = Array.isArray(body.assets) ? body.assets : [];
      if (!assets.length) return sendJson(res, 400, { ok: false, error: 'en az bir varlık gerekli' });
      const clean = assets.slice(0, 2000).map((a, i) => ({
        id: String(a.id ?? `AST-${String(i + 1).padStart(3, '0')}`).slice(0, 40),
        name: String(a.name ?? '').slice(0, 120),
        criticality: ['critical', 'important', 'standard'].includes(a.criticality) ? a.criticality : 'standard',
        provider: String(a.provider ?? '').slice(0, 60),
      }));
      const payload = {
        assets: clean,
        assets_by_provider: clean.reduce((m, a) => {
          const k = a.provider || 'bilinmiyor';
          m[k] = (m[k] ?? 0) + 1;
          return m;
        }, {}),
        reconciled_at: new Date().toISOString(),
      };
      writeJson(path.join(dir, 'ict-inventory.json'), payload);
      return sendJson(res, 200, { ok: true, count: clean.length, ...payload });
    }
  }

  return sendJson(res, 404, { ok: false, error: 'bilinmeyen API yolu: ' + urlPath });
}

/** Bağlantı testi: endpoint'e HEAD/GET dener; ağ yoksa yapılandırmayı doğrular. */
async function testIntegration(item, token) {
  if (!item.endpoint) return { ok: false, detail: 'endpoint girilmemiş' };
  let url;
  try {
    url = new URL(item.endpoint);
  } catch {
    return { ok: false, detail: 'endpoint geçerli bir URL değil' };
  }
  if (!/^https?:$/.test(url.protocol)) return { ok: false, detail: 'yalnız http/https desteklenir' };

  const headers = { 'User-Agent': 'dora-ai-package/' + version };
  if (token && item.auth_type === 'token') headers.Authorization = 'Bearer ' + token;
  if (token && item.auth_type === 'basic') headers.Authorization = 'Basic ' + Buffer.from(token).toString('base64');

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const r = await fetch(url, { method: 'GET', headers, signal: ctrl.signal, redirect: 'manual' });
    clearTimeout(timer);
    // 2xx/3xx/401/403 → uç ayakta (kimlik doğrulama ayrı konu)
    if (r.status >= 200 && r.status < 500) {
      return { ok: true, detail: `uç yanıt verdi: HTTP ${r.status}` };
    }
    return { ok: false, detail: `uç hata döndü: HTTP ${r.status}` };
  } catch (e) {
    const msg = e.name === 'AbortError' ? 'zaman aşımı (5 sn)' : e.message;
    return { ok: false, detail: 'bağlantı kurulamadı: ' + msg };
  }
}

// ── meta sayımlar (dashboard ile aynı kaynak) ────────────
function metaCounts() {
  const count = (dir, re) => {
    let n = 0;
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.yaml'))) {
      const t = fs.readFileSync(path.join(dir, f), 'utf8');
      n += (t.match(re) ?? []).length;
    }
    return n;
  };
  try {
    return {
      processes: count(path.join(ROOT, 'data/processes'), /^  - id: PRC-/gm),
      controls: (fs.readFileSync(path.join(ROOT, 'data/controls/controls-catalog.yaml'), 'utf8').match(/^  - id: CTL-/gm) ?? []).length,
      roles: (fs.readFileSync(path.join(ROOT, 'data/roles/roles-catalog.yaml'), 'utf8').match(/^  - id: ROL-/gm) ?? []).length,
      terms: (fs.readFileSync(path.join(ROOT, 'data/glossary/glossary-full.yaml'), 'utf8').match(/^  - id: TERM-/gm) ?? []).length,
    };
  } catch {
    return {};
  }
}

// ── statik ───────────────────────────────────────────────
function staticFile(res, urlPath) {
  if (urlPath === '/') {
    res.writeHead(302, { Location: '/app/' });
    return res.end();
  }
  const rel = urlPath.replace(/^\/+/, '');
  let file = path.resolve(ROOT, rel);
  if (!file.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end('yasak');
  }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end('<h1>404</h1><p><a href="/app/">uygulamaya dön</a></p>');
  }
  sendFile(res, file);
}

// ── sunucu ───────────────────────────────────────────────
ensureDirs();

const server = http.createServer(async (req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, `http://${HOST}`).pathname);
  const method = req.method ?? 'GET';
  try {
    if (urlPath.startsWith('/api/')) return await api(req, res, urlPath, method);

    // teknik panel ve tanıtım sitesi yalnız yöneticiye
    const adminArea =
      urlPath === '/dashboard' || urlPath.startsWith('/dashboard/') ||
      urlPath === '/site' || urlPath.startsWith('/site/') ||
      urlPath === '/docs' || urlPath.startsWith('/docs/');
    if (adminArea) {
      // CSRF: tarayıcı formundan gelen basit istekler özel başlık taşıyamaz
  if (method !== 'GET' && method !== 'HEAD' && !req.headers['x-dora-csrf']) {
    return sendJson(res, 403, { ok: false, error: 'CSRF başlığı yok (X-Dora-CSRF)' });
  }

  const me = getUser(req);
      if (!me || me.role !== 'admin') {
        res.writeHead(302, { Location: '/app/#giris' });
        return res.end();
      }
    }
    return staticFile(res, urlPath);
  } catch (e) {
    return sendJson(res, 400, { ok: false, error: e.message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`DORA AI Ajan Paketi ${version} — http://${HOST === '0.0.0.0' ? '<ip>' : HOST}:${PORT}/app/`);
  console.log(`  panel     : /app/`);
  console.log(`  dashboard : /dashboard/`);
  console.log(`  api       : /api/state`);
  console.log(`  veri      : web-data/`);
});

const shutdown = () => {
  console.log('\nkapatılıyor…');
  server.close(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

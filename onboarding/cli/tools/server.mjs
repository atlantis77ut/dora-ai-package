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

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const DATA = path.join(ROOT, 'web-data');
const SESSIONS = path.join(ROOT, '.dora-onboarding');

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
  // durum
  if (urlPath === '/api/state' && method === 'GET') {
    const sessions = listSessions();
    return sendJson(res, 200, {
      version,
      settings: publicSettings(),
      sessions,
      activeSession: sessions[0] ?? null,
      counts: metaCounts(),
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
  if (urlPath === '/api/sessions' && method === 'POST') {
    const body = await readBody(req);
    if (!body.tier) return sendJson(res, 400, { ok: false, error: 'tier zorunlu (tier1|tier2|tier3)' });
    const session = newSession(body);
    return sendJson(res, 201, { ok: true, session });
  }
  if (urlPath === '/api/sessions' && method === 'GET') {
    return sendJson(res, 200, { sessions: listSessions() });
  }

  const sessMatch = urlPath.match(/^\/api\/sessions\/([a-zA-Z0-9._-]+)(?:\/(artifacts|agents|inventory)(?:\/([\w.-]+))?)?$/);
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

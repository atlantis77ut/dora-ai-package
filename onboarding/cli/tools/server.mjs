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
import { verify as verifyLicense, loadPublicKey } from '../src/orl/license.mjs';
import { fetchSiemEvents } from '../src/orl/connectors/siem.mjs';
import { incidentFromEvent, shouldCreateIncident, mergeIncidents, nextSeq, normalizeRules, DEFAULT_KEYWORD_RULES } from '../src/orl/incident.mjs';
import { buildBundle } from '../src/orl/evidence.mjs';
import { createResetStore } from '../src/orl/reset.mjs';
import { createApprovalStore } from '../src/orl/approvals.mjs';
import { createReporting, reportingStatus, markSent } from '../src/orl/deadlines.mjs';
import { scanAlerts, resolveRecipients } from '../src/orl/alerts.mjs';
import { sendMail, createOutbox } from '../src/orl/mailer.mjs';
import { generateSecret, otpauthUrl, generateRecoveryCodes } from '../src/orl/totp.mjs';
import { discover, buildAuthUrl, exchangeCode, fetchJwks, verifyIdToken, makeState, verifyState } from '../src/orl/oidc.mjs';
import { parseInventoryCsv, INVENTORY_CSV_TEMPLATE } from '../src/orl/csv.mjs';
import crypto from 'node:crypto';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
let DATA = process.env.DORA_DATA_DIR ? path.resolve(process.env.DORA_DATA_DIR) : path.join(ROOT, 'web-data');
let SESSIONS = process.env.DORA_SESSIONS_DIR ? path.resolve(process.env.DORA_SESSIONS_DIR) : path.join(ROOT, '.dora-onboarding');
let auth;
let resets;
let outbox;

const { values } = parseArgs({
  options: {
    port: { type: 'string', default: process.env.PORT ?? '8080' },
    host: { type: 'string', default: process.env.HOST ?? '127.0.0.1' },
    'data-dir': { type: 'string', default: process.env.DORA_DATA_DIR ?? '' },
    'sessions-dir': { type: 'string', default: process.env.DORA_SESSIONS_DIR ?? '' },
  },
});
if (values['data-dir']) DATA = path.resolve(values['data-dir']);
if (values['sessions-dir']) SESSIONS = path.resolve(values['sessions-dir']);

auth = createAuthStore(DATA);
resets = createResetStore(path.join(DATA, 'resets.json'), { readJson, writeJson });
outbox = createOutbox(path.join(DATA, 'outbox.json'));

const PORT = Number(values.port);
const HOST = values.host;

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'",
};

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



/** Kurulumun kanıt imza anahtarı: ilk kullanımda üretilir (0600). */
function evidenceKeyPair() {
  const priv = path.join(DATA, 'evidence-key.pem');
  const pub = path.join(DATA, 'evidence-public.pem');
  if (!fs.existsSync(priv)) {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
    fs.mkdirSync(DATA, { recursive: true });
    fs.writeFileSync(priv, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
    fs.writeFileSync(pub, publicKey.export({ type: 'spki', format: 'pem' }));
  }
  return { priv, pub };
}

function stateSecret() {
  const sec = loadSecrets();
  if (!sec.state_secret) {
    sec.state_secret = crypto.randomBytes(32).toString('hex');
    writeJson(path.join(DATA, 'secrets.json'), sec);
  }
  return sec.state_secret;
}

const SCHEDULE_FILE = path.join(DATA, 'schedule.json');
const RULES_FILE = path.join(DATA, 'siem-rules.json');

function loadRules() {
  const doc = readJson(RULES_FILE, null);
  return doc?.rules?.length ? doc.rules : DEFAULT_KEYWORD_RULES;
}

function saveRules(rules) {
  writeJson(RULES_FILE, { rules, updated_at: new Date().toISOString() });
}

function loadSchedule() {
  return readJson(SCHEDULE_FILE, { enabled: false, interval_minutes: 60, min_severity: 'high', last_run: null });
}

function saveSchedule(s) {
  writeJson(SCHEDULE_FILE, s);
}

let schedRunning = false;

/** Tüm oturumlar için SIEM'i bir kez çeker, taslak kayıt üretir. */
async function runScheduledFetch({ reason = 'manual' } = {}) {
  if (schedRunning) return { ok: false, error: 'zaten çalışıyor' };
  schedRunning = true;
  const cfg = loadSettings().integrations.find((i) => i.id === 'siem') ?? {};
  const token = loadSecrets().siem;
  const rules = loadRules();
  const schedule = loadSchedule();
  let fetched = 0;
  let created = 0;
  let error = null;
  try {
    if (!cfg.endpoint) throw new Error('SIEM adresi tanımlı değil');
    const result = await fetchSiemEvents({ vendor: cfg.vendor, endpoint: cfg.endpoint, token }, { limit: 100 });
    fetched = result.count;
    for (const s of listSessions().slice(0, 10)) {
      const dir = path.join(SESSIONS, s.session_id);
      const siemFile = path.join(dir, 'siem-events.json');
      writeJson(siemFile, result);
      const pool = result.events.filter((e) => shouldCreateIncident(e, { minSeverity: schedule.min_severity, rules }).yes);
      const stored = readJson(path.join(dir, 'incidents.json'), { incidents: [] });
      const existing = stored.incidents ?? [];
      let seq = nextSeq(existing);
      const drafts = pool.map((e) => {
        const inc = incidentFromEvent(e, { sessionId: s.session_id, seq: seq++, rules });
        inc.reporting = createReporting(inc.detected_at);
        return inc;
      });
      const merged = mergeIncidents(existing, drafts);
      if (merged.added.length) {
        writeJson(path.join(dir, 'incidents.json'), { incidents: merged.all, updated_at: new Date().toISOString() });
        created += merged.added.length;
      }
    }
  } catch (e) {
    error = e.message;
  } finally {
    schedRunning = false;
  }
  schedule.last_run = {
    at: new Date().toISOString(),
    ok: !error,
    reason,
    fetched,
    created,
    error,
  };
  saveSchedule(schedule);
  auth.audit('scheduler', 'siem_scheduled', `${reason}: ${fetched} olay, ${created} kayıt${error ? ', hata: ' + error : ''}`);
  return { ok: !error, ...schedule.last_run };
}

function scheduleTick() {
  const s = loadSchedule();
  if (!s.enabled) return;
  const interval = Math.max(1, Number(s.interval_minutes) || 60) * 60 * 1000;
  const last = s.last_run?.at ? new Date(s.last_run.at).getTime() : 0;
  if (Date.now() - last >= interval) {
    runScheduledFetch({ reason: 'schedule' }).catch(() => {});
  }
}

function smtpConfig() {
  const s = loadSettings().smtp ?? {};
  return {
    enabled: Boolean(s.enabled && s.host && s.from),
    host: s.host ?? '',
    port: Number(s.port) || 587,
    secure: Boolean(s.secure),
    allowSelfSigned: Boolean(s.allow_self_signed),
    user: s.user ?? '',
    from: s.from ?? '',
    pass: loadSecrets().smtp_pass ?? '',
  };
}

/** Gönderir; olmuyorsa kuyruğa alır. Dönen: { sent, queued, error } */
async function sendOrQueue({ to, subject, text }) {
  const cfg = smtpConfig();
  if (!cfg.enabled) {
    outbox.enqueue({ to, subject, text });
    return { sent: false, queued: true, error: 'SMTP yapılandırılmamış — kuyruğa alındı' };
  }
  try {
    await sendMail(cfg, { to, subject, text });
    return { sent: true, queued: false };
  } catch (e) {
    outbox.enqueue({ to, subject, text });
    return { sent: false, queued: true, error: e.message };
  }
}

function inviteText({ username, url, ttlMinutes = 30 }) {
  return [
    'Merhaba,',
    '',
    'DORA Ajan Paketi kurulumu için bir hesap oluşturuldu.',
    `Kullanıcı adı: ${username}`,
    '',
    'Parolanızı belirlemek için aşağıdaki bağlantıyı açın:',
    url,
    '',
    `Bağlantı ${ttlMinutes} dakika geçerlidir ve tek kullanımlıktır.`,
    'Bu isteği siz yapmadıysanız yöneticinize bildirin.',
    '',
    'DORA Ajan Paketi',
  ].join('\n');
}

function approvalStore(dir) {
  return createApprovalStore(path.join(dir, 'approvals.json'), { readJson, writeJson });
}

function twoPersonEnabled() {
  return Boolean(loadSettings().approvals?.two_person);
}

/** Onaylanan olay güncellemesini uygular (PATCH ile aynı kurallar). */
function applyIncidentUpdate(dir, payload) {
  const stored = readJson(path.join(dir, 'incidents.json'), { incidents: [] });
  const list = stored.incidents ?? [];
  const inc = list.find((x) => x.incident_id === payload.incident_id);
  if (!inc) return { ok: false, error: 'olay kaydı yok' };
  const num = (v) => (v === null || v === undefined || v === '' ? null : Math.max(0, Number(v) || 0));
  for (const k of ['affected_customers', 'outage_minutes', 'economic_impact_eur']) {
    if (k in payload) inc[k] = num(payload[k]);
  }
  if ('data_loss' in payload) inc.data_loss = Boolean(payload.data_loss);
  if ('unauthorized_access' in payload) inc.unauthorized_access = Boolean(payload.unauthorized_access);
  if (['unclassified', 'major', 'not_major'].includes(payload.classification)) inc.classification = payload.classification;
  inc.updated_at = new Date().toISOString();
  if (payload.promote === true) {
    writeJson(path.join(dir, 'incident-record.json'), {
      incident_id: inc.incident_id,
      detected_at: inc.detected_at,
      source: inc.origin ?? 'siem',
      siem_event_id: inc.siem_event_id,
      classification: inc.classification,
      affected_customers: inc.affected_customers,
      outage_minutes: inc.outage_minutes,
      economic_impact_eur: inc.economic_impact_eur,
      data_loss: inc.data_loss,
      unauthorized_access: inc.unauthorized_access,
      affected_member_states: inc.affected_member_states,
      promoted_at: new Date().toISOString(),
    });
    inc.status = 'open';
  }
  writeJson(path.join(dir, 'incidents.json'), { incidents: list, updated_at: inc.updated_at });
  return { ok: true, incident: inc };
}

function applyGoLive(dir, payload) {
  const record = {
    shadow_days: Math.max(0, Number(payload.shadow_days) || 0),
    semi_auto_days: Math.max(0, Number(payload.semi_auto_days) || 0),
    mos_dashboard: Boolean(payload.mos_dashboard),
    regwatch_agent: Boolean(payload.regwatch_agent),
    annual_review_date: String(payload.annual_review_date ?? '').slice(0, 10),
    decided_at: new Date().toISOString(),
  };
  writeJson(path.join(dir, 'go-live.json'), record);
  return { ok: true, record };
}

function applyAssessmentAccept(dir, payload) {
  const file = path.join(dir, 'gap-analysis.json');
  const doc = readJson(file, { high_severity: 0, risk_acceptance: [] });
  doc.risk_acceptance = [...(doc.risk_acceptance ?? []), ...(payload.risks ?? []).map((r) => String(r).slice(0, 200))];
  doc.updated_at = new Date().toISOString();
  writeJson(file, doc);
  return { ok: true, risk_acceptance: doc.risk_acceptance };
}

const ALERTS_FILE = path.join(DATA, 'alerts-state.json');

function notifySettings() {
  return { enabled: false, recipients: [], ...(loadSettings().notifications ?? {}) };
}

/** Raporlama süreleri + bekleyen onaylar için uyarı e-postaları üretir. */
let alertScanChain = Promise.resolve();

/** Taramaları sıraya sokar: eşzamanlı çalışma tekrar e-postaya yol açmasın. */
function runAlertScan(opts = {}) {
  alertScanChain = alertScanChain.then(() => runAlertScanOnce(opts)).catch(() => ({ ok: false }));
  return alertScanChain;
}

async function runAlertScanOnce({ reason = 'tick' } = {}) {
  const cfg = notifySettings();
  if (!cfg.enabled) return { ok: false, skipped: true, error: 'bildirimler kapalı' };

  const state = readJson(ALERTS_FILE, { sent: {} });
  const sessions = listSessions()
    .slice(0, 10)
    .map((s) => {
      const dir = path.join(SESSIONS, s.session_id);
      return {
        id: s.session_id,
        incidents: readJson(path.join(dir, 'incidents.json'), { incidents: [] }).incidents ?? [],
        approvals: readJson(path.join(dir, 'approvals.json'), { approvals: [] }).approvals ?? [],
      };
    });

  const { events, state: nextState } = scanAlerts({ sessions, state, now: Date.now() });
  const recipients = resolveRecipients(
    { notifications: cfg },
    auth.users().filter((u) => u.role === 'admin').map((u) => u.username),
  );

  let sent = 0;
  const problems = [];
  for (const ev of events) {
    if (!recipients.length) {
      problems.push('alıcı yok');
      break;
    }
    for (const to of recipients) {
      const r = await sendOrQueue({ to, subject: ev.subject, text: ev.text });
      if (r.sent) sent++;
      else if (r.error && !r.queued) problems.push(r.error);
    }
  }

  writeJson(ALERTS_FILE, nextState);
  const s = loadSettings();
  s.notifications = { ...cfg, last_run: { at: new Date().toISOString(), reason, events: events.length, sent, problems: problems.slice(0, 3) } };
  saveSettings(s);
  if (events.length) auth.audit('alerts', 'notify_scan', `${reason}: ${events.length} uyarı, ${sent} e-posta`);
  return { ok: true, events: events.length, sent, recipients: recipients.length, problems: problems.slice(0, 3) };
}

let lastAlertScan = 0;
function alertsTick() {
  const cfg = notifySettings();
  if (!cfg.enabled) return;
  if (Date.now() - lastAlertScan < 5 * 60 * 1000) return;
  lastAlertScan = Date.now();
  runAlertScan({ reason: 'tick' }).catch(() => {});
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
  if (urlPath === '/api/health') return sendJson(res, 200, { ok: true, version });

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
    if (r.otpRequired) {
      return sendJson(res, 200, { ok: true, otp_required: true, challenge: r.challenge });
    }
    setCookie(res, req, r.token, hours * 3600);
    return sendJson(res, 200, { ok: true, user: r.user });
  }

  if (urlPath === '/api/auth/logout' && method === 'POST') {
    // CSRF: tarayıcı formundan gelen basit istekler özel başlık taşıyamaz
  if (method !== 'GET' && method !== 'HEAD' && !req.headers['x-dora-csrf']) {
    return sendJson(res, 403, { ok: false, error: 'CSRF başlığı yok (X-Dora-CSRF)' });
  }

  if (urlPath === '/api/auth/oidc/status' && method === 'GET') {
    const cfg = loadSettings().oidc ?? {};
    return sendJson(res, 200, { enabled: Boolean(cfg.enabled && cfg.issuer && cfg.client_id), issuer: cfg.issuer ?? null });
  }

  if (urlPath === '/api/auth/oidc/start' && method === 'GET') {
    const cfg = loadSettings().oidc ?? {};
    if (!cfg.enabled || !cfg.issuer || !cfg.client_id) {
      return sendJson(res, 400, { ok: false, error: 'SSO yapılandırılmamış' });
    }
    try {
      const disc = await discover(cfg.issuer);
      const st = makeState(stateSecret());
      const url = buildAuthUrl(cfg, { state: st.state, nonce: st.nonce, discovery: disc });
      res.writeHead(302, {
        Location: url,
        'Set-Cookie': `dora_oidc=${encodeURIComponent(st.state)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`,
      });
      return res.end();
    } catch (e) {
      return sendJson(res, 502, { ok: false, error: 'SSO başlatılamadı: ' + e.message });
    }
  }

  if (urlPath === '/api/auth/oidc/callback' && method === 'GET') {
    const cfg = loadSettings().oidc ?? {};
    const url = new URL(req.url, 'http://localhost');
    const code = url.searchParams.get('code') ?? '';
    const state = url.searchParams.get('state') ?? '';
    const cookieState = parseCookies(req).dora_oidc ?? '';
    const fail = (msg) => {
      res.writeHead(302, { Location: '/app/#giris=' + encodeURIComponent(msg) });
      return res.end();
    };
    if (!cfg.enabled || !cfg.issuer) return fail('SSO kapalı');
    if (!code || !state || state !== cookieState) return fail('durum doğrulanamadı');
    try {
      const disc = await discover(cfg.issuer);
      const tokenCfg = { ...cfg, token_endpoint: disc.token_endpoint, jwks_uri: disc.jwks_uri };
      const st = verifyState(stateSecret(), state);
      if (!st) return fail('durum süresi dolmuş');
      const tok = await exchangeCode(tokenCfg, code);
      const jwks = await fetchJwks(tokenCfg);
      const v = verifyIdToken(tok.id_token, jwks, {
        issuer: cfg.issuer,
        clientId: cfg.client_id,
        nonce: st.nonce,
      });
      if (!v.valid) return fail('kimlik doğrulanamadı: ' + v.reason);
      const claims = v.claims;
      const email = String(claims.email ?? '').toLowerCase();
      const list = auth.users();
      let user = list.find((u) => u.username.toLowerCase() === email || u.username === claims.sub);
      if (!user && cfg.auto_provision) {
        const created = auth.createUser({
          username: email || String(claims.sub).slice(0, 40),
          password: crypto.randomBytes(24).toString('base64url'),
          name: claims.name ?? email,
          role: 'user',
        });
        if (!created.ok) return fail('kullanıcı oluşturulamadı');
        user = created.user;
      }
      if (!user) return fail('bu hesap için yetki tanımlı değil');
      const hours = Number(loadSettings().session_hours) || 8;
      // SSO kullanıcısının parolası yok; doğrudan oturum token'ı üret
      const token = auth.refresh(user, hours);
      auth.audit(user.username, 'login_sso', cfg.issuer);
      setCookie(res, req, token, hours * 3600);
      res.writeHead(302, { Location: '/app/#genel' });
      return res.end();
    } catch (e) {
      return fail('SSO hatası: ' + e.message);
    }
  }

  if (urlPath === '/api/auth/reset' && method === 'POST') {
    const body = await readBody(req);
    const r = resets.consume(body.token);
    if (!r.ok) {
      auth.audit('-', 'reset_failed');
      return sendJson(res, 400, { ok: false, error: r.error });
    }
    const upd = auth.updateUser(r.uid, { password: body.password });
    if (!upd.ok) return sendJson(res, 400, { ok: false, error: upd.error });
    auth.audit(upd.user.username, 'reset_completed', 'tek kullanımlık bağlantı');
    return sendJson(res, 200, { ok: true, username: upd.user.username });
  }

  if (urlPath === '/api/auth/2fa/verify' && method === 'POST') {
    const body = await readBody(req);
    if (throttled('otp:' + String(body.challenge ?? '').slice(0, 16))) {
      return sendJson(res, 429, { ok: false, error: 'çok fazla deneme — 1 dakika sonra tekrar deneyin' });
    }
    const hours = Number(loadSettings().session_hours) || 8;
    const r = auth.verifyOtp(String(body.challenge ?? ''), body.code, hours);
    if (!r.ok) {
      recordFailure('otp:' + String(body.challenge ?? '').slice(0, 16));
      return sendJson(res, 401, { ok: false, error: r.error });
    }
    setCookie(res, req, r.token, hours * 3600);
    return sendJson(res, 200, { ok: true, user: r.user });
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

  if (urlPath === '/api/auth/oidc/status' && method === 'GET') {
    const cfg = loadSettings().oidc ?? {};
    return sendJson(res, 200, { enabled: Boolean(cfg.enabled && cfg.issuer && cfg.client_id), issuer: cfg.issuer ?? null });
  }

  if (urlPath === '/api/auth/oidc/start' && method === 'GET') {
    const cfg = loadSettings().oidc ?? {};
    if (!cfg.enabled || !cfg.issuer || !cfg.client_id) {
      return sendJson(res, 400, { ok: false, error: 'SSO yapılandırılmamış' });
    }
    try {
      const disc = await discover(cfg.issuer);
      const st = makeState(stateSecret());
      const url = buildAuthUrl(cfg, { state: st.state, nonce: st.nonce, discovery: disc });
      res.writeHead(302, {
        Location: url,
        'Set-Cookie': `dora_oidc=${encodeURIComponent(st.state)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`,
      });
      return res.end();
    } catch (e) {
      return sendJson(res, 502, { ok: false, error: 'SSO başlatılamadı: ' + e.message });
    }
  }

  if (urlPath === '/api/auth/oidc/callback' && method === 'GET') {
    const cfg = loadSettings().oidc ?? {};
    const url = new URL(req.url, 'http://localhost');
    const code = url.searchParams.get('code') ?? '';
    const state = url.searchParams.get('state') ?? '';
    const cookieState = parseCookies(req).dora_oidc ?? '';
    const fail = (msg) => {
      res.writeHead(302, { Location: '/app/#giris=' + encodeURIComponent(msg) });
      return res.end();
    };
    if (!cfg.enabled || !cfg.issuer) return fail('SSO kapalı');
    if (!code || !state || state !== cookieState) return fail('durum doğrulanamadı');
    try {
      const disc = await discover(cfg.issuer);
      const tokenCfg = { ...cfg, token_endpoint: disc.token_endpoint, jwks_uri: disc.jwks_uri };
      const st = verifyState(stateSecret(), state);
      if (!st) return fail('durum süresi dolmuş');
      const tok = await exchangeCode(tokenCfg, code);
      const jwks = await fetchJwks(tokenCfg);
      const v = verifyIdToken(tok.id_token, jwks, {
        issuer: cfg.issuer,
        clientId: cfg.client_id,
        nonce: st.nonce,
      });
      if (!v.valid) return fail('kimlik doğrulanamadı: ' + v.reason);
      const claims = v.claims;
      const email = String(claims.email ?? '').toLowerCase();
      const list = auth.users();
      let user = list.find((u) => u.username.toLowerCase() === email || u.username === claims.sub);
      if (!user && cfg.auto_provision) {
        const created = auth.createUser({
          username: email || String(claims.sub).slice(0, 40),
          password: crypto.randomBytes(24).toString('base64url'),
          name: claims.name ?? email,
          role: 'user',
        });
        if (!created.ok) return fail('kullanıcı oluşturulamadı');
        user = created.user;
      }
      if (!user) return fail('bu hesap için yetki tanımlı değil');
      const hours = Number(loadSettings().session_hours) || 8;
      // SSO kullanıcısının parolası yok; doğrudan oturum token'ı üret
      const token = auth.refresh(user, hours);
      auth.audit(user.username, 'login_sso', cfg.issuer);
      setCookie(res, req, token, hours * 3600);
      res.writeHead(302, { Location: '/app/#genel' });
      return res.end();
    } catch (e) {
      return fail('SSO hatası: ' + e.message);
    }
  }

  if (urlPath === '/api/auth/reset' && method === 'POST') {
    const body = await readBody(req);
    const r = resets.consume(body.token);
    if (!r.ok) {
      auth.audit('-', 'reset_failed');
      return sendJson(res, 400, { ok: false, error: r.error });
    }
    const upd = auth.updateUser(r.uid, { password: body.password });
    if (!upd.ok) return sendJson(res, 400, { ok: false, error: upd.error });
    auth.audit(upd.user.username, 'reset_completed', 'tek kullanımlık bağlantı');
    return sendJson(res, 200, { ok: true, username: upd.user.username });
  }

  if (urlPath === '/api/auth/2fa/verify' && method === 'POST') {
    const body = await readBody(req);
    if (throttled('otp:' + String(body.challenge ?? '').slice(0, 16))) {
      return sendJson(res, 429, { ok: false, error: 'çok fazla deneme — 1 dakika sonra tekrar deneyin' });
    }
    const hours = Number(loadSettings().session_hours) || 8;
    const r = auth.verifyOtp(String(body.challenge ?? ''), body.code, hours);
    if (!r.ok) {
      recordFailure('otp:' + String(body.challenge ?? '').slice(0, 16));
      return sendJson(res, 401, { ok: false, error: r.error });
    }
    setCookie(res, req, r.token, hours * 3600);
    return sendJson(res, 200, { ok: true, user: r.user });
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

  if (urlPath === '/api/auth/2fa/setup' && method === 'POST') {
    if (!me) return sendJson(res, 401, { ok: false, error: 'giriş gerekli' });
    const secret = generateSecret();
    const r = auth.setPendingTotp(me.user.id, secret);
    if (!r.ok) return sendJson(res, 400, { ok: false, error: r.error });
    return sendJson(res, 200, {
      ok: true,
      secret,
      otpauth: otpauthUrl('DORA Ajan Paketi', me.user.username, secret),
    });
  }

  if (urlPath === '/api/auth/2fa/enable' && method === 'POST') {
    if (!me) return sendJson(res, 401, { ok: false, error: 'giriş gerekli' });
    const body = await readBody(req);
    const codes = generateRecoveryCodes();
    const r = auth.enableTotp(me.user.id, body.code, codes);
    if (!r.ok) return sendJson(res, 400, { ok: false, error: r.error });
    return sendJson(res, 200, { ok: true, recovery_codes: codes });
  }

  if (urlPath === '/api/auth/2fa/disable' && method === 'POST') {
    if (!me) return sendJson(res, 401, { ok: false, error: 'giriş gerekli' });
    const body = await readBody(req);
    const check = auth.login(me.user.username, body.password);
    if (!check.ok) return sendJson(res, 400, { ok: false, error: 'parola hatalı' });
    auth.disableTotp(me.user.id);
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
  if (urlPath.startsWith('/api/users') || urlPath === '/api/audit' || urlPath === '/api/audit.csv') {
    if (!isAdmin) return sendJson(res, 403, { ok: false, error: 'yönetici yetkisi gerekli' });
    if (urlPath === '/api/users' && method === 'GET') return sendJson(res, 200, { users: auth.users() });
    if (urlPath === '/api/users' && method === 'POST') {
      const body = await readBody(req);
      const r = auth.createUser(body);
      if (!r.ok) return sendJson(res, 400, { ok: false, error: r.error });
      auth.audit(me.user.username, 'user_create', body.username);
      let email = null;
      if (body.send_invite) {
        const inv = resets.issue(r.user.id);
        email = await sendOrQueue({
          to: r.user.username,
          subject: 'DORA Ajan Paketi — hesap daveti',
          text: inviteText({ username: r.user.username, url: `/app/#reset=${inv.token}` }),
        });
      }
      return sendJson(res, 201, { ok: true, user: r.user, email });
    }
    const rl = urlPath.match(/^\/api\/users\/([\w-]+)\/reset-link$/);
    if (rl && method === 'POST') {
      const body = await readBody(req);
      const list = auth.users();
      const target = list.find((u) => u.id === rl[1]);
      if (!target) return sendJson(res, 404, { ok: false, error: 'kullanıcı yok' });
      const r = resets.issue(target.id);
      const url = `/app/#reset=${r.token}`;
      let mail = null;
      if (body.send_email) {
        mail = await sendOrQueue({
          to: target.username,
          subject: 'DORA Ajan Paketi — parola bağlantısı',
          text: inviteText({ username: target.username, url }),
        });
      }
      auth.audit(me.user.username, 'reset_link', target.username);
      return sendJson(res, 200, {
        ok: true,
        username: target.username,
        token: r.token,
        url,
        expires_at: r.expires_at,
        email: mail,
      });
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
    if (urlPath === '/api/audit.csv' && method === 'GET') {
      const rows = auth.listAudit(1000);
      const csv = ['zaman,kullanici,islem,hedef']
        .concat(rows.map((e) => [e.at, e.user, e.action, e.target ?? ''].map((x) => `"${String(x).replace(/"/g, '""')}"`).join(',')))
        .join('\n');
      res.writeHead(200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="islem-kaydi.csv"',
        'Cache-Control': 'no-store',
      });
      return res.end('\uFEFF' + csv + '\n');
    }
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

  if (urlPath === '/api/catalog/articles' && method === 'GET') {
    const doc = parse(fs.readFileSync(path.join(ROOT, 'data/mapping/dora-articles.yaml'), 'utf8'));
    const articles = (doc.articles ?? []).map((a) => ({
      id: a.id,
      title: a.title,
      chapter: a.chapter,
      status: a.status,
      processes: a.processes ?? [],
      controls: a.controls ?? [],
    }));
    return sendJson(res, 200, { articles, count: articles.length });
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

  if (urlPath === '/api/templates/inventory.csv' && method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="envanter-sablonu.csv"',
      'Cache-Control': 'no-store',
    });
    return res.end('\uFEFF' + INVENTORY_CSV_TEMPLATE);
  }

  if (urlPath === '/api/settings/oidc' && method === 'GET') {
    if (!isAdmin) return sendJson(res, 403, { ok: false, error: 'yönetici yetkisi gerekli' });
    const cfg = loadSettings().oidc ?? {};
    return sendJson(res, 200, { ...cfg, client_secret_set: Boolean(loadSecrets().oidc_client_secret) });
  }

  if (urlPath === '/api/settings/oidc' && method === 'PUT') {
    if (!isAdmin) return sendJson(res, 403, { ok: false, error: 'yönetici yetkisi gerekli' });
    const body = await readBody(req);
    const s = loadSettings();
    s.oidc = {
      enabled: Boolean(body.enabled),
      issuer: String(body.issuer ?? '').slice(0, 300),
      client_id: String(body.client_id ?? '').slice(0, 200),
      redirect_uri: String(body.redirect_uri ?? '').slice(0, 300),
      scopes: String(body.scopes ?? 'openid email profile').slice(0, 120),
      auto_provision: Boolean(body.auto_provision),
    };
    saveSettings(s);
    if (typeof body.client_secret === 'string' && body.client_secret.trim()) {
      const sec = loadSecrets();
      sec.oidc_client_secret = body.client_secret.trim();
      if (!sec.state_secret) sec.state_secret = crypto.randomBytes(32).toString('hex');
      writeJson(path.join(DATA, 'secrets.json'), sec);
    }
    const sec2 = loadSecrets();
    if (!sec2.state_secret) {
      sec2.state_secret = crypto.randomBytes(32).toString('hex');
      writeJson(path.join(DATA, 'secrets.json'), sec2);
    }
    auth.audit(me.user.username, 'oidc_update', s.oidc.issuer);
    return sendJson(res, 200, { ok: true, oidc: s.oidc });
  }

  if (urlPath === '/api/settings/siem-rules' && method === 'GET') {
    if (!isAdmin) return sendJson(res, 403, { ok: false, error: 'yönetici yetkisi gerekli' });
    return sendJson(res, 200, { ok: true, rules: loadRules() });
  }

  if (urlPath === '/api/settings/siem-rules' && method === 'PUT') {
    if (!isAdmin) return sendJson(res, 403, { ok: false, error: 'yönetici yetkisi gerekli' });
    const body = await readBody(req);
    const rules = normalizeRules(body.rules);
    saveRules(rules);
    auth.audit(me.user.username, 'siem_rules_update', String(rules.length) + ' kural');
    return sendJson(res, 200, { ok: true, rules });
  }

  if (urlPath === '/api/settings/schedule' && method === 'GET') {
    if (!isAdmin) return sendJson(res, 403, { ok: false, error: 'yönetici yetkisi gerekli' });
    return sendJson(res, 200, { ok: true, ...loadSchedule() });
  }

  if (urlPath === '/api/settings/schedule' && method === 'PUT') {
    if (!isAdmin) return sendJson(res, 403, { ok: false, error: 'yönetici yetkisi gerekli' });
    const body = await readBody(req);
    const s = loadSchedule();
    s.enabled = Boolean(body.enabled);
    s.interval_minutes = Math.max(1, Math.min(1440, Number(body.interval_minutes) || 60));
    if (['low', 'medium', 'high'].includes(body.min_severity)) s.min_severity = body.min_severity;
    saveSchedule(s);
    auth.audit(me.user.username, 'schedule_update', `${s.enabled ? 'açık' : 'kapalı'} / ${s.interval_minutes} dk`);
    return sendJson(res, 200, { ok: true, ...s });
  }

  if (urlPath === '/api/settings/schedule/run' && method === 'POST') {
    if (!isAdmin) return sendJson(res, 403, { ok: false, error: 'yönetici yetkisi gerekli' });
    const r = await runScheduledFetch({ reason: 'manual' });
    return sendJson(res, r.ok ? 200 : 502, r);
  }

  if (urlPath === '/api/settings/smtp' && method === 'GET') {
    if (!isAdmin) return sendJson(res, 403, { ok: false, error: 'yönetici yetkisi gerekli' });
    const s = loadSettings().smtp ?? {};
    return sendJson(res, 200, { ...s, password_set: Boolean(loadSecrets().smtp_pass) });
  }

  if (urlPath === '/api/settings/smtp' && method === 'PUT') {
    if (!isAdmin) return sendJson(res, 403, { ok: false, error: 'yönetici yetkisi gerekli' });
    const body = await readBody(req);
    const s = loadSettings();
    s.smtp = {
      enabled: Boolean(body.enabled),
      host: String(body.host ?? '').slice(0, 200),
      port: Math.max(1, Math.min(65535, Number(body.port) || 587)),
      secure: Boolean(body.secure),
      allow_self_signed: Boolean(body.allow_self_signed),
      user: String(body.user ?? '').slice(0, 200),
      from: String(body.from ?? '').slice(0, 200),
    };
    saveSettings(s);
    if (typeof body.password === 'string' && body.password) {
      const sec = loadSecrets();
      sec.smtp_pass = body.password;
      writeJson(path.join(DATA, 'secrets.json'), sec);
    }
    auth.audit(me.user.username, 'smtp_update', s.smtp.host);
    return sendJson(res, 200, { ok: true, smtp: s.smtp });
  }

  if (urlPath === '/api/settings/smtp/test' && method === 'POST') {
    if (!isAdmin) return sendJson(res, 403, { ok: false, error: 'yönetici yetkisi gerekli' });
    const body = await readBody(req);
    const to = String(body.to ?? '').trim();
    if (!to) return sendJson(res, 400, { ok: false, error: 'alıcı adresi gerekli' });
    const r = await sendOrQueue({ to, subject: 'DORA Ajan Paketi — test iletisi', text: 'Bu bir test iletisidir.' });
    auth.audit(me.user.username, 'smtp_test', to);
    return sendJson(res, r.sent ? 200 : 502, r);
  }

  if (urlPath === '/api/outbox' && method === 'GET') {
    if (!isAdmin) return sendJson(res, 403, { ok: false, error: 'yönetici yetkisi gerekli' });
    return sendJson(res, 200, { ok: true, messages: outbox.list() });
  }

  if (urlPath === '/api/outbox/flush' && method === 'POST') {
    if (!isAdmin) return sendJson(res, 403, { ok: false, error: 'yönetici yetkisi gerekli' });
    const cfg = smtpConfig();
    let sent = 0;
    const failed = [];
    for (const m of outbox.list()) {
      try {
        await sendMail(cfg, { to: m.to, subject: m.subject, text: m.text });
        outbox.remove(m.id);
        sent++;
      } catch (e) {
        outbox.markFailed(m.id, e.message);
        failed.push({ id: m.id, error: e.message });
      }
    }
    return sendJson(res, 200, { ok: true, sent, failed: failed.length, details: failed.slice(0, 5) });
  }

  if (urlPath === '/api/outbox/clear' && method === 'POST') {
    if (!isAdmin) return sendJson(res, 403, { ok: false, error: 'yönetici yetkisi gerekli' });
    outbox.clear();
    return sendJson(res, 200, { ok: true });
  }

  if (urlPath === '/api/settings/approvals' && method === 'GET') {
    if (!isAdmin) return sendJson(res, 403, { ok: false, error: 'yönetici yetkisi gerekli' });
    return sendJson(res, 200, { ok: true, ...(loadSettings().approvals ?? { two_person: false }) });
  }

  if (urlPath === '/api/settings/approvals' && method === 'PUT') {
    if (!isAdmin) return sendJson(res, 403, { ok: false, error: 'yönetici yetkisi gerekli' });
    const body = await readBody(req);
    const s = loadSettings();
    s.approvals = { two_person: Boolean(body.two_person) };
    saveSettings(s);
    auth.audit(me.user.username, 'approvals_update', s.approvals.two_person ? 'açık' : 'kapalı');
    return sendJson(res, 200, { ok: true, ...s.approvals });
  }

  if (urlPath === '/api/settings/notifications' && method === 'GET') {
    if (!isAdmin) return sendJson(res, 403, { ok: false, error: 'yönetici yetkisi gerekli' });
    return sendJson(res, 200, { ok: true, ...notifySettings() });
  }

  if (urlPath === '/api/settings/notifications' && method === 'PUT') {
    if (!isAdmin) return sendJson(res, 403, { ok: false, error: 'yönetici yetkisi gerekli' });
    const body = await readBody(req);
    const recipients = (Array.isArray(body.recipients) ? body.recipients : [])
      .map((x) => String(x).trim())
      .filter((x) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x))
      .slice(0, 20);
    const s = loadSettings();
    s.notifications = { enabled: Boolean(body.enabled), recipients, last_run: s.notifications?.last_run ?? null };
    saveSettings(s);
    auth.audit(me.user.username, 'notifications_update', s.notifications.enabled ? 'açık' : 'kapalı');
    return sendJson(res, 200, { ok: true, ...s.notifications });
  }

  if (urlPath === '/api/settings/notifications/scan' && method === 'POST') {
    if (!isAdmin) return sendJson(res, 403, { ok: false, error: 'yönetici yetkisi gerekli' });
    const r = await runAlertScan({ reason: 'manual' });
    return sendJson(res, r.ok ? 200 : 400, r);
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

  const sessMatch = urlPath.match(/^\/api\/sessions\/([a-zA-Z0-9._-]+)(?:\/(artifacts|agents|inventory|gate|services|tolerances|mapping|scenarios|assessment|autonomy|golive|license|export|siem|incidents|approvals|reporting)(?:\/([\w.-]+))?)?$/);
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

    if (kind === 'export' && method === 'POST') {
      const session = readJson(path.join(dir, 'session.json'), {});
      const keys = evidenceKeyPair();
      const outFile = path.join(dir, 'evidence-bundle.zip');
      const res_ = buildBundle({ dir, session, outFile, keyFile: keys.priv, extraFiles: [keys.pub] });
      auth.audit(me.user.username, 'evidence_export', `${id} (${res_.files} dosya)`);
      return sendJson(res, 200, {
        ok: true,
        files: res_.files,
        chain_head: res_.chainHead,
        signed: res_.signed,
        size: fs.statSync(res_.outFile).size,
        generated_at: res_.manifest.generated_at,
        download: `/api/sessions/${id}/export/download`,
      });
    }

    if (kind === 'export' && method === 'GET') {
      const file = path.join(dir, 'evidence-bundle.zip');
      if (!fs.existsSync(file)) return sendJson(res, 404, { ok: false, error: 'önce paketi oluşturun' });
      const buf = fs.readFileSync(file);
      res.writeHead(200, {
        'Content-Type': 'application/zip',
        'Content-Length': buf.length,
        'Content-Disposition': `attachment; filename="kanit-paketi-${id}.zip"`,
        'Cache-Control': 'no-store',
      });
      return res.end(buf);
    }

    if (kind === 'reporting' && method === 'POST') {
      const step = artifact;
      if (!['initial', 'intermediate', 'final'].includes(step)) {
        return sendJson(res, 400, { ok: false, error: 'adım initial|intermediate|final olmalı' });
      }
      const body = await readBody(req);
      const targetId = String(body.incident_id ?? '');
      const stored = readJson(path.join(dir, 'incidents.json'), { incidents: [] });
      const list = stored.incidents ?? [];
      const inc = list.find((x) => x.incident_id === targetId);
      if (!inc) return sendJson(res, 404, { ok: false, error: 'olay kaydı yok' });
      inc.reporting = markSent(inc.reporting ?? createReporting(inc.detected_at), step, {
        at: body.sent_at,
        reference: body.reference,
      });
      inc.updated_at = new Date().toISOString();
      writeJson(path.join(dir, 'incidents.json'), { incidents: list, updated_at: inc.updated_at });

      // aktif kayıt aynı olay ise onu da güncelle
      const recFile = path.join(dir, 'incident-record.json');
      const rec = readJson(recFile, null);
      if (rec?.incident_id === targetId) {
        rec.reporting = inc.reporting;
        writeJson(recFile, rec);
      }
      auth.audit(me.user.username, 'reporting_mark', `${targetId}:${step}`);
      return sendJson(res, 200, { ok: true, incident: inc, status: reportingStatus(inc.reporting) });
    }

    if (kind === 'approvals' && method === 'GET') {
      const st = approvalStore(dir);
      return sendJson(res, 200, {
        ok: true,
        two_person: twoPersonEnabled(),
        pending: st.pending(),
        approvals: st.list(),
      });
    }

    if (kind === 'approvals' && method === 'POST' && !artifact) {
      const body = await readBody(req);
      const st = approvalStore(dir);
      const r = st.request({
        type: body.type,
        target: body.target,
        payload: body.payload,
        by: me.user.username,
        comment: body.comment,
      });
      if (!r.ok) return sendJson(res, 400, { ok: false, error: r.error });
      auth.audit(me.user.username, 'approval_request', `${body.type}:${body.target}`);
      runAlertScan({ reason: 'approval' }).catch(() => {});
      return sendJson(res, 201, { ok: true, approval: r.approval });
    }

    if (kind === 'approvals' && method === 'POST' && artifact) {
      if (!isAdmin) return sendJson(res, 403, { ok: false, error: 'karar için yönetici yetkisi gerekli' });
      const body = await readBody(req);
      const st = approvalStore(dir);
      const r = st.decide(artifact, { decision: body.decision, by: me.user.username, comment: body.comment });
      if (!r.ok) return sendJson(res, 400, { ok: false, error: r.error });

      let applied = null;
      if (r.approval.status === 'approved') {
        if (r.approval.type === 'incident_update') applied = applyIncidentUpdate(dir, r.approval.payload);
        else if (r.approval.type === 'go_live') applied = applyGoLive(dir, r.approval.payload);
        else if (r.approval.type === 'assessment_accept') applied = applyAssessmentAccept(dir, r.approval.payload);
      }
      auth.audit(me.user.username, 'approval_decision', `${r.approval.id}:${r.approval.status}`);
      return sendJson(res, 200, { ok: true, approval: r.approval, applied });
    }

    if (kind === 'incidents' && method === 'GET') {
      const stored = readJson(path.join(dir, 'incidents.json'), { incidents: [] });
      const now = Date.now();
      const incidents = (stored.incidents ?? []).map((i) => ({
        ...i,
        reporting_status: i.reporting ? reportingStatus(i.reporting, now) : null,
      }));
      return sendJson(res, 200, { ok: true, incidents });
    }

    if (kind === 'incidents' && method === 'POST') {
      const body = await readBody(req);
      const siem = readJson(path.join(dir, 'siem-events.json'), null);
      if (!siem?.events?.length) return sendJson(res, 400, { ok: false, error: 'önce SIEM olaylarını çekin' });

      const wanted = Array.isArray(body.event_ids) ? new Set(body.event_ids.map(String)) : null;
      const minSeverity = ['low', 'medium', 'high'].includes(body.min_severity) ? body.min_severity : 'high';
      const rules = loadRules();
      const pool = siem.events.filter((e) =>
        wanted ? wanted.has(String(e.id)) : shouldCreateIncident(e, { minSeverity, rules }).yes,
      );

      const stored = readJson(path.join(dir, 'incidents.json'), { incidents: [] });
      const existing = stored.incidents ?? [];
      let seq = nextSeq(existing);
      const created = pool.map((e) => {
        const inc = incidentFromEvent(e, { sessionId: id, seq: seq++, rules });
        inc.reporting = createReporting(inc.detected_at);
        return inc;
      });
      const merged = mergeIncidents(existing, created);
      writeJson(path.join(dir, 'incidents.json'), { incidents: merged.all, updated_at: new Date().toISOString() });
      auth.audit(me.user.username, 'incident_draft', `${id}: ${merged.added.length} yeni`);
      return sendJson(res, 200, {
        ok: true,
        added: merged.added.length,
        total: merged.all.length,
        incidents: merged.added,
        skipped: pool.length - merged.added.length,
      });
    }

    if (kind === 'incidents' && method === 'PATCH' && artifact) {
      const body = await readBody(req);
      if (twoPersonEnabled() && (body.promote === true || 'classification' in body)) {
        const st = approvalStore(dir);
        const r = st.request({
          type: 'incident_update',
          target: artifact,
          payload: { incident_id: artifact, ...body },
          by: me.user.username,
          comment: body.comment ?? 'olay kaydı güncellemesi',
        });
        if (!r.ok) return sendJson(res, 400, { ok: false, error: r.error });
        auth.audit(me.user.username, 'approval_request', 'incident_update:' + artifact);
        runAlertScan({ reason: 'approval' }).catch(() => {});
        return sendJson(res, 202, { ok: true, pending: true, approval: r.approval });
      }
      const stored = readJson(path.join(dir, 'incidents.json'), { incidents: [] });
      const list = stored.incidents ?? [];
      const inc = list.find((x) => x.incident_id === artifact);
      if (!inc) return sendJson(res, 404, { ok: false, error: 'olay kaydı yok' });

      const num = (v) => (v === null || v === undefined || v === '' ? null : Math.max(0, Number(v) || 0));
      if ('affected_customers' in body) inc.affected_customers = num(body.affected_customers);
      if ('outage_minutes' in body) inc.outage_minutes = num(body.outage_minutes);
      if ('economic_impact_eur' in body) inc.economic_impact_eur = num(body.economic_impact_eur);
      if ('data_loss' in body) inc.data_loss = Boolean(body.data_loss);
      if ('unauthorized_access' in body) inc.unauthorized_access = Boolean(body.unauthorized_access);
      if (Array.isArray(body.affected_member_states)) {
        inc.affected_member_states = body.affected_member_states.map((x) => String(x).slice(0, 4)).slice(0, 30);
      }
      if (['unclassified', 'major', 'not_major'].includes(body.classification)) inc.classification = body.classification;
      if (['draft', 'open', 'closed'].includes(body.status)) inc.status = body.status;
      inc.updated_at = new Date().toISOString();

      if (body.promote === true) {
        const record = {
          incident_id: inc.incident_id,
          detected_at: inc.detected_at,
          source: inc.origin ?? 'siem',
          siem_event_id: inc.siem_event_id,
          classification: inc.classification,
          affected_customers: inc.affected_customers,
          outage_minutes: inc.outage_minutes,
          economic_impact_eur: inc.economic_impact_eur,
          data_loss: inc.data_loss,
          unauthorized_access: inc.unauthorized_access,
          affected_member_states: inc.affected_member_states,
          promoted_at: new Date().toISOString(),
        };
        if (!record.reporting) record.reporting = inc.reporting ?? createReporting(record.detected_at);
        writeJson(path.join(dir, 'incident-record.json'), record);
        inc.status = 'open';
        auth.audit(me.user.username, 'incident_promote', inc.incident_id);
      }

      writeJson(path.join(dir, 'incidents.json'), { incidents: list, updated_at: inc.updated_at });
      auth.audit(me.user.username, 'incident_update', inc.incident_id);
      return sendJson(res, 200, { ok: true, incident: inc, promoted: body.promote === true });
    }

    if (kind === 'siem' && artifact === 'fetch' && method === 'POST') {
      const body = await readBody(req);
      const cfg = loadSettings().integrations.find((i) => i.id === 'siem') ?? {};
      const token = loadSecrets().siem;
      if (!cfg.endpoint) return sendJson(res, 400, { ok: false, error: 'önce Entegrasyonlar sayfasında SIEM adresini kaydedin' });
      try {
        const result = await fetchSiemEvents(
          { vendor: cfg.vendor, endpoint: cfg.endpoint, token },
          {
            limit: body.limit ?? 100,
            sinceMinutes: body.since_minutes ?? 1440,
            query: body.query,
          },
        );
        writeJson(path.join(dir, 'siem-events.json'), result);
        auth.audit(me.user.username, 'siem_fetch', `${result.vendor} ${result.count} olay`);
        return sendJson(res, 200, { ok: true, ...result });
      } catch (e) {
        auth.audit(me.user.username, 'siem_fetch_failed', e.message);
        return sendJson(res, 502, { ok: false, error: e.message });
      }
    }

    if (kind === 'siem' && artifact === 'events' && method === 'GET') {
      const stored = readJson(path.join(dir, 'siem-events.json'), null);
      if (!stored) return sendJson(res, 404, { ok: false, error: 'henüz olay çekilmedi' });
      return sendJson(res, 200, { ok: true, ...stored });
    }

    if (kind === 'mapping' && method === 'POST') {
      const doc = parse(fs.readFileSync(path.join(ROOT, 'data/orl-integration/agent-to-orl-mapping.yaml'), 'utf8'));
      const rows = doc.agent_process_mappings ?? [];
      const allCodes = new Set();
      const byAgent = new Map();
      for (const r of rows) {
        const codes = (r.owned_processes ?? []).map((p) => p.process_code).filter(Boolean);
        byAgent.set(r.agent_id, codes);
        codes.forEach((c) => allCodes.add(c));
      }
      const act = readJson(path.join(dir, 'agent-activation.json'), {});
      const activated = act.activated ?? [];
      const owned = new Set();
      for (const a of activated) for (const c of byAgent.get(a) ?? []) owned.add(c);
      const payload = {
        owned_codes: [...owned].sort(),
        all_codes: [...allCodes].sort(),
        activated_agents: activated,
        unowned_codes: [...allCodes].filter((c) => !owned.has(c)).sort(),
        generated_at: new Date().toISOString(),
      };
      writeJson(path.join(dir, 'orl-mapping.json'), payload);
      return sendJson(res, 200, { ok: true, ...payload });
    }

    if (kind === 'scenarios' && method === 'POST') {
      const body = await readBody(req);
      const runs = Array.isArray(body.runs) ? body.runs : [];
      if (!runs.length) return sendJson(res, 400, { ok: false, error: 'en az bir senaryo sonucu gerekli' });
      const clean = runs.slice(0, 20).map((r) => ({
        scenario: String(r.scenario ?? '').slice(0, 60),
        accuracy: Math.max(0, Math.min(100, Number(r.accuracy) || 0)),
        sla_violations: Math.max(0, Number(r.sla_violations) || 0),
        audit_chain: Boolean(r.audit_chain),
        ran_at: String(r.ran_at ?? new Date().toISOString()).slice(0, 30),
      }));
      const payload = {
        runs: clean,
        classification_accuracy: Math.round(clean.reduce((s, r) => s + r.accuracy, 0) / clean.length),
        sla_violations: clean.reduce((s, r) => s + r.sla_violations, 0),
        audit_chain_verified: clean.every((r) => r.audit_chain),
        generated_at: new Date().toISOString(),
      };
      writeJson(path.join(dir, 'scenario-results.json'), payload);
      return sendJson(res, 200, { ok: true, ...payload });
    }

    if (kind === 'assessment' && method === 'POST') {
      const body = await readBody(req);
      const rows = Array.isArray(body.articles) ? body.articles : [];
      if (!rows.length) return sendJson(res, 400, { ok: false, error: 'madde listesi gerekli' });
      const articles = rows.slice(0, 100).map((a) => ({
        id: String(a.id ?? '').slice(0, 20),
        status: ['covered', 'partial', 'gap'].includes(a.status) ? a.status : 'gap',
        note: String(a.note ?? '').slice(0, 300),
      }));
      const high = articles.filter((a) => a.status === 'gap').length;
      const partial = articles.filter((a) => a.status === 'partial').length;
      const accepted = Array.isArray(body.risk_acceptance)
        ? body.risk_acceptance.map((x) => String(x).slice(0, 200)).slice(0, 20)
        : [];
      const reviewer = String(body.reviewer ?? '').slice(0, 80);

      writeJson(path.join(dir, 'coverage-matrix.json'), {
        articles,
        summary: { covered: articles.length - high - partial, partial, gap: high },
        generated_at: new Date().toISOString(),
      });
      writeJson(path.join(dir, 'gap-analysis.json'), {
        high_severity: high,
        partial_count: partial,
        risk_acceptance: accepted,
        independent_review_signed_by: reviewer || null,
        reviewed_at: new Date().toISOString(),
      });
      return sendJson(res, 200, { ok: true, high_severity: high, partial, accepted: accepted.length });
    }

    if (kind === 'autonomy' && method === 'POST') {
      const body = await readBody(req);
      const rows = Array.isArray(body.grants) ? body.grants : [];
      if (!rows.length) return sendJson(res, 400, { ok: false, error: 'en az bir atama gerekli' });
      const levels = ['observe', 'recommend', 'act_with_approval', 'act_autonomous'];
      const grants = rows.slice(0, 50).map((g) => ({
        role: String(g.role ?? '').slice(0, 20),
        level: levels.includes(g.level) ? g.level : 'observe',
        approved_by: String(g.approved_by ?? '').slice(0, 80),
      }));
      writeJson(path.join(dir, 'autonomy-grant.json'), { grants, generated_at: new Date().toISOString() });
      return sendJson(res, 200, { ok: true, count: grants.length, grants });
    }

    if (kind === 'golive' && method === 'POST') {
      const body = await readBody(req);
      if (twoPersonEnabled()) {
        const st = approvalStore(dir);
        const r = st.request({ type: 'go_live', target: id, payload: body, by: me.user.username, comment: 'canlıya geçiş' });
        if (!r.ok) return sendJson(res, 400, { ok: false, error: r.error });
        return sendJson(res, 202, { ok: true, pending: true, approval: r.approval });
      }
      const payload = {
        shadow_days: Math.max(0, Number(body.shadow_days) || 0),
        semi_auto_days: Math.max(0, Number(body.semi_auto_days) || 0),
        mos_dashboard: Boolean(body.mos_dashboard),
        regwatch_agent: Boolean(body.regwatch_agent),
        annual_review_date: String(body.annual_review_date ?? '').slice(0, 10),
        decided_at: new Date().toISOString(),
      };
      writeJson(path.join(dir, 'go-live.json'), payload);
      return sendJson(res, 200, { ok: true, ...payload });
    }

    if (kind === 'license' && method === 'POST') {
      const body = await readBody(req);
      const token = String(body.token ?? '').trim();
      if (!token) return sendJson(res, 400, { ok: false, error: 'lisans anahtarı boş' });
      let pem = null;
      try {
        pem = loadPublicKey();
      } catch {
        pem = null;
      }
      const res_ = verifyLicense(token, pem);
      if (!res_.valid) {
        return sendJson(res, 400, { ok: false, error: 'lisans geçersiz: ' + res_.reason });
      }
      const session = readJson(path.join(dir, 'session.json'), {});
      session.license = { mode: 'commercial', token, claims: res_.claims, activated_at: new Date().toISOString() };
      writeJson(path.join(dir, 'session.json'), session);
      writeJson(path.join(dir, 'license-activation.json'), { claims: res_.claims, activated_at: session.license.activated_at });
      auth.audit(me.user.username, 'license_activate', id);
      return sendJson(res, 200, { ok: true, claims: res_.claims });
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

    if (kind === 'inventory' && method === 'POST' && artifact === 'csv') {
      const body = await readBody(req);
      const assets = parseInventoryCsv(String(body.csv ?? ''));
      if (!assets.length) {
        return sendJson(res, 400, { ok: false, error: 'CSV içinde geçerli satır bulunamadı (ad sütunu gerekli)' });
      }
      const payload = {
        assets: assets.slice(0, 2000),
        assets_by_provider: assets.reduce((m, a) => {
          const k = a.provider || 'bilinmiyor';
          m[k] = (m[k] ?? 0) + 1;
          return m;
        }, {}),
        source: 'csv',
        reconciled_at: new Date().toISOString(),
      };
      writeJson(path.join(dir, 'ict-inventory.json'), payload);
      auth.audit(me.user.username, 'inventory_csv', String(assets.length));
      return sendJson(res, 200, { ok: true, count: assets.length, ...payload });
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
  if (['169.254.169.254', 'metadata.google.internal'].includes(url.hostname)) {
    return { ok: false, detail: 'bulut meta veri adresine istek yasak' };
  }

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
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
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

  if (urlPath === '/api/auth/oidc/status' && method === 'GET') {
    const cfg = loadSettings().oidc ?? {};
    return sendJson(res, 200, { enabled: Boolean(cfg.enabled && cfg.issuer && cfg.client_id), issuer: cfg.issuer ?? null });
  }

  if (urlPath === '/api/auth/oidc/start' && method === 'GET') {
    const cfg = loadSettings().oidc ?? {};
    if (!cfg.enabled || !cfg.issuer || !cfg.client_id) {
      return sendJson(res, 400, { ok: false, error: 'SSO yapılandırılmamış' });
    }
    try {
      const disc = await discover(cfg.issuer);
      const st = makeState(stateSecret());
      const url = buildAuthUrl(cfg, { state: st.state, nonce: st.nonce, discovery: disc });
      res.writeHead(302, {
        Location: url,
        'Set-Cookie': `dora_oidc=${encodeURIComponent(st.state)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`,
      });
      return res.end();
    } catch (e) {
      return sendJson(res, 502, { ok: false, error: 'SSO başlatılamadı: ' + e.message });
    }
  }

  if (urlPath === '/api/auth/oidc/callback' && method === 'GET') {
    const cfg = loadSettings().oidc ?? {};
    const url = new URL(req.url, 'http://localhost');
    const code = url.searchParams.get('code') ?? '';
    const state = url.searchParams.get('state') ?? '';
    const cookieState = parseCookies(req).dora_oidc ?? '';
    const fail = (msg) => {
      res.writeHead(302, { Location: '/app/#giris=' + encodeURIComponent(msg) });
      return res.end();
    };
    if (!cfg.enabled || !cfg.issuer) return fail('SSO kapalı');
    if (!code || !state || state !== cookieState) return fail('durum doğrulanamadı');
    try {
      const disc = await discover(cfg.issuer);
      const tokenCfg = { ...cfg, token_endpoint: disc.token_endpoint, jwks_uri: disc.jwks_uri };
      const st = verifyState(stateSecret(), state);
      if (!st) return fail('durum süresi dolmuş');
      const tok = await exchangeCode(tokenCfg, code);
      const jwks = await fetchJwks(tokenCfg);
      const v = verifyIdToken(tok.id_token, jwks, {
        issuer: cfg.issuer,
        clientId: cfg.client_id,
        nonce: st.nonce,
      });
      if (!v.valid) return fail('kimlik doğrulanamadı: ' + v.reason);
      const claims = v.claims;
      const email = String(claims.email ?? '').toLowerCase();
      const list = auth.users();
      let user = list.find((u) => u.username.toLowerCase() === email || u.username === claims.sub);
      if (!user && cfg.auto_provision) {
        const created = auth.createUser({
          username: email || String(claims.sub).slice(0, 40),
          password: crypto.randomBytes(24).toString('base64url'),
          name: claims.name ?? email,
          role: 'user',
        });
        if (!created.ok) return fail('kullanıcı oluşturulamadı');
        user = created.user;
      }
      if (!user) return fail('bu hesap için yetki tanımlı değil');
      const hours = Number(loadSettings().session_hours) || 8;
      // SSO kullanıcısının parolası yok; doğrudan oturum token'ı üret
      const token = auth.refresh(user, hours);
      auth.audit(user.username, 'login_sso', cfg.issuer);
      setCookie(res, req, token, hours * 3600);
      res.writeHead(302, { Location: '/app/#genel' });
      return res.end();
    } catch (e) {
      return fail('SSO hatası: ' + e.message);
    }
  }

  if (urlPath === '/api/auth/reset' && method === 'POST') {
    const body = await readBody(req);
    const r = resets.consume(body.token);
    if (!r.ok) {
      auth.audit('-', 'reset_failed');
      return sendJson(res, 400, { ok: false, error: r.error });
    }
    const upd = auth.updateUser(r.uid, { password: body.password });
    if (!upd.ok) return sendJson(res, 400, { ok: false, error: upd.error });
    auth.audit(upd.user.username, 'reset_completed', 'tek kullanımlık bağlantı');
    return sendJson(res, 200, { ok: true, username: upd.user.username });
  }

  if (urlPath === '/api/auth/2fa/verify' && method === 'POST') {
    const body = await readBody(req);
    if (throttled('otp:' + String(body.challenge ?? '').slice(0, 16))) {
      return sendJson(res, 429, { ok: false, error: 'çok fazla deneme — 1 dakika sonra tekrar deneyin' });
    }
    const hours = Number(loadSettings().session_hours) || 8;
    const r = auth.verifyOtp(String(body.challenge ?? ''), body.code, hours);
    if (!r.ok) {
      recordFailure('otp:' + String(body.challenge ?? '').slice(0, 16));
      return sendJson(res, 401, { ok: false, error: r.error });
    }
    setCookie(res, req, r.token, hours * 3600);
    return sendJson(res, 200, { ok: true, user: r.user });
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
  console.log(`  veri      : ${DATA}`);
});

const schedTimer = setInterval(() => {
  scheduleTick();
  alertsTick();
}, 30_000);
schedTimer.unref?.();

const shutdown = () => {
  clearInterval(schedTimer);
  console.log('\nkapatılıyor…');
  server.close(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 ustauretim
//
// Güvenlik taraması: statik desenler + canlı sunucu kontrolleri.
// Kullanım: node tools/security-scan.mjs [--url http://127.0.0.1:8080]
// Çıkış kodu: 0 → yüksek bulgu yok, 1 → yüksek bulgu var.

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');

const { values } = parseArgs({ options: { url: { type: 'string', default: 'http://127.0.0.1:8080' } } });
const BASE = values.url.replace(/\/+$/, '');

const findings = [];
const add = (sev, area, msg, evidence = '') => findings.push({ sev, area, msg, evidence });

// ── statik ───────────────────────────────────────────────
const SKIP_DIRS = new Set(['.git', 'node_modules', 'web-data', '.dora-onboarding', 'dashboard', 'site', 'yedek']);
const isTest = (rel) => rel.includes('tests') || rel.includes('tools/demo') || rel.endsWith('security-scan.mjs');
const CODE = /\.(mjs|js)$/;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (CODE.test(e.name)) out.push(p);
  }
  return out;
}

const files = walk(ROOT);

const DANGEROUS = [
  [/\beval\s*\(/, 'eval kullanımı', 'medium'],
  [/new\s+Function\s*\(/, 'new Function kullanımı', 'medium'],
  [/child_process/, 'süreç başlatma', 'medium'],
];

const SECRETS = [
  [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, 'gömülü özel anahtar', 'high'],
  [/\b(sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16})\b/, 'API anahtarı benzeri dize', 'high'],
  [/(?:password|passwd|secret)\s*[:=]\s*['"][^'"]{8,}['"]/i, 'sabit parola/sır', 'high'],
];

for (const f of files) {
  const rel = path.relative(ROOT, f);
  const text = fs.readFileSync(f, 'utf8');
  for (const [re, label, sev] of DANGEROUS) {
    if (re.test(text)) {
      // test dosyaları ve demo araçları hariç
      if (!isTest(rel)) add(sev, 'statik', `${label}: ${rel}`);
    }
  }
  for (const [re, label, sev] of SECRETS) {
    if (re.test(text) && !isTest(rel)) add(sev, 'statik', `${label}: ${rel}`);
  }
}

// innerHTML: esc() ile sarılmayan şüpheli satırlar
const appJs = path.join(ROOT, 'app/app.js');
if (fs.existsSync(appJs)) {
  const lines = fs.readFileSync(appJs, 'utf8').split('\n');
  const risky = lines
    .map((l, i) => [i + 1, l])
    .filter(([, l]) => l.includes('innerHTML') && !l.includes('esc(') && !l.includes('textContent'));
  if (risky.length > 0) {
    add('low', 'xss', `${risky.length} innerHTML satırı esc() içermiyor (elle inceleme)`, risky.slice(0, 3).map(([n]) => 'app.js:' + n).join(', '));
  }
}

// bağımlılık yüzeyi
for (const pkgPath of [path.join(ROOT, 'onboarding/cli/package.json'), path.join(ROOT, 'package.json')]) {
  if (!fs.existsSync(pkgPath)) continue;
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const deps = Object.keys(pkg.dependencies ?? {}).concat(Object.keys(pkg.devDependencies ?? {}));
  if (deps.length) add('medium', 'tedarik zinciri', `bağımlılık var: ${deps.join(', ')} (${path.relative(ROOT, pkgPath)})`);
}

// ── canlı sunucu ─────────────────────────────────────────
async function req(p, opts = {}) {
  const res = await fetch(BASE + p, { redirect: 'manual', ...opts });
  return res;
}

try {
  const home = await req('/app/');
  const headers = home.headers;
  const required = {
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'no-referrer',
    'content-security-policy': null,
  };
  for (const [name, want] of Object.entries(required)) {
    const got = headers.get(name);
    if (!got) add('medium', 'başlıklar', `eksik güvenlik başlığı: ${name}`);
    else if (want && got !== want) add('low', 'başlıklar', `${name} beklenen '${want}', bulunan '${got}'`);
  }

  for (const p of ['/api/state', '/api/users', '/api/audit', '/api/sessions']) {
    const r = await req(p);
    if (r.status !== 401) add('high', 'yetkilendirme', `${p} oturumsuz ${r.status} döndü (401 beklenir)`);
  }

  const csrf = await fetch(BASE + '/api/institution', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'x' }),
  });
  if (csrf.status !== 403) add('medium', 'csrf', `CSRF başlıksız yazma ${csrf.status} döndü (403 beklenir)`);

  const trav = await req('/app/..%2f..%2fpackage.json');
  if (trav.status === 200) add('high', 'yol', 'yol dışına çıkma denemesi 200 döndü');

  const trav2 = await req('/dashboard/');
  if (trav2.status === 200) add('medium', 'yetkilendirme', '/dashboard/ oturumsuz erişilebilir');

  const health = await req('/api/health');
  if (health.status !== 200) add('low', 'servis', '/api/health yanıt vermiyor');
} catch (e) {
  add('low', 'canlı', `sunucuya ulaşılamadı (${BASE}): ${e.message} —— canlı kontroller atlandı`);
}

// ── rapor ────────────────────────────────────────────────
const order = { high: 0, medium: 1, low: 2 };
findings.sort((a, b) => order[a.sev] - order[b.sev]);
const counts = { high: 0, medium: 0, low: 0 };
for (const f of findings) counts[f.sev]++;

console.log('GÜVENLİK TARAMASI');
console.log(`  dosya: ${files.length} · hedef: ${BASE}`);
console.log(`  yüksek: ${counts.high} · orta: ${counts.medium} · düşük: ${counts.low}\n`);
for (const f of findings) {
  console.log(`[${f.sev.toUpperCase().padEnd(6)}] ${f.area.padEnd(14)} ${f.msg}${f.evidence ? '  → ' + f.evidence : ''}`);
}
if (!findings.length) console.log('bulgu yok');
process.exit(counts.high > 0 ? 1 : 0);

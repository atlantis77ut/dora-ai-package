#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 ustauretim
//
// 0.6 demo: oturum açar, örnek veriyle fazları çalıştırır, bir olay dosyası yazar,
// kanıt paketini üretir + doğrular ve üç bildirim formunu (initial/intermediate/final) çıkarır.
// Sonunda geçici oturumu siler. Gerçek kuruluma dokunmaz.
//
// Kullanım: node tools/demo-export.mjs [--keep]

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import * as store from '../src/orl/session.mjs';
import { loadLifecycle, runPhase } from '../src/orl/lifecycle.mjs';
import { sign } from '../src/orl/license.mjs';
import { buildBundle, verifyBundle } from '../src/orl/evidence.mjs';
import { buildNotification, PHASES } from '../src/orl/notify.mjs';
import { buildMi } from '../src/orl/mi.mjs';

const { values } = parseArgs({ options: { keep: { type: 'boolean' } } });
const CWD = path.resolve(process.cwd());
const DEV_KEY = path.resolve(CWD, '../license/dev-private.pem');
const PUB_KEY = path.resolve(CWD, '../license/public-key.pem');
const OUT = path.join(CWD, '.demo-export');

const ok = (s) => '\u2714 ' + s;
const bad = (s) => '\u2718 ' + s;
let failures = 0;
const check = (cond, msg) => {
  console.log((cond ? ok(msg) : bad(msg)));
  if (!cond) failures++;
};

// temiz başlangıç
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const doc = loadLifecycle();
const session = store.create({ tier: 'tier2', regulator: 'BDDK', jurisdiction: 'TR', cwd: CWD });
session.license = fs.existsSync(DEV_KEY)
  ? {
      mode: 'commercial',
      token: sign(
        {
          license_id: 'LIC-DEMO-0600',
          licensee: 'Demo Bankası A.Ş.',
          tier: 'tier2',
          phases: ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'],
          modules: ['agents', 'processes', 'orl', 'pilot'],
          issued_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 365 * 86400000).toISOString(),
        },
        fs.readFileSync(DEV_KEY, 'utf8'),
      ),
      claims: { licensee: 'Demo Bankası A.Ş.', tier: 'tier2' },
    }
  : { mode: 'trial', expires_at: new Date(Date.now() + 30 * 86400000).toISOString() };
store.save(session, CWD);

const dir = store.sessionDir(session.session_id, CWD);
console.log('oturum: ' + session.session_id + '\n');

// C1-C4 demo verisi
for (const p of doc.phases) {
  if (!['C1', 'C2', 'C3', 'C4'].includes(p.id)) continue;
  runPhase(p.id, session, dir, { demo: true });
}
store.writeJson(path.join(dir, 'jurisdiction.json'), { jurisdiction: 'TR', regulator: 'BDDK' });

// C1 kapısının beklediği profil alanları
const prof = store.readJson(dir, 'institution-profile.json') ?? {};
store.writeJson(path.join(dir, 'institution-profile.json'), {
  ...prof,
  institution: 'Demo Bankası A.Ş.',
  tier: 'tier2',
  contact: 'olay.masasi@demo-bank.example',
});

// Olay dosyası (gerçek kurulumda olay yönetimi ajanı üretir)
store.writeJson(path.join(dir, 'incident-record.json'), {
  incident_id: 'INC-2026-0001',
  detected_at: '2026-11-08T09:12:00+03:00',
  closed_at: '2026-11-09T14:40:00+03:00',
  classification: 'major',
  mitigations: ['DNS yedeğine geçiş', 'etkilenen kanal trafiği kapatıldı'],
  eta: '2026-11-09T18:00:00+03:00',
  recurring_risk: 'orta — DNS değişiklik kapısı güçlendirildi',
});
store.writeJson(path.join(dir, 'classification-decision.json'), {
  incident_id: 'INC-2026-0001',
  decision: 'major',
  criteria: ['INC-R1', 'INC-R2'],
  approved_by: 'Olay Müdürü',
  approved_at: '2026-11-08T09:40:00+03:00',
});
store.writeJson(path.join(dir, 'impact-assessment.json'), {
  affected_clients: 12400,
  affected_services: ['SVC-001', 'SVC-002'],
  duration_minutes: 92,
  geography: ['TR'],
});
fs.writeFileSync(path.join(dir, 'rca-report.pdf'), 'DEMO RCA — kök neden: DNS yapılandırma hatası\n', 'utf8');

// MI paketinin okuduğu dönem artefaktları (demo değerleri)
store.writeJson(path.join(dir, 'notification-receipt.json'), {
  incident_id: 'INC-2026-0001',
  channel: 'DORA',
  sent_at: '2026-11-08T12:58:00+03:00',
  within_sla: true,
  reference: 'REG-2026-88421',
});
store.writeJson(path.join(dir, 'gap-analysis.json'), { high_severity: 0, risk_acceptance: [] });
store.writeJson(path.join(dir, 'go-live.json'), {
  shadow_days: 14,
  semi_auto_days: 30,
  mos_dashboard: true,
  regwatch_agent: true,
  annual_review_date: '2027-11-03',
});
store.writeJson(path.join(dir, 'register-of-information.json'), { concentration_breaches: 0 });

console.log('--- kanıt paketi');
const zip = path.join(OUT, 'evidence.zip');
const b = buildBundle({ dir, session, outFile: zip, keyFile: DEV_KEY });
check(fs.existsSync(zip) && fs.statSync(zip).size > 500, 'paket yazıldı: ' + path.basename(zip) + ' (' + fs.statSync(zip).size + ' B)');
check(b.files >= 8, b.files + ' artefakt paketlendi');
check(b.signed === fs.existsSync(DEV_KEY), b.signed ? 'Ed25519 ile imzalandı' : 'imzasız (anahtar yok)');

const v = verifyBundle(zip, fs.existsSync(PUB_KEY) ? fs.readFileSync(PUB_KEY, 'utf8') : null);
check(v.ok, 'paket doğrulandı (zincir + imza)');
if (!v.ok) for (const p of v.problems) console.log('   - ' + p);

// kurcalama testi: bir bayt değiştir
const tampered = path.join(OUT, 'tampered.zip');
const buf = fs.readFileSync(zip);
const idx = buf.indexOf(Buffer.from('INC-2026-0001'));
if (idx > 0) {
  buf[idx] = 'X'.charCodeAt(0);
  fs.writeFileSync(tampered, buf);
  const tv = verifyBundle(tampered, fs.existsSync(PUB_KEY) ? fs.readFileSync(PUB_KEY, 'utf8') : null);
  check(!tv.ok, 'kurcalanmış paket reddedildi (' + (tv.problems[0] ?? '?') + ')');
}

console.log('\n--- bildirim formları');
for (const phase of PHASES) {
  const outDir = path.join(OUT, 'notifications');
  const r = buildNotification({ dir, session, phase, outDir });
  const filesOk = r.files.every((f) => fs.existsSync(path.join(outDir, f)));
  check(r.payload.complete, phase + ' formu tam (' + r.payload.fields.length + ' alan)');
  check(filesOk, phase + ' çıktıları yazıldı (json/md/html)');
  if (!r.payload.complete) console.log('   eksik: ' + r.payload.missing.join(', '));
}

// eksik alan testi: zorunlu alanı boşalt
store.writeJson(path.join(dir, 'classification-decision.json'), { incident_id: 'INC-2026-0001' });
const partial = buildNotification({ dir, session, phase: 'initial', outDir: path.join(OUT, 'tmp'), write: false });
check(!partial.payload.complete && partial.payload.missing.includes('classification'), 'eksik zorunlu alan yakalandı');
check(partial.payload.missing.length === 1, 'tek eksik bildirildi: ' + partial.payload.missing.join(', '));

console.log('\n--- MI paketi');
const mi = buildMi({ dir, session, period: '2026-11', outDir: path.join(OUT, 'mi') });
check(mi.payload.kpis.every((k) => k.value !== null), 'tum KPI verili (' + mi.payload.kpis.length + ')');
check(mi.payload.red_flags.length === 0, 'kirmizi bayrak yok');
check(mi.files.every((f) => fs.existsSync(path.join(OUT, 'mi', f))), 'MI ciktilari yazildi');

console.log('\nSONUC: ' + (failures === 0 ? 'tum kontroller gecti' : failures + ' kontrol BASARISIZ'));
if (!values.keep) {
  fs.rmSync(path.join(CWD, store.ROOT_DIR), { recursive: true, force: true });
  fs.rmSync(OUT, { recursive: true, force: true });
  console.log('gecici oturum ve ciktilar silindi (--keep ile saklanir)');
}
process.exit(failures === 0 ? 0 : 1);

#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 ustauretim
//
// 1.1 demo: senaryo çalıştırıcısı. SCN-04'ün assertion'larını karşılayan artefaktları
// yazar, senaryoyu çalıştırır, bozuk veriyle fail ürettiğini gösterir.
//
// Kullanım: node tools/demo-scenario.mjs [--keep]

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import * as store from '../src/corf/session.mjs';
import { runScenario } from '../src/corf/scenario.mjs';

const { values } = parseArgs({ options: { keep: { type: 'boolean' } } });
const CWD = path.resolve(process.cwd());
const SCEN = path.resolve(CWD, '../../tests/synthetic-scenarios');

const ok = (s) => '\u2714 ' + s;
const bad = (s) => '\u2718 ' + s;
let failures = 0;
const check = (cond, msg) => {
  console.log(cond ? ok(msg) : bad(msg));
  if (!cond) failures++;
};

const session = store.create({ tier: 'tier2', regulator: 'BDDK', jurisdiction: 'TR', cwd: CWD });
const dir = store.sessionDir(session.session_id, CWD);
console.log('oturum: ' + session.session_id + '\n');

// SCN-04 assertion'larının beklediği kanıtlar
store.writeJson(path.join(dir, 'access-review-record.json'), {
  review_id: 'AR-2026-Q4',
  accounts_total: 420,
  privileged_accounts: 18,
  dormant_accounts_closed: 12,
  revoked_count: 2,
  reviewer: 'IAM Ekibi',
  signed_at: '2026-11-09T09:00:00+03:00',
});
fs.writeFileSync(
  path.join(dir, 'crypto-inventory.yaml'),
  [
    'assets:',
    '  AST-001:',
    '    at_rest: true',
    '    in_transit: false',
    '    remediation_due_days: 21',
    '    algorithm: AES-256',
    '',
  ].join('\n'),
);
store.writeJson(path.join(dir, 'segmentation-evidence.json'), {
  zones: { 'DMZ-01': { default_deny: true, critical_assets: ['AST-014'], closed_at: '2026-11-10T12:00:00+03:00' } },
});
store.writeJson(path.join(dir, 'vulnerability-closure.json'), {
  vuln_id: 'CVE-2026-31142',
  cvss: 9.4,
  asset_id: 'AST-001',
  closed_at: '2026-11-20T10:00:00+03:00',
  days_open: 18,
});
store.writeJson(path.join(dir, 'incident-record.json'), {
  incident_id: 'INC-2026-0077',
  detected_at: '2026-11-09T08:30:00+03:00',
  classification: 'major',
  source: 'siem',
});

console.log('--- SCN-04 (sağlam veri)');
const r1 = runScenario({ file: path.join(SCEN, 'scenario-security-controls.yaml'), dir });
console.log('  ' + r1.payload.passed + '/' + r1.payload.total + ' geçti, ' + r1.payload.failed + ' başarısız, ' + r1.payload.manual + ' manuel');
check(r1.payload.failed === 0, 'tüm çalıştırılabilir assertion geçti');
check(r1.payload.passed === 6, '6 assertion çalıştırıldı (manuel yok)');
check(fs.existsSync(r1.outFile), 'sonuç dosyası oturuma yazıldı: ' + path.basename(r1.outFile));

console.log('\n--- SCN-04 (bozuk veri)');
store.writeJson(path.join(dir, 'access-review-record.json'), { dormant_accounts_closed: 5, revoked_count: 0 });
const r2 = runScenario({ file: path.join(SCEN, 'scenario-security-controls.yaml'), dir });
console.log('  ' + r2.payload.passed + '/' + r2.payload.total + ' geçti, ' + r2.payload.failed + ' başarısız');
check(r2.payload.failed === 2, 'iki assertion başarısız oldu (kapatılan hesap + iptal)');
check(r2.payload.results.some((x) => x.id === 'A1' && x.status === 'fail'), 'A1 gerekçesi kaydedildi');

console.log('\n--- tüm senaryolar');
const all = fs.readdirSync(SCEN).filter((f) => f.endsWith('.yaml')).sort();
let manual = 0;
let failed = 0;
for (const f of all) {
  const r = runScenario({ file: path.join(SCEN, f), dir });
  manual += r.payload.manual;
  failed += r.payload.failed;
  console.log('  ' + r.payload.scenario + ': ' + r.payload.passed + ' pass, ' + r.payload.failed + ' fail, ' + r.payload.manual + ' manuel');
}
check(failed > 0, 'bozuk veri tüm senaryo turunda da yakalandı');
check(manual > 0, manual + ' assertion check tanımsız olduğu için manuel sayıldı');

console.log('\nSONUC: ' + (failures === 0 ? 'tum kontroller gecti' : failures + ' kontrol BASARISIZ'));
if (!values.keep) {
  fs.rmSync(path.join(CWD, store.ROOT_DIR), { recursive: true, force: true });
  console.log('gecici oturum silindi (--keep ile saklanir)');
}
process.exit(failures === 0 ? 0 : 1);

#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 ustauretim
//
// Senaryo çalıştırıcısı demosu:
//   1) her senaryo için golden artefaktları yükler, çalıştırır  -> 27/27 pass beklenir
//   2) SCN-04 kanıtını bozar, tekrar çalıştırır                 -> 2 fail beklenir
//
// Kullanım: node tools/demo-scenario.mjs [--keep]

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import * as store from '../src/orl/session.mjs';
import { runScenario, seedArtifacts } from '../src/orl/scenario.mjs';

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

const files = fs.readdirSync(SCEN).filter((f) => f.endsWith('.yaml')).sort();

console.log('--- golden kosu (tum senaryolar)');
let passed = 0;
let failed = 0;
let manual = 0;
for (const f of files) {
  const goldenDir = path.join(SCEN, 'golden', path.basename(f, '.yaml'));
  const seeded = seedArtifacts(dir, goldenDir);
  const { payload } = runScenario({ file: path.join(SCEN, f), dir });
  passed += payload.passed;
  failed += payload.failed;
  manual += payload.manual;
  const seedInfo = seeded.found ? seeded.copied.length + ' artefakt' : 'golden yok';
  console.log(
    '  ' + payload.scenario + ': ' + payload.passed + ' pass, ' + payload.failed + ' fail, ' +
      payload.manual + ' manuel  (' + seedInfo + ')',
  );
}
check(failed === 0, 'hic basarisiz assertion yok');
check(passed === 27, '27/27 assertion calistirildi (beklenen: 27)');
check(manual === 0, 'manuel assertion yok - tumu deterministik');

console.log('\n--- bozuk kanit (SCN-04)');
store.writeJson(path.join(dir, 'access-review-record.json'), { dormant_accounts_closed: 5, revoked_count: 0 });
const broken = runScenario({ file: path.join(SCEN, 'scenario-security-controls.yaml'), dir });
console.log('  ' + broken.payload.passed + '/' + broken.payload.total + ' gecti, ' + broken.payload.failed + ' basarisiz');
check(broken.payload.failed === 2, 'iki assertion basarisiz oldu (kapatilan hesap + iptal)');
check(
  broken.payload.results.some((x) => x.id === 'A1' && x.status === 'fail'),
  'A1 icin gerekce kaydedildi',
);
check(fs.existsSync(path.join(dir, 'scenario-SCN-04-results.json')), 'sonuc dosyasi oturuma yazildi');

console.log('\nSONUC: ' + (failures === 0 ? 'tum kontroller gecti' : failures + ' kontrol BASARISIZ'));
if (!values.keep) {
  fs.rmSync(path.join(CWD, store.ROOT_DIR), { recursive: true, force: true });
  console.log('gecici oturum silindi (--keep ile saklanir)');
}
process.exit(failures === 0 ? 0 : 1);

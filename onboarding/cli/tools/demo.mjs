#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 ustauretim
//
// Uçtan uca demo: 6 ORL fazını örnek veriyle çalıştırır, kapıları değerlendirir.
// Gerçek kuruluma dokunmaz — kendi geçici oturumunu açar ve sonunda siler.
//
// Kullanım:  node tools/demo.mjs            (tüm fazlar)
//            node tools/demo.mjs --keep     (oturumu silme, incelemek için)

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import * as store from '../src/orl/session.mjs';
import { loadLifecycle, runPhase } from '../src/orl/lifecycle.mjs';
import { evaluatePhase } from '../src/orl/checks.mjs';
import { sign } from '../src/orl/license.mjs';

const { values } = parseArgs({ options: { keep: { type: 'boolean' } } });
const CWD = path.resolve(process.cwd());
const doc = loadLifecycle();

// Demo lisansı: geliştirme özel anahtarı varsa imzalanır (C6 geçsin),
// yoksa deneme modu (C6'da durur — tasarım gereği).
const DEV_KEY = path.resolve(process.cwd(), '../license/dev-private.pem');
let license;
if (fs.existsSync(DEV_KEY)) {
  const claims = {
    license_id: 'LIC-DEMO-0001',
    licensee: 'Demo Bankası A.Ş.',
    tier: 'tier2',
    phases: ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'],
    modules: ['agents', 'processes', 'orl', 'pilot'],
    issued_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 365 * 86400000).toISOString(),
  };
  license = { mode: 'commercial', token: sign(claims, fs.readFileSync(DEV_KEY, 'utf8')), claims };
} else {
  license = {
    mode: 'trial',
    expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
    note: 'demo — deneme modu (geliştirme anahtarı bulunamadı)',
  };
}

const session = store.create({ tier: 'tier2', regulator: 'BDDK', jurisdiction: 'TR', cwd: CWD });
session.license = license;
store.save(session, CWD);
const dir = store.sessionDir(session.session_id, CWD);

// C1'in beklediği profil ve yargı alanı çıktıları (CLI init ile aynı)
store.writeJson(path.join(dir, 'institution-profile.json'), {
  institution: 'Demo Bankası A.Ş.',
  tier: 'tier2',
  tier_justification: 'demo verisi',
  determined_at: new Date().toISOString(),
});
store.writeJson(path.join(dir, 'jurisdiction.json'), {
  jurisdiction: 'TR',
  regulator: 'BDDK',
});

const ok = (s) => `\u2714 ${s}`;
const no = (s) => `\u2718 ${s}`;

console.log('');
console.log(`DORA AI Ajan Paketi — uctan uca demo`);
console.log(`oturum: ${session.session_id}   tier: tier2   regulator: BDDK   lisans: ${license.mode === 'commercial' ? 'ticari (demo)' : 'deneme'}`);
console.log('');

let failed = 0;
for (const p of doc.phases) {
  runPhase(p.id, session, dir, { demo: true });
  const res = evaluatePhase(p.id, { dir, session });
  console.log(`${p.id}  ${p.name.tr}`);
  for (const r of res.results) console.log(`   ${r.passed ? ok(r.detail) : no(r.detail)}  [${r.id}]`);
  if (res.passed) {
    session.phases[p.id] = { status: 'completed', gate: 'pass', at: new Date().toISOString() };
    session.current_phase = p.id;
    store.save(session, CWD);
    console.log(`   -> KAPI GECILDI\n`);
  } else {
    session.phases[p.id] = { status: 'blocked', gate: 'fail', at: new Date().toISOString() };
    store.save(session, CWD);
    console.log(`   -> KAPI GECILMEDI\n`);
    failed++;
    break;
  }
}

const total = doc.phases.length;
const passed = Object.values(session.phases).filter((x) => x.gate === 'pass').length;
console.log(`SONUC: ${passed}/${total} faz gecildi`);
console.log(`oturum dizini: ${path.relative(CWD, dir)}`);

if (failed) {
  console.log('Demo durdu: kapi gecmedi (yukaridaki eksikleri inceleyin).');
  process.exitCode = 2;
} else if (!values.keep) {
  fs.rmSync(path.join(CWD, '.dora-onboarding'), { recursive: true, force: true });
  console.log('Gecici oturum silindi (--keep ile saklanabilir).');
}

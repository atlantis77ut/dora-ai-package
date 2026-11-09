#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 ustauretim
//
// Kural motoru demosu:
//   1) tüm süreçlerdeki kuralları söz dizimi açısından tarar (audit)
//   2) SCN-01 olay gerçekleriyle INC kurallarını çalıştırır (match/not_match)
//   3) eksik alan ve söz dizimi hatasını görünür kılar
//
// Kullanım: node tools/demo-rules.mjs

import fs from 'node:fs';
import path from 'node:path';
import { loadProcesses } from '../src/orl/catalog.mjs';
import { evaluateRules, auditRules, evaluateCondition } from '../src/orl/rules.mjs';
import { factsFromDir } from '../src/orl/facts.mjs';

const ok = (s) => '\u2714 ' + s;
const bad = (s) => '\u2718 ' + s;
let failures = 0;
const check = (cond, msg) => {
  console.log(cond ? ok(msg) : bad(msg));
  if (!cond) failures++;
};

let docs;
try {
  docs = loadProcesses();
} catch (e) {
  console.log(bad('süreçler yüklenemedi: ' + e.message));
  process.exit(1);
}
if (!Array.isArray(docs)) docs = [docs];

console.log('=== 1) kural söz dizimi taraması');
const audit = docs.map((d) => auditRules(d));
const total = audit.reduce((s, a) => s + a.total, 0);
const parseable = audit.reduce((s, a) => s + a.parseable, 0);
console.log(`  ${parseable}/${total} kural makine tarafından okunabilir`);
const broken = audit.flatMap((a) => a.rows.filter((r) => !r.parseable));
if (broken.length) {
  console.log('  okunamayanlar:');
  for (const b of broken.slice(0, 10)) console.log(`   - ${b.rule_id}: ${b.condition}  (${b.error})`);
}
check(parseable === total, 'tüm kural koşulları söz dizimi olarak geçerli');

console.log('\n=== 2) SCN-01 olayı: sınıflandırma kuralları');
const incidentDoc = docs.find((d) => (d.processes ?? []).some((p) => p.id === 'PRC-INC-01'));
if (!incidentDoc) {
  console.log(bad('PRC-INC-01 bulunamadı'));
  process.exit(1);
}
// Olgular golden kanıt dosyalarından adaptörle üretilir (elle yazılmaz)
const goldenDir = path.resolve(process.cwd(), '../../tests/synthetic-scenarios/golden/scenario-major-incident');
const adapted = factsFromDir(goldenDir);
const facts = adapted.facts;
console.log(`  adaptör: ${adapted.used.length} kanıt dosyası eşlendi, ${Object.keys(facts).length} olgu`);
const results = evaluateRules(incidentDoc, facts).filter((r) => r.process === 'PRC-INC-01');
for (const r of results) {
  const mark = r.status === 'matched' ? '\u2714' : r.status === 'not_matched' ? '\u00b7' : '\u2718';
  const missing = r.missing.length ? '  eksik: ' + r.missing.join(', ') : '';
  console.log(`  ${mark} ${r.rule_id}: ${r.condition} -> ${r.status}${missing}`);
}
const matched = results.filter((r) => r.status === 'matched').map((r) => r.rule_id);
check(matched.includes('INC-R1'), 'INC-R1 (etkilenen müşteri > 100000) tetiklendi');
check(!matched.includes('INC-R2'), 'INC-R2 (kesinti > 24 saat) tetiklenmedi');
check(matched.includes('INC-R3'), 'INC-R3 (ekonomik etki > 100000) tetiklendi');
check(!matched.includes('INC-R4'), 'INC-R4 (>= 2 üye devlet) tetiklenmedi');

console.log('\n=== 3) eksik alan davranışı');
const partial = evaluateCondition('etkilenen_musteri > 100000 AND kesinti_suresi > 24', { etkilenen_musteri: 512000 });
console.log(`  sonuç: matched=${partial.matched}  eksik=${partial.missing.join(', ') || 'yok'}`);
check(partial.matched === false, 'eksik alan varken kural tetiklenmedi (yanlış pozitif yok)');
check(partial.missing.includes('kesinti_suresi'), 'eksik alan raporlandı');

console.log('\n=== 4) söz dizimi hatası görünür');
const brokenEval = evaluateCondition('etkilenen_musteri >>>> 5', { etkilenen_musteri: 1 });
console.log(`  ok=${brokenEval.ok}  hata=${brokenEval.error ?? 'yok'}`);
check(brokenEval.ok === false, 'bozuk ifade parse_error olarak raporlandı');

console.log('\nSONUC: ' + (failures === 0 ? 'tum kontroller gecti' : failures + ' kontrol BASARISIZ'));
process.exit(failures === 0 ? 0 : 1);

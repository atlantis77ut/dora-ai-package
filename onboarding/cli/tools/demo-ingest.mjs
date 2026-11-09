#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 ustauretim
//
// 0.8 demo: dış veri alımı (ingest) + takvim tarih hesabı.
// Konnektör çıktısını taklit eden bir dizin hazırlar, alır, doğrular ve MI'da kullanır.
//
// Kullanım: node tools/demo-ingest.mjs [--keep]

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import * as store from '../src/orl/session.mjs';
import { ingest } from '../src/orl/ingest.mjs';
import { buildMi, loadAnchors, loadCalendar, upcoming } from '../src/orl/mi.mjs';

const { values } = parseArgs({ options: { keep: { type: 'boolean' } } });
const CWD = path.resolve(process.cwd());
const ROOT = path.resolve(CWD, '../..');
const DROP = path.join(CWD, '.ingest-drop');
const OUT = path.join(CWD, '.demo-ingest');

const ok = (s) => '\u2714 ' + s;
const bad = (s) => '\u2718 ' + s;
let failures = 0;
const check = (cond, msg) => {
  console.log(cond ? ok(msg) : bad(msg));
  if (!cond) failures++;
};

fs.rmSync(DROP, { recursive: true, force: true });
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(DROP, { recursive: true });

const session = store.create({ tier: 'tier2', regulator: 'BDDK', jurisdiction: 'TR', cwd: CWD });
const dir = store.sessionDir(session.session_id, CWD);
console.log('oturum: ' + session.session_id + '\n');

// konnektörün bıraktığı dosyalar
fs.writeFileSync(
  path.join(DROP, 'incident-record.json'),
  JSON.stringify(
    {
      incident_id: 'INC-2026-0042',
      detected_at: '2026-11-07T08:05:00+03:00',
      classification: 'major',
      mitigations: ['trafik yönlendirme'],
      recurring_risk: 'düşük',
    },
    null,
    2,
  ),
);
fs.writeFileSync(path.join(DROP, 'rca-report.pdf'), 'DEMO RCA', 'utf8');
fs.writeFileSync(path.join(DROP, 'tool.exe'), 'MZ', 'utf8');
fs.writeFileSync(path.join(DROP, 'bozuk.json'), '{ nope', 'utf8');

console.log('--- alım');
const r = ingest({ dir, from: DROP });
check(r.ingested.length === 2, '2 dosya alındı');
check(r.rejected.length === 2, '2 dosya reddedildi (.exe + bozuk JSON)');
check(fs.existsSync(path.join(dir, 'incident-record.json')), 'olay dosyası oturuma kopyalandı');
check(fs.existsSync(path.join(dir, 'ingest-log.json')), 'ingest-log.json yazıldı');

const log = JSON.parse(fs.readFileSync(path.join(dir, 'ingest-log.json'), 'utf8'));
check(log.length === 2 && log.every((e) => e.sha256?.length === 64), 'her dosya için sha256 kaydı var');
check(log.every((e) => e.ingested_at && e.source), 'kaynak ve zaman damgası kayıtlı');

check(log.some((e) => e.schema?.startsWith('şema uyumlu')), 'şema uyumu kayda geçti');

console.log('\n--- şema doğrulaması');
const BAD = path.join(CWD, '.ingest-bad');
fs.rmSync(BAD, { recursive: true, force: true });
fs.mkdirSync(BAD, { recursive: true });
fs.writeFileSync(
  path.join(BAD, 'incident-record.json'),
  JSON.stringify({ incident_id: 'INC-2026-9', classification: 'huge', detected_at: '2026-11-08' }),
);
const badRun = ingest({ dir, from: BAD });
check(badRun.rejected.length === 1, 'geçersiz olay reddedildi');
check(/şema:/.test(badRun.rejected[0]?.reason ?? ''), 'ret gerekçesi şema hatası: ' + (badRun.rejected[0]?.reason ?? '').slice(0, 60));
const len = ingest({ dir, from: BAD, lenient: true });
check(len.ingested.length === 1, 'lenient modda kabul edildi');
check(len.ingested[0].schema?.startsWith('şema uyarısı'), 'uyarı kayda geçti');
fs.rmSync(BAD, { recursive: true, force: true });

// izin verilen bilinmeyen tür
const r2 = ingest({ dir, from: DROP, allowUnknown: true });
check(
  r2.rejected.length === 1 && r2.rejected[0].file === 'bozuk.json',
  'allow-unknown .exe kabul etti, bozuk JSON yine reddedildi',
);

console.log('\n--- takvim tarihleri');
const cal = loadCalendar();
const anchors = loadAnchors(path.join(ROOT, 'data', 'calendar-anchors.example.yaml'));
check(Object.keys(anchors).length >= 4, Object.keys(anchors).length + ' anchor yüklendi');
const up = upcoming(cal.obligations ?? [], anchors, 400);
check(up.length >= 4, '400 gün içinde ' + up.length + ' yükümlülük hesaplandı');
check(up.every((o) => o.due.date instanceof Date), 'her kayıtta tarih var');
const sorted = up.every((o, i) => i === 0 || up[i - 1].due.date <= o.due.date);
check(sorted, 'tarihe göre sıralı');

console.log('\n--- MI (yaklaşan yükümlülükler)');
const mi = buildMi({ dir, session, period: '2026-11', outDir: OUT, anchors, days: 400 });
check(mi.payload.upcoming.length >= 4, 'MI paketinde yaklaşan yükümlülükler var');
check(mi.payload.upcoming_days === 400, 'pencere 400 gün');
const html = fs.readFileSync(path.join(OUT, mi.files[0]), 'utf8');
check(html.includes('Yaklaşan yükümlülükler'), 'HTML başlığı yazıldı');

console.log('\nSONUC: ' + (failures === 0 ? 'tum kontroller gecti' : failures + ' kontrol BASARISIZ'));
if (!values.keep) {
  fs.rmSync(path.join(CWD, store.ROOT_DIR), { recursive: true, force: true });
  fs.rmSync(DROP, { recursive: true, force: true });
  fs.rmSync(OUT, { recursive: true, force: true });
  console.log('gecici dosyalar silindi (--keep ile saklanir)');
}
process.exit(failures === 0 ? 0 : 1);

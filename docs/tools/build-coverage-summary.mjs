#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 ustauretim
//
// Kapsam özeti üretir: data/mapping/dora-articles.yaml -> docs/KAPSAM-OZETI.md
// Madde tablosu, bölüm bazlı dağılım ve eksik/kısmi maddelerin gerekçeleri.
// Bilinmeyen bir status değeri görürse çıkış kodu 1 döner.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '../../onboarding/cli/src/orl/yaml.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const SRC = path.join(ROOT, 'data/mapping/dora-articles.yaml');
const OUT = path.join(ROOT, 'docs/KAPSAM-OZETI.md');

const doc = parse(fs.readFileSync(SRC, 'utf8'));
const articles = doc.articles ?? [];
const meta = doc.mapping ?? {};

const VALID = new Set(['covered', 'partial', 'gap']);
const bad = articles.filter((a) => !VALID.has(a.status));
if (bad.length) {
  console.error('bilinmeyen status: ' + bad.map((a) => a.id + '=' + a.status).join(', '));
  process.exit(1);
}

const count = (s) => articles.filter((a) => a.status === s).length;
const total = articles.length;
const pct = Math.round(((count('covered') + count('partial') * 0.5) / total) * 100);
const strictPct = Math.round((count('covered') / total) * 100);

const chapters = [];
for (const a of articles) {
  let c = chapters.find((x) => x.name === a.chapter);
  if (!c) { c = { name: a.chapter, total: 0, covered: 0, partial: 0, gap: 0 }; chapters.push(c); }
  c.total++; c[a.status]++;
}

const esc = (s) => String(s ?? '').replaceAll('|', '\\|');
const list = (xs) => (xs && xs.length ? xs.join(', ') : '—');

const lines = [];
lines.push('# DORA Kapsam Özeti');
lines.push('');
lines.push('> **Üretilen belge** — elle düzenlenmez. Kaynak: `data/mapping/dora-articles.yaml`');
lines.push('> Yeniden üretmek için: `node docs/tools/build-coverage-summary.mjs`');
lines.push('');
lines.push('Eşleme sürümü: **' + esc(meta.version) + '** · kaynak: ' + esc(meta.source) + ' · veri tarihi: ' + esc(meta.generated_at));
lines.push('');
lines.push('## 1. Özet');
lines.push('');
lines.push('| Ölçüt | Değer |');
lines.push('|---|---|');
lines.push('| Eşlenen yükümlülük maddesi | ' + total + ' |');
lines.push('| Tam kapsanan | ' + count('covered') + ' |');
lines.push('| Kısmi | ' + count('partial') + ' |');
lines.push('| Boşluk | ' + count('gap') + ' |');
lines.push('| Tam kapsama oranı | %' + strictPct + ' |');
lines.push('| Ağırlıklı kapsama (kısmi = 0,5) | %' + pct + ' |');
lines.push('');
lines.push('Kapsam notu (eşlemeden): ' + esc(meta.scope_note).replace(/\n/g, ' ').trim());
lines.push('');
lines.push('## 2. Bölüm bazlı dağılım');
lines.push('');
lines.push('| Bölüm | Madde | Tam | Kısmi | Boşluk |');
lines.push('|---|---:|---:|---:|---:|');
for (const c of chapters) {
  lines.push('| ' + esc(c.name) + ' | ' + c.total + ' | ' + c.covered + ' | ' + c.partial + ' | ' + c.gap + ' |');
}
lines.push('');
lines.push('## 3. Madde tablosu');
lines.push('');
lines.push('| Madde | Başlık | Durum | Süreç | Kontrol | Rol |');
lines.push('|---|---|---|---|---|---|');
for (const a of articles) {
  const badge = a.status === 'covered' ? '✅ covered' : a.status === 'partial' ? '🟡 partial' : '🔴 gap';
  lines.push('| ' + a.id + ' | ' + esc(a.title) + ' | ' + badge + ' | ' + list(a.processes) + ' | ' + list(a.controls) + ' | ' + list(a.roles) + ' |');
}
lines.push('');
lines.push('## 4. Kısmi ve boşluklar');
lines.push('');
lines.push('| Madde | Başlık | Durum | Gerekçe |');
lines.push('|---|---|---|---|');
for (const a of articles.filter((x) => x.status !== 'covered')) {
  lines.push('| ' + a.id + ' | ' + esc(a.title) + ' | ' + a.status + ' | ' + esc(a.note ?? '—') + ' |');
}
lines.push('');
lines.push('---');
lines.push('');
lines.push('Raporlama yükümlülükleri ve önerilen eklemeler: [RAPORLAMA-ANALIZI.md](RAPORLAMA-ANALIZI.md)');
lines.push('');

fs.writeFileSync(OUT, lines.join('\n'), 'utf8');
console.log('yazıldı: docs/KAPSAM-OZETI.md — ' + total + ' madde, %' + strictPct + ' tam kapsama (' + count('partial') + ' kısmi, ' + count('gap') + ' boşluk)');

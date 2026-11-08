#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 ustauretim
// data/mapping/dora-articles.yaml -> docs/dora-mapping.md
// Kullanım: node docs/tools/render-mapping.mjs [--check]
// --check: yalnızca doğrular, dosyayı yazmaz (CI için).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '../../onboarding/cli/src/corf/yaml.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const SRC = path.join(REPO, 'data', 'mapping', 'dora-articles.yaml');
const OUT = path.join(REPO, 'docs', 'dora-mapping.md');
const checkOnly = process.argv.includes('--check');

const doc = parse(fs.readFileSync(SRC, 'utf8'));
const articles = doc.articles ?? [];

// --- referans bütünlüğü ---
const processIds = new Set();
for (const f of fs.readdirSync(path.join(REPO, 'data', 'processes'))) {
  const t = fs.readFileSync(path.join(REPO, 'data', 'processes', f), 'utf8');
  for (const m of t.matchAll(/^  - id: (PRC-[A-Z]{3}-\d{2})$/gm)) processIds.add(m[1]);
}
const controlIds = new Set(
  [...fs.readFileSync(path.join(REPO, 'data', 'controls', 'controls-catalog.yaml'), 'utf8').matchAll(/^  - id: (CTL-[A-Z]{3}-\d{3})$/gm)].map((m) => m[1]),
);
const roleIds = new Set(
  [...fs.readFileSync(path.join(REPO, 'data', 'roles', 'roles-catalog.yaml'), 'utf8').matchAll(/^  - id: (ROL-[A-Z]{3,4}-\d{2})$/gm)].map((m) => m[1]),
);

const problems = [];
const seen = new Set();
for (const a of articles) {
  if (seen.has(a.id)) problems.push(`tekrarlanan madde: ${a.id}`);
  seen.add(a.id);
  for (const p of a.processes ?? []) if (!processIds.has(p)) problems.push(`${a.id}: tanımsız süreç ${p}`);
  for (const c of a.controls ?? []) if (!controlIds.has(c)) problems.push(`${a.id}: tanımsız kontrol ${c}`);
  for (const r of a.roles ?? []) if (!roleIds.has(r)) problems.push(`${a.id}: tanımsız rol ${r}`);
  if (!a.status) problems.push(`${a.id}: status yok`);
  if (a.status === 'gap' && !a.note) problems.push(`${a.id}: gap ama gerekçe (note) yok`);
}

const byStatus = { covered: 0, partial: 0, gap: 0 };
for (const a of articles) byStatus[a.status] = (byStatus[a.status] ?? 0) + 1;
const pct = articles.length ? Math.round((byStatus.covered / articles.length) * 100) : 0;

if (problems.length) {
  console.error('EŞLEME HATALARI:\n - ' + problems.join('\n - '));
  process.exit(1);
}

// --- markdown üretimi ---
const rows = articles
  .map((a) => `| ${a.id} | ${a.title} | ${(a.processes ?? []).join(', ') || '—'} | ${(a.controls ?? []).join(', ') || '—'} | ${a.status} |`)
  .join('\n');

const detail = articles
  .map((a) => {
    const obs = (a.obligations ?? []).map((o) => `- ${o}`).join('\n');
    return [
      `### ${a.id} — ${a.title}`,
      `*${a.chapter}*`,
      obs,
      [
        `- **Süreçler:** ${(a.processes ?? []).join(', ') || '—'}`,
        `- **Kontroller:** ${(a.controls ?? []).join(', ') || '—'}`,
        `- **Sahip roller:** ${(a.roles ?? []).join(', ') || '—'}`,
        `- **Durum:** ${a.status}`,
        a.tier_note ? `- **Tier:** ${a.tier_note}` : null,
        a.note ? `- **Not:** ${a.note}` : null,
      ]
        .filter(Boolean)
        .join('\n'),
    ].join('\n\n');
  })
  .join('\n\n');

const md = `# DORA Madde → Süreç / Kontrol Eşlemesi

> Bu dosya **üretilmiştir**: \`data/mapping/dora-articles.yaml\` kaynağından gelir.
> Yeniden üretmek için: \`node docs/tools/render-mapping.mjs\`
> Doğrulamak için (yazmadan): \`node docs/tools/render-mapping.mjs --check\`

- **Sürüm:** ${doc.mapping?.version}
- **Tarih:** ${doc.mapping?.generated_at}
- **Kaynak:** ${doc.mapping?.source}

## Özet

| Durum | Madde |
|---|---|
| covered | ${byStatus.covered} |
| partial | ${byStatus.partial} |
| gap | ${byStatus.gap} |
| **toplam** | **${articles.length}** |

Tam kapsama oranı: **%${pct}**. \`partial\` ve \`gap\` maddeleri C5 öz değerlendirmesinde
boşluk olarak görünür; kapatılmadıkça faz kapısı geçilmez.

## Tablo

| Madde | Başlık | Süreçler | Kontroller | Durum |
|---|---|---|---|---|
${rows}

## Madde ayrıntısı

${detail}
## Kapsam dışı

${doc.mapping?.scope_note ?? ''}

Tanım maddeleri (ör. Madde 3, Madde 4 kapsam belirleme) ve yaptırım maddeleri (Madde 50 vd.)
bu eşlemenin dışındadır — bunlar yükümlülük değil çerçeve hükmüdür.
`;

if (checkOnly) {
  console.log(`OK — ${articles.length} madde, kapsama %${pct} (covered ${byStatus.covered}, partial ${byStatus.partial}, gap ${byStatus.gap})`);
  process.exit(0);
}

fs.writeFileSync(OUT, md, 'utf8');
console.log(`yazıldı: ${path.relative(REPO, OUT)}`);
console.log(`${articles.length} madde — covered ${byStatus.covered}, partial ${byStatus.partial}, gap ${byStatus.gap} (tam kapsama %${pct})`);

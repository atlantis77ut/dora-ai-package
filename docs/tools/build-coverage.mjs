#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 ustauretim
// data/mapping/dora-articles.yaml -> C5 fazının beklediği artefaktlar
//   coverage-matrix.json  (madde bazında kapsama)
//   gap-analysis.json     (boşluklar; bağımsız imza alanı boş bırakılır)
//
// Kullanım: node docs/tools/build-coverage.mjs --session ob-2026-xxxx
// Not: bağımsız doğrulama imzasını bu araç ATAMAZ — C5 kapısı imza olmadan geçmez.

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { parse } from '../../onboarding/cli/src/orl/yaml.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const SRC = path.join(REPO, 'data', 'mapping', 'dora-articles.yaml');

const { values } = parseArgs({ options: { session: { type: 'string' } } });
if (!values.session) {
  console.error('kullanım: node docs/tools/build-coverage.mjs --session <id>');
  process.exit(1);
}

const dir = path.resolve(process.cwd(), '.dora-onboarding', values.session);
if (!fs.existsSync(dir)) {
  console.error(`oturum bulunamadı: ${dir}`);
  process.exit(1);
}

const doc = parse(fs.readFileSync(SRC, 'utf8'));
const articles = doc.articles ?? [];

const matrix = articles.map((a) => ({
  article: a.id,
  title: a.title,
  covered_by: a.processes ?? [],
  controls: a.controls ?? [],
  owner: a.roles ?? [],
  status: a.status,
}));

const gaps = articles
  .filter((a) => a.status !== 'covered')
  .map((a) => ({ article: a.id, status: a.status, reason: a.note ?? null }));

const summary = {
  total: articles.length,
  covered: articles.filter((a) => a.status === 'covered').length,
  partial: articles.filter((a) => a.status === 'partial').length,
  gap: articles.filter((a) => a.status === 'gap').length,
};

fs.writeFileSync(path.join(dir, 'coverage-matrix.json'), JSON.stringify({ summary, articles: matrix }, null, 2) + '\n');
fs.writeFileSync(
  path.join(dir, 'gap-analysis.json'),
  JSON.stringify(
    {
      high_severity: summary.gap,
      partial: summary.partial,
      gaps,
      risk_acceptance: [],
      independent_review_signed_by: null,
      note: 'RTS/ITS şablon eşlemesi ve yerel mevzuat teyidi tamamlanmadan imza atılmamalı',
    },
    null,
    2,
  ) + '\n',
);

console.log(`kapsama: ${summary.covered}/${summary.total} covered, ${summary.partial} partial, ${summary.gap} gap`);
console.log(`yazıldı: coverage-matrix.json, gap-analysis.json (${path.relative(REPO, dir)})`);

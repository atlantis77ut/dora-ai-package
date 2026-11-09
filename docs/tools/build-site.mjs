#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 ustauretim
//
// GitHub Pages çıktısını kurar: site/ kökünde landing sayfası, site/dashboard/
// altında üretilen dashboard. Kaynak: site/index.html + dashboard/.
//
// Kullanım: node docs/tools/build-site.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const SITE = path.join(ROOT, 'site');
const DASH = path.join(ROOT, 'dashboard');
const OUT = path.join(SITE, 'dashboard');

if (!fs.existsSync(path.join(SITE, 'index.html'))) {
  console.error('site/index.html yok');
  process.exit(1);
}
if (!fs.existsSync(path.join(DASH, 'index.html'))) {
  console.error('dashboard/index.html yok — önce build-dashboard çalıştırın');
  process.exit(1);
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(DASH)) {
  const src = path.join(DASH, f);
  if (fs.statSync(src).isFile()) fs.copyFileSync(src, path.join(OUT, f));
}
fs.writeFileSync(path.join(SITE, '.nojekyll'), '');

console.log('site hazır: site/index.html + site/dashboard/ (' + fs.readdirSync(OUT).length + ' dosya)');

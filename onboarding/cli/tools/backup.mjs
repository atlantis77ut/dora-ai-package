#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 ustauretim
//
// Yedekleme: web-data/ (kullanıcılar, anahtarlar, denetim) + .dora-onboarding/ (oturumlar)
// tek bir zip'te toplanır. Zip biçimi paketle aynı (store, UTF-8 adlar).
//
// Kullanım:
//   node tools/backup.mjs                       → yedek/dora-yedek-<tarih>.zip
//   node tools/backup.mjs --out /tmp/yedek.zip
//   node tools/backup.mjs --include-secrets     → anahtar dosyaları da girer (varsayılan: girer)

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { zipStore, sha256 } from '../src/orl/evidence.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');

const { values } = parseArgs({
  options: {
    out: { type: 'string' },
    dir: { type: 'string', default: path.join(ROOT, 'yedek') },
  },
});

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outFile = values.out ?? path.join(values.dir, `dora-yedek-${stamp}.zip`);

const sources = [
  { dir: path.join(ROOT, 'web-data'), prefix: 'web-data/' },
  { dir: path.join(ROOT, '.dora-onboarding'), prefix: 'oturumlar/' },
];

const entries = [];
const manifest = { format: 'dora-backup-v1', created_at: new Date().toISOString(), files: [] };

for (const src of sources) {
  if (!fs.existsSync(src.dir)) continue;
  const walk = (dir, rel) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      const relPath = path.posix.join(rel, e.name);
      if (e.isDirectory()) {
        walk(full, relPath);
        continue;
      }
      if (e.name.endsWith('.zip') || e.name.endsWith('.tmp')) continue;
      const data = fs.readFileSync(full);
      entries.push({ name: src.prefix + relPath, data });
      manifest.files.push({ path: src.prefix + relPath, bytes: data.length, sha256: sha256(data) });
    }
  };
  walk(src.dir, '');
}

if (!entries.length) {
  console.error('Yedeklenecek dosya yok (web-data/ ve .dora-onboarding/ boş).');
  process.exit(1);
}

entries.push({ name: 'manifest.json', data: Buffer.from(JSON.stringify(manifest, null, 2) + '\n', 'utf8') });

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, zipStore(entries, new Date()));

const size = fs.statSync(outFile).size;
console.log(`yedek hazır: ${path.relative(process.cwd(), outFile)}`);
console.log(`  dosya: ${manifest.files.length} · boyut: ${(size / 1024).toFixed(1)} KB`);
console.log('  içerik: web-data/ (kullanıcılar, anahtarlar, denetim) + oturumlar/');
console.log('  not: anahtar dosyaları yedekte düz metindir — yedeği şifreli bir yerde tutun.');

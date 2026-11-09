#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 ustauretim
//
// Yedekten geri yükleme. Güvenlik kuralları:
//  - yalnız manifestte listelenen dosyalar yazılır
//  - her dosyanın sha256'sı doğrulanır (bozuk yedek yazılmaz)
//  - zip-slip engeli: `..`, mutlak yol, sürücü harfi reddedilir
//  - hedef dizin boş değilse `--force` gerekir
//  - web-data altındaki hassas dosyalar `0600` ile yazılır
//
// Kullanım:
//   node tools/restore.mjs --zip yedek.zip --target ./geri-yukleme
//   node tools/restore.mjs --zip yedek.zip --target ./geri-yukleme --force

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { unzipStore, sha256 } from '../src/orl/evidence.mjs';

const FORMAT = 'dora-backup-v1';

function unsafeName(name) {
  if (!name || typeof name !== 'string') return 'boş ad';
  if (name.includes('\0')) return 'nul karakteri';
  if (name.startsWith('/') || /^[a-zA-Z]:/.test(name)) return 'mutlak yol';
  if (name.split('/').some((p) => p === '..')) return 'üst dizin';
  return null;
}

/**
 * Yedeği hedef dizine çıkarır.
 * @returns {{ ok: boolean, files: string[], problems: string[] }}
 */
export function restoreArchive(zipPath, target, { force = false } = {}) {
  const problems = [];
  const written = [];

  let entries;
  try {
    entries = unzipStore(fs.readFileSync(zipPath));
  } catch (e) {
    return { ok: false, files: [], problems: ['zip okunamadı: ' + e.message] };
  }

  const manifestEntry = entries.find((e) => e.name === 'manifest.json');
  if (!manifestEntry) return { ok: false, files: [], problems: ['manifest.json yok'] };

  let manifest;
  try {
    manifest = JSON.parse(manifestEntry.data.toString('utf8'));
  } catch {
    return { ok: false, files: [], problems: ['manifest.json bozuk'] };
  }
  if (manifest.format !== FORMAT) problems.push('bilinmeyen format: ' + manifest.format);

  const byName = new Map(entries.map((e) => [e.name, e]));
  const planned = [];

  for (const f of manifest.files ?? []) {
    const bad = unsafeName(f.path);
    if (bad) {
      problems.push(`güvensiz yol (${bad}): ${f.path}`);
      continue;
    }
    const got = byName.get(f.path);
    if (!got) {
      problems.push('eksik dosya: ' + f.path);
      continue;
    }
    if (sha256(got.data) !== f.sha256) {
      problems.push('içerik değişmiş: ' + f.path);
      continue;
    }
    planned.push({ rel: f.path, data: got.data });
  }

  if (problems.length) return { ok: false, files: [], problems };

  // hedef dizin
  if (fs.existsSync(target) && fs.readdirSync(target).length && !force) {
    return { ok: false, files: [], problems: ['hedef dizin boş değil (--force ile üzerine yazın)'] };
  }
  fs.mkdirSync(target, { recursive: true });

  for (const p of planned) {
    // yedekte oturumlar/ olarak duran dizin, kurulumdaki .dora-onboarding/ ile eşleşir
    const destRel = p.rel.startsWith('oturumlar/') ? '.dora-onboarding/' + p.rel.slice('oturumlar/'.length) : p.rel;
    const dest = path.resolve(target, destRel);
    if (!dest.startsWith(path.resolve(target) + path.sep) && dest !== path.resolve(target)) {
      problems.push('hedef dışına çıkış: ' + p.rel);
      continue;
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const sensitive = /^web-data\//.test(p.rel) && /\.(json|log|pem|key)$/i.test(p.rel);
    fs.writeFileSync(dest, p.data, sensitive ? { mode: 0o600 } : undefined);
    written.push(p.rel);
  }

  return { ok: problems.length === 0, files: written, problems };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const { values } = parseArgs({
    options: {
      zip: { type: 'string' },
      target: { type: 'string' },
      force: { type: 'boolean' },
    },
  });

  if (!values.zip || !values.target) {
    console.error('kullanım: node tools/restore.mjs --zip <yedek.zip> --target <dizin> [--force]');
    process.exit(2);
  }

  const r = restoreArchive(values.zip, values.target, { force: values.force });
  if (!r.ok) {
    console.error('GERİ YÜKLEME BAŞARISIZ');
    for (const p of r.problems) console.error('  - ' + p);
    process.exit(1);
  }

  console.log(`geri yüklendi: ${r.files.length} dosya → ${values.target}`);
  console.log('  sonraki adımlar:');
  console.log('    sudo chown -R dora:dora ' + values.target);
  console.log('    systemd unit içindeki yolu güncelle, sonra: systemctl restart dora-ai-package');
  console.log('    doğrula: curl -s http://127.0.0.1:8080/api/health');
}

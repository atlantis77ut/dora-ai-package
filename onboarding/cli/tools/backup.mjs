#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 ustauretim
//
// Yedekleme: web-data/ (kullanıcılar, anahtarlar, denetim) + .dora-onboarding/ (oturumlar)
// tek zip'te. Manifest her dosyanın sha256'sını taşır; `--verify` ile doğrulanır,
// `tools/restore.mjs` ile geri yüklenir.
//
// Kullanım:
//   node tools/backup.mjs                        → yedek/dora-yedek-<tarih>.zip
//   node tools/backup.mjs --out /tmp/y.zip
//   node tools/backup.mjs --keep 8               → eski yedeklerden 8 tanesini tut
//   node tools/backup.mjs --verify y.zip         → yedeği doğrula

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { zipStore, unzipStore, sha256 } from '../src/orl/evidence.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const FORMAT = 'dora-backup-v1';

const { values } = parseArgs({
  options: {
    out: { type: 'string' },
    dir: { type: 'string', default: path.join(ROOT, 'yedek') },
    root: { type: 'string', default: ROOT },
    keep: { type: 'string' },
    verify: { type: 'string' },
  },
});

/** Verilen köklerdeki dosyaları toplar; yedek ve manifest üretir. */
export function collectBackup({ root = ROOT, includeSessions = true } = {}) {
  const sources = [{ dir: path.join(root, 'web-data'), prefix: 'web-data/' }];
  if (includeSessions) sources.push({ dir: path.join(root, '.dora-onboarding'), prefix: 'oturumlar/' });

  const entries = [];
  const manifest = { format: FORMAT, created_at: new Date().toISOString(), files: [] };

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
        if (/\.(zip|tmp)$/i.test(e.name)) continue;
        const data = fs.readFileSync(full);
        entries.push({ name: src.prefix + relPath, data });
        manifest.files.push({ path: src.prefix + relPath, bytes: data.length, sha256: sha256(data) });
      }
    };
    walk(src.dir, '');
  }

  return { entries, manifest };
}

/** Yedek dosyası üretir. */
export function createBackup({ root = ROOT, outFile, includeSessions = true } = {}) {
  const { entries, manifest } = collectBackup({ root, includeSessions });
  if (!entries.length) throw new Error('Yedeklenecek dosya yok (web-data/ ve .dora-onboarding/ boş)');

  const all = [...entries, { name: 'manifest.json', data: Buffer.from(JSON.stringify(manifest, null, 2) + '\n', 'utf8') }];
  const buf = zipStore(all, new Date());
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, buf);

  return { outFile, files: manifest.files.length, bytes: buf.length, sha256: sha256(buf) };
}

/** Yedeği açar, manifesti ve tüm sha256'ları doğrular. */
export function verifyBackup(file) {
  const entries = unzipStore(fs.readFileSync(file));
  const manifestEntry = entries.find((e) => e.name === 'manifest.json');
  if (!manifestEntry) return { ok: false, problems: ['manifest.json yok'], files: 0 };
  let manifest;
  try {
    manifest = JSON.parse(manifestEntry.data.toString('utf8'));
  } catch {
    return { ok: false, problems: ['manifest.json bozuk'], files: 0 };
  }
  const problems = [];
  if (manifest.format !== FORMAT) problems.push('bilinmeyen format: ' + manifest.format);

  const byName = new Map(entries.map((e) => [e.name, e]));
  for (const f of manifest.files ?? []) {
    const got = byName.get(f.path);
    if (!got) {
      problems.push('eksik dosya: ' + f.path);
      continue;
    }
    if (sha256(got.data) !== f.sha256) problems.push('içerik değişmiş: ' + f.path);
  }
  const extra = entries.filter((e) => e.name !== 'manifest.json' && !(manifest.files ?? []).some((f) => f.path === e.name));
  for (const e of extra) problems.push('manifestte olmayan dosya: ' + e.name);

  return { ok: problems.length === 0, problems, files: (manifest.files ?? []).length, manifest };
}

/** Eski yedeklerden en yeni `keep` tanesini tutar. */
export function pruneBackups(dir, keep = 8) {
  if (!fs.existsSync(dir)) return { removed: [] };
  const files = fs
    .readdirSync(dir)
    .filter((f) => /^dora-yedek-.*\.zip$/.test(f))
    .map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  const removed = files.slice(Math.max(0, keep)).map((x) => path.join(dir, x.f));
  for (const f of removed) fs.rmSync(f, { force: true });
  return { removed };
}

// ── CLI ──────────────────────────────────────────────────
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  if (values.verify) {
    const r = verifyBackup(values.verify);
    console.log(`yedek doğrulama: ${values.verify}`);
    console.log(`  dosya: ${r.files} · sonuç: ${r.ok ? 'GEÇERLİ' : 'GEÇERSİZ'}`);
    for (const p of r.problems ?? []) console.log('  - ' + p);
    process.exit(r.ok ? 0 : 1);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outFile = values.out ?? path.join(values.dir, `dora-yedek-${stamp}.zip`);
  try {
    const r = createBackup({ root: values.root, outFile });
    console.log(`yedek hazır: ${path.relative(process.cwd(), r.outFile)}`);
    console.log(`  dosya: ${r.files} · boyut: ${(r.bytes / 1024).toFixed(1)} KB`);
    console.log(`  sha256: ${r.sha256.slice(0, 16)}…`);
    console.log('  içerik: web-data/ (kullanıcılar, anahtarlar, denetim) + oturumlar/');
    console.log('  geri yükleme: node tools/restore.mjs --zip <dosya> --target <dizin>');
    console.log('  not: anahtar dosyaları yedekte düz metindir — yedeği şifreli yerde tutun.');

    if (values.keep) {
      const { removed } = pruneBackups(path.dirname(outFile), Number(values.keep) || 8);
      if (removed.length) console.log(`  eski yedek silindi: ${removed.length}`);
    }
  } catch (e) {
    console.error('YEDEK ALINAMADI: ' + e.message);
    process.exit(1);
  }
}

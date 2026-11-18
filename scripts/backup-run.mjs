#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 ustauretim
//
// Zamanlanmış yedek çalıştırıcısı — systemd `dora-backup.service` bunu çağırır.
// Sıra: yedek al → manifest/sha256 doğrula → eski yedekleri buda → durum dosyası yaz.
// Doğrulama başarısızsa çıkış kodu 1 olur ve budama YAPILMAZ (sağlam yedekler korunur).
//
// Kullanım:
//   node scripts/backup-run.mjs                       # DORA_* ortam değişkenleriyle
//   node scripts/backup-run.mjs --dest /var/backups/dora --keep 14
//   node scripts/backup-run.mjs --dry-run             # ne yapılacağını yazar, yazmaz
//   node scripts/backup-run.mjs --verify-only <zip>   # yalnız doğrula

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { createBackup, verifyBackup, pruneBackups } from '../onboarding/cli/tools/backup.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const { values } = parseArgs({
  options: {
    root: { type: 'string', default: process.env.DORA_ROOT ?? ROOT },
    dest: { type: 'string', default: process.env.DORA_BACKUP_DIR ?? '' },
    keep: { type: 'string', default: process.env.DORA_BACKUP_KEEP ?? '8' },
    'dry-run': { type: 'boolean', default: false },
    'verify-only': { type: 'string' },
    quiet: { type: 'boolean', default: false },
  },
});

const say = (m) => {
  if (!values.quiet) console.log(m);
};

/** Varsayılan hedef: Linux'ta /var/backups/dora, geliştirmede depo içindeki yedek/. */
function defaultDest(root) {
  return process.platform === 'linux' ? '/var/backups/dora' : path.join(root, 'yedek');
}

if (values['verify-only']) {
  const r = verifyBackup(values['verify-only']);
  console.log(`yedek doğrulama: ${values['verify-only']} → ${r.ok ? 'GEÇERLİ' : 'GEÇERSİZ'} (${r.files} dosya)`);
  for (const p of r.problems ?? []) console.log('  - ' + p);
  process.exit(r.ok ? 0 : 1);
}

const root = path.resolve(values.root);
const dest = path.resolve(values.dest || defaultDest(root));
const keep = Math.max(1, Number(values.keep) || 8);
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outFile = path.join(dest, `dora-yedek-${stamp}.zip`);

if (!fs.existsSync(path.join(root, 'web-data'))) {
  console.error(`YEDEK ALINAMADI: ${path.join(root, 'web-data')} yok — --root doğru mu?`);
  process.exit(1);
}

say(`kaynak : ${root}`);
say(`hedef  : ${outFile}`);
say(`saklama: son ${keep} yedek`);

if (values['dry-run']) {
  say('dry-run: dosya yazılmadı.');
  process.exit(0);
}

let made;
try {
  made = createBackup({ root, outFile });
} catch (e) {
  console.error('YEDEK ALINAMADI: ' + e.message);
  process.exit(1);
}
say(`yedek  : ${made.files} dosya · ${(made.bytes / 1024).toFixed(1)} KB · sha256 ${made.sha256.slice(0, 16)}…`);

const check = verifyBackup(outFile);
if (!check.ok) {
  console.error('YEDEK DOĞRULANAMADI — budama yapılmadı, dosya incelenmeli: ' + outFile);
  for (const p of check.problems ?? []) console.error('  - ' + p);
  process.exit(1);
}
say('doğrulama: GEÇERLİ (manifest + sha256)');

const { removed } = pruneBackups(dest, keep);
if (removed.length) say(`budama : ${removed.length} eski yedek silindi`);

const status = {
  at: new Date().toISOString(),
  file: path.basename(outFile),
  files: made.files,
  bytes: made.bytes,
  sha256: made.sha256,
  verified: true,
  kept_max: keep,
  pruned: removed.length,
};
try {
  fs.writeFileSync(path.join(dest, 'son-yedek.json'), JSON.stringify(status, null, 2) + '\n', { mode: 0o600 });
} catch (e) {
  // durum dosyası yazılamazsa yedek yine geçerli; yalnızca uyar
  console.error('uyarı: durum dosyası yazılamadı: ' + e.message);
}

say('tamam.');

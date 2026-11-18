#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 ustauretim
//
// Günlük yedek zamanlayıcısını kurar (systemd timer).
//   sudo node scripts/install-backup-timer.mjs
//   sudo node scripts/install-backup-timer.mjs --dest /mnt/yedek/dora --keep 14 --time 03:10
//   node scripts/install-backup-timer.mjs --dry-run
//   sudo node scripts/install-backup-timer.mjs --now     # bir kez hemen çalıştırıp doğrula
//
// Yazar: /etc/systemd/system/dora-backup.service + dora-backup.timer
// Çalıştırır: scripts/backup-run.mjs (yedek → doğrula → buda)

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { renderBackupService, renderBackupTimer } from '../deploy/render.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const { values } = parseArgs({
  options: {
    dir: { type: 'string', default: '/opt/dora-ai-package' },
    dest: { type: 'string', default: '/var/backups/dora' },
    keep: { type: 'string', default: '8' },
    time: { type: 'string', default: '02:30' },
    user: { type: 'string', default: 'dora' },
    now: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
  },
});

const DRY = Boolean(values['dry-run']);
// Linux yolları Windows'ta path.resolve ile bozulmasın (dry-run geliştirmede çalışır)
const TARGET = values.dir.startsWith('/') ? values.dir.replace(/\/+$/, '') : path.resolve(values.dir);
const DEST = values.dest;
const KEEP = String(Math.max(1, Number(values.keep) || 8));

if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(values.time)) {
  console.error(`HATA: --time SS:DD biçiminde olmalı (verilen: ${values.time})`);
  process.exit(1);
}
if (!DRY && process.getuid?.() !== 0) {
  console.error('HATA: root olarak çalıştırın (sudo node scripts/install-backup-timer.mjs ...)');
  process.exit(1);
}
const runner = `${TARGET}/scripts/backup-run.mjs`;
if (!fs.existsSync(runner) && !DRY) {
  console.error(`HATA: ${runner} yok — --dir doğru mu?`);
  process.exit(1);
}

const SERVICE = '/etc/systemd/system/dora-backup.service';
const TIMER = '/etc/systemd/system/dora-backup.timer';

function write(file, content, mode = 0o644) {
  if (DRY) {
    console.log(`  ~ ${file} (${content.length} bayt)`);
    return;
  }
  fs.writeFileSync(file, content, { mode });
  fs.chmodSync(file, mode);
}

function run(cmd, args) {
  if (DRY) {
    console.log(`  $ ${cmd} ${args.join(' ')}`.trimEnd());
    return { status: 0, stdout: '' };
  }
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  if (r.status !== 0) {
    console.error(`HATA: ${cmd} ${args.join(' ')} başarısız\n${r.stdout ?? ''}${r.stderr ?? ''}`);
    process.exit(1);
  }
  return r;
}

console.log(`\nDORA yedek zamanlayıcısı${DRY ? ' (dry-run)' : ''}`);
console.log(`  dizin    : ${TARGET}`);
console.log(`  hedef    : ${DEST}`);
console.log(`  saklama  : son ${KEEP} yedek`);
console.log(`  saat     : her gün ${values.time}\n`);

// yedek dizini: yalnız servis kullanıcısı okuyabilsin
if (!DRY) {
  fs.mkdirSync(DEST, { recursive: true, mode: 0o750 });
  try {
    fs.chmodSync(DEST, 0o750);
  } catch {
    /* sahiplik değişimi aşağıda */
  }
  run('chown', [`${values.user}:${values.user}`, DEST]);
}

write(SERVICE, renderBackupService({ target: TARGET, dest: DEST, keep: KEEP }));
write(TIMER, renderBackupTimer({ time: values.time }));

run('systemctl', ['daemon-reload']);
run('systemctl', ['enable', '--now', 'dora-backup.timer']);

if (values.now) {
  console.log('\nbir kez hemen çalıştırılıyor…');
  run('systemctl', ['start', 'dora-backup.service']);
  const st = run('systemctl', ['is-active', 'dora-backup.service']);
  console.log(`  servis durumu: ${(st.stdout ?? '').trim() || 'bilinmiyor'}`);
  const ls = run('ls', ['-1', DEST]);
  console.log(`  ${DEST}:\n${(ls.stdout ?? '')
    .split('\n')
    .filter(Boolean)
    .map((f) => '    ' + f)
    .join('\n')}`);
}

const timers = run('systemctl', ['list-timers', 'dora-backup.timer', '--no-pager']);
console.log(`\n${(timers.stdout ?? '').trim()}\n`);
console.log(`Kurulum tamam.
  Elle çalıştır : sudo systemctl start dora-backup.service
  Durum         : systemctl status dora-backup.timer
  Log           : sudo journalctl -u dora-backup -n 40
  Geri yükleme  : node onboarding/cli/tools/restore.mjs --zip ${DEST}/dora-yedek-*.zip --target /gecici/dizin
`);

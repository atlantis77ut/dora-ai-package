import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBackup, verifyBackup, collectBackup, pruneBackups } from '../../tools/backup.mjs';
import { restoreArchive } from '../../tools/restore.mjs';
import { zipStore } from '../../src/orl/evidence.mjs';

function fakeRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dora-bk-'));
  fs.mkdirSync(path.join(root, 'web-data'), { recursive: true });
  fs.mkdirSync(path.join(root, '.dora-onboarding', 'ob-1'), { recursive: true });
  fs.writeFileSync(path.join(root, 'web-data', 'users.json'), JSON.stringify([{ username: 'a' }]));
  fs.writeFileSync(path.join(root, 'web-data', 'audit.log'), 'satir\n');
  fs.writeFileSync(path.join(root, '.dora-onboarding', 'ob-1', 'session.json'), JSON.stringify({ session_id: 'ob-1' }));
  return root;
}

test('yedek: dosyaları ve manifesti toplar', () => {
  const root = fakeRepo();
  const { manifest } = collectBackup({ root });
  assert.equal(manifest.format, 'dora-backup-v1');
  assert.equal(manifest.files.length, 3);
  assert.ok(manifest.files.every((f) => f.sha256.length === 64));
});

test('yedek: oluştur → doğrula', () => {
  const root = fakeRepo();
  const out = path.join(root, 'yedek.zip');
  const r = createBackup({ root, outFile: out });
  assert.equal(r.files, 3);
  assert.ok(r.sha256);
  const v = verifyBackup(out);
  assert.equal(v.ok, true, JSON.stringify(v.problems));
  assert.equal(v.files, 3);
});

test('yedek: bozulmuş zip doğrulamada yakalanır', () => {
  const root = fakeRepo();
  const out = path.join(root, 'yedek.zip');
  createBackup({ root, outFile: out });
  const buf = fs.readFileSync(out);
  const needle = Buffer.from('"a"');
  const i = buf.indexOf(needle);
  assert.ok(i > 0);
  buf[i + 1] = 0x62; // a -> b
  const bad = path.join(root, 'bozuk.zip');
  fs.writeFileSync(bad, buf);
  const v = verifyBackup(bad);
  assert.equal(v.ok, false);
});

test('geri yükleme: dosyalar birebir geri gelir', () => {
  const root = fakeRepo();
  const out = path.join(root, 'yedek.zip');
  createBackup({ root, outFile: out });

  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'dora-rs-'));
  const r = restoreArchive(out, target);
  assert.equal(r.ok, true, JSON.stringify(r.problems));
  assert.equal(r.files.length, 3);

  const original = fs.readFileSync(path.join(root, 'web-data', 'audit.log'), 'utf8');
  const restored = fs.readFileSync(path.join(target, 'web-data', 'audit.log'), 'utf8');
  assert.equal(restored, original);
  assert.ok(fs.existsSync(path.join(target, '.dora-onboarding', 'ob-1', 'session.json')));
});

test('geri yükleme: dolu hedef --force olmadan reddedilir', () => {
  const root = fakeRepo();
  const out = path.join(root, 'yedek.zip');
  createBackup({ root, outFile: out });
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'dora-rs2-'));
  fs.writeFileSync(path.join(target, 'var.txt'), 'x');
  const r = restoreArchive(out, target);
  assert.equal(r.ok, false);
  assert.match(r.problems.join(' '), /boş değil/);
});

test('geri yükleme: zip-slip denemesi reddedilir', () => {
  const payload = Buffer.from('kötü');
  const manifest = {
    format: 'dora-backup-v1',
    created_at: new Date().toISOString(),
    files: [{ path: '../kacak.txt', bytes: payload.length, sha256: '0'.repeat(64) }],
  };
  const zip = zipStore([
    { name: 'manifest.json', data: Buffer.from(JSON.stringify(manifest)) },
    { name: '../kacak.txt', data: payload },
  ]);
  const zipPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'dora-slip-')), 'x.zip');
  fs.writeFileSync(zipPath, zip);
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'dora-slip-out-'));
  const r = restoreArchive(zipPath, target);
  assert.equal(r.ok, false);
  assert.match(r.problems.join(' '), /güvensiz yol/);
});

test('yedek: boş kurulumda hata verir', () => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'dora-empty-'));
  assert.throws(() => createBackup({ root: empty, outFile: path.join(empty, 'x.zip') }), /Yedeklenecek dosya yok/);
});

test('yedek: saklama sayısı uygulanır', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dora-prune-'));
  for (let i = 0; i < 5; i++) {
    const f = path.join(dir, `dora-yedek-2026-11-0${i}.zip`);
    fs.writeFileSync(f, 'x');
    const t = Date.now() - (5 - i) * 1000;
    fs.utimesSync(f, t / 1000, t / 1000);
  }
  const { removed } = pruneBackups(dir, 2);
  assert.equal(removed.length, 3);
  assert.equal(fs.readdirSync(dir).filter((f) => f.endsWith('.zip')).length, 2);
});

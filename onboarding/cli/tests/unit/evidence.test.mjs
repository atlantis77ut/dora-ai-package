import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { buildBundle, verifyBundle, sha256, computeChain } from '../../src/orl/evidence.mjs';

function sessionDir(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dora-ev-'));
  for (const [name, data] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  }
  return dir;
}

const session = { session_id: 'ob-test-1', tier: 'tier2', regulator: 'BDDK', license: { mode: 'trial' } };

test('kanıt: sha256 ve zincir deterministik', () => {
  assert.equal(sha256(Buffer.from('a')), sha256(Buffer.from('a')));
  assert.notEqual(sha256(Buffer.from('a')), sha256(Buffer.from('b')));
  const entries = [
    { path: 'evidence/a.json', bytes: 2, sha256: sha256(Buffer.from('{}')) },
    { path: 'evidence/b.json', bytes: 2, sha256: sha256(Buffer.from('[]')) },
  ];
  const chain = computeChain(entries);
  assert.equal(chain.length, 2);
  assert.notEqual(chain[0].chain, chain[1].chain);
  // deterministik: aynı girdi aynı zinciri üretir
  assert.deepEqual(
    computeChain(entries).map((x) => x.chain),
    chain.map((x) => x.chain),
  );
  // tek bayt değişince zincir değişir
  const changed = computeChain([{ ...entries[0], sha256: sha256(Buffer.from('[]')) }, entries[1]]);
  assert.notEqual(changed[0].chain, chain[0].chain);
});

test('kanıt: imzasız paket oluşturulur ve doğrulanır', () => {
  const dir = sessionDir({ 'a.json': { x: 1 }, 'b.json': { y: 2 } });
  const out = path.join(dir, 'bundle.zip');
  const res = buildBundle({ dir, session, outFile: out });
  assert.equal(res.files, 2);
  assert.equal(res.signed, false);
  const v = verifyBundle(out);
  assert.equal(v.ok, true, JSON.stringify(v.problems));
});

test('kanıt: imzalı paket geçerli', () => {
  const dir = sessionDir({ 'a.json': { x: 1 } });
  const keyFile = path.join(dir, 'key.pem');
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  fs.writeFileSync(keyFile, privateKey.export({ type: 'pkcs8', format: 'pem' }));
  const out = path.join(dir, 'bundle.zip');
  const res = buildBundle({ dir, session, outFile: out, keyFile });
  assert.equal(res.signed, true);
  const v = verifyBundle(out, publicKey.export({ type: 'spki', format: 'pem' }).toString());
  assert.equal(v.ok, true, JSON.stringify(v.problems));
  assert.equal(v.signature, 'geçerli');
});

test('kanıt: yanlış açık anahtar imzayı reddeder', () => {
  const dir = sessionDir({ 'a.json': { x: 1 } });
  const keyFile = path.join(dir, 'key.pem');
  const { privateKey } = crypto.generateKeyPairSync('ed25519');
  const other = crypto.generateKeyPairSync('ed25519').publicKey;
  fs.writeFileSync(keyFile, privateKey.export({ type: 'pkcs8', format: 'pem' }));
  const out = path.join(dir, 'bundle.zip');
  buildBundle({ dir, session, outFile: out, keyFile });
  const v = verifyBundle(out, other.export({ type: 'spki', format: 'pem' }).toString());
  assert.equal(v.ok, false);
  assert.ok(v.problems.some((p) => p.includes('imza')));
});

test('kanıt: değiştirilmiş dosya içeriği yakalanır', () => {
  const dir = sessionDir({ 'a.json': { x: 1 }, 'b.json': { y: 2 } });
  const out = path.join(dir, 'bundle.zip');
  buildBundle({ dir, session, outFile: out });
  // paketteki b.json'u kurcalamak için yeniden yaz: aynı manifest, farklı içerik
  const buf = fs.readFileSync(out);
  const tampered = Buffer.from(buf);
  const needle = Buffer.from('"x": 1');
  const i = tampered.indexOf(needle);
  assert.ok(i > 0, 'içerik pakette bulunmalı');
  tampered[i + needle.length - 1] = 0x39; // 1 -> 9
  const bad = path.join(dir, 'bundle-bad.zip');
  fs.writeFileSync(bad, tampered);
  const v = verifyBundle(bad);
  assert.equal(v.ok, false);
  assert.ok(v.problems.some((p) => p.includes('değişmiş') || p.includes('zincir')), JSON.stringify(v.problems));
});

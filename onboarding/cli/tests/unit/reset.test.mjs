import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createResetStore } from '../../src/orl/reset.mjs';
import { createAuthStore } from '../../src/orl/auth.mjs';
import { totp } from '../../src/orl/totp.mjs';

function memStore() {
  let data = { tokens: [] };
  return {
    readJson: (_f, fallback) => (data ?? fallback),
    writeJson: (_f, obj) => {
      data = JSON.parse(JSON.stringify(obj));
    },
    raw: () => data,
  };
}

test('reset: bağlantı bir kez kullanılır', () => {
  const m = memStore();
  const store = createResetStore('x', m);
  const r = store.issue('usr-1');
  assert.equal(store.consume(r.token).ok, true);
  assert.equal(store.consume(r.token).ok, false);
});

test('reset: bilinmeyen token reddedilir', () => {
  const store = createResetStore('x', memStore());
  assert.equal(store.consume('uydurma').ok, false);
});

test('reset: süresi dolmuş token reddedilir', () => {
  const m = memStore();
  const store = createResetStore('x', m);
  const r = store.issue('usr-1');
  const data = m.raw();
  data.tokens[0].exp = Date.now() - 1000;
  assert.equal(store.consume(r.token).ok, false);
});

test('reset: token diskte düz metin tutulmaz', () => {
  const m = memStore();
  const store = createResetStore('x', m);
  const r = store.issue('usr-1');
  const stored = JSON.stringify(m.raw());
  assert.equal(stored.includes(r.token), false);
  assert.ok(stored.includes('sha256') || stored.includes(r.token.slice(0, 4)) === false);
});

test('2fa: kurulum + etkinleştirme + kurtarma kodu', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dora-2fa-'));
  const store = createAuthStore(tmp);
  const b = store.bootstrap({ username: 'admin', password: 'Yonetici123' });

  const secret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
  assert.equal(store.setPendingTotp(b.user.id, secret).ok, true);
  const codes = ['AAAAA-11111', 'BBBBB-22222'];
  assert.equal(store.enableTotp(b.user.id, '000000', codes).ok, false, 'yanlış kod reddedilmeli');
  assert.equal(store.enableTotp(b.user.id, totp(secret), codes).ok, true);

  const login = store.login('admin', 'Yonetici123');
  assert.equal(login.otpRequired, true);
  assert.ok(login.challenge);

  const bad = store.verifyOtp(login.challenge, '000000');
  assert.equal(bad.ok, false);

  const good = store.verifyOtp(login.challenge, totp(secret));
  assert.equal(good.ok, true);
  assert.ok(store.verify(good.token));

  const l2 = store.login('admin', 'Yonetici123');
  const rec = store.verifyOtp(l2.challenge, 'AAAAA-11111');
  assert.equal(rec.ok, true);

  const l3 = store.login('admin', 'Yonetici123');
  const reuse = store.verifyOtp(l3.challenge, 'AAAAA-11111');
  assert.equal(reuse.ok, false, 'kurtarma kodu tek kullanımlık');
});

test('2fa: geçersiz meydan okuma reddedilir', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dora-2fa2-'));
  const store = createAuthStore(tmp);
  store.bootstrap({ username: 'admin', password: 'Yonetici123' });
  assert.equal(store.verifyOtp('abc.def', '123456').ok, false);
});

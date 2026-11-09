import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { hashPassword, verifyPassword, createAuthStore } from '../../src/orl/auth.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'dora-auth-'));

test('auth: parola özeti doğrular, yanlış parolayı reddeder', () => {
  const { salt, hash } = hashPassword('Gizli12345');
  assert.equal(verifyPassword('Gizli12345', salt, hash), true);
  assert.equal(verifyPassword('yanlis', salt, hash), false);
});

test('auth: aynı parola farklı tuzla farklı özet üretir', () => {
  const a = hashPassword('AyniParola');
  const b = hashPassword('AyniParola');
  assert.notEqual(a.hash, b.hash);
  assert.equal(verifyPassword('AyniParola', b.salt, b.hash), true);
});

test('auth: bootstrap ilk yöneticiyi oluşturur, ikinci kez reddeder', () => {
  const store = createAuthStore(tmp());
  assert.equal(store.hasUsers(), false);
  const r = store.bootstrap({ username: 'admin', password: 'Yonetici123', name: 'Yönetici' });
  assert.equal(r.ok, true);
  assert.equal(r.user.role, 'admin');
  const again = store.bootstrap({ username: 'x', password: '12345678' });
  assert.equal(again.ok, false);
});

test('auth: bootstrap kısa parolayı reddeder', () => {
  const store = createAuthStore(tmp());
  const r = store.bootstrap({ username: 'admin', password: 'kisa' });
  assert.equal(r.ok, false);
});

test('auth: giriş doğru parolayla token üretir, yanlışta reddeder', () => {
  const store = createAuthStore(tmp());
  store.bootstrap({ username: 'admin', password: 'Yonetici123' });
  const ok = store.login('admin', 'Yonetici123');
  assert.equal(ok.ok, true);
  assert.ok(ok.token);
  const bad = store.login('admin', 'yanlis');
  assert.equal(bad.ok, false);
});

test('auth: token doğrulanır ve kullanıcı döner', () => {
  const store = createAuthStore(tmp());
  const b = store.bootstrap({ username: 'admin', password: 'Yonetici123' });
  const v = store.verify(b.token);
  assert.equal(v.user.username, 'admin');
  assert.equal(v.role, 'admin');
});

test('auth: bozuk token reddedilir', () => {
  const store = createAuthStore(tmp());
  store.bootstrap({ username: 'admin', password: 'Yonetici123' });
  assert.equal(store.verify('abc.def'), null);
  assert.equal(store.verify(''), null);
});

test('auth: parola değişince eski token geçersizleşir', () => {
  const store = createAuthStore(tmp());
  const b = store.bootstrap({ username: 'admin', password: 'Yonetici123' });
  assert.ok(store.verify(b.token));
  store.updateUser(b.user.id, { password: 'YeniParola123' });
  assert.equal(store.verify(b.token), null, 'eski oturum düşmeli');
  const login = store.login('admin', 'YeniParola123');
  assert.equal(login.ok, true);
  assert.ok(store.verify(login.token));
});

test('auth: refresh yeni token üretir', () => {
  const store = createAuthStore(tmp());
  const b = store.bootstrap({ username: 'admin', password: 'Yonetici123' });
  const fresh = store.refresh(b.user, 4);
  assert.ok(fresh);
  const v = store.verify(fresh);
  assert.equal(v.user.username, 'admin');
});

test('auth: kullanıcı oluşturma ve rol ataması', () => {
  const store = createAuthStore(tmp());
  store.bootstrap({ username: 'admin', password: 'Yonetici123' });
  const r = store.createUser({ username: 'ayse', password: 'Parola12345', name: 'Ayşe', role: 'user' });
  assert.equal(r.ok, true);
  assert.equal(r.user.role, 'user');
  const dup = store.createUser({ username: 'AYSE', password: 'Parola12345', role: 'user' });
  assert.equal(dup.ok, false, 'kullanıcı adı büyük/küçük harf duyarsız olmalı');
});

test('auth: son yönetici silinemez', () => {
  const store = createAuthStore(tmp());
  const b = store.bootstrap({ username: 'admin', password: 'Yonetici123' });
  const r = store.removeUser(b.user.id);
  assert.equal(r.ok, false);
});

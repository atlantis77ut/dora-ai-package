import test from 'node:test';
import assert from 'node:assert/strict';
import {
  base32Encode,
  base32Decode,
  generateSecret,
  totp,
  verifyTotp,
  otpauthUrl,
  generateRecoveryCodes,
  hashCode,
} from '../../src/orl/totp.mjs';

test('totp: base32 gidiş-dönüş', () => {
  const buf = Buffer.from('merhaba dünya');
  assert.deepEqual(base32Decode(base32Encode(buf)), buf);
});

test('totp: RFC 6238 test vektörü (SHA1, 8 hane)', () => {
  // RFC 6238 Ek B: secret "12345678901234567890", T=59 → 94287082
  const secret = base32Encode(Buffer.from('12345678901234567890'));
  const code = totp(secret, { digits: 8, t: 59 * 1000 });
  assert.equal(code, '94287082');
});

test('totp: 6 hane ve 30 saniye penceresi', () => {
  const secret = generateSecret();
  const now = 1_700_000_000_000;
  const code = totp(secret, { t: now });
  assert.match(code, /^\d{6}$/);
  assert.equal(verifyTotp(secret, code, { t: now }), true);
  // bir önceki adım tolerans içinde
  assert.equal(verifyTotp(secret, totp(secret, { t: now - 30_000 }), { t: now }), true);
  // 3 adım önce tolerans dışı
  assert.equal(verifyTotp(secret, totp(secret, { t: now - 90_000 }), { t: now }), false);
});

test('totp: yanlış kod reddedilir', () => {
  const secret = generateSecret();
  assert.equal(verifyTotp(secret, '000000', { t: 1_700_000_000_000 }), false);
  assert.equal(verifyTotp(secret, 'abc', { t: 1_700_000_000_000 }), false);
});

test('totp: otpauth URL biçimi', () => {
  const url = otpauthUrl('DORA', 'admin@ornek.local', 'JBSWY3DPEHPK3PXP');
  assert.match(url, /^otpauth:\/\/totp\//);
  assert.match(url, /secret=JBSWY3DPEHPK3PXP/);
  assert.match(url, /issuer=DORA/);
});

test('totp: kurtarma kodları benzersiz ve biçimli', () => {
  const codes = generateRecoveryCodes();
  assert.equal(codes.length, 10);
  assert.equal(new Set(codes).size, 10);
  for (const c of codes) assert.match(c, /^[0-9A-F]{5}-[0-9A-F]{5}$/);
});

test('totp: kurtarma kodu özeti büyük/küçük harf duyarsız', () => {
  assert.equal(hashCode('ABCDE-12345'), hashCode('abcde-12345'));
});

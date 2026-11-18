import test from 'node:test';
import assert from 'node:assert/strict';
import { isLoopback, isHttpsRequest } from '../../src/orl/proxy.mjs';

const https = { 'x-forwarded-proto': 'https' };
const http = { 'x-forwarded-proto': 'http' };

test('loopback adresleri tanınır', () => {
  for (const a of ['127.0.0.1', '::1', '::ffff:127.0.0.1', 'localhost', '127.0.0.1 ']) {
    assert.equal(isLoopback(a), true, a);
  }
  for (const a of ['10.0.0.5', '192.168.1.20', '::ffff:10.0.0.5', '', null, undefined]) {
    assert.equal(isLoopback(a), false, String(a));
  }
});

test('yerel vekilden gelen https başlığı kabul edilir', () => {
  assert.equal(isHttpsRequest({ remoteAddress: '127.0.0.1', headers: https }), true);
  assert.equal(isHttpsRequest({ remoteAddress: '::1', headers: https }), true);
});

test('uzak istemci başlık taklit ederek Secure çerez yazdıramaz', () => {
  assert.equal(isHttpsRequest({ remoteAddress: '203.0.113.7', headers: https }), false);
  // açıkça izin verilirse (uzak ters vekil) kabul edilir
  assert.equal(isHttpsRequest({ remoteAddress: '203.0.113.7', headers: https, trustProxy: true }), true);
});

test('doğrudan TLS her zaman https sayılır', () => {
  assert.equal(isHttpsRequest({ remoteAddress: '203.0.113.7', encrypted: true }), true);
  assert.equal(isHttpsRequest({ remoteAddress: '203.0.113.7', encrypted: true, headers: http }), true);
});

test('başlık yoksa veya http ise Secure çerez yazılmaz', () => {
  assert.equal(isHttpsRequest({ remoteAddress: '127.0.0.1' }), false);
  assert.equal(isHttpsRequest({ remoteAddress: '127.0.0.1', headers: http }), false);
  assert.equal(isHttpsRequest({ remoteAddress: '127.0.0.1', headers: { 'x-forwarded-proto': 'HTTP' } }), false);
});

test('çoklu ve dizi biçimli başlıklar ilk değere göre okunur', () => {
  assert.equal(isHttpsRequest({ remoteAddress: '127.0.0.1', headers: { 'x-forwarded-proto': 'https, http' } }), true);
  assert.equal(isHttpsRequest({ remoteAddress: '127.0.0.1', headers: { 'x-forwarded-proto': 'http, https' } }), false);
  assert.equal(isHttpsRequest({ remoteAddress: '127.0.0.1', headers: { 'x-forwarded-proto': ['https'] } }), true);
  assert.equal(isHttpsRequest({ remoteAddress: '127.0.0.1', headers: { 'x-forwarded-proto': 'HTTPS' } }), true);
});

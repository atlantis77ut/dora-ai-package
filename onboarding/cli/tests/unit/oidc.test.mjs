import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { verifyIdToken, makeState, verifyState, buildAuthUrl, jwkToKey } from '../../src/orl/oidc.mjs';

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1' };
const jwks = { keys: [jwk] };

function signIdToken(claims, { alg = 'RS256', kid = 'k1' } = {}) {
  const header = Buffer.from(JSON.stringify({ alg, kid, typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const sig = crypto.sign('RSA-SHA256', Buffer.from(`${header}.${body}`), privateKey).toString('base64url');
  return `${header}.${body}.${sig}`;
}

const baseClaims = {
  iss: 'https://idp.ornek.local',
  aud: 'dora-app',
  sub: 'kullanici-1',
  email: 'ayse@ornek.local',
  exp: Math.floor(Date.now() / 1000) + 300,
  nonce: 'n-1',
};

test('oidc: geçerli id_token doğrulanır', () => {
  const t = signIdToken({ ...baseClaims });
  const v = verifyIdToken(t, jwks, { issuer: 'https://idp.ornek.local', clientId: 'dora-app', nonce: 'n-1' });
  assert.equal(v.valid, true);
  assert.equal(v.claims.email, 'ayse@ornek.local');
});

test('oidc: yanlış audience reddedilir', () => {
  const t = signIdToken({ ...baseClaims, aud: 'baska-app' });
  const v = verifyIdToken(t, jwks, { clientId: 'dora-app' });
  assert.equal(v.valid, false);
  assert.equal(v.reason, 'audience');
});

test('oidc: yanlış issuer reddedilir', () => {
  const t = signIdToken({ ...baseClaims, iss: 'https://kotu.local' });
  assert.equal(verifyIdToken(t, jwks, { issuer: 'https://idp.ornek.local' }).reason, 'issuer');
});

test('oidc: süresi dolmuş token reddedilir', () => {
  const t = signIdToken({ ...baseClaims, exp: Math.floor(Date.now() / 1000) - 10 });
  assert.equal(verifyIdToken(t, jwks).reason, 'suresi_dolmus');
});

test('oidc: nonce uyuşmazlığı reddedilir', () => {
  const t = signIdToken({ ...baseClaims, nonce: 'baska' });
  assert.equal(verifyIdToken(t, jwks, { nonce: 'n-1' }).reason, 'nonce');
});

test('oidc: kurcalanmış imza reddedilir', () => {
  const t = signIdToken({ ...baseClaims });
  const bad = t.slice(0, -4) + 'AAAA';
  assert.equal(verifyIdToken(bad, jwks).valid, false);
});

test('oidc: state imzalanır ve süre kontrol edilir', () => {
  const { state, nonce } = makeState('gizli');
  const p = verifyState('gizli', state);
  assert.equal(p.nonce, nonce);
  assert.equal(verifyState('baska-gizli', state), null);
  const old = makeState('gizli', -1000);
  assert.equal(verifyState('gizli', old.state), null);
});

test('oidc: yetkilendirme URL\'i doğru parametreleri taşır', () => {
  const url = buildAuthUrl(
    { client_id: 'cid', redirect_uri: 'https://app.local/cb', scopes: 'openid email' },
    { state: 's1', nonce: 'n1', discovery: { authorization_endpoint: 'https://idp.local/auth' } },
  );
  const u = new URL(url);
  assert.equal(u.searchParams.get('client_id'), 'cid');
  assert.equal(u.searchParams.get('response_type'), 'code');
  assert.equal(u.searchParams.get('nonce'), 'n1');
  assert.equal(u.searchParams.get('state'), 's1');
  assert.equal(u.searchParams.get('redirect_uri'), 'https://app.local/cb');
});

test('oidc: JWK → KeyObject dönüşümü', () => {
  const key = jwkToKey(jwk);
  assert.equal(key.asymmetricKeyType, 'rsa');
});

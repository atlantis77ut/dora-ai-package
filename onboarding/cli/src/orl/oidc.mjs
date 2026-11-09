// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 ustauretim
//
// OIDC (OpenID Connect) — yetkilendirme kodu akışı, bağımlılıksız.
// Keşif belgesi, JWKS ile imza doğrulama (RS256), iss/aud/exp/nonce kontrolleri.

import crypto from 'node:crypto';

/** Keşif belgesini okur (issuer + /.well-known/openid-configuration). */
export async function discover(issuer, fetchImpl = fetch) {
  const url = String(issuer).replace(/\/+$/, '') + '/.well-known/openid-configuration';
  const r = await fetchImpl(url, { headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(`keşif belgesi alınamadı: HTTP ${r.status}`);
  const doc = await r.json();
  for (const k of ['authorization_endpoint', 'token_endpoint', 'jwks_uri']) {
    if (!doc[k]) throw new Error(`keşif belgesinde ${k} yok`);
  }
  return doc;
}

export function buildAuthUrl(cfg, { state, nonce, discovery }) {
  const base = discovery?.authorization_endpoint ?? String(cfg.authorization_endpoint ?? '');
  if (!base) throw new Error('authorization_endpoint yok');
  const u = new URL(base);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('client_id', cfg.client_id);
  u.searchParams.set('redirect_uri', cfg.redirect_uri);
  u.searchParams.set('scope', cfg.scopes ?? 'openid email profile');
  u.searchParams.set('state', state);
  u.searchParams.set('nonce', nonce);
  return u.toString();
}

export async function exchangeCode(cfg, code, fetchImpl = fetch) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: cfg.redirect_uri,
    client_id: cfg.client_id,
    client_secret: cfg.client_secret,
  });
  const r = await fetchImpl(cfg.token_endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body,
  });
  if (!r.ok) throw new Error(`token ucu hatası: HTTP ${r.status}`);
  const tok = await r.json();
  if (!tok.id_token) throw new Error('yanıtta id_token yok');
  return tok;
}

export async function fetchJwks(cfg, fetchImpl = fetch) {
  const r = await fetchImpl(cfg.jwks_uri, { headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(`JWKS alınamadı: HTTP ${r.status}`);
  return r.json();
}

function decodeSegment(seg) {
  return JSON.parse(Buffer.from(seg, 'base64url').toString('utf8'));
}

/** JWK (RSA/EC) → Node KeyObject. */
export function jwkToKey(jwk) {
  if (jwk.kty === 'RSA') return crypto.createPublicKey({ key: { kty: 'RSA', n: jwk.n, e: jwk.e }, format: 'jwk' });
  if (jwk.kty === 'EC') return crypto.createPublicKey({ key: { kty: 'EC', crv: jwk.crv, x: jwk.x, y: jwk.y }, format: 'jwk' });
  throw new Error('desteklenmeyen anahtar türü: ' + jwk.kty);
}

/**
 * id_token doğrular. Dönen: { valid, claims } veya { valid:false, reason }.
 * Şu kontroller: imza (JWKS), iss, aud, exp, nonce.
 */
export function verifyIdToken(idToken, jwks, { issuer, clientId, nonce, now = Date.now() } = {}) {
  const parts = String(idToken ?? '').split('.');
  if (parts.length !== 3) return { valid: false, reason: 'bicim' };
  let header;
  let claims;
  try {
    header = decodeSegment(parts[0]);
    claims = decodeSegment(parts[1]);
  } catch {
    return { valid: false, reason: 'bicim' };
  }
  if (header.alg !== 'RS256' && header.alg !== 'ES256') return { valid: false, reason: 'algoritma' };

  const keys = jwks?.keys ?? [];
  const jwk = keys.find((k) => !header.kid || k.kid === header.kid) ?? keys[0];
  if (!jwk) return { valid: false, reason: 'anahtar_yok', claims };

  let ok = false;
  try {
    const key = jwkToKey(jwk);
    const alg = header.alg === 'ES256' ? 'sha256' : 'RSA-SHA256';
    ok = crypto.verify(alg, Buffer.from(parts[0] + '.' + parts[1]), key, Buffer.from(parts[2], 'base64url'));
  } catch {
    ok = false;
  }
  if (!ok) return { valid: false, reason: 'imza', claims };

  if (issuer && claims.iss !== String(issuer).replace(/\/+$/, '') && claims.iss !== issuer) {
    return { valid: false, reason: 'issuer', claims };
  }
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (clientId && !aud.includes(clientId)) return { valid: false, reason: 'audience', claims };
  if (!claims.exp || claims.exp * 1000 < now) return { valid: false, reason: 'suresi_dolmus', claims };
  if (nonce && claims.nonce && claims.nonce !== nonce) return { valid: false, reason: 'nonce', claims };

  return { valid: true, claims };
}

export function makeState(secret, ttlMs = 10 * 60 * 1000) {
  const payload = { nonce: crypto.randomBytes(16).toString('base64url'), exp: Date.now() + ttlMs };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return { state: `${body}.${sig}`, nonce: payload.nonce };
}

export function verifyState(secret, state) {
  const [body, sig] = String(state ?? '').split('.');
  if (!body || !sig) return null;
  const expect = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  if (sig.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (p.exp < Date.now()) return null;
    return p;
  } catch {
    return null;
  }
}

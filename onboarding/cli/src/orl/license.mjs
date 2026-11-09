// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 ustauretim
//
// Lisans anahtarı: imzalı, çevrimdışı doğrulanabilir token.
//
// Biçim:  DORA-LIC-v1.<base64url(payload)>.<base64url(imza)>
// İmza :  Ed25519, "DORA-LIC-v1.<payload>" metni üzerinde.
// Anahtar: yalnızca AÇIK anahtar depoda (onboarding/license/public-key.pem);
//          özel anahtar satıcıda kalır. Doğrulama internet gerektirmez.
//
// Not: kod AGPL olduğu için bu bir DRM değildir — denetlenebilir bir uyum kapısıdır.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const TOKEN_PREFIX = 'DORA-LIC-v1';
export const DEFAULT_PUBLIC_KEY = path.resolve(HERE, '../../../license/public-key.pem');

export function b64url(buf) {
  return Buffer.from(buf).toString('base64url');
}

export function sign(payload, privateKeyPem) {
  const body = TOKEN_PREFIX + '.' + b64url(JSON.stringify(payload));
  const key = crypto.createPrivateKey(privateKeyPem);
  const sig = crypto.sign(null, Buffer.from(body), key);
  return body + '.' + b64url(sig);
}

export function loadPublicKey(file = DEFAULT_PUBLIC_KEY) {
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, 'utf8');
}

/**
 * Token'ı doğrular. Dönüş: { valid, reason, claims }
 * reason: yok | bicim | imza | suresi_dolmus | gecersiz_tarih
 */
export function verify(token, publicKeyPem, now = new Date()) {
  if (!token || typeof token !== 'string') return { valid: false, reason: 'yok' };
  const parts = token.trim().split('.');
  if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX) return { valid: false, reason: 'bicim' };

  let claims;
  try {
    claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    return { valid: false, reason: 'bicim' };
  }

  if (!publicKeyPem) return { valid: false, reason: 'anahtar_yok', claims };

  let ok = false;
  try {
    ok = crypto.verify(
      null,
      Buffer.from(`${parts[0]}.${parts[1]}`),
      crypto.createPublicKey(publicKeyPem),
      Buffer.from(parts[2], 'base64url'),
    );
  } catch {
    ok = false;
  }
  if (!ok) return { valid: false, reason: 'imza', claims };

  if (!claims.expires_at) return { valid: false, reason: 'gecersiz_tarih', claims };
  const exp = new Date(claims.expires_at);
  if (Number.isNaN(exp.getTime())) return { valid: false, reason: 'gecersiz_tarih', claims };
  if (exp.getTime() < now.getTime()) return { valid: false, reason: 'suresi_dolmus', claims };

  return { valid: true, reason: 'yok', claims };
}

/** Lisans, oturumun tier'ı ve fazı için yeterli mi? */
export function entitlement(claims, { tier, phase }) {
  if (!claims) return { ok: false, reason: 'lisans yok' };

  const tierOk =
    claims.tier === tier ||
    claims.tier === 'enterprise' ||
    (Array.isArray(claims.tiers) && claims.tiers.includes(tier));
  if (!tierOk) return { ok: false, reason: `lisans tier=${claims.tier}, kurum tier=${tier}` };

  if (phase) {
    const phases = claims.phases ?? [];
    if (!phases.includes(phase)) return { ok: false, reason: `${phase} bu lisansta yok` };
  }
  return { ok: true, reason: 'ok' };
}

/** Oturumdaki lisans kaydını özetler (status çıktısı için). */
export function describe(lic) {
  if (!lic) return 'yok';
  if (lic.mode === 'trial') return `deneme (bitiş ${String(lic.expires_at).slice(0, 10)})`;
  const c = lic.claims ?? lic;
  const who = c.licensee ?? 'lisanslı kurum';
  const tier = c.tier ?? '?';
  const exp = String(c.expires_at ?? '').slice(0, 10);
  return `${tier} · ${who} · bitiş ${exp}`;
}

export const REASON_TEXT = {
  yok: 'lisans anahtarı verilmedi',
  bicim: 'anahtar biçimi geçersiz (DORA-LIC-v1.<payload>.<imza> bekleniyor)',
  imza: 'imza doğrulanamadı — anahtar bozulmuş veya sahte',
  suresi_dolmus: 'lisans süresi dolmuş',
  gecersiz_tarih: 'lisans bitiş tarihi okunamadı',
  anahtar_yok: 'açık anahtar bulunamadı (onboarding/license/public-key.pem)',
};

// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 ustauretim
//
// Ters vekil farkındalığı — saf işlevler (ağ yok, test edilebilir).
//
// Neden ayrı modül: `server.mjs` içe aktarıldığında dinlemeye başlar; bu mantığı
// HTTP olmadan test edebilmek için saf işlev olarak tutuluyor.

/** Yerel (loopback) adres mi? IPv4, IPv6 ve IPv4-eşlemeli biçimler. */
export function isLoopback(addr) {
  const a = String(addr ?? '').trim().toLowerCase();
  return a === '127.0.0.1' || a === '::1' || a === '::ffff:127.0.0.1' || a === 'localhost';
}

/**
 * İstek HTTPS üzerinden mi geldi?
 *
 * - Doğrudan TLS varsa (socket.encrypted) evet.
 * - Aksi hâlde `X-Forwarded-Proto` yalnız güvenilir vekilde dikkate alınır:
 *   istek loopback'ten geliyorsa ya da `trustProxy` açıkça verilmişse.
 *   Böylece uzak bir istemci başlığı taklit ederek Secure çerez yazdıramaz
 *   (tarayıcı Secure çerezi HTTP'de saklamaz → giriş döngüsü) ya da HSTS'i
 *   kandıramaz.
 *
 * Çoklu değer (`https, http`) ilk öğe üzerinden okunur.
 */
export function isHttpsRequest({ remoteAddress, encrypted = false, headers = {}, trustProxy = false } = {}) {
  if (encrypted) return true;
  if (!trustProxy && !isLoopback(remoteAddress)) return false;
  const raw = headers['x-forwarded-proto'];
  const first = String(Array.isArray(raw) ? raw[0] : (raw ?? ''))
    .split(',')[0]
    .trim()
    .toLowerCase();
  return first === 'https';
}

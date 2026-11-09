// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 ustauretim
//
// Tek kullanımlık parola sıfırlama bağlantıları.
// Token tarayıcıya düz gider, diskte yalnız sha256 özeti tutulur; 30 dakika geçerli,
// tek kullanımlık. Parola sıfırlandığında kullanıcının tüm oturumları düşer (pv).

import crypto from 'node:crypto';

const TTL_MS = 30 * 60 * 1000;

export function createResetStore(file, { readJson, writeJson }) {
  function all() {
    return readJson(file, { tokens: [] });
  }

  function save(data) {
    writeJson(file, data);
  }

  function purge(data) {
    const now = Date.now();
    data.tokens = (data.tokens ?? []).filter((t) => !t.used && t.exp > now);
    return data;
  }

  /** Yeni bağlantı üretir; düz token yalnız bir kez döner. */
  function issue(userId) {
    const data = purge(all());
    const token = crypto.randomBytes(32).toString('base64url');
    const record = {
      hash: crypto.createHash('sha256').update(token).digest('hex'),
      uid: userId,
      exp: Date.now() + TTL_MS,
      used: false,
      created_at: new Date().toISOString(),
    };
    data.tokens = [...(data.tokens ?? []), record].slice(-50);
    save(data);
    return { token, expires_at: new Date(record.exp).toISOString() };
  }

  /** Token'ı doğrular; geçerliyse kaydı tüketir ve kullanıcı id'sini döner. */
  function consume(token) {
    const hash = crypto.createHash('sha256').update(String(token ?? '')).digest('hex');
    const data = purge(all());
    const rec = (data.tokens ?? []).find((t) => t.hash === hash && !t.used && t.exp > Date.now());
    if (!rec) {
      save(data);
      return { ok: false, error: 'bağlantı geçersiz veya süresi dolmuş' };
    }
    rec.used = true;
    rec.used_at = new Date().toISOString();
    save(data);
    return { ok: true, uid: rec.uid };
  }

  return { issue, consume, ttl_ms: TTL_MS };
}

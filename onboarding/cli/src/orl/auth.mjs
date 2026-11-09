// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 ustauretim
//
// Kimlik doğrulama ve yetkilendirme.
// - Parola: scrypt (node:crypto), kullanıcı başına rastgele tuz
// - Oturum: HMAC ile imzalı çerez (durumsuz), 8 saat
// - Roller: admin (teknik her şey) · user (iş arayüzü, teknik detay yok)
// - İlk kurulum: kullanıcı yoksa /api/auth/bootstrap ile yönetici oluşturulur

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { verifyTotp, hashCode } from './totp.mjs';

const SCRYPT = { N: 16384, r: 8, p: 1 };
const SESSION_TTL_S = 8 * 3600;
export const COOKIE = 'dora_session';

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, 32, SCRYPT).toString('hex');
  return { salt, hash };
}

export function verifyPassword(password, salt, hash) {
  try {
    const h = crypto.scryptSync(String(password), salt, 32, SCRYPT);
    return crypto.timingSafeEqual(h, Buffer.from(hash, 'hex'));
  } catch {
    return false;
  }
}

export function createAuthStore(dataDir) {
  const USERS = path.join(dataDir, 'users.json');
  const SECRET = path.join(dataDir, 'secret.key');
  const AUDIT = path.join(dataDir, 'audit.log');

  fs.mkdirSync(dataDir, { recursive: true });

  function secret() {
    if (!fs.existsSync(SECRET)) {
      fs.writeFileSync(SECRET, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
    }
    return fs.readFileSync(SECRET, 'utf8').trim();
  }

  function users() {
    try {
      return JSON.parse(fs.readFileSync(USERS, 'utf8'));
    } catch {
      return [];
    }
  }

  function saveUsers(list) {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(USERS, JSON.stringify(list, null, 2) + '\n', { mode: 0o600 });
  }

  function publicUser(u) {
    return {
      id: u.id,
      username: u.username,
      name: u.name,
      role: u.role,
      created_at: u.created_at,
      last_login: u.last_login ?? null,
      totp_enabled: Boolean(u.totp_enabled),
    };
  }

  function audit(user, action, target = '') {
    const line = `${new Date().toISOString()}\t${user ?? '-'}\t${action}\t${target}\n`;
    try {
      fs.mkdirSync(dataDir, { recursive: true });
      fs.appendFileSync(AUDIT, line, { mode: 0o600 });
    } catch {
      /* denetim yazılamazsa akış durmasın */
    }
  }

  function sign(payload) {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
    return `${body}.${sig}`;
  }

  function verify(token) {
    if (!token || typeof token !== 'string' || !token.includes('.')) return null;
    const [body, sig] = token.split('.');
    const expect = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
    if (sig.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
    try {
      const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
      if (!p.exp || p.exp < Date.now()) return null;
      const u = users().find((x) => x.id === p.uid);
      if (!u) return null;
      // parola değiştiyse eski oturum geçersiz
      if (p.pv !== u.hash.slice(0, 8)) return null;
      return { ...p, user: publicUser(u) };
    } catch {
      return null;
    }
  }

  function login(username, password, hours = 8) {
    const list = users();
    const u = list.find((x) => x.username.toLowerCase() === String(username ?? '').toLowerCase());
    if (!u) return { ok: false, error: 'kullanıcı adı veya parola hatalı' };
    if (!verifyPassword(password, u.salt, u.hash)) return { ok: false, error: 'kullanıcı adı veya parola hatalı' };
    if (u.totp_enabled) {
      const challenge = sign({ uid: u.id, stage: 'otp', exp: Date.now() + 5 * 60 * 1000 });
      return { ok: true, otpRequired: true, challenge, user: publicUser(u) };
    }
    u.last_login = new Date().toISOString();
    saveUsers(list);
    const ttl = Math.max(1, Math.min(168, Number(hours) || 8)) * 3600 * 1000;
    const token = sign({ uid: u.id, role: u.role, pv: u.hash.slice(0, 8), exp: Date.now() + ttl });
    audit(u.username, 'login');
    return { ok: true, token, user: publicUser(u) };
  }

  function bootstrap({ username, password, name }) {
    if (users().length) return { ok: false, error: 'kurulum zaten yapılmış' };
    if (!username || String(password ?? '').length < 8) {
      return { ok: false, error: 'kullanıcı adı ve en az 8 karakterli parola gerekli' };
    }
    const { salt, hash } = hashPassword(password);
    const u = {
      id: 'usr-' + crypto.randomBytes(4).toString('hex'),
      username: String(username).trim().slice(0, 40),
      name: String(name ?? username).trim().slice(0, 80),
      role: 'admin',
      salt,
      hash,
      created_at: new Date().toISOString(),
      last_login: null,
    };
    saveUsers([u]);
    audit(u.username, 'bootstrap', 'ilk yönetici');
    const token = sign({ uid: u.id, role: 'admin', pv: u.hash.slice(0, 8), exp: Date.now() + SESSION_TTL_S * 1000 });
    return { ok: true, token, user: publicUser(u) };
  }

  function refresh(user, hours = 8) {
    const list = users();
    const u = list.find((x) => x.id === user.id);
    if (!u) return null;
    const ttl = Math.max(1, Math.min(168, Number(hours) || 8)) * 3600 * 1000;
    return sign({ uid: u.id, role: u.role, pv: u.hash.slice(0, 8), exp: Date.now() + ttl });
  }

  /** Bekleyen TOTP sırrını yazar (henüz etkin değil). */
  function setPendingTotp(uid, secret) {
    const list = users();
    const u = list.find((x) => x.id === uid);
    if (!u) return { ok: false, error: 'kullanıcı yok' };
    u.totp_pending = secret;
    saveUsers(list);
    return { ok: true };
  }

  /** Kodu doğrulayıp TOTP'yi etkinleştirir; kurtarma kodlarının özetlerini saklar. */
  function enableTotp(uid, code, codes) {
    const list = users();
    const u = list.find((x) => x.id === uid);
    if (!u || !u.totp_pending) return { ok: false, error: 'kurulum başlatılmamış' };
    if (!verifyTotp(u.totp_pending, code)) return { ok: false, error: 'kod doğrulanamadı' };
    u.totp_secret = u.totp_pending;
    delete u.totp_pending;
    u.totp_enabled = true;
    u.recovery_hashes = (codes ?? []).map((c) => hashCode(c));
    saveUsers(list);
    audit(u.username, 'totp_enabled');
    return { ok: true, user: publicUser(u) };
  }

  function disableTotp(uid) {
    const list = users();
    const u = list.find((x) => x.id === uid);
    if (!u) return { ok: false, error: 'kullanıcı yok' };
    delete u.totp_secret;
    delete u.totp_pending;
    u.totp_enabled = false;
    u.recovery_hashes = [];
    saveUsers(list);
    audit(u.username, 'totp_disabled');
    return { ok: true, user: publicUser(u) };
  }

  /** İki adımlı girişin ikinci aşaması: TOTP veya kurtarma kodu. */
  function verifyOtp(challengeToken, code, hours = 8) {
    let payload;
    try {
      const [body, sig] = challengeToken.split('.');
      if (!body || !sig) return { ok: false, error: 'geçersiz meydan okuma' };
      const expect = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
      if (sig.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) {
        return { ok: false, error: 'geçersiz meydan okuma' };
      }
      payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    } catch {
      return { ok: false, error: 'geçersiz meydan okuma' };
    }
    if (payload.stage !== 'otp' || payload.exp < Date.now()) return { ok: false, error: 'süre doldu, tekrar giriş yapın' };

    const list = users();
    const u = list.find((x) => x.id === payload.uid);
    if (!u || !u.totp_enabled) return { ok: false, error: 'kullanıcı yok' };

    const clean = String(code ?? '').trim().toUpperCase();
    const recoveryIdx = (u.recovery_hashes ?? []).indexOf(hashCode(clean));
    const okCode = verifyTotp(u.totp_secret, clean) || recoveryIdx >= 0;
    if (!okCode) {
      audit(u.username, 'otp_failed');
      return { ok: false, error: 'kod hatalı' };
    }
    if (recoveryIdx >= 0) {
      u.recovery_hashes.splice(recoveryIdx, 1);
      audit(u.username, 'recovery_code_used');
    }

    u.last_login = new Date().toISOString();
    saveUsers(list);
    const ttl = Math.max(1, Math.min(168, Number(hours) || 8)) * 3600 * 1000;
    const token = sign({ uid: u.id, role: u.role, pv: u.hash.slice(0, 8), exp: Date.now() + ttl });
    audit(u.username, 'login');
    return { ok: true, token, user: publicUser(u) };
  }

  function createUser({ username, password, name, role }) {
    if (!username || String(password ?? '').length < 8) return { ok: false, error: 'kullanıcı adı ve en az 8 karakterli parola gerekli' };
    if (!['admin', 'user'].includes(role)) return { ok: false, error: 'rol admin veya user olmalı' };
    const list = users();
    if (list.some((x) => x.username.toLowerCase() === String(username).toLowerCase())) {
      return { ok: false, error: 'bu kullanıcı adı zaten var' };
    }
    const { salt, hash } = hashPassword(password);
    const u = {
      id: 'usr-' + crypto.randomBytes(4).toString('hex'),
      username: String(username).trim().slice(0, 40),
      name: String(name ?? username).trim().slice(0, 80),
      role,
      salt,
      hash,
      created_at: new Date().toISOString(),
      last_login: null,
    };
    list.push(u);
    saveUsers(list);
    return { ok: true, user: publicUser(u) };
  }

  function updateUser(id, patch) {
    const list = users();
    const u = list.find((x) => x.id === id);
    if (!u) return { ok: false, error: 'kullanıcı yok' };
    if (patch.role && ['admin', 'user'].includes(patch.role)) u.role = patch.role;
    if (patch.name) u.name = String(patch.name).slice(0, 80);
    if (patch.password) {
      if (String(patch.password).length < 8) return { ok: false, error: 'parola en az 8 karakter' };
      const { salt, hash } = hashPassword(patch.password);
      u.salt = salt;
      u.hash = hash;
    }
    saveUsers(list);
    return { ok: true, user: publicUser(u) };
  }

  function removeUser(id) {
    const list = users();
    const u = list.find((x) => x.id === id);
    if (!u) return { ok: false, error: 'kullanıcı yok' };
    const admins = list.filter((x) => x.role === 'admin');
    if (u.role === 'admin' && admins.length === 1) return { ok: false, error: 'son yönetici silinemez' };
    saveUsers(list.filter((x) => x.id !== id));
    return { ok: true };
  }

  function listAudit(limit = 100) {
    try {
      const lines = fs.readFileSync(AUDIT, 'utf8').trim().split('\n').filter(Boolean);
      return lines.slice(-limit).reverse().map((l) => {
        const [at, user, action, target] = l.split('\t');
        return { at, user, action, target };
      });
    } catch {
      return [];
    }
  }

  return {
    users: () => users().map(publicUser),
    hasUsers: () => users().length > 0,
    login,
    bootstrap,
    createUser,
    updateUser,
    removeUser,
    verify,
    refresh,
    setPendingTotp,
    enableTotp,
    disableTotp,
    verifyOtp,
    audit,
    listAudit,
  };
}

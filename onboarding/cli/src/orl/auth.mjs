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
    fs.writeFileSync(USERS, JSON.stringify(list, null, 2) + '\n', { mode: 0o600 });
  }

  function publicUser(u) {
    return { id: u.id, username: u.username, name: u.name, role: u.role, created_at: u.created_at, last_login: u.last_login ?? null };
  }

  function audit(user, action, target = '') {
    const line = `${new Date().toISOString()}\t${user ?? '-'}\t${action}\t${target}\n`;
    fs.appendFileSync(AUDIT, line);
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
      return { ...p, user: publicUser(u) };
    } catch {
      return null;
    }
  }

  function login(username, password) {
    const list = users();
    const u = list.find((x) => x.username.toLowerCase() === String(username ?? '').toLowerCase());
    if (!u) return { ok: false, error: 'kullanıcı adı veya parola hatalı' };
    if (!verifyPassword(password, u.salt, u.hash)) return { ok: false, error: 'kullanıcı adı veya parola hatalı' };
    u.last_login = new Date().toISOString();
    saveUsers(list);
    const token = sign({ uid: u.id, role: u.role, exp: Date.now() + SESSION_TTL_S * 1000 });
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
    const token = sign({ uid: u.id, role: 'admin', exp: Date.now() + SESSION_TTL_S * 1000 });
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
    audit,
    listAudit,
  };
}

// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 ustauretim
//
// Bağımlılıksız SMTP istemcisi + giden kutusu (outbox).
// Desteklenen: düz SMTP, STARTTLS, örtük TLS (465), AUTH PLAIN / LOGIN.
// Gönderilemeyen iletiler outbox'ta tutulur; SMTP yapılandırılınca elle veya otomatik gönderilir.

import net from 'node:net';
import tls from 'node:tls';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const MAX_REPLY = 64 * 1024;

/** SMTP oturumu: satır bazlı yanıt okuyucu. */
class Session {
  constructor(socket) {
    this.socket = socket;
    this.buf = '';
    this.waiters = [];
    socket.setEncoding('utf8');
    socket.on('data', (chunk) => {
      this.buf += chunk;
      if (this.buf.length > MAX_REPLY) this.buf = this.buf.slice(-MAX_REPLY);
      this.flush();
    });
    socket.on('error', (e) => this.fail(e));
    socket.on('close', () => this.fail(new Error('bağlantı kapandı')));
  }

  fail(err) {
    for (const w of this.waiters.splice(0)) w.reject(err);
  }

  flush() {
    while (this.waiters.length) {
      const idx = this.buf.indexOf('\n');
      if (idx < 0) return;
      const line = this.buf.slice(0, idx).replace(/\r$/, '');
      this.buf = this.buf.slice(idx + 1);
      this.waiters.shift().resolve(line);
    }
  }

  readLine(timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('SMTP zaman aşımı')), timeoutMs);
      this.waiters.push({
        resolve: (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      });
      this.flush();
    });
  }

  write(line) {
    this.socket.write(line + '\r\n');
  }

  /** Çok satırlı yanıtı ("250-..." ardından "250 ...") okur. */
  async reply(timeoutMs) {
    const lines = [];
    for (;;) {
      const line = await this.readLine(timeoutMs);
      lines.push(line);
      if (!/^\d{3}-/.test(line)) break;
    }
    const code = Number(lines[lines.length - 1].slice(0, 3));
    return { code, lines, text: lines.join('\n') };
  }
}

function openSocket(cfg) {
  const port = Number(cfg.port) || (cfg.secure ? 465 : 587);
  if (cfg.secure) {
    return tls.connect({ host: cfg.host, port, servername: cfg.host, rejectUnauthorized: cfg.allowSelfSigned ? false : true });
  }
  return net.connect({ host: cfg.host, port });
}

function b64(s) {
  return Buffer.from(String(s), 'utf8').toString('base64');
}

/** Bir e-posta gönderir. Başarısızsa hata fırlatır (çağıran kuyruğa alabilir). */
export async function sendMail(cfg, msg, { timeoutMs = 15000 } = {}) {
  if (!cfg?.host) throw new Error('SMTP sunucusu tanımlı değil');
  const from = msg.from || cfg.from;
  if (!from) throw new Error('gönderen adresi tanımlı değil');
  if (!msg.to) throw new Error('alıcı adresi yok');

  const socket = openSocket(cfg);
  const session = new Session(socket);
  socket.on('error', () => {});

  try {
    let r = await session.reply(timeoutMs);
    if (r.code !== 220) throw new Error('SMTP karşılama hatası: ' + r.text);

    session.write('EHLO dora.local');
    r = await session.reply(timeoutMs);
    if (r.code !== 250) throw new Error('EHLO hatası: ' + r.text);
    const caps = r.text.toUpperCase();

    if (!cfg.secure && /STARTTLS/.test(caps)) {
      session.write('STARTTLS');
      r = await session.reply(timeoutMs);
      if (r.code !== 220) throw new Error('STARTTLS reddedildi: ' + r.text);
      const secured = tls.connect({ socket, servername: cfg.host, rejectUnauthorized: cfg.allowSelfSigned ? false : true });
      await new Promise((resolve, reject) => {
        secured.once('secureConnect', resolve);
        secured.once('error', reject);
      });
      session.socket = secured;
      session.buf = '';
      session.socket.setEncoding('utf8');
      session.socket.on('data', (chunk) => {
        session.buf += chunk;
        session.flush();
      });
      session.socket.on('error', (e) => session.fail(e));
      session.write('EHLO dora.local');
      r = await session.reply(timeoutMs);
      if (r.code !== 250) throw new Error('STARTTLS sonrası EHLO hatası: ' + r.text);
    }

    if (cfg.user) {
      const mech = /AUTH[^\n]*PLAIN/i.test(caps) ? 'PLAIN' : 'LOGIN';
      if (mech === 'PLAIN') {
        session.write('AUTH PLAIN ' + b64('\u0000' + cfg.user + '\u0000' + (cfg.pass ?? '')));
        r = await session.reply(timeoutMs);
      } else {
        session.write('AUTH LOGIN');
        r = await session.reply(timeoutMs);
        if (r.code !== 334) throw new Error('AUTH LOGIN reddedildi: ' + r.text);
        session.write(b64(cfg.user));
        r = await session.reply(timeoutMs);
        if (r.code !== 334) throw new Error('AUTH kullanıcı reddedildi: ' + r.text);
        session.write(b64(cfg.pass ?? ''));
        r = await session.reply(timeoutMs);
      }
      if (r.code !== 235) throw new Error('kimlik doğrulama başarısız: ' + r.text);
    }

    session.write(`MAIL FROM:<${from}>`);
    r = await session.reply(timeoutMs);
    if (r.code !== 250) throw new Error('MAIL FROM reddedildi: ' + r.text);

    session.write(`RCPT TO:<${msg.to}>`);
    r = await session.reply(timeoutMs);
    if (![250, 251].includes(r.code)) throw new Error('RCPT TO reddedildi: ' + r.text);

    session.write('DATA');
    r = await session.reply(timeoutMs);
    if (r.code !== 354) throw new Error('DATA reddedildi: ' + r.text);

    session.write(buildMessage({ ...msg, from }));
    session.write('.');
    r = await session.reply(timeoutMs);
    if (r.code !== 250) throw new Error('ileti kabul edilmedi: ' + r.text);

    session.write('QUIT');
    return { ok: true, response: r.text };
  } finally {
    try {
      socket.end();
      setTimeout(() => socket.destroy(), 500).unref?.();
    } catch {
      /* yok say */
    }
  }
}

/** RFC 5322 uyumlu, UTF-8 gövdeyi base64 taşıyan ileti. */
export function buildMessage({ from, to, subject, text, html }) {
  const domain = String(from).split('@')[1] || 'dora.local';
  const id = `<${crypto.randomBytes(12).toString('hex')}@${domain}>`;
  const body = html
    ? `Content-Type: text/html; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${wrap64(b64(html))}`
    : `Content-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${wrap64(b64(text ?? ''))}`;
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${b64(subject ?? '')}?=`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: ${id}`,
    'MIME-Version: 1.0',
  ].join('\r\n');
  // satır başındaki noktayı kaçır (SMTP transparency)
  const escaped = body.replace(/\r\n\./g, '\r\n..');
  return headers + '\r\n' + escaped + '\r\n';
}

function wrap64(s) {
  return s.replace(/(.{76})/g, '$1\r\n');
}

// ── giden kutusu ─────────────────────────────────────────
export function createOutbox(file) {
  function read() {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      return { messages: [] };
    }
  }
  function write(doc) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(doc, null, 2) + '\n', { mode: 0o600 });
  }

  function enqueue(msg) {
    const doc = read();
    const item = {
      id: 'msg-' + crypto.randomBytes(4).toString('hex'),
      to: msg.to,
      subject: msg.subject ?? '',
      text: msg.text ?? '',
      created_at: new Date().toISOString(),
      attempts: 0,
      last_error: null,
    };
    doc.messages = [...(doc.messages ?? []), item].slice(-200);
    write(doc);
    return item;
  }

  function list() {
    return read().messages ?? [];
  }

  function markFailed(id, error) {
    const doc = read();
    const m = (doc.messages ?? []).find((x) => x.id === id);
    if (m) {
      m.attempts = (m.attempts ?? 0) + 1;
      m.last_error = String(error).slice(0, 300);
      m.last_try = new Date().toISOString();
      write(doc);
    }
  }

  function remove(id) {
    const doc = read();
    doc.messages = (doc.messages ?? []).filter((x) => x.id !== id);
    write(doc);
  }

  function clear() {
    write({ messages: [] });
  }

  return { enqueue, list, markFailed, remove, clear };
}

import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sendMail, buildMessage, createOutbox } from '../../src/orl/mailer.mjs';

// ── yerel sahte SMTP ─────────────────────────────────────
function startSmtp({ requireAuth = false } = {}) {
  const received = [];
  const server = net.createServer((socket) => {
    let inData = false;
    let buffer = '';
    let current = '';
    socket.setEncoding('utf8');
    socket.write('220 test.local ESMTP\r\n');
    socket.on('data', (chunk) => {
      buffer += chunk;
      let idx;
      while ((idx = buffer.indexOf('\r\n')) >= 0) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        if (inData) {
          if (line === '.') {
            received.push(current);
            current = '';
            inData = false;
            socket.write('250 2.0.0 Ok: queued\r\n');
          } else {
            current += line.replace(/^\.\./, '.') + '\r\n';
          }
          continue;
        }
        const cmd = line.split(' ')[0].toUpperCase();
        if (cmd === 'EHLO' || cmd === 'HELO') socket.write('250-test.local\r\n250-AUTH PLAIN LOGIN\r\n250 OK\r\n');
        else if (cmd === 'AUTH') {
          if (requireAuth) {
            const parts = line.split(' ');
            if (parts[1] === 'LOGIN') socket.write('334 VXNlcm5hbWU6\r\n');
            else socket.write('235 2.7.0 Authentication successful\r\n');
          } else socket.write('235 2.7.0 Authentication successful\r\n');
        } else if (cmd === 'MAIL' || cmd === 'RCPT') socket.write('250 OK\r\n');
        else if (cmd === 'DATA') {
          inData = true;
          socket.write('354 End data with <CR><LF>.<CR><LF>\r\n');
        } else if (cmd === 'QUIT') {
          socket.write('221 Bye\r\n');
          socket.end();
        } else if (/^[A-Za-z0-9+/=]+$/.test(line)) socket.write('235 2.7.0 Authentication successful\r\n');
        else socket.write('250 OK\r\n');
      }
    });
    socket.on('error', () => {});
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port, received }));
  });
}

const cfgFor = (port, extra = {}) => ({ host: '127.0.0.1', port, secure: false, from: 'dora@ornek.local', ...extra });

test('posta: ileti başlıkları ve gövdesi kurulur', () => {
  const raw = buildMessage({ from: 'a@b.c', to: 'x@y.z', subject: 'Konu ğüş', text: 'Merhaba' });
  assert.match(raw, /From: a@b\.c/);
  assert.match(raw, /To: x@y\.z/);
  assert.match(raw, /Subject: =\?UTF-8\?B\?/);
  assert.match(raw, /MIME-Version: 1\.0/);
  assert.match(raw, /Content-Transfer-Encoding: base64/);
});

test('posta: düz SMTP ile gönderim', async () => {
  const { server, port, received } = await startSmtp();
  const r = await sendMail(cfgFor(port), { to: 'ayse@ornek.local', subject: 'Davet', text: 'Merhaba Ayşe' });
  assert.equal(r.ok, true);
  assert.equal(received.length, 1);
  assert.match(received[0], /To: ayse@ornek\.local/);
  const bodyB64 = received[0].split('\r\n\r\n')[1].split('\r\n')[0];
  assert.equal(Buffer.from(bodyB64, 'base64').toString('utf8'), 'Merhaba Ayşe');
  server.close();
});

test('posta: kimlik doğrulama (PLAIN) gönderilir', async () => {
  const { server, port, received } = await startSmtp({ requireAuth: true });
  const r = await sendMail(cfgFor(port, { user: 'kullanici', pass: 'gizli' }), { to: 'a@b.c', subject: 'S', text: 'T' });
  assert.equal(r.ok, true);
  assert.equal(received.length, 1);
  server.close();
});

test('posta: alıcı yoksa hata', async () => {
  await assert.rejects(() => sendMail({ host: '127.0.0.1', port: 1, from: 'a@b.c' }, { subject: 'x' }), /alıcı/);
});

test('posta: sunucu yoksa hata', async () => {
  await assert.rejects(
    () => sendMail({ host: '127.0.0.1', port: 1, from: 'a@b.c' }, { to: 'x@y.z', subject: 's', text: 't' }, { timeoutMs: 1500 }),
    /zaman aşımı|ECONNREFUSED|bağlantı/,
  );
});

test('posta: outbox kuyruğa alır ve hata kaydeder', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dora-mail-'));
  const box = createOutbox(path.join(dir, 'outbox.json'));
  const item = box.enqueue({ to: 'a@b.c', subject: 'Davet', text: 'link' });
  assert.equal(box.list().length, 1);
  assert.equal(item.attempts, 0);
  box.markFailed(item.id, 'SMTP kapalı');
  const after = box.list()[0];
  assert.equal(after.attempts, 1);
  assert.match(after.last_error, /SMTP kapalı/);
  box.remove(item.id);
  assert.equal(box.list().length, 0);
});

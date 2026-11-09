#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 ustauretim
//
// Bağımlılıksız statik sunucu: dashboard/ ve site/ çıktısını yayınlar.
// Üretimde nginx arkasına da konabilir; bu sunucu tek başına da yeterlidir.
//
// Kullanım:
//   node tools/serve.mjs [--port 8080] [--host 0.0.0.0]
//
// Uçlar:
//   /                     → yönlendirme sayfası (dashboard / site)
//   /dashboard/…          → dashboard (index.html, processes.html, controls.html, png)
//   /site/…               → landing + dashboard kopyası
//   /healthz              → {"ok":true,"version":"…"}

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');

const { values } = parseArgs({
  options: {
    port: { type: 'string', default: process.env.PORT ?? '8080' },
    host: { type: 'string', default: process.env.HOST ?? '0.0.0.0' },
  },
});

const PORT = Number(values.port);
const HOST = values.host;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8',
  '.yaml': 'text/yaml; charset=utf-8',
  '.yml': 'text/yaml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

const version = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, 'onboarding/cli/package.json'), 'utf8')).version;
  } catch {
    return '?';
  }
})();

function landing() {
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>DORA AI Ajan Paketi — ${version}</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b1020;color:#e8edf7;
       font:16px/1.6 "Segoe UI",system-ui,sans-serif}
  .card{max-width:640px;padding:40px;border:1px solid #24304d;border-radius:16px;background:#131a2e}
  h1{font-size:22px;margin:0 0 6px}
  p{color:#93a1c0;margin:0 0 22px}
  a{display:block;padding:14px 18px;margin:10px 0;border:1px solid #24304d;border-radius:12px;
    color:#e8edf7;text-decoration:none;background:#18213a}
  a:hover{border-color:#3b4d78}
  span{color:#60a5fa;font-family:ui-monospace,monospace;font-size:13px}
  footer{margin-top:22px;color:#6b7a9b;font-size:12.5px}
</style></head><body><div class="card">
  <h1>DORA AI Ajan Paketi</h1>
  <p>sürüm ${version} · statik yayın · dış bağımlılık yok</p>
  <a href="/dashboard/"><b>Dashboard</b><br><span>/dashboard/</span> — KPI, fazlar, süreçler, kontroller</a>
  <a href="/site/"><b>Landing sayfası</b><br><span>/site/</span> — tanıtım + dashboard kopyası</a>
  <a href="/healthz"><b>Sağlık kontrolü</b><br><span>/healthz</span> — JSON durum</a>
  <footer>Sunucu: node tools/serve.mjs · dosyalar depodan okunur, kopyalanmaz.</footer>
</div></body></html>`;
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Cache-Control': 'no-cache', ...headers });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const started = Date.now();
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, `http://${HOST}`).pathname);
  } catch {
    return send(res, 400, 'geçersiz istek');
  }

  if (urlPath === '/healthz') {
    return send(res, 200, JSON.stringify({ ok: true, version, uptime_s: Math.round(process.uptime()) }), {
      'Content-Type': 'application/json; charset=utf-8',
    });
  }

  if (urlPath === '/' || urlPath === '') {
    return send(res, 200, landing(), { 'Content-Type': 'text/html; charset=utf-8' });
  }

  // yol güvenliği: kök dışına çıkışı engelle
  const rel = urlPath.replace(/^\/+/, '');
  let file = path.resolve(ROOT, rel);
  if (!file.startsWith(ROOT)) return send(res, 403, 'yasak');

  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    file = path.join(file, 'index.html');
  }
  if (!fs.existsSync(file)) {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(`<h1>404</h1><p>${rel}</p><p><a href="/">ana sayfa</a></p>`);
  }

  const ext = path.extname(file).toLowerCase();
  const body = fs.readFileSync(file);
  const type = MIME[ext] ?? 'application/octet-stream';
  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': body.length,
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
  });
  res.end(body);
  if (process.env.LOG_REQUESTS === '1') {
    console.log(`${req.method} ${urlPath} ${res.statusCode} ${Date.now() - started}ms`);
  }
});

server.listen(PORT, HOST, () => {
  const shown = HOST === '0.0.0.0' ? '<sunucu-ip>' : HOST;
  console.log(`DORA AI Ajan Paketi ${version} — http://${shown}:${PORT}/`);
  console.log(`  dashboard : http://${shown}:${PORT}/dashboard/`);
  console.log(`  sağlık    : http://${shown}:${PORT}/healthz`);
  console.log(`  kök       : ${ROOT}`);
});

const shutdown = () => {
  console.log('\nkapatılıyor…');
  server.close(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

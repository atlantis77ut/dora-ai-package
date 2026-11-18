#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 ustauretim
//
// TLS + ters vekil kurulumu (Ubuntu/Debian, root).
//   sudo node scripts/install-tls.mjs --domain dora.ornek.local --email admin@ornek.local
//   sudo node scripts/install-tls.mjs --domain dora.ornek.local --self-signed   # Let's Encrypt yok
//   node scripts/install-tls.mjs --domain dora.ornek.local --dry-run            # yalnız plan
//
// Ne yapar (sırayla, her adım idempotent):
//   1. nginx + certbot paketleri (--no-apt ile atlanır)
//   2. ACME webroot dizini ve nginx ara yapılandırması (HTTP-only)
//   3. sertifika: Let's Encrypt (webroot) veya kendinden imzalı (--self-signed)
//   4. kalıcı TLS sitesi: 80 → 301, 443 → 127.0.0.1:PORT ters vekil
//   5. giriş uçları için IP başına hız sınırı
//   6. systemd drop-in: uygulama 127.0.0.1'e çekilir, --trust-proxy açılır
//   7. doğrulama: HTTP→HTTPS yönlendirmesi, /healthz, HSTS başlığı

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { renderAcmeSite, renderTlsSite, renderProxySnippet, renderDropin, renderRateLimit } from '../deploy/render.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const { values } = parseArgs({
  options: {
    domain: { type: 'string' },
    email: { type: 'string' },
    dir: { type: 'string', default: '/opt/dora-ai-package' },
    port: { type: 'string', default: '8080' },
    'self-signed': { type: 'boolean', default: false },
    'cert-dir': { type: 'string' },
    'acme-root': { type: 'string', default: '/var/www/certbot' },
    'no-apt': { type: 'boolean', default: false },
    ufw: { type: 'boolean', default: false },
    'skip-verify': { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
  },
});

const DRY = Boolean(values['dry-run']);
const DOMAIN = values.domain;
const PORT = Number(values.port);
// Linux yolları Windows'ta path.resolve ile bozulmasın
const TARGET_DIR = values.dir.startsWith('/') ? values.dir.replace(/\/+$/, '') : path.resolve(values.dir);

// ── komut çalıştırma ────────────────────────────────────────────────────
function exec(cmd, args, { quiet = false } = {}) {
  if (DRY) {
    console.log(`  $ ${cmd} ${args.join(' ')}`.trimEnd());
    return { status: 0, stdout: '', stderr: '' };
  }
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  if (r.status !== 0 && !quiet) {
    throw new Error(`${cmd} başarısız (çıkış ${r.status})\n${r.stdout ?? ''}${r.stderr ?? ''}`);
  }
  return r;
}

/** Adımlar sırayla çalışır: sertifika üretimi biter, sonra dosya kontrolü yapılır. */
const run = (cmd, args, opts) => exec(cmd, args, opts);

function writeFile(file, content, mode = 0o644) {
  if (DRY) {
    console.log(`  ~ yazılacak: ${file} (${content.length} bayt, ${mode.toString(8)})`);
    return;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, { mode });
  fs.chmodSync(file, mode);
}

function fail(msg) {
  console.error(`HATA: ${msg}`);
  process.exit(1);
}

function preflight() {
  if (!DOMAIN) fail('--domain zorunlu (örn. --domain dora.ornek.local)');
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(DOMAIN)) {
    fail(`geçersiz alan adı: ${DOMAIN}`);
  }
  if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) fail(`geçersiz port: ${values.port}`);
  if (!values['self-signed'] && !values['cert-dir'] && !values.email) {
    fail("Let's Encrypt için --email zorunlu (ya da --self-signed / --cert-dir)");
  }
  if (!DRY && process.getuid?.() !== 0) fail('root olarak çalıştırın (sudo node scripts/install-tls.mjs ...)');
  const server = path.join(values.dir, 'onboarding/cli/tools/server.mjs');
  if (!fs.existsSync(server) && !DRY) fail(`uygulama bulunamadı: ${server} (--dir doğru mu?)`);
}

preflight();

const certDir = values['cert-dir'] ?? (values['self-signed'] ? '/etc/ssl/dora' : `/etc/letsencrypt/live/${DOMAIN}`);
const isSelfSigned = Boolean(values['self-signed']);

console.log(`\nDORA TLS kurulumu${DRY ? ' (dry-run)' : ''}`);
console.log(`  alan adı : ${DOMAIN}`);
console.log(`  arka uç  : 127.0.0.1:${PORT}`);
console.log(`  sertifika: ${certDir}${isSelfSigned ? ' (kendinden imzalı)' : ''}\n`);

// 1) paketler
if (!values['no-apt']) {
  console.log('1) nginx + certbot paketleri');
  run('apt-get', ['update', '-qq']);
  run('apt-get', ['install', '-y', '-qq', 'nginx', ...(isSelfSigned ? [] : ['certbot'])]);
} else {
  console.log('1) paket kurulumu atlandı (--no-apt)');
}

// 2) dizinler + ara yapılandırma
console.log('2) ACME webroot ve ara nginx yapılandırması');
if (!DRY) fs.mkdirSync(values['acme-root'], { recursive: true });
const sitesAvailable = '/etc/nginx/sites-available/dora-ai-package';
const sitesEnabled = '/etc/nginx/sites-enabled/dora-ai-package';
writeFile(sitesAvailable, renderAcmeSite({ domain: DOMAIN, port: PORT, acmeRoot: values['acme-root'] }));
run('ln', ['-sfn', sitesAvailable, sitesEnabled]);
run('rm', ['-f', '/etc/nginx/sites-enabled/default']);
// hız sınırı kutusu (conf.d/http bağlamı)
writeFile('/etc/nginx/conf.d/dora-ratelimit.conf', renderRateLimit());
writeFile('/etc/nginx/snippets/dora-proxy.conf', renderProxySnippet({ port: PORT }));
run('nginx', ['-t']);
run('systemctl', ['reload-or-restart', 'nginx']);

// 3) sertifika
console.log('3) sertifika');
if (isSelfSigned) {
  if (!DRY) fs.mkdirSync(certDir, { recursive: true, mode: 0o700 });
  run('openssl', [
    'req', '-x509', '-newkey', 'rsa:2048', '-sha256', '-days', '825', '-nodes',
    '-keyout', `${certDir}/privkey.pem`, '-out', `${certDir}/fullchain.pem`,
    '-subj', `/CN=${DOMAIN}`,
    '-addext', `subjectAltName=DNS:${DOMAIN}`,
  ]);
  // ssl_trusted_certificate için zincir: kendinden imzalıda sertifikanın kendisi
  if (!DRY) fs.copyFileSync(`${certDir}/fullchain.pem`, `${certDir}/chain.pem`);
} else if (!values['cert-dir']) {
  run('certbot', [
    'certonly', '--webroot', '--webroot-path', values['acme-root'],
    '--domain', DOMAIN, '--email', values.email,
    '--agree-tos', '--no-eff-email', '--non-interactive', '--keep-until-expiring',
  ]);
  // yenileme sonrası nginx yeni sertifikayı yüklesin
  const hook = '/etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh';
  writeFile(hook, '#!/bin/sh\nset -e\nsystemctl reload nginx\n', 0o755);
} else {
  console.log(`  mevcut sertifika kullanılıyor: ${certDir}`);
}
for (const f of ['fullchain.pem', 'privkey.pem']) {
  if (!DRY && !fs.existsSync(path.join(certDir, f))) fail(`sertifika dosyası yok: ${path.join(certDir, f)}`);
}

// 4) kalıcı TLS sitesi
console.log('4) kalıcı TLS sitesi (80 → 301, 443 → ters vekil)');
// chain.pem yoksa (kendinden imzalı / özel dizin) fullchain.pem trusted cert olarak kullanılır
const chainFile = fs.existsSync(path.join(certDir, 'chain.pem'))
  ? path.join(certDir, 'chain.pem')
  : path.join(certDir, 'fullchain.pem');
writeFile(sitesAvailable, renderTlsSite({ domain: DOMAIN, port: PORT, certDir, chainFile, acmeRoot: values['acme-root'] }));
run('nginx', ['-t']);
run('systemctl', ['reload', 'nginx']);

// 5) uygulamayı yerel arayüze çek
console.log('5) systemd drop-in: 127.0.0.1 + --trust-proxy');
const dropinDir = '/etc/systemd/system/dora-ai-package.service.d';
writeFile(`${dropinDir}/10-tls.conf`, renderDropin({ target: TARGET_DIR, port: PORT }));
run('systemctl', ['daemon-reload']);
run('systemctl', ['restart', 'dora-ai-package']);

// 6) güvenlik duvarı (isteğe bağlı)
if (values.ufw) {
  console.log('6) ufw: 80/443 aç, 8080 kapat');
  run('ufw', ['allow', '80/tcp']);
  run('ufw', ['allow', '443/tcp']);
  run('ufw', ['deny', `${PORT}/tcp`]);
}

// 7) doğrulama
if (DRY) {
  console.log('\n(dry-run) hiçbir dosya yazılmadı, komut çalıştırılmadı.');
} else if (!values['skip-verify']) {
  console.log('8) doğrulama');
  const curlArgs = isSelfSigned ? ['-k'] : [];
  const code = (url) => {
    const r = exec('curl', ['-sS', '-o', '/dev/null', '-w', '%{http_code}', ...curlArgs, '--max-time', '10', url], { quiet: true });
    return (r.stdout ?? '').trim();
  };
  let okCount = 0;
  const check = (name, got, want) => {
    const pass = Array.isArray(want) ? want.includes(got) : got === want;
    console.log(`  ${pass ? '✔' : '✘'} ${name}: ${got || '(boş)'}`);
    if (pass) okCount += 1;
  };
  check('http → https yönlendirme', code(`http://${DOMAIN}/healthz`), ['301', '308']);
  check('https /healthz', code(`https://${DOMAIN}/healthz`), '200');
  const h = exec('curl', ['-sSI', ...curlArgs, '--max-time', '10', `https://${DOMAIN}/healthz`], { quiet: true });
  const hasHsts = /strict-transport-security:\s*max-age=/i.test(h.stdout ?? '');
  console.log(`  ${hasHsts ? '✔' : '✘'} HSTS başlığı${hasHsts ? '' : ' (yok — ters vekil X-Forwarded-Proto gönderiyor mu?)'}`);
  if (hasHsts) okCount += 1;
  console.log(`\n  sonuç: ${okCount}/3 kontrol geçti`);
}

console.log(`
Kurulum tamam.

  Uygulama : https://${DOMAIN}/app/
  Sağlık   : https://${DOMAIN}/healthz

  Servis   : sudo systemctl status dora-ai-package nginx
  Log      : sudo journalctl -u dora-ai-package -f
  Vekil log: sudo tail -f /var/log/nginx/dora-error.log
${isSelfSigned ? `
  UYARI: kendinden imzalı sertifika — tarayıcı uyarı verir, SSO çalışmaz.
  Gerçek sertifika için: sudo node scripts/install-tls.mjs --domain ${DOMAIN} --email admin@${DOMAIN}
` : `
  Yenileme : sudo certbot renew --dry-run      (timer: systemctl list-timers | grep certbot)
`}
  Yedek    : sudo node scripts/install-backup-timer.mjs --dir ${values.dir}
`);

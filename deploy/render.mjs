// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 ustauretim
//
// Üretim şablonlarını dolduran saf işlevler. Kurulum betikleri ve birim testleri
// aynı kod yolunu kullanır; böylece "test edilen dosya" ile "kurulan dosya" aynıdır.
//
// Yer tutucu biçimi: __KEY__ . Bilinmeyen ya da doldurulmamış yer tutucu hata verir
// (sessizce eksik yapılandırma yazmaktansa kurulumun durması yeğdir).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEPLOY_DIR = path.dirname(fileURLToPath(import.meta.url));

/** Şablonu okur, __KEY__ yer tutucularını doldurur. */
export function render(templateRelPath, vars) {
  const raw = fs.readFileSync(path.join(DEPLOY_DIR, templateRelPath), 'utf8');
  const out = raw.replace(/__([A-Z_]+)__/g, (m, key) => {
    if (!(key in vars)) throw new Error(`şablonda bilinmeyen yer tutucu: ${m} (${templateRelPath})`);
    return String(vars[key]);
  });
  if (/__[A-Z_]+__/.test(out)) throw new Error(`doldurulmamış yer tutucu kaldı: ${templateRelPath}`);
  return out;
}

/** 443 sitesi: TLS sonlandırma, 80 → 301, ters vekil. */
export function renderTlsSite({ domain, port, certDir, acmeRoot, chainFile }) {
  return render('nginx/dora-ai-package.conf.template', {
    DOMAIN: domain,
    BACKEND_PORT: port,
    CERT_DIR: certDir,
    // Let's Encrypt chain.pem verir; kendinden imzalı/özel dizinde olmayabilir
    CHAIN_FILE: chainFile ?? `${certDir}/chain.pem`,
    ACME_ROOT: acmeRoot,
  });
}

/** Sertifika alınmadan önceki HTTP-only site (ACME doğrulaması için). */
export function renderAcmeSite({ domain, port, acmeRoot }) {
  return render('nginx/acme.http.conf.template', { DOMAIN: domain, BACKEND_PORT: port, ACME_ROOT: acmeRoot });
}

/** Ortak ters vekil ayarları (snippets/dora-proxy.conf). */
export function renderProxySnippet({ port }) {
  return render('nginx/dora-proxy.conf', { BACKEND_PORT: port });
}

/** Giriş hız sınırı kutusu (conf.d/dora-ratelimit.conf) — yer tutucu yok. */
export function renderRateLimit() {
  return fs.readFileSync(path.join(DEPLOY_DIR, 'nginx/dora-ratelimit.conf'), 'utf8');
}

/** TLS modu systemd drop-in'i: 127.0.0.1 + --trust-proxy. */
export function renderDropin({ target, port }) {
  return render('systemd/10-tls.conf.template', { TARGET: target, PORT: port });
}

/** Yedek servisi: dizin, hedef ve saklama sayısını yerleştirir. */
export function renderBackupService({ target, dest, keep }) {
  const raw = fs.readFileSync(path.join(DEPLOY_DIR, 'dora-backup.service'), 'utf8');
  return raw
    .replace(/^Environment=DORA_ROOT=.*$/m, `Environment=DORA_ROOT=${target}`)
    .replace(/^Environment=DORA_BACKUP_DIR=.*$/m, `Environment=DORA_BACKUP_DIR=${dest}`)
    .replace(/^Environment=DORA_BACKUP_KEEP=.*$/m, `Environment=DORA_BACKUP_KEEP=${keep}`)
    .replace(/^WorkingDirectory=.*$/m, `WorkingDirectory=${target}`)
    .replace(/^ReadOnlyPaths=.*$/m, `ReadOnlyPaths=${target}`)
    .replace(/^ReadWritePaths=.*$/m, `ReadWritePaths=${dest}`)
    .replaceAll('/opt/dora-ai-package', target)
    .replaceAll('/var/backups/dora', dest);
}

/** Günlük yedek zamanlayıcısı: saat değiştirilebilir. */
export function renderBackupTimer({ time = '02:30' } = {}) {
  const raw = fs.readFileSync(path.join(DEPLOY_DIR, 'dora-backup.timer'), 'utf8');
  return raw.replace(/^OnCalendar=.*$/m, `OnCalendar=*-*-* ${time}:00`);
}

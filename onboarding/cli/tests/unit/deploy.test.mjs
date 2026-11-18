import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  DEPLOY_DIR,
  render,
  renderTlsSite,
  renderAcmeSite,
  renderProxySnippet,
  renderDropin,
  renderBackupService,
  renderBackupTimer,
  renderRateLimit,
} from '../../../../deploy/render.mjs';

const ROOT = path.resolve(DEPLOY_DIR, '..');
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');

const TLS_VARS = {
  domain: 'dora.ornek.local',
  port: 8080,
  certDir: '/etc/letsencrypt/live/dora.ornek.local',
  chainFile: '/etc/letsencrypt/live/dora.ornek.local/chain.pem',
  acmeRoot: '/var/www/certbot',
};

test('şablon: bilinmeyen yer tutucu sessizce geçmez', () => {
  assert.throws(() => render('nginx/dora-proxy.conf', {}), /bilinmeyen yer tutucu/);
});

test('nginx TLS sitesi: TLS, yönlendirme ve vekil başlıkları', () => {
  const conf = renderTlsSite(TLS_VARS);
  assert.match(conf, /listen 443 ssl/);
  assert.match(conf, /server_name dora\.ornek\.local;/);
  assert.match(conf, /ssl_protocols TLSv1\.2 TLSv1\.3;/);
  assert.match(conf, /return 301 https:\/\/\$host\$request_uri;/);
  assert.match(conf, /include \/etc\/nginx\/snippets\/dora-proxy\.conf;/);
  // CSV yükleme sınırı uygulamada 5 MB; vekilde pay bırakılmalı
  assert.match(conf, /client_max_body_size 12m;/);
  // sunucu sürümü sızdırılmaz
  assert.match(conf, /server_tokens off;/);
});

test('nginx: HSTS tek kaynaktan (uygulama) verilir, nginx eklemez', () => {
  const conf = renderTlsSite(TLS_VARS);
  assert.doesNotMatch(conf, /add_header\s+Strict-Transport-Security/i);
  assert.match(read('onboarding/cli/tools/server.mjs'), /Strict-Transport-Security/);
});

test('nginx ACME ara yapılandırması: sertifika istemez, webroot verir', () => {
  const conf = renderAcmeSite(TLS_VARS);
  assert.match(conf, /\.well-known\/acme-challenge\//);
  assert.match(conf, /root \/var\/www\/certbot;/);
  assert.doesNotMatch(conf, /ssl_certificate/);
  assert.doesNotMatch(conf, /listen 443/);
});

test('nginx: giriş hız sınırı kutusu ile site aynı zone adını kullanır', () => {
  const zone = renderRateLimit().match(/zone=([a-z_]+):/);
  assert.ok(zone, 'zone tanımı bulunamadı');
  assert.match(renderTlsSite(TLS_VARS), new RegExp(`limit_req zone=${zone[1]} `));
});

test('nginx: vekil snippet\'i doğru hedefe ve başlıklara bağlanır', () => {
  const proxy = renderProxySnippet({ port: 8080 });
  assert.match(proxy, /proxy_pass http:\/\/127\.0\.0\.1:8080;/);
  assert.match(proxy, /proxy_set_header X-Forwarded-Proto\s+\$scheme;/);
  assert.match(proxy, /proxy_set_header X-Real-IP\s+\$remote_addr;/);
  assert.match(proxy, /proxy_read_timeout 120s;/);
});

test('nginx: site, depoda bulunan snippet ve kutu dosyalarına dayanır', () => {
  assert.match(renderTlsSite(TLS_VARS), /include \/etc\/nginx\/snippets\/dora-proxy\.conf;/);
  assert.ok(fs.existsSync(path.join(DEPLOY_DIR, 'nginx', 'dora-proxy.conf')));
  assert.ok(fs.existsSync(path.join(DEPLOY_DIR, 'nginx', 'dora-ratelimit.conf')));
  // sekme/mojibake yok, LF
  const proxy = renderProxySnippet({ port: 8080 });
  assert.doesNotMatch(proxy, /\t/);
  assert.doesNotMatch(proxy, /\r/);
  assert.match(proxy, /proxy_read_timeout 120s;/);
});

test('systemd drop-in: uygulamayı 127.0.0.1e çeker ve --trust-proxy açar', () => {
  const conf = renderDropin({ target: '/opt/dora-ai-package', port: 8080 });
  const lines = conf.split('\n');
  // systemd'de ExecStart'ı değiştirmek için önce boşaltılmalı
  const emptyIdx = lines.indexOf('ExecStart=');
  const realIdx = lines.findIndex((l) => l.startsWith('ExecStart=/usr/bin/node'));
  assert.ok(emptyIdx > 0 && realIdx > emptyIdx, 'ExecStart sıfırlama sırası yanlış');
  assert.match(lines[realIdx], /--host 127\.0\.0\.1 --trust-proxy$/);
  assert.match(conf, /Environment=HOST=127\.0\.0\.1/);
  // bayrak sunucuda gerçekten var mı?
  assert.match(read('onboarding/cli/tools/server.mjs'), /'trust-proxy'/);
});

test('sağlık uç noktası: kurulum doğrulamasının dayandığı /healthz var', () => {
  // install-tls.mjs ve install-ubuntu.sh /healthz'e bakıyor; uygulama sunucusunda
  // bu yol yoksa kurulum "başarısız" görünür (gerçekten olmuştu).
  assert.match(read('onboarding/cli/tools/server.mjs'), /urlPath === '\/healthz'/);
  assert.match(read('scripts', 'install-tls.mjs'), /\/healthz/);
});

test('taban unit: port/host ortamdan, sırlar unit dosyasında değil', () => {
  const unit = read('deploy', 'dora-ai-package.service');
  assert.match(unit, /^\[Unit\]$/m);
  assert.match(unit, /^\[Service\]$/m);
  assert.match(unit, /^\[Install\]$/m);
  assert.match(unit, /ExecStart=.*--port \$\{PORT\} --host \$\{HOST\}/);
  assert.match(unit, /EnvironmentFile=-\/etc\/dora\/dora\.env/);
  assert.match(unit, /UMask=0077/);
  assert.match(unit, /NoNewPrivileges=true/);
  assert.match(unit, /ReadWritePaths=.*web-data.*\.dora-onboarding/);
  assert.doesNotMatch(unit, /(PASSWORD|SECRET|TOKEN)=/i);
});

test('yedek servisi: hedef dizin ve saklama sayısı şablondan gelir', () => {
  const unit = renderBackupService({ target: '/srv/dora', dest: '/mnt/yedek/dora', keep: 14 });
  assert.equal(unit.match(/\/opt\/dora-ai-package/g), null, 'eski varsayılan yol kaldı');
  assert.match(unit, /Environment=DORA_ROOT=\/srv\/dora/);
  assert.match(unit, /Environment=DORA_BACKUP_DIR=\/mnt\/yedek\/dora/);
  assert.match(unit, /Environment=DORA_BACKUP_KEEP=14/);
  assert.match(unit, /ReadWritePaths=\/mnt\/yedek\/dora$/m);
  assert.match(unit, /ExecStart=\/usr\/bin\/node \/srv\/dora\/scripts\/backup-run\.mjs/);
  assert.ok(fs.existsSync(path.join(ROOT, 'scripts', 'backup-run.mjs')));
});

test('yedek zamanlayıcısı: saat değiştirilebilir, açılışta telafi eder', () => {
  const timer = renderBackupTimer({ time: '03:10' });
  assert.match(timer, /^OnCalendar=\*-\*-\* 03:10:00$/m);
  assert.match(timer, /Persistent=true/);
  assert.match(timer, /Unit=dora-backup\.service/);
  assert.match(timer, /WantedBy=timers\.target/);
});

test('yedek betiği: sıra yedek → doğrula → buda', () => {
  const src = read('scripts', 'backup-run.mjs');
  const iCreate = src.indexOf('createBackup({');
  const iVerify = src.indexOf('verifyBackup(outFile)');
  const iPrune = src.indexOf('pruneBackups(');
  assert.ok(iCreate > 0 && iVerify > iCreate && iPrune > iVerify, 'işlem sırası bozuk');
  // doğrulama başarısızsa budama yapılmamalı
  const between = src.slice(iVerify, iPrune);
  assert.match(between, /process\.exit\(1\)/);
});

test('üretim dosyaları: CRLF ve BOM yok', () => {
  const files = [
    ['deploy', 'dora-ai-package.service'],
    ['deploy', 'dora-backup.service'],
    ['deploy', 'dora-backup.timer'],
    ['deploy', 'nginx', 'dora-ai-package.conf.template'],
    ['deploy', 'nginx', 'acme.http.conf.template'],
    ['deploy', 'nginx', 'dora-proxy.conf'],
    ['deploy', 'nginx', 'dora-ratelimit.conf'],
    ['deploy', 'systemd', '10-tls.conf.template'],
    ['scripts', 'install-tls.mjs'],
    ['scripts', 'install-backup-timer.mjs'],
    ['scripts', 'backup-run.mjs'],
  ];
  for (const f of files) {
    const body = read(...f);
    assert.doesNotMatch(body, /\r/, `${f.join('/')} CRLF içeriyor`);
    assert.notEqual(body.charCodeAt(0), 0xfeff, `${f.join('/')} BOM ile başlıyor`);
  }
});

test('bütün şablonlar doldurulabilir: yer tutucu artığı kalmaz', () => {
  const outputs = [
    renderTlsSite(TLS_VARS),
    renderAcmeSite(TLS_VARS),
    renderProxySnippet({ port: 8080 }),
    renderDropin({ target: '/opt/dora-ai-package', port: 8080 }),
    renderBackupService({ target: '/opt/dora-ai-package', dest: '/var/backups/dora', keep: 8 }),
    renderBackupTimer({ time: '02:30' }),
    renderRateLimit(),
  ];
  for (const out of outputs) assert.doesNotMatch(out, /__[A-Z_]+__/);
});

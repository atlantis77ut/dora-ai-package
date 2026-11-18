# Üretim: HTTPS (TLS) + Ters Vekil Kurulumu

Son güncelleme: 2026-11-18 · Sürüm 1.32.0 · **Test edildi:** kısmen (bkz. §9 — gerçek nginx/certbot
bu ortamda çalıştırılamadı; şablon üretimi, birim testleri ve proxy davranışı uçtan uca doğrulandı)

---

## 1. Neden gerekli

| Gerekçe | Ayrıntı |
|---|---|
| **Oturum çerezi** | Uygulama `Secure` çerezi yalnız HTTPS'te yazar; düz HTTP'de çerez ağda açık gider |
| **SSO / OIDC** | Sağlayıcılar `http://` yönlendirme adresini reddeder — TLS olmadan SSO çalışmaz |
| **DORA denetimi** | Yönetimsel veri (olay, kanıt, denetim kaydı) taşıyan panelin şifresiz yayınlanması bulgu |
| **HSTS** | Tarayıcıya "bu alan adına bir daha HTTP ile gelme" der; ilk bağlantıdaki sıyrılmayı kapatır |

> Paket kendi içinde TLS **sonlandırmaz**. Sertifikayı nginx sonlandırır, uygulama yalnız
> `127.0.0.1` üzerinde dinler. Bu, sertifika yenilemesini ve zayıf TLS ayarlarının tek yerden
> yönetilmesini sağlar.

---

## 2. Ön koşullar

1. **Alan adı** ve A kaydı: `dora.ornek.local` → sunucu IP'si. Kurulumdan önce yayılmalı:
   `dig +short dora.ornek.local`
2. **80/tcp** ve **443/tcp** dışarıdan erişilebilir olmalı (Let's Encrypt doğrulaması 80'i kullanır).
3. Sunucuda **root** erişimi ve **Node.js 18+** (paket zaten kurulu).
4. Paket kurulu olmalı: `docs/KURULUM-UBUNTU.md`. Servis `dora-ai-package` olarak çalışıyor olmalı.

---

## 3. Kurulum (tek komut)

```bash
sudo node /opt/dora-ai-package/scripts/install-tls.mjs \
  --domain dora.ornek.local \
  --email  admin@ornek.local
```

Önce planı görmek için (hiçbir şey yazmaz, komutları listeler):

```bash
node /opt/dora-ai-package/scripts/install-tls.mjs --domain dora.ornek.local --email a@b.c --dry-run
```

### Seçenekler

| Seçenek | Varsayılan | Anlamı |
|---|---|---|
| `--domain` | — | **Zorunlu.** Genel alan adı |
| `--email` | — | Let's Encrypt bildirim/süre bitiş adresi |
| `--dir` | `/opt/dora-ai-package` | Kurulum dizini |
| `--port` | `8080` | Uygulamanın yerel portu |
| `--self-signed` | kapalı | Let's Encrypt yerine kendinden imzalı sertifika (test/lab) |
| `--cert-dir` | — | Mevcut sertifika dizinini kullan (`fullchain.pem`, `privkey.pem`) |
| `--acme-root` | `/var/www/certbot` | ACME webroot dizini |
| `--no-apt` | kapalı | `apt-get install nginx certbot` adımını atla |
| `--ufw` | kapalı | `ufw` varsa 80/443 açar, uygulama portunu kapatır |
| `--skip-verify` | kapalı | Sondaki HTTP kontrollerini atla |
| `--dry-run` | kapalı | Yalnız plan yazdır |

---

## 4. Kurulum ne yapıyor (adım adım)

| # | Adım | Sonuç |
|---|---|---|
| 1 | `apt-get install nginx certbot` | ters vekil + sertifika istemcisi |
| 2 | **Ara** yapılandırma: HTTP-only site, ACME webroot | sertifika alınana kadar nginx açılabilir |
| 3 | `certbot certonly --webroot` | `/etc/letsencrypt/live/<domain>/` |
| 4 | **Kalıcı** site: 80 → 301, 443 → `127.0.0.1:8080` | `deploy/nginx/dora-ai-package.conf.template` |
| 5 | Giriş uçlarına IP başına hız sınırı (30 r/m, burst 10) | `/etc/nginx/conf.d/dora-ratelimit.conf` |
| 6 | systemd drop-in: `--host 127.0.0.1 --trust-proxy` | uygulama dışarıya kapalı |
| 7 | Doğrulama: 301, `/healthz` 200, HSTS başlığı | 3 kontrol |

Yazılan/üretilen dosyalar:

```
/etc/nginx/sites-available/dora-ai-package        (kalıcı site)
/etc/nginx/sites-enabled/dora-ai-package          (symlink)
/etc/nginx/snippets/dora-proxy.conf               (ortak vekil ayarları)
/etc/nginx/conf.d/dora-ratelimit.conf             (hız sınırı kutusu)
/etc/systemd/system/dora-ai-package.service.d/10-tls.conf   (127.0.0.1 + --trust-proxy)
/etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh       (yenileme sonrası reload)
```

---

## 5. `X-Forwarded-Proto` güven modeli (önemli)

nginx, uygulamaya `X-Forwarded-Proto: https` gönderir. Uygulama bu başlığa **koşulsuz güvenmez**:

| İstek nereden | Başlık | Sonuç |
|---|---|---|
| Doğrudan TLS (`socket.encrypted`) | — | https sayılır |
| **Loopback** (127.0.0.1 / ::1) | `https` | https sayılır → `Secure` çerez + HSTS |
| Uzak istemci | `https` | **yok sayılır** (başlık taklidi) |
| Uzak istemci + `--trust-proxy` | `https` | https sayılır (uzak ters vekil kurulumu) |

Neden: başlığa koşulsuz güvenilebilseydi, düz HTTP ile bağlanan bir saldırgan başlığı taklit edip
tarayıcıya `Secure` çerez yazdırabilir (çerez HTTP'de saklanmaz → giriş döngüsü) ya da HSTS'i
kandırabilirdi. Kod: `onboarding/cli/src/orl/proxy.mjs`, testler: `tests/unit/proxy.test.mjs`.

`--trust-proxy` yalnız **başka bir makinedeki** ters vekil için gerekir. Aynı makinede nginx
kullanıyorsanız gerekmez (loopback zaten güvenilir).

---

## 6. Doğrulama

```bash
# 1) yönlendirme
curl -sI http://dora.ornek.local/healthz | head -3
#   HTTP/1.1 301 Moved Permanently
#   Location: https://dora.ornek.local/healthz

# 2) sertifika + sağlık
curl -s https://dora.ornek.local/healthz
#   {"ok":true,"version":"1.32.0"}

# 3) HSTS başlığı
curl -sI https://dora.ornek.local/healthz | grep -i strict-transport-security
#   strict-transport-security: max-age=15552000

# 4) Secure çerez (giriş sonrası)
curl -s -D- -o /dev/null -X POST https://dora.ornek.local/api/auth/login \
  -H 'content-type: application/json' -H 'X-Dora-CSRF: 1' \
  -d '{"username":"KULLANICI","password":"PAROLA"}' | grep -i set-cookie
#   set-cookie: dora_session=...; Path=/; HttpOnly; SameSite=Lax; Max-Age=...; Secure

# 5) TLS sürümü / sertifika zinciri
openssl s_client -connect dora.ornek.local:443 -servername dora.ornek.local </dev/null 2>/dev/null \
  | openssl x509 -noout -subject -dates
```

Tarayıcıda: **Geliştirici araçları → Application → Cookies** → `dora_session` satırında
`Secure` ve `HttpOnly` işaretli olmalı; `Connection` sekmesinde protokol `h2`/`TLS 1.3` görünür.

SSO kullanacaksanız sağlayıcıdaki yönlendirme adresi **https** olmalı:
`https://dora.ornek.local/api/auth/oidc/callback` (bkz. `docs/SSO-KURULUM.md`).

---

## 7. Sertifika yenileme

`certbot` paketi kendi timer'ını kurar:

```bash
systemctl list-timers | grep certbot
sudo certbot renew --dry-run      # yenileme provası (sertifika almaz)
sudo certbot certificates         # geçerlilik tarihleri
```

Yenileme sonrası nginx'in yeni sertifikayı yüklemesi için kurulum bir deploy hook yazar:

```bash
cat /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
```

Let's Encrypt sertifikaları 90 gün geçerlidir; timer günde iki kez kontrol eder, son 30 günde
yeniler. **Hiçbir şey yapmanız gerekmez**; yalnız yenileme e-postasını takip edin.

---

## 8. Geri alma (TLS'i kaldırma)

```bash
sudo rm -f /etc/systemd/system/dora-ai-package.service.d/10-tls.conf
sudo rm -f /etc/nginx/sites-enabled/dora-ai-package /etc/nginx/sites-available/dora-ai-package
sudo systemctl daemon-reload
sudo systemctl restart dora-ai-package      # taban unit: 0.0.0.0:8080
sudo systemctl reload nginx
```

Sertifikayı da silmek için: `sudo certbot delete --cert-name dora.ornek.local`

---

## 9. Bu makinede ne test edildi (dürüst not)

| Doğrulanan | Nasıl |
|---|---|
| Şablonların dolması, yer tutucu artığı kalmaması | `deploy/render.mjs` ile 7 çıktı üretildi, birim testi |
| nginx/unit dosyalarının yapısal doğruluğu | `tests/unit/deploy.test.mjs` (12 test) |
| CRLF/BOM yokluğu | aynı test dosyası |
| `X-Forwarded-Proto` güven modeli | `tests/unit/proxy.test.mjs` (6 test) + gerçek sunucuyla 8 uçtan uca kontrol |
| Secure çerez + HSTS davranışı | yerel sunucu, loopback ve LAN IP üzerinden |
| Yedek timer hattı (üret → doğrula → buda) | `scripts/backup-run.mjs` gerçek dosyalarla iki kez çalıştırıldı |
| Kurulum betiklerinin akışı | `--dry-run` ile tüm adımlar ve komutlar listelendi |

**Doğrulanmayan:** gerçek `nginx -t`, gerçek `certbot` sertifika alımı ve systemd birimlerinin
Ubuntu'da yüklenmesi — bu ortamda (Windows sandbox) çalıştırılamıyor. İlk gerçek kurulumda
`nginx -t` ve `curl` kontrolleri betiğin içinde otomatik çalışır; hata olursa çıktıyı gönderin.

---

## 10. Sorun giderme

| Belirti | Olası neden | Çözüm |
|---|---|---|
| `502 Bad Gateway` | uygulama 127.0.0.1'de dinlemiyor | `sudo systemctl status dora-ai-package`, `ss -ltnp \| grep 8080` |
| Sonsuz yönlendirme | arka planda başka bir vekil/CDN de yönlendiriyor | `curl -sI` ile zinciri izle, `X-Forwarded-Proto` çiftlenmiş olabilir |
| `Secure` çerez yok | vekil `X-Forwarded-Proto` göndermiyor | site dosyasında `proxy_set_header X-Forwarded-Proto $scheme;` satırını kontrol et |
| HSTS başlığı yok | aynı sebep (HSTS'i uygulama verir) | yukarıdaki madde |
| certbot: `404` challenge | 80/tcp kapalı ya da ACME `root` yanlış | `curl http://<domain>/.well-known/acme-challenge/test` (dosya koyarak) dene |
| `nginx: [emerg] cannot load certificate` | sertifika yolu yanlış / süresi geçmiş | `sudo certbot certificates`, site dosyasındaki yolu doğrula |
| `dora-ai-package` sürekli yeniden başlıyor | drop-in'de yanlış `--port` | `journalctl -u dora-ai-package -n 40` |
| 429 çok fazla istek | hız sınırı (30 r/m) | otomasyon için `deploy/nginx/dora-ratelimit.conf` değerini yükselt |
| SSO `redirect_uri` hatası | sağlayıcıdaki adres `http` | `https://<domain>/api/auth/oidc/callback` olarak güncelle |

---

## 11. İlgili belgeler

- `docs/KURULUM-UBUNTU.md` — temel kurulum
- `docs/SSO-KURULUM.md` — OIDC/Entra ID/Keycloak
- `docs/YEDEKLEME.md` — yedek + geri yükleme + timer
- `docs/GUVENLIK-TARAMASI.md` — güvenlik taraması
- `deploy/nginx/*.template`, `deploy/systemd/10-tls.conf.template` — kaynak şablonlar

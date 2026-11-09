# Güvenlik Taraması

Tarih: 9 Kasım 2026 · Sürüm 1.15.0 · Kapsam: paket deposu + çalışan uygulama sunucusu

Yöntem: `node onboarding/cli/tools/security-scan.mjs` (statik desenler + canlı HTTP kontrolleri)
ve elle kod incelemesi. Tarama **bağımlılık kullanmaz** (paket sıfır bağımlılıklıdır).

```bash
cd onboarding/cli && node tools/security-scan.mjs
```

---

## 1. Özet

| Önem | İlk tarama | Düzeltme sonrası |
|---|---|---|
| Yüksek | 2 | **0** |
| Orta | 6 | **0** |
| Düşük | 2 | 1 (elle inceleme notu) |

İlk turda çıkan 2 "yüksek" bulgu **yanlış pozitifti** (test dosyalarındaki sabit parolalar).
Tarayıcı test/demo dosyalarını hariç tutacak şekilde düzeltildi. Orta bulguların tamamı gerçekti
ve giderildi.

---

## 2. Giderilen bulgular

| # | Bulgu | Önem | Durum |
|---|---|---|---|
| 1 | Güvenlik başlıkları yok (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, CSP) | Orta | **Giderildi** — tüm yanıtlara eklendi |
| 2 | `/api/health` kimlik doğrulaması istiyordu (izleme kırılıyordu) | Düşük | **Giderildi** — herkese açık |
| 3 | Denetim kaydı `audit.log` varsayılan izinlerle yazılıyordu | Orta | **Giderildi** — `0600` |
| 4 | `unzipStore` açılmış boyut/girdi sınırı yoktu (zip bomb) | Orta | **Giderildi** — 100 MB / 5000 girdi |
| 5 | Entegrasyon testi bulut meta veri adresine istek atabiliyordu (SSRF) | Orta | **Giderildi** — `169.254.169.254`, `metadata.google.internal` reddedilir |
| 6 | OIDC `issuer` aynı şekilde serbestti | Orta | **Giderildi** — aynı engel `discover()` içinde |
| 7 | CSRF taraması yanlış ucu deniyordu (login muaf) | — | Tarayıcı düzeltildi: `PUT /api/institution` → 403 |

### Uygulanan başlıklar

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: no-referrer
Content-Security-Policy: default-src 'self'; img-src 'self' data:;
  style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self';
  frame-ancestors 'none'; base-uri 'none'
```

CSP `script-src 'self'` ile sıkı tutuldu; uygulamada satır içi betik yok (tek `<script src>`),
satır içi stil yalnızca yerleşim amaçlı olduğu için `style-src 'unsafe-inline'`.

---

## 3. Doğrulanan kontroller

| Kontrol | Sonuç |
|---|---|
| Oturumsuz `/api/state`, `/api/users`, `/api/audit`, `/api/sessions` | 401 |
| CSRF başlıksız yazma | 403 |
| `/dashboard/` oturumsuz | 302 → giriş |
| Yol dışına çıkma (`..%2f`) | reddedildi |
| Parola saklama | scrypt (N=16384), kullanıcı başına tuz |
| Oturum çerezi | `HttpOnly`, `SameSite=Lax`, HTTPS'te `Secure`, 8 saat |
| Parola değişince eski oturum | 401 (token `pv` alanı) |
| Token karşılaştırmaları | `timingSafeEqual` |
| Lisans imzası | Ed25519, `crypto.verify` |
| Kanıt paketi | sha256 + hash zinciri + imza; kurcalama yakalanıyor |
| Bağımlılık | **yok** (npm paketi değil, sıfır bağımlılık) |
| İstek gövdesi sınırı | 5 MB |
| SIEM yanıt sınırı | 5 MB, 15 sn zaman aşımı |
| Denetim kaydı | `web-data/audit.log`, `0600` |
| Kullanıcı/anahtar dosyaları | `web-data/*.json|pem`, `0600` |

---

## 4. Kalan riskler (kabul edilmiş)

| # | Risk | Neden kabul edildi | Öneri |
|---|---|---|---|
| 1 | **TLS yok** | Uygulama ters vekil arkasında çalışacak şekilde tasarlandı | nginx/Caddy + sertifika; `Secure` çerez o zaman devreye girer |
| 2 | API anahtarları diskte düz metin (`secrets.json`, `0600`) | Bağımlılıksız kalmak için KMS/HSM entegrasyonu yok | Üretimde dosya sistemi şifreleme veya KMS |
| 3 | Giriş denemesi sınırı kullanıcı adı bazlı, IP bazlı değil | Ters vekil arkasında gerçek IP karmaşık | Vekilde `limit_req` |
| 4 | Login ucu CSRF muaf | Oturum çerezi olmadan CSRF anlamsız; "login CSRF" için düşük risk | İstenirse aynı başlık login'e de uygulanır |
| 5 | Hata mesajları dosya yolu içerebilir (`ENOENT … users.json`) | Yerel kurulum varsayımı | Ağa açık kurulumda genel mesaj |
| 6 | SSRF koruması yalnız meta veri adresini engeller; özel IP'ler serbest | Şirket içi SIEM/IdP özel IP'de çalışır | Vekil katmanında çıkış filtresi |
| 7 | XSS taraması sezgisel (28 `innerHTML` satırı işaretlendi) | Tüm kullanıcı verisi `esc()` ile kaçırılıyor; işaretlenenler sayı/tarih/sınıf adı ifadeleri | Kod incelemesi yapıldı, gerçek bulgu yok |
| 8 | TOTP sırrı `users.json` içinde | KMS yok | Üretimde HSM/KMS |
| 9 | SSO testi yalnız yerel sahte sağlayıcıyla | Gerçek IdP erişimi yok | Entra/Keycloak ile doğrulama |

---

## 5. Elle inceleme notları

- **Şablon kaçışı**: `app.js` içinde kullanıcı kaynaklı metinler (kurum adı, kullanıcı adı,
  artefakt adı, SIEM olay başlığı/kaynağı, hata mesajı) `esc()` üzerinden geçiyor. `textContent`
  kullanılan yerlerde ek kaçış gerekmiyor.
- **Dosya yolları**: artefakt adları `path.basename()` ile sınırlandırılıyor; statik sunucuda
  `path.resolve` + kök öneki kontrolü var.
- **CSV**: 5 MB gövde sınırı, 2000 satır sınırı, alan uzunlukları kesiliyor.
- **ZIP**: paketleme `store` (sıkıştırma yok) — zip bomb riski düşük; yine de açma sınırları eklendi.
- **Olay normalizasyonu**: SIEM'den gelen alanlar kırpılıyor (başlık 300 karakter), ham veri
  saklanıyor ama arayüzde `esc()` ile gösteriliyor.

---

## 6. Tekrar çalıştırma

```bash
# sunucu ayaktayken
cd onboarding/cli && node tools/security-scan.mjs

# farklı hedef
node tools/security-scan.mjs --url http://127.0.0.1:8090
```

Çıkış kodu: yüksek bulgu varsa **1**, yoksa **0** — CI'ya eklenebilir.

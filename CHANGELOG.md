# Changelog

Bu dosya, paketin sürüm geçmişini tutar. Biçim: [Keep a Changelog](https://keepachangelog.com/tr/1.1.0/),
sürümleme: [SemVer](https://semver.org/lang/tr/).

---

## [1.14.0] — 2026-11-09

### Eklendi — gerçek SIEM konnektörü

Bağlantı testi yerine **gerçek olay çekme**. Beş ürün destekleniyor:

| Ürün | Yöntem |
|---|---|
| Splunk | `POST /services/search/jobs/export` (NDJSON akışı) |
| Elastic | `POST /_search` (`@timestamp` aralığı veya `query_string`) |
| Sentinel | Log Analytics sorgu ucu (tablo → satır eşleme) |
| QRadar | `GET /api/ariel/searches` |
| generic | `GET <endpoint>?limit=…` — `{events:[]}` veya dizi bekler |

- `src/orl/connectors/siem.mjs`: ürün adaptörleri, olay normalizasyonu (zaman, önem, kaynak, başlık),
  15 sn zaman aşımı, 5 MB yanıt sınırı, bulut meta veri adresine istek engeli
- `POST /api/sessions/:id/siem/fetch` (ayarlardaki SIEM bağlantısını kullanır)
- `GET /api/sessions/:id/siem/events` (çekilen olaylar)
- Arayüz: **SIEM olayları** sayfası (yönetici) — sorgu, zaman aralığı, limit, olay tablosu

### Doğrulama

```
birim: 11 test (generic/elastic/sentinel/splunk/qradar, hata, limit, meta veri engeli)
uçtan uca: 3 olay çekildi → kaydedildi → hatalı uç 502 + açık mesaj
```

---

## [1.13.1] — 2026-11-09

### Düzeltildi

- `GET /api/audit.csv` yönlendirme koşulunda yer almadığı için 404 dönüyordu; yönetici denetim
  bloğuna eklendi (oturumsuz istek 401 döner)

---

## [1.13.0] — 2026-11-09

### Eklendi — self-service parola sıfırlama

- Yönetici, kullanıcı satırından **tek kullanımlık bağlantı** üretir (30 dk, tek kullanım)
- `POST /api/users/:id/reset-link` · `POST /api/auth/reset` (herkese açık)
- Bağlantı tarayıcıya düz gider, diskte yalnız `sha256` özeti tutulur
- Sıfırlama sonrası kullanıcının tüm oturumları düşer (`pv` mekanizması)

### Eklendi — iki adımlı doğrulama (TOTP)

- `src/orl/totp.mjs`: RFC 6238 (6 hane / 30 sn), base32, ±1 adım tolerans, kurtarma kodları
- Kurulum: `POST /api/auth/2fa/setup` → `otpauth://` bağlantısı + manuel anahtar
- Etkinleştirme: `POST /api/auth/2fa/enable` → 10 tek kullanımlık kurtarma kodu
- Giriş: parola sonrası `otp_required` + 5 dakikalık meydan okuma; `POST /api/auth/2fa/verify`
- Kapatma parola ile: `POST /api/auth/2fa/disable`

### Eklendi — kurumsal giriş (SSO / OIDC)

- `src/orl/oidc.mjs`: keşif belgesi, authorization-code akışı, JWKS ile RS256 doğrulama,
  `iss`/`aud`/`exp`/`nonce` ve imzalı `state` kontrolleri
- `GET /api/auth/oidc/status|start` · `GET /api/auth/oidc/callback`
- Yönetici: `GET/PUT /api/settings/oidc` (issuer, client_id, redirect_uri, secret, auto_provision)
- Arayüz: giriş ekranında "Kurumsal hesapla giriş (SSO)", Yönetim'de SSO kartı

### Eklendi — küçük iyileştirmeler

- Yönetim'de kullanıcı **rolü** değiştirilebiliyor (yönetici/kullanıcı)
- `GET /api/audit.csv` — işlem kaydını CSV indir
- `tools/backup.mjs` — `web-data/` + oturumları tek zip'e yedekler

### Doğrulama

```
2fa: setup → enable (10 kurtarma kodu) → login otp_required → yanlış kod 401 → doğru kod 200
     kurtarma kodu 200 · aynı kod tekrar 401
reset: bağlantı 200 → parola 200 → aynı bağlantı 400
sso: start 302 → callback 302 /app/#genel → /api/state 200 (sso@ornek.local, user)
testler: 67 test, 67 pass
```

---

## [1.12.0] — 2026-11-09

### Eklendi — CSV dosya yükleme ve şablon

- `src/orl/csv.mjs`: tırnaklı alanlar, kaçışlı tırnak, `,`/`;` otomatik ayırıcı, BOM temizliği,
  başlık tespiti, Türkçe/İngilizce kritiklik eşlemesi (kritik → critical vb.)
- `POST /api/sessions/:id/inventory/csv` — ham CSV yükler, varlık listesine çevirir
- `GET /api/templates/inventory.csv` — BOM'lu, Excel uyumlu şablon
- Arayüz: Envanter sayfasında dosya seçici + "Şablon indir"; dosya seçilince otomatik yüklenir

### Eklendi — birim testleri

`onboarding/cli/tests/unit/` — 45 test, `node --test tests/unit`:

| Dosya | Kapsam |
|---|---|
| `csv.test.mjs` (9) | ayırıcı, tırnak, BOM, başlık, kritiklik eşlemesi, boş satır |
| `rules.test.mjs` (13) | karşılaştırma, birimler, %30, AND/OR/NOT, parantez, noktalı yol, eksik alan |
| `auth.test.mjs` (11) | scrypt, bootstrap, giriş, token, parola değişiminde oturum iptali, refresh |
| `evidence.test.mjs` (5) | sha256/zincir, imzalı–imzasız paket, yanlış anahtar, kurcalama tespiti |
| `checks.test.mjs` (7) | C1/C3/C4/C6 kapıları, deneme lisansı engeli, lisans imza/süre |

### Değişti

- Kural motorunda `AND`/`OR` artık kısa devre yapmıyor: iki taraf da değerlendirilip eksik alanlar
  raporlanıyor
- `package.json`: `test` → birim testleri, `test:demo` → eski demo, `test:sandbox` → süreç
  oluşturamayan ortamlar için (`--test-isolation=none`)
- CI: "Birim testleri (1.12)" adımı eklendi; "Kural moturu" yazım hatası düzeltildi

### Doğrulama

```
node --test --test-isolation=none "tests/unit/*.test.mjs"  → 45 test, 45 pass
POST /inventory/csv                                        → 200, 2 varlık (tırnaklı alan dahil)
GET  /templates/inventory.csv                              → 200, text/csv
```

---

## [1.11.0] — 2026-11-09

### Eklendi — kanıt paketi (tek zip, imzalı)

Altı adımın tüm kayıtları tarayıcıdan tek pakete dönüşüyor ve indiriliyor.

- `POST /api/sessions/:id/export` → `evidence-bundle.zip` üretir; yanıt dosya sayısı, zincir başı,
  imza durumu ve indirme bağlantısı verir
- `GET /api/sessions/:id/export/download` → zip'i `attachment` olarak sunar
- Paket: `manifest.json` (her dosyanın sha256'sı + hash zinciri), `README.txt`, `evidence/*`,
  `evidence/evidence-public.pem`
- İmza: kurulumun kendi Ed25519 anahtarı ilk dışa aktarımda üretilir (`web-data/evidence-key.pem`,
  `0600`), genel anahtar paketin içine konur
- Arayüz: Kurulum sayfasında "Paketi oluştur" + "İndir"; Belgeler sayfasında aynı işlem

### Doğrulama

```
export   → 200 · 5 dosya · imzalı · 4160 B
download → 200 · application/zip
verify   → GEÇERLİ · imza geçerli · 5 dosya
```

---

## [1.10.0] — 2026-11-09

### Eklendi — kurulumun kalan yarısı arayüzde

| Adım | Arayüz | Üretilen kanıt |
|---|---|---|
| 3 | Envanter + sorumlu özeti, "Görev eşlemesini oluştur" | `orl-mapping.json` (sahipli/sahipsiz kodlar, eksik ajan yönlendirmesi) |
| 4 | Üç senaryo için doğruluk / SLA ihlali / hash zinciri | `scenario-results.json` |
| 5 | 28 DORA maddesi kapsama seçimi + bağımsız doğrulayan | `coverage-matrix.json`, `gap-analysis.json` |
| 6 | Otonomi seviyeleri, gölge/yarı-otomatik gün, MOS panosu | `autonomy-grant.json`, `go-live.json` |

### Eklendi — lisans etkinleştirme

- `DORA-LIC-v1…` anahtarı yapıştırılır; Ed25519 imza + süre + tier doğrulanır
- Oturum ticari moda geçer, C6-0 kapısı açılır; geçersiz anahtar gerekçesiyle reddedilir

### Yeni uçlar

`POST /api/sessions/:id/{mapping,scenarios,assessment,autonomy,golive,license}` ·
`GET /api/catalog/articles`

### Doğrulama

```
C1 TAMAM · C2 TAMAM · C3 TAMAM (21/21 kod sahipli)
C4 TAMAM (doğruluk %98) · C5 TAMAM (28 madde) · C6 TAMAM (ticari lisans)
```

---

## [1.9.2] — 2026-11-09

### Düzeltildi

- İlk kurulum (bootstrap) çerezi parola sürümü alanını taşımıyordu; yönetici hesabı oluşturulduğu
  anda oturum geçersiz sayılıyordu. `pv` alanı bootstrap token'ına da eklendi.

---

## [1.9.1] — 2026-11-09

### Düzeltildi

- `/app/#giris` adresiyle açılışta arayüz çöküyordu (rota `null` dönüyordu); artık varsayılan
  sekmeye yönlendiriyor ve giriş sonrası hash temizleniyor

---

## [1.9.0] — 2026-11-09

### Düzeltildi — oturum ve menü

- Parola değişince eski oturumlar geçersiz: token'a parola sürümü (`pv`) eklendi
- CSRF koruması: yazma istekleri `X-Dora-CSRF: 1` başlığı taşımak zorunda
- Çerez: HTTPS arkasında `Secure`; bozuk çerez isteği düşürmüyor
- Oturum süresi görünür: başlıkta kalan dakika; "oturumu uzat" (`POST /api/auth/refresh`)
- Aktif oturum seçimi (`POST /api/sessions/active`)
- Menü: navigasyon bir kez kuruluyor; "Teknik panel" yalnız yöneticide ve aynı sekmede;
  "Kurulumu başlat" tüm sayfalarda çalışıyor; giriş sonrası hash korunuyor

### Doğrulama

```
CSRF'siz yazma → 403 · CSRF'li yazma → 200
parola sıfırlama sonrası me → 401
oturum süresi 4 saat → 200 · refresh → 200 · aktif oturum → 200
```

---

## [1.8.0] — 2026-11-09

### Eklendi

**Parola yönetimi**
- Kullanıcı kendi parolasını değiştirir: `POST /api/auth/password` (mevcut parola doğrulanır)
- Yönetici, kullanıcı satırından **parola sıfırlar** (`PATCH /api/users/:id`), işlem kaydına yazılır
- Arayüzde "Parolamı değiştir" sayfası

**Oturum güvenliği**
- Oturum süresi ayarlanabilir (`/api/settings/session`, 1-168 saat); giriş anında uygulanır
- Hatalı giriş sınırı: 5 başarısız denemeden sonra 60 saniye kilit (bellekte), denemeler
  `audit.log`'a `login_failed` olarak düşer

**Kurulum sihirbazı (arayüz)**
- `#kurulum` sayfası: hizmet listesi (ad, sahip, kritiklik) → `business-service-catalogue.json`
- Kesinti toleransları (MTD/RTO/RPO + yıllık kesinti sınırı) → `impact-tolerances.json` +
  `risk-appetite.json`
- Altı adım için **"adımı denetle"** düğmeleri: `POST /api/sessions/:id/gate/:phase` gerçek
  `evaluatePhase()` çalıştırır, sonuçları döner ve faz durumunu günceller
- Kullanıcı rolünde denetim sonuçları yalnız açıklama metniyle gösterilir (kriter kodları gizli)

### Düzeltildi

- `web-data/` çalışma anında silinirse kullanıcı kaydı hata veriyordu; yazma öncesi dizin
  oluşturuluyor (`auth.mjs`)

---

## [1.7.0] — 2026-11-09

### Eklendi — kimlik doğrulama ve yetkilendirme

- `src/orl/auth.mjs`: scrypt parola özeti, HMAC imzalı oturum çerezi (8 saat, HttpOnly,
  SameSite=Lax), kullanıcı deposu, işlem kaydı
- İlk kurulum: kullanıcı yoksa `/api/auth/bootstrap` ile **ilk yönetici** oluşturulur
  (ikinci çağrı 400 döner)
- Uçlar: `/api/auth/{status,bootstrap,login,logout,me}`, `/api/users` (GET/POST/PATCH/DELETE),
  `/api/audit`
- **Roller**:
  - `admin` → teknik her şey: süreç/kontrol sayaçları, `/dashboard/` rapor panosu, kanıt JSON'ları,
    kullanıcı yönetimi, işlem kaydı
  - `user` → yalnız iş arayüzü: Durum, Kurum bilgileri, Sistem bağlantıları, Varlıklarım,
    Sorumlular, Belgeler. Teknik terim, süreç kodu ve JSON görünmez.
- Statik kapılar: `/dashboard/`, `/site/`, `/docs/` yalnız yönetici (aksi hâlde `/app/#giris`'e 302)
- Arayüzde giriş/çıkış, kullanıcı ekleme, rol rozeti; kullanıcı sayfalarında sadeleştirilmiş dil
  ("Adım 1 · Hizmetlerin belirlenmesi", "Varlıklarım" gibi)

### Değişti

- Demo verileri temizlendi: `web-data/` ve `.dora-onboarding/` silindi; kurulum
  **ilk yönetici oluşturma ekranıyla** başlıyor
- `web-data/users.json`, `secret.key`, `audit.log` 0600 izniyle yazılır

### Güvenlik notları

- `/api/*` artık oturum ister; yönetici uçları ayrıca rol kontrolünden geçer
- Çerez `HttpOnly` — JavaScript okuyamaz; oturum süresi 8 saat
- Tek kullanıcı/yerel varsayımı sürüyor: sunucu `127.0.0.1`; ağa açılacaksa TLS + ters vekil
  önerilir

---

## [1.6.0] — 2026-11-09

### Eklendi — uygulama arayüzü (veri girişi)

Paket artık yalnızca rapor değil, **düzenlenebilir bir uygulama**: kurum kendi verisini tarayıcıdan
girer, API bağlantılarını tanımlar, ajanları aktive eder.

- `app/` — bağımlılıksız tek sayfa uygulama (`index.html`, `app.css`, `app.js`, ES modülü)
  - **Genel bakış**: KPI'lar, faz durumu, oturum listesi, hızlı işlemler
  - **Kurum profili**: ad, tier, regülatör, yargı alanı, lisanslar → `web-data/settings.json`
  - **Entegrasyonlar**: SIEM/ITSM/GRC/CMDB için ürün, endpoint, kimlik doğrulama, token;
    "Bağlantıyı test et" gerçek HTTP denemesi yapar (5 sn zaman aşımı)
  - **Envanter**: CSV yapıştır → `ict-inventory.json` (kritiklik, tedarikçi, özet sayım)
  - **Ajanlar**: 11 rol için aktivasyon + insan muadili → `agent-activation.json` + bağımsızlık kaydı
  - **Kanıtlar**: oturum artefaktlarını listeler ve JSON olarak gösterir
- `tools/server.mjs`: statik sunum + JSON API (`/api/state`, `/api/institution`,
  `/api/integrations/:id`, `/api/sessions`, `/api/sessions/:id/artifacts|agents|inventory`,
  `/api/catalog/roles`, `/api/lifecycle`)
- API anahtarları `web-data/secrets.json` içinde, `0600`; arayüze **geri dönmez**, yalnızca
  `has_token: true/false` görünür
- `serve.cmd` artık uygulama sunucusunu açar (`/app/`); systemd unit'i `ReadWritePaths` ile
  `web-data` ve `.dora-onboarding` dizinlerine yazma izni verir

### Güvenlik

- `web-data/` `.gitignore`'a eklendi (anahtarlar depoya girmesin)
- Sunucu varsayılan olarak `127.0.0.1` dinler; ağa açmak bilinçli bir tercih
- `/api/*` kimlik doğrulaması içermez — yerel/tek kullanıcı varsayımı; ağa açılacaksa ters
  vekil arkasında kimlik doğrulama gerekir (dokümanda not)

---

## [1.5.0] — 2026-11-09

### Eklendi — dashboard'da tam görünüm

Dört yeni sayfa; paketin tamamı tarayıcıdan okunabilir:

| Sayfa | İçerik |
|---|---|
| `dashboard/roles.html` | 11 ajan: amaç, raporlama, sorumluluklar (DORA maddesiyle), beceriler + otonomi, insan gözetimi, süreç kodları, tier |
| `dashboard/glossary.html` | 60 terim: tanım (DORA alıntısı), kaynak, sınıflandırma kriterleri, ilgili rol/süreçler |
| `dashboard/mapping.html` | 28 DORA maddesi: yükümlülükler, süreçler, kontroller, sahipler, kapsama durumu |
| `dashboard/sources.html` | **Veri nereden girilir**: tanım dosyaları, oturum komutları, düzenle→yayınla döngüsü, klasör haritası |

Navigasyon yedi sekmeye çıktı; sayfalar yine YAML'den üretiliyor, elle düzenlenmiyor.

---

## [1.4.2] — 2026-11-09

### Eklendi

- `scripts/serve.cmd`: Windows'ta çift tıkla çalıştırma. Node'u PATH'te arar, yoksa DSH ile gelen
  çalışma zamanını kullanır; sunucuyu `127.0.0.1:8080` üzerinde başlatır ve tarayıcıyı açar.
  Port parametresi: `serve.cmd 8081`.

### Notlar

- Yerel kullanım (tek makine) için `--host 127.0.0.1`; ağdaki başka cihazlardan erişim için
  `serve.mjs --host 0.0.0.0` ve güvenlik duvarı kuralı gerekir.

---

## [1.4.1] — 2026-11-09

### Eklendi — sunucu kurulumu ve genel test

- `onboarding/cli/tools/serve.mjs`: bağımlılıksız statik sunucu. `/` yönlendirme, `/dashboard/`,
  `/site/`, `/healthz`; yol dışına çıkma engelli; `--port` / `--host`.
- `scripts/smoke-test.sh`: 8 adımlı genel test (şema, kural motoru, 6 faz, 27 senaryo,
  kanıt paketi, veri alımı, DORA eşlemesi, dashboard+site üretimi). Çıkış kodu 0/1.
- `scripts/install-ubuntu.sh`: ön koşul kontrolü, klonlama veya offline kopyalama, test,
  isteğe bağlı systemd kurulumu (`--service`), port seçimi.
- `deploy/dora-ai-package.service`: systemd unit'i (ayrı kullanıcı, `ProtectSystem=strict`,
  `MemoryMax=256M`).
- `docs/KURULUM-UBUNTU.md`: gereksinimler, sunucu seçimi, nginx arkasına alma, offline kurulum,
  sorun giderme.

### Notlar

- Paket **GPU kullanmaz**, `npm install` gerektirmez, dış CDN'e bağlanmaz — kapalı ağda çalışır.
- `install-ubuntu.sh` ve `smoke-test.sh` bu geliştirme ortamında çalıştırılamadı (sandbox bash
  sürecini engelliyor); satır sonları LF doğrulandı, ilk çalıştırma sunucuda yapılacak.

---

## [1.4.0] — 2026-11-09

### Eklendi — kural motoru

Süreçlerdeki 49 `decision_rules[].condition` ifadesi artık **çalıştırılabilir**.

- `src/orl/rules.mjs`: küçük ifade dili (karşılaştırma, AND/OR/NOT, `IN`, parantez, birim
  sözcükleri, `%30`, noktalı alan yolu). Desteklenmeyen sözdizimi `parse_error` döner —
  sessizce yanlış sonuç üretmez.
- `src/orl/facts.mjs`: kanıt → olgu adaptörü. Türkçe kural alanları (`etkilenen_musteri`) ile
  İngilizce kanıt alanları (`affected_customers`) arasındaki eşleme açık tabloyla tanımlı.
- CLI: `rules --audit` · `rules --session <id> [--process PRC-…] [--facts olgular.json]`;
  sonuç `<oturum>/rule-evaluation.json` dosyasına yazılır.
- `tools/demo-rules.mjs` + CI adımı: 49/49 sözdizimi, SCN-01 olgularıyla doğru tetikleme,
  eksik olgu ve bozuk ifade davranışı.
- `docs/KURAL-MOTORU.md`: söz dizimi, adaptör tablosu, sınırlar.

### Davranış

- Eksik olgu → kural **tetiklenmez**, alan `missing` olarak raporlanır.
- `INC-R1` ve `INC-R3`, SCN-01 golden kanıtlarından üretilen olgularla tetikleniyor;
  `INC-R2`, `INC-R4`, `INC-R5` doğru şekilde tetiklenmiyor.
- Sürüm 1.4.0.

---

## [1.3.0] — 2026-11-09

### Değişti — kırıcı: çerçeve adı ORL olarak yeniden adlandırıldı

Üçüncü taraf çerçevenin kısaltması 1.2.2'de metinlerden çıkarılmıştı ama dosya,
klasör ve veri alanı adlarında duruyordu. 1.3.0'da tamamı kaldırıldı; yerine kendi
tanımımız olan **ORL — Operational Resilience Lifecycle** kullanıldı.

| Katman | Yeni ad |
|---|---|
| Yaşam döngüsü tanımı | `onboarding/orl-lifecycle.yaml` |
| Modül klasörü | `onboarding/cli/src/orl/` |
| Süreç eşlemesi | `data/orl-integration/agent-to-orl-mapping.yaml` |
| Rol alanı | `process_codes` |
| Faz alanı | `lifecycle_phase` |
| Sahiplik alanı | `owned_processes` |
| Özet alanı | `lifecycle_summary` |
| Çalıştırma kimliği | `ORL-IMPL-6` |

51 dosya güncellendi; dosya/klasör taşımaları yapıldı. `orl-lifecycle.yaml` içindeki
`framework` alanı "Implementation Lifecycle (6 faz)" olarak kaldı.

### Kırıcı değişiklik

Bu sürümden önce yazılmış oturumlar (`session.json`) ve dış betikler eski alan adlarını
kullanıyorsa güncellenmelidir. CLI'ın kendi çıktıları (dashboard, site, kanıt paketi) yeniden
üretildi.

### Doğrulama

`validate --strict`, `phases`, `demo` (6/6), `demo-scenario` (27/27), `render-mapping --check`
(%100), dashboard + site + PNG üretimi — hepsi geçti.

---

## [1.2.2] — 2026-11-09

### Değişti — üçüncü taraf marka adları tamamen kaldırıldı

Hukuki risk nedeniyle tedarikçi ve ürün adları metinlerden çıkarıldı; yerine nötr tanımlar geldi.

| Önce | Sonra |
|---|---|
| tedarikçi adı + çerçeve adı | "referans operasyonel dayanıklılık süreç modeli" |
| ürün adı + modül ifadesi | "referans platform modülleri" |
| ürün adlı alan (`*_modules`) | `platform_modules` |
| framework: tedarikçi + çerçeve adı | framework: "Implementation Lifecycle (6 faz)" |
| platform: ürün adı | platform: "harici referans platform" |

Etkilenen dosyalar: `data/orl-integration/agent-to-orl-mapping.yaml`, `docs/architecture.md`,
`docs/DURUM.md`, `docs/UYGULAMA-RAPORU.md`, `onboarding/orl-lifecycle.yaml`,
`onboarding/wizard-spec.md`, `README.md`, `CHANGELOG.md`.

Ayrıca `UYGULAMA-RAPORU.docx` içindeki iki geçiş düzeltildi ve PDF yeniden üretildi.

### Doğrulama

Tüm metin dosyaları ve iki ikili belge (DOCX/PDF) tarandı: **0 eşleşme**.
`validate --strict`, `demo` (6/6), `demo-scenario` (27/27), `render-mapping --check` (%100),
dashboard ve site üretimi — hepsi geçti.

---

## [1.2.1] — 2026-11-09

### Değişti

**Legacy CLI ayrıldı** (LAUNCH-REVIEW P1-7)
- `bin/dora-onboard.js`, `src/index.js`, `src/steps/step-1-profile.js`, `src/steps/step-4-agents.js`
  → `onboarding/cli/legacy/` altına taşındı
- `legacy/README.md`: dosyaların neden çalışmadığı (commander/inquirer/js-yaml) ve yeni karşılıkları
- `src/steps/` klasörü kaldırıldı; `docker-compose.yml` artık `bin/dora-onboard.mjs` çağırıyor

**README mimariyle hizalandı** (P2-1)
- Açılış: "otomatikleştiren" → "**yürüten**, her adımı **geçiş kapılarıyla doğrulayan**"
- Ajan çalıştırıcısının kapsam dışı olduğu açıkça yazıldı
- **"Ne değildir"** tablosu: ajan çalıştırıcısı · bildirim gönderen sistem · hukuki görüş ·
  platform yerine geçme · sıfır kurulum

### Doğrulama

`validate --strict`, `demo` (6/6), `demo-scenario` (27/27), `demo-export`, `demo-ingest`,
`render-mapping --check` (%100), dashboard üretimi — hepsi geçti.

---

## [1.2.0] — 2026-11-09

### Eklendi

**Kalan 21 assertion `check` ile bağlandı — kabul testleri tamamen çalıştırılabilir**
- SCN-01 (8), SCN-02 (7), SCN-03 (6) assertion'larına `check` blokları eklendi
- Golden koşu artefaktları: `tests/synthetic-scenarios/golden/<senaryo>/`
  (SCN-01: 8 dosya, SCN-02: 6, SCN-03: 5, SCN-04: 5)
- `scenario --golden`: senaryo çalıştırılmadan önce golden artefaktları oturuma kopyalar
- `scenario.mjs` → `seedArtifacts(dir, sourceDir)` dışa açıldı

### Değişti

- `tools/demo-scenario.mjs` yeniden yazıldı: golden koşu (27/27) + bozuk kanıt testi (2 fail)
- `tests/README.md`: golden dizinleri ve `--golden` kullanımı
- `docs/SENARYO-CALISTIRICI.md`: 1.2.0, golden akışı
- Sürüm 1.2.0

### Sonuç

| | 1.1.0 | 1.2.0 |
|---|---|---|
| Çalıştırılabilir assertion | 6/27 | **27/27** |
| Manuel assertion | 21 | **0** |

CI (`validate` matrisi) artık 6 işte de bu 27 assertion'ı koşuyor.

---

## [1.1.1] — 2026-11-09

### Eklendi

- `site/index.html`: tek dosya landing sayfası (harici CDN/font yok, göreli bağlantılar)
- `docs/tools/build-site.mjs`: landing + dashboard'u `site/` altında birleştirir
- `docs/SITE.md`: site yapısı ve alan adı bağlama adımları

### Değişti

- GitHub Pages artık `site/` yayınlıyor: kök landing, dashboard `/dashboard/` altında
- README'deki canlı bağlantılar ikiye ayrıldı (site + dashboard)

---

## [1.1.0] — 2026-11-09

### Eklendi

**Senaryo çalıştırıcısı**
- `dora-onboard scenario --session <id> --file <yaml> | --all`: assertion'ları oturum artefaktları
  üzerinde deterministik olarak değerlendirir
- `src/orl/scenario.mjs`: `check` DSL — exists, eq, ne, gte, lte, truthy, contains, `all_of`, `any_of`
- Sonuç `scenario-<id>-results.json` olarak oturuma yazılır ve kanıt paketine girer
- `SCN-04`'ün 6 assertion'ı check ile bağlandı (erişim, şifreleme, segmentasyon, zafiyet, olay)
- `tools/demo-scenario.mjs` + CI adımı
- `docs/SENARYO-CALISTIRICI.md`

### Değişti

- `scenario.schema.json`: `check` bloğu şemaya eklendi (katı modda geçerli)
- Sürüm 1.1.0

### Notlar

- Kalan 21 assertion `check` tanımsız olduğu için **manuel** sayılıyor; "tümü geçti" ifadesi
  yalnızca çalıştırılabilir assertion'lar için geçerlidir.

---

## [1.0.0] — 2026-11-08

### Eklendi

**Katı doğrulama**
- `validate --strict`: şemada tanımlı olmayan alanlar hata sayılır
- `jsonschema.mjs`: `allOf` ve `oneOf` desteği
- CI'da `validate --strict` ilk adım

**CI matrisi**
- Ubuntu + Windows × Node 18 / 20 / 22 — 6 iş; "bağımlılıksız" iddiasının kanıtı

**Üretim**
- `docs/URETIM-KONTROL-LISTESI.md`: kurulum, lisans, veri, kanıt, raporlama, devir teslim

### Düzeltildi

Katı mod ilk çalıştırmada **12 tanımsız alan** buldu; hepsi şemalara eklendi (veri değişmedi):

- roles: `layer`, `purpose`, `process_codes`, `notes`, `skills[].name` + 7 kök alan
- processes: `control_ids`, `generated_at`, `pillar`, `source_of_truth`
- controls: `generated_at`, `source`, `purpose`, `control_families`
- glossary: `generated_at`, `source_primary`, `source_secondary` (dizi)
- scenario: `matched_criterion`, `deadline_hours`

### Notlar

- 1.0 **senaryo çalıştırıcısı içermez**; senaryolar kabul kriteri olarak durur. Çalıştırıcı 1.1.

---

## [0.13.0] — 2026-11-08

### Eklendi

**Timeline sıra denetimi**
- Senaryo timeline'ındaki `T-30g` / `T+4sa` / `T+1ay` ifadeleri dakikaya çevrilip artan sırada
  olup olmadığı denetleniyor; tanınmayan ifade de hata sayılıyor
- Şema bunu yakalayamaz (zaman serbest metin); kontrol katalog doğrulamasında

### Düzeltildi

- `SCN-04` timeline'ı sıra bozuktu: `T+1g` olayı `T+1sa` olayından önce yazılmıştı.
  SIEM olayı `T+1sa`ya, hesapların kapatılması `T+2sa`ya alındı; sıra artık tutarlı.

---

## [0.12.0] — 2026-11-08

### Eklendi

**Senaryo şeması ve iş kuralı denetimi**
- `schema/scenario.schema.json`: 4 sentetik senaryonun yapısı (başlık, given/when/then,
  assertion'lar, tuzak testleri, timeline, beklenen kanıtlar)
- `validate` artık **14 dosya** denetliyor; senaryolarda şemaya ek olarak:
  - `assertions_total` = gerçek assertion sayısı
  - benzersiz assertion/tuzak ID'leri
  - anılan süreç ve kontrol ID'lerinin katalogda bulunması

### Notlar

- Senaryo YAML'larında `given/when/then` üst düzey anahtarlar; ilk şema denemesi bunları
  `scenario` altında sandı ve dört dosyayı da reddetti. Şema gerçek yapıya göre düzeltildi.

---

## [0.11.0] — 2026-11-08

### Eklendi

**Eşleme ve lifecycle şemaları**
- `schema/mapping.schema.json`: 28 maddenin yapısı (id deseni, zorunlu süreç/kontrol/rol, status enum)
- `schema/lifecycle.schema.json`: 6 faz, adım/kapı/süre, otonomi rampası, promotion_gates
- `validate` artık **10 dosya** denetliyor; CI kapsamı genişledi

### Düzeltildi

- `promotion_gates` C6'da nesne (shadow_to_semi / semi_to_auto → kriter listesi); şema dizi sanıyordu.
  Şema düzeltildi.

---

## [0.10.0] — 2026-11-08

### Eklendi

**Katalog doğrulaması (validate)**
- `dora-onboard validate [--json]`: 8 YAML dosyasını `schema/` altındaki 5 JSON Schema'ya göre denetler
- `jsonschema.mjs`: `$ref` (aynı dosya ve komşu dosya) + `anyOf` desteği eklendi
- CI'da ilk adım: veri şemayı kırarsa push kırmızı
- `docs/KATALOG-DOGRULAMA.md`

### Düzeltildi (doğrulamanın ilk çalıştırmasında çıkan gerçek hatalar)

- `common.schema.json` DoraReference yalnızca `article` istiyordu; 6 sözlük terimi ve 2 karar kuralı
  yalnızca RTS referansı taşıyor. Kural `anyOf: article | rts_its` yapıldı.
- `DefenceLine` yalnızca 1/2/3 kabul ediyordu; ROL-CEO-01 yönetim organı olduğu için `null`.
  Enum'a `null` eklendi.
- 11 rolde `human_oversight.required_for` değerleri (approval, strategy_approval,
  risk_appetite_change, crisis_declaration, scope_change, disclosure) şemada yoktu; enum genişletildi.
- **PRC-INC-06'da geçersiz `clock_start: publication`** vardı — 0.4.0'da benim yazdığım SLA.
  Veri düzeltildi: "Paydaş güncellemesi / 24 saat / classification".

---

## [0.9.0] — 2026-11-08

### Eklendi

**Artefakt şema doğrulaması**
- `schema/artifacts/` altında 7 şema: incident-record, classification-decision, impact-assessment,
  notification-receipt, gap-analysis, go-live, register-of-information
- `src/orl/jsonschema.mjs`: bağımlılıksız, draft alt kümesi (type, required, properties,
  additionalProperties, enum, pattern, min/max, items)
- `ingest` artık şemayı çalıştırıyor: uyuşmazsa dosyayı **reddediyor**, gerekçeyi yol bazında yazıyor
- `--lenient`: şema uyuşmazlığını reddetme, "şema uyarısı" olarak kaydet
- `ingest-log.json` her dosya için `schema` alanı taşıyor ("şema uyumlu", "şema uyarısı: ...", "şema yok")

**Test**
- `demo-ingest.mjs`: geçersiz sınıflandırma reddi, lenient kabulü ve kayıt içeriği doğrulanıyor

### Değişti

- `docs/KONNEKTOR.md`: artefakt şeması tablosu ve kısmi doğrulama sınırı

---

## [0.8.0] — 2026-11-08

### Eklendi

**Konnektör sözleşmesi (dosya bırakma)**
- `dora-onboard ingest --session <id> --from <dizin>`: JSON doğrular, opak kanıtları (pdf/xml/xbrl) alır,
  bilinmeyen uzantıyı reddeder (`--allow-unknown` ile geçer)
- Her alım `ingest-log.json`'a eklenir: dosya, tür, boyut, sha256, kaynak, zaman
- `docs/KONNEKTOR.md`: sözleşme, desteklenen dosyalar, Splunk/ServiceNow/Archer örnekleri, sınırlar

**Takvim tarih hesabı**
- `calendar --next <gün> --anchors <yaml>`: önümüzdeki N günün yükümlülükleri
- `mi --anchors <yaml> --days <gün>`: MI paketine "Yaklaşan yükümlülükler" bölümü
- `data/calendar-anchors.example.yaml`: aylık/yıllık/tek seferlik tarih kuralları

**Test**
- `tools/demo-ingest.mjs`: alım, ret, sha256 kaydı, tarih hesabı ve MI entegrasyonu

### Düzeltildi

- **BOM'lu JSON reddediliyordu.** Windows araçlarının yazdığı UTF-8 BOM artık tolere ediliyor
  (ingest, mi ve notify okuma yolları).
- **Takvim tarihleri bir gün kayıyordu.** `toISOString()` UTC'ye çevirdiği için 30 Nisan
  "29 Nisan" görünüyordu; yerel tarih biçimlendirmesi eklendi.

---

## [0.7.0] — 2026-11-08

> 0.5 olarak planlanan MI paketi bu sürümde teslim edildi (sıra 0.6'dan sonraya kaymıştı).

### Eklendi

**Yönetim kurulu MI paketi (Art-05 / Art-06)**
- `PRC-RSK-06` Yönetim Kurulu Raporlaması ve MI Paketi + `CTL-RSK-012` üretim/onay kontrolü
- `dora-onboard mi --session <id> --period YYYY-MM`: tek sayfa HTML + JSON
- 6 KPI, her biri kaynak dosyasıyla; veri yoksa "veri yok", uydurma değer yok
- Kırmızı bayraklar: açık büyük olay, %100 altı kapsam, açık kritik boşluk

**Düzenleyici takvim**
- `data/regulatory-calendar.yaml`: 9 yükümlülük (olay bazlı, aylık, yıllık, 3 yılda bir)
- `dora-onboard calendar [--frequency ...]`: süre, madde, süreç ve sahip tek listede

**Test**
- `demo-export.mjs` artık MI paketini de üretip doğruluyor (6/6 KPI, bayrak yok, çıktılar yazıldı)

**Belge**
- `docs/MI-PAKETI.md`

### Değişti

- Süreç **23 → 24**, kontrol **35 → 36**
- `PRC-RSK-05` kontrol listesine eksik olan `CTL-RSK-010` eklendi (katalogda vardı, süreçte yoktu)
- Art-05 ve Art-06 eşlemeleri PRC-RSK-06 / CTL-RSK-012'yi gösteriyor

---

## [0.6.1] — 2026-11-08

### Değişti

- **`export` imza olmadan çalışmıyor.** İmza anahtarı yoksa komut çıkış kodu 1 ile reddediyor;
  bilinçli imzasız üretim için `--allow-unsigned` gerekiyor.

### Gerekçe

Hash zinciri paketin kendi içinde tutarlılığını kanıtlar; manifest de yeniden üretilirse imzasız
durumda kurcalama yakalanmaz. Üretimde imza artık varsayılan, imzasızlık istisna.

---

## [0.6.0] — 2026-11-08

> Not: 0.5 (yönetim kurulu MI paketi) atlandı; sıra kanıt ve bildirim araçlarına verildi.

### Eklendi

**Kanıt paketi (export / verify)**
- `onboarding/cli/src/orl/evidence.mjs`: bağımlılıksız ZIP yazıcı/okuyucu (`store` yöntemi),
  sha256 hash zinciri, Ed25519 imza, manifest üretimi
- `dora-onboard export` — oturum artefaktlarını `evidence-out/<oturum>-evidence.zip` olarak paketler
- `dora-onboard verify` — dosya özetlerini, zinciri ve imzayı doğrular; kurcalamada çıkış 1

**Bildirim formu (notify)**
- `onboarding/cli/src/orl/notify.mjs`: ITS 2024/2956 alan sözlüğünü oturum artefaktlarıyla doldurur
- `dora-onboard notify --phase initial|intermediate|final` — JSON + Markdown + yazdırılabilir HTML
- Eksik zorunlu alan varsa form üretilir ama `complete:false` işaretlenir ve çıkış kodu 2 olur
- `--check` ile dosya yazmadan doğrulama

**Test**
- `onboarding/cli/tools/demo-export.mjs`: uçtan uca demo — paket, doğrulama, kurcalama testi,
  üç bildirim formu, eksik alan testi. CI'da her push'ta çalışır.

**Belge**
- `docs/KANIT-PAKETI.md`: paket yapısı, zincir formülü, imza, garanti sınırları, kullanım

### Değişti

- Sürüm 0.6.0
- `.gitignore`: `.demo-export/`, `notifications/`, `evidence-out/`
- ITS alan sözlüğünde `recurring_risk` kaynağı `incident-record.json#recurring_risk` olarak netleştirildi

---

## [0.4.1] — 2026-11-08

### Eklendi

- `CTL-RSK-011` Yedekleme ve geri yükleme doğrulaması: yedek konumu (ayrı / değiştirilemez),
  şifreleme, saklama süresi, geri yükleme testi, RTO ölçümü ve bütünlük hash'i
- `PRC-RSK-04` kanıt şartnamesine `backup-restore-test.json` eklendi

### Değişti

- Art-12 (yedekleme) **partial → covered**; kapsam **%96 → %100** (28/28)
- Kontrol **34 → 35**
- `verify` notu: C5 kapısı artık hiçbir maddede boşluk/kısmi görmüyor

---

## [0.4.0] — 2026-11-08

### Eklendi

**Kriz iletişimi (Madde 14) — kapsamdaki son boşluk kapandı**
- `PRC-INC-06` Kriz İletişimi ve Paydaş Bildirimi: sözcü matrisi, 4 saatlik ilk açıklama,
  müşteri/basın kanal kuralları, yanlış bilgi düzeltme (2 saat)
- `CTL-INC-009` hazırlık ve onay kontrolü (şablon sürümü, onaylayan, yayın zamanı, SLA uyumu)

**Ödeme olaylarının ayrı bildirimi (Madde 23)**
- `PRC-INC-07` Ödeme ile İlgili Olayların Ayrı Bildirimi: ödeme zinciri etkisi, çift kanal
  (DORA + TCMB) zorunluluğu, INC-R14/INC-R15 kuralları
- `CTL-INC-010` ödeme etkisi ve çift kanal kayıt kontrolü

**Bildirim şablonu alan sözlüğü (Madde 20)**
- `data/mapping/its-2024-2956.yaml`: ilk / ara / nihai bildirim alanları, her alanın zorunluluğu
  ve beslendiği kanıt dosyası. Resmi XBRL taksonomi kodlarının bağlanması uygulama adımıdır.

**Raporlama görünürlüğü**
- `docs/tools/build-coverage-summary.mjs` → `docs/KAPSAM-OZETI.md` (üretilen kapsam tablosu)
- `docs/RAPORLAMA-ANALIZI.md`: raporlama yükümlülükleri matrisi, kalan boşluklar, öneriler

### Değişti

- Süreç **21 → 23**, kontrol **32 → 34**
- DORA kapsaması **%86 → %96**: 27 covered, 1 partial (Art-12), 0 gap
- `dora-articles.yaml` **1.1.0**: Art-14 gap → covered; Art-20 ve Art-23 partial → covered;
  Art-19 artık gönüllü tehdit bildirimini (PRC-INC-05) de gösteriyor
- `docs/dora-mapping.md`, `dashboard/` ve `docs/KAPSAM-OZETI.md` yeniden üretildi

### Düzeltildi

- Art-19 eşlemesi `PRC-INC-05` + `CTL-INC-008`'i göstermiyordu: süreç pakette vardı ama
  eşlemede görünmüyordu, bu yüzden "gönüllü bildirim yok" gibi okunuyordu
- `docs/DURUM.md` başlık tarihi ve dashboard sayaçları güncel değildi

---

## [0.3.0] — 2026-11-04

### Eklendi

**Siber güvenlik kontrolleri (DORA Madde 9) — uçtan uca**
- `PRC-RSK-05` süreci: erişim (en az yetki), şifreleme/anahtar yönetimi, ağ segmentasyonu,
  zafiyet kapatma; 4 karar kuralı (SEC-R1…R4), 4 SLA, tier varyantı
- 4 yeni kontrol: `CTL-RSK-007` (erişim gözden geçirme), `CTL-RSK-008` (şifreleme),
  `CTL-RSK-009` (segmentasyon), `CTL-RSK-010` (zafiyet kapatma)
- `tests/synthetic-scenarios/scenario-security-controls.yaml` (SCN-04): 6 assertion,
  4 tuzak testi, 5 kanıt dosyası — "kontrol var" ile "kontrol kanıtlanıyor" farkını sınar
- Fixture: `fixtures/security-controls-2026-08.json`

**Dashboard**
- `docs/tools/build-dashboard.mjs` → `dashboard/index.html` + `dashboard/data.json`
  (depodaki YAML'lardan üretilir, elle düzenlenmez)
- `docs/tools/render_dashboard.py` → `dashboard/dashboard.png` (tarayıcısız, Pillow)
- Kutucuklar: süreç/kontrol/ajan/terim/senaryo/kapsama; ORL faz tablosu, açık noktalar,
  senaryo listesi, referans sağlığı

### Değişti

- DORA kapsaması **%79 → %86**: Art-07 (sıkılaştırma) ve **Art-09** (koruma/şifreleme)
  artık `covered`; kalan tek boşluk Art-14 (kriz iletişimi)
- Kontrol sayısı 28 → **32**; süreç 20 → **21**; senaryo 3 → **4** (27 assertion)
- `package.json` sürümü 0.3.0

### Notlar

- Art-09 kapatılırken paketin "ISO 27001 setine bırakılmış" varsayımı kaldırıldı: dört kontrol
  artık paketin içinde, kanıt şartnamesiyle tanımlı.
- Dashboard, `render-mapping` gibi **üretilen** bir artefakt; CI'da `--check` benzeri kullanım
  için `build-dashboard.mjs` sarkan referans bulursa çıkış kodu 1 döner.

---

## [0.2.0] — 2026-11-03

Bu sürüm, konuşma dökümündeki taslakları **çalışan ve doğrulanmış** bir depoya çevirir.

### Eklendi

**Süreç kütüphanesi (Modül 2)**
- `data/processes/pillar-{1..5}.yaml` — 20 süreç: PRC-RSK-01..04, PRC-INC-01..05,
  PRC-TST-01..03, PRC-TPP-01..06, PRC-INF-01..02
- Her süreçte tetikleyici, girdi/çıktı (saklama süresiyle), SLA, karar kuralları (DORA madde
  referanslı), bağımlılıklar, `control_ids`, tier varyantları

**Kontrol kataloğu (Modül 3)**
- `data/controls/controls-catalog.yaml` — 28 kontrol (RSK 6, INC 8, TST 4, TPP 7, INF 3)
- Her kontrolde kanıt şartnamesi (format + değiştirilemezlik + zorunlu alanlar) ve `test_procedure`

**Sentetik senaryolar (Modül 5)**
- `tests/synthetic-scenarios/` — SCN-01 (8 assertion), SCN-02 (7), SCN-03 (6) + 3 fixture
- `tests/README.md` — senaryo formatı ve kapı kuralı

**Onboarding (Modül 4)**
- `onboarding/orl-lifecycle.yaml` — ORL 6 fazı, kapı kriterleri, otonomi merdiveni
- `onboarding/wizard-spec.md` — tasarım gerekçesi, eski 8 adım → 6 faz eşlemesi
- `onboarding/cli/bin/dora-onboard.mjs` — **bağımlılıksız** çalışan CLI (`init`, `phase`, `gate`,
  `status`, `phases`, `rollback`); bağımlılık eklemeden kendi mini YAML okuyucusu
- `onboarding/cli/src/orl/{yaml,lifecycle,checks,session,license}.mjs`

**DORA eşlemesi (Modül 6)**
- `data/mapping/dora-articles.yaml` — 28 yükümlülük maddesi → süreç/kontrol/rol
- `docs/dora-mapping.md` — **üretilen** doküman (22 covered, 4 partial, 2 gap = %79)
- `docs/local-equivalents-TR.md` — BDDK/TCMB/SEDDK/SPK/KVKK eşlemesi, süre farkları
- `docs/tools/render-mapping.mjs`, `docs/tools/build-coverage.mjs`

**Mimari ve süreç dokümanları (Modül 7)**
- `docs/architecture.md` — katman modeli, ajan çalışma modeli, denetim izi, bilinçli sınırlar
- `docs/decisions.md` — DR-001…DR-008 karar kaydı

**Pilot (Modül 8)**
- `pilots/case-study-template.md` — ölçüm odaklı vaka çalışması şablonu

**Lisanslama**
- `LICENSE` — AGPL-3.0 tam metni
- `LICENSE-COMMERCIAL.md` — ticari lisans şablonu
- `docs/licensing.md` — hangi durumda hangi lisans (karar tablosu + SSS)
- `docs/pricing.md` — fiyatlandırma çerçevesi (katman aralıkları, indirim politikası)
- `CLA.md`, `CONTRIBUTING.md` — katkı süreci
- `docs/license-keys.md` — Ed25519 imzalı anahtar mekanizması
- Lisans kapısı: `C1-0` (imza + süre + tier), `C6-0` (üretime geçişte ticari lisans);
  anahtarsız 30 gün deneme modu

### Değişti

- `PRC-INC-02` ilk bildirim SLA'sı **4 saat** (DR-001) — tier2/tier3 varyantları da 4 saat
- `common.schema.json` → `DoraReference.required` yalnız `article` (DR-003)
- `roles.schema.json` → rol ID deseni 3-4 harf (`ROL-TLPT-01`, `ROL-CTPP-01` için) (DR-003)
- `data/roles/roles-catalog.yaml` → her role `process_codes` eklendi (21 kod)
- `onboarding/cli/package.json` → `"license": "AGPL-3.0-only"`
- `README.md` → lisans bölümü, çift lisans açıklaması, güncel CLI kullanımı

### Düzeltildi

- `OR.KIB.ARCH` sahipsiz koddu → `ROL-CIO-01`e atandı (mapping ↔ rol paritesi 21 = 21)
- `glossary-full.yaml` içindeki 17 süreç referansı çözüldü (sarkan referans yok)
- Rol deseni hatası: katalog kendi şemasına uymuyordu
- `DoraReference` hatası: şema kendi verisinin %100'ünü reddediyordu

### Güvenlik

- Lisans anahtarı Ed25519 ile imzalanır, çevrimdışı doğrulanır (`node:crypto`, ek bağımlılık yok)
- `onboarding/license/dev-private.pem` `.gitignore`'da; üretim anahtarı depoda tutulmaz

---

## [0.1.0] — 2025-01-15

### Eklendi
- İlk sözlük şeması (common, glossary, roles, processes, controls)
- 60 terimlik DORA sözlüğü (6 kategori)
- 11 ajan rolü kataloğu
- 5 sütun süreç kütüphanesi
- 8 adımlı onboarding wizard iskeleti
- Pilot seçim modeli ve dokümanları
- Yerel muadil eşleme (TR)

---

## Yol Haritası

- [x] v0.2.0 — Çalışan ORL wizard, süreç/kontrol katalogları, DORA eşlemesi
- [ ] v0.3.0 — Wizard web arayüzü
- [ ] v0.4.0 — Entegrasyon konnektörleri (Splunk, ServiceNow, Archer)
- [ ] v0.5.0 — platform API adaptörü + MOS panosu
- [ ] v0.6.0 — Deterministik kural motoru (CEL/Rego) — `condition` alanları yürütülebilir olur
- [ ] v1.0.0 — Üretim sürümü

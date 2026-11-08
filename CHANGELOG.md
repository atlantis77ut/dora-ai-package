# Changelog

Bu dosya, paketin sürüm geçmişini tutar. Biçim: [Keep a Changelog](https://keepachangelog.com/tr/1.1.0/),
sürümleme: [SemVer](https://semver.org/lang/tr/).

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
- `onboarding/cli/src/corf/evidence.mjs`: bağımlılıksız ZIP yazıcı/okuyucu (`store` yöntemi),
  sha256 hash zinciri, Ed25519 imza, manifest üretimi
- `dora-onboard export` — oturum artefaktlarını `evidence-out/<oturum>-evidence.zip` olarak paketler
- `dora-onboard verify` — dosya özetlerini, zinciri ve imzayı doğrular; kurcalamada çıkış 1

**Bildirim formu (notify)**
- `onboarding/cli/src/corf/notify.mjs`: ITS 2024/2956 alan sözlüğünü oturum artefaktlarıyla doldurur
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
- Kutucuklar: süreç/kontrol/ajan/terim/senaryo/kapsama; CORF faz tablosu, açık noktalar,
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
- `onboarding/corf-lifecycle.yaml` — CORF 6 fazı, kapı kriterleri, otonomi merdiveni
- `onboarding/wizard-spec.md` — tasarım gerekçesi, eski 8 adım → 6 faz eşlemesi
- `onboarding/cli/bin/dora-onboard.mjs` — **bağımlılıksız** çalışan CLI (`init`, `phase`, `gate`,
  `status`, `phases`, `rollback`); bağımlılık eklemeden kendi mini YAML okuyucusu
- `onboarding/cli/src/corf/{yaml,lifecycle,checks,session,license}.mjs`

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
- `data/roles/roles-catalog.yaml` → her role `corf_process_codes` eklendi (21 kod)
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

- [x] v0.2.0 — Çalışan CORF wizard, süreç/kontrol katalogları, DORA eşlemesi
- [ ] v0.3.0 — Wizard web arayüzü
- [ ] v0.4.0 — Entegrasyon konnektörleri (Splunk, ServiceNow, Archer)
- [ ] v0.5.0 — GOLDENHORN API adaptörü + MOS panosu
- [ ] v0.6.0 — Deterministik kural motoru (CEL/Rego) — `condition` alanları yürütülebilir olur
- [ ] v1.0.0 — Üretim sürümü

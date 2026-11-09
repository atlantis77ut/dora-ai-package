# Changelog

Bu dosya, paketin sürüm geçmişini tutar. Biçim: [Keep a Changelog](https://keepachangelog.com/tr/1.1.0/),
sürümleme: [SemVer](https://semver.org/lang/tr/).

---

## [1.1.0] — 2026-11-09

### Eklendi

**Senaryo çalıştırıcısı**
- `dora-onboard scenario --session <id> --file <yaml> | --all`: assertion'ları oturum artefaktları
  üzerinde deterministik olarak değerlendirir
- `src/corf/scenario.mjs`: `check` DSL — exists, eq, ne, gte, lte, truthy, contains, `all_of`, `any_of`
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

- roles: `layer`, `purpose`, `corf_process_codes`, `notes`, `skills[].name` + 7 kök alan
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
- `src/corf/jsonschema.mjs`: bağımlılıksız, draft alt kümesi (type, required, properties,
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

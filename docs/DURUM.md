# DURUM — Depo Envanteri ve Sonraki Adımlar

Bu dosya, `dora-ai-package/` deposunun hangi parçalarının hazır olduğunu ve nereden geldiğini kaydeder.

Son güncelleme: 2026-11-08

---

## 1. Hazır dosyalar

### Şema (5 dosya — değiştirilmedi, dökümden birebir)

| Dosya | Satır | Not |
|---|---|---|
| `schema/common.schema.json` | 54 | Ortak tipler: Version, DoraReference, Tier, DefenceLine, SLA, Regulator, I18nText |
| `schema/glossary.schema.json` | 57 | Terim nesnesi, kategori enum'u |
| `schema/roles.schema.json` | 100 | Rol, beceri, KPI, insan gözetimi, tier aktivasyonu |
| `schema/processes.schema.json` | 86 | Süreç, girdi/çıktı, SLA, karar kuralı, bağımlılık |
| `schema/controls.schema.json` | 50 | Kontrol tipi, kanıt şartnamesi, değiştirilemezlik |

Hepsi `json.loads` ile doğrulandı.

### Veri

| Dosya | Satır | Durum |
|---|---|---|
| `data/glossary/glossary-full.yaml` | 560 | 60 terim, 6 kategori — dökümden birebir |
| `data/glossary/glossary-seed.yaml` | 45 | 3 örnek terim (dökümde 20 hedeflenmişti, 3'ü yazılmış) |
| `data/roles/roles-catalog.yaml` | 1.180 | 11 ajan — dökümden birebir |
| `data/orl-integration/agent-to-orl-mapping.yaml` | 222 | 11 ajan → süreç kodu → platform modülü |
| `data/processes/pillar-1-risk.yaml` | 4 süreç | **yeni yazıldı** (PRC-RSK-01..04) |
| `data/processes/pillar-2-incident.yaml` | 5 süreç | **yeni yazıldı** (PRC-INC-01..05) |
| `data/processes/pillar-3-testing.yaml` | 3 süreç | **yeni yazıldı** (PRC-TST-01..03) |
| `data/processes/pillar-4-thirdparty.yaml` | 6 süreç | **yeni yazıldı** (PRC-TPP-01..06) |
| `data/processes/pillar-5-infosharing.yaml` | 2 süreç | **yeni yazıldı** (PRC-INF-01..02) |
| `data/controls/controls-catalog.yaml` | 598 | **yeni yazıldı**: 28 kontrol (RSK 6, INC 8, TST 4, TPP 7, INF 3), her süreç en az bir kontrolle eşleşiyor |

Toplam **20 süreç**, **28 kontrol**. Her süreçte `control_ids` alanı hangi kontrollerle denetleneceğini gösterir.

### Wizard ve pilot

| Dosya | Durum |
|---|---|
| `onboarding/cli/package.json` | dökümden |
| `onboarding/cli/bin/dora-onboard.js` | dökümden (CLI komutları) |
| `onboarding/cli/src/index.js` | dökümden (orkestratör + rollback + validate) |
| `onboarding/cli/src/steps/step-1-profile.js` | dökümden |
| `onboarding/cli/src/steps/step-4-agents.js` | dökümden (bağımsızlık kontrolleri) |
| `onboarding/templates/institution-profile.template.yaml` | dökümden |
| `pilots/*` (6 dosya) | dökümden: scoring model, seçim kriterleri, başarı kriterleri, geri bildirim döngüsü, ön değerlendirme formu, pilot sözleşmesi |

### Kök

`README.md`, `CHANGELOG.md`, `.gitignore`, `docker-compose.yml` — dökümden.

---

## 2. Doğrulama

| Kontrol | Sonuç |
|---|---|
| 5 JSON şema parse | geçti |
| YAML yapısal kontrol (sekmeler, dengesiz `{}`, akış eşlemeleri) | geçti |
| Süreç ID formatı `^PRC-[A-Z]{3}-\d{2}$` | 20/20 geçti |
| Süreç zorunlu alanları (name, pillar, trigger, inputs, outputs, responsible_roles, slas) | 20/20 tam |
| Pillar ↔ ID kodu uyumu (RSK/INC/TST/TPP/INF) | geçti |
| `glossary-full.yaml` içindeki 17 süreç referansı | hepsi tanımlı, sarkan referans yok |
| Süreçler arası `dependencies` referansları | hepsi tanımlı |

Doğrulama betiği: `../dora/_lint.py` çalıştırıldı, sıfır sorun.

---

## 3. Eksikler

| # | Eksik | Modül |
|---|---|---|
| 1 | ~~`data/controls/controls-catalog.yaml`~~ — **tamamlandı** (28 kontrol) | 3 ✔ |
| 2 | Wizard kod modülleri: `orl-*.js` (lifecycle tanımı hazır, çalışan kod yok) + eski `step-{0,2,3,5,6,7,8}.js` | 4 |
| 3 | `tests/synthetic-scenarios/*.yaml` — 3 kabul senaryosu | 5 |
| 4 | `docs/dora-mapping.md`, `docs/local-equivalents-TR.md` | 6 |
| 5 | `docs/architecture.md` | 7 |
| 6 | Pilot vaka çalışması şablonu | 8 |
| 7 | `LICENSE` (lisans tipi belirlenmedi), kök `package.json` | — |
| 8 | `data/glossary/glossary-seed.yaml` 3 terimde kaldı (20 hedefi) | — |

---

## 4. Nasıl üretildi

- **Birebir çıkarılan dosyalar:** `dora/dora-tam-konusma.md` içindeki kod blokları, satır numaraları sabitlenerek kesildi (`dora/kaynak/build_repo.py` — hangi dosyanın hangi satır aralığından geldiğini gösterir). Metin değiştirilmedi; yalnızca satır sonları normalize edildi.
- **Yeni yazılan süreçler:** dökümdeki süreç listesi (satır 303-374), 5 sütun anlatımı (satır 40-202) ve `processes.schema.json` alanlarına göre yazıldı. Dökümde adı geçen 18 sürece ek olarak, sözlüğün referans verdiği `PRC-RSK-04` (BCP/DRP) ve `PRC-TPP-06` (çıkış stratejisi) tanımlandı — böylece sarkan referans kalmadı.
- **ID standardı:** dökümde üç farklı yazım vardı (`PRC-RISK` / `PRC-RSK`, `PRC-TEST` / `PRC-TST`, `PRC-INFO` / `PRC-INF`). Şemanın 3 harfli desenine uyan ve sözlükle uyumlu olan **RSK / TST / INF** seçildi.

---

## 5. ORL 6 fazlı onboarding tasarımı (2026-10-30)

Dökümün sonunda sorulan "wizard'ı ORL'un 6 fazına göre yeniden tasarlayalım mı?" sorusuna karşılık:

| Dosya | Ne |
|---|---|
| `onboarding/orl-lifecycle.yaml` | 6 faz, makine okunur: her fazın adımları, ajan otonomi seviyesi, insan rolleri, KIB artefaktları, çıktılar, **geçiş kapısı kriterleri**, süre, tier varyantı |
| `onboarding/wizard-spec.md` | Tasarım gerekçesi: neden değişti, eski 8 adım → 6 faz eşlemesi, otonomi merdiveni, kapı mantığı, CLI akışı, ölçek uyarlaması |

Fazlar: **C1 Identify** → **C2 Set tolerances** → **C3 Map resources + ajan aktivasyonu** → **C4 Scenario tests** → **C5 Self-assessment** *(yeni)* → **C6 Implement MOS**.

Ajan "eğitimi" otonomi merdiveniyle tanımlandı: `observe` (C1–C2) → `recommend` (C3–C4) → `act_with_approval` (C5–C6) → `act_autonomous` (yalnız C6, düşük etkili işler).

### Bu turda bulunan ve düzeltilen iki hata

**1. "ORL kodları beceri listesine entegre edildi" iddiası dosyalarda doğru değildi.**
`roles-catalog.yaml` içinde 42 genel beceri vardı ama **tek bir `OR.*` kodu yoktu**; kodlar yalnızca `agent-to-orl-mapping.yaml` içinde duruyordu. Düzeltme: `/dora/_enrich.py` ile mapping'den türetilerek her role `process_codes` alanı eklendi. Sonuç: 20 benzersiz `OR.*` kodu, 11/11 rolde, mapping ile tam parite.

**2. Şema kendi verisini reddediyordu.**
`roles.schema.json` deseni `^ROL-[A-Z]{3}-\d{2}$` idi; ama katalogda `ROL-TLPT-01` ve `ROL-CTPP-01` (4 harf) var. Desen `^ROL-[A-Z]{3,4}-\d{2}$` yapıldı. Bu hata, türetme betiğinin ilk çalışmasında iki rolü atlamasıyla ortaya çıktı — aynı hata `data/glossary/glossary-full.yaml` içindeki `related_roles` referanslarını da etkiliyordu.

### Doğrulama (bu tur)

| Kontrol | Sonuç |
|---|---|
| `process_codes` eklenen rol | 11/11 |
| Mapping ↔ rol kataloğu `OR.*` kodu paritesi | 20 = 20 |
| Lifecycle'da geçen rol ID'lerinin katalogda bulunması | 11/11 (bilinmeyen yok) |
| Lifecycle'da geçen süreç ID'lerinin tanımlı olması | 4/4 (bilinmeyen yok) |

---

## 6. Modül 3 — Kontroller kataloğu (2026-11-03)

`data/controls/controls-catalog.yaml`: 28 kontrol, 5 aile, her biri `controls.schema.json` alanlarına uygun.

| Aile | Kontrol | Kapsanan süreçler |
|---|---|---|
| CTL-RSK | 001-006 | çerçeve gözden geçirme, risk iştahı aşımı, envanter uzlaştırma, kayıt dışı varlık, BCP/DRP testi, değişiklik risk kapısı |
| CTL-INC | 001-008 | SIEM korelasyonu, sınıflandırma dört-göz, 4 saat SLA sayacı, bildirim onayı, 72 saat takibi, nihai rapor, RCA→kontrol döngüsü, gizlilik kontrolü |
| CTL-TST | 001-004 | test kapsamı, testçi bağımsızlığı, kritik bulgu kapatma, TLPT döngüsü |
| CTL-TPP | 001-007 | durum tespiti tamlığı, kritiklik yenileme, yoğunlaşma eşiği, Madde 30 maddeleri, RoI bütünlüğü, CTPP öneri takibi, çıkış tatbikatı |
| CTL-INF | 001-003 | gizlilik taraması, anonimleştirme doğrulaması, anlaşma geçerliliği |

Her kontrol: `process_id`, `owner_role`, `type` (preventive/detective/corrective/directive), `frequency`, kanıt şartnamesi (format + değiştirilemezlik + zorunlu alanlar), `dora_ref`, `test_procedure` (denetçinin soracağı somut soru).

Süreç ↔ kontrol bağı iki yönlü: kontrolde `process_id`, süreçte `control_ids`.

### Bu turda bulunan ve düzeltilen hata

**`common.schema.json` içindeki `DoraReference`, `paragraph` alanını zorunlu tutuyordu.** Ama veri dosyalarının tamamı (sözlük, roller, süreçler) yalnızca `article` ile referans veriyor — yani şema kendi verisinin %100'ünü reddediyordu. `required: ["article"]` yapıldı, `paragraph` ve `rts_its` opsiyonel kaldı.

### Doğrulama (bu tur)

| Kontrol | Sonuç |
|---|---|
| Kontrol sayısı / benzersiz ID | 28 / 28 |
| ID deseni `^CTL-[A-Z]{3}-\d{3}$` | 28/28 |
| Zorunlu alanlar (name, process_id, type, evidence_spec, test_procedure) | 28/28 |
| Enum değerleri (type, frequency, evidence format, immutability) | geçti |
| `process_id` referansları | 20/20 tanımlı |
| `owner_role` referansları | 11/11 tanımlı |
| Kontrolü olmayan süreç | yok |
| Süreçteki `control_ids` ↔ katalog `process_id` tutarlılığı | 20/20 |
---

## 7. Modül 5 — Sentetik senaryolar (2026-11-03)

`tests/synthetic-scenarios/`: 3 kabul senaryosu + 3 fixture + format rehberi.

| Senaryo | Assertion | Sınadığı zincir |
|---|---|---|
| SCN-01 Büyük olay | 8 | sınıflandırma → CIO onayı → 4sa bildirim → 72sa ara rapor → 1 ay nihai rapor → RCA → kontrol güncellemesi |
| SCN-02 Tedarikçi çıkışı | 7 | yoğunlaşma eşiği → çıkış stratejisi → dual-run şartı → RoI güncellemesi → envanter uzlaştırma |
| SCN-03 Regülatör talebi | 6 | 24sa SLA → 5 kalem kanıt → maskeleme → hash zinciri → onay → erişim kaydı |

Her senaryoda üç katman var: `assertions` (yapılması gerekenler), `negative_tests` (ajanın yapmaması gerekenler — doğru sonuca yanlış gerekçeyle ulaşmak da başarısızlık), `timeline` (beklenen olay sırası).

Doğrulama: `assertions_total` alanı gerçek assertion sayısıyla eşleşiyor (8/7/6); tüm `process` ve `control` referansları katalogda var; her assertion bir kontrol ve bir süre sınırı taşıyor; fixture JSON'ları parse ediliyor.

---

## 8. Modül 4 — Wizard kodu (2026-11-03)

`orl-lifecycle.yaml` artık **çalıştırılabilir**: `onboarding/cli/bin/dora-onboard.mjs`, sıfır npm bağımlılığıyla 6 fazı yürütür.

| Dosya | Satır | Görev |
|---|---|---|
| `bin/dora-onboard.mjs` | ~200 | `init`, `phase`, `gate`, `status`, `phases`, `rollback` |
| `src/orl/yaml.mjs` | ~150 | Minimal YAML okuyucu (bağımlılık yok) |
| `src/orl/lifecycle.mjs` | ~180 | Faz yükleme/doğrulama + faz çalıştırıcıları |
| `src/orl/checks.mjs` | ~230 | Faz kapılarının çalıştırılabilir kontrolleri (21 adet) |
| `src/orl/session.mjs` | ~80 | Oturum deposu ve rollback |

### Çalıştırma kanıtı

```
$ dora-onboard phases
ORL-IMPL-6 — Implementation Lifecycle (referans platform)
  C1  4 adım, 4 kriter, 10g
  ...
✓ Faz tanımı geçerli (6 faz, sıralı, kapıları tanımlı)

$ dora-onboard init --tier tier2 --regulator BDDK
Oturum açıldı: ob-2026-dzjmpe

$ (C1..C6 phase --demo + gate)
C1 KAPI GEÇİLDİ → C2 ... C6 KAPI GEÇİLDİ — döngü tamamlandı

$ dora-onboard gate C1   (demo verisi olmadan)
  ✔ tier=tier1 — C1-1
  ✔ TR/BDDK — C1-2
  ✘ business-service-catalogue.json yok veya boş — C1-3
  ✘ BSC yok — hizmet tanımlanmamış — C1-4
KAPI GEÇİLMEDİ — sonraki faz başlatılamaz        (çıkış kodu 2)
```

`status` çıktısı faz/faz durum + kapı + artefakt sayısı gösterir; `rollback --to-phase C1` sonraki fazları temizler.

### Notlar

- Eski `bin/dora-onboard.js` (commander tabanlı, dökümden) korundu; yeni CLI onu değiştirmiyor, yanına ekleniyor.
- `package.json` bilinçli olarak değiştirilmedi (dökümden gelen hâli korunuyor); yeni CLI doğrudan `node` ile çalışır.
- Kapı kontrolleri JSON artefaktlar üzerinde çalışır; gerçek kurulumda bu artefaktları ajanlar/danışmanlar üretir, CLI yalnızca denetler.
- `--demo` bayrağı yalnızca kapı mekanizmasını göstermek için örnek veri yazar; üretimde kullanılmaz.
---

## 9. Modül 6 — DORA eşlemesi ve TR mevzuatı (2026-11-03)

| Dosya | Ne | Durum |
|---|---|---|
| `data/mapping/dora-articles.yaml` | 28 yükümlülük maddesi: özet, süreç, kontrol, rol, kapsama durumu | kaynak veri |
| `docs/dora-mapping.md` | Aynı veriden **üretilen** eşleme tablosu + madde ayrıntısı | 296 satır, otomatik |
| `docs/tools/render-mapping.mjs` | YAML → Markdown; referans bütünlüğünü de denetler (`--check`) | araç |
| `docs/local-equivalents-TR.md` | 13 konu için BDDK/TCMB/SEDDK/SPK/KVKK eşlemesi, süre farkları, ajan etkileri | 200 satır |
| `docs/tools/build-coverage.mjs` | Eşlemeden C5 fazının `coverage-matrix.json` + `gap-analysis.json` çıktısını üretir | araç |

### Kapsama sonucu (dürüst tablo)

| Durum | Madde | Örnek |
|---|---|---|
| covered | 22 | Madde 6, 8, 11, 17-19, 24-28, 30, 45 |
| partial | 4 | Madde 7 (hardening), 12 (ayrı yedekleme kontrolü), 20 (ITS şablon alanları), 23 (ödeme olayı ayrımı) |
| gap | 2 | **Madde 9 (koruma/şifreleme/erişim)**, **Madde 14 (kriz iletişimi)** |

Tam kapsama: **%79**. Paket şu hâliyle "DORA'nın tamamını kapsıyor" diyemez; iki boşluk
bilinçli olarak açık bırakıldı ve gerekçeleriyle yazıldı (ISO 27001 kontrol seti ve kriz
iletişimi planı paketin dışında).

### Uçtan uca doğrulama

```
$ node docs/tools/build-coverage.mjs --session ob-2026-8qa4av
kapsama: 22/28 covered, 4 partial, 2 gap

$ dora-onboard gate C5 --session ob-2026-8qa4av
  ✔ 28 madde — C5-1
  ✘ yüksek=2, kabul=0 — C5-2
  ✘ imza yok — C5-3
KAPI GEÇİLMEDİ                                   (çıkış kodu 2)
```

Yani Modül 6 verisi doğrudan Modül 4'ün kapısını besliyor: iki boşluk kapatılmadan ve bağımsız
doğrulama imzalanmadan C5 geçmiyor. `build-coverage.mjs` imza alanını bilerek boş bırakır —
imzayı araç değil denetçi atar.

### Türkiye eşlemesinde çıkan kritik nokta → karara bağlandı

Yaygın varsayım "yerel mevzuat DORA'dan daha katıdır" burada ters çalışıyor: DORA ilk bildirimi
4 saatte istiyor, BDDK pratiği 6 saat. **Karar (DR-001, 2026-11-03): DORA'nın 4 saati uygulanır.**
Yerel mevzuat daha uzun süre öngörse bile gevşetme yapılmaz; daha kısa öngörürse yerel süre
uygulanır (tek yönlü katılaştırma). `PRC-INC-02` ve tier varyantları 4 saate güncellendi;
`docs/decisions.md` içinde gerekçesiyle kayıtlı.
---

## 10. Modül 7 — Mimari (2026-11-03)

`docs/architecture.md` — 10 bölüm: katman modeli, veri katmanı ve bağlar, süreç katmanı
(tetikleyici → kanıt akışı), ajan çalışma modeli, üç savunma hattının kod düzeyinde karşılığı,
insan gözetimi, denetim izi, platform entegrasyonu (port/adapter), wizard mimarisi, dağıtım,
genişleme noktaları, **bilinçli sınırlar**.

Bilinçli sınırlar bölümü önemli: ajan çalıştırıcısı (LLM orkestrasyonu), platform API'si,
kod testleri ve iki DORA boşluğu açıkça "yok" olarak yazıldı — paketin ne olmadığını da
söylemesi, denetimde ve satışta güven üretir.

Ayrıca `docs/decisions.md` eklendi: 6 karar kaydı (DR-001…DR-006), her biri bağlam → karar → sonuç.

## 11. Modül 8 — Pilot vaka çalışması (2026-11-03)

`pilots/case-study-template.md` — 173 satır, 10 bölüm: künye, başlangıç ölçümleri, ORL faz
deneyimi (kapı kırılmaları dahil), senaryo sonuçları, ajan davranışı (iyi/sınırda/başarısız),
başarı kriterleri tablosu, uyum ve denetim, sorunlar, dersler, yayın izinleri, üretime geçiş kararı.

Tasarım ilkesi: **her iddia bir metriğe veya kayıt numarasına bağlanır**; ölçülemeyen alan
"veri yok" olarak bırakılır. Şablon, pilotun paketi övmesini değil, paketin nerede kırıldığını
kaydetmesini istiyor — kapı kırılmaları bölümü bunun için var.

## 12. Bu turda düzeltilen tutarsızlık

`OR.KIB.ARCH` kodu `orl-lifecycle.yaml` (C1 KIB artefaktı) ve `architecture.md` içinde geçiyordu
ama hiçbir ajan tarafından sahiplenilmemişti — C3 kapısının "sahipsiz OR.* kodu yok" kriteri
bu kodu yakalardı. `ROL-CIO-01`e atandı; mapping ve rol kataloğu tekrar pariteye geldi
(21 kod = 21 kod).
---

## 13. Lisans yapısı — çift lisans (2026-11-03)

| Dosya | Ne |
|---|---|
| `LICENSE` | AGPL-3.0 tam metni (34 KB, SPDX kaynağından indirildi) |
| `LICENSE-COMMERCIAL.md` | Ticari lisans **şablonu**: kapsam, katmanlar, anahtar, destek, garanti, fesih |
| `docs/licensing.md` | "Benim durumum hangisi?" karar tablosu + SSS + satış dili |
| `CONTRIBUTING.md` | CLA zorunluluğu ve katkı kuralları |
| `README.md` | Lisans bölümü: iki lisans, tek cümlelik sınır |
| `onboarding/cli/package.json` | `"license": "AGPL-3.0-only"` |
| `.mjs` dosyaları (7) | SPDX başlığı |

Model: **iç kullanım AGPL ile serbest; dışarıya ürün/hizmet olarak sunmak ticari lisans gerektirir.**
Gerekçe ve B (saf tescilli) modelinin olumsuzları: `docs/decisions.md` → DR-007.

Eksik: CLA metninin kendisi (şu an `CONTRIBUTING.md` içinde özet), fiyat katmanları, lisans
anahtarı doğrulama adımı, hukuk incelemesi.
---

## 14. Lisans anahtarı doğrulama (2026-11-03)

| Dosya | Görev |
|---|---|
| `onboarding/cli/src/orl/license.mjs` | Ed25519 imza doğrulama, tier/faz yetki kontrolü |
| `onboarding/cli/tools/license-gen.mjs` | Satıcı aracı: anahtar üretimi + token imzalama |
| `onboarding/license/public-key.pem` | Dağıtılabilir açık anahtar |
| `onboarding/license/dev-private.pem` | Yalnız geliştirme (`.gitignore`) |
| `docs/license-keys.md` | Biçim, üretim akışı, iptal stratejisi, sınırlar |
| `checks.mjs` | `C1-0` (lisans + tier) ve `C6-0` (ticari lisans) kapı kontrolleri |

Kurallar: imza + süre + tier her `init`/`phase`/kapıda denetlenir. Deneme modu 30 gün,
C1-C5 çalışır, **C6 kapanır**. Hatalı lisansta çıkış kodu 3.

### Doğrulama (gerçek çalıştırma)

```
init --tier tier2 --license <geçerli>   → Lisans: tier2 · Örnek Bankası A.Ş. · bitiş 2027-11-03
C1…C6                                   → hepsi KAPI GEÇİLDİ

init (anahtarsız)                        → deneme modu, 30 gün
C1…C5                                    → geçti
C6                                       → ✘ "deneme modu — üretime geçiş için ticari lisans gerekli" (çıkış 2)

bozuk imza                               → çıkış 3, "imza doğrulanamadı"
tier uyumsuz (tier2 lisans / tier3 istek)→ çıkış 3, "lisans tier=tier2, istenen tier=tier3"
süresi dolmuş                            → çıkış 3, "lisans süresi dolmuş"
```
---

## 15. Fiyatlandırma, CLA ve CHANGELOG (2026-11-03)

| Dosya | Ne | Durum |
|---|---|---|
| `docs/pricing.md` | Fiyat çerçevesi: 3 fiyat ekseni, değer çapası tablosu, katman aralıkları (Starter 12-18k, Professional 35-55k, Enterprise 80-140k, Public 20-35k EUR/yıl), indirim/kanal politikası, 3 yıllık örnek hesap, karar için 5 soru | **öneri** — fiyatlar senin kararın |
| `CLA.md` | Bireysel + kurumsal CLA: telif lisansı, patent lisansı, beyanlar, garanti reddi, yürürlük | şablon, hukuk incelemesi gerekli |
| `CHANGELOG.md` | 0.2.0: 8 modülün tamamı, değişen/düzeltilen/güvenlik başlıkları, yeni yol haritası | güncel |
| `README.md` | Hızlı başlangıç yeni CLI'a göre yazıldı (bozuk kod bloğu düzeltildi), özellik listesi + dizin tablosu | güncel |
| `CONTRIBUTING.md` | CLA bağlantısı `CLA.md`'ye verildi | güncel |

### Fiyat çerçevesinin özü

Fiyat üç eksende okunabilir: kurum ölçeği (tier), aktif ajan sayısı, süreç kapsamı.
Öneri: **ana eksen tier, ikincil ajan sayısı**; süreç kapsamı paket içinde kalsın (yarım
çerçeve denetimde işe yaramaz). Değer çapası olarak danışmanlık ve denetim maliyeti
kullanılıyor: 60.000 EUR/yıl lisans, 300.000 EUR'luk bir kalemi hedefliyorsa savunulabilir.

Karar bekleyen 5 soru `pricing.md` §6'da: hedef segment, kanal, fiyat mimarisi, para birimi,
marj hedefi. Bunlar netleşmeden `LICENSE-COMMERCIAL.md` içindeki `[ ]` alanları doldurulmamalı.

---

## 16. Siber güvenlik kontrolleri ve dashboard (2026-11-04)

### Madde 9 kapatıldı (uçtan uca)

| Katman | Ne eklendi |
|---|---|
| Süreç | `PRC-RSK-05` — erişim, şifreleme, segmentasyon, zafiyet kapatma; 4 kural (SEC-R1…R4), 4 SLA |
| Kontrol | `CTL-RSK-007` erişim gözden geçirme · `CTL-RSK-008` şifreleme/anahtar · `CTL-RSK-009` segmentasyon + sıkılaştırma · `CTL-RSK-010` zafiyet kapatma |
| Eşleme | Art-09 → covered (4 kontrol), Art-07 → covered (CTL-RSK-009 ile) |
| Test | `SCN-04` — 6 assertion, 4 tuzak, 5 kanıt dosyası |

Kapsam etkisi: **%79 → %86** (24 covered, 3 partial, 1 gap). Kalan tek boşluk Art-14 (kriz iletişimi).

SCN-04'ün asıl işi "kontrol var" demekle "kontrol kanıtlanıyor" arasındaki farkı yakalamak:
her assertion bir kanıt dosyası ve bir süre istiyor; tuzak testleri kanıtsız "evet" cevabını
başarısız sayıyor.

### Dashboard

| Dosya | Ne |
|---|---|
| `dashboard/index.html` | Koyu tema, tek dosya, veri gömülü — tarayıcıda açılır |
| `dashboard/data.json` | Aynı verinin makine okunur hâli |
| `dashboard/dashboard.png` | Tarayıcısız render (Pillow), 1220×950 |
| `docs/tools/build-dashboard.mjs` | YAML'lardan üretir; sarkan referans bulursa çıkış 1 |
| `docs/tools/render_dashboard.py` | PNG üretimi |

Gösterilen: 24 süreç · 36 kontrol · 11 ajan · 60 terim · 4 senaryo (27 assertion) · %100 kapsama ·
6 ORL fazı (adım/kapı/süre/ajan modu) · açık noktalar · referans sağlığı.

Dashboard elle düzenlenmez; `node docs/tools/build-dashboard.mjs` ile yeniden üretilir.

---

## 17. Nerede çalıştırılır — görünür artefaktlar (2026-11-06)

### Dashboard sitesi

`dashboard/` artık tek sayfa değil, üç sayfalık statik site (dosya:// ile açılır, sunucu gerekmez):

| Sayfa | İçerik |
|---|---|
| `index.html` | KPI kartları (24 süreç · 36 kontrol · 11 ajan · 60 terim · 4 senaryo · %100 kapsama), kapsama çubuğu, ORL faz tablosu, açık noktalar, senaryo listesi |
| `processes.html` | 24 sürecin tablosu + her süreç için açılır ayrıntı (tetikleyici, girdi/çıktı, SLA, karar kuralları, kontroller, bağımlılıklar) |
| `controls.html` | 36 kontrolün tablosu + kanıt alanları, değiştirilemezlik, DORA maddesi, test prosedürü |

Üretici: `docs/tools/build-dashboard.mjs` (YAML → HTML/JSON; sarkan referans bulursa çıkış 1).
PNG kopyası: `docs/tools/render_dashboard.py` → `dashboard/dashboard.png`.

### Başlatıcılar (Windows)

| Dosya | Ne yapar |
|---|---|
| `scripts/dashboard.cmd` | Dashboard'u yeniden üretir ve tarayıcıda açar |
| `scripts/demo.cmd` | 6 fazlı uçtan uca demoyu çalıştırır (örnek veri, 6/6) |
| `scripts/validate.cmd` | Eşleme + dashboard sağlığı + faz tanımı + demo — dördü sırayla |

`onboarding/cli/tools/demo.mjs`: demo lisansı geliştirme anahtarıyla imzalanır (varsa), böylece
C6 dahil 6/6 geçer; anahtar yoksa deneme modunda C6'da durur — iki davranış da tasarım gereği.

---

## 18. Raporlama boşluklarının kapatılması (2026-11-08) — sürüm 0.4.0–0.4.1

Kapsam analizinde çıkan tek boşluk (Art-14) ve iki kısmi madde (Art-20, Art-23) kapatıldı.

| Ne | Dosya | Etki |
|---|---|---|
| Kriz iletişimi süreci + kontrolü | `PRC-INC-06`, `CTL-INC-009` | Art-14: gap → covered |
| Ödeme olayı ayrımı | `PRC-INC-07`, `CTL-INC-010` | Art-23: partial → covered |
| ITS bildirim alan sözlüğü | `data/mapping/its-2024-2956.yaml` | Art-20: partial → covered |
| Gönüllü tehdit bildirimi eşlemesi | `dora-articles.yaml` Art-19 | süreç vardı, eşlemede yoktu — düzeltildi |

**Kapsam:** 28 covered · 0 partial · 0 gap · **%100** (0.4.1).

Art-12 yedekleme maddesi 0.4.1'de kapandı: `CTL-RSK-011` ayrı yedekleme kontrolü (konum,
şifreleme, saklama, geri yükleme testi, bütünlük hash'i) `PRC-RSK-04`e bağlandı.
Böylece C5 kapısı hiçbir maddede boşluk/kısmi görmüyor.

Raporlama tarafında kalan işler (paket dışı): kanıt paketi ihracı, bildirim formu üretimi,
dashboard'da açık olay/SLA görünümü — ayrıntı: [RAPORLAMA-ANALIZI.md](RAPORLAMA-ANALIZI.md) §3.


---

## 19. Kabul testleri tamamen çalıştırılabilir — 1.2.0 (2026-11-09)

1.1.0'da 27 assertion'ın yalnızca 6'sı `check` bloğuna sahipti; kalan 21'i "manuel" sayılıyordu.
1.2.0'da bu kapandı.

| Senaryo | Assertion | 1.1.0 | 1.2.0 |
|---|---|---|---|
| SCN-01 Büyük olay | 8 | 0 check | **8/8** |
| SCN-02 Tedarikçi çıkışı | 7 | 0 check | **7/7** |
| SCN-03 Regülatör talebi | 6 | 0 check | **6/6** |
| SCN-04 Güvenlik kontrolleri | 6 | 6 check | **6/6** |
| **Toplam** | **27** | **6 çalışır / 21 manuel** | **27/27, manuel 0** |

### Mekanizma

- `tests/synthetic-scenarios/golden/<senaryo>/` — assertion'ların beklediği kanıt dosyaları
  (JSON/YAML; XML yalnızca `initial-notification.xml` örneği olarak duruyor, kontrol JSON makbuzu
  üzerinden yapılıyor)
- `scenario --golden` → `seedArtifacts()` bu dosyaları oturum dizinine kopyalar
- Her assertion `{ file, path, op }` veya `all_of/any_of` ile tek bir ölçülebilir koşula bağlı

### Doğrulama

```
$ node tools/demo-scenario.mjs
  SCN-01: 8 pass, 0 fail, 0 manuel  (7 artefakt)
  SCN-02: 7 pass, 0 fail, 0 manuel  (6 artefakt)
  SCN-03: 6 pass, 0 fail, 0 manuel  (5 artefakt)
  SCN-04: 6 pass, 0 fail, 0 manuel  (5 artefakt)
✔ 27/27 assertion calistirildi · manuel assertion yok
--- bozuk kanit (SCN-04): 4/6 gecti, 2 basarisiz
SONUC: tum kontroller gecti
```

Bozuk kanıt testi önemli: `check`'lerin gerçekten "ısırdığını" gösteriyor — veri bozulunca
assertion'lar fail veriyor, sessizce geçmiyor.

### Not

Golden dosyalar "doğru kurulumun çıktısı" örneğidir; üretimde bu artefaktları ajanlar ve
sistemler üretir. CI bunları kullanarak 27 assertion'ı 6 iş matrisinde koşuyor.

---

## 20. Lansman incelemesi kalanları — B ve C kapandı (2026-11-09)

`docs/LAUNCH-REVIEW.md` P1-7 ve P2-1 maddeleri kapatıldı.

### B — Legacy CLI ayrıldı (P1-7)

`onboarding/cli/legacy/` altına taşındı: `bin/dora-onboard.js`, `src/index.js`,
`src/steps/step-1-profile.js`, `src/steps/step-4-agents.js`. Yanına `legacy/README.md` yazıldı:
bu dosyaların neden çalışmadığı (commander/inquirer/js-yaml bağımlılıkları) ve yerlerine ne
geldiği tablo hâlinde. `docker-compose.yml` içindeki `bin/dora-onboard.js` komutu da
`bin/dora-onboard.mjs` olarak düzeltildi — aksi hâlde container açılışta hata verirdi.

Sonuç: `onboarding/cli/` altında tek bir CLI var (`bin/dora-onboard.mjs`), `package.json`
yalnızca onu gösteriyor. Kafa karıştıran ikinci giriş noktası kalmadı.

### C — README iddiası mimariyle hizalandı (P2-1)

Açılış cümlesi "otomatikleştiren" yerine **"yürüten ... kapılarla doğrulayan"** oldu; hemen
altına ajan çalıştırıcısının kapsam dışı olduğu yazıldı. Ayrıca **"Ne değildir"** tablosu
eklendi: ajan çalıştırıcısı, hazır bildirim gönderen sistem, hukuki görüş, platform yerine
geçme, sıfır kurulum. Beş satır, satın alma görüşmesinde ilk sorulan soruların cevabı.

### Doğrulama

- `node bin/dora-onboard.mjs validate --strict` → geçti
- `demo.mjs` (6 faz) ve `demo-scenario.mjs` (27/27) → geçti
- `render-mapping --check` → %100 kapsama
- Legacy dosyalar çalışma zamanı yolunda değil: `src/steps/` klasörü tamamen kaldırıldı

---

## 21. Marka adı temizliği — 1.2.2 (2026-11-09)

Üçüncü taraf tedarikçi ve ürün adları (5 harfli kısaltma ve 10 harfli platform adı) tüm
dosyalardan kaldırıldı; yerine nötr tanımlar kondu. Gerekçe hukuki: bu adlar müşteriye
sunulan belgede marka kullanımı sayılabilir.

| Yer | Önce | Sonra |
|---|---|---|
| mapping `source_frameworks` | tedarikçi + ürün adı | "referans operasyonel dayanıklılık süreç modeli" / "referans platform modülleri" |
| mapping alanı | ürün adlı alan | `platform_modules` |
| lifecycle `framework` | tedarikçi adı + çerçeve | "Implementation Lifecycle (6 faz)" |
| lifecycle `platform` | ürün adı | "harici referans platform" |
| dokümanlar | ad geçen cümleler | nötr karşılıklar |

### Kapsam ve doğrulama

- 8 metin dosyası düzeltildi; ardından tüm depo tarandı (md/yaml/json/mjs/html/cmd): **0 eşleşme**
- `UYGULAMA-RAPORU.docx`: iki geçiş run düzeyinde düzeltildi (biçim korunarak)
- `UYGULAMA-RAPORU.pdf`: temiz DOCX'ten yeniden üretildi (LibreOffice Kit); sıkıştırılmış
  akışlar açılıp tarandı — **0 eşleşme**
- `validate --strict`, 6 fazlı demo, 27/27 senaryo, DORA eşlemesi, dashboard + site: geçti

### Açık kalan karar

Çerçevenin kısaltması (**C**-O-R-F, 28 yerde, klasör ve alan adlarında) hâlâ duruyor. Bu kısaltma
da aynı tedarikçinin çerçeve adı. Kaldırılması istenirse dosya/klasör/alan yeniden adlandırması
gerekir — ayrı bir iş kalemi olarak bekliyor.

---

## 22. ORL yeniden adlandırması — 1.3.0 (2026-11-09)

1.2.2'de tedarikçi ve ürün adları metinlerden çıkarıldı; ancak çerçevenin kısaltması
dosya, klasör ve veri alanı adlarında kalmıştı. 1.3.0 bunu tamamen kaldırdı.

Yeni ad: **ORL — Operational Resilience Lifecycle** (paketin kendi tanımı).

| Katman | Yeni ad |
|---|---|
| Dosya | `onboarding/orl-lifecycle.yaml` |
| Modül | `onboarding/cli/src/orl/` |
| Veri | `data/orl-integration/agent-to-orl-mapping.yaml` |
| Alanlar | `process_codes`, `lifecycle_phase`, `owned_processes`, `lifecycle_summary` |
| Kimlik | `ORL-IMPL-6` |
| Metin | 51 dosyada çerçeve kısaltması ORL olarak değişti |

### Doğrulama

- Depoda `ORL` (her harf durumu) araması: **0 eşleşme**
- `validate --strict`, `phases`, `demo` 6/6, `demo-scenario` 27/27, `render-mapping --check` %100
- Dashboard, site ve PNG yeniden üretildi (faz alanı `orl` olarak güncellendi)

### Etki

Kırıcı: eski oturum dosyaları ve dış betikler `ORL_*` alanlarını kullanıyorsa güncellenmeli.
CLI'ın ürettiği tüm artefaktlar yeni adlarla yeniden üretildi.

---

## 23. Kural motoru — 1.4.0 (2026-11-09)

Süreçlerdeki karar kuralları 1.0'dan beri düz metindi (`"etkilenen_musteri > 100000"`). 1.4.0'da
bu ifadeler deterministik olarak değerlendirilebilir hale geldi.

| Dosya | Görev |
|---|---|
| `src/orl/rules.mjs` | İfade dili: karşılaştırma, AND/OR/NOT, `IN`, parantez, birimler, `%30`, noktalı yol |
| `src/orl/facts.mjs` | Kanıt → olgu adaptörü (Türkçe kural alanı ↔ İngilizce kanıt alanı) |
| `bin/dora-onboard.mjs` | `rules --audit`, `rules --session … [--process] [--facts]` |
| `tools/demo-rules.mjs` | CI demosu: 49/49 sözdizimi, SCN-01 tetikleme, hata davranışı |
| `docs/KURAL-MOTORU.md` | Söz dizimi + adaptör tablosu + sınırlar |

### Ölçüm

```
$ node bin/dora-onboard.mjs rules --audit
  49/49 kural makine tarafindan okunabilir

$ node tools/demo-rules.mjs
  adaptör: 7 kanıt dosyası eşlendi, 60 olgu
  ✔ INC-R1 matched   ✔ INC-R3 matched
  · INC-R2, INC-R4, INC-R5 not_matched
  ✔ eksik alan varken tetiklenmiyor   ✔ bozuk ifade parse_error
```

### Tasarım kararları

1. **Sessiz yanlış yok**: anlaşılmayan ifade `parse_error` döner, `false` sayılmaz.
2. **Eksik olgu tetiklemez**: veri yoksa kural çalışmaz, alan raporlanır — "veri yokken alarm"
   yerine "veri yokken sessiz + görünür eksik".
3. **Adaptör açık tablo**: hangi kanıt alanının hangi olguya gittiği `docs/KURAL-MOTORU.md`'de
   tek tek yazılı; eşlenmeyen dosya uyarı olarak basılır.
4. **Motor uygulamaz**: `action` metni raporlanır; bildirim/kayıt açma ajan katmanının işi.

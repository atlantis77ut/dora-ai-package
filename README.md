# DORA AI Package

Finansal kuruluşlar için DORA (Digital Operational Resilience Act) uyumunu
yapay zeka ajanları ile otomatikleştiren modüler paket.

## Özellikler

- 60 kavramlık standart sözlük (DORA + RTS/ITS referanslı)
- 11 ajan rolü, üç savunma hattı modeli (CORF süreç kodlarıyla eşlenmiş)
- 5 sütun, **24 süreç** ve **36 kontrol** (şema doğrulamalı)
- CORF 6 fazlı onboarding: `C1 Identify → C2 Tolerances → C3 Map → C4 Scenarios → C5 Self-assessment → C6 MOS`
- Tier 1/2/3 profilleri, çoklu yargı alanı (TR/AB)
- 28 DORA maddesi → süreç/kontrol eşlemesi (üretilen doküman)
- 4 sentetik kabul senaryosu (27 assertion + tuzak testleri)
- Denetim izi (hash-chain / WORM), insan gözetimi noktaları
- Kanıt paketi (ZIP + hash zinciri + Ed25519 imza) ve ITS 2024/2956 bildirim formu üretimi
- Yönetim kurulu MI paketi (aylık tek sayfa) ve 9 kalemlik düzenleyici takvim
- Katalog doğrulaması: 14 dosya 8 JSON Schema ile denetlenir (CI kapısı)
- Dış veri alımı: dosya bırakma sözleşmesi (`ingest`), sha256 alım kaydı
- Senaryo çalıştırıcısı: `check` DSL ile assertion'lar artefaktlar üzerinde koşar (SCN-04 pilot)
- Lisans anahtarı (Ed25519, çevrimdışı doğrulama)

## Hızlı Başlangıç

Gereksinim: Node.js 18+ · **npm install gerekmez** — wizard bağımlılıksızdır.

```bash
git clone https://github.com/atlantis77ut/dora-ai-package.git
cd dora-ai-package/onboarding/cli

node bin/dora-onboard.mjs validate            # katalog şema doğrulaması
node bin/dora-onboard.mjs phases              # 6 faz, kapı sayıları, süreler
node bin/dora-onboard.mjs init --tier tier2 --regulator BDDK
node bin/dora-onboard.mjs phase C1 --session ob-2026-xxxxx --demo
node bin/dora-onboard.mjs gate  C1 --session ob-2026-xxxxx   # geçmezse çıkış kodu 2
node bin/dora-onboard.mjs status --session ob-2026-xxxxx
node bin/dora-onboard.mjs export --session ob-2026-xxxxx       # kanıt paketi (ZIP)
node bin/dora-onboard.mjs notify --session ob-2026-xxxxx --phase initial   # bildirim formu
node bin/dora-onboard.mjs mi --session ob-2026-xxxxx --period 2026-11      # MI paketi
node bin/dora-onboard.mjs calendar --next 90 --anchors data/calendar-anchors.example.yaml
node bin/dora-onboard.mjs ingest --session ob-2026-xxxxx --from ./drop   # dış veri alımı
node bin/dora-onboard.mjs scenario --session ob-2026-xxxxx --all          # senaryoları koş
```

Lisans anahtarı olmadan **30 gün deneme modu** çalışır (C1-C5); üretime geçiş (C6) ticari
lisans ister. Anahtar üretimi: [`docs/license-keys.md`](docs/license-keys.md).

Doğrulama komutları:

```bash
node docs/tools/render-mapping.mjs --check    # DORA eşlemesi + referans bütünlüğü
node docs/tools/build-coverage.mjs --session ob-2026-xxxxx   # C5 kapsama matrisi
node docs/tools/build-dashboard.mjs                          # dashboard/index.html üret
```

## Görmek için dört yol

**Canlı dashboard:** <https://atlantis77ut.github.io/dora-ai-package/>

### 1. Dashboard (tarayıcı)

```
scripts\dashboard.cmd
```

veya doğrudan `dashboard\index.html` dosyasını çift tıklayın. Üç sayfa var:

| Sayfa | Ne gösterir |
|---|---|
| `dashboard/index.html` | KPI'lar, DORA kapsama çubuğu, 6 CORF fazı, açık noktalar, senaryolar |
| `dashboard/processes.html` | **24 sürecin tamamı** — tetikleyici, SLA, karar kuralları, kontroller, bağımlılıklar |
| `dashboard/controls.html` | **36 kontrol** — kanıt alanları, değiştirilemezlik, test prosedürü |

Sayfalar depodaki YAML'lardan üretilir; elle düzenlenmez. Yeniden üretmek:
`node docs/tools/build-dashboard.mjs` · PNG kopyası: `dashboard/dashboard.png`

### 2. Uçtan uca demo (6 faz)

```
scripts\demo.cmd
```

Örnek veriyle C1→C6 fazlarını çalıştırır, her kapı kontrolünü tek tek yazar.
Sonuç: `6/6 faz geçildi`. Gerçek kuruluma dokunmaz, kendi geçici oturumunu açar ve siler.

### 3. Kanıt paketi ve bildirim formu

```
node onboarding\cli\tools\demo-export.mjs
```

Oturum açar, örnek olayla kanıt paketini üretir, doğrular, kurcalanmış kopyayı reddettiğini
gösterir ve üç bildirim formunu (initial / intermediate / final) çıkarır. Ayrıntı:
[`docs/KANIT-PAKETI.md`](docs/KANIT-PAKETI.md).

```bash
node bin/dora-onboard.mjs export --session ob-2026-xxxxx          # ZIP + imza
node bin/dora-onboard.mjs verify --bundle evidence-out/....
node bin/dora-onboard.mjs notify --session ob-2026-xxxxx --phase initial
```

### 4. Doğrulama

```
scripts\validate.cmd
```

Dört kontrolü sırayla çalıştırır: DORA eşlemesi (`--check`), dashboard sağlığı (sarkan referans),
faz tanımı, uçtan uca demo.

> Node.js gerekir (LTS yeterli). `npm install` gerekmez — CLI bağımlılıksızdır.
> Windows dışında: `node onboarding/cli/tools/demo.mjs`, `node docs/tools/build-dashboard.mjs`.

## Dizin Yapısı

| Dizin | İçerik |
|---|---|
| `schema/` | 5 JSON Schema (common, glossary, roles, processes, controls) |
| `data/` | Sözlük, roller, süreçler, kontroller, DORA eşlemesi, CORF entegrasyonu |
| `onboarding/` | CORF faz tanımı, wizard spec, bağımlılıksız CLI |
| `tests/` | 3 sentetik senaryo + fixture'lar |
| `pilots/` | Pilot seçim, sözleşme, başarı kriterleri, vaka şablonu |
| `docs/` | Mimari, DORA eşlemesi, TR mevzuatı, lisanslama, fiyatlandırma, kararlar |
| `dashboard/` | Üretilen site: `index.html` · `processes.html` · `controls.html` · `data.json` · `dashboard.png` |
| `scripts/` | Windows başlatıcıları: `dashboard.cmd`, `demo.cmd`, `validate.cmd` |

## Durum

Sürüm **1.1.0**. Neyin hazır, neyin eksik olduğu: [`docs/DURUM.md`](docs/DURUM.md).
Değişiklik geçmişi: [`CHANGELOG.md`](CHANGELOG.md).

## Lisans — çift lisans

Bu paket **iki lisans** altında dağıtılır:

| Kullanım | Lisans | Koşul |
|---|---|---|
| İnceleme, değerlendirme, iç kullanım, açık kaynak projeler | **AGPL-3.0** ([`LICENSE`](LICENSE)) | Değiştirip dağıtırsan kaynak kodu da açık olur (AGPL md. 13) |
| Kapalı kaynak ürüne gömme, ticari SaaS, yeniden satış, beyaz etiket | **Ticari lisans** ([`LICENSE-COMMERCIAL.md`](LICENSE-COMMERCIAL.md)) | Ücretli; kaynak kodu açma yükümlülüğü yok |

Hangi durumda hangisinin gerektiği: [`docs/licensing.md`](docs/licensing.md).
Kararın gerekçesi: [`docs/decisions.md`](docs/decisions.md) → DR-007.

> Bir bankanın paketi **kendi içinde** kullanması AGPL kapsamında kaynak açma yükümlülüğü
> doğurmaz (iç kullanım dağıtım sayılmaz). Yükümlülük, paketi bir **ürün/hizmet içinde
> üçüncü taraflara sunmakla** başlar.

## Katkı

Pull request'ler kabul edilir. Önce [`docs/architecture.md`](docs/architecture.md) okuyun.
Kod katkısı için **CLA** (Contributor License Agreement) imzası gerekir — çift lisans modelinde
ticari lisans verebilmek için zorunludur; ayrıntı [`CONTRIBUTING.md`](CONTRIBUTING.md).

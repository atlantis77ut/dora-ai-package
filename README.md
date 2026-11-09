# DORA AI Package

Finansal kuruluşlar için DORA (Digital Operational Resilience Act) uyumunu **yapay zeka
ajanlarıyla yürüten**, her adımı **geçiş kapılarıyla doğrulayan** modüler referans çerçevesi.

Süreçler, kontroller ve ajan rolleri tanımlıdır; kararlar deterministik kapılarla denetlenir.
**Ajan çalıştırıcısı (LLM orkestrasyonu) bu paketin kapsamında değildir** — paket, ajanların
ne yapacağını, hangi kanıtı üreteceğini ve ne zaman duracağını tanımlar (bkz. aşağıdaki
"Ne değildir" ve `docs/architecture.md` §9).

## Özellikler

- 60 kavramlık standart sözlük (DORA + RTS/ITS referanslı)
- 11 ajan rolü, üç savunma hattı modeli (ORL süreç kodlarıyla eşlenmiş)
- 5 sütun, **24 süreç** ve **36 kontrol** (şema doğrulamalı)
- ORL 6 fazlı onboarding: `C1 Identify → C2 Tolerances → C3 Map → C4 Scenarios → C5 Self-assessment → C6 MOS`
- Tier 1/2/3 profilleri, çoklu yargı alanı (TR/AB)
- 28 DORA maddesi → süreç/kontrol eşlemesi (üretilen doküman)
- 4 sentetik kabul senaryosu (27 assertion + tuzak testleri)
- Denetim izi (hash-chain / WORM), insan gözetimi noktaları
- Kanıt paketi (ZIP + hash zinciri + Ed25519 imza) ve ITS 2024/2956 bildirim formu üretimi
- Yönetim kurulu MI paketi (aylık tek sayfa) ve 9 kalemlik düzenleyici takvim
- Katalog doğrulaması: 14 dosya 8 JSON Schema ile denetlenir (CI kapısı)
- Dış veri alımı: dosya bırakma sözleşmesi (`ingest`), sha256 alım kaydı
- Kural motoru: 49 `decision_rules` koşulu çalıştırılabilir (`rules --audit`, `rules --session`)
- Senaryo çalıştırıcısı: `check` DSL ile **27/27 assertion** artefaktlar üzerinde koşar (golden koşu)
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
node bin/dora-onboard.mjs scenario --session ob-2026-xxxxx --all --golden # 27/27 assertion
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

**Site:** <https://atlantis77ut.github.io/dora-ai-package/> · **Dashboard:** <https://atlantis77ut.github.io/dora-ai-package/dashboard/>

### 1. Dashboard (tarayıcı)

```
scripts\dashboard.cmd
```

veya doğrudan `dashboard\index.html` dosyasını çift tıklayın. Üç sayfa var:

| Sayfa | Ne gösterir |
|---|---|
| `dashboard/index.html` | KPI'lar, DORA kapsama çubuğu, 6 ORL fazı, açık noktalar, senaryolar |
| `dashboard/roles.html` · `glossary.html` · `mapping.html` | 11 ajan, 60 terim, 28 DORA maddesi — tam tanımlar |
| `dashboard/sources.html` | Veri nereden girilir: dosya haritası, komutlar, düzenle→yayınla döngüsü |
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

## Ne değildir

Satın alma görüşmesinde ilk sorulan soru bu; cevabı baştan yazılı olsun:

| Değildir | Çünkü |
|---|---|
| Ajan çalıştırıcısı / LLM orkestrasyonu | Rolleri, becerileri ve otonomi seviyelerini **tanımlar**; modeli çalıştırmaz. Araç çağırma, hafıza ve kuyruk katmanı kapsam dışı. |
| Hazır regülatör bildirimi gönderen sistem | Bildirim paketini üretir ve kapıdan geçirir; gönderim kurumun kanalından, insan onayıyla yapılır. |
| Hukuki görüş | Mevzuat eşlemesi ve kontrol seti sunar; uyum sorumluluğu kurumdadır (`LICENSE-COMMERCIAL.md` §7). |
| Ticari bir ürünün yerine geçen platform | Süreç kodlarıyla eşleşir, platformun yerini almaz; entegrasyon port/adapter olarak soyutlanmıştır. |
| Sıfır kurulum | Kurulum + 6 fazlı onboarding gerekir (tipik 95 gün, `orl-lifecycle.yaml`). |

## Uygulama (veri girişi)

```bash
node onboarding/cli/tools/server.mjs --port 8080     # veya scripts\serve.cmd
```

`http://127.0.0.1:8080/app/` — giriş ekranıyla açılır. İlk açılışta **yönetici hesabı** oluşturulur.

- **Kurulum sihirbazı (6 adım)**: hizmetler → toleranslar → varlık/sorumlu eşlemesi → senaryo
  testleri → öz değerlendirme → canlıya geçiş + lisans etkinleştirme → **imzalı kanıt paketi (zip)**
- **Yönetici**: teknik panel (`/dashboard/`), kanıtlar, kullanıcı yönetimi, işlem kaydı,
  parola sıfırlama bağlantısı, oturum süresi, SSO ayarları
- **Güvenlik**: iki adımlı doğrulama (TOTP) + kurtarma kodları, kurumsal giriş (OIDC)
- **Yedekleme**: `node onboarding/cli/tools/backup.mjs` → `web-data/` + oturumlar tek zip
- **Kullanıcı**: Durum · Kurum bilgileri · Sistem bağlantıları · Varlıklarım · Sorumlular · Belgeler

Veriler `web-data/` (ayarlar, kullanıcılar, anahtarlar) ve `.dora-onboarding/` (oturumlar) altında;
ikisi de `.gitignore`'da.

## Testler

```bash
cd onboarding/cli && node --test tests/unit     # 45 birim testi
node tools/demo.mjs                             # 6 fazlı uçtan uca demo
```

## Sunucuya kurulum

```bash
git clone https://github.com/atlantis77ut/dora-ai-package.git /opt/dora-ai-package
bash /opt/dora-ai-package/scripts/smoke-test.sh            # genel test
sudo bash /opt/dora-ai-package/scripts/install-ubuntu.sh --service --port 8080
```

Windows'ta tek makinede denemek için: `scripts\serve.cmd` (çift tıkla) → http://127.0.0.1:8080/dashboard/

Node.js 18+ yeterli; **npm install ve GPU gerekmez**. Ayrıntı: [`docs/KURULUM-UBUNTU.md`](docs/KURULUM-UBUNTU.md).

## Dizin Yapısı

| Dizin | İçerik |
|---|---|
| `schema/` | 5 JSON Schema (common, glossary, roles, processes, controls) |
| `data/` | Sözlük, roller, süreçler, kontroller, DORA eşlemesi, ORL entegrasyonu |
| `onboarding/` | ORL faz tanımı, wizard spec, bağımlılıksız CLI |
| `tests/` | 4 sentetik senaryo + fixture'lar + golden koşu artefaktları |
| `pilots/` | Pilot seçim, sözleşme, başarı kriterleri, vaka şablonu |
| `docs/` | Mimari, DORA eşlemesi, TR mevzuatı, lisanslama, fiyatlandırma, kararlar |
| `dashboard/` | Üretilen site: `index.html` · `processes.html` · `controls.html` · `data.json` · `dashboard.png` |
| `scripts/` | Başlatıcılar: `dashboard.cmd`, `demo.cmd`, `validate.cmd`, `install-ubuntu.sh`, `smoke-test.sh` |
| `deploy/` | systemd unit (`dora-ai-package.service`) |

## Durum

Sürüm **1.9.0**. Neyin hazır, neyin eksik olduğu: [`docs/DURUM.md`](docs/DURUM.md).
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

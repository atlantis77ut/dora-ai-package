# Karar Kaydı (ADR)

Paketin inşasında verilen ve sonradan "neden böyle?" diye sorulabilecek kararlar.
Her kayıt: bağlam → karar → sonuç. Tarih, karar verildiği günü gösterir.

---

## DR-001 — Olay bildirim süresi: DORA'nın 4 saati uygulanır

**Tarih:** 2026-11-03
**Durum:** kabul edildi

**Bağlam.** `docs/local-equivalents-TR.md` hazırlanırken Türkiye'deki bildirim pratiğinin
6 saat olabileceği varsayımı ortaya çıktı. İki seçenek vardı: yerel süreyi (6 saat) uygulamak
veya DORA tabanını (4 saat) korumak. Paket birden fazla yargı alanında satılacağı için
sürelerin yargı alanına göre değişmesi, "aynı çekirdek farklı profil" ilkesini zayıflatıyordu.

**Karar.** Paket **DORA sürelerini** uygular. İlk bildirim, sınıflandırmadan sonra **4 saat**
ve tespitten en geç **24 saat** içinde yapılır. Yerel mevzuat daha **uzun** süre öngörse bile
gevşetme yapılmaz; daha **kısa** süre öngörüyorsa yerel süre uygulanır (tek yönlü katılaştırma).

**Sonuç.**
- `data/processes/pillar-2-incident.yaml` → `PRC-INC-02` SLA'sı 4 saat; tier2/tier3 varyantları
  da 4 saat (yalnızca onay akışı sadeleşir, süre gevşemez).
- `sla-overrides.json` içinde `new_hours > dora_hours` olan her satır C2 kapısında "gevşetme"
  olarak reddedilir.
- Yerel mevzuatın süresi hukuk/uyum birimince teyit edilene kadar bu karar geçerlidir;
  `local-equivalents-TR.md` içinde `⚠` işaretiyle takip edilir.

---

## DR-002 — Süreç kimliklerinde 3 harfli kod (RSK / TST / INF)

**Tarih:** 2026-11-03
**Durum:** kabul edildi

**Bağlam.** Dökümde üç farklı yazım geçiyordu: `PRC-RISK-01` / `PRC-RSK-01`,
`PRC-TEST-01` / `PRC-TST-01`, `PRC-INFO-01` / `PRC-INF-01`. `processes.schema.json` deseni
`^PRC-[A-Z]{3}-\d{2}$` — yalnızca 3 harf kabul ediyor. Sözlük (`glossary-full.yaml`) ise
kısaltılmış biçimi kullanıyor.

**Karar.** **RSK / TST / INF** kullanılır. 20 sürecin tamamı bu kodla tanımlı.

**Sonuç.** Sözlükteki 17 süreç referansı çözülüyor; sarkan referans yok. Uzun yazımlar
(`PRC-RISK-…`) hiçbir dosyada geçmiyor.

---

## DR-003 — Şemalarda iki desen gevşetildi

**Tarih:** 2026-11-03
**Durum:** kabul edildi

**Bağlam.** Şemalar veri yazılmadan önce hazırlanmıştı; ikisi kendi verisini reddediyordu:

1. `roles.schema.json`: desen `^ROL-[A-Z]{3}-\d{2}$` — ama `ROL-TLPT-01` ve `ROL-CTPP-01`
   dört harfli. Katalog kendi şemasına uymuyordu.
2. `common.schema.json` → `DoraReference`: `paragraph` **zorunlu** — ama tüm veri dosyaları
   yalnızca `article` veriyor.

**Karar.** Desenler veriye uydurulur, veri desene değil:
- rol deseni → `^ROL-[A-Z]{3,4}-\d{2}$`
- `DoraReference.required` → `["article"]`; `paragraph` ve `rts_its` opsiyonel.

**Sonuç.** Doğrulama ilk kez gerçekten çalıştırılabilir durumda. Veri dosyaları değişmedi.

---

## DR-004 — Türkiye'de CTPP ve TLPT süreçleri pasif

**Tarih:** 2026-11-03
**Durum:** kabul edildi

**Bağlam.** DORA'nın CTPP gözetimi (Madde 31-44) ESA'ya bağlı bir mekanizma; TLPT ise
sistemik önem kriterine bağlı. Türkiye'de bu iki mekanizmanın doğrudan muadili yok.

**Karar.** Türkiye profili (`jurisdiction: TR`) ile çalıştırıldığında:
`PRC-TPP-05` (CTPP gözetimi) ve `ROL-CTPP-01` **pasif**; `PRC-TST-03` (TLPT) **opsiyonel**,
yerine yıllık sızma testi.

**Sonuç.** Ajanlar silinmez, no-op moda alınır — AB'ye genişleme hâlinde tek konfigürasyon
değişikliğiyle aktifleşir. `jurisdiction-config.yaml` içinde `disabled_processes` listesi.

---

## DR-005 — Wizard CLI bağımlılıksız yazıldı

**Tarih:** 2026-11-03
**Durum:** kabul edildi

**Bağlam.** Dökümdeki CLI iskeleti `commander`, `inquirer`, `js-yaml`, `ajv` gibi paketlere
bağlıydı. Bu ortamda `npm install` çalıştırılamadı (sandbox), yani iskelet hiç çalıştırılamazdı
— test edilmemiş kod, dokümandan farksız.

**Karar.** ORL sihirbazı `onboarding/cli/bin/dora-onboard.mjs` altında **sıfır bağımlılıkla**
yazıldı: kendi mini YAML okuyucusu (`src/orl/yaml.mjs`), `node:util.parseArgs`, JSON oturum deposu.

**Sonuç.** Altı komut da gerçekten çalışıyor ve kanıt üretiyor (`docs/DURUM.md` §8).
Dökümden gelen `bin/dora-onboard.js` (ve `src/index.js`, `src/steps/*`) **`legacy/` altına
taşındı** — çalışma zamanı yolunda tek CLI var: `bin/dora-onboard.mjs`. Gerekçe ve eşleme:
`onboarding/cli/legacy/README.md`.

---

## DR-006 — DORA eşlemesi üretilir, elle yazılmaz

**Tarih:** 2026-11-03
**Durum:** kabul edildi

**Bağlam.** `docs/dora-mapping.md` ile `data/mapping/dora-articles.yaml` aynı bilgiyi taşıyor;
elle yazılırsa kaçınılmaz olarak birbirinden ayrışır.

**Karar.** Markdown, YAML'dan üretilir: `node docs/tools/render-mapping.mjs`.
`--check` bayrağı yazmadan yalnızca doğrular (CI için). Aynı kaynaktan C5 fazının
`coverage-matrix.json` çıktısı da üretilir (`docs/tools/build-coverage.mjs`).

**Sonuç.** Tek kaynak: `dora-articles.yaml`. Referans bütünlüğü (süreç/kontrol/rol) her
üretimde denetlenir.

---

## DR-007 — Çift lisans: AGPL-3.0 + ticari

**Tarih:** 2026-11-03
**Durum:** kabul edildi

**Bağlam.** Paket hem yaygınlaşmalı (denetçiler, danışmanlar, kurum içi ekipler görebilmeli)
hem de satılmalı. Saf tescilli (B) modelde:
- kurumsal satın alma süreçleri kaynak erişimi/escrow ister, süreç uzar;
- topluluk katkısı ve referans etkisi oluşmaz (paketin değeri "standart olması"ndan gelir);
- entegratörlerin her biri için ayrı sözleşme gerekir, kanal yavaşlar;
- YAML/şema içeriği zaten kopyalanabilir olduğu için kapalılık pratikte koruma sağlamaz.

**Karar.** **AGPL-3.0 + ticari lisans** (çift lisans).
- İç kullanım, inceleme, fork, açık kaynak proje → AGPL-3.0 (`LICENSE`).
- Kapalı ürüne gömme, ticari SaaS, yeniden satış, beyaz etiket → ticari lisans
  (`LICENSE-COMMERCIAL.md`).
- Kod katkısı için **CLA** zorunlu (`CONTRIBUTING.md`) — aksi hâlde ticari lisans verilemez.

**Sonuç.**
- `README.md` lisans bölümü iki lisansı da açıklıyor; `docs/licensing.md` karar tablosu veriyor.
- `package.json` → `"license": "AGPL-3.0-only"`; `.mjs` dosyalarına SPDX başlığı eklendi.
- Lisans anahtarı doğrulama (dökümdeki wizard 0. adımı) **henüz yok** — ticari satış başladığında
  C1 fazına eklenecek; bugün kod açık ve anahtarsız çalışıyor.
- Ticari lisans metni şablon; fiyat/kapsam alanları doldurulmalı ve avukata incelettirilmeli.
---

## DR-008 — Lisans anahtarı: imzalı token, çevrimdışı doğrulama

**Tarih:** 2026-11-03
**Durum:** kabul edildi

**Bağlam.** Ticari lisans modeli (DR-007) ancak teknik bir kapıyla anlamlı olur: hangi kurumun
hangi tier'da, hangi fazlara kadar yetkili olduğu ölçülebilmeli. Sunucu tabanlı doğrulama
(activation server) daha sıkı olurdu ama kurum içi ağlarda kurulumu zorlaştırır ve kesinti
riski taşır.

**Karar.** **Ed25519 imzalı, çevrimdışı doğrulanan token** (`DORA-LIC-v1.<payload>.<imza>`).
Açık anahtar depoda, özel anahtar satıcıda. Deneme modu 30 gün; C1-C5 çalışır, **C6 (üretime
geçiş) ticari lisans ister**.

**Sonuç.**
- `src/orl/license.mjs` (doğrulama), `tools/license-gen.mjs` (imzalama), `onboarding/license/`.
- Kapıya iki kontrol eklendi: `C1-0` (lisans geçerli + tier uyumlu) ve `C6-0` (ticari lisans).
- Anlık iptal yok; telafi: yıllık süre, anahtar döndürme, sözleşme, `license_id` izleme
  (`docs/license-keys.md` §5).
- Bu bir DRM değil: kod AGPL ile açık, doğrulama kaldırılabilir — amaç uyum kapısı.
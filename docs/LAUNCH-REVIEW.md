# Lansman Öncesi İnceleme — DORA AI Package

Tarih: **2026-11-08** · Sürüm: **0.4.0** · İnceleyen: DSH ajanı
Kapsam: teknik doğrulama, doküman tutarlılığı, lisans/yayın riskleri, dağıtım hazırlığı.

---

## 1. Yönetici özeti

Paket **teknik olarak çalışıyor**: altı CORF fazı uçtan uca geçiyor, eşleme ve dashboard
üretimi deterministik, referans sağlığı temiz. Ancak **olduğu gibi herkese açık yayına
çıkmamalı**. Dört P0 kalemi var; üçü bu turda kapatıldı, biri (telif sahibi adı) kararınızı
bekliyor.

| Karar | Durum |
|---|---|
| Teknik yayın (repo + dashboard) | **KOŞULLU GO** — P0-1 (telif adı), P0-2 (repo URL) tamamlanınca |
| Ticari satış sayfası | **NO-GO** — lisans metnindeki fiyat/destek alanları ve hukuk incelemesi bitmeden |
| Banka pilotuna tanıtım | **GO** — kapsam tablosu dürüst (%86, 1 açık madde ilan edilmiş) |

---

## 2. Doğrulama kanıtı (bu makinede çalıştırıldı)

| Kontrol | Komut | Sonuç |
|---|---|---|
| DORA eşlemesi + referans bütünlüğü | `node docs/tools/render-mapping.mjs --check` | ✅ 28 madde, kapsama %96 (27 covered, 1 partial, 0 gap) |
| Dashboard üretimi | `node docs/tools/build-dashboard.mjs` | ✅ 23 süreç · 34 kontrol · 11 ajan · 4 senaryo · sağlık temiz |
| Faz tanımı | `node bin/dora-onboard.mjs phases` | ✅ 6 faz, sıralı, kapılar tanımlı |
| Uçtan uca demo | `node tools/demo.mjs` | ✅ **6/6 faz geçildi**, geçici oturum silindi |
| Lisans anahtarı koruması | `license-gen.mjs --init-dev-keys` | ✅ `--force` olmadan reddediyor (çıkış 1) |

Ortam: Node **v26.13.0**, Windows 11. Harici ağ bağımlılığı yok; dashboard tek dosya
HTML olarak `file://` ile açılıyor (0 harici URL).

---

## 3. Bulgular

### P0 — yayın engelleyici

| # | Bulgu | Durum |
|---|---|---|
| P0-1 | 11 kaynak dosyasında telif başlığı `Copyright (c) 2026 [Şirket adı]` — yayınlanan lisansın telif sahibi boş kalır | **KAPANDI** — 13 dosyada `ustauretim` yazıldı |
| P0-2 | `README.md` klon adresi `https://github.com/[org]/dora-ai-package.git` | **KAPANDI** — `atlantis77ut/dora-ai-package` yazıldı |
| P0-3 | `onboarding/license/dev-private.pem` çalışma dizininde duruyor; `.gitignore`'da ama klasör/zip tesliminde sızarsa **herkes lisans üretebilir** | **AZALTILDI** — `--init-dev-keys` artık mevcut açık anahtarı `--force` olmadan ezmiyor; paketlemede hariç tutulmalı |
| P0-4 | Ortada git deposu yok: sürüm geçmişi, remote ve CI yok | **KISMEN** — CI iş akışı eklendi; repo kurulumu dağıtım adımında |

### P1 — tanıtımdan önce düzeltilmeliydi (bu turda kapatıldı)

| # | Bulgu | Düzeltme |
|---|---|---|
| P1-1 | `README.md` "Sürüm 0.2.0" ve "20 süreç / 28 kontrol" diyordu (gerçek: 0.3.0 / 21 / 32) | Düzeltildi |
| P1-2 | `docs/architecture.md` "Sürüm 0.1.0", "20 süreç, 28 kontrol" | Düzeltildi → 0.3.0 / 21 / 32 |
| P1-3 | `docs/pricing.md` Professional katmanı "20 süreç, 28 kontrol" | Düzeltildi |
| P1-4 | `docs/DURUM.md` başlığı "Son güncelleme: 2026-10-30" (içerik 2026-11-06'ya kadar) | Düzeltildi |
| P1-5 | `onboarding/cli/package.json`: `bin` **eski commander CLI'ına** işaret ediyordu; 9 npm bağımlılığı beyan ediyordu — README ise "bağımlılıksız" diyor | `bin` → `dora-onboard.mjs`, bağımlılıklar kaldırıldı, `private: true` (CLI depo içi yollara bağlı, npm paketi olarak yayınlanamaz) |
| P1-6 | CI yok | `.github/workflows/validate.yml` eklendi (4 kontrol + dashboard güncellik testi) |
| P1-7 | İki paralel CLI: `bin/dora-onboard.js` (eski, `commander` kurulmadan çalışmaz) ve `bin/dora-onboard.mjs` (yeni) | **AÇIK** — eski dosyalar `legacy/` altına taşınmalı ya da silinmeli; şu an `package.json` onlara işaret etmiyor |

### P2 — iyileştirme

| # | Bulgu | Not |
|---|---|---|
| P2-1 | README açılışı "DORA uyumunu ... otomatikleştiren" diyor; `architecture.md` §9 "ajan çalıştırıcısı yok, LLM orkestrasyonu kapsam dışı" diyor | Alım yapan banka bunu ilk toplantıda sorar. "Ajanlarla yürütülen, kapılarla doğrulanan referans çerçeve" gibi yumuşatılmalı |
| P2-2 | `LICENSE-COMMERCIAL.md` içinde 10+ `[ ]` alanı (fiyat, destek SLA, NDA) | Açık kaynak yayını engellemez; ticari teklif vermeyi engeller |
| P2-3 | Ayrı bir test koşucusu yok; senaryo assertion'ları yalnızca C4 kapısında dolaylı çalışıyor | `npm test` artık demoyu çalıştırıyor; ileride jest/vitest |
| P2-4 | `docs/DURUM.md` tarihsel bölümlerde eski sayıları koruyor (0.2.0 anlatımı) | Bilinçli: tarihçe. Karışmasın diye başlıkta sürüm belirtilmeli |

### Güçlü yanlar (satışta kullanılabilir)

- **Dürüst kapsam**: %96, tek kısmi madde (Art-12) gerekçesiyle ilan edilmiş; "DORA'nın tamamı" denmiyor. Denetimde güven üretir.
- **Deterministik kapılar**: demo, örnek veriyle 6/6; kapı kırılınca çıkış kodu 2. Test edilebilir iddia.
- **Sıfır bağımlılık**: CLI `npm install` istemiyor; banka ağında kurulum sürtünmesi düşük.
- **Çevrimdışı dashboard**: harici CDN/font yok; kapalı ağda açılıyor.
- **Lisans altyapısı**: Ed25519 imza, tier/faz kontrolü, deneme modu; `dev-private.pem` repoya girmiyor.

---

## 4. Yayın öncesi kalan işler (sırayla)

1. ~~Telif sahibi adını netleştir~~ → `ustauretim` yazıldı (P0-1).
2. ~~Repo adı/visibility kararı~~ → `atlantis77ut/dora-ai-package` (P0-2).
3. `git init` + ilk commit; `dev-private.pem`, `.dora-onboarding/`, `node_modules/` hariç (P0-3/P0-4).
4. Eski CLI'ı `legacy/` altına taşı (P1-7).
5. README açılış cümlesini mimariyle uyumlu hâle getir (P2-1).
6. Dashboard'u yayınla (statik barındırma) ve README'ye canlı bağlantı ekle.
7. Ticari lisans alanlarını doldur + hukuk incelemesi → ancak ondan sonra fiyatlı tanıtım.

---

## 5. Yayın kaydı — 2026-11-08

| Kalem | Değer |
|---|---|
| Depo | <https://github.com/atlantis77ut/dora-ai-package> (herkese açık, AGPL-3.0) |
| Canlı dashboard | <https://atlantis77ut.github.io/dora-ai-package/> |
| İlk sürüm commit'i | `ac3e565` — "DORA AI Package 0.3.0 — ilk açık kaynak sürümü" |
| CI | `validate` ve `pages` iş akışları yeşil (push başına) |
| Yayınlanan dosya sayısı | 81 (dev-private.pem, node_modules, .dora-onboarding hariç) |
| Telif sahibi | ustauretim |
| Kapsam (0.4.0) | 27 covered · 1 partial (Art-12) · 0 gap · %96 |

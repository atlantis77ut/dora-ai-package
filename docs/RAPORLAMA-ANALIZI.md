# Raporlama Analizi — DORA AI Package

Tarih: **2026-11-08** · Kapsam: DORA raporlama yükümlülükleri ve paketin bunları karşılama düzeyi
Veri kaynağı: [`data/mapping/dora-articles.yaml`](../data/mapping/dora-articles.yaml) · özet tablo: [KAPSAM-OZETI.md](KAPSAM-OZETI.md)

---

## 1. Bugün nerede duruyoruz

Paket 28 yükümlülük maddesinin 24'ünü tam, 3'ünü kısmi karşılıyor; 1 madde açık.
**Raporlama tarafı, kapsamın en zayıf halkası**: raporlamayla ilgili 5 maddenin yalnızca 1'i tam.

| Yükümlülük | Madde | Süreç | Kontrol | Durum |
|---|---|---|---|---|
| Büyük olay bildirimi (4 saat / 72 saat / 1 ay) | Art-19 | PRC-INC-02, -03, -04 | CTL-INC-003, -004, -005, -006 | ✅ Tam |
| Bildirim şablonu uyumu (ITS 2024/2956) | Art-20 | PRC-INC-02, -03, -04 | CTL-INC-004 | 🟡 Kısmi — alan eşlemesi yok |
| Ödeme olaylarının ayrı raporlanması | Art-23 | PRC-INC-02 | CTL-INC-003 | 🟡 Kısmi — ayrım kuralı yok |
| Bilgi kaydının (RoI) yıllık sunumu | Art-28 | PRC-TPP-04 | CTL-TPP-005 | 🟡 Kısmi — format ve takvim yok* |
| Yönetim organına düzenli raporlama (MI) | Art-05 / Art-06 | PRC-RSK-01 | CTL-RSK-001 | 🟡 Kısmi — MI paketi tanımlı değil* |
| Gönüllü siber tehdit bildirimi | Art-19(3) | — | — | 🔴 Yok* |
| Kriz iletişimi | Art-14 | (PRC-INC-04'e bağlı) | — | 🔴 Boşluk |
| Tehdit istihbaratı paylaşımı | Art-45 | PRC-INF-01, -02 | CTL-INF-001, -002, -003 | ✅ Tam |

\* Eşleme dosyasında "partial/gap" olarak işaretli değil; bu satırlar paketin kendi verisinden
değil, yükümlülük metniyle karşılaştırmadan çıkan değerlendirmedir. Eşlemeye işlenmeleri gerekir.

---

## 2. Kapatma önerileri

Her öneri mevcut şemalara uyacak şekilde tasarlandı: yeni süreç → `pillar-*.yaml`, yeni kontrol →
`controls-catalog.yaml`, eşleme → `dora-articles.yaml`, kapı → `corf-lifecycle.yaml`.

### Ö-1 · Kriz iletişimi (Art-14) — tek gerçek boşluk

- **Ne:** `PRC-INC-06` kriz iletişimi süreci + `CTL-INC-009` kontrolü.
- **İçerik:** sözcü matrisi (CEO / CISO / kurumsal iletişim), 4 saat içinde yayınlanacak "holding statement"
  şablonu, düzenleyici–müşteri–basın için ayrı kanal kuralları, onay akışı, yanlış bilgi düzeltme prosedürü.
- **Kanıt:** onaylı şablon sürümü, tatbikat kaydı, yayın zaman damgası.
- **Etki:** kapsam %86 → %89. **Efor:** 1 gün (şablon + 2 kural + 1 kontrol).

### Ö-2 · ITS 2024/2956 alan eşlemesi (Art-20) — kısmiyi kapatır

- **Ne:** `data/mapping/its-2024-2956.yaml` — her bildirim alanı (initial / intermediate / final) → süreç
  çıktısı → kanıt alanı eşlemesi; `CTL-INC-004` kanıt şartnamesi bu dosyaya bağlanır.
- **Neden:** Banka denetiminde ilk soru "şablonunuz hangi ITS alanını dolduruyor" olur. Şu an yalnızca
  "alanlar tanımlı" deniyor.
- **Etki:** Art-20 partial → covered. **Efor:** 1–2 gün (alan listesi + eşleme + doğrulama betiği).

### Ö-3 · Ödeme olayı ayrımı (Art-23) — kısmiyi kapatır

- **Ne:** `PRC-INC-02` içine ödeme olayı sınıflandırma kuralı (ödeme zinciri kesintisi, kart işlem
  etkisi, TCMB kanalı) + `CTL-INC-010` kontrolü; `docs/local-equivalents-TR.md` ile çift yönlü referans.
- **Etki:** Art-23 partial → covered. **Efor:** 0,5 gün.

### Ö-4 · Gönüllü siber tehdit bildirimi (Art-19(3)) — hiç yok

- **Ne:** `PRC-INF-03` + `CTL-INF-004`: eşik (henüz olaylaşmamış tehdit), gizlilik kontrolü, bildirim
  kararı, geri çekme prosedürü.
- **Neden:** Büyük olay eşiğini geçmeyen ama kurumu tehdit eden sinyaller bugün hiçbir sürece düşmüyor.
- **Etki:** yeni yükümlülük kapsaması. **Efor:** 0,5 gün.

### Ö-5 · Yönetim kurulu MI paketi (Art-05/06) — eksik raporlama

- **Ne:** `PRC-RSK-06` + `CTL-RSK-011`: aylık/çeyreklik tek sayfalık paket — açık büyük olay sayısı,
  4/72 saat SLA uyumu, kapsam yüzdesi, açık yüksek bulgu, tedarikçi yoğunlaşma eşiği, TLPT durumu.
- **Neden:** Paket şu an "olay olduğunda rapor" diyor; "her ay yönetim ne görüyor" tanımlı değil.
  Art-14 notundaki "CEO ajanı yalnızca yönetim kurulu raporlamasını kapsıyor" ifadesi de bunu doğruluyor.
- **Etki:** Art-05/06 güçlenir, denetimde "yönetim gözetimi" kanıtı oluşur. **Efor:** 1 gün.

### Ö-6 · Düzenleyici takvim (raporlama altyapısı)

- **Ne:** `data/regulatory-calendar.yaml` — 4 saat / 72 saat / 1 ay, yıllık RoI sunumu, 3 yılda TLPT,
  yıllık çerçeve gözden geçirmesi; dashboard'a "yaklaşan yükümlülükler" kartı.
- **Neden:** Süreler süreçlerin içinde dağınık; tek bakışta "bu ay ne sunulacak" görünmüyor.
- **Efor:** 0,5 gün.

---

## 3. Paket dışı ama müşterinin soracağı üç şey

1. **Kanıt paketi ihracı** — olay dosyası + hash zinciri + imza tek zip olarak çıkmıyor. CLI'da
   `dora-onboard export --session ... --evidence` komutu yok.
2. **Bildirim formu üretimi** — JSON olay kaydından ITS alanlarına otomatik doldurulmuş PDF/XBRL üretimi yok.
   (Ajan çalıştırıcısı bilinçli olarak kapsam dışı; bu yüzden şablon üretimi deterministik araç olmalı.)
3. **Dashboard'da raporlama görünümü** — mevcut dashboard statik kapsam gösteriyor; açık olaylar,
   yaklaşan SLA'lar ve yıllık takvim yok. Satış demosunda en çok sorulan ekran bu olur.

---

## 4. Öncelik

| Sıra | İş | Kapsam etkisi | Efor | Öneri |
|---|---|---|---|---|
| 1 | Ö-1 kriz iletişimi | %86 → %89 | 1 gün | Yayın öncesi |
| 2 | Ö-2 ITS alan eşlemesi | Art-20 kapanır | 1–2 gün | İlk pilot öncesi |
| 3 | Ö-5 yönetim MI paketi | Art-05/06 güçlenir | 1 gün | İlk pilot öncesi |
| 4 | Ö-3 ödeme olayı | Art-23 kapanır | 0,5 gün | Pilot sırasında |
| 5 | Ö-4 gönüllü bildirim | yeni kapsam | 0,5 gün | Pilot sırasında |
| 6 | Ö-6 takvim + export | sunum/altyapı | 1,5 gün | Tanıtım sonrası |

**Tek cümle:** %86 dürüst bir rakam; ama "olay raporlamasını uçtan uca kapsıyoruz" demek için
önce Ö-2 ve Ö-3, "kriz anında iletişim var" demek için Ö-1 şart.

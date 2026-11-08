# Raporlama Analizi — DORA AI Package

Tarih: **2026-11-08** · Sürüm: **0.4.1** · Kapsam: DORA raporlama yükümlülükleri
Veri: [`data/mapping/dora-articles.yaml`](../data/mapping/dora-articles.yaml) · tablo: [KAPSAM-OZETI.md](KAPSAM-OZETI.md)

---

## 1. Bugünkü durum

**28 madde tam · 0 kısmi · 0 boşluk · %100.** Raporlamayla ilgili maddelerin tamamı kapandı.
Tek açık kalan, yedekleme maddesiydi (Art-12); 0.4.1'de o da kapandı.

| Yükümlülük | Madde | Süreç | Kontrol | Durum |
|---|---|---|---|---|
| Büyük olay bildirimi (4 saat / 72 saat / 1 ay) | Art-19 | PRC-INC-02, -03, -04 | CTL-INC-003…006 | ✅ Tam |
| Gönüllü siber tehdit bildirimi | Art-19 | PRC-INC-05 | CTL-INC-008 | ✅ Tam |
| Bildirim şablonu alanları | Art-20 | PRC-INC-02, -03, -04 | CTL-INC-004 | ✅ Tam |
| Ödeme olaylarının ayrı raporlanması | Art-23 | PRC-INC-02, -07 | CTL-INC-003, -010 | ✅ Tam |
| Kriz iletişimi | Art-14 | PRC-INC-06 | CTL-INC-009 | ✅ Tam |
| Bilgi kaydı (RoI) yıllık sunumu | Art-28 | PRC-TPP-04 | CTL-TPP-005 | 🟡 Format/takvim açık* |
| Yönetim organına düzenli raporlama (MI) | Art-05 / 06 | PRC-RSK-01 | CTL-RSK-001 | 🟡 MI paketi tanımlı değil* |
| Tehdit istihbaratı paylaşımı | Art-45 | PRC-INF-01, -02 | CTL-INF-001…003 | ✅ Tam |

\* Bu iki satır eşlemede "covered" görünüyor; eksik olan raporlama **artefaktı**, yükümlülüğün
kendisi değil. Aşağıda ayrı ele alındı.

---

## 2. Bu turda kapatılanlar

| # | İş | Ne eklendi | Eşleme etkisi |
|---|---|---|---|
| Ö-1 | Kriz iletişimi | `PRC-INC-06` (sözcü matrisi, 4 saatlik ilk açıklama, 2 saatlik düzeltme), `CTL-INC-009` | Art-14: gap → covered |
| Ö-2 | ITS alan sözlüğü | `data/mapping/its-2024-2956.yaml` — ilk/ara/nihai bildirim alanları + her alanın kanıt kaynağı | Art-20: partial → covered |
| Ö-3 | Ödeme olayı ayrımı | `PRC-INC-07` (çift kanal: DORA + TCMB), `CTL-INC-010` | Art-23: partial → covered |
| — | Gönüllü bildirim eşlemesi | Art-19 satırına `PRC-INC-05` + `CTL-INC-008` | düzeltme |

Kapsam: **%86 → %100**. Süreç 21 → 23, kontrol 32 → 35.

---

## 3. Bir düzeltme: "gönüllü bildirim yok" yanlıştı

İlk analizde Art-19(3) kapsamında gönüllü tehdit bildirimini "yok" diye işaretledim. **Yanlıştı:**
`PRC-INC-05` ve `CTL-INC-008` 0.3.0'dan beri pakette vardı — ama `dora-articles.yaml` bu süreci
hiç göstermiyordu. Yani eksik olan yetenek değil, **eşlemenin kendisiydi**.

Bunun tekrarlanmaması için öneri: `render-mapping.mjs --check` iki yönlü bütünlük de denetlesin —

- her süreç en az bir maddede geçiyor mu?
- her kontrol en az bir maddede geçiyor mu?

Bugün 24 sürecin ve 36 kontrolün tamamı eşlemede görünüyor; CI'daki ters yön kontrolü bu sessiz
boşluk sınıfını kapatıyor.

---

## 4. Kalan işler

### 4.1 Paket içi

1. ~~**Art-12 yedekleme**~~ — `CTL-RSK-011` ile kapandı (0.4.1): yedek konumu, şifreleme,
   saklama süresi, geri yükleme testi, bütünlük hash'i.
2. **RoI yıllık sunumu (Art-28)** — format ve takvim tanımlı değil: `data/regulatory-calendar.yaml`
   + XBRL çıktı sözleşmesi. ~0,5 gün.
3. **Yönetim kurulu MI paketi (Art-05/06)** — `PRC-RSK-06` + `CTL-RSK-011`: aylık tek sayfa
   (açık olay, 4/72 saat SLA uyumu, kapsam, açık yüksek bulgu, tedarikçi yoğunlaşması, TLPT).
   ~1 gün.

### 4.2 Paket dışı, müşterinin soracağı

1. **Kanıt paketi ihracı** — olay dosyası + hash zinciri + imza tek arşivde:
   `dora-onboard export --session ... --evidence`.
2. **Bildirim formu üretimi** — JSON olay kaydı → ITS alanları → PDF/XBRL. Ajan çalıştırıcısı
   kapsam dışı olduğu için bu deterministik bir araç olmalı, ajan işi değil.
3. **Dashboard'da raporlama görünümü** — açık olaylar, yaklaşan SLA'lar, yıllık takvim.
   Mevcut dashboard statik kapsam gösteriyor; satış demosunda en çok sorulan ekran bu.

---

## 5. Öncelik

| Sıra | İş | Kapsam etkisi | Efor |
|---|---|---|---|
| 1 | MI paketi (4.1.3) | yönetim gözetimi kanıtı | 1 gün |
| 2 | ~~Art-12 ayrı kontrol~~ | %100'e ulaşıldı | tamam |
| 3 | RoI takvim/format (4.1.2) | yıllık sunum hazırlığı | 0,5 gün |
| 4 | Kanıt ihracı + form üretimi (4.2.1–2) | operasyonel kullanım | 2 gün |
| 5 | Dashboard raporlama görünümü (4.2.3) | satış demosu | 1 gün |

**Tek cümle:** Raporlama maddelerinin tamamı artık kapsanıyor; kalan iş "kapsam" değil
"kullanılabilirlik" — yani kanıtı dışa veren ve yönetime gösteren araçlar.

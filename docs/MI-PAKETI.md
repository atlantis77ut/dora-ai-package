# MI Paketi ve Düzenleyici Takvim

Sürüm 0.7.0 · 8 Kasım 2026 · ustauretim

İki araç:

1. **dora-onboard mi** — yönetim kuruluna giden tek sayfalık dönem raporu (KPI + kırmızı bayrak + olaylar + yükümlülükler).
2. **dora-onboard calendar** — DORA yükümlülüklerinin tek listesi (süre, süreç, sahip).

İkisi de deterministiktir; ajan kullanmaz. Amaç, "her ay yönetim ne görüyor" sorusunu
tek bir belgeye indirmek ve sürelerin süreçlerin içinde dağılmasını engellemek.

---

## 1. Neden MI paketi

Paket öncesinde raporlama iki uçta duruyordu: olay anında regülatöre bildirim (PRC-INC-02/03/04)
ve yıllık çerçeve gözden geçirmesi. Arada kalan **düzenli yönetim gözetimi** tanımlı değildi;
Art-14 notunda "CEO ajanı yalnızca yönetim kurulu raporlamasını kapsıyor" deniyordu ama
raporun içeriği yazılı değildi.

0.7.0 bunu kapatıyor: **PRC-RSK-06** süreci ve **CTL-RSK-012** kontrolü, aylık MI paketini
üretim, onay ve kanıt zincirine bağlıyor. Art-05 ve Art-06 eşlemeleri bu süreci gösteriyor.

---

## 2. Paket içeriği

Tek sayfa, yazdırmaya hazır HTML + makine okunur JSON:

| Bölüm | Ne gösterir |
|---|---|
| KPI kartları | DORA kapsamı, açık büyük olay, 4 saat bildirim uyumu, kritik boşluk, yıllık gözden geçirme, yoğunlaşma eşiği |
| Kırmızı bayraklar | Açık büyük olay, %100 altı kapsam, açık kritik boşluk |
| Olaylar | Dönemdeki olay kaydı (id, sınıf, tespit, kapanış) |
| Yaklaşan yükümlülükler | Anchor dosyası verilirse önümüzdeki N günün takvimi (tarih + kalan gün) |
| Yükümlülükler | Aylık ve olay bazlı yükümlülükler (madde, süre, sahip) |

Her KPI kartının altında **kaynak dosya** yazılıdır. Veri yoksa kart "veri yok" gösterir ve
altbilgide eksik KPI listesi yer alır. Uydurma değer üretilmez; bu, denetimde "bu sayı nereden
geldi" sorusunun cevabını görünür kılar.

### KPI kaynakları

| KPI | Kaynak |
|---|---|
| DORA kapsamı | data/mapping/dora-articles.yaml (canlı hesap) |
| Açık büyük olay | incident-record.json (closed_at alanı) |
| 4 saat bildirim uyumu | notification-receipt.json#within_sla |
| Kritik boşluk | gap-analysis.json#high_severity |
| Yıllık gözden geçirme | go-live.json#annual_review_date |
| Yoğunlaşma eşiği aşımı | register-of-information.json#concentration_breaches |

---

## 3. Kullanım

~~~bash
# dönem raporu (varsayılan dönem: bu ay)
node bin/dora-onboard.mjs mi --session ob-2026-xxxxx --period 2026-11

# yükümlülük takvimi
node bin/dora-onboard.mjs calendar
node bin/dora-onboard.mjs calendar --frequency monthly

# yaklaşanlar (kurum tarihleriyle)
node bin/dora-onboard.mjs calendar --next 90 --anchors data/calendar-anchors.example.yaml
node bin/dora-onboard.mjs mi --session ob-2026-xxxxx --anchors data/calendar-anchors.example.yaml --days 90
~~~

Çıktı: mi/<oturum>/mi-<dönem>.html ve .json.

Kırmızı bayrak varsa CLI bunu kırmızı yazar; eksik KPI sayısını da söyler. Çıkış kodu 0'dır —
paket her durumda üretilir, çünkü eksik veri de yönetimin görmesi gereken bir bilgidir.

---

## 4. Düzenleyici takvim

data/regulatory-calendar.yaml içinde 9 yükümlülük var:

| ID | Yükümlülük | Sıklık |
|---|---|---|
| OBL-INC-4H | Büyük olay — ilk bildirim | olay bazlı |
| OBL-INC-72H | Ara rapor | olay bazlı |
| OBL-INC-1M | Nihai rapor | olay bazlı |
| OBL-PAY-4H | Ödeme olayı — çift kanal | olay bazlı |
| OBL-MI-MONTHLY | Yönetim kurulu MI paketi | aylık |
| OBL-FW-ANNUAL | Çerçevenin yıllık gözden geçirmesi | yıllık |
| OBL-TEST-ANNUAL | Kritik işlevlerin yıllık testi | yıllık |
| OBL-ROI-ANNUAL | Bilgi kaydı (RoI) yıllık sunumu | yıllık |
| OBL-TLPT-3Y | TLPT döngüsü | 3 yılda bir |

Takvim **sabit tarih uydurmaz**. DORA'da yıllık yükümlülüklerin tarihi kuruma/yetkili otoriteye
bırakılmıştır; dosya sıklık ve son tarih metnini verir, kurum kendi takvimine işler.

---

## 5. Sınırlar

- KPI'lar oturum artefaktlarına dayanır; kurumun canlı sistemlerine bağlanmaz. Gerçek veri
  için ajanların/konnektörlerin artefaktları üretmesi gerekir (0.8 konusu).
- Paket imzalanmaz; onay kaydı ayrı dosyadır (mi-approval.json) ve CTL-RSK-012 kanıtıdır.
- Tarih hesabı anchor dosyasına bağlıdır. Dosya yoksa "Yaklaşan yükümlülükler" bölümü
  "tarih girilmemiş" der; paket yine üretilir. DORA yıllık yükümlülükler için sabit tarih
  vermediğinden bu tarihler kurumun seçimidir (data/calendar-anchors.example.yaml).

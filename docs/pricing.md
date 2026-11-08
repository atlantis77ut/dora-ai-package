# Fiyatlandırma Çerçevesi

> **Bu bir öneri çerçevesidir, karar değildir.** Rakamlar piyasa aralığı olarak verildi;
> nihai fiyatı sen belirlersin. Boş bırakılan yerler bilinçli — fiyat, strateji kararıdır.

Son güncelleme: 2026-11-03 · Para birimi: EUR (KDV hariç)

---

## 1. Fiyatı neye göre belirliyoruz

Üç eksen var; her biri farklı bir satın alma davranışına denk gelir:

| Eksen | Ne ölçer | Kime uyar | Riski |
|---|---|---|---|
| **Kurum ölçeği** (tier) | bilanço, çalışan, sistemik önem | tek seferlik satış, net paket | küçük kurum "pahalı" der |
| **Aktif ajan sayısı** | kaç rol devrede | kademeli büyüme (land & expand) | müşteri ajan sayısını kısar |
| **Süreç kapsamı** | kaç sütun/faz açık | modüler satış | paket bütünlüğü bozulur |

**Öneri:** ana eksen **tier**, ikincil eksen **aktif ajan sayısı**. Süreç kapsamı paket içinde
 gelsin (parçalanmasın) — denetimde "yarım çerçeve" işe yaramaz, müşteriye de satmaya çalışırken
anlatması zor.

---

## 2. Değer çapası

Fiyatı rakiple değil, **müşterinin kaçındığı maliyetle** kıyasla:

| Müşteri tarafındaki maliyet | Tipik büyüklük | Paket ne kadarını azaltır |
|---|---|---|
| DORA uyum programı (danışmanlık) | 200.000 – 1.000.000 € | %20–40 (tekrar eden iş azalır) |
| Büyük olay bildirim gecikmesi cezası | değişken, itibar riski yüksek | sıfırlama hedefi |
| Yıllık denetim hazırlığı | 300–800 adam-gün | %40 azalma |
| RoI/sözleşme uyumsuzluğu düzeltmesi | 50.000 – 300.000 € | erken tespit |

Yani **60.000 €'luk yıllık lisans**, 300.000 €'luk bir maliyet kalemini hedefliyorsa savunulabilir.
Bu tabloyu teklife koy; fiyat, değerin yüzdesi olarak okunur.

---

## 3. Katman önerisi

| Katman | Kapsam | Aktif ajan | Önerilen yıllık aralık |
|---|---|---|---|
| **Starter** | 60 terim, 4 zorunlu ajan, 5 temel süreç, TR profili | 4 | **12.000 – 18.000 €** |
| **Professional** | tüm ajanlar (11), 21 süreç, 32 kontrol, CORF 6 fazı | 11 | **35.000 – 55.000 €** |
| **Enterprise** | Professional + TLPT/CTPP + öncelikli destek + yol haritası etkisi | 11 + özel | **80.000 – 140.000 €** |
| **Public Sector** | Kamu uyarlaması, yerel mevzuat eşlemesi, kapalı ağ kurulumu | 4–11 | **20.000 – 35.000 €** |

Tek seferlik kurulum (onboarding, entegrasyon, eğitim): **15.000 – 60.000 €** (kapsama göre).

**Alternatif model (kademeli giriş):** 6.000 – 9.000 €/ajan/yıl. Küçük başlangıç için iyi,
ama 11 ajanda Starter'ın 2 katına çıkar — müşteri fark eder, fiyat tutarlılığı bozulur.
Öneri: yeni müşteride ajan bazlı **ilk yıl**, sonra tier'a geçiş.

---

## 4. İndirim ve kanal politikası

| Durum | Öneri |
|---|---|
| Pilot (16 hafta) | ücretsiz veya 5.000 €; başarılıysa ilk yıl %50 |
| 3 yıllık peşin | %10 |
| Referans vaka yayını izni | %5–10 (tek seferlik) |
| Kamu | %15–20 (ihale şartlarına göre) |
| Partner / yeniden satıcı marjı | %20–30 |
| Çoklu yargı alanı (TR+AB) | +%15 |
| İkinci kurum (aynı grup) | %30 |

İndirim yetkisi: satış temsilcisi %10'a kadar, satış direktörü %25'e kadar, üzeri kurucu onayı.
**Kural:** indirim listeye işlenir; "sessiz indirim" yok — yoksa fiyat erozyonu başlar.

---

## 5. Örnek hesap

**Tier 2 mevduat bankası, TR, 3 yıl, Professional:**

| Kalem | Tutar |
|---|---|
| Kurulum (onboarding + SIEM/ITSM entegrasyonu + eğitim) | 30.000 € |
| Yıllık lisans × 3 | 45.000 × 3 = 135.000 € |
| 3 yıllık peşin indirimi (%10) | −13.500 € |
| **Toplam (3 yıl)** | **151.500 €** |

Yıllık ortalama ~50.500 €. Karşılaştırma: aynı kurumun denetim hazırlığı 400 adam-gün × 400 €
= 160.000 €/yıl. Paket, bunun %30'unu azaltıyorsa yıllık 48.000 € tasarruf — fiyat nötr, risk azalması
bonus.

---

## 6. Fiyat kararı için 5 soru (senin cevaplaman gereken)

1. **Hedef segment:** ilk 12 ayda kaç kurum, hangi tier? (3 pilot mu, 10 Starter mı?)
2. **Kanal:** doğrudan satış mı, danışmanlık partnerleri mi? (marj buna bağlı)
3. **Fiyat mimarisi:** tier mı, ajan başına mı, ikisi mi?
4. **Para birimi:** EUR mu, TL mi? (kur riski kime ait?)
5. **Marj hedefi:** brüt marj %70 mi, %85 mi? (destek yükü buna göre planlanır)

Bu beşi netleşmeden `LICENSE-COMMERCIAL.md` içindeki `[ ]` alanları doldurulmamalı.

---

## 7. Yapılacaklar

- [ ] Katman fiyatlarını kesinleştir (§3 aralıklarından seç)
- [ ] Kurulum hizmetinin kapsamını yaz (kaç gün, ne dahil)
- [ ] İndirim yetki matrisini onayla (§4)
- [ ] Ödeme koşulları: peşin / 30 gün / 3 taksit — belirle
- [ ] `LICENSE-COMMERCIAL.md` §2 tablosunu bu kararlarla doldur
- [ ] Teklif şablonu oluştur (fiyat + değer tablosu + referans)

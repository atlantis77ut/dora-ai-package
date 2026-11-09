# Pilot Vaka Çalışması Şablonu

Pilot bitiminde doldurulur; `pilots/pilot-agreement-template.md` Madde 5 uyarınca yayın
**yazılı onayla** yapılır. Doldurulmuş hâli referans programına girer.

> Kural: bu şablon **ölçüm** ister, izlenim istemez. Her iddia bir metrik veya bir kayıt
> numarasıyla desteklenmeli. Desteklenemeyen bölüm "veri yok" olarak bırakılır — boş bırakmak,
> tahmin yazmaktan iyidir.

---

## 0. Künye

| Alan | Değer |
|---|---|
| Pilot kurum (yayın adı) | |
| Tier | tier1 / tier2 / tier3 |
| Sektör | banka / sigorta / ödeme / kripto / kamu |
| Yargı alanı | TR / AB / çoklu |
| Kullanılan profil | `orl-lifecycle.yaml` sürümü + `jurisdiction-config` |
| Pilot süresi | … hafta (planlanan / gerçekleşen) |
| Aktive edilen ajanlar | ROL-… (liste) |
| Pasif bırakılan süreçler | PRC-… (varsa gerekçe) |
| Onay veren (kurum) | ad, unvan, tarih |

---

## 1. Başlangıç durumu

Pilot öncesi ölçüm — sonraki bölümdeki karşılaştırmanın tabanı.

| Gösterge | Değer | Kaynak |
|---|---|---|
| Yıllık ICT olay sayısı | | ITSM |
| Büyük olay sayısı (son 12 ay) | | olay kayıtları |
| Ortalama sınıflandırma süresi | … saat | olay kayıtları |
| Bildirim SLA uyumu | … % | regülatör yazışmaları |
| ICT envanter kapsamı | … % | CMDB |
| Tedarikçi sözleşmelerinde Madde 30 uyumu | … % | hukuk taraması |
| Denetim hazırlık süresi | … gün | iç denetim |
| DORA olgunluk skoru (öz değerlendirme) | … / 5 | C5 çıktısı |

---

## 2. Kurulum deneyimi (ORL 6 fazı)

Her faz için: süre, takılma noktası, kimin kararı gerektiği.

| Faz | Planlanan | Gerçekleşen | Takılma | Çözüm |
|---|---|---|---|---|
| C1 Identify | 10 gün | | | |
| C2 Set tolerances | 8 gün | | | |
| C3 Map resources | 20 gün | | | |
| C4 Scenario tests | 12 gün | | | |
| C5 Self-assessment | 10 gün | | | |
| C6 Implement MOS | 45 gün | | | |

**Kapılar kaç kez kırıldı?** Hangi kriter, kaç denemede geçildi? (Bu, paketin en değerli
gerçek dünya verisidir — kapı kırılmaları tasarımın nerede zorlandığını gösterir.)

---

## 3. Senaryo sonuçları

`tests/synthetic-scenarios/` çalıştırmasının kurum verisiyle tekrarı.

| Senaryo | Assertion (geçen/toplam) | Negatif test tetiklendi mi? | Not |
|---|---|---|---|
| SCN-01 Büyük olay | … / 8 | | |
| SCN-02 Tedarikçi çıkışı | … / 7 | | |
| SCN-03 Regülatör talebi | … / 6 | | |

**İnsan override oranı:** … % (hedef ≤ %5)
**Yanlış sınıflandırma:** … % (hedef ≤ %2 gölge modda)
**SLA ihlali:** … (hedef 0)

---

## 4. Ajan davranışı — ne işe yaradı, nerede zorlandı

Üç sütun: iyi çalıştı / sınırda / başarısız. Her satırda somut örnek (olay no veya test no).

| Durum | Örnek | Ajan | İnsan müdahalesi |
|---|---|---|---|
| İyi | | | |
| Sınırda | | | |
| Başarısız | | | |

**Beklenmedik davranış.** Ajanın tanımda olmayan bir şey yaptığı her durum — iyi veya kötü.
Bu bölüm ürün yol haritasını belirler.

---

## 5. Ölçüm sonuçları

Pilot başarı kriterleri (`pilots/success-criteria.yaml`) karşısında gerçekleşen:

| Kriter | Hedef | Gerçekleşen | Kaynak/kanıt |
|---|---|---|---|
| Olay sınıflandırma doğruluğu | ≥ %95 | | |
| SLA ihlali | 0 | | |
| İnsan override | ≤ %5 | | |
| Denetim izi bütünlüğü | %100 | | hash doğrulama raporu |
| Uyum maliyetinde azalma | ≥ %20 | | finans |
| Olay müdahale süresinde azalma | ≥ %30 | | ITSM |
| Denetim hazırlık süresinde azalma | ≥ %40 | | iç denetim |
| Kullanıcı memnuniyeti | ≥ 4/5 | | anket |
| NPS | ≥ 40 | | anket |
| Üretime geçme niyeti | Evet | | yönetim kararı |

**Ölçülemeyen kriter varsa nedeni:** …

---

## 6. Uyum ve denetim

- **Kapsama:** `coverage-matrix.json` — covered / partial / gap sayıları. Durum: …
- **Açık boşluklar:** hangi DORA maddesi, neden açık, kim kapatacak, ne zaman.
- **Regülatörle temas:** hangi konuda, hangi kanaldan, ne cevap alındı (özet).
- **Denetim izi:** kaç karar kaydedildi, kaçı geriye dönük doğrulandı.
- **Bağımsız doğrulama:** C5 imzasını kim attı, hangi kanıtla.

---

## 7. Sorunlar ve çözümler

| # | Sorun | Etki | Geçici çözüm | Kalıcı çözüm önerisi | Durum |
|---|---|---|---|---|---|
| 1 | | | | | açık/kapalı |

Öncelik: P0 (pilotu durdurdu) / P1 (SLA riski) / P2 (verimlilik) / P3 (kozmetik).

---

## 8. Dersler

**Paketin değişmesi gereken yerler.** En fazla 5 madde; her biri bir dosya/alan önerisiyle:

1. …
2. …

**Kurumun değiştirmesi gereken yerler.** Süreç, yetki veya veri sahipliği:

1. …

**Yanlış varsayımlarımız.** Pilot öncesi doğru sandığımız, pilotun çürüttüğü şeyler:

1. …

---

## 9. Referans olarak kullanım

- [ ] Vaka çalışması yayınına izin var (imza: …)
- [ ] Anonimleştirme yapıldı (kurum adı, kişi adları, tutarlar maskelendi)
- [ ] Regülatör adı paylaşılabilir / paylaşılamaz
- [ ] Metrikler paylaşılabilir / yalnızca aralık olarak

**Kamuya açık özet (2-3 cümle):**

> …

---

## 10. Sonraki adım

| Karar | Sonuç |
|---|---|
| Üretime geçiş | evet / hayır / koşullu (koşul: …) |
| Lisans modeli | Starter / Professional / Enterprise |
| v2.0'a girecek değişiklikler | (madde listesi) |
| Referans programına katılım | evet / hayır |

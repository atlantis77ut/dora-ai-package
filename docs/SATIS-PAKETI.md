# Satış Paketi — DORA AI Ajan Paketi

9 Kasım 2026 · v1.1.0 · ustauretim

---

## 1. Tek cümle

DORA uyumunu belgede bırakmayan, **çalıştırılabilir** bir çerçeve: 28 yükümlülük maddesi
24 süreç ve 36 kontrole bağlanmış, her adımı kanıtla ve geçiş kapısıyla doğrulanıyor.

---

## 2. Problem

1. **Süreçler belgede kalıyor.** Risk çerçevesi Word’de, olay akışı Excel’de, kanıt e-postada.
2. **Süreler tutmuyor.** 4 saatlik bildirim kimin, hangi olayda, saat kaçta başlıyor — yazılı değil.
3. **Ajan kullanımı denetlenemiyor.** Hangi ajanın hangi kararı verebileceği tanımlı değil.

---

## 3. Ne alıyor

| Bileşen | Sayı |
|---|---|
| DORA yükümlülük maddesi | 28 (tamamı eşlenmiş) |
| Süreç / kontrol | 24 / 36 (kanıt şartnameli) |
| Ajan rolü | 11 (üç savunma hattı) |
| ORL fazı | 6 (kapılı) |
| JSON şema | 15 (katalog + artefakt) |
| Kabul senaryosu | 4 (27 assertion) |

Yanında: kanıt paketi (hash zinciri + imza), ITS bildirim formu, aylık MI paketi,
düzenleyici takvim, dosya bırakma konnektör sözleşmesi.

---

## 4. Neden bu

- **Kapı mantığı.** Kriter tutmazsa CLI çıkış kodu 2 verir; sonraki faz başlamaz. "Yaptık sayalım" teknik olarak engellenir.
- **Kanıt zinciri.** Her çıktı sha256 ile zincire bağlanır, paket Ed25519 ile imzalanır. Denetçi tek dosyayla doğrular.
- **Kendi kendini doğrular.** 14 veri dosyası 15 şemaya karşı katı modda denetlenir; CI 6 ortamda koşar.
- **Bağımlılıksız.** `npm install` yok; banka ağında kurulum sürtünmesi düşük.
- **Dürüst kapsam.** "DORA’nın tamamı" denmiyor; 28 yükümlülük maddesi deniyor, sınırlar yazılı.

---

## 5. Fiyat (öneri — onay bekliyor)

| Katman | Kapsam | Yıllık |
|---|---|---|
| Starter | 4 ajan, 5 süreç, topluluk desteği | **15.000 €** |
| Professional | Tüm ajanlar, 24 süreç, 36 kontrol | **45.000 €** |
| Enterprise | + TLPT/CTPP, 7/24, yol haritası etkisi | **110.000 €** |
| Public Sector | Kamu uyarlaması, kapalı ağ | **28.000 €** |

Pilot: ilk iki kurum için **%50**. Kurulum/eğitim: 15.000–60.000 € (kapsama göre).

Değer çapası: 60.000 €’luk bir lisans, 300.000 €’luk bir denetim bulgusunu önlüyorsa savunulabilir.

---

## 6. İtirazlara cevap

| İtiraz | Cevap |
|---|---|
| "Bunu Excel’le de yapıyoruz." | Excel kanıt zinciri tutmaz; denetçiye tek dosya veremezsiniz. |
| "Bizde DORA yok, BDDK var." | Yerel eşleme paketin içinde (`local-equivalents-TR.md`); DORA tabanı korunur. |
| "Açık kaynaksa neden para ödeyelim?" | Çekirdek AGPL; kapalı ürüne gömme, 7/24 destek ve tazminat ticari lisansın konusu. |
| "Verimiz nereye gidiyor?" | Hiçbir yere. Paket çevrimdışı çalışır; kanıt paketi şifrelenmez, kurumda kalır. |
| "Ajanlar karar verirse sorumluluk?" | Otonomi merdiveni: C1-C2 observe, C6’da bile insan onayı. `human_oversight` alanları yazılı. |

---

## 7. Tanıtım metinleri

### X / Twitter (3 gönderi)

1. DORA uyumunu Word ve Excel’de yürütmek zorunda değilsiniz. 28 yükümlülük maddesi,
   24 süreç, 36 kontrol — hepsi çalıştırılabilir dosyalar hâlinde. Açık kaynak:
   github.com/atlantis77ut/dora-ai-package

2. Fark şu: her fazın sonunda **geçiş kapısı** var. Kriter tutmazsa CLI çıkış kodu 2 verir,
   sonraki faz başlamaz. "Yaptık sayalım" kültürü teknik olarak engellenir.

3. Kanıt paketi: tüm artefaktlar tek ZIP’te, sha256 zinciri + Ed25519 imza. Denetçi tek
   dosyayla doğrular. Kurulum `npm install` istemez; banka ağında çalışır.

### LinkedIn

DORA uyumu çoğu bankada aynı yerde tıkanıyor: süreçler belgede, kanıtlar dağınık, 4 saatlik
bildirim süresi kimin sorumluluğunda belli değil.

Bir yıldır üzerinde çalıştığımız DORA AI Ajan Paketi’ni açık kaynak olarak yayınladık:
28 yükümlülük maddesi 24 süreç ve 36 kontrole bağlanmış; her kontrolün kanıt şartnamesi var;
altı fazın her biri geçiş kapısıyla kapanıyor.

Paket ajan çalıştırıcısı değil — ajanların **yetkisini** ve **kanıtını** tanımlayan çerçeve.
Bu ayrımı özellikle koruduk: "ajan her şeyi yapar" iddiası denetimde çöküyor.

Depo: github.com/atlantis77ut/dora-ai-package · Canlı dashboard: atlantis77ut.github.io/dora-ai-package

---

## 8. Sonraki adım

1. Fiyatları ve destek SLA’larını onayla (bu dosya ve `LICENSE-COMMERCIAL.md`).
2. Adres/vergi no ve iletişim kanalını ekle.
3. Hukuk incelemesi (ticari lisans + KVKK).
4. Pilot görüşmesi: 2 kurum, %50, 8 hafta, `pilots/` altındaki şablonlarla.

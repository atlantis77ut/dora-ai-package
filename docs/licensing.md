# Lisans Rehberi — hangi durumda hangi lisans

Bu paket çift lisanslı: **AGPL-3.0** (açık) veya **ticari lisans** (ücretli).
Aşağıdaki tablo "benim durumum hangisi?" sorusunu yanıtlar.

> Bu bir rehberdir, hukuki görüş değildir. Kritik kararlarda avukatınıza danışın.

---

## 1. Hızlı karar tablosu

| Durum | Gereken lisans | Neden |
|---|---|---|
| Paketi incelemek, denemek, eğitimde kullanmak | AGPL-3.0 | kullanım serbest |
| Kendi kurumunuzda **iç kullanım** (süreçler, wizard, ajan tanımları) | AGPL-3.0 | iç kullanım "dağıtım" sayılmaz, kaynak açma yükümlülüğü yok |
| Kendi kurumunuzda kullanıp **değiştirmek**, değişikliği kimseyle paylaşmamak | AGPL-3.0 | iç kullanım; dağıtım yok |
| Değiştirip **başka bir kuruma dağıtmak** (danışmanlık teslimi) | AGPL-3.0 + kaynak açma **veya** ticari | dağıtım başladı |
| Kendi kapalı kaynak ürününüze **gömmek** | **Ticari** | AGPL bulaşıcılığı ürününüzü açardı |
| Paketi kullanan bir **SaaS** sunmak | **Ticari** | AGPL md. 13: ağ üzerinden kullanan herkese kaynak sunma zorunluluğu |
| **Beyaz etiket / yeniden satış** | Ticari (+ §5) | ayrı hak, ayrı ücret |
| Paketi **fork edip** kendi açık kaynak projeniz yapmak | AGPL-3.0 | türev de AGPL olur |
| Sadece **dokümanları** (bu rehber, mimari) alıntılamak | AGPL-3.0 | kod ile aynı lisans |

**Tek cümle:** iç kullanım serbest, dışarıya ürün/hizmet olarak sunmak ticari lisans gerektirir.

---

## 2. Sık sorulanlar

**Bankanın içinde kullanıyoruz, kaynak kodumuzu açmak zorunda mıyız?**
Hayır. AGPL, yükümlülüğü **dağıtım** ve **ağ üzerinden sunma** ile başlatır. Bir kurumun kendi
çalışanları için çalıştırması dağıtım değildir.

**Danışman olarak müşteriye kuruyorum, her müşteriye lisans mı?**
Müşteri kendi kurumunda AGPL ile kullanabilir. Ancak siz paketi **kendi ürününüzün parçası
olarak** sunuyorsanız (markanız altında, kapalı bileşenlerle) ticari lisans gerekir.

**Sadece 5 süreci kullanıyorum, yine ticari mi?**
Kapsam, kullanılan dosya sayısı değil **kullanım biçimidir**. İç kullanım için AGPL yeterli;
dışarıya sunuyorsanız lisans gerekir.

**Ajan tanımlarını (YAML) kopyalayıp kendi ürünümde kullanabilir miyim?**
YAML dosyaları da paketin parçasıdır; aynı lisans rejimine tabidir. Ayrıca bu tanımların bir
kısmı DORA metninden alıntıdır — alıntılanan mevzuat metni telif kapsamı dışındadır, ama
**seçki ve yapı** pakete aittir.

**AGPL'yi seçmemin ticari satışa zararı var mı?**
Aksine: kapalı ürün yapanlar için ticari lisansı **zorunlu** kılar, böylece hem topluluk hem
gelir kanalı açık kalır. Riski: bazı kurumsal hukuk ekipleri "AGPL" kelimesini görünce
otomatik reddeder — bu yüzden `docs/decisions.md` DR-007'de ticari lisansa geçiş kolaylığı
(yazılı teklif, tek sayfa) not edildi.

**Katkı gönderirsem ne olur?**
CLA (Contributor License Agreement) imzalamanız gerekir: katkınız AGPL olarak yayınlanır, ayrıca
ticari lisans altında sunulabilir. Aksi hâlde çift lisans modeli hukuken çalışmaz.

---

## 3. Müşteriye nasıl anlatılır (satış dili)

- "Kod açık, denetçiniz okuyabilir, kilitlenmezsiniz." → güven.
- "İç kullanım ücretsiz; ürününüze gömdüğünüzde ticari lisans." → net sınır.
- "Ticari lisans kaynak açma yükümlülüğünü kaldırır + garanti ve destek verir." → satın alma gerekçesi.
- "Kendi denetim ekibiniz kodu inceleyebilir; bu bizim için risk değil, referans." → farklılaşma.

---

## 4. Yapılacaklar (yayın öncesi)

- [x] Telif sahibi belirlendi: **ustauretim** (13 dosyada başlık güncellendi)
- [ ] Lisans katman fiyatlarını belirle — çerçeve: [`pricing.md`](pricing.md)
- [x] CLA metnini hazırla → [`CLA.md`](../CLA.md)
- [ ] Ticari lisans maddelerini avukata incelettir
- [ ] `package.json` `license` alanı: `AGPL-3.0-only` ✔
- [x] Sihirbaza lisans anahtarı adımı ekle (C1) → `docs/license-keys.md`
- [ ] Müşteri sözleşmesine `LICENSE-COMMERCIAL.md`'yi ek olarak bağla

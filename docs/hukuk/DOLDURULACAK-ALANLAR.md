# Doldurulacak Alanlar — Ticari ve Hukuk Belgeleri

Son güncelleme: 2026-11-18 · Sürüm 1.34.0

Bu liste, ticari ve hukuk belgelerindeki **iş kararı/olgu** niteliğindeki boş alanları tek yerde
toplar. Teknik olarak belirlenebilen her alan (yargı yetkisi, saklama süreleri, güvenlik önlemleri,
yedek sıklığı, TLS sürümü) zaten dolduruldu; buradakiler yalnız **senin bildiğin** bilgiler.

> Hepsini doldurmadan müşteriye/avukata gönderme. Dolduruldukça bu dosyadan sil.

## Kararlar (2026-11-18)

| Konu | Karar | Sonuç |
|---|---|---|
| Barındırma modeli | **İkisi de hazırlansın** | `LICENSE-COMMERCIAL.md` §10'a koşullu veri-işleme maddesi eklendi; DPA yalnız SaaS'ta geçerli (başlığında belirtildi) |
| Katman fiyatları | **Kurucu sayı verecek** | `pricing.md` aralıkları olduğu gibi duruyor; sayılar gelince §2 eşitlenir |

---

## 1. Kimlik ve iletişim (her belgede ortak)

| Alan | Nerede | Öneri / not |
|---|---|---|
| Lisans verenin **tam unvanı** | `LICENSE-COMMERCIAL.md` §başlık, `CLA.md` §başlık | örn. `ustauretim Yazılım A.Ş.` |
| **Adres** | `LICENSE-COMMERCIAL.md` satır 7, DPA taraflar | sözleşme ekine işlenir |
| **Vergi no / MERSİS** | `LICENSE-COMMERCIAL.md` satır 7 | fatura için zorunlu |
| **CLA e-posta adresi** | `CLA.md` §6 | örn. `cla@sirketadi.com` |
| KVKK başvuru e-postası + yazışma adresi | `KVKK-AYDINLATMA.md` §1, §7 | veri sorumlusu = **müşteri kurum**, sen değilsin |

## 2. Fiyat ve ticari koşullar

> **Karar:** sayıları kurucu verecek. Aşağıdakiler hazır olduğunda doldurulur.

| Alan | Nerede | Durum |
|---|---|---|
| Katman fiyatları (Starter/Professional/Enterprise/Public) | `docs/pricing.md` §3 | aralık öneri olarak yazılı; **tek sayıya indir** |
| Kurulum hizmeti kapsamı (kaç gün, ne dahil) | `docs/pricing.md` §7 | yazılacak |
| Ödeme koşulları (peşin / 30 gün / taksit) | `docs/pricing.md` §7 | belirlenecek |
| İndirim yetki matrisi onayı | `docs/pricing.md` §4 | zaten yazılı, onay yeter |
| `LICENSE-COMMERCIAL.md` §2 fiyat tablosu | satır 27–32 | `pricing.md` kararlarıyla eşitle |

## 3. SaaS / barındırma modeli (DPA'yı etkiler)

> **Karar:** ikisi de hazır. `LICENSE-COMMERCIAL.md` §10 koşullu maddeyi taşıyor; DPA başlığı
> "yalnız SaaS'ta geçerli" notunu aldı. SaaS'a geçilirse aşağıdakiler doldurulur.

Kritik karar: **müşteri kendi sunucusunda mı çalıştıracak, sen mi barındıracaksın?**

| Senaryo | DPA gerekir mi | Ne doldurulur |
|---|---|---|
| Müşteri kendi sunucusunda (on-prem) | Hayır — yazılım araçtır, sen veri işleyen değilsin | DPA yerine "on-prem lisans" notu |
| Sen SaaS olarak barındırıyorsun | **Evet** | DPA taraflar + Ek-2 alt işleyenler |

SaaS ise `KVKK-DPA-TASLAK.md` şunları ister:

| Alan | Konum | Örnek |
|---|---|---|
| Veri sorumlusu (müşteri) unvan/adres/temsilci | Taraflar tablosu | — |
| Veri işleyen (sen) unvan/adres/temsilci | Taraflar tablosu | — |
| Ana sözleşme tarihi + numarası | satır 19 | `2026-11-18` / `SAS-001` |
| Barındırma sağlayıcı + ülke | Ek-2 | `Hetzner / Almanya` |
| Yedekleme sağlayıcı + ülke | Ek-2 | `— (kendi sunucusu)` |
| E-posta sağlayıcı + ülke | Ek-2 | `Postmark / ABD (SCC)` |
| Yurt dışı aktarım mekanizması (varsa) | `KVKK-AYDINLATMA.md` §5 | SCC / taahhüt / yok |

## 4. Operasyonel tarihler ve testler

| Alan | Nerede | Not |
|---|---|---|
| Sızma testi tarihi / planı | DPA Ek-1 | `GUVENLIK-TARAMASI.md`'deki tarama bir sızma testi değildir |
| Personel eğitimi | DPA Ek-1 | KVKK/güvenlik farkındalık eğitimi kaydı |
| Geri yükleme testi tarihi | DPA Ek-1, `SAKLAMA-SILME-PROSEDURU.md` §8 | tatbikat yapılıp tarihi yazılmalı |
| Silme testi tarihi | `SAKLAMA-SILME-PROSEDURU.md` §8 | test kullanıcısıyla |

## 5. Hukukçu incelemesi (kapatılamayan)

| Belge | Durum |
|---|---|
| `LICENSE-COMMERCIAL.md` | taslak — **avukat** incelemesi şart |
| `CLA.md` | taslak — açık kaynak lisans avukatı önerilir |
| `KVKK-AYDINLATMA.md` + `KVKK-DPA-TASLAK.md` | taslak — KVKK uzmanı incelemesi şart |
| `AGPL-SAAS-UYUM.md` | taslak — AGPL §13 yorumu |

> Bu maddeleri **senin yerine kapatamam** — hukuki danışmanlık değildir. Belgeler "taslak"
> ibaresini, inceleme yapılana kadar korur.

---

## Doldurma sonrası

1. Bu dosyadaki doldurulan satırları sil.
2. `docs/hukuk/README.md` durum tablosundaki `⚠` işaretlerini `✔` yap.
3. `CHANGELOG.md`'ye "ticari metinler tamamlandı" notu düş.

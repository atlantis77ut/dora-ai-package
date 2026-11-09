# Veri İşleyen Sözleşmesi (DPA) — Taslak

> **Taslaktır, hukuki danışmanlık değildir.** KVKK m.9 ve GDPR Art. 28 ile uyumlu olacak şekilde
> hazırlanmış bir iskelettir; imzadan önce hukukçu incelemesi şarttır.

Sürüm 1.18.0 · 2026-11-09

---

## Taraflar

| | Veri Sorumlusu | Veri İşleyen |
|---|---|---|
| Unvan | `[MÜŞTERİ]` | `[SAĞLAYICI]` |
| Adres | `[ ]` | `[ ]` |
| Temsilci | `[ ]` | `[ ]` |
| İletişim | `[ ]` | `[ ]` |

Bu sözleşme, `[TARİH]` tarihli `[ANA SÖZLEŞME NO]` (SaaS/Kurulum Sözleşmesi) eki olup ana
sözleşmenin ayrılmaz parçasıdır.

---

## 1. Konu ve süre

Veri işleyen, ana sözleşme kapsamında sunduğu hizmet sırasında veri sorumlusu adına kişisel veri
işler. Süre, ana sözleşmenin süresiyle aynıdır; fesihten sonra madde 8 uygulanır.

## 2. İşlemenin niteliği ve amacı

| | |
|---|---|
| Amaç | DORA uyum uygulamasının barındırılması ve desteklenmesi |
| Konu | Kullanıcı hesapları, denetim kayıtları, kurulum kanıtları |
| Veri kategorileri | kimlik (ad soyad), iletişim (kullanıcı adı/e-posta), işlem güvenliği (giriş kayıtları), kimlik doğrulama sırları |
| İlgili kişiler | veri sorumlusunun çalışanları ve yetkilendirdiği kişiler |
| Süre | ana sözleşme süresi |

Teknik envanter: `docs/hukuk/VERI-ENVANTERI.md` (sözleşme eki).

## 3. Veri işleyenin yükümlülükleri

1. Kişisel verileri yalnızca veri sorumlusunun **yazılı talimatlarıyla** işler; kendi amaçları
   için kullanmaz (KVKK m.12/3, GDPR Art. 28/3-a).
2. **Gizlilik**: veriye erişen personel gizlilik taahhüdü imzalar; erişim en az yetki ilkesiyle
   sınırlanır.
3. **Güvenlik**: Ek-1'deki teknik ve idari tedbirleri uygular.
4. **Alt işleyenler**: ancak Ek-2'de listelenenler; yeni alt işleyen için **30 gün önce** yazılı
   bildirim ve itiraz hakkı.
5. **İhlal bildirimi**: öğrendiği anda, en geç **24 saat** içinde veri sorumlusuna yazılı bildirim;
   olayın niteliği, etkilenen veri, alınan tedbirler.
6. **Yardım**: ilgili kişi başvuruları, etki değerlendirmesi (DPIA) ve denetimlerde makul destek.
7. **Kayıt**: işleme faaliyetlerine ilişkin kayıt tutar, talep üzerine sunar.
8. **Sınır ötesi aktarım**: veri sorumlusunun yazılı onayı olmadan yapmaz.

## 4. Veri sorumlusunun yükümlülükleri

1. İşlemenin hukuki dayanağını sağlar, ilgili kişileri aydınlatır.
2. Talimatların hukuka uygunluğundan sorumludur.
3. Erişim yetkilerini yönetir (kullanıcı oluşturma/silme).

## 5. Teknik ve idari tedbirler (Ek-1)

| Tedbir | Uygulama |
|---|---|
| Şifreleme (aktarım) | TLS 1.2+ (ters vekil) |
| Şifreleme (depolama) | `[ ]` — disk şifreleme / KMS `[durum]` |
| Erişim kontrolü | rol bazlı (yönetici/kullanıcı), 2FA desteği |
| Parola saklama | scrypt + kullanıcı başına tuz |
| Denetim izi | `audit.log`, `0600`, silinemez politika |
| Yedekleme | `[frekans]`, `[saklama]`, geri yükleme testi `[tarih]` |
| Yedek şifreleme | `[ ]` |
| Sızma testi | `[tarih]` / `[planlanan]` |
| Personel eğitimi | `[ ]` |

## 6. Denetim

Veri sorumlusu, yılda **bir** kez, **30 gün** önceden bildirimle ve makul kapsamda denetim yapabilir
veya bağımsız denetçi görevlendirebilir. Denetim, veri işleyenin diğer müşterilerinin gizliliğini
ihlal etmez.

## 7. Sorumluluk

Taraflar, kendi kusurlarından doğan zararlardan sorumludur. Veri işleyenin sorumluluğu, ana
sözleşmedeki sorumluluk sınırına tabidir; ağır ihmal ve kasıt hâlinde bu sınır uygulanmaz.

## 8. Fesih sonrası

1. Veri işleyen, **30 gün** içinde tüm kişisel verileri makine okunur formatta (zip) iade eder.
2. İadenin ardından `[30]` gün içinde siler ve **silme belgesi** düzenler.
3. Yasal saklama yükümlülüğü varsa, yalnız o kapsamda saklar ve korur.

## 9. Uygulanacak hukuk

`[Türkiye Cumhuriyeti]` hukuku; `[İstanbul]` mahkemeleri yetkilidir.

---

## Ek-2: Alt işleyen listesi

| Alt işleyen | Hizmet | Veri | Konum |
|---|---|---|---|
| `[barındırma sağlayıcı]` | sunucu | tümü | `[ülke]` |
| `[yedekleme]` | yedek depolama | şifreli zip | `[ülke]` |
| `[e-posta]` | bildirim gönderimi | e-posta adresi | `[ülke]` |

---

## İmza

| Veri Sorumlusu | Veri İşleyen |
|---|---|
| Ad soyad / unvan: | Ad soyad / unvan: |
| Tarih: | Tarih: |
| İmza: | İmza: |

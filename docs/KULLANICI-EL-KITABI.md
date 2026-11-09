# Kullanıcı El Kitabı

DORA Ajan Paketi · Sürüm 1.26.0 · Bu kitap iki bölümden oluşur: **Kullanıcı** ve **Yönetici**.

---

## Bölüm 1 — Kullanıcı

### 1.1 İlk giriş

1. Tarayıcıda `https://<sunucu>/app/` adresini açın.
2. Kullanıcı adı ve parolanızı girin.
3. Yönetici size **davet e-postası** gönderdiyse bağlantıya tıklayıp parolanızı belirleyin
   (bağlantı 30 dakika geçerlidir, tek kullanımlıktır).
4. İlk girişten sonra **Güvenlik → Kurulumu başlat** ile iki adımlı doğrulamayı açın.

> Parolanızı unuttuysanız yöneticinizden **sıfırlama bağlantısı** isteyin. E-postanıza
> gelmişse bağlantıyı açıp yeni parolanızı belirleyin.

### 1.2 İki adımlı doğrulama (2FA)

| Adım | Ne yapılır |
|---|---|
| 1 | Güvenlik sayfasında **Kurulumu başlat** |
| 2 | Telefonunuzda Google/Microsoft Authenticator → **Kurulum anahtarını gir** |
| 3 | Ekrandaki anahtarı 4'lü gruplar halinde yazın |
| 4 | Uygulamanın verdiği 6 haneli kodu girin → **Etkinleştir** |
| 5 | **10 kurtarma kodunu** kaydedin (bir daha gösterilmez) |

Sonraki girişlerde paroladan sonra 6 haneli kod istenir. Kod gelmezse kurtarma kodlarından
birini kullanın — her kod **tek kullanım**.

### 1.3 Durum sayfası

Girişte gördüğünüz **Durum** sayfası üç şeyi gösterir:

- Kaç adım tamamlandı (6 adım)
- Kurum büyüklüğü ve denetleyici kurum
- Kaç sistem bağlı (olay, destek, uyum, envanter)

### 1.4 Kurum bilgileri

**Kurum bilgileri** sayfasında kurum adı, büyüklük (tier), denetleyici kurum, faaliyet ülkesi
ve faaliyet alanları girilir. Bu bilgiler raporlarda ve kanıt paketinde kullanılır.

### 1.5 Kurulum adımları

| Adım | Ne girilir |
|---|---|
| 1 | **Hizmetleriniz** — kritik hizmetler, sahipleri, kritiklik |
| 2 | **Kesinti toleransları** — her hizmet için MTD / RTO / RPO (saat) |
| 3 | **Varlıklarım** — sunucu/sistem listesi (CSV yükleme veya yapıştırma) + **Sorumlular** |
| 4 | **Senaryo testleri** — üç senaryo için doğruluk, SLA ihlali, hash zinciri |
| 5 | **Öz değerlendirme** — 28 DORA maddesi için kapsama ve bağımsız doğrulayan |
| 6 | **Canlıya geçiş** — ajan otonomi seviyeleri, gölge/yarı-otomatik gün sayısı |

Her adımda **"adımı denetle"** düğmesi vardır: eksik varsa kırmızı çarpı ile listeler.

### 1.6 Envanter yükleme (CSV)

1. **Varlıklarım** → **Şablon indir**
2. Excel'de doldurun: `id, ad, kritiklik, tedarikçi`
3. Dosyayı seçin → otomatik yüklenir

Kritiklik: `kritik`, `önemli`, `standart` (İngilizceleri de kabul edilir).

### 1.7 Olay kaydı ve raporlama süreleri

SIEM bağlıysa olaylar otomatik gelir; gelmiyorsa yönetici **SIEM olayları → Olayları çek** der.

1. **Olay kayıtları** tablosunda olay satırını görün.
2. Müşteri sayısı, kesinti dakikası, ekonomik etki alanlarını doldurun.
3. **kaydet** → **aktif yap** (dört göz açıksa ikinci yöneticinin onayına gider).
4. **Raporlama süreleri** kartında üç sayaç görünür:

| Adım | Süre | Renk |
|---|---|---|
| İlk bildirim | 4 saat | yeşil = gönderildi, turuncu = yaklaşıyor, kırmızı = gecikti |
| Ara rapor | 72 saat | aynı |
| Nihai rapor | 1 ay | aynı |

5. Raporu dışarıda gönderdikten sonra **"… gönderildi"** düğmesine basın; referans numarası
   girebilirsiniz.

### 1.8 Olay geçmişi

Olay satırında **geçmiş** düğmesi: kim, ne zaman, ne yaptı (oluşturma, güncelleme, raporlama,
onay).

### 1.9 Belgeler ve kanıt paketi

- **Belgeler** sayfası oturumda üretilen kayıtları listeler.
- **Kanıt paketi oluştur** → tüm kayıtlar tek zip'te, imzalı.
- **Yönetim raporu (PDF)** → kurum, fazlar, olaylar, süreler, onaylar, kapsama özeti.

### 1.10 Ara

**Ara** sayfası süreç, kontrol, ajan, terim ve DORA maddelerinde arama yapar. Türkçe karakter
duyarsızdır (`siniflandirma` = `sınıflandırma`).

### 1.11 Parola değiştirme

**Parolamı değiştir** → mevcut parola + yeni parola (en az 8 karakter). Değişince diğer
cihazlardaki oturumlar kapanır.

### 1.12 Sık sorunlar

| Belirti | Çözüm |
|---|---|
| Giriş yapamıyorum | Yöneticiden sıfırlama bağlantısı isteyin |
| 6 haneli kod geçersiz | Telefon saati doğru mu? Kurtarma kodunu deneyin |
| "bu hesap için yetki tanımlı değil" | Yönetici sizi kullanıcı olarak eklemeli |
| Dosya yüklenmiyor | Şablonu kullanın; `ad` sütunu boş olmamalı |
| Kanıt paketi indirilmiyor | Önce **Paketi oluştur**, sonra **İndir** |
| Sayfa boş görünüyor | Tarayıcıyı yenileyin; oturum süresi dolmuş olabilir |

---

## Bölüm 2 — Yönetici

### 2.1 Kullanıcı yönetimi

**Yönetim → Kullanıcılar**

| İşlem | Not |
|---|---|
| Kullanıcı ekle | kullanıcı adı + parola + rol; **davet e-postası gönder** seçilebilir |
| Rol değiştir | kullanıcı ↔ yönetici |
| Parola sıfırla | geçici parola belirleyin |
| Sıfırlama bağlantısı | 30 dk, tek kullanım; panoya kopyalanır |
| Davet gönder | e-posta ile sıfırlama bağlantısı |
| Sil | son yönetici silinemez |

### 2.2 E-posta (SMTP)

**Yönetim → E-posta (SMTP)**: sunucu, port, gönderen, kullanıcı, parola, SSL seçenekleri.
**Test gönder** ile doğrulayın. Gönderilemeyen iletiler **kuyruğa** düşer; **Kuyruğu gönder**
ile tekrar denenir.

### 2.3 Bildirimler

**Yönetim → Bildirimler**: etkin, alıcılar (virgülle). Açıkken:

- Raporlama süresi yaklaşan/geçen olaylar
- Bekleyen onay talepleri

için e-posta gider. **Şimdi tara** ile elle denersiniz. Aynı uyarı ikinci kez gönderilmez.

### 2.4 Dört göz onayı

**Yönetim → Onay akışı** → **Etkin**. Açıkken olay sınıflandırması ve canlıya geçiş ikinci
yöneticinin onayına gider; **talep eden kendi talebini onaylayamaz**.

> Tek yönetici varsa açmayın — talep onaylanamaz. Önce ikinci bir yönetici oluşturun.

### 2.5 Entegrasyonlar

**Entegrasyonlar**: SIEM / ITSM / GRC / CMDB için ürün, adres, kimlik doğrulama, anahtar.
**Bağlantıyı dene** erişimi sınar; **SIEM olayları** sayfasında olayları çekersiniz.

### 2.6 SIEM olay kuralları ve zamanlanmış çekme

- **Olay kuralları**: hangi anahtar kelimelerin kayıt açacağı, veri kaybı/yetkisiz erişim işaretleri.
- **Zamanlanmış çekme**: etkin + aralık (dakika) → sunucu kendisi çeker, taslak kayıt üretir.

### 2.7 SSO (kurumsal giriş)

**Yönetim → Kurumsal giriş (SSO / OIDC)**: issuer, client ID, redirect URI, secret.
Ayrıntı: `docs/SSO-KURULUM.md`. TLS olmadan çalışmaz.

### 2.8 Yedekleme

```bash
node tools/backup.mjs --out /var/backups/dora/$(date +%F).zip --keep 8
node tools/backup.mjs --verify /var/backups/dora/2026-11-09.zip
node tools/restore.mjs --zip /var/backups/dora/2026-11-09.zip --target /opt/dora-restore
```

Ayrıntı: `docs/YEDEKLEME.md`.

### 2.9 Denetim kaydı

**Yönetim → İşlem kaydı** son 150 işlemi gösterir; **CSV indir** ile tamamı alınır.

### 2.10 Teknik panel

Sol menüde **Teknik panel** → statik rapor panosu (süreçler, kontroller, ajanlar, sözlük,
DORA eşlemesi). **Canlı pano** ise anlık veriyi gösterir.

---

## Ek: Terimler

| Terim | Anlam |
|---|---|
| Tier | Kurum büyüklüğü sınıfı (tier1 büyük, tier3 küçük) |
| MTD | Azami tolere edilebilir kesinti süresi |
| RTO | Hedef toparlanma süresi |
| RPO | Hedef veri kaybı süresi |
| Kanıt paketi | İmzalı zip; manifest + hash zinciri |
| Dört göz | İki farklı yöneticinin onayı |
| Ara rapor | İlk bildirimden 72 saat sonraki rapor |

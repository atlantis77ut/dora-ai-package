# SSO Kurulumu (Entra ID / Keycloak)

Bu belge, paketin OIDC istemcisini gerçek bir kimlik sağlayıcıya bağlamak için adım adım
yol gösterir. Uygulama tarafındaki akış `src/orl/oidc.mjs` içinde: keşif belgesi,
authorization-code, JWKS ile RS256 doğrulama, `iss`/`aud`/`exp`/`nonce` ve imzalı `state`.

Sunucu adresi örneklerde `https://dora.ornek.local` varsayılmıştır; kendi adresinizle değiştirin.

---

## 0. Ortak gereksinimler

| Gereksinim | Değer |
|---|---|
| Redirect URI | `https://dora.ornek.local/api/auth/oidc/callback` |
| Kapsam | `openid email profile` |
| İstemci tipi | Gizli istemci (client secret) |
| HTTPS | Zorunlu (çerez `Secure` bayrağı bu koşulda eklenir) |

**Önemli:** `redirect_uri` sağlayıcıda **birebir** kayıtlı olmalı. Sondaki eğik çizgi, port veya
`http`/`https` farkı `redirect_uri_mismatch` hatası verir.

---

## 1. Microsoft Entra ID (Azure AD)

### 1.1 Uygulama kaydı

1. **Entra admin center → Applications → App registrations → New registration**
2. Ad: `DORA Ajan Paketi`
3. Supported account types: kurumunuza uygun olan (genelde *Accounts in this organizational directory only*)
4. **Redirect URI**: platform `Web`, değer `https://dora.ornek.local/api/auth/oidc/callback`
5. **Register**

### 1.2 İstemci bilgileri

| Alan | Nereden | Uygulamaya girilecek |
|---|---|---|
| Client ID | Genel bakış → Application (client) ID | **Client ID** |
| Tenant ID | Genel bakış → Directory (tenant) ID | Issuer içinde |
| Client secret | Certificates & secrets → New client secret | **Client secret** |

**Issuer** (v2.0 uç noktası):

```
https://login.microsoftonline.com/<TENANT_ID>/v2.0
```

### 1.3 Belirteç (token) yapılandırması

**Token configuration → Add optional claim → ID token**: `email`, `preferred_username`, `name`
ekleyin. Uygulama kullanıcıyı `email` (yoksa `sub`) ile eşler.

> Not: Kişisel Microsoft hesaplarında `email` boş gelebilir; kurumsal hesaplarda
> `preferred_username` genelde e-postadır. Eşleşme başarısız olursa `#giris=bu hesap için yetki
> tanımlı değil` yönlendirmesi görülür.

### 1.4 API izinleri

**API permissions → Add a permission → Microsoft Graph → Delegated**: `openid`, `email`,
`profile`, `User.Read` yeterlidir. Yönetici onayı (Grant admin consent) gerekebilir.

---

## 2. Keycloak

1. **Realm** oluşturun (ör. `dora`)
2. **Clients → Create client**
   - Client ID: `dora-app`
   - Client authentication: **On** (gizli istemci)
   - Valid redirect URIs: `https://dora.ornek.local/api/auth/oidc/callback`
   - Web origins: `https://dora.ornek.local`
3. **Credentials** sekmesinden client secret'ı kopyalayın
4. **Client scopes → dora-app-dedicated → Add mapper → By configuration → User Property**
   - Name: `email`, Property: `email`, Add to ID token: **On**

**Issuer**:

```
https://<keycloak-adresi>/realms/<realm>
```

### 2.1 Rol eşlemesi (isteğe bağlı)

Paket, SSO kullanıcısını **kullanıcı** rolüyle açar (veya `auto_provision` kapalıysa yalnız
önceden tanımlı kullanıcıyı kabul eder). Yönetici rolü SSO'dan gelmez; yönetici ataması
uygulama içinden (Yönetim → rol seçimi) yapılır. Bu bilinçli bir sınır: IdP'deki grup üyeliği
tek başına yönetici yetkisi vermez.

---

## 3. Uygulamada yapılandırma

**Yönetim → Kurumsal giriş (SSO / OIDC)**

| Alan | Değer |
|---|---|
| Issuer | `https://login.microsoftonline.com/<TENANT_ID>/v2.0` veya `https://kc/realms/dora` |
| Client ID | Uygulama kimliği |
| Redirect URI | `https://dora.ornek.local/api/auth/oidc/callback` |
| Client secret | Gizli değer (kaydettikten sonra görünmez) |
| Etkin | ✔ |
| Otomatik kullanıcı açma | Kurum politikasına göre |

Kaydettikten sonra giriş ekranında **"Kurumsal hesapla giriş (SSO)"** bağlantısı görünür.

---

## 4. Doğrulama

```bash
# 1) durum
curl -s https://dora.ornek.local/api/auth/oidc/status
# {"enabled":true,"issuer":"https://login.microsoftonline.com/…/v2.0"}

# 2) başlat (tarayıcıda açılmalı; state çerezi set edilir)
curl -si https://dora.ornek.local/api/auth/oidc/start | head -5
# HTTP/1.1 302 Found
# Location: https://login.microsoftonline.com/…
```

Tarayıcıda `/app/` → SSO ile giriş → sağlayıcıda oturum aç → geri dönüş `/app/#genel`.
Başarısızsa adres çubuğunda `#giris=<sebep>` görünür.

### Beklenen hata kodları

| `#giris=` değeri | Anlamı | Çözüm |
|---|---|---|
| `durum doğrulanamadı` | `state` çerezi kayboldu (10 dk aşıldı veya çerez engellendi) | Tekrar dene; tarayıcıda çerez engelini kaldır |
| `durum süresi dolmuş` | Giriş 10 dakikada tamamlanmadı | Yeniden başlat |
| `kimlik doğrulanamadı: imza` | JWKS anahtarı eşleşmiyor | Sağlayıcının `jwks_uri`'sini kontrol et |
| `kimlik doğrulanamadı: audience` | Client ID uyuşmuyor | Client ID'yi sağlayıcıdakiyle eşleştir |
| `kimlik doğrulanamadı: nonce` | Sağlayıcı `nonce`'u geri yansıtmıyor | Sağlayıcı OIDC uyumluluğunu kontrol et |
| `bu hesap için yetki tanımlı değil` | Kullanıcı e-postası uygulamada yok | Kullanıcıyı Yönetim'den ekle veya otomatik açmayı aç |
| `SSO kapalı` | Etkin değil | Yönetim'den etkinleştir |

---

## 5. Güvenlik notları

- **Client secret** `web-data/secrets.json` içinde `0600` izniyle tutulur; arayüze geri dönmez.
- **TLS zorunlu**: HTTPS olmadan `Secure` çerez gönderilmez; ters vekil arkasında çalıştırın.
- `auto_provision` **kapalıyken** tanınmayan kullanıcı reddedilir — önerilen varsayılan.
- SSO ile gelen kullanıcı **asla yönetici** olmaz; rol ataması uygulama içinden yapılır.
- Oturum süresi diğer girişlerle aynı (`Yönetim → Oturum süresi`).
- IdP'de MFA/koşullu erişim açıksa ikinci faktör orada uygulanır; uygulamanın TOTP'si ayrıca
  istenmez (kullanıcı adı/parola ile giriş yapanlar için geçerlidir).

---

## 6. Bilinen sınırlar

- **Tek IdP** yapılandırılabilir; çok kiracılı kullanım için istemci tarafında seçim ekranı yok.
- **Grup → rol eşlemesi yok** (bilinçli).
- **SCIM / kullanıcı sağlama yok**; kullanıcılar uygulamada veya otomatik açmayla oluşur.
- **Oturum kapatma (single logout) yok**; IdP'de oturum kapatma uygulama oturumunu sonlandırmaz.

# Kişisel Veri Envanteri (Teknik)

Son güncelleme: 2026-11-09 · Sürüm 1.18.0

Bu belge, uygulamanın **gerçekte** hangi veriyi nerede tuttuğunu kodla birebir eşleşecek şekilde
listeler. KVKK aydınlatma metni ve DPA'nın teknik eki olarak kullanılır.

---

## 1. Depolama konumları

| Konum | İçerik | İzin | Yedekte |
|---|---|---|---|
| `web-data/users.json` | kullanıcı hesapları | `0600` | ✔ |
| `web-data/secret.key` | oturum imzalama anahtarı | `0600` | ✔ |
| `web-data/secrets.json` | SIEM token, OIDC client secret, state anahtarı | `0600` | ✔ |
| `web-data/settings.json` | kurum profili, entegrasyon uçları, oturum süresi | `0600` | ✔ |
| `web-data/audit.log` | işlem kaydı (kim, ne zaman, ne) | `0600` | ✔ |
| `web-data/siem-rules.json` | olay kuralları | `0600` | ✔ |
| `web-data/schedule.json` | zamanlanmış çekme ayarı + son çalışma | `0600` | ✔ |
| `web-data/resets.json` | parola sıfırlama token **özetleri** | `0600` | ✔ |
| `.dora-onboarding/<oturum>/` | kurulum kanıtları (JSON) | dizin izni | ✔ |
| `.dora-onboarding/<oturum>/evidence-bundle.zip` | imzalı kanıt paketi | dizin izni | ✔ |
| `web-data/evidence-key.pem` | kanıt imza anahtarı | `0600` | ✔ |

---

## 2. Kişisel veri kategorileri

### 2.1 Kullanıcı hesabı (`users.json`)

| Alan | Örnek | KVKK niteliği | Amaç |
|---|---|---|---|
| `id` | `usr-a1b2c3d4` | kimliksiz tanımlayıcı | teknik |
| `username` | `utemir` veya `ayse@ornek.local` | **kimlik** | giriş |
| `name` | `Ayşe Yılmaz` | **kimlik** | görünen ad |
| `role` | `admin` / `user` | yetki | erişim kontrolü |
| `salt` + `hash` | scrypt özeti | **kimlik doğrulama verisi** | parola doğrulama (geri döndürülemez) |
| `totp_secret` | base32 | **kimlik doğrulama verisi** | 2FA |
| `recovery_hashes` | sha256 | **kimlik doğrulama verisi** | kurtarma kodları |
| `created_at`, `last_login` | ISO tarih | işlem güvenliği | denetim |

> Parola **hiçbir zaman** düz metin saklanmaz (scrypt, kullanıcı başına tuz).
> TOTP sırrı geri döndürülemez değildir — kullanıcıya ait bir sırdır; KMS önerilir.

### 2.2 İşlem kaydı (`audit.log`)

| Alan | İçerik | Niteliği |
|---|---|---|
| zaman | ISO 8601 | işlem güvenliği |
| kullanıcı | kullanıcı adı | kimlik |
| işlem | `login`, `totp_enabled`, `institution_update`… | işlem |
| hedef | oturum no, kullanıcı adı, kullanım | işlem |

Saklama: **varsayılan sınırsız** (bkz. `SAKLAMA-SILME-PROSEDURU.md`).

### 2.3 Kurum verisi (`settings.json`, `.dora-onboarding/`)

| Veri | Kişisel veri mi |
|---|---|
| Kurum adı, tier, regülatör | Hayır (tüzel kişi) |
| Hizmet adı + **sahibi** (ad soyad) | **Evet** — çalışan kimliği |
| Envanter (varlık, tedarikçi) | Hayır |
| Ajan aktivasyonu + **insan muadili** (ad soyad) | **Evet** |
| Olay kayıtları (müşteri sayısı, etki) | Dolaylı (kişiye indirgenemez) |
| Senaryo sonuçları, kapsama matrisi | Hayır |
| Kanıt paketi (yukarıdakilerin tamamı) | **Evet** (sahip/muadil alanları) |

### 2.4 Teknik veriler

| Veri | Yer | Niteliği |
|---|---|---|
| Oturum çerezi (`dora_session`) | tarayıcı | `HttpOnly`, 8 saat (ayarlanabilir) |
| Parola sıfırlama token'ı | yalnız tarayıcıya gider; diskte sha256 | 30 dk, tek kullanım |
| SIEM olayları (`siem-events.json`) | oturum dizini | kaynak sisteme göre **kişisel veri olabilir** (IP, kullanıcı adı) |
| Entegrasyon uç adresleri | `settings.json` | kurum altyapı bilgisi (ticari sır olabilir) |
| Lisans token'ı | `session.json` | ticari bilgi |

---

## 3. Veri akışı

```
Kullanıcı tarayıcısı ──HTTPS──► uygulama sunucusu ──► web-data/ (dosya)
                                        │
                                        ├──► .dora-onboarding/ (kanıtlar)
                                        ├──► SIEM / IdP (dış sistem, yapılandırılırsa)
                                        └──► kanıt paketi (zip, imzalı)
```

- **Dış aktarım**: yalnız yönetici yapılandırırsa (SIEM çekme, OIDC giriş). Başka telemetri yok.
- **Bulut bağımlılığı yok**: font/CDN/analitik çağrısı yok.
- **Yedek**: `tools/backup.mjs` → zip; nereye konulacağı kuruma bağlı.

---

## 4. Kişisel veri işleme rolleri

| Senaryo | Veri sorumlusu | Veri işleyen |
|---|---|---|
| Kurum yazılımı kendi sunucusunda çalıştırır | **Kurum** | — (yazılım aracıdır) |
| Biz SaaS olarak barındırırız | **Kurum** | **Biz** (DPA şart) |
| Kurulum/destek hizmeti veririz | Kurum | Biz (erişim varsa) |

---

## 5. Teknik güvenlik önlemleri (özet)

- Parola: scrypt (N=16384), kullanıcı başına 16 bayt tuz
- Oturum: HMAC-SHA256 imzalı çerez, `HttpOnly`, `SameSite=Lax`, HTTPS'te `Secure`
- Parola değişiminde tüm oturumlar düşer (`pv` alanı)
- CSRF: yazma isteklerinde `X-Dora-CSRF` başlığı zorunlu
- Giriş denemesi sınırı: 5 hata → 60 sn kilit
- Dosya izinleri: `0600` (kullanıcı, sır, denetim)
- Kanıt paketi: sha256 + hash zinciri + Ed25519 imza
- Yol dışına çıkma ve SSRF engelleri (`docs/GUVENLIK-TARAMASI.md`)

---

## 6. Envanteri güncel tutma

Yeni bir alan eklendiğinde:

1. Bu dosyaya satır ekle (alan, örnek, nitelik, amaç)
2. `docs/KVKK-AYDINLATMA.md` ilgili bölümü güncelle
3. Saklama süresi gerekiyorsa `SAKLAMA-SILME-PROSEDURU.md`'ye işle
4. Denetim: `grep -n "writeJson\|appendFileSync" onboarding/cli/tools/server.mjs` ile yeni yazma
   noktalarını kontrol et

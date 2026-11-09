# Kişisel Verilerin Korunması — Aydınlatma Metni (Taslak)

> **Taslaktır.** Yayına almadan önce hukukçu onayı alın; `[ ]` içindeki alanları doldurun.
> Bu metin, uygulamanın **kendi kullanıcılarına** (çalışanlarınıza) yöneliktir.
> Kurumunuzun müşterilerine yönelik aydınlatma ayrı bir metredir.

Son güncelleme: 2026-11-09 · Sürüm 1.18.0

---

## 1. Veri sorumlusu

| | |
|---|---|
| Veri sorumlusu | `[ŞİRKET/KURUM ADI]` |
| Adres | `[ADRES]` |
| KVKK temsilcisi / iletişim | `[E-POSTA]` · `[TELEFON]` |
| Veri işleyen (varsa) | `[SAAS SAĞLAYICI ADI]` — DPA: `docs/KVKK-DPA-TASLAK.md` |

---

## 2. İşlenen kişisel veriler

| Kategori | Veriler | Kaynak |
|---|---|---|
| Kimlik | ad soyad | kullanıcı girişi |
| İletişim | kullanıcı adı / e-posta | kullanıcı girişi |
| İşlem güvenliği | giriş/çıkış zamanı, IP `[tutuluyorsa]`, işlem kayıtları | sistem |
| Kimlik doğrulama | parola özeti (geri döndürülemez), TOTP sırrı, kurtarma kodu özetleri | kullanıcı + sistem |
| Görev bilgisi | hizmet sahibi, ajan insan muadili | kurulum sırasında girilen |

Ayrıntılı teknik envanter: `docs/hukuk/VERI-ENVANTERI.md`.

---

## 3. İşleme amaçları

1. Kullanıcı hesabının oluşturulması ve kimlik doğrulama
2. Yetkilendirme (yönetici / kullanıcı ayrımı)
3. Bilgi güvenliği ve denetim izi (DORA Madde 10, 12)
4. Kurulumun yürütülmesi (hizmet sahipliği, sorumluluk atamaları)
5. Yasal yükümlülüklerin yerine getirilmesi (DORA olay bildirimi, denetim)

---

## 4. Hukuki sebep

| Amaç | KVKK m.5 dayanağı |
|---|---|
| Hesap yönetimi, kimlik doğrulama | **sözleşmenin kurulması/ifası** (m.5/2-c) |
| Bilgi güvenliği, denetim izi | **meşru menfaat** (m.5/2-f) — `[denge testi yapıldı]` |
| Yasal yükümlülük (DORA) | **hukuki yükümlülük** (m.5/2-ç) |
| 2FA | sözleşme + meşru menfaat (hesap güvenliği) |

> Özel nitelikli kişisel veri (sağlık, din, biyometri vb.) **işlenmez**. TOTP sırrı biyometrik
> değildir; parola benzeri bir sırdır.

---

## 5. Aktarım

| Alıcı | Veri | Amaç | Dayanak |
|---|---|---|---|
| `[SaaS sağlayıcı]` | tümü | barındırma | DPA + m.8/2-a |
| `[Yedekleme sağlayıcı]` | şifreli zip | yedekleme | DPA |
| `[SIEM / IdP]` | olay / kimlik | güvenlik, giriş | kurum yapılandırması |
| Yetkili kamu kurumları | talep edilen | yasal | m.8/2-a |

Yurt dışına aktarım **yoktur** / `[varsa: ülke + mekanizma (SCC, açık rıza, taahhüt)]`.

---

## 6. Saklama süresi

| Veri | Süre | Dayanak |
|---|---|---|
| Kullanıcı hesabı | görev süresi + `[X]` ay | `[politika]` |
| İşlem kaydı (`audit.log`) | `[2 yıl]` önerilir | DORA denetim izi |
| Kimlik doğrulama sırları | hesap silinene kadar | — |
| Kanıt paketleri | `[5 yıl]` önerilir | denetim |
| Parola sıfırlama token'ı | 30 dakika | teknik |

Süre sonunda silme adımları: `docs/SAKLAMA-SILME-PROSEDURU.md`.

---

## 7. Haklarınız (KVKK m.11)

- Kişisel verilerinizin işlenip işlenmediğini öğrenme
- İşlenmişse buna ilişkin bilgi talep etme
- Amacına uygun kullanılıp kullanılmadığını öğrenme
- Eksik/yanlış işlenmişse düzeltilmesini isteme
- Silinmesini veya yok edilmesini isteme
- Aktarıldığı üçüncü kişileri öğrenme
- Otomatik sistemlerle analiz sonucu aleyhinize çıkan sonuca itiraz etme
- Zararın giderilmesini talep etme

**Başvuru kanalı:** `[E-POSTA]` / `[YAZIŞMA ADRESİ]` · Yanıt süresi: **30 gün** (KVKK m.13).

---

## 8. Çerezler

| Çerez | Amaç | Süre | Niteliği |
|---|---|---|---|
| `dora_session` | oturum | 8 saat (ayarlanabilir) | **zorunlu**, `HttpOnly` |
| `dora_oidc` | SSO durum doğrulama | 10 dakika | **zorunlu**, `HttpOnly` |

Analitik/pazarlama çerezi **kullanılmaz**; bu nedenle çerez onay bandı gerekmez.

---

## 9. Güvenlik

- Parolalar geri döndürülemez biçimde saklanır (scrypt + tuz)
- Oturum çerezleri `HttpOnly`, `SameSite=Lax`, HTTPS'te `Secure`
- İki adımlı doğrulama (TOTP) desteklenir
- Erişim kayıtları tutulur; yönetici işlemleri denetim kaydına yazılır
- Teknik ayrıntı ve test sonuçları: `docs/GUVENLIK-TARAMASI.md`

---

## 10. Sürüm geçmişi

| Sürüm | Tarih | Değişiklik |
|---|---|---|
| 1.0 | `[tarih]` | İlk yayın |

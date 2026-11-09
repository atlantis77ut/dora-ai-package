# E-posta (SMTP)

Son güncelleme: 2026-11-09 · Sürüm 1.20.0 · Test: yerel sahte SMTP ile uçtan uca

---

## 1. Ne için kullanılıyor

| Akış | Nasıl | Alıcı |
|---|---|---|
| **Hesap daveti** | Yönetim → kullanıcı ekle → *davet e-postası gönder* | yeni kullanıcı |
| **Davet/sıfırlama bağlantısı** | kullanıcı satırı → **davet gönder** | kullanıcı |
| **Test iletisi** | Yönetim → **Test gönder** | girdiğin adres |
| Bildirim (gelecek) | — | — |

Bağlantı **30 dakika** geçerli, **tek kullanımlık**; parola belirlenince tüm eski oturumlar düşer.

---

## 2. Ayarlar

**Yönetim → E-posta (SMTP)**

| Alan | Örnek | Not |
|---|---|---|
| Sunucu | `smtp.ornek.local` | |
| Port | `587` | 465 → SSL, 25 → düz |
| Gönderen | `dora@ornek.local` | SPF/DKIM ile uyumlu olmalı |
| Kullanıcı | `dora@ornek.local` | boş bırakılabilir (relay) |
| Parola | `••••` | `secrets.json` içinde, geri gösterilmez |
| SSL (465) | ☐ | örtük TLS |
| self-signed kabul | ☐ | **yalnız test ortamı** |
| Etkin | ☑ | kapalıyken iletiler kuyruğa alınır |

Kaydettikten sonra **Test gönder** ile doğrula.

---

## 3. Desteklenen protokol

```
EHLO → (STARTTLS) → AUTH PLAIN|LOGIN → MAIL FROM → RCPT TO → DATA → QUIT
```

- Düz SMTP, **STARTTLS** (587) ve **örtük TLS** (465)
- Kimlik doğrulama: `AUTH PLAIN`, `AUTH LOGIN`
- Gövde: UTF-8, `Content-Transfer-Encoding: base64`; konu `=?UTF-8?B?…?=`
- Satır başındaki nokta kaçışı (SMTP transparency) uygulanır
- 15 saniye zaman aşımı

---

## 4. Giden kutusu (outbox)

SMTP kapalı ya da gönderim başarısızsa ileti **kaybolmaz**: `web-data/outbox.json` içine kuyruğa alınır.

```bash
# kuyruğu gör (yönetici)
curl -s -b cookie.txt http://127.0.0.1:8080/api/outbox

# göndermeyi dene
curl -s -X POST -b cookie.txt -H 'X-Dora-CSRF: 1' http://127.0.0.1:8080/api/outbox/flush
```

Kuyruk en fazla **200** ileti tutar; her denemede `attempts` artar, `last_error` yazılır.

**Not:** davet bağlantısı e-postaya yazılamasa bile **ekranda gösterilir** ve panoya kopyalanır —
e-posta olmadan da kullanıcıya iletebilirsiniz.

---

## 5. Sağlayıcı örnekleri

### Microsoft 365
```
Sunucu: smtp.office365.com   Port: 587   SSL: ☐ (STARTTLS)
Kullanıcı: dora@firma.com    Parola: uygulama parolası
```
> Kurumda SMTP AUTH kapalıysa yöneticiden açmasını isteyin; MFA varsa **uygulama parolası** gerekir.

### Gmail / Google Workspace
```
Sunucu: smtp.gmail.com   Port: 587   SSL: ☐ (STARTTLS)
Kullanıcı: hesap@gmail.com   Parola: 16 haneli uygulama parolası
```
> Normal parola çalışmaz; 2FA açıksa **uygulama parolası** üretin.

### Kurum içi relay (Postfix)
```
Sunucu: mail.ornek.local   Port: 25   SSL: ☐
Kullanıcı/Parola: boş bırakılabilir (IP tabanlı relay)
```

### Yerel test (MailHog / Mailpit)
```
Sunucu: 127.0.0.1   Port: 1025   SSL: ☐
```
Testte kullandığımız yaklaşım: sahte SMTP sunucusu (`tests/unit/mailer.test.mjs`).

---

## 6. Sorun giderme

| Belirti | Neden | Çözüm |
|---|---|---|
| `SMTP yapılandırılmamış — kuyruğa alındı` | Etkin değil veya sunucu/gönderen boş | Ayarları doldur, Etkin işaretle |
| `kimlik doğrulama başarısız` | yanlış parola / uygulama parolası gerekli | Parolayı yenile (MFA varsa uygulama parolası) |
| `SMTP zaman aşımı` | port kapalı / güvenlik duvarı | 587/465 çıkışına izin ver |
| `sertifika` hatası | self-signed sertifika | Yalnız testte **self-signed kabul** işaretle |
| `STARTTLS reddedildi` | sunucu düz metin bekliyor | SSL işaretini kaldır veya portu değiştir |
| İleti gitti ama spam'de | SPF/DKIM yok | Gönderen alan adına SPF + DKIM ekle |
| Türkçe karakter bozuk | eski istemci | Paket UTF-8 + base64 kullanıyor; istemci tarafında sorun varsa bildir |

---

## 7. Güvenlik

- SMTP parolası `web-data/secrets.json` içinde `0600`; API yanıtında **dönmez**
- Davet bağlantısı 30 dk, tek kullanım, diskte yalnız `sha256` özeti
- Bağlantı token'ı e-postayla gider; e-posta kutusu ele geçerse bağlantı da ele geçer → kısa süre bunun için
- `self-signed kabul` **üretimde kapalı** olmalı
- Giden kutusu `outbox.json` içinde ileti gövdesi (bağlantı dahil) düz metin tutulur → `0600`, yedeklerde dikkat

---

## 8. Sınırlar

- **Gelen e-posta yok** (IMAP/POP3 yok); yanıtlar okunmaz
- **Ek dosya yok**; gövde yalnız düz metin
- **Şablon düzenleyici yok**; metinler kodda sabit (Türkçe)
- **Toplu gönderim yok**; her ileti tek tek
- **SPF/DKIM/DMARC** paketin işi değil, mail altyapısının işi
- Otomatik yeniden deneme yok; `Kuyruğu gönder` elle çalıştırılır (istenirse zamanlanabilir)

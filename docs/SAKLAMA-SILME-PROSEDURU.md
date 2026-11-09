# Saklama ve Silme Prosedürü

Son güncelleme: 2026-11-09 · Sürüm 1.18.0

KVKK m.7 (silme/yok etme) ve m.12 (veri güvenliği) için uygulama düzeyinde prosedür.
Teknik envanter: `docs/hukuk/VERI-ENVANTERI.md`.

---

## 1. Saklama süreleri (öneri)

| Veri | Öneri | Gerekçe | Kim siler |
|---|---|---|---|
| Kullanıcı hesabı | görev + 3 ay | erişim temizliği | yönetici |
| `audit.log` | 2 yıl | DORA denetim izi | yönetici |
| Kanıt paketleri (`.dora-onboarding`) | 5 yıl | denetim | yönetici |
| Kanıt imza anahtarı | kurulum ömrü | doğrulama | yönetici |
| Parola sıfırlama token'ı | 30 dk (otomatik) | tek kullanım | sistem |
| SIEM olayları (`siem-events.json`) | 90 gün | operasyonel | yönetici |
| Yedekler | 12 hafta + 12 ay | felaket kurtarma | yönetici |

> Süreler kurum politikasına göre değişir; tabloyu kurumunuza uyarlayın.

---

## 2. Kullanıcı silme (rutin)

**Arayüz:** Yönetim → kullanıcı satırı → **sil** (son yönetici silinemez).

Silme sonrası:

| Yer | Etki |
|---|---|
| `web-data/users.json` | kayıt kaldırılır |
| Oturum çerezi | parola sürümü (`pv`) değişmediği için **teknik olarak** süre sonuna kadar geçerli olabilir → kullanıcıyı önce çıkışa zorlayın veya oturum süresini kısaltın |
| `audit.log` | geçmiş kayıtlar **silinmez** (denetim izi) |
| Kanıtlar | kullanıcı adı geçiyorsa (sahip/muadil) **kalır** → ayrıca anonimleştirme gerekebilir |

## 3. Kullanıcı silme (KVKK başvurusu / ayrılış)

1. Kullanıcıyı devre dışı bırak: Yönetim → sil (veya rolü `user` yapıp erişimi kaldır)
2. Oturumları sonlandır: sunucuyu yeniden başlatmak **yetmez** (token'lar imzalı); kullanıcıyı
   silmek `pv` kontrolü nedeniyle erişimi keser — ancak kanıt paketlerindeki adı kalır
3. **Anonimleştirme**: kanıt JSON'larında ad geçen alanları değiştir:
   ```bash
   # örnek: business-service-catalogue.json içindeki "owner"
   jq '(.services[]?.owner) |= "—"' .dora-onboarding/*/business-service-catalogue.json
   ```
   > `jq` yoksa Node ile: `node -e "..."` — değişiklikten sonra **kanıt paketini yeniden üretin**,
   > aksi hâlde eski imza eski içeriği doğrular.
4. Denetim kaydındaki kullanıcı adı: yasal saklama varsa **korunur**; yoksa satır bazında
   `sed` ile anonimleştirilebilir — ancak bu, kaydın bütünlüğünü bozar; **tercih edilmez**.
5. Silme belgesi düzenle: tarih, kapsam, yöntem, imza.

## 4. Tam silme (kurulum kaldırma)

```bash
# 1) servisi durdur
sudo systemctl stop dora-ai-package

# 2) veriyi sil (geri dönüşü yok)
sudo rm -rf /opt/dora-ai-package/web-data
sudo rm -rf /opt/dora-ai-package/.dora-onboarding

# 3) yedekleri de sil
sudo rm -rf /var/backups/dora

# 4) servisi ve dosyaları kaldır
sudo systemctl disable dora-ai-package
sudo rm /etc/systemd/system/dora-ai-package.service
sudo systemctl daemon-reload
sudo rm -rf /opt/dora-ai-package
```

**Öncesinde:** son kanıt paketini indirdiyseniz (imzalı zip) silme sonrası doğrulama yine çalışır
(genel anahtar paketin içinde).

## 5. Yedekten geri yükleme (test edilmiş adım)

En kısa yol (araç): `node tools/restore.mjs --zip <yedek> --target <dizin>` — ayrıntı:
`docs/YEDEKLEME.md`. Aşağıdaki elle adımlar, aracın yaptığını açıklar.

```bash
# 1) yedeği aç
unzip -l /var/backups/dora/2026-11-09.zip     # manifest + dosyalar

# 2) yeni kurulum dizinine çıkar
sudo mkdir -p /opt/dora-restore && cd /opt/dora-restore
sudo unzip /var/backups/dora/2026-11-09.zip

# 3) izinleri düzelt
sudo chown -R dora:dora /opt/dora-restore
sudo chmod 600 /opt/dora-restore/web-data/*.json /opt/dora-restore/web-data/*.log /opt/dora-restore/web-data/*.pem

# 4) servisi yeni dizine çevir (geçici) ve doğrula
sudo systemctl stop dora-ai-package
sudo sed -i 's#/opt/dora-ai-package#/opt/dora-restore#g' /etc/systemd/system/dora-ai-package.service
sudo systemctl daemon-reload && sudo systemctl start dora-ai-package
curl -s http://127.0.0.1:8080/api/health
```

> **Not:** yedek, `secret.key` ve `users.json` içerdiği için geri yükleme sonrası **eski oturumlar
> çalışmaya devam eder**. Yedeği paylaşılan bir yerde tutmayın.

## 6. Denetim izi (audit.log) döndürme

```bash
# 2 yıldan eski satırları arşivle
awk -F'\t' -v cut="$(date -d '2 years ago' +%Y-%m-%d)" '$1 >= cut' web-data/audit.log > /tmp/audit.new
mv /tmp/audit.new web-data/audit.log
```

> Arşivi ayrı, erişimi kısıtlı bir yerde tutun. Döndürme işlemi **kayıt bütünlüğünü** bozar;
> gerekiyorsa arşivin sha256'sını alıp saklayın.

## 7. İlgili kişi başvurusu (DSAR) akışı

| Adım | Süre | Sorumlu |
|---|---|---|
| Başvuru alındı | gün 0 | `[KVKK temsilcisi]` |
| Kimlik doğrulama | gün 0-3 | `[ ]` |
| Kapsam belirleme (hangi veri) | gün 1-5 | yönetici |
| Veri çıkarma (`users.json`, `audit.log`, kanıtlar) | gün 5-10 | yönetici |
| Yanıt | **en geç gün 30** (KVKK m.13) | `[ ]` |
| Ret gerekçesi varsa yazılı bildirim | gün 30 | `[ ]` |

Veri çıkarma komutu (örn.):

```bash
node -e '
const fs=require("fs");
const users=JSON.parse(fs.readFileSync("web-data/users.json","utf8"));
const target=process.argv[1];
const u=users.find(x=>x.username===target);
const mine=fs.readFileSync("web-data/audit.log","utf8").split("\n").filter(l=>l.includes("\t"+target+"\t"));
console.log(JSON.stringify({user:u?{...u,hash:undefined,salt:undefined,totp_secret:undefined,recovery_hashes:undefined}:null,audit:mine},null,2));
' kullanici.adi
```

## 8. Kontrol listesi (yıllık)

- [ ] Saklama süreleri gözden geçirildi
- [ ] Silme testi yapıldı (bir test kullanıcısıyla)
- [ ] Yedekten geri yükleme testi yapıldı ve tarihi kaydedildi
- [ ] `audit.log` boyutu kontrol edildi (< 100 MB önerilir)
- [ ] Kanıt paketleri arşivlendi, imzaları doğrulandı

# Yedekleme ve Geri Yükleme

Son güncelleme: 2026-11-09 · Sürüm 1.19.0 · **Test edildi:** evet (gerçek veriyle uçtan uca)

---

## 1. Ne yedekleniyor

| Dizin | İçerik |
|---|---|
| `web-data/` | kullanıcılar (parola özetleri, TOTP sırları), `secret.key` (oturum imzası), `secrets.json` (SIEM token, OIDC secret), `settings.json` (kurum profili, entegrasyonlar), `audit.log`, `siem-rules.json`, `schedule.json`, `resets.json` |
| `.dora-onboarding/` | oturum artefaktları + imzalı kanıt paketleri |

Yedek bir **zip** dosyasıdır; içinde `manifest.json` (her dosyanın sha256'sı + boyutu) bulunur.
Zip'e girmeyen: `web-data/evidence-key.pem` **girer** (kanıt imza anahtarı), `yedek/` dizini girmez.

> **Uyarı:** yedek, parola özetlerini ve TOTP sırlarını düz metin taşır (özetler geri döndürülemez,
> TOTP sırrı ise kullanılabilir). Yedeği şifreli diskte / kilitli kasada tutun.

---

## 2. Yedek alma

```bash
cd /opt/dora-ai-package/onboarding/cli

# tek seferlik
node tools/backup.mjs

# belirli konum + saklama (en yeni 8 yedeği tut)
node tools/backup.mjs --out /var/backups/dora/$(date +%F).zip --keep 8
```

Çıktı:

```
yedek hazır: /var/backups/dora/2026-11-09.zip
  dosya: 7 · boyut: 5.2 KB
  sha256: bcb1dd00bef3…
  geri yükleme: node tools/restore.mjs --zip <dosya> --target <dizin>
```

---

## 3. Doğrulama (yedek bozuk mu?)

```bash
node tools/backup.mjs --verify /var/backups/dora/2026-11-09.zip
# yedek doğrulama: ...
#   dosya: 7 · sonuç: GEÇERLİ
```

Kontroller:

- `manifest.json` var mı, format doğru mu
- manifestteki her dosya zip'te var mı
- her dosyanın sha256'sı tutuyor mu
- manifestte olmayan fazladan dosya var mı

Çıkış kodu: geçerli **0**, geçersiz **1** (otomasyona uygun).

---

## 4. Geri yükleme

```bash
node tools/restore.mjs --zip /var/backups/dora/2026-11-09.zip --target /opt/dora-restore
```

Güvenlik kuralları:

| Kural | Davranış |
|---|---|
| Yalnız manifestteki dosyalar | listede olmayan içerik yazılmaz |
| sha256 doğrulaması | bozuk dosya varsa **hiçbir şey yazılmaz** |
| Zip-slip | `..`, mutlak yol, sürücü harfi reddedilir |
| Dolu hedef | `--force` olmadan reddedilir |
| İzinler | `web-data/*.{json,log,pem,key}` → `0600` |
| Dizin eşlemesi | `oturumlar/` → `.dora-onboarding/` |

Sonra:

```bash
sudo chown -R dora:dora /opt/dora-restore
sudo sed -i 's#/opt/dora-ai-package#/opt/dora-restore#g' /etc/systemd/system/dora-ai-package.service
sudo systemctl daemon-reload && sudo systemctl restart dora-ai-package
curl -s http://127.0.0.1:8080/api/health
```

> Geri yükleme sonrası **eski oturumlar çalışmaya devam eder** (`secret.key` yedekte). Bu bilinçli:
> kesintisiz devralma. İstenmiyorsa `web-data/secret.key` silinip sunucu yeniden başlatılır —
> herkes yeniden giriş yapar.

---

## 5. Otomatik yedek

### systemd timer (önerilen)

`/etc/systemd/system/dora-backup.service`:

```ini
[Unit]
Description=DORA yedek
[Service]
Type=oneshot
User=dora
WorkingDirectory=/opt/dora-ai-package/onboarding/cli
ExecStart=/usr/bin/node tools/backup.mjs --out /var/backups/dora/%Y-%m-%d.zip --keep 8
```

`/etc/systemd/system/dora-backup.timer`:

```ini
[Unit]
Description=Günlük DORA yedeği
[Timer]
OnCalendar=*-*-* 02:30:00
Persistent=true
[Install]
WantedBy=timers.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now dora-backup.timer
systemctl list-timers dora-backup.timer
```

### cron (alternatif)

```cron
30 2 * * * cd /opt/dora-ai-package/onboarding/cli && /usr/bin/node tools/backup.mjs --out /var/backups/dora/$(date +\%F).zip --keep 8
```

---

## 6. Geri yükleme tatbikatı (üç ayda bir)

1. Yedeği al: `node tools/backup.mjs --out /tmp/tatbikat.zip`
2. Doğrula: `node tools/backup.mjs --verify /tmp/tatbikat.zip`
3. Ayrı dizine yükle: `node tools/restore.mjs --zip /tmp/tatbikat.zip --target /tmp/tatbikat`
4. Karşılaştır: kullanıcı sayısı, `audit.log` satır sayısı, oturum dizini sayısı
5. Tarih + sonucu kaydet (aşağıdaki tabloya)

### Tatbikat kaydı

| Tarih | Yedek dosya sayısı | Doğrulama | Geri yükleme | Kullanıcı | Denetim satırı | Oturum | Sonuç |
|---|---|---|---|---|---|---|---|
| 2026-11-09 | 7 | GEÇERLİ | BAŞARILI | 1 → 1 | 6 → 6 | 1 → 1 | **geçti** |

---

## 7. Sık sorunlar

| Belirti | Neden | Çözüm |
|---|---|---|
| `Yedeklenecek dosya yok` | `web-data/` ve `.dora-onboarding/` boş | Kurulum henüz veri üretmemiş; normal |
| `hedef dizin boş değil` | Hedefte dosya var | `--force` veya boş dizin seç |
| `içerik değişmiş` | Yedek bozulmuş | O yedeği kullanma; önceki yedeğe dön |
| `güvensiz yol` | Yedek elle kurcalanmış | Yedeği reddet, kaynağı incele |
| Geri yükleme sonrası giriş yapılamıyor | `users.json` eski/yeni karışmış | `web-data/users.json` içeriğini kontrol et; gerekirse temiz kurulum + kanıt paketlerinden geri dönüş |

# Ubuntu Kurulumu ve Genel Test

Bu belge, paketi bir Ubuntu sunucusuna kurup tarayıcıdan görmek ve tüm doğrulamaları
çalıştırmak için gereken adımları verir.

Son güncelleme: 2026-11-09 · Sürüm 1.4.0

---

## 1. Ne gerekiyor

| Gereksinim | Neden | Not |
|---|---|---|
| **Node.js 18+** | CLI ve statik sunucu | 20 veya 22 LTS önerilir. `npm install` **gerekmez** |
| **git** | Klonlamak için | Offline kurulumda gerekmez (`--offline`) |
| **~50 MB disk** | Depo + üretilen çıktılar | Artefaktlar küçük; log yok |
| **1 çekirdek / 256 MB RAM** | Statik dosya sunumu | Ölçülen: boşta ~40 MB |
| ~~GPU~~ | **Gerekmez** | Paket hesap yapmıyor, dosya sunuyor |
| 8080/tcp (veya seçtiğiniz port) | Dashboard erişimi | Yalnız iç ağda açmanız yeterli |

**Ağ:** kurulum sonrası dış bağlantı gerekmez. Dashboard harici CDN/font kullanmaz; kapalı
ağda da açılır.

---

## 2. Hangi sunucu

İki makine de bu iş için **fazlasıyla yeterli**; iş yükü tek çekirdeği bile doldurmaz.
Seçim, kaynak değil **operasyonel** gerekçeyle yapılmalı:

| | Sunucu A (5700X3D / 3060 Ti 8 GB / 16 GB / 128 GB NVMe) | Sunucu B (Ryzen 7900 / 3060 Ti 8 GB / 16 GB / 1 TB NVMe + 4 TB SSD) |
|---|---|---|
| CPU | Fazla | Fazla |
| RAM | Fazla | Fazla |
| Disk | **128 GB — dar** | **1 TB + 4 TB — rahat** |
| Öneri | — | **Bunu kullanın** |

**Neden B:** paket bugün 50 MB ama pilotlarda kanıt paketleri, PDF'ler ve oturum artefaktları
birikir; 128 GB'lık diskte bunları tutmak gereksiz sıkışıklık yaratır. Ayrıca 7900 daha yeni
çekirdek mimarisi — fark bu iş yükünde ölçülmez ama yedek/arşiv işleri için baş payı kalır.

**GPU'lar kullanılmıyor.** İki makinede de 3060 Ti boşta durur; bu paket için bir anlamı yok.
İleride "ajan çalıştırıcısı" (yerel LLM) eklenirse o zaman VRAM konuşulur — o katman bu paketin
kapsamında değil.

---

## 3. Kurulum (3 komut)

```bash
# 1) dosyaları getir
git clone https://github.com/atlantis77ut/dora-ai-package.git /opt/dora-ai-package

# 2) genel testi çalıştır (kurulum öncesi doğrulama)
bash /opt/dora-ai-package/scripts/smoke-test.sh

# 3) servisi kur ve başlat
sudo bash /opt/dora-ai-package/scripts/install-ubuntu.sh --service --port 8080
```

Tek adımda kurulum + test + servis:

```bash
sudo bash scripts/install-ubuntu.sh --service --port 8080
```

Seçenekler:

| Seçenek | Anlamı |
|---|---|
| `--dir /srv/dora` | Kurulum dizini (varsayılan `/opt/dora-ai-package`) |
| `--port 8081` | Dinlenecek port (varsayılan 8080) |
| `--service` | systemd servisi kur, `dora` kullanıcısı oluştur, başlat |
| `--offline` | Klonlama yok; mevcut dizini hedefe kopyalar |
| `--no-tests` | Test adımını atla |

Node.js yoksa betik **kurulum yapmaz**, komutu gösterir:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

---

## 4. Erişim

Servis ayakta:

```
http://<sunucu-ip>:8080/            → yönlendirme (dashboard / site / sağlık)
http://<sunucu-ip>:8080/dashboard/  → KPI, fazlar, süreçler, kontroller
http://<sunucu-ip>:8080/site/       → landing sayfası
http://<sunucu-ip>:8080/healthz     → {"ok":true,"version":"1.4.0"}
```

Yalnız iç ağda açmak için (ufw örneği):

```bash
sudo ufw allow from 10.0.0.0/8 to any port 8080 proto tcp
```

Servisi yönetmek:

```bash
sudo systemctl status dora-ai-package
sudo journalctl -u dora-ai-package -f
sudo systemctl restart dora-ai-package
```

---

## 4b. İlk açılış ve kullanıcılar

`http://<sunucu-ip>:8080/app/` ilk açıldığında **yönetici hesabı** oluşturmanızı ister
(kullanıcı adı + en az 8 karakterli parola). Bu hesap:

- teknik paneli (`/dashboard/`) ve kanıt JSON'larını görür,
- **Yönetim** sekmesinden kullanıcı ekler (rol: yönetici / kullanıcı),
- işlem kaydını (giriş, kayıt, kullanıcı değişikliği) görür.

Kullanıcı rolü yalnız iş arayüzünü görür: Durum, Kurum bilgileri, Sistem bağlantıları,
Varlıklarım, Sorumlular, Belgeler — süreç kodu, JSON veya teknik sayaç yok.

`web-data/users.json`, `web-data/secret.key`, `web-data/audit.log` 0600 izniyle yazılır;
`web-data/` dizinini yedeklerken bu dosyaları da koruyun.

## 4c. SSO (kurumsal giriş)

Entra ID veya Keycloak bağlamak için: [`SSO-KURULUM.md`](SSO-KURULUM.md).
TLS olmadan SSO çalışmaz; önce §5'teki ters vekil kurulumunu tamamlayın.

## 5. Nginx arkasına alma (opsiyonel)

Doğrudan 8080 yerine 80/443 üzerinden yayınlamak isterseniz:

```nginx
server {
    listen 80;
    server_name dora.ornek.local;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Bu durumda servisi `--host 127.0.0.1` ile çalıştırın (dışarı açmasın).

---

## 6. Offline kurulum (ağ erişimi olmayan sunucu)

```bash
# geliştirme makinesinde
tar --exclude=.git --exclude=node_modules -czf dora.tar.gz -C dora-ai-package .

# sunucuya taşı
scp dora.tar.gz kullanici@sunucu:/tmp/

# sunucuda
sudo mkdir -p /opt/dora-ai-package && sudo tar -xzf /tmp/dora.tar.gz -C /opt/dora-ai-package
sudo bash /opt/dora-ai-package/scripts/install-ubuntu.sh --offline --service
```

---

## 7. Genel test

`scripts/smoke-test.sh` sekiz adımı sırayla çalıştırır ve özet verir:

```
== 0) Ortam                node v20.x
== 1) Katalog şemaları     validate --strict
== 2) Kural motoru         49 kural söz dizimi
== 3) 6 fazlı demo         6/6 faz
== 4) Kabul senaryoları    27/27 assertion
== 5) Kanıt paketi         demo-export
== 6) Dış veri alımı       demo-ingest
== 7) DORA eşlemesi        %100 kapsama
== 8) Dashboard + site     üretim
ÖZET: 12 geçti · 0 başarısız
```

Bir adım başarısız olursa betik hangi adımda durduğunu ve son 15 satırı yazar; çıkış kodu 1'dir.

---

## 8. Sorun giderme

| Belirti | Olası neden | Çözüm |
|---|---|---|
| `node: command not found` | Node kurulu değil | §3'teki nodesource komutu |
| `Node.js 18+ gerekli` | Eski sürüm | `node -v` kontrol, yükselt |
| `EADDRINUSE` | Port dolu | `--port 8081` veya `ss -ltnp \| grep 8080` |
| Sayfa açılmıyor | ufw / güvenlik grubu | Portu iç ağa aç (§4) |
| `permission denied` (dosya) | `dora` kullanıcısı okuyamıyor | `chown -R dora:dora /opt/dora-ai-package` |
| Servis sürekli yeniden başlıyor | Yanlış node yolu | `which node` → unit içindeki `ExecStart` ile karşılaştır |
| Dashboard boş görünüyor | `dashboard/` üretilmemiş | `node docs/tools/build-dashboard.mjs` |

---

## 9. Bu makinede ne test edildi (dürüst not)

- `tools/serve.mjs`: yerel olarak çalıştırıldı — `/`, `/dashboard/`, PNG, `/healthz` 200 döndü;
  yol dışına çıkma denemesi engellendi.
- `scripts/install-ubuntu.sh` ve `scripts/smoke-test.sh`: **bu ortamda çalıştırılamadı**
  (Windows sandbox bash sürecini başlatmıyor). Satır sonları LF olarak doğrulandı ve komutlar
  tek tek elle denendi; ilk gerçek çalıştırma sunucuda olacak. Beklenmedik bir hata olursa
  çıktıyı gönderin, düzelteyim.

# Üretim Kontrol Listesi — 1.0.0

8 Kasım 2026 · ustauretim

Bu liste, paketi bir banka ortamında çalıştırmadan önce tamamlanması gerekenleri sıralar.
Her madde işaretlenebilir; işaretlenmeyen madde varsa üretim sorumluluğu kabul edilmemiş sayılır.

---

## 1. Kurulum

- [ ] Node.js 18+ (CI matrisi 18/20/22 × Linux/Windows ile doğrulanıyor)
- [ ] Depo klonlandı, git geçmişi korunuyor
- [ ] `node bin/dora-onboard.mjs validate --strict` temiz
- [ ] `node tools/demo.mjs` → 6/6 faz
- [ ] Dashboard kurum ağında açılıyor (harici CDN yok)

## 2. Lisans

- [ ] Satıcı özel anahtarı üretildi, çevrimdışı/HSM'de saklanıyor
- [ ] `onboarding/license/public-key.pem` dağıtılan sürümle aynı
- [ ] `dev-private.pem` üretim artefaktlarında **yok** (zip/konteyner/imaj taraması)
- [ ] Lisans token'ı tier ve fazları kapsıyor; C6 kapısı geçiyor
- [ ] Anahtar devri prosedürü yazılı (eski lisanslar geçersizleşmeden)

## 3. Veri

- [ ] Dış veri yalnızca `ingest` ile alınıyor (elle kopyalama yok)
- [ ] `ingest-log.json` yedekleniyor; her satırda sha256 var
- [ ] Şema reddi izleniyor (sessizce yutulmuyor)
- [ ] Oturum dizini (`.dora-onboarding/`) yedekleniyor
- [ ] Kişisel veri içeren artefaktlar maskeleniyor (PRC-INF-01)

## 4. Kanıt

- [ ] `export` yalnızca imzalı çalışıyor (`--allow-unsigned` üretimde kullanılmıyor)
- [ ] Kanıt paketleri değiştirilemez medyada (WORM) saklanıyor
- [ ] `verify` düzenli çalışıyor; başarısız paket için alarm var
- [ ] Saklama süresi 10 yıl (süreç çıktılarındaki `retention_years` ile uyumlu)

## 5. Raporlama

- [ ] `data/calendar-anchors.yaml` kurum tarihleriyle dolduruldu
- [ ] Aylık MI paketi üretimi bir sahibe atandı (PRC-RSK-06)
- [ ] MI paketi yönetim kurulu gündemine bağlandı; onay kaydı tutuluyor (CTL-RSK-012)
- [ ] Bildirim formları `--check` ile boş alan denetiminden geçiyor
- [ ] Regülatör kanalı ve gönderim sorumlusu yazılı

## 6. İzleme ve süreklilik

- [ ] CI kırmızıysa sürüm çıkmıyor (branch protection)
- [ ] `validate --strict` yeni alan eklenince kırılıyor (bilinçli)
- [ ] Yedekleme ve geri yükleme testi yapıldı (CTL-RSK-011)
- [ ] Sürüm yükseltme prosedürü: şema diff'i + changelog okunur

## 7. Bilinen sınırlar (kabul edilerek devreye alınır)

- [ ] Ajan çalıştırıcısı yok — LLM orkestrasyonu ayrı ürün
- [ ] ITS/XBRL resmi taksonomi bağlaması yapılmadı
- [ ] Kanıt paketi şifrelenmiyor; PKI yok
- [ ] Konnektörler dosya bırakma sözleşmesiyle sınırlı (API istemcisi yok)
- [ ] Senaryo çalıştırıcısı yok; senaryolar kabul kriteri olarak kullanılıyor

## 8. Devir teslim

- [ ] `docs/` altındaki 10 belge okundu
- [ ] Lisans anahtarı, public key ve sürüm numarası teslim edildi
- [ ] Eğitim: 6 faz, 4 komut (phase/gate/export/notify), MI paketi
- [ ] Destek kanalı ve SLA yazılı (ticari lisans ekinde)

# Kanıt Paketi ve Bildirim Formları

Sürüm 0.6.0 · 8 Kasım 2026 · ustauretim

Bu belge iki aracı anlatır:

1. **dora-onboard export** — bir oturumun tüm artefaktlarını tek ZIP'te, hash zinciri ve
   Ed25519 imzasıyla paketler.
2. **dora-onboard notify** — ITS 2024/2956 alan sözlüğünden yola çıkarak ilk / ara / nihai
   bildirim formunu doldurur.

İkisi de **deterministiktir**: ajan veya LLM kullanmaz. Amaç, denetimde "kanıtı göster"
sorusuna tek dosyayla cevap vermek ve bildirim formunun eksik alanla gönderilmesini engellemek.

---

## 1. Kanıt paketi

### 1.1 Paket yapısı

~~~
<oturum>-evidence.zip
├── manifest.json              dosya listesi, sha256'lar, zincir başı, imza
├── README.txt                 paketin ne olduğu + doğrulama komutu
└── evidence/
    ├── session.json
    ├── institution-profile.json
    ├── jurisdiction.json
    ├── incident-record.json
    ├── classification-decision.json
    ├── impact-assessment.json
    ├── scenario-results.json
    └── … (oturum dizinindeki tüm dosyalar)
~~~

Paket **şifrelenmez**. İçinde kişisel veri veya ticari sır varsa, paylaşmadan önce maskeleme
yapılmalıdır (PRC-INF-01 gizlilik kontrolü). Bütünlük korunur, gizlilik korunmaz — bu ayrım
bilinçlidir.

### 1.2 Hash zinciri

Her dosya için:

~~~
h_i = sha256( h_{i-1} + "\n" + path + "\n" + sha256(dosya) )
~~~

h_0 girdisi GENESIS'tir; zincir başı (chain_head) son halkadır. Tek bir bayt değişirse
o dosyanın özeti, dolayısıyla sonraki tüm halkalar ve zincir başı değişir. Doğrulama, zinciri
manifest'ten yeniden hesaplar ve chain_head ile karşılaştırır.

### 1.3 İmza

İmza, şu metin üzerinde Ed25519 ile atılır:

~~~
dora-evidence-v1|<generated_at>|<session_id>|<chain_head>
~~~

Manifest'e signature olarak yazılır: alg, payload, value (base64) ve key_fingerprint
(açık anahtarın sha256 ilk 16 karakteri).

**İmza zorunludur.** Anahtar bulunamazsa `export` çalışmayı reddeder (çıkış kodu 1). Bilinçli
olarak imzasız paket üretmek için `--allow-unsigned` gerekir; bu durumda doğrulama paketi
"imza: yok" olarak raporlar. Üretimde satıcı özel anahtarı kullanılmalı, dev-private.pem
yalnızca demo içindir.

### 1.4 Kullanım

~~~bash
# üret (varsayılan çıktı: evidence-out/<oturum>-evidence.zip)
node bin/dora-onboard.mjs export --session ob-2026-xxxxx

# satıcı anahtarıyla imzala
node bin/dora-onboard.mjs export --session ob-2026-xxxxx \
  --key /guvenli/yol/private.pem --out kanit/olay-2026-001.zip

# bilinçli olarak imzasız (yalnızca test/geliştirme)
node bin/dora-onboard.mjs export --session ob-2026-xxxxx --allow-unsigned

# doğrula
node bin/dora-onboard.mjs verify --bundle kanit/olay-2026-001.zip
~~~

Doğrulama çıktısı üç şeyi söyler: oturum kimliği, dosya sayısı ve imza durumu. Sorun varsa
tek tek listelenir ve çıkış kodu **1** olur:

~~~
✘ içerik değişmiş: evidence/classification-decision.json
✘ hash zinciri tutmuyor
~~~

### 1.5 Neyi garanti eder, neyi garanti etmez

| Garanti eder | Garanti etmez |
|---|---|
| Paket içeriğinin üretimden sonra değişmediğini | Paketin üretildiği andaki verinin doğruluğunu |
| Eksik dosya olmadığını (manifest sayımı) | Gizliliği — paket şifreli değildir |
| İmza varsa, paketin belirtilen anahtarla üretildiğini | Anahtarın kime ait olduğunu (PKI gerekir) |
| Zincirle dosyalar arası bağın kopmadığını | Saklama/iptal (WORM) politikasını |

---

## 2. Bildirim formları

### 2.1 Alan sözlüğü

Kaynak: data/mapping/its-2024-2956.yaml. Üç şablon vardır:

| Faz | Süre | Süreç | Alan |
|---|---|---|---:|
| initial | sınıflandırmadan 4 saat · tespitten en çok 24 saat | PRC-INC-02 | 7 |
| intermediate | ilk bildirimden 72 saat | PRC-INC-03 | 6 |
| final | kapanıştan 1 ay | PRC-INC-04 | 7 |

Her alanın bir source değeri vardır: incident-record.json#incident_id gibi. Araç bu
işaretçiyi çözer, değeri bulur, bulamazsa alanı **eksik** işaretler.

### 2.2 Kullanım

~~~bash
# yalnızca kontrol et (dosya yazmaz)
node bin/dora-onboard.mjs notify --session ob-2026-xxxxx --phase initial --check

# üret (json + md + html)
node bin/dora-onboard.mjs notify --session ob-2026-xxxxx --phase initial
~~~

Çıktı: notifications/<oturum>/notification-<faz>.{json,md,html}. HTML yazdırmaya hazırdır
(tarayıcıdan PDF alınabilir) ve eksik alanları kırmızı gösterir.

Çıkış kodları: **0** form tam · **2** zorunlu alan eksik · **1** hata.

### 2.3 Eksik alan davranışı

Form yine de üretilir; ama:

- complete: false ve missing: [...] alanları JSON'a yazılır,
- HTML'de eksik satırlar kırmızı zeminle işaretlenir,
- altbilgide "zorunlu alanlar boşsa bildirim gönderilmemelidir" uyarısı yer alır,
- CLI çıkış kodu 2'dir (CI'da kapı olarak kullanılabilir).

Böylece "eksik ama gönderilmiş" bir bildirim, denetimde görünür hâle gelir.

---

## 3. Uçtan uca demo

~~~bash
cd onboarding/cli
node tools/demo-export.mjs
~~~

Sırayla: oturum açar → C1–C4 fazlarını örnek veriyle çalıştırır → bir olay dosyası yazar →
kanıt paketini üretir → doğrular → **kurcalanmış kopyayı reddettiğini** gösterir → üç bildirim
formunu üretir → zorunlu alanı boşaltıp eksik tespitini sınar → temizler.

Beklenen sonuç: SONUC: tum kontroller gecti (çıkış kodu 0). Bu demo CI'da her push'ta çalışır.

---

## 4. Sınırlar

- ZIP **store** yöntemiyle yazılır (sıkıştırma yok). Kanıt paketleri küçüktür; sıkıştırma
  eklemek bağımlılık veya ek kod gerektirirdi.
- Paket **şifrelenmez**; gizli veri için maskeleme gerekir.
- İmza, anahtarın **kime ait olduğunu** kanıtlamaz — bunun için PKI/sertifika gerekir.
- Bildirim formu **resmi XBRL taksonomisine** bağlanmaz; alan adları paketin iç kanonik
  adlarıdır. Taksonomi eşlemesi uygulama adımıdır (bkz. its-2024-2956.yaml başlığı).

# AGPL ve SaaS Uyumu

Son güncelleme: 2026-11-09 · Sürüm 1.18.0

> **Hukuki danışmanlık değildir.** Bu belge, teknisyenlerin avukatlarına doğru soruları
> götürmesi için hazırlanmış bir teknik-hukuki haritadır. Yayına almadan önce hukukçu onayı alın.

---

## 1. Neden bu konu kritik

Paket **AGPL-3.0-only** lisanslı ve ticari lisans alternatifi var (çift lisans, DR-007).
AGPL'in ayırt edici maddesi **§13 (Remote Network Interaction)**:

> Programı ağ üzerinden kullanan herkese, o sürümün **Corresponding Source**'unu sunmalısınız.

Yani:

| Kullanım biçimi | AGPL ne der | Pratik sonuç |
|---|---|---|
| Müşteri paketi **kendi sunucusunda** çalıştırır (değiştirmeden) | §13 tetiklenmez; dağıtım GPL benzeri yükümlülükler doğurur | Kaynak zaten herkese açık; müşteriye lisans metni + kaynak bağlantısı verilir |
| Müşteri kodu **değiştirip** kendi kullanıcılarına açar | §13 tetiklenir | Müşteri, kendi kullanıcılarına kaynak sunmak zorunda |
| **Biz** paketi SaaS olarak sunarız | §13 tetiklenir (biz değiştirdik) | Kullanıcılara kaynak sunmalıyız **veya** o dağıtım için ticari lisans devreye girer |
| Müşteri ticari lisans alır | AGPL yükümlülükleri kalkar (lisans sözleşmesi belirler) | Kaynak açma zorunluluğu yok |

**Özet:** SaaS satacaksanız iki temiz yol var — (a) kaynak teklifi sayfası yayınlamak,
(b) ticari lisansla o dağıtımı AGPL dışına çıkarmak. Karışık yol (bazen açık bazen kapalı)
hukuken risklidir.

---

## 2. Karar: hangi model

| Model | Uygun olduğu durum | Gereken |
|---|---|---|
| **A. Açık çekirdek + ticari** | Topluluk sürümü AGPL, kurumsal sürüm ticari | İki sürümün sınırı net olmalı; ticari sürümde AGPL kodu varsa ticari lisans yine AGPL sahibinin iznine dayanır (biz sahibiyiz, sorun yok) |
| **B. Yalnız AGPL + hizmet** | Danışmanlık/kurulum geliri; yazılım bedava | SaaS veriyorsan kaynak teklifi zorunlu |
| **C. Yalnız ticari** | Kurumsal satış, kaynak kapalı | AGPL sürümünü yayından kaldırmak gerekir; topluluk katkısı kaybedilir |

**Mevcut yapı B+A karışımı:** depo AGPL, ticari lisans opsiyonel. Bu, en yaygın ve savunulabilir
model — yeter ki ticari sözleşmede AGPL'den sapma açıkça yazılsın.

---

## 3. SaaS için yükümlülük kontrol listesi

SaaS (biz barındırıyoruz) açmadan önce:

- [ ] **Kaynak teklifi**: `/kaynak` sayfası veya sözleşme eki; indirilebilir kaynak arşivi
      (sürüm etiketiyle), en az bir yıl geçerli teklif
- [ ] **Sürüm izi**: çalışan sürümün git commit'i + kaynak arşivinin sha256'sı
- [ ] **Lisans metni**: arayüzde "Lisans" bağlantısı (AGPL tam metni)
- [ ] **Değişiklik kaydı**: AGPL §5 gereği değiştirilen dosyaların tarihleri (git geçmişi yeterli)
- [ ] **Ticari istisna**: ticari lisansla gelen müşterilerde kaynak teklifi yükümlülüğü
      sözleşmeyle kaldırılır; müşteriye bu açıkça bildirilir
- [ ] **Alt işleyen (subprocessor) listesi**: barındırma sağlayıcısı, e-posta, yedekleme
- [ ] **Üçüncü taraf bileşenler**: sıfır npm bağımlılığı (kolay), ama gömülü kod/ikon/font
      lisansları listelenir

> Teknik durum: paket **hiç npm bağımlılığı kullanmıyor**; bu, AGPL uyumunu ve SBOM'u
> kolaylaştırır. Gömülü tek dış metin AGPL lisans metnidir.

---

## 4. Kaynak teklifi metni (kopyala-uyarla)

Arayüz alt bilgisine veya sözleşmeye:

```
Bu hizmet, AGPL-3.0-only lisanslı DORA AI Ajan Paketi'ni çalıştırır.
Çalışan sürümün kaynak kodu: https://github.com/<kullanici>/dora-ai-package/tree/<surum-etiketi>
Kaynak arşivi (sha256: <hash>): https://<alan-adı>/kaynak/<surum>.tar.gz
Lisans tam metni: https://www.gnu.org/licenses/agpl-3.0.txt
```

Ticari lisanslı müşteri için:

```
Bu kurulum, Ticari Lisans Sözleşmesi (No: <sözleşme-no>) kapsamındadır; AGPL-3.0 §13
kaynak teklifi yükümlülüğü bu kapsamda uygulanmaz. Ticari lisans metni: <bağlantı>
```

---

## 5. Ticari lisans sözleşmesinde olması gereken maddeler

1. **Kapsam**: hangi kurulum/kiracı, kaç kullanıcı, hangi modüller
2. **AGPL istisnası**: "Lisans veren, AGPL-3.0 kapsamındaki haklarını bu sözleşmeyle sınırlar;
   lisans alan, AGPL §13 kaynak teklifi yükümlülüğünden muaftır."
3. **Süre ve yenileme**: abonelik dönemi, yenileme, fesih
4. **Destek SLA**: yanıt süresi, iş saatleri, kanal (bu alan hâlâ boş — bkz. `LICENSE-COMMERCIAL.md`)
5. **Sorumluluk sınırı**: dolaylı zararlar hariç, üst sınır = ödenen ücret (12 ay)
6. **Veri işleme**: KVKK/GDPR DPA'ya atıf (bkz. `KVKK-DPA-TASLAK.md`)
7. **Denetim hakkı**: yılda bir, önceden bildirimle
8. **Gizlilik**: karşılıklı NDA maddesi
9. **Fesih sonrası**: verinin iadesi (zip) + silme belgesi
10. **Uygulanacak hukuk**: Türkiye / İstanbul mahkemeleri (veya müşteri ülkesi)

---

## 6. Sık yapılan hatalar

| Hata | Sonuç |
|---|---|
| AGPL kodunu ticari sürümde "kapalı" sanmak | Biz telif sahibiysek sorun yok; **başkasının** AGPL kodu varsa ihlal |
| SaaS'ta kaynak teklifini "depo zaten açık" diye atlamak | §13, *çalışan sürümün* kaynağını ister; etiketli sürüm + arşiv gerekir |
| Müşterinin değiştirdiği kodu bizim desteklememiz | Müşteri kendi değişikliğini yayınlama yükümlülüğü altında; sözleşmede yazılmalı |
| Ticari lisansın AGPL'i "satın aldığını" söylemek | Biz istisna veriyoruz, AGPL'i iptal etmiyoruz; metin buna göre |
| CLA olmadan dış katkı almak | Katkı sahibi kodu ticari lisanslamamıza engel olabilir — CLA şart |

---

## 7. İlgili belgeler

- `LICENSE` — AGPL-3.0 tam metni
- `LICENSE-COMMERCIAL.md` — ticari lisans iskeleti (fiyat/SLA alanları doldurulacak)
- `CLA.md` — katkı sözleşmesi
- `docs/KVKK-AYDINLATMA.md` — kişisel veri aydınlatma metni
- `docs/KVKK-DPA-TASLAK.md` — veri işleyen sözleşmesi taslağı
- `docs/VERI-ENVANTERI.md` — hangi veri nerede tutuluyor
- `docs/SAKLAMA-SILME-PROSEDURU.md` — saklama süreleri ve silme adımları

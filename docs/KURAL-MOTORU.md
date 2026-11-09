# Kural Motoru

Sürüm 1.4.0 · 9 Kasım 2026 · ustauretim

Süreçlerdeki `decision_rules[].condition` ifadelerini **deterministik** olarak değerlendirir.
Doğal dil yorumlamaz: desteklenen söz diziminin dışına çıkan koşul `parse_error` olarak
raporlanır. Böylece "kural yazdık" ile "kural çalışıyor" arasındaki fark kapanır.

```bash
node bin/dora-onboard.mjs rules --audit                       # 49/49 okunabilir mi?
node bin/dora-onboard.mjs rules --session ob-2026-xxxxx --process PRC-INC-01
node bin/dora-onboard.mjs rules --session ob-2026-xxxxx --facts olgular.json
```

Çıkış kodu: **0** hata yok · **2** en az bir koşul okunamadı.

---

## 1. Söz dizimi

| Öğe | Örnek |
|---|---|
| Karşılaştırma | `etkilenen_musteri > 100000` · `kok_neden == 'tedarikci'` |
| Mantık | `A AND B` · `A OR B` · `NOT A` (`&&`, `||`, `!` de kabul) |
| Liste | `eksik_madde IN ['sla','cikis_stratejisi']` · `NOT IN [...]` |
| Parantez | `(A OR B) AND C` |
| Sayı / birim | `kesinti_suresi > 24 saat` · `tlpt_dongusu >= 3 yil` · `tedarikci_payi > %30` |
| Metin | `'kritik'` veya `"kabul edilemez"` |
| Alan yolu | `hesap.son_erisim` · `zafiyet.cvss` · `segment.default_deny` |

Birim sözcükleri (`ay`, `gun`, `gün`, `saat`, `yil`, `yıl`, `EUR`, `adet`, `kez`, `dk`) sayıdan
sonra yok sayılır: `> 24 saat` ile `> 24` aynı anlama gelir. `%30` → `30`.

Nokta içermeyen bir tanımlayıcı olgularda yoksa **metin sabiti** sayılır:
`kurum.tier == tier1` ifadesinde `tier1` sabittir.

---

## 2. Eksik olgu davranışı

Alan bulunamazsa `undefined` kabul edilir, karşılaştırma **false** döner ve alan
`missing` listesinde raporlanır. Amaç: veri eksikken kuralın sessizce tetiklenmemesi.

```
$ rules ... 
  + INC-R1   etkilenen_musteri > 100000        (tetiklendi)
  · INC-R5   veri_kaybi == true OR ...         eksik: yetkisiz_erisim
```

---

## 3. Kanıt → olgu adaptörü

Kural koşulları Türkçe alan adları kullanır (`etkilenen_musteri`), kanıt dosyaları İngilizce
(`affected_customers`). `src/orl/facts.mjs` bu eşlemeyi **açık bir tabloyla** kurar; eşlenmeyen
dosyalar raporda görünür.

| Kanıt dosyası | Ürettiği başlıca olgular |
|---|---|
| `incident-record.json` | `etkilenen_musteri`, `kesinti_suresi` (saat), `ekonomik_etki`, `etkilenen_uyelik_devleti`, `veri_kaybi`, `yetkisiz_erisim` |
| `classification-decision.json` | `siniflandirma`, `eslesen_kriterler` |
| `notification-receipt.json` | `ilk_bildirim_dakika`, `onay_once_gonderim` |
| `intermediate-report.json` / `final-report.json` | `ara_rapor_saat`, `nihai_rapor_gun` |
| `rca-report.json` | `kok_neden`, `kok_neden_kategorisi` |
| `access-review-record.json` | `kapatilan_pasif_hesap`, `iptal_edilen_hesap` |
| `crypto-inventory.yaml` | `sifreleme.in_transit`, `sifreleme.at_rest` |
| `segmentation-evidence.json` | `segment.default_deny` |
| `vulnerability-closure.json` | `zafiyet.cvss`, `zafiyet.yas_gun` |
| `criticality-assessment.yaml` | `tedarikci_yogunlasma_esigi_asildi`, `tedarikci_payi` |
| `exit-strategy.json` | `cikis_plani_gun`, `paralel_calisma_zorunlu` |
| `contract-compliance.json` | `eksik_madde`, `veri_iadesi_maddesi` |
| `register-of-information.json` | `tedarikci_durumu` |
| `request-tracking.json` | `talep_sla` |
| `evidence-bundle.json` | `kanit_kalemi_eslesen`, `kanit_hash_zinciri` |

Ham alanlar da olgu olarak kullanılabilir (adaptör üstüne yazar), böylece İngilizce adla yazılmış
kurallar da çalışır.

---

## 4. Kapsam ve sınırlar

- **49/49 kural** söz dizimi olarak geçerli (bu sürümde ölçüldü).
- Motor **değerlendirir**, uygulamaz: bir kural tetiklendiğinde `action` metni raporlanır,
  aksiyonun kendisi (bildirim gönderme, kayıt açma) ajan/sistem katmanının işidir.
- Zaman, süre birimleri ve tarih aritmetiği yok: `son_erisim > 90 gun` karşılaştırması
  **olgunun sayı olmasını** bekler (gün cinsinden). Tarih farkı hesaplamak adaptörün işi.
- `IN` listeleri düz metin/sayı listesidir; iç içe liste desteklenmez.
- Sonuç dosyası: `<oturum>/rule-evaluation.json` (kural, durum, eksik alanlar).

---

## 5. Nerede kullanılıyor

- `tools/demo-rules.mjs` — CI'da her push'ta çalışır (audit + SCN-01 olguları + hata davranışı)
- `rules --audit` — katalog değiştiğinde hızlı kontrol
- Kanıt paketi (`export`) ve öz değerlendirme (C5) aynı olguları kullanır

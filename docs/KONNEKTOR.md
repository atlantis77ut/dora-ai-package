# Konnektör Sözleşmesi (Dosya Bırakma)

Sürüm 0.8.0 · 8 Kasım 2026 · ustauretim

DORA paketi, kurumun mevcut sistemlerine **API ile bağlanmaz**. Bunun yerine tek ve dar bir
sözleşme tanımlar: konnektör, ürettiği dosyayı bir dizine bırakır; paket dosyayı doğrular,
oturuma alır ve sha256’sıyla kaydeder.

Bu tercih bilinçli:

- Kimlik bilgisi (API key, servis hesabı) paketin içinde tutulmaz — banka ağında en büyük engel budur.
- Her alım kaydı denetlenebilir: hangi dosya, ne zaman, hangi kaynaktan, hangi özetle.
- Konnektör değişse bile paket değişmez; sözleşme sabit kalır.

---

## 1. Kullanım

~~~bash
node bin/dora-onboard.mjs ingest --session ob-2026-xxxxx --from ./drop
~~~

| Seçenek | Anlam |
|---|---|
| --session | Hedef oturum (zorunlu) |
| --from | Kaynak dizin (zorunlu) |
| --allow-unknown | Bilinmeyen uzantıları da al (varsayılan: reddet) |

Çıkış kodları: **0** tümü alındı · **2** en az bir dosya reddedildi · **1** hata.

---

## 2. Desteklenen dosyalar

| Tür | Kural | Örnek |
|---|---|---|
| JSON | Geçerli JSON + artefakt şeması (varsa) | incident-record.json, gap-analysis.json |
| Opak | Uzantı yeterli; içerik doğrulanmaz | rca-report.pdf, initial-notification.xml, register-of-information.xbrl |

Bilinmeyen uzantılar reddedilir (çıkış 2). JSON bozuksa dosya **alınmaz** — yarım veriyle
rapor üretmek, veri olmamasından daha kötüdür.

### 2.1 Artefakt şemaları

schema/artifacts/ altında 7 şema var ve alım sırasında çalışır:

| Şema | Zorunlu alanlar |
|---|---|
| incident-record | incident_id, detected_at, classification |
| classification-decision | incident_id, decision |
| impact-assessment | affected_clients |
| notification-receipt | incident_id, within_sla, sent_at |
| gap-analysis | high_severity |
| go-live | shadow_days, semi_auto_days |
| register-of-information | concentration_breaches |

Şema bulunamazsa dosya yine alınır (kayıt: "şema yok"). Şema varsa ve uyuşmazsa dosya reddedilir;
--lenient ile uyarı olarak kaydedilip kabul edilir.

~~~bash
node bin/dora-onboard.mjs ingest --session ob-2026-xxxxx --from ./drop --lenient
~~~

---

## 3. Kayıt (ingest-log.json)

Her alım oturum dizinindeki ingest-log.json dosyasına eklenir:

~~~json
[
  {
    "file": "incident-record.json",
    "kind": "json",
    "bytes": 214,
    "sha256": "a30683460bdb…",
    "source": "drop",
    "ingested_at": "2026-11-08T19:05:12.114Z"
  }
]
~~~

Kayıt silinmez, eklenir. Aynı dosya iki kez alınırsa iki kayıt olur — bu, dosyanın ne zaman
değiştiğini gösterir. Kanıt paketi (export) bu logu da paketler.

---

## 4. Konnektör örnekleri

| Kaynak sistem | Bırakılan dosya | Not |
|---|---|---|
| SIEM (Splunk/QRADAR) | incident-record.json | alarm → olay kaydı dönüşümü konnektörde |
| ITSM (ServiceNow) | impact-assessment.json, notification-receipt.json | bilet kapanışı ve bildirim kaydı |
| GRC (Archer) | gap-analysis.json | kontrol testi sonuçları |
| Tedarikçi kaydı | register-of-information.json | yoğunlaşma göstergeleri |
| Test ekibi | rca-report.pdf, tlpt-report.pdf | opak kanıt |

Konnektörün tek işi dosyayı yazmak; paket doğrulama ve kayıt işini yapar.

---

## 5. Sınırlar

- **Şema doğrulaması kısmi.** Yalnızca schema/artifacts/ altındaki 7 artefakt için çalışır;
  katalog dosyalarının (süreç/kontrol) şemaları bu yolda denetlenmez.
- **Zamanlama yok.** Paket dizini kendiliğinden izlemez; zamanlamayı cron/systemd yapar.
- **Kimlik doğrulama yok.** Dizine kimin yazabildiği kurumun dosya sistemi politikasıdır.
- **Dönüşüm yok.** Kaynak sistemin alan adları paketin kanonik adlarına konnektörde çevrilir.

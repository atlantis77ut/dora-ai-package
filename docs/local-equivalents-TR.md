# Türkiye Yerel Mevzuat Eşlemesi

DORA bir AB tüzüğüdür; Türkiye'deki kuruluşlar BDDK, TCMB, SEDDK ve SPK düzenlemelerine tabidir.
Bu dosya, paketin **AB dışı bir yargı alanında** nasıl çalıştırılacağını tanımlar: hangi DORA
yükümlülüğünün hangi yerel düzenlemeyle karşılandığı, nerede farklılaştığı ve ajanların
davranışının nerede değişmesi gerektiği.

> **Önemli:** aşağıdaki mevzuat atıfları ve süreler **kurulum sırasında hukuk/uyum birimiyle
> teyit edilmelidir**. Bu dosya bir şablon ve müzakere zeminidir, hukuki görüş değildir.
> Teyit edilmemiş satırlar `⚠` ile işaretlidir.

---

## 1. Uyum ilkesi: iki katman, en katı olan kazanır

```
DORA taban çizgisi  (asgari — paketin çekirdeği)
        ∪
Yerel mevzuat        (ek yükümlülükler + daha kısa süreler)
        ↓
Kurumun uygulayacağı kural = en katı olan
```

Kural olarak: **yerel mevzuat DORA'nın altına inemez**, ama üstüne çıkabilir. Wizard C2 fazında
SLA override üretilirken bu ilke makine tarafından denetlenir — `sla-overrides.json` içinde
`new_hours > dora_hours` olan her satır "gevşetme" sayılır ve C2 kapısını düşürür.

---

## 2. Konu bazında eşleme

| DORA konusu | DORA maddesi | Türkiye muadili ⚠ | Otorite | Ajan/süreç etkisi |
|---|---|---|---|---|
| ICT risk yönetim çerçevesi | 6 | Bilgi Sistemleri ve Elektronik Bankacılık Hizmetleri Hakkında Yönetmelik | BDDK | PRC-RSK-01 aynı; çerçeve dokümanı BDDK terminolojisine çevrilir |
| Varlık envanteri / kritik işlev | 8 | Aynı yönetmelik (bilgi sistemleri envanteri) | BDDK | PRC-RSK-03 aynı; "kritik veya önemli işlev" yerine BDDK'nın "kritik iş süreçleri" tanımı |
| Olay bildirimi | 19 | Bilgi Sistemleri Olaylarına İlişkin Bildirim Usul ve Esasları ⚠ | BDDK | PRC-INC-02 **4 saat** — DORA tabanı uygulanır (DR-001); PRC-INC-03/04 aynı |
| Kişisel veri ihlali | — (DORA'da ayrı yok) | 6698 sayılı KVKK + Veri İhlali Bildirimi Tebliği (**72 saat**) | KVKK Kurulu | **Ek yük:** PRC-INF-02'ye KVKK kolu eklenir; olay sınıflandırmasında veri ihlali ayrıca işaretlenir |
| Üçüncü taraf / destek hizmeti | 28-30 | Bankaların Destek Hizmetleri Yönetmeliği ⚠ + bulut bilişim düzenlemeleri | BDDK | PRC-TPP-01/02/03 aynı; "destek hizmeti" sınıflandırması ve alt yüklenici izni BDDK onayına bağlı |
| Bilgi kaydı (RoI) | 28(3) | BDDK envanter/bildirim seti ⚠ (XBRL-CSV değil) | BDDK | PRC-TPP-04 çıktı formatı **XBRL değil**, BDDK'nın kendi şablonu |
| CTPP / ESA gözetimi | 31-44 | **Muadili yok** | — | PRC-TPP-05 ve ROL-CTPP-01 **pasif** (no-op) moda alınır |
| Dayanıklılık testleri | 24-25 | BDDK test yükümlülükleri ⚠ | BDDK | PRC-TST-01/02 aynı |
| TLPT (tehdit odaklı sızma testi) | 26-27 | **Muadili yok** (genel sızma testi var) | — | PRC-TST-03 opsiyonel; yerine yıllık sızma testi |
| Bilgi paylaşımı | 45 | USOM / sektörel SOME'ler ⚠ | USOM, TCMB | PRC-INF-01 kanalı USOM bildirimi; gizlilik kolonu aynı |
| Ödeme kuruluşları | 23 | Ödeme Hizmetleri ve Elektronik Para İhracı ile Ödeme Hizmeti Sağlayıcıları Hakkında Yönetmelik | TCMB | PRC-INC-02'ye TCMB kanalı eklenir |
| Sigorta / emeklilik | 19, 28 | SEDDK bilgi sistemleri düzenlemeleri ⚠ | SEDDK | Sektör profili değişir, süreçler aynı |
| Kripto varlık hizmet sağlayıcıları | 19, 28 | SPK kripto varlık düzenlemeleri (2024) ⚠ | SPK | Yeni alan; profiller `tier3` varsayılanı ile başlar |

⚠ = kurulumda teyit edilmesi gereken satır.

---

## 3. Süre farkları

**Karar (DR-001, 2026-11-03): paket DORA sürelerini uygular; yerel mevzuat daha uzun süre
öngörse bile taban çizgi gevşetilmez.**

| Olay | DORA | TR muadili ⚠ | Uygulanacak |
|---|---|---|---|
| İlk bildirim | sınıflandırmadan 4 saat, tespitten en geç 24 saat | BDDK bildirim usulü (süre teyit edilecek) | **4 saat** (DR-001) |
| Ara rapor | 72 saat | aynı | 72 saat |
| Nihai rapor | 1 ay | aynı | 1 ay |
| Kişisel veri ihlali | — | 72 saat (KVKK) | **paralel yük**, ayrı bildirim |
| TLPT döngüsü | 3 yıl | — | opsiyonel (TR'de muadili yok) |

> Neden 4 saat: DORA taban çizgisi paketin çekirdeğidir ve `PRC-INC-02` içinde 4 saat olarak
> tanımlıdır. Yerel mevzuat farklı bir süre öngörse bile paket **daha katı olan DORA süresini**
> uygular; gevşetme C2 kapısında (`CTL` kontrolü: `new_hours > dora_hours`) reddedilir.
> Yerel mevzuatın 4 saatten **kısa** bir süre öngörmesi hâlinde ise yerel süre uygulanır —
> kural tek yönlüdür: yalnızca daha katıya gidilebilir.

---

## 4. Çoklu yargı alanı

Bir kuruluş hem AB'de (şube/iştirak) hem Türkiye'de faaliyetteyse:

- **Baseline:** her iki rejimin en katı gereksinimleri (genelde DORA).
- **Raporlama:** iki kanal paralel yürür (ESA/ulusal otorite + BDDK/TCMB). Tek olay kaydı,
  iki bildirim paketi.
- **Kayıt:** aynı denetim izi; ama RoI formatı yargı alanına göre iki varyantta üretilir.
- **Ajan davranışı:** PRC-INC-02 birden fazla hedef kanal taşır; `notification-receipt.json`
  kanal başına ayrı satır tutar.

`orl-lifecycle.yaml` içinde C1 fazı `jurisdiction-config.yaml` üretir; çoklu yargı alanı
burada `jurisdictions: [TR, EU]` olarak listelenir ve C3 fazında her kanal için entegrasyon
testi zorunlu olur.

---

## 5. Yapılandırma örneği

```yaml
# jurisdiction-config.yaml (C1 fazı çıktısı)
jurisdiction: TR
authorities:
  banking: BDDK
  payments: TCMB
  insurance: SEDDK
  data_protection: KVKK
reporting_channels:
  - { id: bddk, type: portal, protocol: "BDDK ONLINE" ⚠ }
  - { id: kvkk, type: email, protocol: "Veri İhlali Bildirimi" ⚠ }
local_equivalents:
  ICT_risk_framework: "Bilgi Sistemleri ve Elektronik Bankacılık Hizmetleri Yönetmeliği"
  incident_reporting: "Bilgi Sistemleri Olaylarına İlişkin Bildirim Usul ve Esasları"
  third_party: "Bankaların Destek Hizmetleri Yönetmeliği"
disabled_processes:
  - PRC-TPP-05   # CTPP gözetimi — TR'de muadili yok
overrides:
  PRC-INC-02:
    keep_dora_sla: true      # 4 saat — DR-001 gereği gevşetilmez
    extra_channels: [kvkk]
  PRC-TPP-04:
    output_format: "bddk_template"   # XBRL değil
```

---

## 6. Ajanlara etkisi (özet)

| Ajan | TR'de ne değişir |
|---|---|
| ROL-INC-01 | Bildirim paketi iki kanal için üretilir; KVKK kolu ayrıca çalışır |
| ROL-TPP-01 | "Destek hizmeti" sınıflandırması ve alt yüklenici izni; RoI formatı BDDK şablonu |
| ROL-CTPP-01 | **Pasif** — TR'de CTPP gözetimi yok |
| ROL-TLPT-01 | **Opsiyonel** — TLPT yerine yıllık sızma testi |
| ROL-CMP-01 | KVKK + BDDK + DORA üçlü uyum matrisi; çelişkide en katı olan |
| ROL-CIO-01 | Çerçeve dokümanı BDDK terminolojisiyle yeniden yazılır |

---

## 7. Doğrulanması gerekenler

Kurulum öncesi kapatılması gereken açık noktalar:

1. BDDK olay bildirim kanalı ve varsa kısa süreleri — 4 saat tabanı korunur (DR-001); yerel mevzuat 4 saatten kısa süre öngörüyorsa o süre uygulanır.
2. Destek hizmeti / bulut bilişim için BDDK ön izin gereklilikleri.
3. RoI muadili: BDDK'nın istediği format ve dönem.
4. SEDDK ve SPK için ayrı süre/format farkları.
5. KVKK 72 saat bildiriminin DORA olay bildirimiyle nasıl birleştirileceği (tek olay, iki rejim).
6. Kripto varlık hizmet sağlayıcıları için hangi otoritenin birincil olduğu.

Bu maddeler kapanmadan paket TR'de "üretime hazır" sayılmamalı; C5 fazı bu dosyayı kanıt
olarak kullanır ve açık maddeler boşluk olarak görünür.

# DORA Madde → Süreç / Kontrol Eşlemesi

> Bu dosya **üretilmiştir**: `data/mapping/dora-articles.yaml` kaynağından gelir.
> Yeniden üretmek için: `node docs/tools/render-mapping.mjs`
> Doğrulamak için (yazmadan): `node docs/tools/render-mapping.mjs --check`

- **Sürüm:** 1.0.0
- **Tarih:** 2026-11-03
- **Kaynak:** Regulation (EU) 2022/2554 (DORA)

## Özet

| Durum | Madde |
|---|---|
| covered | 24 |
| partial | 3 |
| gap | 1 |
| **toplam** | **28** |

Tam kapsama oranı: **%86**. `partial` ve `gap` maddeleri C5 öz değerlendirmesinde
boşluk olarak görünür; kapatılmadıkça faz kapısı geçilmez.

## Tablo

| Madde | Başlık | Süreçler | Kontroller | Durum |
|---|---|---|---|---|
| Art-05 | Yönetişim ve organizasyon | PRC-RSK-01 | CTL-RSK-001 | covered |
| Art-06 | ICT risk yönetim çerçevesi | PRC-RSK-01, PRC-RSK-02 | CTL-RSK-001, CTL-RSK-002 | covered |
| Art-07 | ICT sistemleri, protokoller ve araçlar | PRC-RSK-03, PRC-RSK-05 | CTL-RSK-003, CTL-RSK-009 | covered |
| Art-08 | Tanımlama | PRC-RSK-03 | CTL-RSK-003, CTL-RSK-004 | covered |
| Art-09 | Koruma ve önleme | PRC-RSK-05 | CTL-RSK-007, CTL-RSK-008, CTL-RSK-009, CTL-RSK-010 | covered |
| Art-10 | Tespit | PRC-INC-01 | CTL-INC-001 | covered |
| Art-11 | İş sürekliliği politikası ve kurtarma planları | PRC-RSK-04, PRC-RSK-02 | CTL-RSK-005 | covered |
| Art-12 | Yedekleme politikaları, prosedürleri ve yöntemleri | PRC-RSK-04 | CTL-RSK-005 | partial |
| Art-13 | Öğrenme ve gelişme | PRC-INC-04 | CTL-INC-006, CTL-INC-007 | covered |
| Art-14 | İletişim | PRC-INC-04 | — | gap |
| Art-15 | Küçük kuruluşlar için basitleştirilmiş çerçeve | PRC-RSK-01, PRC-RSK-04 | CTL-RSK-001 | covered |
| Art-16 | Orantılılık ilkesi | PRC-RSK-01 | CTL-RSK-001 | covered |
| Art-17 | ICT olay yönetimi süreci | PRC-INC-01, PRC-INC-02, PRC-INC-03, PRC-INC-04 | CTL-INC-001, CTL-INC-002 | covered |
| Art-18 | Olay sınıflandırması | PRC-INC-01 | CTL-INC-002 | covered |
| Art-19 | Büyük olayların raporlanması | PRC-INC-02, PRC-INC-03, PRC-INC-04 | CTL-INC-003, CTL-INC-004, CTL-INC-005, CTL-INC-006 | covered |
| Art-20 | Raporlama şablonlarının uyumlaştırılması | PRC-INC-02, PRC-INC-03, PRC-INC-04 | CTL-INC-004 | partial |
| Art-23 | Ödeme ile ilgili operasyonel/güvenlik olayları | PRC-INC-02 | CTL-INC-003 | partial |
| Art-24 | Dijital operasyonel dayanıklılık testi | PRC-TST-01, PRC-TST-02 | CTL-TST-001, CTL-TST-002 | covered |
| Art-25 | Test araç ve sistemlerinin kullanımı | PRC-TST-02 | CTL-TST-001, CTL-TST-003 | covered |
| Art-26 | TLPT — gelişmiş test | PRC-TST-03 | CTL-TST-004 | covered |
| Art-27 | Test eden tarafların gereklilikleri | PRC-TST-02, PRC-TST-03 | CTL-TST-002 | covered |
| Art-28 | Üçüncü taraf ICT hizmet sağlayıcılarına ilişkin genel ilkeler | PRC-TPP-01, PRC-TPP-02, PRC-TPP-04 | CTL-TPP-001, CTL-TPP-002, CTL-TPP-005 | covered |
| Art-29 | Yoğunlaşma riski | PRC-TPP-02, PRC-TPP-06 | CTL-TPP-003, CTL-TPP-007 | covered |
| Art-30 | Sözleşmesel düzenlemelerin temel unsurları | PRC-TPP-03 | CTL-TPP-004 | covered |
| Art-31 | Kritik tedarikçilerin (CTPP) belirlenmesi | PRC-TPP-05 | CTL-TPP-006 | covered |
| Art-33 | Gözetim çerçevesi | PRC-TPP-05 | CTL-TPP-006 | covered |
| Art-35 | Gözetim makamlarının önerileri | PRC-TPP-05 | CTL-TPP-006 | covered |
| Art-45 | Siber tehdit bilgisi ve istihbarat paylaşımı | PRC-INF-01, PRC-INF-02 | CTL-INF-001, CTL-INF-002, CTL-INF-003 | covered |

## Madde ayrıntısı

### Art-05 — Yönetişim ve organizasyon

*Bölüm II — ICT Risk Yönetimi*

- Yönetim organı ICT riskinden nihai sorumludur
- ICT risk çerçevesi onaylanır ve yılda gözden geçirilir
- Yeterli dijital operasyonel dayanıklılık uzmanlığı sağlanır

- **Süreçler:** PRC-RSK-01
- **Kontroller:** CTL-RSK-001
- **Sahip roller:** ROL-CEO-01, ROL-CIO-01
- **Durum:** covered

### Art-06 — ICT risk yönetim çerçevesi

*Bölüm II — ICT Risk Yönetimi*

- Sağlam, kapsamlı ve iyi belgelenmiş ICT risk çerçevesi kurulur
- Strateji, politika, prosedür, protokol ve araçlar tanımlanır
- Çerçeve en az yılda bir gözden geçirilir

- **Süreçler:** PRC-RSK-01, PRC-RSK-02
- **Kontroller:** CTL-RSK-001, CTL-RSK-002
- **Sahip roller:** ROL-CIO-01, ROL-CMP-01
- **Durum:** covered

### Art-07 — ICT sistemleri, protokoller ve araçlar

*Bölüm II — ICT Risk Yönetimi*

- Güvenilir, kapasitesi yeterli ve güncel ICT sistemleri kullanılır
- Sistem yapılandırması ve sıkılaştırma standartları uygulanır

- **Süreçler:** PRC-RSK-03, PRC-RSK-05
- **Kontroller:** CTL-RSK-003, CTL-RSK-009
- **Sahip roller:** ROL-CTO-01, ROL-RSK-01
- **Durum:** covered

### Art-08 — Tanımlama

*Bölüm II — ICT Risk Yönetimi*

- ICT varlıkları ve bağımlılıkları envanterlenir
- Kritik veya önemli işlevler belirlenir
- Kayıt dışı varlık bırakılmaz

- **Süreçler:** PRC-RSK-03
- **Kontroller:** CTL-RSK-003, CTL-RSK-004
- **Sahip roller:** ROL-RSK-01
- **Durum:** covered

### Art-09 — Koruma ve önleme

*Bölüm II — ICT Risk Yönetimi*

- Erişim kontrolü, kimlik doğrulama ve şifreleme uygulanır
- Ağ güvenliği ve segmentasyonu sağlanır
- Veri ve sistemlerin bütünlüğü korunur

- **Süreçler:** PRC-RSK-05
- **Kontroller:** CTL-RSK-007, CTL-RSK-008, CTL-RSK-009, CTL-RSK-010
- **Sahip roller:** ROL-CTO-01, ROL-CMP-01
- **Durum:** covered
- **Tier:** tier3: yıllık tek gözden geçirme yeterli (corf-lifecycle tier_variants)

### Art-10 — Tespit

*Bölüm II — ICT Risk Yönetimi*

- Anormallikleri ve olayları zamanında tespit eden mekanizmalar kurulur
- Tespit için izleme ve uyarı üretimi yapılır

- **Süreçler:** PRC-INC-01
- **Kontroller:** CTL-INC-001
- **Sahip roller:** ROL-INC-01
- **Durum:** covered

### Art-11 — İş sürekliliği politikası ve kurtarma planları

*Bölüm II — ICT Risk Yönetimi*

- BCP ve DRP dokümante edilir ve test edilir
- Kritik işlevler için RTO/RPO tanımlanır

- **Süreçler:** PRC-RSK-04, PRC-RSK-02
- **Kontroller:** CTL-RSK-005
- **Sahip roller:** ROL-CIO-01
- **Durum:** covered

### Art-12 — Yedekleme politikaları, prosedürleri ve yöntemleri

*Bölüm II — ICT Risk Yönetimi*

- Yedekleme ve geri yükleme test edilir
- Yedekler kritik verileri kapsar ve ayrı konumda tutulur

- **Süreçler:** PRC-RSK-04
- **Kontroller:** CTL-RSK-005
- **Sahip roller:** ROL-CTO-01
- **Durum:** partial
- **Not:** Geri yükleme testi BCP/DRP kanıtı içinde izleniyor; ayrı yedekleme kontrolü yok.

### Art-13 — Öğrenme ve gelişme

*Bölüm II — ICT Risk Yönetimi*

- Olay sonrası kök neden analizi yapılır
- Bulgular kontrol ve süreçlere geri beslenir

- **Süreçler:** PRC-INC-04
- **Kontroller:** CTL-INC-006, CTL-INC-007
- **Sahip roller:** ROL-CMP-01, ROL-INC-01
- **Durum:** covered

### Art-14 — İletişim

*Bölüm II — ICT Risk Yönetimi*

- Kriz iletişimi planı ve sorumluları tanımlanır
- Paydaşlara ve kamuya iletişim protokolü kurulur

- **Süreçler:** PRC-INC-04
- **Kontroller:** —
- **Sahip roller:** ROL-CEO-01, ROL-INC-01
- **Durum:** gap
- **Not:** Kriz iletişimi planı bu pakette yok; CEO ajanı yalnızca yönetim kurulu raporlamasını kapsıyor.

### Art-15 — Küçük kuruluşlar için basitleştirilmiş çerçeve

*Bölüm II — ICT Risk Yönetimi*

- Madde 16 kriterlerini karşılayan kuruluşlar basitleştirilmiş çerçeve uygulayabilir

- **Süreçler:** PRC-RSK-01, PRC-RSK-04
- **Kontroller:** CTL-RSK-001
- **Sahip roller:** ROL-CIO-01
- **Durum:** covered
- **Tier:** tier3 profillerinde uygulanır (corf-lifecycle.yaml tier_variants).

### Art-16 — Orantılılık ilkesi

*Bölüm II — ICT Risk Yönetimi*

- Gereklilikler kuruluşun büyüklüğü, risk profili ve karmaşıklığına göre uygulanır

- **Süreçler:** PRC-RSK-01
- **Kontroller:** CTL-RSK-001
- **Sahip roller:** ROL-CIO-01, ROL-CMP-01
- **Durum:** covered
- **Tier:** Tier seçimi ve faz uyarlaması wizard'da zorunlu adım (C1, C2).

### Art-17 — ICT olay yönetimi süreci

*Bölüm III — Olay Yönetimi*

- Olayları tespit, yönet, kaydet ve raporla
- Erken uyarı göstergeleri tanımlanır

- **Süreçler:** PRC-INC-01, PRC-INC-02, PRC-INC-03, PRC-INC-04
- **Kontroller:** CTL-INC-001, CTL-INC-002
- **Sahip roller:** ROL-INC-01
- **Durum:** covered

### Art-18 — Olay sınıflandırması

*Bölüm III — Olay Yönetimi*

- Olaylar büyük/küçük olarak sınıflandırılır
- Kriterler RTS ile uyumlu uygulanır

- **Süreçler:** PRC-INC-01
- **Kontroller:** CTL-INC-002
- **Sahip roller:** ROL-INC-01, ROL-CIO-01
- **Durum:** covered

### Art-19 — Büyük olayların raporlanması

*Bölüm III — Olay Yönetimi*

- İlk bildirim: sınıflandırmadan sonra 4 saat, tespitten en geç 24 saat
- Ara rapor: 72 saat
- Nihai rapor: 1 ay

- **Süreçler:** PRC-INC-02, PRC-INC-03, PRC-INC-04
- **Kontroller:** CTL-INC-003, CTL-INC-004, CTL-INC-005, CTL-INC-006
- **Sahip roller:** ROL-INC-01, ROL-CIO-01
- **Durum:** covered

### Art-20 — Raporlama şablonlarının uyumlaştırılması

*Bölüm III — Olay Yönetimi*

- Bildirimler RTS/ITS şablonlarına uygun üretilir

- **Süreçler:** PRC-INC-02, PRC-INC-03, PRC-INC-04
- **Kontroller:** CTL-INC-004
- **Sahip roller:** ROL-CMP-01
- **Durum:** partial
- **Not:** Şablon alanları tanımlı; ITS 2024/2956 alan eşlemesi bu pakette ayrıntılandırılmadı.

### Art-23 — Ödeme ile ilgili operasyonel/güvenlik olayları

*Bölüm III — Olay Yönetimi*

- Ödeme işlemlerine ilişkin olaylar ayrıca raporlanır

- **Süreçler:** PRC-INC-02
- **Kontroller:** CTL-INC-003
- **Sahip roller:** ROL-INC-01, ROL-CMP-01
- **Durum:** partial
- **Not:** Ödeme kuruluşları için TCMB kanalı tanımlı (local-equivalents-TR.md), ancak madde bazlı ayrım süreçte yok.

### Art-24 — Dijital operasyonel dayanıklılık testi

*Bölüm IV — Test*

- Risk bazlı test programı kurulur ve sürdürülür
- Testler bağımsız yürütülür

- **Süreçler:** PRC-TST-01, PRC-TST-02
- **Kontroller:** CTL-TST-001, CTL-TST-002
- **Sahip roller:** ROL-CTO-01, ROL-AUD-01
- **Durum:** covered

### Art-25 — Test araç ve sistemlerinin kullanımı

*Bölüm IV — Test*

- Kritik işlevleri destekleyen sistemler yılda en az bir kez test edilir
- Test kapsamı dokümante edilir

- **Süreçler:** PRC-TST-02
- **Kontroller:** CTL-TST-001, CTL-TST-003
- **Sahip roller:** ROL-CTO-01
- **Durum:** covered

### Art-26 — TLPT — gelişmiş test

*Bölüm IV — Test*

- Sistemik öneme sahip kuruluşlar 3 yılda bir TLPT yapar
- TLPT gerçek üretim ortamında, tehdit odaklı yürütülür

- **Süreçler:** PRC-TST-03
- **Kontroller:** CTL-TST-004
- **Sahip roller:** ROL-TLPT-01
- **Durum:** covered
- **Tier:** Yalnız tier1 kapsamında zorunlu.

### Art-27 — Test eden tarafların gereklilikleri

*Bölüm IV — Test*

- Testçiler bağımsız ve yeterli yetkinlikte olur
- Çıkar çatışması önlenir

- **Süreçler:** PRC-TST-02, PRC-TST-03
- **Kontroller:** CTL-TST-002
- **Sahip roller:** ROL-CMP-01, ROL-AUD-01
- **Durum:** covered

### Art-28 — Üçüncü taraf ICT hizmet sağlayıcılarına ilişkin genel ilkeler

*Bölüm V — Üçüncü taraf riski*

- Sözleşme öncesi durum tespiti yapılır
- Kritiklik değerlendirmesi yapılır
- Bilgi kaydı (RoI) tutulur ve yıllık sunulur

- **Süreçler:** PRC-TPP-01, PRC-TPP-02, PRC-TPP-04
- **Kontroller:** CTL-TPP-001, CTL-TPP-002, CTL-TPP-005
- **Sahip roller:** ROL-TPP-01
- **Durum:** covered

### Art-29 — Yoğunlaşma riski

*Bölüm V — Üçüncü taraf riski*

- Tek tedarikçiye aşırı bağımlılık ölçülür ve yönetilir
- Çıkış stratejisi hazır tutulur

- **Süreçler:** PRC-TPP-02, PRC-TPP-06
- **Kontroller:** CTL-TPP-003, CTL-TPP-007
- **Sahip roller:** ROL-TPP-01, ROL-CIO-01
- **Durum:** covered

### Art-30 — Sözleşmesel düzenlemelerin temel unsurları

*Bölüm V — Üçüncü taraf riski*

- Hizmet tanımı, SLA, denetim hakkı, veri iadesi ve çıkış hükümleri bulunur
- Alt yüklenici koşulları düzenlenir

- **Süreçler:** PRC-TPP-03
- **Kontroller:** CTL-TPP-004
- **Sahip roller:** ROL-TPP-01, ROL-CMP-01
- **Durum:** covered

### Art-31 — Kritik tedarikçilerin (CTPP) belirlenmesi

*Bölüm V — Üçüncü taraf riski*

- CTPP olarak belirlenen sağlayıcılar izlenir

- **Süreçler:** PRC-TPP-05
- **Kontroller:** CTL-TPP-006
- **Sahip roller:** ROL-CTPP-01
- **Durum:** covered
- **Tier:** ESA CTPP listesi kapsamında; tier1-2 için anlamlı.

### Art-33 — Gözetim çerçevesi

*Bölüm V — Üçüncü taraf riski*

- ESA gözetim önerileri takip edilir ve uygulanır

- **Süreçler:** PRC-TPP-05
- **Kontroller:** CTL-TPP-006
- **Sahip roller:** ROL-CTPP-01
- **Durum:** covered

### Art-35 — Gözetim makamlarının önerileri

*Bölüm V — Üçüncü taraf riski*

- Önerilere uyum süresi ve gerekçelendirme yönetilir

- **Süreçler:** PRC-TPP-05
- **Kontroller:** CTL-TPP-006
- **Sahip roller:** ROL-CTPP-01, ROL-CMP-01
- **Durum:** covered

### Art-45 — Siber tehdit bilgisi ve istihbarat paylaşımı

*Bölüm VII — Bilgi paylaşımı*

- Güvenilir topluluklar içinde tehdit istihbaratı paylaşılır
- Ticari sır ve kişisel veri korunur

- **Süreçler:** PRC-INF-01, PRC-INF-02
- **Kontroller:** CTL-INF-001, CTL-INF-002, CTL-INF-003
- **Sahip roller:** ROL-INF-01, ROL-CMP-01
- **Durum:** covered
## Kapsam dışı

Yalnızca yükümlülük doğuran maddeler eşlendi; tanım maddeleri (3) ve kurumsal/yaptırım maddeleri kapsam dışı. Madde numaraları DORA resmi metnine göredir.

Tanım maddeleri (ör. Madde 3, Madde 4 kapsam belirleme) ve yaptırım maddeleri (Madde 50 vd.)
bu eşlemenin dışındadır — bunlar yükümlülük değil çerçeve hükmüdür.

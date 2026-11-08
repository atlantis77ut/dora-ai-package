# DORA Kapsam Özeti

> **Üretilen belge** — elle düzenlenmez. Kaynak: `data/mapping/dora-articles.yaml`
> Yeniden üretmek için: `node docs/tools/build-coverage-summary.mjs`

Eşleme sürümü: **1.1.0** · kaynak: Regulation (EU) 2022/2554 (DORA) · veri tarihi: 2026-11-08

## 1. Özet

| Ölçüt | Değer |
|---|---|
| Eşlenen yükümlülük maddesi | 28 |
| Tam kapsanan | 28 |
| Kısmi | 0 |
| Boşluk | 0 |
| Tam kapsama oranı | %100 |
| Ağırlıklı kapsama (kısmi = 0,5) | %100 |

Kapsam notu (eşlemeden): Yalnızca yükümlülük doğuran maddeler eşlendi; tanım maddeleri (3) ve kurumsal/yaptırım maddeleri kapsam dışı. Madde numaraları DORA resmi metnine göredir.

## 2. Bölüm bazlı dağılım

| Bölüm | Madde | Tam | Kısmi | Boşluk |
|---|---:|---:|---:|---:|
| Bölüm II — ICT Risk Yönetimi | 12 | 12 | 0 | 0 |
| Bölüm III — Olay Yönetimi | 5 | 5 | 0 | 0 |
| Bölüm IV — Test | 4 | 4 | 0 | 0 |
| Bölüm V — Üçüncü taraf riski | 6 | 6 | 0 | 0 |
| Bölüm VII — Bilgi paylaşımı | 1 | 1 | 0 | 0 |

## 3. Madde tablosu

| Madde | Başlık | Durum | Süreç | Kontrol | Rol |
|---|---|---|---|---|---|
| Art-05 | Yönetişim ve organizasyon | ✅ covered | PRC-RSK-01 | CTL-RSK-001 | ROL-CEO-01, ROL-CIO-01 |
| Art-06 | ICT risk yönetim çerçevesi | ✅ covered | PRC-RSK-01, PRC-RSK-02 | CTL-RSK-001, CTL-RSK-002 | ROL-CIO-01, ROL-CMP-01 |
| Art-07 | ICT sistemleri, protokoller ve araçlar | ✅ covered | PRC-RSK-03, PRC-RSK-05 | CTL-RSK-003, CTL-RSK-009 | ROL-CTO-01, ROL-RSK-01 |
| Art-08 | Tanımlama | ✅ covered | PRC-RSK-02, PRC-RSK-03 | CTL-RSK-003, CTL-RSK-004, CTL-RSK-006 | ROL-RSK-01 |
| Art-09 | Koruma ve önleme | ✅ covered | PRC-RSK-05 | CTL-RSK-007, CTL-RSK-008, CTL-RSK-009, CTL-RSK-010 | ROL-CTO-01, ROL-CMP-01 |
| Art-10 | Tespit | ✅ covered | PRC-INC-01 | CTL-INC-001 | ROL-INC-01 |
| Art-11 | İş sürekliliği politikası ve kurtarma planları | ✅ covered | PRC-RSK-04, PRC-RSK-02 | CTL-RSK-005 | ROL-CIO-01 |
| Art-12 | Yedekleme politikaları, prosedürleri ve yöntemleri | ✅ covered | PRC-RSK-04 | CTL-RSK-005, CTL-RSK-011 | ROL-CTO-01 |
| Art-13 | Öğrenme ve gelişme | ✅ covered | PRC-INC-04 | CTL-INC-006, CTL-INC-007 | ROL-CMP-01, ROL-INC-01 |
| Art-14 | İletişim | ✅ covered | PRC-INC-06 | CTL-INC-009 | ROL-CEO-01, ROL-INC-01 |
| Art-15 | Küçük kuruluşlar için basitleştirilmiş çerçeve | ✅ covered | PRC-RSK-01, PRC-RSK-04 | CTL-RSK-001 | ROL-CIO-01 |
| Art-16 | Orantılılık ilkesi | ✅ covered | PRC-RSK-01 | CTL-RSK-001 | ROL-CIO-01, ROL-CMP-01 |
| Art-17 | ICT olay yönetimi süreci | ✅ covered | PRC-INC-01, PRC-INC-02, PRC-INC-03, PRC-INC-04 | CTL-INC-001, CTL-INC-002 | ROL-INC-01 |
| Art-18 | Olay sınıflandırması | ✅ covered | PRC-INC-01 | CTL-INC-002 | ROL-INC-01, ROL-CIO-01 |
| Art-19 | Büyük olayların raporlanması | ✅ covered | PRC-INC-02, PRC-INC-03, PRC-INC-04, PRC-INC-05 | CTL-INC-003, CTL-INC-004, CTL-INC-005, CTL-INC-006, CTL-INC-008 | ROL-INC-01, ROL-CIO-01 |
| Art-20 | Raporlama şablonlarının uyumlaştırılması | ✅ covered | PRC-INC-02, PRC-INC-03, PRC-INC-04 | CTL-INC-004 | ROL-CMP-01 |
| Art-23 | Ödeme ile ilgili operasyonel/güvenlik olayları | ✅ covered | PRC-INC-02, PRC-INC-07 | CTL-INC-003, CTL-INC-010 | ROL-INC-01, ROL-CMP-01 |
| Art-24 | Dijital operasyonel dayanıklılık testi | ✅ covered | PRC-TST-01, PRC-TST-02 | CTL-TST-001, CTL-TST-002 | ROL-CTO-01, ROL-AUD-01 |
| Art-25 | Test araç ve sistemlerinin kullanımı | ✅ covered | PRC-TST-02 | CTL-TST-001, CTL-TST-003 | ROL-CTO-01 |
| Art-26 | TLPT — gelişmiş test | ✅ covered | PRC-TST-03 | CTL-TST-004 | ROL-TLPT-01 |
| Art-27 | Test eden tarafların gereklilikleri | ✅ covered | PRC-TST-02, PRC-TST-03 | CTL-TST-002 | ROL-CMP-01, ROL-AUD-01 |
| Art-28 | Üçüncü taraf ICT hizmet sağlayıcılarına ilişkin genel ilkeler | ✅ covered | PRC-TPP-01, PRC-TPP-02, PRC-TPP-04 | CTL-TPP-001, CTL-TPP-002, CTL-TPP-005 | ROL-TPP-01 |
| Art-29 | Yoğunlaşma riski | ✅ covered | PRC-TPP-02, PRC-TPP-06 | CTL-TPP-003, CTL-TPP-007 | ROL-TPP-01, ROL-CIO-01 |
| Art-30 | Sözleşmesel düzenlemelerin temel unsurları | ✅ covered | PRC-TPP-03 | CTL-TPP-004 | ROL-TPP-01, ROL-CMP-01 |
| Art-31 | Kritik tedarikçilerin (CTPP) belirlenmesi | ✅ covered | PRC-TPP-05 | CTL-TPP-006 | ROL-CTPP-01 |
| Art-33 | Gözetim çerçevesi | ✅ covered | PRC-TPP-05 | CTL-TPP-006 | ROL-CTPP-01 |
| Art-35 | Gözetim makamlarının önerileri | ✅ covered | PRC-TPP-05 | CTL-TPP-006 | ROL-CTPP-01, ROL-CMP-01 |
| Art-45 | Siber tehdit bilgisi ve istihbarat paylaşımı | ✅ covered | PRC-INF-01, PRC-INF-02 | CTL-INF-001, CTL-INF-002, CTL-INF-003 | ROL-INF-01, ROL-CMP-01 |

## 4. Kısmi ve boşluklar

| Madde | Başlık | Durum | Gerekçe |
|---|---|---|---|

---

Raporlama yükümlülükleri ve önerilen eklemeler: [RAPORLAMA-ANALIZI.md](RAPORLAMA-ANALIZI.md)

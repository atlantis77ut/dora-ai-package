# Katkı Rehberi

Paket **çift lisanslı** (AGPL-3.0 + ticari). Bu, katkı sürecinde bir şeyi zorunlu kılar:
**CLA**. Katkınızın hem açık hem ticari lisans altında sunulabilmesi için telif hakkı izni
gerekir.

---

## 1. Başlamadan

1. `docs/architecture.md` ve `docs/decisions.md` okuyun — mimari ve alınmış kararlar orada.
2. Büyük değişiklikten önce issue açın; reddedilecek işi baştan yapmayalım.
3. Veri dosyalarını (`data/`) değiştiriyorsanız ilgili şemayı da okuyun.

## 2. CLA (zorunlu)

Kod, veri veya doküman katkısı gönderen herkes **[`CLA.md`](CLA.md)** metnini kabul eder:

- Katkınızın telif hakkı **sizde kalır**, ama projeye **süresiz, dünya çapında, bedelsiz,
  alt lisanslanabilir** kullanım hakkı verirsiniz.
- Bu izin, katkınızın AGPL-3.0 **ve** ticari lisans altında dağıtılmasına imkân verir.
- CLA olmadan PR birleştirilmez — istisnası yok, çünkü tek bir imzasız katkı ticari lisansı
  hukuken sakatlar.

Kabul yöntemi: PR açıklamasına `I have read and agree to the CLA` yazmak (bireysel).
Kurumsal katkıda [`CLA.md`](CLA.md) §6 uyarınca şirket yetkilisinden e-posta onayı istenir.

## 3. Katkı kuralları

| Alan | Kural |
|---|---|
| Süreç eklemek | `data/processes/pillar-*.yaml` + en az bir `control_id` + `test_procedure` |
| Kontrol eklemek | `data/controls/controls-catalog.yaml` + zorunlu alanlar + `process_id` |
| Rol eklemek | `data/roles/roles-catalog.yaml` + `independence_constraints` + `tier_activation` |
| Yeni DORA maddesi | `data/mapping/dora-articles.yaml` + süreç/kontrol referansı |
| Doküman | `docs/`; üretilen dosyaları **elle düzenlemeyin** (kaynağı değiştirin) |
| Kod | `onboarding/cli/`; bağımlılık eklemeyin (CLI bağımlılıksız kalmalı — DR-005) |

## 4. Göndermeden önce

```bash
# 1) şema ve referans doğrulaması
node docs/tools/render-mapping.mjs --check

# 2) faz tanımı geçerli mi
cd onboarding/cli && node bin/dora-onboard.mjs phases

# 3) senaryolar ve kontroller
python ../../kaynak/validate_controls.py 2>/dev/null || true
```

Kural: **sarkan referans bırakmayın.** Bir süreç siliniyorsa ona referans veren kontrol,
sözlük maddesi, senaryo ve eşleme satırları da güncellenir.

## 5. Commit biçimi

```
<alan>: <kısa açıklama>

Örnek:
process: PRC-INC-06 gecikmiş bildirim süreci eklendi
fix: CTL-TPP-004 kontrolünde eksik alan düzeltildi
docs: DR-008 eklendi
```

## 6. Davranış

Teknik tartışma sert olabilir, kişisel olmaz. Regülatör yorumu içeren katkılarda kaynak
belirtin; doğrulanmamış mevzuat iddiası `⚠` ile işaretlenir.

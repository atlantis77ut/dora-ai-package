# Mimari

Bu belge, DORA AI Ajan Paketi'nin nasıl çalıştığını anlatır: katmanlar, veri akışı,
ajan çalışma modeli, denetim izi ve genişleme noktaları.

Son güncelleme: 2026-11-08 · Sürüm 0.4.1

---

## 1. Tek cümlelik özet

Paket, DORA'nın yükümlülüklerini **tanımlı süreçler** (YAML) üzerinden **denetlenebilir
artefaktlara** (JSON/PDF/XBRL) çeviren, bu süreçleri **yapay zeka ajanlarına** devreden ve
her adımı **geçiş kapılarıyla** doğrulayan bir referans mimarisidir.

Üç katman vardır ve üçü de birbirinden ayrı evrilebilir:

```
┌─────────────────────────────────────────────────────────────┐
│  3. ÇALIŞTIRMA KATMANI                                       │
│     Ajanlar (11 rol) + insan onay noktaları                  │
│     GOLDENHORN / CORF platformuna API ile bağlanır           │
├─────────────────────────────────────────────────────────────┤
│  2. SÜREÇ KATMANI                                            │
│     23 süreç, 35 kontrol, 5 sütun, CORF 6 fazı               │
│     Her süreç: tetikleyici → girdi → SLA → kural → kanıt     │
├─────────────────────────────────────────────────────────────┤
│  1. VERİ KATMANI                                             │
│     60 terim, 11 rol, 28 DORA maddesi, şemalar               │
│     Kaynak: YAML; doğrulama: JSON Schema                     │
└─────────────────────────────────────────────────────────────┘
```

Katman kuralı: **üst katman alt katmanı değiştiremez.** Bir ajan, tanımlı olmayan bir kanıt
üretemez; bir süreç, sözlükte olmayan bir terimi kullanamaz. Bu, denetimde "her çıktının
bir tanımı var" demenin tek yolu.

---

## 2. Veri katmanı

| Dizin | İçerik | Doğrulama |
|---|---|---|
| `schema/` | 5 JSON Schema (common, glossary, roles, processes, controls) | `ajv` / `json.loads` |
| `data/glossary/` | 60 terim, DORA/RTS/ITS referanslı | glossary.schema.json |
| `data/roles/` | 11 ajan: sorumluluk, beceri, KPI, otonomi, CORF kodları | roles.schema.json |
| `data/processes/` | 23 süreç × 5 sütun | processes.schema.json |
| `data/controls/` | 35 kontrol + kanıt şartnamesi | controls.schema.json |
| `data/mapping/` | 28 DORA maddesi → süreç/kontrol/rol | render-mapping `--check` |
| `data/corf-integration/` | ajan → CORF süreç kodu → GOLDENHORN modülü | — |

Bağlar: `süreç.control_ids` ↔ `kontrol.process_id`, `sözlük.related_roles` ↔ `roller.id`,
`madde.processes` ↔ `süreçler.id`. Her bağ iki yönlü tutulur ve doğrulama betikleri
sarkan referans bırakmadığını denetler.

**Neden YAML?** Denetçi okuyabilir, sürüm kontrolünde diff'lenebilir, ajan üretebilir.
**Neden JSON Schema?** Makine doğrulaması; yeni kurum kendi verisini aynı kapıdan geçirir.

---

## 3. Süreç katmanı

Bir süreç tanımı şu alanları taşır: `trigger`, `inputs`, `outputs` (saklama süresiyle),
`responsible_roles`, `approval_roles`, `slas`, `decision_rules`, `dependencies`,
`control_ids`, `tier_variants`.

```
Tetikleyici ──► Girdi ──► Karar kuralı ──► İnsan onayı? ──► Çıktı ──► Kanıt
   (SIEM)      (olay)     (kriter)          (rol)          (XML)    (hash)
```

**Karar kuralları** ifade diliyle yazılır (CEL/Rego hedefli, şimdilik sözleşme metni):

```yaml
- rule_id: INC-R1
  condition: "etkilenen_musteri > 100000"
  action: "olayı 'büyük' olarak sınıflandır"
  dora_ref: { article: "Madde 18(1)" }
```

**Tier varyantları** davranışı değil konfigürasyonu değiştirir: aynı kod tabanı, farklı profil.
`tier3` için süreç sayısı azalır, süreler gevşemez (bkz. DR-001).

**Kapı mantığı.** Her CORF fazı, çıktıların varlığını ve içeriğini denetleyen ölçülebilir
kriterlerle kapanır (`onboarding/corf-lifecycle.yaml`). Kriter geçilmezse sonraki faz
başlamaz — bu mimarinin en sert kuralıdır, konfigürasyonla kapatılamaz.

---

## 4. Çalıştırma katmanı (ajanlar)

### 4.1 Ajan nedir

Ajan = **rol tanımı** + **beceri listesi** + **araç erişimi** + **otonomi seviyesi**.
Kişilik değil, yetki sınırı. `roles-catalog.yaml` içindeki her rol şunları taşır:

- `responsibilities[]` — her biri DORA maddesine bağlı
- `skills[]` — `autonomy_level` ile (observe → recommend → act_with_approval → act_autonomous)
- `tools[]` — SIEM, ITSM, regulator portalı, kanıt kasası
- `human_oversight.required_for[]` — hangi kararlarda insan şart
- `independence_constraints[]` — hangi rollerden bağımsız olması gerektiği
- `corf_process_codes[]` — hangi CORF süreç kodlarını (`OR.*`) yürüttüğü

### 4.2 Üç savunma hattı kod düzeyinde

| Hat | Roller | Kural |
|---|---|---|
| 1 — Operasyon | ROL-INC-01, ROL-RSK-01 | Olayı yürütür, kanıt üretir |
| 2 — Kontrol | ROL-CIO-01, ROL-CTO-01, ROL-CMP-01, ROL-TPP-01, ROL-TLPT-01, ROL-CTPP-01, ROL-INF-01 | 1. hattı denetler; **onların raporlama hattında olamaz** |
| 3 — Denetim | ROL-AUD-01 | Doğrudan yönetim kuruluna raporlar |
| Strateji | ROL-CEO-01 | Nihai hesap verebilirlik; tek başına karar almaz |

Örnek akış: SIEM alarmı → ROL-INC-01 (PRC-INC-01 sınıflandırma) → ROL-CIO-01 onayı
→ PRC-INC-02 bildirim → ROL-CMP-01 ikinci hat doğrulaması → ROL-AUD-01 üçüncü hat denetimi.

Bağımsızlık, `agent-activation.json` içindeki dört kontrolle her kurulumda sınanır (IND-01…04).
İhlal varsa onboarding **durur** — uyarı değil, blok.

### 4.3 İnsan gözetimi

Zorunlu onay noktaları: olay sınıflandırması, regülatör bildirimi, sözleşme onayı, otonom yetki
verilmesi. `human_oversight_required: true` alanı **kapatılamaz**; kurum yalnızca *kimin*
onaylayacağını değiştirebilir.

### 4.4 Denetim izi

Her ajan kararı şu üçlüyle kaydedilir: **girdi özeti (hash) → kural kimliği → çıktı**.
Kanıtlar `hash_chain` veya `worm_storage` ile saklanır (`controls-catalog.yaml` içindeki
`evidence_spec.immutability`). Amaç: yıllar sonra "bu karar neden alındı?" sorusuna
tek kayıtla cevap verebilmek.

---

## 5. Platform entegrasyonu (GOLDENHORN / CORF)

```
   Ajan katmanı                     Platform katmanı
┌──────────────────┐            ┌──────────────────────────┐
│ INC-Ajanı        │──REST─────►│ IRM (Incident Mgmt)      │
│ RSK-Ajanı        │──REST─────►│ RRM, ITA, KIB            │
│ CTO-Ajanı        │──REST─────►│ RCM (Control Testing)    │
│ CMP-Ajanı        │──REST─────►│ RIM (Improvement)        │
└──────────────────┘            └──────────────────────────┘
        │                                    │
        └────────► KIB (bilgi tabanı) ◄──────┘
             OR.KIB.ARCH / RMDM / BSACM
```

Eşleme `data/corf-integration/agent-to-corf-mapping.yaml` içinde: her ajanın sahip olduğu
`OR.*` kodları ve kullandığı modüller. C3 fazı, sahipsiz `OR.*` kodu kalmadığını denetler.

Entegrasyon sözleşmesi henüz tanımlı değil (GOLDENHORN API'si elimizde yok). Bu yüzden
konnektörler **port/adapter** olarak modellendi: `integration-config.yaml` hangi aracın
bağlanacağını söyler, ajan yalnızca arayüze konuşur. Platform değişirse ajan kodu değişmez.

---

## 6. Sihirbaz (onboarding) mimarisi

```
dora-onboard (CLI, bağımlılıksız)
├── bin/dora-onboard.mjs      komut yönlendirme
├── src/corf/yaml.mjs         minimal YAML okuyucu
├── src/corf/lifecycle.mjs    faz yükleme + doğrulama + faz çalıştırıcıları
├── src/corf/checks.mjs       21 kapı kontrolü (çalıştırılabilir)
└── src/corf/session.mjs      oturum deposu, rollback
```

Oturum durumu: `.dora-onboarding/<id>/` altında JSON artefaktlar + `session.json`
(faz durumları, kapı sonuçları). Her faz kendi çıktısını yazar; kapı bu dosyaları denetler.
`rollback --to-phase` sonraki fazların durumunu siler — artefaktlar kalır (kanıt silinmez).

Tasarım ilkeleri: idempotent (aynı faz tekrar çalıştırılabilir), resumable (durup devam),
reversible (rollback), auditable (her kapı sonucu kayıtlı).

---

## 7. Dağıtım

```yaml
# docker-compose.yml (dökümden)
dora-onboard:      # wizard
schema-validator:  # ajv ile şema doğrulama
```

Üretimde beklenen ekler: ajan çalıştırma ortamı (mesaj kuyruğu + araç köprüsü),
kanıt deposu (WORM), MOS panosu. Paket bugün **referans mimari** olarak dağıtılır;
ajanların gerçek çalıştırıcısı kapsam dışı (bkz. §9).

---

## 8. Genişleme noktaları

| Ne eklenir | Nereye | Kural |
|---|---|---|
| Yeni ajan | `data/roles/roles-catalog.yaml` | zorunlu alanlar + bağımsızlık kısıtı |
| Yeni süreç | `data/processes/pillar-*.yaml` | en az bir `control_id` |
| Yeni kontrol | `data/controls/controls-catalog.yaml` | kanıt şartnamesi + test prosedürü |
| Yeni yargı alanı | `docs/local-equivalents-<ÜLKE>.md` + `jurisdiction-config.yaml` | süreler yalnız katılaşır |
| Yeni DORA maddesi | `data/mapping/dora-articles.yaml` | süreç/kontrol referansı zorunlu |
| Yeni faz | `onboarding/corf-lifecycle.yaml` + `checks.mjs` | her kriterin çalıştırılabilir karşılığı |

---

## 9. Bilinçli sınırlar

1. **Ajan çalıştırıcısı yok.** Paket rolleri, süreçleri ve kapıları tanımlar; LLM orkestrasyonu
   (araç çağırma, hafıza, kuyruk) kapsam dışı. `autonomy_level` alanları bu katmanın sözleşmesidir.
2. **GOLDENHORN API'si yok.** Konnektörler port/adapter olarak soyutlandı; gerçek endpoint'ler
   geldiğinde `integration-config.yaml` şeması netleşecek.
3. **İki DORA boşluğu açık.** Madde 9 (erişim/şifreleme) ve Madde 14 (kriz iletişimi) —
   gerekçeleri `docs/dora-mapping.md` içinde.
4. **Yerel mevzuat teyidi bekliyor.** `local-equivalents-TR.md` içindeki `⚠` satırları
   hukuk/uyum onayı gerektirir.
5. **Kod testleri yok.** Bugün doğrulama betiklerle yapılıyor (referans bütünlüğü, kapı
   mantığı); birim testleri (`tests/*.test.js`) henüz yazılmadı.

---

## 10. Kararlar

Mimarinin arkasındaki kararlar `docs/decisions.md` içinde: DR-001 (4 saat), DR-002 (ID kodu),
DR-003 (şema gevşetmeleri), DR-004 (TR'de pasif süreçler), DR-005 (bağımlılıksız CLI),
DR-006 (üretilen eşleme).

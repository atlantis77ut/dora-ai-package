# Sentetik Senaryolar — Kabul Testleri

Bu klasör, CORF **C4 (Scenario tests)** fazının çalıştırdığı kabul senaryolarını içerir.
`onboarding/corf-lifecycle.yaml` içindeki C4 geçiş kapısı bu senaryoların sonuçlarına bakar.

| Dosya | ID | Ne sınar | Assertion |
|---|---|---|---|
| `scenario-major-incident.yaml` | SCN-01 | Sınıflandırma + 4 saat bildirim zinciri + insan onayı | 8 |
| `scenario-provider-exit.yaml` | SCN-02 | CTPP çıkışı, veri iadesi, RoI güncellemesi | 7 |
| `scenario-regulator-request.yaml` | SCN-03 | 24 saatte kanıt paketi, maskeleme, denetim izi | 6 |

Fixture'lar `fixtures/` altında: senaryonun "verilen" durumunu temsil eden ham veri.

---

## Senaryo formatı

```yaml
scenario:
  id: SCN-NN
  name: { tr, en }
  purpose: "ne ölçülüyor"
  severity: critical | high | medium
  tier_scope: [tier1, tier2, tier3]
  assertions_total: 8            # aşağıdaki assertions sayısıyla eşleşmeli
  pass_threshold: "8/8"

  processes_exercised: [PRC-...]
  controls_checked: [CTL-...]
  roles_exercised: [ROL-...]

given:      # fixture + başlangıç durumu
when:       # tetikleyici, ajan otonomi seviyesi
then:
  assertions:
    - id: A1
      statement: "ne bekleniyor"
      expected: "ölçülebilir sonuç"
      process: PRC-...
      control: CTL-...
      deadline_minutes: 240      # veya deadline_hours / deadline_days
      fail_if: "başarısızlık koşulu"
negative_tests:   # ajanın yapmaması gerekenler (tuzaklar)
timeline:         # beklenen olay sırası
evidence_expected: # üretilmesi gereken kanıt dosyaları
```

### Kural: `deadline` alanları

| Süre | Birim | Örnek |
|---|---|---|
| 15 dakika | `deadline_minutes: 15` | sınıflandırma |
| 4 saat | `deadline_minutes: 240` | ilk bildirim (DORA) |
| 72 saat | `deadline_minutes: 4320` | ara rapor |
| 1 ay | `deadline_minutes: 44640` | nihai rapor |
| gün | `deadline_days: 10` | çıkış planı taslağı |

---

## Nasıl çalıştırılır

**Bugün (elle / yarı otomatik):** senaryo dosyası açılır, `given` fixture'ı test ortamına yüklenir,
`when` tetiklenir, ajan çıktıları `then.assertions` ile tek tek karşılaştırılır. Sonuç
`scenario-results.json` olarak kaydedilir (C4 kapısı bunu okur).

**Hedef (otomatik):** her assertion, ajan çalıştırıcısından dönen olay günlüğü üzerinde
makine tarafından değerlendirilir. Değerlendirme için gereken alanlar assertion içinde
zaten tanımlı: `process`, `control`, `deadline`, `fail_if`.

Kapı kuralı (`corf-lifecycle.yaml` → C4):

- `pass_threshold` karşılanmazsa faz **geçilmez**.
- `negative_tests`'ten biri tetiklenirse, assertion'lar geçse bile senaryo **başarısız** sayılır —
  yanlış gerekçeyle doğru sonuca ulaşmak kabul edilmez.

---

## Bakım

- Bir süreç değiştiğinde ilgili senaryonun `processes_exercised` ve `assertions[].process` alanları güncellenmeli.
- Kontrol kataloğuna yeni kontrol eklendiğinde `controls_checked` listesine eklenmeli; silinen kontrol
  senaryoda referans bırakmamalı (doğrulama betiği bunu denetler).
- Yeni senaryo eklenirse `assertions_total` ve `pass_threshold` birlikte güncellenir.

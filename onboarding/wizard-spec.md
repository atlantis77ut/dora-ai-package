# Onboarding Wizard — CORF 6 Fazına Göre Yeniden Tasarım

Bu belge, eski **8 adımlı sihirbazı** TACAS CORF'un **6 fazlı uygulama yaşam döngüsüne** taşıyan tasarımı açıklar.
Makine tarafından okunabilir tanım: [`corf-lifecycle.yaml`](corf-lifecycle.yaml).

---

## 1. Neden değişti

Eski wizard teknik bir kurulum akışıydı: lisans → profil → envanter → ajan → SLA → entegrasyon → kabul → canlı.
CORF ise yönetişim dilinde konuşuyor: **hizmeti tanımla, toleransı koy, kaynağı haritala, senaryoyla sına, öz değerlendirme yap, işletim sistemine geç.**

Fark, sıralamada değil **kapılarda**: eski akışta "adım tamamlandı" yeterliydi; yeni akışta bir sonraki faza geçmek için ölçülebilir kanıt gerekiyor (`exit_gate.criteria`). Kapı geçilmezse wizard ilerlemez — bu, denetimde "kurulum yapıldı" demenin kanıtı olur.

---

## 2. Altı faz ve eski adımların eşleşmesi

| CORF fazı | Eski adımlar | Ajanların rolü | Çıktı |
|---|---|---|---|
| **C1 — Identify** | 0, 1, 2 | İzler (observe) | `business-service-catalogue.yaml`, profil, jurisdiction |
| **C2 — Set tolerances** | 5 | İzler | `impact-tolerances.yaml`, `risk-appetite.yaml`, `sla-overrides.yaml` |
| **C3 — Map resources** | 3, 4, 6 | İzler + önerir | `ict-inventory.yaml`, `agent-activation.yaml`, `integration-config.yaml` |
| **C4 — Scenario tests** | 7 | Önerir (recommend) | `scenario-results.json`, `acceptance-report.pdf` |
| **C5 — Self-assessment** | — *(yeni)* | Önerir | `coverage-matrix.yaml`, `gap-analysis.pdf` |
| **C6 — Implement MOS** | 8 | Onaylı icra → otonom | `autonomy-grant.yaml`, `go-live-certificate.json` |

**Eklenen faz:** C5 (öz değerlendirme). Eski akışta kabul testi vardı ama "DORA maddelerinin ne kadarını kapsıyoruz" sorusu hiç sorulmuyordu. C5 bu boşluğu kapatıyor.

**Birleşen adımlar:** eski 2 (yargı alanı) C1'e, eski 6 (entegrasyon) C3'e taşındı — çünkü regülatör kanalı bir "kimlik" bilgisi, entegrasyon ise bir "kaynak" bilgisi.

---

## 3. Ajan "eğitimi" = otonomi merdiveni

Ajanlar kurulumda eğitilmez; **yetkilendirilir**. Aynı ajan pakette dört seviyede çalışabilir:

| Seviye | Anlamı | Hangi fazda |
|---|---|---|
| `observe` | Yalnız izler, kaydeder; çıktısı kullanılmaz | C1–C2 |
| `recommend` | Öneri üretir, insan karar verir | C3–C4 |
| `act_with_approval` | İcra eder, kritik adımda onay ister | C5–C6 |
| `act_autonomous` | Onaylı sınırlar içinde otonom | C6 (yalnız düşük etkili işler) |

Bu, `roles-catalog.yaml` içindeki `skills[].autonomy_level` alanının faz karşılığıdır. Ajanın yeteneği değişmez; **yetkisi** faz ilerledikçe açılır.

Otonom yetki verilen roller (C6 varsayılanı): `ROL-RSK-01`, `ROL-INF-01`, `ROL-TLPT-01` — üçü de geri alınabilir, düşük etkili işler yapar.
Onay zorunlu kalanlar: `ROL-INC-01` (bildirim), `ROL-CIO-01` (çerçeve), `ROL-TPP-01` (sözleşme), `ROL-CMP-01` (uyum), `ROL-CTO-01` (test programı).

---

## 4. Kapı mantığı (gate)

Her fazın `exit_gate.criteria` listesi makine tarafından denetlenebilir ifadelerdir. Wizard her fazın sonunda:

1. Kriterleri değerlendirir (`pass` / `fail` / `waived`).
2. `fail` varsa **sonraki fazı başlatmaz**; eksik kanıtı listeler.
3. `waived` yalnızca yetkili rolle ve gerekçeyle kabul edilir (`waiver: { by, reason, until }`) — kayıt denetim izine gider.
4. Faz çıktılarını `snapshot/` altına alır (rollback için).

Örnek kapı kararları:

- C3: dört bağımsızlık kuralından biri `fail` ise **waiver kabul edilmez** — mimari hata, düzeltilmesi gerekir.
- C4: sınıflandırma doğruluğu %95 altındaysa **waiver edilebilir** ama `until` tarihi zorunlu ve yönetim kurulu bilgilendirmesi eklenir.
- C5: yüksek önem dereceli boşluk varsa waiver yok; kabul edilmiş risk kaydı (`risk-acceptance`) gerekir.

---

## 4.5. Uygulama durumu (2026-11-03)

Bu tasarım kâğıtta kalmadı: `onboarding/cli/bin/dora-onboard.mjs` içinde **çalışan, bağımlılıksız** bir CLI var.
`npm install` gerekmiyor — kendi mini YAML okuyucusu (`src/corf/yaml.mjs`) `corf-lifecycle.yaml`'ı doğrudan okur.

| Dosya | İş |
|---|---|
| `bin/dora-onboard.mjs` | Komutlar: `init`, `phase`, `gate`, `status`, `phases`, `rollback` |
| `src/corf/yaml.mjs` | Minimal YAML okuyucu (eşleme, liste, akış eşleme, blok skaler) |
| `src/corf/lifecycle.mjs` | Faz tanımını yükler, doğrular, faz çalıştırıcılarını barındırır |
| `src/corf/checks.mjs` | `exit_gate.criteria` metinlerinin **çalıştırılabilir** karşılıkları (21 kontrol) |
| `src/corf/session.mjs` | Oturum deposu (`.dora-onboarding/<id>/`), rollback |

Çalıştırma:

```bash
node bin/dora-onboard.mjs phases                      # 6 faz, kapı sayıları, süreler
node bin/dora-onboard.mjs init --tier tier2 --regulator BDDK
node bin/dora-onboard.mjs phase C1 --session ob-2026-xxxxx --demo
node bin/dora-onboard.mjs gate C1 --session ob-2026-xxxxx    # geçmezse çıkış kodu 2
node bin/dora-onboard.mjs status --session ob-2026-xxxxx
```

Kapı geçilmezse süreç **çıkış kodu 2** ile durur ve sonraki fazın başlatılması engellenir — tasarımdaki "kapı geçilmeden ilerleme yok" kuralı kodda uygulanır.

---
## 5. CLI akışı

```
dora-onboard init --tier=tier2 --regulator=BDDK --corf
dora-onboard phase C1 --session ob-2026-0001
dora-onboard gate  C1 --session ob-2026-0001       # kapıyı değerlendirir, geçmezse çıkış kodu 2
dora-onboard phase C2 --session ob-2026-0001
...
dora-onboard status ob-2026-0001                    # faz + kapı durumu tablosu
dora-onboard rollback --session ob-2026-0001 --to-phase C3
dora-onboard validate --session ob-2026-0001        # şemalara karşı tüm çıktılar
```

`--corf` bayrağı olmadan eski 8 adımlı akış çalışmaya devam eder (geriye dönük uyumluluk); yeni kurulumlarda varsayılan CORF modudur.

Oturum dosyası artık faz bazlı:

```yaml
session_id: ob-2026-0001
mode: corf
tier: tier2
current_phase: C3
phases:
  C1: { status: completed, gate: pass, at: 2026-11-04T10:12:00Z }
  C2: { status: completed, gate: pass, at: 2026-11-12T14:03:00Z }
  C3: { status: in_progress, gate: pending }
```

---

## 6. Ölçek uyarlaması (Madde 16 orantılılık)

| Faz | Tier 1 | Tier 2 | Tier 3 |
|---|---|---|---|
| C1 | Tam BSC, tüm hizmetler | Tam BSC | Yalnız kritik hizmetler (en fazla 20) |
| C2 | Hizmet bazında RTO/RPO + ekonomik model | Hizmet bazında | İşlev bazında tek set |
| C3 | Tam envanter + CTPP + tüm konnektörler | Tam envanter + SIEM/ITSM | CSV içe aktarma yeterli |
| C4 | 3 senaryo + TLPT provası | 3 senaryo | 1 senaryo (SCN-01) |
| C5 | Tam kapsama matrisi + bağımsız doğrulama | Kapsama matrisi | 5 sütun anketi |
| C6 | Gölge → yarı → otonom | Gölge → yarı | Gölge → yarı (otonom opsiyonel) |

Tier 3'te C4 ve C5 birleştirilip tek "kabul" fazı olarak çalıştırılabilir; `corf-lifecycle.yaml` içinde `tier_variants` bunu not eder.

---

## 7. CORF eşleştirmesiyle bağ

`data/corf-integration/agent-to-corf-mapping.yaml` her ajanın hangi CORF süreç kodunu (`OR.*`) yürüttüğünü ve hangi GOLDENHORN modülünü kullandığını tanımlar. Bu dosya artık **C3 fazında** doğrulanır:

- Her `OR.*` kodu en az bir aktive ajan tarafından sahiplenilmiş olmalı.
- Her GOLDENHORN modülünün en az bir ajan bağlantısı olmalı.
- Sahipsiz süreç kodu varsa C3 kapısı `fail` verir.

Bu doğrulama, "kâğıt üzerinde eşleştirme var ama işleyen sahibi yok" durumunu yakalar.

---

## 8. Açık noktalar

1. **TACAS CORF süreç kodlarının tam listesi** elimizde yalnızca konuşmada geçen 22 kod kadar (Govern/Plan/Conduct/Protect/Detect/Respond/Recover/Improve + KIB). Gerçek CORF dokümanındaki tam liste alınırsa `agent-to-corf-mapping.yaml` genişletilmeli.
2. **GOLDENHORN API sözleşmesi** yok — C3'teki konnektörler şimdilik SIEM/ITSM/GRC/CMDB varsayımıyla tanımlı; gerçek endpoint'ler gelince `integration-config.yaml` şeması netleşir.
3. **C5 kapsama matrisi** için DORA madde listesinin makine okunur hâli gerekiyor (Modül 6'da `docs/dora-mapping.md` ile gelecek).

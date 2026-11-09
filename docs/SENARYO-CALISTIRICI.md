# Senaryo Çalıştırıcısı

Sürüm 1.1.0 · 9 Kasım 2026 · ustauretim

Kabul senaryolarındaki assertion'ları oturum artefaktları üzerinde **deterministik** olarak
değerlendirir. Doğal dil yorumlamaz: assertion'da `check` bloğu varsa çalıştırır, yoksa
"manuel" sayar. Böylece "senaryo yazdık" ile "senaryoyu koştuk" arasındaki fark kapanır.

~~~bash
node bin/dora-onboard.mjs scenario --session ob-2026-xxxxx --file tests/synthetic-scenarios/scenario-security-controls.yaml
node bin/dora-onboard.mjs scenario --session ob-2026-xxxxx --all
~~~

Çıkış kodu: **0** çalıştırılabilir assertion'ların tümü geçti · **2** en az biri başarısız · **1** hata.

---

## 1. Assertion durumları

| Durum | Anlam |
|---|---|
| pass | check çalıştı ve koşul sağlandı |
| fail | check çalıştı, koşul sağlanmadı (gerekçe yazılır) |
| manual | check tanımlı değil; insan değerlendirmesi gerekir |

Sonuç, oturum dizinine `scenario-<id>-results.json` olarak yazılır ve kanıt paketine (export) girer.

---

## 2. check sözdizimi

~~~yaml
check:
  file: access-review-record.json
  path: dormant_accounts_closed
  eq: 12
~~~

| Anahtar | Anlam |
|---|---|
| file | Oturum dizinindeki dosya (json, yaml veya düz metin) |
| path | Nokta ile ayrılmış alan yolu (`zones.DMZ-01.default_deny`) |
| exists | Alan var mı (true/false) |
| eq / ne | Eşit / eşit değil |
| gte / lte | Sayısal alt/üst sınır |
| truthy | Boolean doğruluk |
| contains | Dizide öğe veya metinde alt dize |

Bileşik kontroller:

~~~yaml
check:
  all_of:
    - { file: crypto-inventory.yaml, path: assets.AST-001.in_transit, eq: false }
    - { file: crypto-inventory.yaml, path: assets.AST-001.remediation_due_days, lte: 30 }

check:
  any_of:
    - { file: vulnerability-closure.json, path: closed_at, exists: true }
    - { file: vulnerability-closure.json, path: exception_ref, exists: true }
~~~

---

## 3. Bugünkü kapsam

| Senaryo | Assertion | Çalıştırılabilir |
|---|---:|---:|
| SCN-01 Büyük olay | 8 | 0 (manuel) |
| SCN-02 Tedarikçi çıkışı | 7 | 0 (manuel) |
| SCN-03 Regülatör talebi | 6 | 0 (manuel) |
| SCN-04 Siber kontroller | 6 | **6** |

SCN-04 pilot olarak tam bağlandı: erişim, şifreleme, segmentasyon, zafiyet kapatma ve olay
kaydı kontrolleri. Kalan 21 assertion için check yazımı sürüyor — bu bilinçli: her check,
senaryonun gerçekten ölçtüğü şeyi netleştirmeyi gerektiriyor.

---

## 4. Sınırlar

- **Doğal dil yorumu yok.** "statement" alanı insan içindir; makine yalnızca `check` çalıştırır.
- **Zaman kontrolü yok.** `deadline_days` / `deadline_minutes` bilgi olarak durur; SLA ihlali
  ölçümü ayrı bir iş (zaman damgaları gerektirir).
- **Kısmi yeşil.** Manuel assertion'lar başarısızlık sayılmaz; raporda ayrı sayılır. "Tümü geçti"
  ifadesi yalnızca çalıştırılabilir assertion'lar için geçerlidir.

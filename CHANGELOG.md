# Changelog

Bu dosya, paketin sÃ¼rÃ¼m geÃ§miÅŸini tutar. BiÃ§im: [Keep a Changelog](https://keepachangelog.com/tr/1.1.0/),
sÃ¼rÃ¼mleme: [SemVer](https://semver.org/lang/tr/).

---

## [1.9.0] â€” 2026-11-09

### DÃ¼zeltildi â€” oturum ve menÃ¼

- **Parola deÄŸiÅŸince eski oturumlar geÃ§ersiz**: token'a parola sÃ¼rÃ¼mÃ¼ (`pv`) eklendi; parola
  deÄŸiÅŸtirme/sÄ±fÄ±rlama sonrasÄ± eski Ã§erez 401 dÃ¶ner
- **CSRF korumasÄ±**: yazma istekleri `X-Dora-CSRF: 1` baÅŸlÄ±ÄŸÄ± taÅŸÄ±mak zorunda (403 aksi hÃ¢lde)
- **Ã‡erez**: `Secure` bayraÄŸÄ± HTTPS arkasÄ±nda otomatik eklenir; bozuk Ã§erez artÄ±k isteÄŸi dÃ¼ÅŸÃ¼rmez
- **Oturum sÃ¼resi gÃ¶rÃ¼nÃ¼r**: baÅŸlÄ±kta kalan dakika; "oturumu uzat" (`POST /api/auth/refresh`)
- **Aktif oturum seÃ§imi**: birden fazla oturum varsa yÃ¶netici seÃ§ebilir (`POST /api/sessions/active`)
- **MenÃ¼**:
  - navigasyon bir kez kuruluyor, her tÄ±klamada yeniden Ã§izilmiyor (Ã§ift tetiklenme gitti)
  - "Teknik panel" yalnÄ±z yÃ¶neticide ve **aynÄ± sekmede** aÃ§Ä±lÄ±yor (fazladan sekme yok)
  - "Kurulumu baÅŸlat" dÃ¼ÄŸmesi tÃ¼m sayfalarda Ã§alÄ±ÅŸÄ±yor (delegasyon)
  - giriÅŸ sonrasÄ± hash korunuyor, gereksiz yeniden yÃ¶nlendirme yok

### DoÄŸrulama (gerÃ§ek HTTP)

```
CSRF'siz yazma                 â†’ 403
CSRF'li yazma                  â†’ 200
parola sÄ±fÄ±rlama sonrasÄ± me    â†’ 401  (eski oturum geÃ§ersiz)
yeni parolayla giriÅŸ           â†’ 200
oturum sÃ¼resi 4 saat           â†’ 200
refresh                        â†’ 200
aktif oturum seÃ§imi            â†’ 200, state doÄŸruladÄ±
```

---

## [1.8.0] â€” 2026-11-09

### Eklendi

**Parola yÃ¶netimi**
- KullanÄ±cÄ± kendi parolasÄ±nÄ± deÄŸiÅŸtirir: `POST /api/auth/password` (mevcut parola doÄŸrulanÄ±r)
- YÃ¶netici, kullanÄ±cÄ± satÄ±rÄ±ndan **parola sÄ±fÄ±rlar** (`PATCH /api/users/:id`), iÅŸlem kaydÄ±na yazÄ±lÄ±r
- ArayÃ¼zde "ParolamÄ± deÄŸiÅŸtir" sayfasÄ±

**Oturum gÃ¼venliÄŸi**
- Oturum sÃ¼resi ayarlanabilir (`/api/settings/session`, 1-168 saat); giriÅŸ anÄ±nda uygulanÄ±r
- HatalÄ± giriÅŸ sÄ±nÄ±rÄ±: 5 baÅŸarÄ±sÄ±z denemeden sonra 60 saniye kilit (bellekte), denemeler
  `audit.log`'a `login_failed` olarak dÃ¼ÅŸer

**Kurulum sihirbazÄ± (arayÃ¼z)**
- `#kurulum` sayfasÄ±: hizmet listesi (ad, sahip, kritiklik) â†’ `business-service-catalogue.json`
- Kesinti toleranslarÄ± (MTD/RTO/RPO + yÄ±llÄ±k kesinti sÄ±nÄ±rÄ±) â†’ `impact-tolerances.json` +
  `risk-appetite.json`
- AltÄ± adÄ±m iÃ§in **"adÄ±mÄ± denetle"** dÃ¼ÄŸmeleri: `POST /api/sessions/:id/gate/:phase` gerÃ§ek
  `evaluatePhase()` Ã§alÄ±ÅŸtÄ±rÄ±r, sonuÃ§larÄ± dÃ¶ner ve faz durumunu gÃ¼nceller
- KullanÄ±cÄ± rolÃ¼nde denetim sonuÃ§larÄ± yalnÄ±z aÃ§Ä±klama metniyle gÃ¶sterilir (kriter kodlarÄ± gizli)

### DÃ¼zeltildi

- `web-data/` Ã§alÄ±ÅŸma anÄ±nda silinirse kullanÄ±cÄ± kaydÄ± hata veriyordu; yazma Ã¶ncesi dizin
  oluÅŸturuluyor (`auth.mjs`)

---

## [1.7.0] â€” 2026-11-09

### Eklendi â€” kimlik doÄŸrulama ve yetkilendirme

- `src/orl/auth.mjs`: scrypt parola Ã¶zeti, HMAC imzalÄ± oturum Ã§erezi (8 saat, HttpOnly,
  SameSite=Lax), kullanÄ±cÄ± deposu, iÅŸlem kaydÄ±
- Ä°lk kurulum: kullanÄ±cÄ± yoksa `/api/auth/bootstrap` ile **ilk yÃ¶netici** oluÅŸturulur
  (ikinci Ã§aÄŸrÄ± 400 dÃ¶ner)
- UÃ§lar: `/api/auth/{status,bootstrap,login,logout,me}`, `/api/users` (GET/POST/PATCH/DELETE),
  `/api/audit`
- **Roller**:
  - `admin` â†’ teknik her ÅŸey: sÃ¼reÃ§/kontrol sayaÃ§larÄ±, `/dashboard/` rapor panosu, kanÄ±t JSON'larÄ±,
    kullanÄ±cÄ± yÃ¶netimi, iÅŸlem kaydÄ±
  - `user` â†’ yalnÄ±z iÅŸ arayÃ¼zÃ¼: Durum, Kurum bilgileri, Sistem baÄŸlantÄ±larÄ±, VarlÄ±klarÄ±m,
    Sorumlular, Belgeler. Teknik terim, sÃ¼reÃ§ kodu ve JSON gÃ¶rÃ¼nmez.
- Statik kapÄ±lar: `/dashboard/`, `/site/`, `/docs/` yalnÄ±z yÃ¶netici (aksi hÃ¢lde `/app/#giris`'e 302)
- ArayÃ¼zde giriÅŸ/Ã§Ä±kÄ±ÅŸ, kullanÄ±cÄ± ekleme, rol rozeti; kullanÄ±cÄ± sayfalarÄ±nda sadeleÅŸtirilmiÅŸ dil
  ("AdÄ±m 1 Â· Hizmetlerin belirlenmesi", "VarlÄ±klarÄ±m" gibi)

### DeÄŸiÅŸti

- Demo verileri temizlendi: `web-data/` ve `.dora-onboarding/` silindi; kurulum
  **ilk yÃ¶netici oluÅŸturma ekranÄ±yla** baÅŸlÄ±yor
- `web-data/users.json`, `secret.key`, `audit.log` 0600 izniyle yazÄ±lÄ±r

### GÃ¼venlik notlarÄ±

- `/api/*` artÄ±k oturum ister; yÃ¶netici uÃ§larÄ± ayrÄ±ca rol kontrolÃ¼nden geÃ§er
- Ã‡erez `HttpOnly` â€” JavaScript okuyamaz; oturum sÃ¼resi 8 saat
- Tek kullanÄ±cÄ±/yerel varsayÄ±mÄ± sÃ¼rÃ¼yor: sunucu `127.0.0.1`; aÄŸa aÃ§Ä±lacaksa TLS + ters vekil
  Ã¶nerilir

---

## [1.6.0] â€” 2026-11-09

### Eklendi â€” uygulama arayÃ¼zÃ¼ (veri giriÅŸi)

Paket artÄ±k yalnÄ±zca rapor deÄŸil, **dÃ¼zenlenebilir bir uygulama**: kurum kendi verisini tarayÄ±cÄ±dan
girer, API baÄŸlantÄ±larÄ±nÄ± tanÄ±mlar, ajanlarÄ± aktive eder.

- `app/` â€” baÄŸÄ±mlÄ±lÄ±ksÄ±z tek sayfa uygulama (`index.html`, `app.css`, `app.js`, ES modÃ¼lÃ¼)
  - **Genel bakÄ±ÅŸ**: KPI'lar, faz durumu, oturum listesi, hÄ±zlÄ± iÅŸlemler
  - **Kurum profili**: ad, tier, regÃ¼latÃ¶r, yargÄ± alanÄ±, lisanslar â†’ `web-data/settings.json`
  - **Entegrasyonlar**: SIEM/ITSM/GRC/CMDB iÃ§in Ã¼rÃ¼n, endpoint, kimlik doÄŸrulama, token;
    "BaÄŸlantÄ±yÄ± test et" gerÃ§ek HTTP denemesi yapar (5 sn zaman aÅŸÄ±mÄ±)
  - **Envanter**: CSV yapÄ±ÅŸtÄ±r â†’ `ict-inventory.json` (kritiklik, tedarikÃ§i, Ã¶zet sayÄ±m)
  - **Ajanlar**: 11 rol iÃ§in aktivasyon + insan muadili â†’ `agent-activation.json` + baÄŸÄ±msÄ±zlÄ±k kaydÄ±
  - **KanÄ±tlar**: oturum artefaktlarÄ±nÄ± listeler ve JSON olarak gÃ¶sterir
- `tools/server.mjs`: statik sunum + JSON API (`/api/state`, `/api/institution`,
  `/api/integrations/:id`, `/api/sessions`, `/api/sessions/:id/artifacts|agents|inventory`,
  `/api/catalog/roles`, `/api/lifecycle`)
- API anahtarlarÄ± `web-data/secrets.json` iÃ§inde, `0600`; arayÃ¼ze **geri dÃ¶nmez**, yalnÄ±zca
  `has_token: true/false` gÃ¶rÃ¼nÃ¼r
- `serve.cmd` artÄ±k uygulama sunucusunu aÃ§ar (`/app/`); systemd unit'i `ReadWritePaths` ile
  `web-data` ve `.dora-onboarding` dizinlerine yazma izni verir

### GÃ¼venlik

- `web-data/` `.gitignore`'a eklendi (anahtarlar depoya girmesin)
- Sunucu varsayÄ±lan olarak `127.0.0.1` dinler; aÄŸa aÃ§mak bilinÃ§li bir tercih
- `/api/*` kimlik doÄŸrulamasÄ± iÃ§ermez â€” yerel/tek kullanÄ±cÄ± varsayÄ±mÄ±; aÄŸa aÃ§Ä±lacaksa ters
  vekil arkasÄ±nda kimlik doÄŸrulama gerekir (dokÃ¼manda not)

---

## [1.5.0] â€” 2026-11-09

### Eklendi â€” dashboard'da tam gÃ¶rÃ¼nÃ¼m

DÃ¶rt yeni sayfa; paketin tamamÄ± tarayÄ±cÄ±dan okunabilir:

| Sayfa | Ä°Ã§erik |
|---|---|
| `dashboard/roles.html` | 11 ajan: amaÃ§, raporlama, sorumluluklar (DORA maddesiyle), beceriler + otonomi, insan gÃ¶zetimi, sÃ¼reÃ§ kodlarÄ±, tier |
| `dashboard/glossary.html` | 60 terim: tanÄ±m (DORA alÄ±ntÄ±sÄ±), kaynak, sÄ±nÄ±flandÄ±rma kriterleri, ilgili rol/sÃ¼reÃ§ler |
| `dashboard/mapping.html` | 28 DORA maddesi: yÃ¼kÃ¼mlÃ¼lÃ¼kler, sÃ¼reÃ§ler, kontroller, sahipler, kapsama durumu |
| `dashboard/sources.html` | **Veri nereden girilir**: tanÄ±m dosyalarÄ±, oturum komutlarÄ±, dÃ¼zenleâ†’yayÄ±nla dÃ¶ngÃ¼sÃ¼, klasÃ¶r haritasÄ± |

Navigasyon yedi sekmeye Ã§Ä±ktÄ±; sayfalar yine YAML'den Ã¼retiliyor, elle dÃ¼zenlenmiyor.

---

## [1.4.2] â€” 2026-11-09

### Eklendi

- `scripts/serve.cmd`: Windows'ta Ã§ift tÄ±kla Ã§alÄ±ÅŸtÄ±rma. Node'u PATH'te arar, yoksa DSH ile gelen
  Ã§alÄ±ÅŸma zamanÄ±nÄ± kullanÄ±r; sunucuyu `127.0.0.1:8080` Ã¼zerinde baÅŸlatÄ±r ve tarayÄ±cÄ±yÄ± aÃ§ar.
  Port parametresi: `serve.cmd 8081`.

### Notlar

- Yerel kullanÄ±m (tek makine) iÃ§in `--host 127.0.0.1`; aÄŸdaki baÅŸka cihazlardan eriÅŸim iÃ§in
  `serve.mjs --host 0.0.0.0` ve gÃ¼venlik duvarÄ± kuralÄ± gerekir.

---

## [1.4.1] â€” 2026-11-09

### Eklendi â€” sunucu kurulumu ve genel test

- `onboarding/cli/tools/serve.mjs`: baÄŸÄ±mlÄ±lÄ±ksÄ±z statik sunucu. `/` yÃ¶nlendirme, `/dashboard/`,
  `/site/`, `/healthz`; yol dÄ±ÅŸÄ±na Ã§Ä±kma engelli; `--port` / `--host`.
- `scripts/smoke-test.sh`: 8 adÄ±mlÄ± genel test (ÅŸema, kural motoru, 6 faz, 27 senaryo,
  kanÄ±t paketi, veri alÄ±mÄ±, DORA eÅŸlemesi, dashboard+site Ã¼retimi). Ã‡Ä±kÄ±ÅŸ kodu 0/1.
- `scripts/install-ubuntu.sh`: Ã¶n koÅŸul kontrolÃ¼, klonlama veya offline kopyalama, test,
  isteÄŸe baÄŸlÄ± systemd kurulumu (`--service`), port seÃ§imi.
- `deploy/dora-ai-package.service`: systemd unit'i (ayrÄ± kullanÄ±cÄ±, `ProtectSystem=strict`,
  `MemoryMax=256M`).
- `docs/KURULUM-UBUNTU.md`: gereksinimler, sunucu seÃ§imi, nginx arkasÄ±na alma, offline kurulum,
  sorun giderme.

### Notlar

- Paket **GPU kullanmaz**, `npm install` gerektirmez, dÄ±ÅŸ CDN'e baÄŸlanmaz â€” kapalÄ± aÄŸda Ã§alÄ±ÅŸÄ±r.
- `install-ubuntu.sh` ve `smoke-test.sh` bu geliÅŸtirme ortamÄ±nda Ã§alÄ±ÅŸtÄ±rÄ±lamadÄ± (sandbox bash
  sÃ¼recini engelliyor); satÄ±r sonlarÄ± LF doÄŸrulandÄ±, ilk Ã§alÄ±ÅŸtÄ±rma sunucuda yapÄ±lacak.

---

## [1.4.0] â€” 2026-11-09

### Eklendi â€” kural motoru

SÃ¼reÃ§lerdeki 49 `decision_rules[].condition` ifadesi artÄ±k **Ã§alÄ±ÅŸtÄ±rÄ±labilir**.

- `src/orl/rules.mjs`: kÃ¼Ã§Ã¼k ifade dili (karÅŸÄ±laÅŸtÄ±rma, AND/OR/NOT, `IN`, parantez, birim
  sÃ¶zcÃ¼kleri, `%30`, noktalÄ± alan yolu). Desteklenmeyen sÃ¶zdizimi `parse_error` dÃ¶ner â€”
  sessizce yanlÄ±ÅŸ sonuÃ§ Ã¼retmez.
- `src/orl/facts.mjs`: kanÄ±t â†’ olgu adaptÃ¶rÃ¼. TÃ¼rkÃ§e kural alanlarÄ± (`etkilenen_musteri`) ile
  Ä°ngilizce kanÄ±t alanlarÄ± (`affected_customers`) arasÄ±ndaki eÅŸleme aÃ§Ä±k tabloyla tanÄ±mlÄ±.
- CLI: `rules --audit` Â· `rules --session <id> [--process PRC-â€¦] [--facts olgular.json]`;
  sonuÃ§ `<oturum>/rule-evaluation.json` dosyasÄ±na yazÄ±lÄ±r.
- `tools/demo-rules.mjs` + CI adÄ±mÄ±: 49/49 sÃ¶zdizimi, SCN-01 olgularÄ±yla doÄŸru tetikleme,
  eksik olgu ve bozuk ifade davranÄ±ÅŸÄ±.
- `docs/KURAL-MOTORU.md`: sÃ¶z dizimi, adaptÃ¶r tablosu, sÄ±nÄ±rlar.

### DavranÄ±ÅŸ

- Eksik olgu â†’ kural **tetiklenmez**, alan `missing` olarak raporlanÄ±r.
- `INC-R1` ve `INC-R3`, SCN-01 golden kanÄ±tlarÄ±ndan Ã¼retilen olgularla tetikleniyor;
  `INC-R2`, `INC-R4`, `INC-R5` doÄŸru ÅŸekilde tetiklenmiyor.
- SÃ¼rÃ¼m 1.4.0.

---

## [1.3.0] â€” 2026-11-09

### DeÄŸiÅŸti â€” kÄ±rÄ±cÄ±: Ã§erÃ§eve adÄ± ORL olarak yeniden adlandÄ±rÄ±ldÄ±

ÃœÃ§Ã¼ncÃ¼ taraf Ã§erÃ§evenin kÄ±saltmasÄ± 1.2.2'de metinlerden Ã§Ä±karÄ±lmÄ±ÅŸtÄ± ama dosya,
klasÃ¶r ve veri alanÄ± adlarÄ±nda duruyordu. 1.3.0'da tamamÄ± kaldÄ±rÄ±ldÄ±; yerine kendi
tanÄ±mÄ±mÄ±z olan **ORL â€” Operational Resilience Lifecycle** kullanÄ±ldÄ±.

| Katman | Yeni ad |
|---|---|
| YaÅŸam dÃ¶ngÃ¼sÃ¼ tanÄ±mÄ± | `onboarding/orl-lifecycle.yaml` |
| ModÃ¼l klasÃ¶rÃ¼ | `onboarding/cli/src/orl/` |
| SÃ¼reÃ§ eÅŸlemesi | `data/orl-integration/agent-to-orl-mapping.yaml` |
| Rol alanÄ± | `process_codes` |
| Faz alanÄ± | `lifecycle_phase` |
| Sahiplik alanÄ± | `owned_processes` |
| Ã–zet alanÄ± | `lifecycle_summary` |
| Ã‡alÄ±ÅŸtÄ±rma kimliÄŸi | `ORL-IMPL-6` |

51 dosya gÃ¼ncellendi; dosya/klasÃ¶r taÅŸÄ±malarÄ± yapÄ±ldÄ±. `orl-lifecycle.yaml` iÃ§indeki
`framework` alanÄ± "Implementation Lifecycle (6 faz)" olarak kaldÄ±.

### KÄ±rÄ±cÄ± deÄŸiÅŸiklik

Bu sÃ¼rÃ¼mden Ã¶nce yazÄ±lmÄ±ÅŸ oturumlar (`session.json`) ve dÄ±ÅŸ betikler eski alan adlarÄ±nÄ±
kullanÄ±yorsa gÃ¼ncellenmelidir. CLI'Ä±n kendi Ã§Ä±ktÄ±larÄ± (dashboard, site, kanÄ±t paketi) yeniden
Ã¼retildi.

### DoÄŸrulama

`validate --strict`, `phases`, `demo` (6/6), `demo-scenario` (27/27), `render-mapping --check`
(%100), dashboard + site + PNG Ã¼retimi â€” hepsi geÃ§ti.

---

## [1.2.2] â€” 2026-11-09

### DeÄŸiÅŸti â€” Ã¼Ã§Ã¼ncÃ¼ taraf marka adlarÄ± tamamen kaldÄ±rÄ±ldÄ±

Hukuki risk nedeniyle tedarikÃ§i ve Ã¼rÃ¼n adlarÄ± metinlerden Ã§Ä±karÄ±ldÄ±; yerine nÃ¶tr tanÄ±mlar geldi.

| Ã–nce | Sonra |
|---|---|
| tedarikÃ§i adÄ± + Ã§erÃ§eve adÄ± | "referans operasyonel dayanÄ±klÄ±lÄ±k sÃ¼reÃ§ modeli" |
| Ã¼rÃ¼n adÄ± + modÃ¼l ifadesi | "referans platform modÃ¼lleri" |
| Ã¼rÃ¼n adlÄ± alan (`*_modules`) | `platform_modules` |
| framework: tedarikÃ§i + Ã§erÃ§eve adÄ± | framework: "Implementation Lifecycle (6 faz)" |
| platform: Ã¼rÃ¼n adÄ± | platform: "harici referans platform" |

Etkilenen dosyalar: `data/orl-integration/agent-to-orl-mapping.yaml`, `docs/architecture.md`,
`docs/DURUM.md`, `docs/UYGULAMA-RAPORU.md`, `onboarding/orl-lifecycle.yaml`,
`onboarding/wizard-spec.md`, `README.md`, `CHANGELOG.md`.

AyrÄ±ca `UYGULAMA-RAPORU.docx` iÃ§indeki iki geÃ§iÅŸ dÃ¼zeltildi ve PDF yeniden Ã¼retildi.

### DoÄŸrulama

TÃ¼m metin dosyalarÄ± ve iki ikili belge (DOCX/PDF) tarandÄ±: **0 eÅŸleÅŸme**.
`validate --strict`, `demo` (6/6), `demo-scenario` (27/27), `render-mapping --check` (%100),
dashboard ve site Ã¼retimi â€” hepsi geÃ§ti.

---

## [1.2.1] â€” 2026-11-09

### DeÄŸiÅŸti

**Legacy CLI ayrÄ±ldÄ±** (LAUNCH-REVIEW P1-7)
- `bin/dora-onboard.js`, `src/index.js`, `src/steps/step-1-profile.js`, `src/steps/step-4-agents.js`
  â†’ `onboarding/cli/legacy/` altÄ±na taÅŸÄ±ndÄ±
- `legacy/README.md`: dosyalarÄ±n neden Ã§alÄ±ÅŸmadÄ±ÄŸÄ± (commander/inquirer/js-yaml) ve yeni karÅŸÄ±lÄ±klarÄ±
- `src/steps/` klasÃ¶rÃ¼ kaldÄ±rÄ±ldÄ±; `docker-compose.yml` artÄ±k `bin/dora-onboard.mjs` Ã§aÄŸÄ±rÄ±yor

**README mimariyle hizalandÄ±** (P2-1)
- AÃ§Ä±lÄ±ÅŸ: "otomatikleÅŸtiren" â†’ "**yÃ¼rÃ¼ten**, her adÄ±mÄ± **geÃ§iÅŸ kapÄ±larÄ±yla doÄŸrulayan**"
- Ajan Ã§alÄ±ÅŸtÄ±rÄ±cÄ±sÄ±nÄ±n kapsam dÄ±ÅŸÄ± olduÄŸu aÃ§Ä±kÃ§a yazÄ±ldÄ±
- **"Ne deÄŸildir"** tablosu: ajan Ã§alÄ±ÅŸtÄ±rÄ±cÄ±sÄ± Â· bildirim gÃ¶nderen sistem Â· hukuki gÃ¶rÃ¼ÅŸ Â·
  platform yerine geÃ§me Â· sÄ±fÄ±r kurulum

### DoÄŸrulama

`validate --strict`, `demo` (6/6), `demo-scenario` (27/27), `demo-export`, `demo-ingest`,
`render-mapping --check` (%100), dashboard Ã¼retimi â€” hepsi geÃ§ti.

---

## [1.2.0] â€” 2026-11-09

### Eklendi

**Kalan 21 assertion `check` ile baÄŸlandÄ± â€” kabul testleri tamamen Ã§alÄ±ÅŸtÄ±rÄ±labilir**
- SCN-01 (8), SCN-02 (7), SCN-03 (6) assertion'larÄ±na `check` bloklarÄ± eklendi
- Golden koÅŸu artefaktlarÄ±: `tests/synthetic-scenarios/golden/<senaryo>/`
  (SCN-01: 8 dosya, SCN-02: 6, SCN-03: 5, SCN-04: 5)
- `scenario --golden`: senaryo Ã§alÄ±ÅŸtÄ±rÄ±lmadan Ã¶nce golden artefaktlarÄ± oturuma kopyalar
- `scenario.mjs` â†’ `seedArtifacts(dir, sourceDir)` dÄ±ÅŸa aÃ§Ä±ldÄ±

### DeÄŸiÅŸti

- `tools/demo-scenario.mjs` yeniden yazÄ±ldÄ±: golden koÅŸu (27/27) + bozuk kanÄ±t testi (2 fail)
- `tests/README.md`: golden dizinleri ve `--golden` kullanÄ±mÄ±
- `docs/SENARYO-CALISTIRICI.md`: 1.2.0, golden akÄ±ÅŸÄ±
- SÃ¼rÃ¼m 1.2.0

### SonuÃ§

| | 1.1.0 | 1.2.0 |
|---|---|---|
| Ã‡alÄ±ÅŸtÄ±rÄ±labilir assertion | 6/27 | **27/27** |
| Manuel assertion | 21 | **0** |

CI (`validate` matrisi) artÄ±k 6 iÅŸte de bu 27 assertion'Ä± koÅŸuyor.

---

## [1.1.1] â€” 2026-11-09

### Eklendi

- `site/index.html`: tek dosya landing sayfasÄ± (harici CDN/font yok, gÃ¶reli baÄŸlantÄ±lar)
- `docs/tools/build-site.mjs`: landing + dashboard'u `site/` altÄ±nda birleÅŸtirir
- `docs/SITE.md`: site yapÄ±sÄ± ve alan adÄ± baÄŸlama adÄ±mlarÄ±

### DeÄŸiÅŸti

- GitHub Pages artÄ±k `site/` yayÄ±nlÄ±yor: kÃ¶k landing, dashboard `/dashboard/` altÄ±nda
- README'deki canlÄ± baÄŸlantÄ±lar ikiye ayrÄ±ldÄ± (site + dashboard)

---

## [1.1.0] â€” 2026-11-09

### Eklendi

**Senaryo Ã§alÄ±ÅŸtÄ±rÄ±cÄ±sÄ±**
- `dora-onboard scenario --session <id> --file <yaml> | --all`: assertion'larÄ± oturum artefaktlarÄ±
  Ã¼zerinde deterministik olarak deÄŸerlendirir
- `src/orl/scenario.mjs`: `check` DSL â€” exists, eq, ne, gte, lte, truthy, contains, `all_of`, `any_of`
- SonuÃ§ `scenario-<id>-results.json` olarak oturuma yazÄ±lÄ±r ve kanÄ±t paketine girer
- `SCN-04`'Ã¼n 6 assertion'Ä± check ile baÄŸlandÄ± (eriÅŸim, ÅŸifreleme, segmentasyon, zafiyet, olay)
- `tools/demo-scenario.mjs` + CI adÄ±mÄ±
- `docs/SENARYO-CALISTIRICI.md`

### DeÄŸiÅŸti

- `scenario.schema.json`: `check` bloÄŸu ÅŸemaya eklendi (katÄ± modda geÃ§erli)
- SÃ¼rÃ¼m 1.1.0

### Notlar

- Kalan 21 assertion `check` tanÄ±msÄ±z olduÄŸu iÃ§in **manuel** sayÄ±lÄ±yor; "tÃ¼mÃ¼ geÃ§ti" ifadesi
  yalnÄ±zca Ã§alÄ±ÅŸtÄ±rÄ±labilir assertion'lar iÃ§in geÃ§erlidir.

---

## [1.0.0] â€” 2026-11-08

### Eklendi

**KatÄ± doÄŸrulama**
- `validate --strict`: ÅŸemada tanÄ±mlÄ± olmayan alanlar hata sayÄ±lÄ±r
- `jsonschema.mjs`: `allOf` ve `oneOf` desteÄŸi
- CI'da `validate --strict` ilk adÄ±m

**CI matrisi**
- Ubuntu + Windows Ã— Node 18 / 20 / 22 â€” 6 iÅŸ; "baÄŸÄ±mlÄ±lÄ±ksÄ±z" iddiasÄ±nÄ±n kanÄ±tÄ±

**Ãœretim**
- `docs/URETIM-KONTROL-LISTESI.md`: kurulum, lisans, veri, kanÄ±t, raporlama, devir teslim

### DÃ¼zeltildi

KatÄ± mod ilk Ã§alÄ±ÅŸtÄ±rmada **12 tanÄ±msÄ±z alan** buldu; hepsi ÅŸemalara eklendi (veri deÄŸiÅŸmedi):

- roles: `layer`, `purpose`, `process_codes`, `notes`, `skills[].name` + 7 kÃ¶k alan
- processes: `control_ids`, `generated_at`, `pillar`, `source_of_truth`
- controls: `generated_at`, `source`, `purpose`, `control_families`
- glossary: `generated_at`, `source_primary`, `source_secondary` (dizi)
- scenario: `matched_criterion`, `deadline_hours`

### Notlar

- 1.0 **senaryo Ã§alÄ±ÅŸtÄ±rÄ±cÄ±sÄ± iÃ§ermez**; senaryolar kabul kriteri olarak durur. Ã‡alÄ±ÅŸtÄ±rÄ±cÄ± 1.1.

---

## [0.13.0] â€” 2026-11-08

### Eklendi

**Timeline sÄ±ra denetimi**
- Senaryo timeline'Ä±ndaki `T-30g` / `T+4sa` / `T+1ay` ifadeleri dakikaya Ã§evrilip artan sÄ±rada
  olup olmadÄ±ÄŸÄ± denetleniyor; tanÄ±nmayan ifade de hata sayÄ±lÄ±yor
- Åema bunu yakalayamaz (zaman serbest metin); kontrol katalog doÄŸrulamasÄ±nda

### DÃ¼zeltildi

- `SCN-04` timeline'Ä± sÄ±ra bozuktu: `T+1g` olayÄ± `T+1sa` olayÄ±ndan Ã¶nce yazÄ±lmÄ±ÅŸtÄ±.
  SIEM olayÄ± `T+1sa`ya, hesaplarÄ±n kapatÄ±lmasÄ± `T+2sa`ya alÄ±ndÄ±; sÄ±ra artÄ±k tutarlÄ±.

---

## [0.12.0] â€” 2026-11-08

### Eklendi

**Senaryo ÅŸemasÄ± ve iÅŸ kuralÄ± denetimi**
- `schema/scenario.schema.json`: 4 sentetik senaryonun yapÄ±sÄ± (baÅŸlÄ±k, given/when/then,
  assertion'lar, tuzak testleri, timeline, beklenen kanÄ±tlar)
- `validate` artÄ±k **14 dosya** denetliyor; senaryolarda ÅŸemaya ek olarak:
  - `assertions_total` = gerÃ§ek assertion sayÄ±sÄ±
  - benzersiz assertion/tuzak ID'leri
  - anÄ±lan sÃ¼reÃ§ ve kontrol ID'lerinin katalogda bulunmasÄ±

### Notlar

- Senaryo YAML'larÄ±nda `given/when/then` Ã¼st dÃ¼zey anahtarlar; ilk ÅŸema denemesi bunlarÄ±
  `scenario` altÄ±nda sandÄ± ve dÃ¶rt dosyayÄ± da reddetti. Åema gerÃ§ek yapÄ±ya gÃ¶re dÃ¼zeltildi.

---

## [0.11.0] â€” 2026-11-08

### Eklendi

**EÅŸleme ve lifecycle ÅŸemalarÄ±**
- `schema/mapping.schema.json`: 28 maddenin yapÄ±sÄ± (id deseni, zorunlu sÃ¼reÃ§/kontrol/rol, status enum)
- `schema/lifecycle.schema.json`: 6 faz, adÄ±m/kapÄ±/sÃ¼re, otonomi rampasÄ±, promotion_gates
- `validate` artÄ±k **10 dosya** denetliyor; CI kapsamÄ± geniÅŸledi

### DÃ¼zeltildi

- `promotion_gates` C6'da nesne (shadow_to_semi / semi_to_auto â†’ kriter listesi); ÅŸema dizi sanÄ±yordu.
  Åema dÃ¼zeltildi.

---

## [0.10.0] â€” 2026-11-08

### Eklendi

**Katalog doÄŸrulamasÄ± (validate)**
- `dora-onboard validate [--json]`: 8 YAML dosyasÄ±nÄ± `schema/` altÄ±ndaki 5 JSON Schema'ya gÃ¶re denetler
- `jsonschema.mjs`: `$ref` (aynÄ± dosya ve komÅŸu dosya) + `anyOf` desteÄŸi eklendi
- CI'da ilk adÄ±m: veri ÅŸemayÄ± kÄ±rarsa push kÄ±rmÄ±zÄ±
- `docs/KATALOG-DOGRULAMA.md`

### DÃ¼zeltildi (doÄŸrulamanÄ±n ilk Ã§alÄ±ÅŸtÄ±rmasÄ±nda Ã§Ä±kan gerÃ§ek hatalar)

- `common.schema.json` DoraReference yalnÄ±zca `article` istiyordu; 6 sÃ¶zlÃ¼k terimi ve 2 karar kuralÄ±
  yalnÄ±zca RTS referansÄ± taÅŸÄ±yor. Kural `anyOf: article | rts_its` yapÄ±ldÄ±.
- `DefenceLine` yalnÄ±zca 1/2/3 kabul ediyordu; ROL-CEO-01 yÃ¶netim organÄ± olduÄŸu iÃ§in `null`.
  Enum'a `null` eklendi.
- 11 rolde `human_oversight.required_for` deÄŸerleri (approval, strategy_approval,
  risk_appetite_change, crisis_declaration, scope_change, disclosure) ÅŸemada yoktu; enum geniÅŸletildi.
- **PRC-INC-06'da geÃ§ersiz `clock_start: publication`** vardÄ± â€” 0.4.0'da benim yazdÄ±ÄŸÄ±m SLA.
  Veri dÃ¼zeltildi: "PaydaÅŸ gÃ¼ncellemesi / 24 saat / classification".

---

## [0.9.0] â€” 2026-11-08

### Eklendi

**Artefakt ÅŸema doÄŸrulamasÄ±**
- `schema/artifacts/` altÄ±nda 7 ÅŸema: incident-record, classification-decision, impact-assessment,
  notification-receipt, gap-analysis, go-live, register-of-information
- `src/orl/jsonschema.mjs`: baÄŸÄ±mlÄ±lÄ±ksÄ±z, draft alt kÃ¼mesi (type, required, properties,
  additionalProperties, enum, pattern, min/max, items)
- `ingest` artÄ±k ÅŸemayÄ± Ã§alÄ±ÅŸtÄ±rÄ±yor: uyuÅŸmazsa dosyayÄ± **reddediyor**, gerekÃ§eyi yol bazÄ±nda yazÄ±yor
- `--lenient`: ÅŸema uyuÅŸmazlÄ±ÄŸÄ±nÄ± reddetme, "ÅŸema uyarÄ±sÄ±" olarak kaydet
- `ingest-log.json` her dosya iÃ§in `schema` alanÄ± taÅŸÄ±yor ("ÅŸema uyumlu", "ÅŸema uyarÄ±sÄ±: ...", "ÅŸema yok")

**Test**
- `demo-ingest.mjs`: geÃ§ersiz sÄ±nÄ±flandÄ±rma reddi, lenient kabulÃ¼ ve kayÄ±t iÃ§eriÄŸi doÄŸrulanÄ±yor

### DeÄŸiÅŸti

- `docs/KONNEKTOR.md`: artefakt ÅŸemasÄ± tablosu ve kÄ±smi doÄŸrulama sÄ±nÄ±rÄ±

---

## [0.8.0] â€” 2026-11-08

### Eklendi

**KonnektÃ¶r sÃ¶zleÅŸmesi (dosya bÄ±rakma)**
- `dora-onboard ingest --session <id> --from <dizin>`: JSON doÄŸrular, opak kanÄ±tlarÄ± (pdf/xml/xbrl) alÄ±r,
  bilinmeyen uzantÄ±yÄ± reddeder (`--allow-unknown` ile geÃ§er)
- Her alÄ±m `ingest-log.json`'a eklenir: dosya, tÃ¼r, boyut, sha256, kaynak, zaman
- `docs/KONNEKTOR.md`: sÃ¶zleÅŸme, desteklenen dosyalar, Splunk/ServiceNow/Archer Ã¶rnekleri, sÄ±nÄ±rlar

**Takvim tarih hesabÄ±**
- `calendar --next <gÃ¼n> --anchors <yaml>`: Ã¶nÃ¼mÃ¼zdeki N gÃ¼nÃ¼n yÃ¼kÃ¼mlÃ¼lÃ¼kleri
- `mi --anchors <yaml> --days <gÃ¼n>`: MI paketine "YaklaÅŸan yÃ¼kÃ¼mlÃ¼lÃ¼kler" bÃ¶lÃ¼mÃ¼
- `data/calendar-anchors.example.yaml`: aylÄ±k/yÄ±llÄ±k/tek seferlik tarih kurallarÄ±

**Test**
- `tools/demo-ingest.mjs`: alÄ±m, ret, sha256 kaydÄ±, tarih hesabÄ± ve MI entegrasyonu

### DÃ¼zeltildi

- **BOM'lu JSON reddediliyordu.** Windows araÃ§larÄ±nÄ±n yazdÄ±ÄŸÄ± UTF-8 BOM artÄ±k tolere ediliyor
  (ingest, mi ve notify okuma yollarÄ±).
- **Takvim tarihleri bir gÃ¼n kayÄ±yordu.** `toISOString()` UTC'ye Ã§evirdiÄŸi iÃ§in 30 Nisan
  "29 Nisan" gÃ¶rÃ¼nÃ¼yordu; yerel tarih biÃ§imlendirmesi eklendi.

---

## [0.7.0] â€” 2026-11-08

> 0.5 olarak planlanan MI paketi bu sÃ¼rÃ¼mde teslim edildi (sÄ±ra 0.6'dan sonraya kaymÄ±ÅŸtÄ±).

### Eklendi

**YÃ¶netim kurulu MI paketi (Art-05 / Art-06)**
- `PRC-RSK-06` YÃ¶netim Kurulu RaporlamasÄ± ve MI Paketi + `CTL-RSK-012` Ã¼retim/onay kontrolÃ¼
- `dora-onboard mi --session <id> --period YYYY-MM`: tek sayfa HTML + JSON
- 6 KPI, her biri kaynak dosyasÄ±yla; veri yoksa "veri yok", uydurma deÄŸer yok
- KÄ±rmÄ±zÄ± bayraklar: aÃ§Ä±k bÃ¼yÃ¼k olay, %100 altÄ± kapsam, aÃ§Ä±k kritik boÅŸluk

**DÃ¼zenleyici takvim**
- `data/regulatory-calendar.yaml`: 9 yÃ¼kÃ¼mlÃ¼lÃ¼k (olay bazlÄ±, aylÄ±k, yÄ±llÄ±k, 3 yÄ±lda bir)
- `dora-onboard calendar [--frequency ...]`: sÃ¼re, madde, sÃ¼reÃ§ ve sahip tek listede

**Test**
- `demo-export.mjs` artÄ±k MI paketini de Ã¼retip doÄŸruluyor (6/6 KPI, bayrak yok, Ã§Ä±ktÄ±lar yazÄ±ldÄ±)

**Belge**
- `docs/MI-PAKETI.md`

### DeÄŸiÅŸti

- SÃ¼reÃ§ **23 â†’ 24**, kontrol **35 â†’ 36**
- `PRC-RSK-05` kontrol listesine eksik olan `CTL-RSK-010` eklendi (katalogda vardÄ±, sÃ¼reÃ§te yoktu)
- Art-05 ve Art-06 eÅŸlemeleri PRC-RSK-06 / CTL-RSK-012'yi gÃ¶steriyor

---

## [0.6.1] â€” 2026-11-08

### DeÄŸiÅŸti

- **`export` imza olmadan Ã§alÄ±ÅŸmÄ±yor.** Ä°mza anahtarÄ± yoksa komut Ã§Ä±kÄ±ÅŸ kodu 1 ile reddediyor;
  bilinÃ§li imzasÄ±z Ã¼retim iÃ§in `--allow-unsigned` gerekiyor.

### GerekÃ§e

Hash zinciri paketin kendi iÃ§inde tutarlÄ±lÄ±ÄŸÄ±nÄ± kanÄ±tlar; manifest de yeniden Ã¼retilirse imzasÄ±z
durumda kurcalama yakalanmaz. Ãœretimde imza artÄ±k varsayÄ±lan, imzasÄ±zlÄ±k istisna.

---

## [0.6.0] â€” 2026-11-08

> Not: 0.5 (yÃ¶netim kurulu MI paketi) atlandÄ±; sÄ±ra kanÄ±t ve bildirim araÃ§larÄ±na verildi.

### Eklendi

**KanÄ±t paketi (export / verify)**
- `onboarding/cli/src/orl/evidence.mjs`: baÄŸÄ±mlÄ±lÄ±ksÄ±z ZIP yazÄ±cÄ±/okuyucu (`store` yÃ¶ntemi),
  sha256 hash zinciri, Ed25519 imza, manifest Ã¼retimi
- `dora-onboard export` â€” oturum artefaktlarÄ±nÄ± `evidence-out/<oturum>-evidence.zip` olarak paketler
- `dora-onboard verify` â€” dosya Ã¶zetlerini, zinciri ve imzayÄ± doÄŸrular; kurcalamada Ã§Ä±kÄ±ÅŸ 1

**Bildirim formu (notify)**
- `onboarding/cli/src/orl/notify.mjs`: ITS 2024/2956 alan sÃ¶zlÃ¼ÄŸÃ¼nÃ¼ oturum artefaktlarÄ±yla doldurur
- `dora-onboard notify --phase initial|intermediate|final` â€” JSON + Markdown + yazdÄ±rÄ±labilir HTML
- Eksik zorunlu alan varsa form Ã¼retilir ama `complete:false` iÅŸaretlenir ve Ã§Ä±kÄ±ÅŸ kodu 2 olur
- `--check` ile dosya yazmadan doÄŸrulama

**Test**
- `onboarding/cli/tools/demo-export.mjs`: uÃ§tan uca demo â€” paket, doÄŸrulama, kurcalama testi,
  Ã¼Ã§ bildirim formu, eksik alan testi. CI'da her push'ta Ã§alÄ±ÅŸÄ±r.

**Belge**
- `docs/KANIT-PAKETI.md`: paket yapÄ±sÄ±, zincir formÃ¼lÃ¼, imza, garanti sÄ±nÄ±rlarÄ±, kullanÄ±m

### DeÄŸiÅŸti

- SÃ¼rÃ¼m 0.6.0
- `.gitignore`: `.demo-export/`, `notifications/`, `evidence-out/`
- ITS alan sÃ¶zlÃ¼ÄŸÃ¼nde `recurring_risk` kaynaÄŸÄ± `incident-record.json#recurring_risk` olarak netleÅŸtirildi

---

## [0.4.1] â€” 2026-11-08

### Eklendi

- `CTL-RSK-011` Yedekleme ve geri yÃ¼kleme doÄŸrulamasÄ±: yedek konumu (ayrÄ± / deÄŸiÅŸtirilemez),
  ÅŸifreleme, saklama sÃ¼resi, geri yÃ¼kleme testi, RTO Ã¶lÃ§Ã¼mÃ¼ ve bÃ¼tÃ¼nlÃ¼k hash'i
- `PRC-RSK-04` kanÄ±t ÅŸartnamesine `backup-restore-test.json` eklendi

### DeÄŸiÅŸti

- Art-12 (yedekleme) **partial â†’ covered**; kapsam **%96 â†’ %100** (28/28)
- Kontrol **34 â†’ 35**
- `verify` notu: C5 kapÄ±sÄ± artÄ±k hiÃ§bir maddede boÅŸluk/kÄ±smi gÃ¶rmÃ¼yor

---

## [0.4.0] â€” 2026-11-08

### Eklendi

**Kriz iletiÅŸimi (Madde 14) â€” kapsamdaki son boÅŸluk kapandÄ±**
- `PRC-INC-06` Kriz Ä°letiÅŸimi ve PaydaÅŸ Bildirimi: sÃ¶zcÃ¼ matrisi, 4 saatlik ilk aÃ§Ä±klama,
  mÃ¼ÅŸteri/basÄ±n kanal kurallarÄ±, yanlÄ±ÅŸ bilgi dÃ¼zeltme (2 saat)
- `CTL-INC-009` hazÄ±rlÄ±k ve onay kontrolÃ¼ (ÅŸablon sÃ¼rÃ¼mÃ¼, onaylayan, yayÄ±n zamanÄ±, SLA uyumu)

**Ã–deme olaylarÄ±nÄ±n ayrÄ± bildirimi (Madde 23)**
- `PRC-INC-07` Ã–deme ile Ä°lgili OlaylarÄ±n AyrÄ± Bildirimi: Ã¶deme zinciri etkisi, Ã§ift kanal
  (DORA + TCMB) zorunluluÄŸu, INC-R14/INC-R15 kurallarÄ±
- `CTL-INC-010` Ã¶deme etkisi ve Ã§ift kanal kayÄ±t kontrolÃ¼

**Bildirim ÅŸablonu alan sÃ¶zlÃ¼ÄŸÃ¼ (Madde 20)**
- `data/mapping/its-2024-2956.yaml`: ilk / ara / nihai bildirim alanlarÄ±, her alanÄ±n zorunluluÄŸu
  ve beslendiÄŸi kanÄ±t dosyasÄ±. Resmi XBRL taksonomi kodlarÄ±nÄ±n baÄŸlanmasÄ± uygulama adÄ±mÄ±dÄ±r.

**Raporlama gÃ¶rÃ¼nÃ¼rlÃ¼ÄŸÃ¼**
- `docs/tools/build-coverage-summary.mjs` â†’ `docs/KAPSAM-OZETI.md` (Ã¼retilen kapsam tablosu)
- `docs/RAPORLAMA-ANALIZI.md`: raporlama yÃ¼kÃ¼mlÃ¼lÃ¼kleri matrisi, kalan boÅŸluklar, Ã¶neriler

### DeÄŸiÅŸti

- SÃ¼reÃ§ **21 â†’ 23**, kontrol **32 â†’ 34**
- DORA kapsamasÄ± **%86 â†’ %96**: 27 covered, 1 partial (Art-12), 0 gap
- `dora-articles.yaml` **1.1.0**: Art-14 gap â†’ covered; Art-20 ve Art-23 partial â†’ covered;
  Art-19 artÄ±k gÃ¶nÃ¼llÃ¼ tehdit bildirimini (PRC-INC-05) de gÃ¶steriyor
- `docs/dora-mapping.md`, `dashboard/` ve `docs/KAPSAM-OZETI.md` yeniden Ã¼retildi

### DÃ¼zeltildi

- Art-19 eÅŸlemesi `PRC-INC-05` + `CTL-INC-008`'i gÃ¶stermiyordu: sÃ¼reÃ§ pakette vardÄ± ama
  eÅŸlemede gÃ¶rÃ¼nmÃ¼yordu, bu yÃ¼zden "gÃ¶nÃ¼llÃ¼ bildirim yok" gibi okunuyordu
- `docs/DURUM.md` baÅŸlÄ±k tarihi ve dashboard sayaÃ§larÄ± gÃ¼ncel deÄŸildi

---

## [0.3.0] â€” 2026-11-04

### Eklendi

**Siber gÃ¼venlik kontrolleri (DORA Madde 9) â€” uÃ§tan uca**
- `PRC-RSK-05` sÃ¼reci: eriÅŸim (en az yetki), ÅŸifreleme/anahtar yÃ¶netimi, aÄŸ segmentasyonu,
  zafiyet kapatma; 4 karar kuralÄ± (SEC-R1â€¦R4), 4 SLA, tier varyantÄ±
- 4 yeni kontrol: `CTL-RSK-007` (eriÅŸim gÃ¶zden geÃ§irme), `CTL-RSK-008` (ÅŸifreleme),
  `CTL-RSK-009` (segmentasyon), `CTL-RSK-010` (zafiyet kapatma)
- `tests/synthetic-scenarios/scenario-security-controls.yaml` (SCN-04): 6 assertion,
  4 tuzak testi, 5 kanÄ±t dosyasÄ± â€” "kontrol var" ile "kontrol kanÄ±tlanÄ±yor" farkÄ±nÄ± sÄ±nar
- Fixture: `fixtures/security-controls-2026-08.json`

**Dashboard**
- `docs/tools/build-dashboard.mjs` â†’ `dashboard/index.html` + `dashboard/data.json`
  (depodaki YAML'lardan Ã¼retilir, elle dÃ¼zenlenmez)
- `docs/tools/render_dashboard.py` â†’ `dashboard/dashboard.png` (tarayÄ±cÄ±sÄ±z, Pillow)
- Kutucuklar: sÃ¼reÃ§/kontrol/ajan/terim/senaryo/kapsama; ORL faz tablosu, aÃ§Ä±k noktalar,
  senaryo listesi, referans saÄŸlÄ±ÄŸÄ±

### DeÄŸiÅŸti

- DORA kapsamasÄ± **%79 â†’ %86**: Art-07 (sÄ±kÄ±laÅŸtÄ±rma) ve **Art-09** (koruma/ÅŸifreleme)
  artÄ±k `covered`; kalan tek boÅŸluk Art-14 (kriz iletiÅŸimi)
- Kontrol sayÄ±sÄ± 28 â†’ **32**; sÃ¼reÃ§ 20 â†’ **21**; senaryo 3 â†’ **4** (27 assertion)
- `package.json` sÃ¼rÃ¼mÃ¼ 0.3.0

### Notlar

- Art-09 kapatÄ±lÄ±rken paketin "ISO 27001 setine bÄ±rakÄ±lmÄ±ÅŸ" varsayÄ±mÄ± kaldÄ±rÄ±ldÄ±: dÃ¶rt kontrol
  artÄ±k paketin iÃ§inde, kanÄ±t ÅŸartnamesiyle tanÄ±mlÄ±.
- Dashboard, `render-mapping` gibi **Ã¼retilen** bir artefakt; CI'da `--check` benzeri kullanÄ±m
  iÃ§in `build-dashboard.mjs` sarkan referans bulursa Ã§Ä±kÄ±ÅŸ kodu 1 dÃ¶ner.

---

## [0.2.0] â€” 2026-11-03

Bu sÃ¼rÃ¼m, konuÅŸma dÃ¶kÃ¼mÃ¼ndeki taslaklarÄ± **Ã§alÄ±ÅŸan ve doÄŸrulanmÄ±ÅŸ** bir depoya Ã§evirir.

### Eklendi

**SÃ¼reÃ§ kÃ¼tÃ¼phanesi (ModÃ¼l 2)**
- `data/processes/pillar-{1..5}.yaml` â€” 20 sÃ¼reÃ§: PRC-RSK-01..04, PRC-INC-01..05,
  PRC-TST-01..03, PRC-TPP-01..06, PRC-INF-01..02
- Her sÃ¼reÃ§te tetikleyici, girdi/Ã§Ä±ktÄ± (saklama sÃ¼resiyle), SLA, karar kurallarÄ± (DORA madde
  referanslÄ±), baÄŸÄ±mlÄ±lÄ±klar, `control_ids`, tier varyantlarÄ±

**Kontrol kataloÄŸu (ModÃ¼l 3)**
- `data/controls/controls-catalog.yaml` â€” 28 kontrol (RSK 6, INC 8, TST 4, TPP 7, INF 3)
- Her kontrolde kanÄ±t ÅŸartnamesi (format + deÄŸiÅŸtirilemezlik + zorunlu alanlar) ve `test_procedure`

**Sentetik senaryolar (ModÃ¼l 5)**
- `tests/synthetic-scenarios/` â€” SCN-01 (8 assertion), SCN-02 (7), SCN-03 (6) + 3 fixture
- `tests/README.md` â€” senaryo formatÄ± ve kapÄ± kuralÄ±

**Onboarding (ModÃ¼l 4)**
- `onboarding/orl-lifecycle.yaml` â€” ORL 6 fazÄ±, kapÄ± kriterleri, otonomi merdiveni
- `onboarding/wizard-spec.md` â€” tasarÄ±m gerekÃ§esi, eski 8 adÄ±m â†’ 6 faz eÅŸlemesi
- `onboarding/cli/bin/dora-onboard.mjs` â€” **baÄŸÄ±mlÄ±lÄ±ksÄ±z** Ã§alÄ±ÅŸan CLI (`init`, `phase`, `gate`,
  `status`, `phases`, `rollback`); baÄŸÄ±mlÄ±lÄ±k eklemeden kendi mini YAML okuyucusu
- `onboarding/cli/src/orl/{yaml,lifecycle,checks,session,license}.mjs`

**DORA eÅŸlemesi (ModÃ¼l 6)**
- `data/mapping/dora-articles.yaml` â€” 28 yÃ¼kÃ¼mlÃ¼lÃ¼k maddesi â†’ sÃ¼reÃ§/kontrol/rol
- `docs/dora-mapping.md` â€” **Ã¼retilen** dokÃ¼man (22 covered, 4 partial, 2 gap = %79)
- `docs/local-equivalents-TR.md` â€” BDDK/TCMB/SEDDK/SPK/KVKK eÅŸlemesi, sÃ¼re farklarÄ±
- `docs/tools/render-mapping.mjs`, `docs/tools/build-coverage.mjs`

**Mimari ve sÃ¼reÃ§ dokÃ¼manlarÄ± (ModÃ¼l 7)**
- `docs/architecture.md` â€” katman modeli, ajan Ã§alÄ±ÅŸma modeli, denetim izi, bilinÃ§li sÄ±nÄ±rlar
- `docs/decisions.md` â€” DR-001â€¦DR-008 karar kaydÄ±

**Pilot (ModÃ¼l 8)**
- `pilots/case-study-template.md` â€” Ã¶lÃ§Ã¼m odaklÄ± vaka Ã§alÄ±ÅŸmasÄ± ÅŸablonu

**Lisanslama**
- `LICENSE` â€” AGPL-3.0 tam metni
- `LICENSE-COMMERCIAL.md` â€” ticari lisans ÅŸablonu
- `docs/licensing.md` â€” hangi durumda hangi lisans (karar tablosu + SSS)
- `docs/pricing.md` â€” fiyatlandÄ±rma Ã§erÃ§evesi (katman aralÄ±klarÄ±, indirim politikasÄ±)
- `CLA.md`, `CONTRIBUTING.md` â€” katkÄ± sÃ¼reci
- `docs/license-keys.md` â€” Ed25519 imzalÄ± anahtar mekanizmasÄ±
- Lisans kapÄ±sÄ±: `C1-0` (imza + sÃ¼re + tier), `C6-0` (Ã¼retime geÃ§iÅŸte ticari lisans);
  anahtarsÄ±z 30 gÃ¼n deneme modu

### DeÄŸiÅŸti

- `PRC-INC-02` ilk bildirim SLA'sÄ± **4 saat** (DR-001) â€” tier2/tier3 varyantlarÄ± da 4 saat
- `common.schema.json` â†’ `DoraReference.required` yalnÄ±z `article` (DR-003)
- `roles.schema.json` â†’ rol ID deseni 3-4 harf (`ROL-TLPT-01`, `ROL-CTPP-01` iÃ§in) (DR-003)
- `data/roles/roles-catalog.yaml` â†’ her role `process_codes` eklendi (21 kod)
- `onboarding/cli/package.json` â†’ `"license": "AGPL-3.0-only"`
- `README.md` â†’ lisans bÃ¶lÃ¼mÃ¼, Ã§ift lisans aÃ§Ä±klamasÄ±, gÃ¼ncel CLI kullanÄ±mÄ±

### DÃ¼zeltildi

- `OR.KIB.ARCH` sahipsiz koddu â†’ `ROL-CIO-01`e atandÄ± (mapping â†” rol paritesi 21 = 21)
- `glossary-full.yaml` iÃ§indeki 17 sÃ¼reÃ§ referansÄ± Ã§Ã¶zÃ¼ldÃ¼ (sarkan referans yok)
- Rol deseni hatasÄ±: katalog kendi ÅŸemasÄ±na uymuyordu
- `DoraReference` hatasÄ±: ÅŸema kendi verisinin %100'Ã¼nÃ¼ reddediyordu

### GÃ¼venlik

- Lisans anahtarÄ± Ed25519 ile imzalanÄ±r, Ã§evrimdÄ±ÅŸÄ± doÄŸrulanÄ±r (`node:crypto`, ek baÄŸÄ±mlÄ±lÄ±k yok)
- `onboarding/license/dev-private.pem` `.gitignore`'da; Ã¼retim anahtarÄ± depoda tutulmaz

---

## [0.1.0] â€” 2025-01-15

### Eklendi
- Ä°lk sÃ¶zlÃ¼k ÅŸemasÄ± (common, glossary, roles, processes, controls)
- 60 terimlik DORA sÃ¶zlÃ¼ÄŸÃ¼ (6 kategori)
- 11 ajan rolÃ¼ kataloÄŸu
- 5 sÃ¼tun sÃ¼reÃ§ kÃ¼tÃ¼phanesi
- 8 adÄ±mlÄ± onboarding wizard iskeleti
- Pilot seÃ§im modeli ve dokÃ¼manlarÄ±
- Yerel muadil eÅŸleme (TR)

---

## Yol HaritasÄ±

- [x] v0.2.0 â€” Ã‡alÄ±ÅŸan ORL wizard, sÃ¼reÃ§/kontrol kataloglarÄ±, DORA eÅŸlemesi
- [ ] v0.3.0 â€” Wizard web arayÃ¼zÃ¼
- [ ] v0.4.0 â€” Entegrasyon konnektÃ¶rleri (Splunk, ServiceNow, Archer)
- [ ] v0.5.0 â€” platform API adaptÃ¶rÃ¼ + MOS panosu
- [ ] v0.6.0 â€” Deterministik kural motoru (CEL/Rego) â€” `condition` alanlarÄ± yÃ¼rÃ¼tÃ¼lebilir olur
- [ ] v1.0.0 â€” Ãœretim sÃ¼rÃ¼mÃ¼

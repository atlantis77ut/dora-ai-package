# Legacy — konuşma dökümünden gelen ilk CLI iskeleti

Bu klasör, DORA AI Ajan Paketi'nin ilk halindeki **commander tabanlı CLI iskeletini** saklar.
Üretimde kullanılmaz; yalnızca köken kaydı ve tarihsel referans için duruyor.

| Dosya | Ne |
|---|---|
| `bin/dora-onboard.js` | `commander` ile yazılmış komut yönlendirici (init / step / status / rollback / validate) |
| `src/index.js` | Adım orkestratörü: 0-8 arası adım modülleri, snapshot, rollback |
| `src/steps/step-1-profile.js` | Tier önerisi (bilanço/çalışan sayısına göre) |
| `src/steps/step-4-agents.js` | Ajan aktivasyonu + dört bağımsızlık kontrolü |

## Neden çalışmıyor

`commander`, `inquirer`, `js-yaml`, `ajv` bağımlılıkları gerekir; paket **bağımlılıksız** olacak
şekilde yeniden yazıldığı için `package.json` bu dosyalara işaret etmiyor ve `npm install`
yapılmıyor (bkz. `docs/decisions.md` → DR-005).

## Yerine ne kullanılıyor

| Eski | Yeni |
|---|---|
| `bin/dora-onboard.js` | `bin/dora-onboard.mjs` (bağımlılıksız, ESM) |
| `src/index.js` (0-8 adım) | `src/orl/lifecycle.mjs` + `src/orl/checks.mjs` (ORL 6 faz) |
| `src/steps/step-1-profile.js` | `lifecycle.mjs` → `RUNNERS.C1` (profil + BSC) |
| `src/steps/step-4-agents.js` | `lifecycle.mjs` → `RUNNERS.C3` + `checks.mjs` (IND-01…04) |

Faz akışı ve kapı mantığı: `onboarding/orl-lifecycle.yaml`, `onboarding/wizard-spec.md`.

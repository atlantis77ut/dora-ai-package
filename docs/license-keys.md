# Lisans Anahtarları — teknik referans

Sihirbaz, lisansı **çevrimdışı** doğrular: imzalı bir token, gömülü açık anahtarla kontrol edilir.
Sunucu, internet veya hesap gerekmez.

> Bu bir DRM değil. Kod AGPL ile açık; amaç kopyalamayı teknik olarak engellemek değil,
> **uyum kapısı** kurmak ve ticari lisansı ölçülebilir kılmak.

---

## 1. Token biçimi

```
DORA-LIC-v1.<base64url(payload)>.<base64url(Ed25519 imza)>
```

İmza, `DORA-LIC-v1.<payload>` metni üzerinde atılır. Payload:

```json
{
  "license_id": "LIC-2026-001",
  "licensee": "Örnek Bankası A.Ş.",
  "tier": "tier2",
  "phases": ["C1", "C2", "C3", "C4", "C5", "C6"],
  "modules": ["agents", "processes", "orl", "pilot"],
  "issued_at": "2026-11-03T12:00:00.000Z",
  "expires_at": "2027-11-03T23:59:59.000Z"
}
```

`tier: "enterprise"` ise tüm tier'lar kapsanır (`tiers` alanı da desteklenir).

**Neden Ed25519?** Node'un `node:crypto` modülünde yerleşik, anahtar boyutu küçük, imza
doğrulaması hızlı ve deterministik. Ek bağımlılık yok (DR-005).

---

## 2. Dosyalar

| Dosya | Nerede | Gizli mi |
|---|---|---|
| `onboarding/license/public-key.pem` | depo | **hayır** — dağıtılabilir, doğrulama için gerekli |
| `onboarding/license/dev-private.pem` | depo (`.gitignore`) | **evet** — yalnız geliştirme; üretimde asla |
| `src/orl/license.mjs` | depo | doğrulama mantığı |
| `tools/license-gen.mjs` | depo | satıcı aracı (imzalama) |

Üretimde özel anahtar **depoda durmaz**: satıcının kasa/HSM'inde tutulur ve imzalama çevrimdışı
bir makinede yapılır. `dev-private.pem` yalnız demo/test içindir.

---

## 3. Üretim akışı

```bash
# 1) (yalnız geliştirme) anahtar çifti
node tools/license-gen.mjs --init-dev-keys

# 2) lisans imzala (üretimde HSM'deki anahtarla)
node tools/license-gen.mjs \
  --key /güvenli/yol/private.pem \
  --licensee "Banka A.Ş." \
  --tier tier2 \
  --phases C1,C2,C3,C4,C5,C6 \
  --expires 2027-11-03 \
  --id LIC-2026-001 > LIC-2026-001.txt

# 3) müşteri kurulumu
node bin/dora-onboard.mjs init --tier tier2 --regulator BDDK --license "$(cat LIC-2026-001.txt)"
```

---

## 4. Doğrulama kuralları

| Kural | Nerede denetlenir | Sonuç |
|---|---|---|
| İmza geçerli | `init`, `phase`, C1-0, C6-0 | değilse çıkış kodu 3 |
| Süre dolmamış | aynı yerler | değilse çıkış kodu 3 |
| Lisans tier'ı ≥ kurum tier'ı | `init`, C1-0 | uyumsuzsa çıkış kodu 3 |
| Faz lisansın `phases` listesinde | C1-0 / C6-0 | yoksa kapı kapanır |
| Deneme modu | C1-C5 geçer, **C6 kapanır** | üretime geçiş ticari lisans ister |

Deneme modu: anahtarsız `init` → 30 gün. Değerlendirme ve PoC için yeterli, üretim için değil.

---

## 5. İptal (revocation) ve anahtar döndürme

Çevrimdışı doğrulamada **anlık iptal yoktur** — müşteri eski token'ı kullanmaya devam edebilir.
Bu yüzden:

1. **Kısa süre:** lisanslar 12 ayda bir yenilenir; süresi dolan token kendiliğinden durur.
2. **Anahtar döndürme:** yeni sürümlerde yeni açık anahtar yayınlanır; eski anahtarla imzalanmış
   token'lar o sürümde geçersiz olur (sürüm kilidi).
3. **Sözleşme:** ihlalde hukuki yol — teknik kontrol değil, sözleşme maddesi.
4. **İzleme:** `license_id` müşteri kaydıyla eşlenir; aynı ID'nin farklı kurumlarda görülmesi
   kötüye kullanım işaretidir.

---

## 6. Sınırlar (dürüst liste)

- Kaynak kod açık olduğu için doğrulama **kaldırılabilir**; bu bir uyum kapısıdır, kopya koruması değil.
- Çevrimdışı olduğu için **kullanım telemetrisi yok** — kaç kurulum çalıştığını göremezsin.
- Deneme süresi kullanıcı tarafından sistem saatini değiştirerek uzatılabilir; sonuçta gate
  yalnızca kapıyı kapatır, veri çalmaz.
- `phases`/`modules` alanları bugün C1-0 ve C6-0'da denetleniyor; ileride her faza yayılabilir.

Bu sınırlar bilinçli: kapalı kutu yapmadığımız için (DR-007) teknik zorlama yerine şeffaflık
ve sözleşme tercih edildi.

---

## 7. Test senaryoları

| Senaryo | Beklenen |
|---|---|
| Geçerli ticari lisans, tier eşleşiyor | C1…C6 geçer |
| Bozuk imza | `init` çıkış 3, "imza doğrulanamadı" |
| Süresi dolmuş | `init` çıkış 3, "lisans süresi dolmuş" |
| Tier uyumsuz | `init` çıkış 3, "lisans tier=… istenen tier=…" |
| Anahtarsız (deneme) | C1…C5 geçer, C6 kapanır |
| Deneme süresi dolmuş | `phase` çıkış 3 |

# Katalog Doğrulaması

Sürüm 0.10.0 · 8 Kasım 2026 · ustauretim

Paketin kendi verisi, kendi şemasına uyuyor mu? Bu soru 0.2.0'dan beri açıktı: beş JSON
Schema vardı ama hiçbir komut onları veriye uygulamıyordu. 0.10.0 bunu kapatıyor.

~~~bash
node bin/dora-onboard.mjs validate
node bin/dora-onboard.mjs validate --json
~~~

Sekiz dosya denetlenir:

| Dosya | Şema |
|---|---|
| data/glossary/glossary-full.yaml | glossary.schema.json |
| data/roles/roles-catalog.yaml | roles.schema.json |
| data/processes/pillar-1…5.yaml | processes.schema.json |
| data/controls/controls-catalog.yaml | controls.schema.json |

Çıkış kodu: **0** tümü uyumlu · **1** en az bir dosya uymuyor.

---

## İlk çalıştırmada bulunanlar

Komut yazılır yazılmaz dört gerçek sorun çıktı — hiçbiri gözle görülür değildi:

| Bulgu | Karar |
|---|---|
| 6 sözlük terimi yalnızca RTS referansı taşıyor; şema article zorunlu tutuyordu | DoraReference anyOf: article **veya** rts_its |
| ROL-CEO-01'in defence_line değeri null; şema yalnızca 1/2/3 kabul ediyordu | DefenceLine enum'a null eklendi (yönetim organı, hat dışı) |
| 11 rolde human_oversight.required_for değerleri şema enum'unda yoktu | Enum 6 değerle genişletildi |
| PRC-INC-06'da clock_start "publication" geçersizdi | **Veri düzeltildi**: "Paydaş güncellemesi / 24 saat / classification" |

Son satır önemli: sorun şemada değil, 0.4.0'da benim yazdığım süreçteydi. Doğrulama olmadan
bu hata denetimde "bu SLA neye göre başlıyor" sorusuyla ortaya çıkardı.

---

## Neden ayrı bir komut

- **Yayın öncesi kapı:** veri değişikliği şemayı kırarsa CI kırmızı olur.
- **Şema ile veri arasındaki sözleşme:** enum'a yeni değer eklemek bilinçli bir karar hâline gelir.
- **Geriye dönük kanıt:** hangi sürümde hangi alanın eklendiği şema diff'inde görünür.

---

## Sınırlar

- Doğrulayıcı draft'ın alt kümesini uygular: type, required, properties, additionalProperties,
  enum, pattern, min/max, items, anyOf. allOf/oneOf/$ref zincirleri desteklenmez.
- Eşleme dosyası (dora-articles.yaml) ve lifecycle (corf-lifecycle.yaml) şemasızdır; bu komut
  onları denetlemez. Eşleme bütünlüğü ayrı bir kontrolle (render-mapping --check) sağlanır.
- Ek alanlar serbest bırakılmıştır (additionalProperties varsayılanı); katı mod eklenebilir.

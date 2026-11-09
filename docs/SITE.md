# Site ve Alan Adı

9 Kasım 2026 · ustauretim

GitHub Pages iki şeyi birlikte yayınlıyor:

| Yol | Ne |
|---|---|
| `site/index.html` | Landing sayfası (elle yazılır, tek dosya) |
| `site/dashboard/` | Dashboard (YAML’lardan üretilir, `site/` içine kopyalanır) |

Kaynak depoda `site/index.html` ve `dashboard/`; `site/dashboard/` üretim çıktısıdır ve `.gitignore`’da.

~~~bash
node docs/tools/build-dashboard.mjs   # dashboard/index.html ...
node docs/tools/build-site.mjs        # site/index.html + site/dashboard/
~~~

Yayın: `pages.yml` her push’ta ikisini de üretip `site/` klasörünü yayınlar.

---

## Alan adı bağlama

1. **Depo → Settings → Pages → Custom domain** alanına alan adını yaz (ör. `dora-package.com`).
   GitHub depoya `CNAME` dosyası ekler; repoya commit edilmesi gerekmez.
2. **DNS** (alan adı sağlayıcında):
   - Kök alan adı (`dora-package.com`) için GitHub’ın A kayıtları:
     `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - `www` için `CNAME` → `atlantis77ut.github.io`
3. **Enforce HTTPS** kutusunu işaretle (sertifika dakikalar içinde gelir).
4. Doğrula: `https://<alan-adı>/` landing’i, `https://<alan-adı>/dashboard/` dashboard’u açmalı.

## Notlar

- Landing göreli bağlantı kullanır (`dashboard/index.html`), bu yüzden alan adı değişse de çalışır.
- Harici font/CDN yok; kapalı ağda da açılır.
- Alan adı bağlandıktan sonra README ve `docs/SATIS-PAKETI.md` içindeki adresleri güncelle.
- `site/dashboard/` her derlemede silinip yeniden yazılır; elle düzenlenmez.

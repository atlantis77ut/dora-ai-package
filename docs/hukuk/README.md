# Hukuk ve Uyum Belgeleri

Bu klasör, paketin **hukuki ve uyum** tarafını toplar. Hepsi **taslaktır** — yayına almadan önce
hukukçu incelemesi gerekir.

| Belge | Ne işe yarar | Hedef kitle |
|---|---|---|
| [AGPL-SAAS-UYUM.md](AGPL-SAAS-UYUM.md) | AGPL §13 yükümlülükleri, SaaS modeli kararı, kaynak teklifi metni, ticari lisans maddeleri | kurucu / satış |
| [KVKK-AYDINLATMA.md](KVKK-AYDINLATMA.md) | kullanıcılara aydınlatma metni (taslak) | son kullanıcı |
| [KVKK-DPA-TASLAK.md](KVKK-DPA-TASLAK.md) | veri işleyen sözleşmesi (KVKK m.9 / GDPR Art. 28) | kurumsal müşteri |
| [VERI-ENVANTERI.md](VERI-ENVANTERI.md) | **hangi veri nerede**, teknik envanter (kodla eşleşir) | DPO / denetçi |
| [DOLDURULACAK-ALANLAR.md](DOLDURULACAK-ALANLAR.md) | kalan boş alanların tek listesi (kimlik, fiyat, SaaS modeli, tarihler) | kurucu |
| [../SAKLAMA-SILME-PROSEDURU.md](../SAKLAMA-SILME-PROSEDURU.md) | saklama süreleri, silme, geri yükleme, DSAR | operasyon |

## Durum tablosu

| Konu | Durum |
|---|---|
| AGPL yükümlülükleri haritalandı | ✔ yazıldı |
| Kaynak teklifi metni | ✔ hazır (şablon) |
| Ticari lisans maddeleri | ✔ fiyat/SLA/destek **öneri** olarak dolu (`LICENSE-COMMERCIAL.md` §2, §6) |
| KVKK aydınlatma | ⚠ teknik alanlar dolu; kimlik/iletişim alanları kaldı |
| DPA | ⚠ teknik ek dolu; taraflar + alt işleyenler kaldı |
| Veri envanteri | ✔ kodla eşleşiyor |
| Saklama/silme | ✔ prosedür yazıldı, **silme/geri yükleme testi yapılmadı** |
| Hukukçu incelemesi | ✖ **yapılmadı** |

## Sıradaki adımlar

1. [`DOLDURULACAK-ALANLAR.md`](DOLDURULACAK-ALANLAR.md) listesindeki kimlik/fiyat/SaaS alanlarını doldur
2. Hukukçuya ver: AGPL-SAAS-UYUM + DPA + aydınlatma + ticari lisans
3. Nihai fiyatı `pricing.md` §3'ten seç, `LICENSE-COMMERCIAL.md` §2 ile eşitle
4. Silme ve geri yükleme adımlarını bir test kurulumunda **çalıştır** ve tarihini kaydet

# Hukuk ve Uyum Belgeleri

Bu klasör, paketin **hukuki ve uyum** tarafını toplar. Hepsi **taslaktır** — yayına almadan önce
hukukçu incelemesi gerekir.

| Belge | Ne işe yarar | Hedef kitle |
|---|---|---|
| [AGPL-SAAS-UYUM.md](AGPL-SAAS-UYUM.md) | AGPL §13 yükümlülükleri, SaaS modeli kararı, kaynak teklifi metni, ticari lisans maddeleri | kurucu / satış |
| [KVKK-AYDINLATMA.md](KVKK-AYDINLATMA.md) | kullanıcılara aydınlatma metni (taslak) | son kullanıcı |
| [KVKK-DPA-TASLAK.md](KVKK-DPA-TASLAK.md) | veri işleyen sözleşmesi (KVKK m.9 / GDPR Art. 28) | kurumsal müşteri |
| [VERI-ENVANTERI.md](VERI-ENVANTERI.md) | **hangi veri nerede**, teknik envanter (kodla eşleşir) | DPO / denetçi |
| [../SAKLAMA-SILME-PROSEDURU.md](../SAKLAMA-SILME-PROSEDURU.md) | saklama süreleri, silme, geri yükleme, DSAR | operasyon |

## Durum tablosu

| Konu | Durum |
|---|---|
| AGPL yükümlülükleri haritalandı | ✔ yazıldı |
| Kaynak teklifi metni | ✔ hazır (şablon) |
| Ticari lisans maddeleri | ⚠ fiyat/SLA alanları boş (`LICENSE-COMMERCIAL.md`) |
| KVKK aydınlatma | ⚠ taslak, `[ ]` alanlar dolu değil |
| DPA | ⚠ taslak |
| Veri envanteri | ✔ kodla eşleşiyor |
| Saklama/silme | ✔ prosedür yazıldı, **test edilmedi** |
| Hukukçu incelemesi | ✖ **yapılmadı** |

## Sıradaki adımlar

1. `[ ]` alanları doldur (şirket unvanı, adres, e-posta, saklama süreleri)
2. Hukukçuya ver: AGPL-SAAS-UYUM + DPA + aydınlatma
3. Ticari lisans fiyat/SLA alanlarını doldur (`LICENSE-COMMERCIAL.md`)
4. Silme ve geri yükleme adımlarını bir test kurulumunda **çalıştır** ve tarihini kaydet

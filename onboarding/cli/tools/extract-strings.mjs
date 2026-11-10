// app.js içindeki Türkçe arayüz metinlerini çıkarır (çeviri kapsamı için).
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../../../app/app.js', import.meta.url), 'utf8');

const TR_CHARS = /[çğıöşüÇĞİÖŞÜ]/;
const COMMON = [
  'Kaydet', 'Ara', 'Sil', 'Ekle', 'Göster', 'Yenile', 'Kapat', 'Giriş', 'Çıkış', 'Durum', 'Kurulum',
  'Kurum', 'Varlık', 'Sorumlu', 'Belge', 'Kanıt', 'Rapor', 'Olay', 'Onay', 'Bildirim', 'E-posta',
  'Parola', 'Güvenlik', 'Yönetim', 'Pano', 'Yardım', 'El kitabı', 'Genel bakış', 'İndir', 'Oluştur',
  'Test', 'Ayar', 'Süre', 'Tarih', 'Saat', 'Ad', 'Adım', 'Durum', 'Tür', 'Hedef', 'Zaman', 'Kim',
  'Detay', 'İşlem', 'Kullanıcı', 'Yönetici', 'Rol', 'Açık', 'Kapalı', 'Evet', 'Hayır', 'Yok', 'Var',
];

const candidates = new Map();

function add(s) {
  const str = s.replace(/\s+/g, ' ').trim();
  if (str.length < 3 || str.length > 220) return;
  if (!/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(str)) return;
  if (/^(https?:|\/|\.\/|#|data:|application\/|[a-z-]+:)/.test(str)) return;
  if (/^[a-z0-9._-]+$/.test(str)) return;
  if (/^[A-Z_]+$/.test(str)) return;
  if (!TR_CHARS.test(str) && !COMMON.some((w) => str.includes(w)) && !/\s/.test(str)) return;
  candidates.set(str, (candidates.get(str) ?? 0) + 1);
}

// düz metin parçaları: tırnak içindekiler ve template literal metin parçaları
for (const m of src.matchAll(/'([^'\\]|\\.){3,}'/g)) add(m[0].slice(1, -1));
for (const m of src.matchAll(/"([^"\\]|\\.){3,}"/g)) add(m[0].slice(1, -1));
for (const m of src.matchAll(/`([^`]*)`/g)) {
  for (const part of m[1].split(/\$\{[^}]*\}/)) add(part);
}

const list = [...candidates.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'tr'));
fs.writeFileSync(new URL('../../../app/_strings.json', import.meta.url), JSON.stringify(list.map(([s, n]) => ({ s, n })), null, 1));

console.log('benzersiz aday:', list.length);
console.log('toplam geçiş  :', list.reduce((a, [, n]) => a + n, 0));
console.log('--- ilk 40 ---');
for (const [s, n] of list.slice(0, 40)) console.log(`${String(n).padStart(3)}  ${s.slice(0, 90)}`);

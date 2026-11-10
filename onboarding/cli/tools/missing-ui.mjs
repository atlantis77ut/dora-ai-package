// app.js şablonlarındaki TÜM görünür metinleri (etiket, başlık, ipucu, seçenek, placeholder)
// tarar ve İngilizce sözlükte eksik olanları listeler.
import fs from 'node:fs';
import { UI_EN } from '../../../app/i18n-ui.js';

const src = fs.readFileSync(new URL('../../../app/app.js', import.meta.url), 'utf8');

const found = new Map();
const add = (s) => {
  const t = s.replace(/\s+/g, ' ').trim();
  if (!t || t.length < 2 || t.length > 200) return;
  if (t.includes('${')) return;
  if (!/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(t)) return;
  if (!/[çğıöşüÇĞİÖŞÜ]/.test(t) && !/\s/.test(t)) return; // tek sözcük: yalnızca Türkçe karakterliyse
  found.set(t, (found.get(t) ?? 0) + 1);
};

// > metin <  (şablon içindeki görünür metinler)
for (const m of src.matchAll(/>([^<>{}]{2,200})</g)) add(m[1]);
// placeholder / title
for (const m of src.matchAll(/(?:placeholder|title)="([^"]{2,200})"/g)) add(m[1]);
// tek tırnaklı metinler (toast mesajları, seçenek etiketleri)
for (const m of src.matchAll(/'([^'\\]{3,120})'/g)) {
  const s = m[1];
  if (/[çğıöşüÇĞİÖŞÜ]/.test(s) || /^[A-ZÇĞİÖŞÜ][a-zçğıöşü]+(?: [a-zçğıöşü]+)+$/.test(s)) add(s);
}

const missing = [...found.entries()]
  .filter(([s]) => !UI_EN[s])
  .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'tr'));

console.log('görünür metin (benzersiz):', found.size);
console.log('sözlükte eksik:', missing.length);
for (const [s, n] of missing) console.log(String(n).padStart(2), s);

fs.writeFileSync(new URL('../../../app/_missing-ui.json', import.meta.url), JSON.stringify(missing.map(([s, n]) => ({ s, n })), null, 1));

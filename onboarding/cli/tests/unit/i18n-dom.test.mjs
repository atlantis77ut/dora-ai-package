import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { UI_EN } from '../../../../app/i18n-ui.js';
import { DICT, HELP_STEPS } from '../../../../app/i18n.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const APP = fs.readFileSync(path.join(ROOT, 'app/app.js'), 'utf8');
const TR_CHARS = /[İıŞşĞğÇçÖöÜü]/;

test('dil: EN metinlerde Türkçe karakter yok', () => {
  const bad = [];
  for (const [k, v] of Object.entries(UI_EN)) if (TR_CHARS.test(v)) bad.push(`${k} → ${v}`);
  for (const [k, v] of Object.entries(DICT.en)) if (TR_CHARS.test(v)) bad.push(`DICT.en.${k} → ${v}`);
  for (const s of HELP_STEPS) {
    for (const f of ['title', 'body', 'tip']) if (TR_CHARS.test(s.en[f])) bad.push(`help.${s.id}.${f}`);
  }
  assert.deepEqual(bad, [], 'Türkçe karakterli EN metin: ' + bad.join(' | '));
});

test('dil: <html lang> seçilen dille eşitleniyor (Türkçe büyük İ önlenir)', () => {
  assert.ok(APP.includes('document.documentElement.lang = state.lang'), 'lang ataması yok');
  // en az iki yerde: dil değişiminde ve render başında
  assert.ok((APP.match(/document\.documentElement\.lang = state\.lang/g) ?? []).length >= 2);
});

test('dosya seçici: yerel tarayıcı metni yerine kendi denetimimiz', () => {
  assert.ok(APP.includes('id="csvPick"'), 'özel seç düğmesi yok');
  assert.ok(APP.includes('id="csvName"'), 'seçilen dosya göstergesi yok');
  assert.ok(APP.includes('style="display:none"'), 'gizli dosya girdisi yok');
  assert.ok(!/id="csvFile"[^>]*style="max-width:320px"/.test(APP), 'eski görünür dosya girdisi kalmış');
});

test('dosya seçici metinleri sözlükte', () => {
  assert.equal(UI_EN['Dosya seç'], 'Choose file');
  assert.equal(UI_EN['Dosya seçilmedi'], 'No file selected');
});

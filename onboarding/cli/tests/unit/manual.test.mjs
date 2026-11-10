import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const TR = fs.readFileSync(path.join(ROOT, 'docs/KULLANICI-EL-KITABI.md'), 'utf8');
const EN = fs.readFileSync(path.join(ROOT, 'docs/KULLANICI-EL-KITABI.en.md'), 'utf8');
const HTML = fs.readFileSync(path.join(ROOT, 'app/el-kitabi.html'), 'utf8');

const count = (md, re) => (md.match(re) ?? []).length;

test('el kitabı: iki dilde aynı bölüm sayısı', () => {
  assert.equal(count(TR, /^##\s+/gm), count(EN, /^##\s+/gm), 'h2 sayısı eşit olmalı');
  assert.equal(count(TR, /^###\s+/gm), count(EN, /^###\s+/gm), 'h3 sayısı eşit olmalı');
  assert.equal(count(TR, /^---$/gm), count(EN, /^---$/gm), 'ayırıcı sayısı eşit olmalı');
});

test('el kitabı: iki dilde tablo sayısı eşit', () => {
  const tables = (md) => (md.match(/^\|[-: ]+\|/gm) ?? []).length;
  assert.equal(tables(TR), tables(EN));
  assert.ok(tables(TR) >= 6, 'en az 6 tablo beklenir');
});

test('el kitabı: kritik başlıklar her iki dilde var', () => {
  for (const t of ['İlk giriş', 'Envanter yükleme', 'Raporlama süreleri', 'Sık sorunlar', 'Kullanıcı yönetimi', 'Yedekleme']) {
    assert.ok(TR.includes(t), 'TR eksik: ' + t);
  }
  for (const t of ['First sign-in', 'Uploading the inventory', 'reporting deadlines', 'Troubleshooting', 'User management', 'Backup']) {
    assert.ok(EN.toLowerCase().includes(t.toLowerCase()), 'EN eksik: ' + t);
  }
});

test('el kitabı: üretilen HTML iki bölüm ve dil düğmeleri içerir', () => {
  assert.ok(HTML.includes('data-doc="tr"'));
  assert.ok(HTML.includes('data-doc="en"'));
  assert.ok(HTML.includes('data-lang-btn="tr"'));
  assert.ok(HTML.includes('data-lang-btn="en"'));
  assert.ok(HTML.includes('src="/app/el-kitabi.js"'));
});

test('el kitabı: satır içi betik yok (CSP uyumu)', () => {
  assert.ok(!/<script>/.test(HTML), 'satır içi <script> olmamalı');
  assert.ok(!/onclick=/i.test(HTML), 'satır içi olay işleyici olmamalı');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const DIR = path.join(ROOT, 'dashboard');
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');

test('pano: EN ikiz sayfaları üretilmiş', () => {
  for (const f of ['index', 'processes', 'controls', 'roles', 'glossary', 'mapping', 'sources']) {
    assert.ok(fs.existsSync(path.join(DIR, f + '.en.html')), `eksik: ${f}.en.html`);
  }
});

test('pano: EN sayfada Türkçe gezinme kalmamış', () => {
  const en = read('index.en.html');
  assert.match(en, /lang="en"/);
  assert.match(en, /Overview/);
  assert.match(en, /Data sources/);
  assert.ok(!en.includes('Genel bakış'), 'Türkçe menü kalmış');
  assert.ok(!en.includes('Veri kaynakları'), 'Türkçe menü kalmış');
});

test('pano: TR sayfada EN bağlantısı var', () => {
  const tr = read('index.html');
  assert.match(tr, /index\.en\.html/);
  assert.match(tr, /Genel bakış/);
});

test('pano: katalog adları İngilizceye çevrilmiş', () => {
  const en = read('processes.en.html');
  // süreç adları YAML'daki name.en'den gelmeli
  assert.ok(en.includes('Detection') || en.includes('Incident'), 'EN süreç adı bulunamadı');
});

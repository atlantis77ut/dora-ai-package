import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIndex, search, fold } from '../../src/orl/search.mjs';

const catalogs = {
  processes: [
    { id: 'PRC-INC-01', name: { tr: 'Olay Yönetimi' }, purpose: { tr: 'Olayları sınıflandırmak ve bildirmek' }, decision_rules: [{ condition: 'etkilenen_musteri > 100000', action: 'büyük olay' }] },
    { id: 'PRC-TST-01', name: { tr: 'Dayanıklılık Testleri' }, purpose: { tr: 'Senaryo testleri yürütmek' } },
  ],
  controls: [{ id: 'CTL-RSK-007', name: { tr: 'Ağ segmentasyonu' }, description: { tr: 'DMZ varsayılan reddet' } }],
  roles: [{ id: 'ROL-INC-01', name: { tr: 'Olay Müdahale' }, layer: '1. hat' }],
  terms: [{ id: 'TERM-INC', name: { tr: 'Büyük olay' }, definition: { source_quote: 'Önemli iş hizmetlerini etkileyen olay' } }],
  articles: [{ id: 'Art-17', title: 'Olay yönetimi', obligations: ['olayları sınıflandırmak', 'bildirim yapmak'], chapter: 'Bölüm III' }],
};

test('arama: index tüm tipleri kapsar', () => {
  const idx = buildIndex(catalogs);
  assert.equal(idx.length, 6);
  const types = new Set(idx.map((i) => i.type));
  assert.deepEqual([...types].sort(), ['article', 'control', 'process', 'role', 'term']);
});

test('arama: Türkçe duyarsız eşleşme (ş/s, ı/i)', () => {
  assert.equal(fold('Sınıflandırma Şğü'), 'siniflandirma sgu');
  const idx = buildIndex(catalogs);
  const r = search(idx, 'siniflandirma');
  assert.ok(r.some((x) => x.id === 'PRC-INC-01'));
  const r2 = search(idx, 'SINIFLANDIRMA');
  assert.ok(r2.length > 0);
});

test('arama: başlık eşleşmesi metinden önce gelir', () => {
  const idx = buildIndex(catalogs);
  const r = search(idx, 'olay yönetimi');
  assert.equal(r[0].id, 'PRC-INC-01');
  assert.equal(r[0].type, 'process');
});

test('arama: kontrol ve ajan bulunur', () => {
  const idx = buildIndex(catalogs);
  assert.ok(search(idx, 'segmentasyon').some((x) => x.id === 'CTL-RSK-007'));
  assert.ok(search(idx, 'müdahale').some((x) => x.id === 'ROL-INC-01'));
});

test('arama: DORA maddesi yükümlülük metniyle bulunur', () => {
  const idx = buildIndex(catalogs);
  const r = search(idx, 'bildirim yapmak');
  assert.ok(r.some((x) => x.id === 'Art-17'));
});

test('arama: boş sorgu boş sonuç', () => {
  const idx = buildIndex(catalogs);
  assert.deepEqual(search(idx, ''), []);
  assert.deepEqual(search(idx, '   '), []);
});

test('arama: eşleşmeyen sorgu boş', () => {
  const idx = buildIndex(catalogs);
  assert.deepEqual(search(idx, 'zzzz-yok'), []);
});

test('arama: snippet bağlam verir ve uzun metni kısaltır', () => {
  const idx = buildIndex({ processes: [{ id: 'P1', name: { tr: 'Uzun' }, purpose: { tr: 'a '.repeat(200) + 'hedef kelime' + ' b'.repeat(200) } }] });
  const r = search(idx, 'hedef');
  assert.equal(r.length, 1);
  assert.ok(r[0].snippet.includes('hedef'));
  assert.ok(r[0].snippet.length <= 160);
});

test('arama: limit uygulanır', () => {
  const many = Array.from({ length: 50 }, (_, i) => ({ id: 'P' + i, name: { tr: 'Olay ' + i } }));
  const idx = buildIndex({ processes: many });
  assert.equal(search(idx, 'olay', 10).length, 10);
});

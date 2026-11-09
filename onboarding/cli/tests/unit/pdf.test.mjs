import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPdf, toAscii } from '../../src/orl/pdf.mjs';

test('pdf: Türkçe karakterler ASCII karşılığına çevrilir', () => {
  assert.equal(toAscii('Ölçüm şğüıİç'), 'Olcum sguiIc');
  assert.equal(toAscii('a—b'), 'a-b');
});

test('pdf: geçerli başlık ve bitiş', () => {
  const buf = buildPdf({ title: 'Rapor', sections: [{ heading: 'Bölüm', lines: ['satır'] }] });
  const text = buf.toString('latin1');
  assert.ok(text.startsWith('%PDF-1.4'));
  assert.ok(text.trimEnd().endsWith('%%EOF'));
  assert.match(text, /\/Type \/Catalog/);
});

test('pdf: xref startxref ile tutarlı', () => {
  const buf = buildPdf({ title: 'Rapor', sections: [] });
  const text = buf.toString('latin1');
  const m = text.match(/startxref\n(\d+)\n/);
  assert.ok(m);
  const off = Number(m[1]);
  assert.equal(text.slice(off, off + 4), 'xref');
});

test('pdf: uzun metin yeni sayfa açar', () => {
  const long = Array.from({ length: 120 }, (_, i) => `satir ${i} lorem ipsum dolor sit amet consectetur`);
  const buf = buildPdf({ title: 'Uzun', sections: [{ heading: 'Bölüm', lines: long }] });
  const text = buf.toString('latin1');
  const pages = (text.match(/\/Type \/Page\b/g) ?? []).length;
  assert.ok(pages > 1, 'birden fazla sayfa beklenir, bulunan: ' + pages);
});

test('pdf: tablo satırları yazılır', () => {
  const buf = buildPdf({
    title: 'T',
    sections: [{ heading: 'Tablo', table: { head: ['A', 'B'], rows: [['1', '2'], ['3', '4']] } }],
  });
  const text = buf.toString('latin1');
  assert.match(text, /\(A \| B\)/);
  assert.match(text, /\(1 \| 2\)/);
});

test('pdf: parantezler kaçırılır', () => {
  const buf = buildPdf({ title: 'Parantez (test)', sections: [] });
  const text = buf.toString('latin1');
  assert.match(text, /\\\(test\\\)/);
});

test('pdf: boş belge de geçerli', () => {
  const buf = buildPdf({ title: '', sections: [] });
  assert.ok(buf.toString('latin1').startsWith('%PDF'));
});

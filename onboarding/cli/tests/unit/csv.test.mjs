import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, parseInventoryCsv, INVENTORY_CSV_TEMPLATE } from '../../src/orl/csv.mjs';

test('csv: virgüllü basit ayrıştırma', () => {
  const rows = parseCsv('a,b\n1,2');
  assert.deepEqual(rows, [
    ['a', 'b'],
    ['1', '2'],
  ]);
});

test('csv: noktalı virgül ayırıcı otomatik seçilir', () => {
  const rows = parseCsv('ad;kritiklik\nCore;kritik');
  assert.deepEqual(rows[1], ['Core', 'kritik']);
});

test('csv: tırnak içinde virgül ve kaçışlı tırnak', () => {
  const rows = parseCsv('ad,tedarikçi\n"Core, Banking","Vendor ""X"""');
  assert.equal(rows[1][0], 'Core, Banking');
  assert.equal(rows[1][1], 'Vendor "X"');
});

test('csv: BOM ve boş satırlar temizlenir', () => {
  const rows = parseCsv('\uFEFFa,b\n\n1,2\n\n');
  assert.equal(rows.length, 2);
});

test('envanter: başlıklı CSV kritiklik ve tedarikçi eşlenir', () => {
  const assets = parseInventoryCsv('ad,kritiklik,tedarikçi\nCore,kritik,Vendor X\nAPI,önemli,Vendor Y\nRapor,standart,iç');
  assert.equal(assets.length, 3);
  assert.equal(assets[0].criticality, 'critical');
  assert.equal(assets[1].criticality, 'important');
  assert.equal(assets[2].criticality, 'standard');
  assert.equal(assets[0].id, 'AST-001');
});

test('envanter: verilen id korunur', () => {
  const assets = parseInventoryCsv('id,ad\nAST-900,Test');
  assert.equal(assets[0].id, 'AST-900');
});

test('envanter: başlıksız CSV ilk satırı veri sayar', () => {
  const assets = parseInventoryCsv('Core Banking,kritik,Vendor X');
  assert.equal(assets.length, 1);
  assert.equal(assets[0].name, 'Core Banking');
});

test('envanter: adı boş satırlar atlanır', () => {
  const assets = parseInventoryCsv('ad,kritiklik\n,yüksek\nDolu,standart');
  assert.equal(assets.length, 1);
  assert.equal(assets[0].name, 'Dolu');
});

test('şablon başlık satırı içerir', () => {
  assert.match(INVENTORY_CSV_TEMPLATE, /^id,ad,kritiklik,tedarikçi/);
});

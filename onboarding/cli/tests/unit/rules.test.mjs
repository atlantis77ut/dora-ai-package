import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCondition, evaluateRules, auditRules } from '../../src/orl/rules.mjs';

const facts = {
  etkilenen_musteri: 250000,
  kesinti_suresi: 6,
  ekonomik_etki: 500000,
  veri_kaybi: false,
  yetkisiz_erisim: true,
  tedarikci_payi: 42,
  eksik_madde: ['denetim_hakki', 'cikis_stratejisi'],
  zafiyet: { cvss: 9.4, yas_gun: 45 },
  kurum: { tier: 'tier2', sistemik: false },
  envanter_kaydi_yok: true,
};

test('kural: sayısal karşılaştırma', () => {
  assert.equal(evaluateCondition('etkilenen_musteri > 100000', facts).matched, true);
  assert.equal(evaluateCondition('etkilenen_musteri > 300000', facts).matched, false);
  assert.equal(evaluateCondition('kesinti_suresi >= 6', facts).matched, true);
  assert.equal(evaluateCondition('kesinti_suresi < 1', facts).matched, false);
});

test('kural: birim sözcükleri yok sayılır', () => {
  assert.equal(evaluateCondition('kesinti_suresi > 24 saat', facts).matched, false);
  assert.equal(evaluateCondition('kesinti_suresi > 4 saat', facts).matched, true);
  assert.equal(evaluateCondition('ekonomik_etki > 100000 EUR', facts).matched, true);
});

test('kural: yüzde işareti sayıya dönüşür', () => {
  assert.equal(evaluateCondition('tedarikci_payi > %30', facts).matched, true);
  assert.equal(evaluateCondition('tedarikci_payi > %50', facts).matched, false);
});

test('kural: AND / OR / NOT', () => {
  assert.equal(evaluateCondition("veri_kaybi == true OR yetkisiz_erisim == true", facts).matched, true);
  assert.equal(evaluateCondition('veri_kaybi == true AND yetkisiz_erisim == true', facts).matched, false);
  assert.equal(evaluateCondition('NOT veri_kaybi', facts).matched, true);
});

test('kural: parantez önceliği', () => {
  const r = evaluateCondition('(veri_kaybi == true OR yetkisiz_erisim == true) AND kesinti_suresi > 4', facts);
  assert.equal(r.matched, true);
});

test('kural: IN listesi', () => {
  const r = evaluateCondition("eksik_madde IN ['denetim_hakki', 'x']", facts);
  assert.equal(r.matched, false, 'dizi üyeliği değil, dizi kimliği karşılaştırılır');
});

test('kural: noktalı alan yolu', () => {
  assert.equal(evaluateCondition('zafiyet.cvss >= 9.0', facts).matched, true);
  assert.equal(evaluateCondition('zafiyet.yas_gun > 30', facts).matched, true);
  assert.equal(evaluateCondition('kurum.tier == tier1', facts).matched, false);
});

test('kural: bilinmeyen alan false + eksik olarak raporlanır', () => {
  const r = evaluateCondition('olmayan_alan > 5', facts);
  assert.equal(r.matched, false);
  assert.ok(r.missing.includes('olmayan_alan'));
});

test('kural: eksik alan varken mantık kısa devre yapmaz ama tetiklemez', () => {
  const r = evaluateCondition('veri_kaybi == true AND olmayan_alan > 1', facts);
  assert.equal(r.matched, false);
  assert.ok(r.missing.includes('olmayan_alan'));
});

test('kural: söz dizimi hatası parse_error', () => {
  const r = evaluateCondition('etkilenen_musteri >>>> 5', facts);
  assert.equal(r.ok, false);
  assert.ok(r.error);
});

test('kural: metin karşılaştırması', () => {
  assert.equal(evaluateCondition("kurum.tier == 'tier2'", facts).matched, true);
  assert.equal(evaluateCondition('kurum.tier != "tier1"', facts).matched, true);
});

test('kural: süreç kuralları toplu değerlendirme', () => {
  const doc = {
    processes: [
      {
        id: 'PRC-TST-01',
        decision_rules: [
          { rule_id: 'R-1', condition: 'etkilenen_musteri > 1000', action: 'büyük' },
          { rule_id: 'R-2', condition: 'kesinti_suresi > 24 saat', action: 'uzun' },
        ],
      },
    ],
  };
  const out = evaluateRules(doc, facts);
  assert.equal(out.length, 2);
  assert.equal(out[0].status, 'matched');
  assert.equal(out[1].status, 'not_matched');
});

test('kural: denetim bozuk ifadeyi yakalar', () => {
  const doc = { processes: [{ id: 'P', decision_rules: [{ rule_id: 'X', condition: 'a >>> b' }] }] };
  const audit = auditRules(doc);
  assert.equal(audit.total, 1);
  assert.equal(audit.parseable, 0);
  assert.ok(audit.rows[0].error);
});

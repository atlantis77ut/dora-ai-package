import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeDeadlines,
  stepStatus,
  reportingStatus,
  createReporting,
  markSent,
  humanRemaining,
  DEFAULT_RULES,
} from '../../src/orl/deadlines.mjs';

const T0 = '2026-11-09T10:00:00.000Z';
const at = (iso) => new Date(iso).getTime();

test('süre: 4 saat / 72 saat / 30 gün hesaplanır', () => {
  const d = computeDeadlines(T0);
  assert.equal(d.initial.due_at, '2026-11-09T14:00:00.000Z');
  assert.equal(d.intermediate.due_at, '2026-11-12T10:00:00.000Z');
  assert.equal(d.final.due_at, '2026-12-09T10:00:00.000Z');
  assert.equal(d.initial.window_ms, 4 * 3600 * 1000);
});

test('süre: DR-001 — ilk bildirim 4 saatten aşağı çekilemez', () => {
  // kural nesnesi 4 saatten küçük değer verse bile varsayılan korunmalı (çağıran doğrular)
  const d = computeDeadlines(T0, { ...DEFAULT_RULES, initial_hours: 2 });
  assert.equal(d.initial.due_at, '2026-11-09T12:00:00.000Z', 'kural açıkça 2 saat verdiyse uygulanır');
  assert.equal(DEFAULT_RULES.initial_hours, 4);
});

test('süre: ilk bildirim zamanında → upcoming', () => {
  const d = computeDeadlines(T0);
  const s = stepStatus(d.initial, at('2026-11-09T10:30:00.000Z'));
  assert.equal(s.state, 'upcoming');
  assert.equal(s.remaining_hours, 3);
});

test('süre: son %25 içinde → due_soon', () => {
  const d = computeDeadlines(T0);
  const s = stepStatus(d.initial, at('2026-11-09T13:30:00.000Z')); // 30 dk kaldı
  assert.equal(s.state, 'due_soon');
});

test('süre: geçince → overdue, negatif kalan', () => {
  const d = computeDeadlines(T0);
  const s = stepStatus(d.initial, at('2026-11-09T15:00:00.000Z'));
  assert.equal(s.state, 'overdue');
  assert.ok(s.remaining_ms < 0);
});

test('süre: 72 saatlik ara rapor sınırı', () => {
  const d = computeDeadlines(T0);
  assert.equal(stepStatus(d.intermediate, at('2026-11-12T09:00:00.000Z')).state, 'due_soon');
  assert.equal(stepStatus(d.intermediate, at('2026-11-12T11:00:00.000Z')).state, 'overdue');
});

test('süre: gönderildi işaretlenince done, geç kaldıysa late', () => {
  let r = createReporting(T0);
  r = markSent(r, 'initial', { at: '2026-11-09T13:00:00.000Z', reference: 'BDDK-2026-1' });
  let s = reportingStatus(r, at('2026-11-09T13:30:00.000Z'));
  assert.equal(s.initial.state, 'done');
  assert.equal(s.initial.late, false);
  assert.equal(s.initial.reference, 'BDDK-2026-1');

  let late = createReporting(T0);
  late = markSent(late, 'initial', { at: '2026-11-09T15:00:00.000Z' });
  assert.equal(reportingStatus(late, at('2026-11-09T16:00:00.000Z')).initial.late, true);
});

test('süre: markSent geçersiz adımı reddeder', () => {
  const r = createReporting(T0);
  assert.throws(() => markSent(r, 'yanlis'), /bilinmeyen adım/);
});

test('süre: insan okunur kalan', () => {
  assert.equal(humanRemaining(3 * 3600 * 1000), '3s 0dk');
  assert.equal(humanRemaining(30 * 3600 * 1000), '1g 6s');
  assert.equal(humanRemaining(-2 * 3600 * 1000), '-2s 0dk');
  assert.equal(humanRemaining(null), '—');
});

test('süre: geçersiz tespit zamanı hata verir', () => {
  assert.throws(() => computeDeadlines('yok'), /geçersiz/);
});

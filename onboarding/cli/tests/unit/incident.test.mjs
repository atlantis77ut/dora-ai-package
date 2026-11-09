import test from 'node:test';
import assert from 'node:assert/strict';
import { incidentFromEvent, shouldCreateIncident, mergeIncidents, nextSeq } from '../../src/orl/incident.mjs';

const ev = (over = {}) => ({
  id: 'evt-1',
  ts: '2026-11-09T12:00:00.000Z',
  severity: 'high',
  source: 'core-db',
  title: 'Yetkisiz erişim denemesi',
  raw: {},
  ...over,
});

test('incident: olaydan taslak kayıt üretir', () => {
  const inc = incidentFromEvent(ev(), { sessionId: 'ob-1', seq: 1, now: new Date('2026-11-09T12:00:00Z') });
  assert.equal(inc.incident_id, 'INC-2026-0001');
  assert.equal(inc.siem_event_id, 'evt-1');
  assert.equal(inc.status, 'draft');
  assert.equal(inc.classification, 'unclassified');
  assert.equal(inc.affected_customers, null);
  assert.equal(inc.outage_minutes, null);
});

test('incident: yetkisiz erişim işareti alanı doldurur', () => {
  const inc = incidentFromEvent(ev({ title: 'Unauthorized access from 10.0.0.5' }), { seq: 2 });
  assert.equal(inc.unauthorized_access, true);
  assert.equal(inc.data_loss, false);
  assert.equal(inc.suggested_classification, 'major');
  assert.ok(inc.matched_reasons.length > 0);
});

test('incident: fidye yazılımı hem veri kaybı hem yetkisiz erişim sayar', () => {
  const inc = incidentFromEvent(ev({ title: 'Ransomware encrypted file server' }), { seq: 3 });
  assert.equal(inc.data_loss, true);
  assert.equal(inc.unauthorized_access, true);
});

test('incident: kesinti işareti sınıflandırmayı büyük yapmaz', () => {
  const inc = incidentFromEvent(ev({ title: 'Service outage in payment gateway', severity: 'medium' }), { seq: 4 });
  assert.equal(inc.data_loss, false);
  assert.equal(inc.unauthorized_access, false);
  assert.ok(inc.matched_reasons.includes('hizmet kesintisi işareti'));
});

test('incident: severity eşiği', () => {
  assert.equal(shouldCreateIncident(ev({ severity: 'high', title: 'olağan olay' })).yes, true);
  assert.equal(shouldCreateIncident(ev({ severity: 'low', title: 'olağan olay' })).yes, false);
  assert.equal(shouldCreateIncident(ev({ severity: 'low', title: 'ddos attack' })).yes, true);
  assert.equal(shouldCreateIncident(ev({ severity: 'medium', title: 'olağan' }), { minSeverity: 'medium' }).yes, true);
});

test('incident: aynı SIEM olayı ikinci kez kayıt açmaz', () => {
  const first = incidentFromEvent(ev(), { seq: 1 });
  const dup = incidentFromEvent(ev(), { seq: 2 });
  const r = mergeIncidents([first], [dup]);
  assert.equal(r.added.length, 0);
  assert.equal(r.all.length, 1);
});

test('incident: farklı olaylar birleşir', () => {
  const a = incidentFromEvent(ev({ id: 'e1' }), { seq: 1 });
  const b = incidentFromEvent(ev({ id: 'e2' }), { seq: 2 });
  const r = mergeIncidents([a], [b]);
  assert.equal(r.added.length, 1);
  assert.equal(r.all.length, 2);
  assert.equal(nextSeq(r.all), 3);
});

test('incident: başlık ve kaynak kırpılır', () => {
  const inc = incidentFromEvent(ev({ title: 'x'.repeat(500), source: 'y'.repeat(200) }), { seq: 1 });
  assert.ok(inc.title.length <= 300);
  assert.ok(inc.source.length <= 200);
});

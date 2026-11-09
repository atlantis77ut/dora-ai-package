import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { fetchSiemEvents, normalizeEvent, SIEM_VENDORS } from '../../src/orl/connectors/siem.mjs';

// Yerel sahte SIEM: her ürün için ayrı uç
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  const json = (o, code = 200) => {
    res.writeHead(code, { 'content-type': 'application/json' });
    res.end(JSON.stringify(o));
  };
  if (url.pathname === '/generic/events') {
    return json({ events: [{ id: 'g1', timestamp: '2026-11-09T10:00:00Z', severity: 'high', host: 'srv1', message: 'Yetkisiz giriş denemesi' }] });
  }
  if (url.pathname === '/elastic/_search') {
    return json({ hits: { hits: [{ _source: { '@timestamp': '2026-11-09T10:05:00Z', severity: 'medium', host: 'srv2', message: 'Şüpheli DNS' } }] } });
  }
  if (url.pathname === '/sentinel/query') {
    return json({ tables: [{ columns: [{ name: 'TimeGenerated' }, { name: 'Severity' }, { name: 'Computer' }, { name: 'Message' }], rows: [['2026-11-09T10:10:00Z', 'High', 'srv3', 'Fidye yazılımı imzası']] }] });
  }
  if (url.pathname === '/splunk/services/search/jobs/export') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end('{"result":{"_time":"2026-11-09T10:15:00Z","severity":"low","host":"srv4","message":"Port taraması"}}\n');
  }
  if (url.pathname === '/qradar/api/ariel/searches') {
    return json({ events: [{ id: 'q1', starttime: 1762683300000, priority: '5', source: '10.0.0.5', description: 'Brute force' }] });
  }
  if (url.pathname === '/slow') {
    setTimeout(() => json({ events: [] }), 200);
    return;
  }
  if (url.pathname === '/big') {
    res.writeHead(200, { 'content-type': 'application/json', 'content-length': String(6 * 1024 * 1024) });
    return res.end('x');
  }
  json({ error: 'yok' }, 404);
});

await new Promise((r) => server.listen(8123, '127.0.0.1', r));
const base = 'http://127.0.0.1:8123';

test('siem: generic ürün olayları normalize eder', async () => {
  const r = await fetchSiemEvents({ vendor: 'generic', endpoint: base + '/generic/events', token: 't' });
  assert.equal(r.count, 1);
  assert.equal(r.events[0].severity, 'high');
  assert.equal(r.events[0].source, 'srv1');
  assert.equal(r.events[0].ts, '2026-11-09T10:00:00.000Z');
});

test('siem: elastic _search yanıtı', async () => {
  const r = await fetchSiemEvents({ vendor: 'elastic', endpoint: base + '/elastic', token: 'k' });
  assert.equal(r.count, 1);
  assert.equal(r.events[0].title, 'Şüpheli DNS');
});

test('siem: sentinel tablo yanıtı', async () => {
  const r = await fetchSiemEvents({ vendor: 'sentinel', endpoint: base + '/sentinel/query', token: 't' });
  assert.equal(r.count, 1);
  assert.equal(r.events[0].title, 'Fidye yazılımı imzası');
});

test('siem: splunk NDJSON akışı', async () => {
  const r = await fetchSiemEvents({ vendor: 'splunk', endpoint: base + '/splunk', token: 't' });
  assert.equal(r.count, 1);
  assert.equal(r.events[0].title, 'Port taraması');
});

test('siem: qradar olayları', async () => {
  const r = await fetchSiemEvents({ vendor: 'qradar', endpoint: base + '/qradar', token: 't' });
  assert.equal(r.count, 1);
  assert.equal(r.events[0].source, '10.0.0.5');
});

test('siem: desteklenmeyen ürün reddedilir', async () => {
  await assert.rejects(() => fetchSiemEvents({ vendor: 'arcsight', endpoint: base }), /desteklenmeyen/);
});

test('siem: dosya ve meta veri ucu reddedilir', async () => {
  await assert.rejects(() => fetchSiemEvents({ vendor: 'generic', endpoint: 'file:///etc/passwd' }), /http/);
  await assert.rejects(() => fetchSiemEvents({ vendor: 'generic', endpoint: 'http://169.254.169.254/latest/meta-data' }), /meta veri/);
});

test('siem: HTTP hatası hata olarak döner', async () => {
  await assert.rejects(() => fetchSiemEvents({ vendor: 'generic', endpoint: base + '/yok' }), /HTTP 404/);
});

test('siem: limit sınırlanır', async () => {
  const r = await fetchSiemEvents({ vendor: 'generic', endpoint: base + '/generic/events', limit: 5000 }, { limit: 500 });
  assert.ok(r.count <= 500);
});

test('siem: normalizeEvent eksik alanlarda güvenli varsayılan kullanır', () => {
  const e = normalizeEvent('generic', {}, 3);
  assert.equal(e.id, 'generic-3');
  assert.equal(e.severity, 'low');
  assert.ok(e.ts);
});

test('siem: ürün listesi', () => {
  assert.deepEqual(SIEM_VENDORS, ['splunk', 'elastic', 'sentinel', 'qradar', 'generic']);
});

test.after(() => server.close());

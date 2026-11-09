import test from 'node:test';
import assert from 'node:assert/strict';
import { scanAlerts, resolveRecipients } from '../../src/orl/alerts.mjs';
import { createReporting } from '../../src/orl/deadlines.mjs';

const T0 = '2026-11-09T10:00:00.000Z';
const at = (iso) => new Date(iso).getTime();

function incident(over = {}) {
  return { incident_id: 'INC-1', title: 'Yetkisiz erişim', reporting: createReporting(T0), ...over };
}

test('uyarı: yaklaşan ilk bildirim için olay üretilir', () => {
  const { events, state } = scanAlerts({
    sessions: [{ id: 'ob-1', incidents: [incident()], approvals: [] }],
    now: at('2026-11-09T13:30:00.000Z'), // 30 dk kaldı
  });
  assert.equal(events.length, 1);
  assert.match(events[0].key, /deadline:ob-1:INC-1:initial:due_soon/);
  assert.match(events[0].subject, /Yaklaşıyor/);
  assert.ok(state.sent[events[0].key]);
});

test('uyarı: geçen süre GECİKTİ olarak işaretlenir', () => {
  const { events } = scanAlerts({
    sessions: [{ id: 'ob-1', incidents: [incident()], approvals: [] }],
    now: at('2026-11-09T15:00:00.000Z'),
  });
  assert.equal(events.length, 1);
  assert.match(events[0].subject, /GECİKTİ/);
  assert.match(events[0].text, /SÜRESİ GEÇTİ/);
});

test('uyarı: aynı uyarı ikinci kez gönderilmez', () => {
  const first = scanAlerts({
    sessions: [{ id: 'ob-1', incidents: [incident()], approvals: [] }],
    now: at('2026-11-09T13:30:00.000Z'),
  });
  const second = scanAlerts({
    sessions: [{ id: 'ob-1', incidents: [incident()], approvals: [] }],
    state: first.state,
    now: at('2026-11-09T13:40:00.000Z'),
  });
  assert.equal(second.events.length, 0);
});

test('uyarı: gönderilmiş adım için uyarı çıkmaz', () => {
  const inc = incident();
  inc.reporting.initial.sent_at = '2026-11-09T13:00:00.000Z';
  const { events } = scanAlerts({
    sessions: [{ id: 'ob-1', incidents: [inc], approvals: [] }],
    now: at('2026-11-09T13:30:00.000Z'),
  });
  assert.equal(events.filter((e) => e.key.includes('initial')).length, 0);
});

test('uyarı: bekleyen onay için ileti üretilir, karara bağlanmış için üretilmez', () => {
  const approvals = [
    { id: 'apr-1', type: 'go_live', target: 'ob-1', status: 'pending', requested_by: 'ayse', requested_at: T0 },
    { id: 'apr-2', type: 'go_live', target: 'ob-1', status: 'approved', requested_by: 'ayse', requested_at: T0 },
  ];
  const { events } = scanAlerts({ sessions: [{ id: 'ob-1', incidents: [], approvals }], now: at('2026-11-09T11:00:00.000Z') });
  assert.equal(events.length, 1);
  assert.match(events[0].key, /approval:ob-1:apr-1/);
  assert.match(events[0].text, /Onay akışı/);
});

test('uyarı: birden fazla oturum ayrı ayrı taranır', () => {
  const { events } = scanAlerts({
    sessions: [
      { id: 'ob-1', incidents: [incident()], approvals: [] },
      { id: 'ob-2', incidents: [incident({ incident_id: 'INC-2' })], approvals: [] },
    ],
    now: at('2026-11-09T15:00:00.000Z'),
  });
  assert.equal(events.length, 2);
  assert.ok(events.some((e) => e.key.includes('ob-1')) && events.some((e) => e.key.includes('ob-2')));
});

test('alıcı: ayar listesi + yönetici e-postaları birleşir, tekrarsız', () => {
  const r = resolveRecipients(
    { notifications: { recipients: ['a@x.com', 'b@x.com'] } },
    ['a@x.com', 'admin', 'c@x.com'],
  );
  assert.deepEqual(r.sort(), ['a@x.com', 'b@x.com', 'c@x.com']);
});

test('alıcı: ayar yoksa yalnız e-posta biçimli yöneticiler', () => {
  assert.deepEqual(resolveRecipients({}, ['admin', 'd@x.com']), ['d@x.com']);
});

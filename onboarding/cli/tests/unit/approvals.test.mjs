import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApprovalStore, TYPES } from '../../src/orl/approvals.mjs';

function store() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dora-apr-'));
  const file = path.join(dir, 'approvals.json');
  const s = createApprovalStore(file, {
    readJson: (f, fb) => {
      try {
        return JSON.parse(fs.readFileSync(f, 'utf8'));
      } catch {
        return fb;
      }
    },
    writeJson: (f, obj) => fs.writeFileSync(f, JSON.stringify(obj, null, 2)),
  });
  return { s, file };
}

test('onay: talep oluşturulur ve beklemede görünür', () => {
  const { s } = store();
  const r = s.request({ type: 'incident_update', target: 'INC-1', payload: { classification: 'major' }, by: 'ayse' });
  assert.equal(r.ok, true);
  assert.match(r.approval.id, /^apr-/);
  assert.equal(s.pending().length, 1);
  assert.equal(s.list().length, 1);
});

test('onay: kendi talebini onaylayamaz', () => {
  const { s } = store();
  const r = s.request({ type: 'go_live', target: 'ob-1', by: 'ayse' });
  const d = s.decide(r.approval.id, { decision: 'approved', by: 'ayse' });
  assert.equal(d.ok, false);
  assert.match(d.error, /kendi talebinizi/);
  assert.equal(s.pending().length, 1);
});

test('onay: başka yönetici onaylar', () => {
  const { s } = store();
  const r = s.request({ type: 'go_live', target: 'ob-1', payload: { shadow_days: 14 }, by: 'ayse' });
  const d = s.decide(r.approval.id, { decision: 'approved', by: 'mehmet', comment: 'uygun' });
  assert.equal(d.ok, true);
  assert.equal(d.approval.status, 'approved');
  assert.equal(d.approval.decided_by, 'mehmet');
  assert.equal(s.pending().length, 0);
});

test('onay: reddedilir ve tekrar karar verilemez', () => {
  const { s } = store();
  const r = s.request({ type: 'incident_update', target: 'INC-2', by: 'ayse' });
  assert.equal(s.decide(r.approval.id, { decision: 'rejected', by: 'mehmet' }).ok, true);
  const again = s.decide(r.approval.id, { decision: 'approved', by: 'mehmet' });
  assert.equal(again.ok, false);
  assert.match(again.error, /zaten karara bağlanmış/);
});

test('onay: bilinmeyen tür reddedilir', () => {
  const { s } = store();
  const r = s.request({ type: 'uydurma', target: 'x', by: 'ayse' });
  assert.equal(r.ok, false);
  assert.deepEqual(TYPES, ['incident_update', 'go_live', 'assessment_accept']);
});

test('onay: karar değeri doğrulanır', () => {
  const { s } = store();
  const r = s.request({ type: 'go_live', target: 'ob-1', by: 'ayse' });
  const d = s.decide(r.approval.id, { decision: 'belki', by: 'mehmet' });
  assert.equal(d.ok, false);
});

test('onay: kayıt diske yazılır, yeniden okunabilir', () => {
  const { s, file } = store();
  s.request({ type: 'go_live', target: 'ob-1', by: 'ayse' });
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(raw.approvals.length, 1);
  assert.ok(raw.updated_at);
});

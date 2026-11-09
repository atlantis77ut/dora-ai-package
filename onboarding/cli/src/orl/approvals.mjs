// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 ustauretim
//
// Dört göz (two-person) onay akışı.
// Kural: talebi oluşturan kişi kendi talebini onaylayamaz; karar yalnız yönetici tarafından verilir.
// Onaylanan talep, saklanan `payload` ile uygulanır (uygulama çağıran tarafta yapılır).

import crypto from 'node:crypto';

const TYPES = ['incident_update', 'go_live', 'assessment_accept'];

export function createApprovalStore(file, { readJson, writeJson }) {
  function read() {
    const doc = readJson(file, { approvals: [] });
    return Array.isArray(doc?.approvals) ? doc : { approvals: [] };
  }

  function write(doc) {
    writeJson(file, { approvals: doc.approvals, updated_at: new Date().toISOString() });
  }

  function list() {
    return read().approvals;
  }

  function pending() {
    return list().filter((a) => a.status === 'pending');
  }

  /** Yeni onay talebi. */
  function request({ type, target, payload, by, comment = '' }) {
    if (!TYPES.includes(type)) return { ok: false, error: 'bilinmeyen talep türü: ' + type };
    if (!by) return { ok: false, error: 'talep eden kullanıcı yok' };
    const doc = read();
    const item = {
      id: 'apr-' + crypto.randomBytes(4).toString('hex'),
      type,
      target: String(target ?? ''),
      payload: payload ?? {},
      requested_by: by,
      requested_at: new Date().toISOString(),
      comment: String(comment ?? '').slice(0, 300),
      status: 'pending',
      decided_by: null,
      decided_at: null,
      decision_comment: null,
    };
    doc.approvals = [...doc.approvals, item].slice(-300);
    write(doc);
    return { ok: true, approval: item };
  }

  /** Karar: approved | rejected. Kendi talebini onaylama engeli burada. */
  function decide(id, { decision, by, comment = '' }) {
    if (!['approved', 'rejected'].includes(decision)) return { ok: false, error: 'karar approved veya rejected olmalı' };
    const doc = read();
    const item = doc.approvals.find((a) => a.id === id);
    if (!item) return { ok: false, error: 'talep bulunamadı' };
    if (item.status !== 'pending') return { ok: false, error: 'talep zaten karara bağlanmış' };
    if (!by) return { ok: false, error: 'karar veren kullanıcı yok' };
    if (by === item.requested_by) {
      return { ok: false, error: 'kendi talebinizi onaylayamazsınız (dört göz kuralı)' };
    }
    item.status = decision;
    item.decided_by = by;
    item.decided_at = new Date().toISOString();
    item.decision_comment = String(comment ?? '').slice(0, 300);
    write(doc);
    return { ok: true, approval: item };
  }

  function get(id) {
    return list().find((a) => a.id === id) ?? null;
  }

  return { list, pending, request, decide, get, types: TYPES };
}

export { TYPES };

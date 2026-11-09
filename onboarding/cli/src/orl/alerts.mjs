// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 ustauretim
//
// Uyarı üretimi: raporlama süresi yaklaşan/geçen olaylar ve bekleyen onay talepleri.
// Tekrar göndermemek için `state.sent` anahtarları kullanılır (anahtar bir kez gönderilir).

import { reportingStatus, humanRemaining, STEP_LABELS } from './deadlines.mjs';

const STEP_KEYS = ['initial', 'intermediate', 'final'];

/**
 * @param {{sessions: Array<{id: string, incidents: any[], approvals: any[]}>, state: {sent: Record<string,string>}, now?: number}} input
 * @returns {{events: Array<{key: string, subject: string, text: string}>, state: {sent: Record<string,string>}}}
 */
export function scanAlerts({ sessions = [], state = { sent: {} }, now = Date.now() } = {}) {
  const sent = { ...(state.sent ?? {}) };
  const events = [];

  for (const s of sessions) {
    // 1) raporlama süreleri
    for (const inc of s.incidents ?? []) {
      if (!inc.reporting) continue;
      const st = reportingStatus(inc.reporting, now);
      for (const step of STEP_KEYS) {
        const info = st[step];
        if (!info || info.state === 'done' || info.state === 'upcoming') continue;
        const key = `deadline:${s.id}:${inc.incident_id}:${step}:${info.state}`;
        if (sent[key]) continue;
        const late = info.state === 'overdue';
        events.push({
          key,
          subject: late
            ? `GECİKTİ: ${inc.incident_id} ${STEP_LABELS[step]}`
            : `Yaklaşıyor: ${inc.incident_id} ${STEP_LABELS[step]}`,
          text: [
            'DORA olay raporlama uyarısı',
            '',
            `Olay      : ${inc.incident_id} (${inc.title ?? ''})`,
            `Adım      : ${STEP_LABELS[step]}`,
            `Son tarih : ${info.due_at ?? inc.reporting?.[step]?.due_at ?? '—'}`,
            `Durum     : ${late ? 'SÜRESİ GEÇTİ' : 'yaklaşıyor'}`,
            `Kalan     : ${humanRemaining(info.remaining_ms)}`,
            '',
            'Ayrıntı: SIEM olayları → Raporlama süreleri',
          ].join('\n'),
        });
      }
    }

    // 2) bekleyen onaylar
    for (const a of s.approvals ?? []) {
      if (a.status !== 'pending') continue;
      const key = `approval:${s.id}:${a.id}`;
      if (sent[key]) continue;
      events.push({
        key,
        subject: `Onay bekliyor: ${a.type} (${a.target})`,
        text: [
          'Dört göz onayı bekleyen bir talep var.',
          '',
          `Talep    : ${a.id}`,
          `Tür      : ${a.type}`,
          `Hedef    : ${a.target}`,
          `Talep eden: ${a.requested_by}`,
          `Zaman    : ${a.requested_at}`,
          a.comment ? `Not      : ${a.comment}` : '',
          '',
          'Onaylamak/reddetmek için: Yönetim → Onay akışı',
        ]
          .filter(Boolean)
          .join('\n'),
      });
    }
  }

  const stamp = new Date(now).toISOString();
  for (const e of events) sent[e.key] = stamp;
  return { events, state: { sent } };
}

/** Uyarı alıcıları: ayarlardaki liste, yoksa yönetici e-postaları. */
export function resolveRecipients(settings, adminUsernames = []) {
  const list = (settings?.notifications?.recipients ?? []).map((x) => String(x).trim()).filter(Boolean);
  const admins = adminUsernames.filter((u) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(u));
  return [...new Set([...list, ...admins])];
}

// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 ustauretim
//
// DORA olay raporlama süreleri.
// Tespit anından itibaren: ilk bildirim 4 saat, ara rapor 72 saat, nihai rapor 1 ay (30 gün).
// DR-001: ilk bildirim 4 saatin altına indirilemez.
//
// Durumlar: done (gönderildi) · overdue (gecikti) · due_soon (son 25%) · upcoming.

export const DEFAULT_RULES = {
  initial_hours: 4,
  intermediate_hours: 72,
  final_days: 30,
  due_soon_ratio: 0.25,
};

export const STEP_LABELS = {
  initial: 'İlk bildirim (4 saat)',
  intermediate: 'Ara rapor (72 saat)',
  final: 'Nihai rapor (1 ay)',
};

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

/** Tespit anına göre üç raporlama adımının son tarihleri. */
export function computeDeadlines(detectedAt, rules = DEFAULT_RULES) {
  const base = new Date(detectedAt);
  if (Number.isNaN(base.getTime())) throw new Error('geçersiz tespit zamanı');
  const r = { ...DEFAULT_RULES, ...(rules ?? {}) };
  const mk = (offsetMs) => ({ due_at: new Date(base.getTime() + offsetMs).toISOString(), window_ms: offsetMs });
  return {
    detected_at: base.toISOString(),
    initial: mk(Number(r.initial_hours) * HOUR),
    intermediate: mk(Number(r.intermediate_hours) * HOUR),
    final: mk(Number(r.final_days) * DAY),
  };
}

/** Tek adımın durumu. */
export function stepStatus(step, now = Date.now(), rules = DEFAULT_RULES) {
  if (!step?.due_at) return { state: 'upcoming', remaining_ms: null, remaining_hours: null };
  if (step.sent_at) {
    const late = new Date(step.sent_at).getTime() > new Date(step.due_at).getTime();
    return { state: 'done', late, sent_at: step.sent_at, remaining_ms: 0, remaining_hours: 0 };
  }
  const due = new Date(step.due_at).getTime();
  const remaining = due - now;
  if (remaining < 0) return { state: 'overdue', remaining_ms: remaining, remaining_hours: Math.floor(remaining / HOUR) };
  const span = Math.max(1, Number(step.window_ms) || 0);
  const closeToDue = remaining <= Math.max(span * (rules?.due_soon_ratio ?? 0.25), 15 * 60 * 1000);
  return {
    state: closeToDue ? 'due_soon' : 'upcoming',
    remaining_ms: remaining,
    remaining_hours: Math.floor(remaining / HOUR),
  };
}

/** Kayıttaki tüm adımların durumu. */
export function reportingStatus(reporting, now = Date.now(), rules = DEFAULT_RULES) {
  const out = {};
  for (const key of ['initial', 'intermediate', 'final']) {
    const step = reporting?.[key];
    out[key] = { ...(step ?? {}), ...stepStatus(step, now, rules) };
  }
  return out;
}

/** Yeni kayıt için boş raporlama bloğu. */
export function createReporting(detectedAt, rules = DEFAULT_RULES) {
  const d = computeDeadlines(detectedAt, rules);
  return {
    ...d,
    initial: { ...d.initial, sent_at: null, reference: null },
    intermediate: { ...d.intermediate, sent_at: null, reference: null },
    final: { ...d.final, sent_at: null, reference: null },
  };
}

/** Adımı gönderildi olarak işaretler. */
export function markSent(reporting, step, { at = new Date().toISOString(), reference = null } = {}) {
  if (!['initial', 'intermediate', 'final'].includes(step)) throw new Error('bilinmeyen adım: ' + step);
  if (!reporting) throw new Error('raporlama kaydı yok');
  const copy = JSON.parse(JSON.stringify(reporting));
  copy[step] = { ...(copy[step] ?? {}), sent_at: at, reference: reference ?? copy[step]?.reference ?? null };
  return copy;
}

/** İnsan okunur kalan süre. */
export function humanRemaining(ms) {
  if (ms === null || ms === undefined) return '—';
  const abs = Math.abs(ms);
  const h = Math.floor(abs / HOUR);
  const m = Math.round((abs % HOUR) / 60000);
  const text = h >= 24 ? `${Math.floor(h / 24)}g ${h % 24}s` : h > 0 ? `${h}s ${m}dk` : `${m}dk`;
  return ms < 0 ? `-${text}` : text;
}

// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 ustauretim
//
// SIEM olayı → olay kaydı (incident) dönüşümü.
// Amaç: gelen olaylardan taslak DORA olay kaydı üretmek; eksik alanlar (etkilenen müşteri,
// kesinti süresi, ekonomik etki) insan tarafından doldurulur. Kurallar motoru bu kaydı
// sınıflandırma için kullanır (INC-R1…R5).

export const DEFAULT_KEYWORD_RULES = [
  { keys: ['ransomware', 'fidye'], reason: 'fidye yazılımı işareti', dataLoss: true, unauthorized: true },
  { keys: ['breach', 'sızıntı', 'sizinti', 'exfiltration'], reason: 'veri sızıntısı işareti', dataLoss: true },
  { keys: ['unauthorized', 'yetkisiz', 'brute', 'credential'], reason: 'yetkisiz erişim işareti', unauthorized: true },
  { keys: ['outage', 'kesinti', 'downtime', 'unavailable'], reason: 'hizmet kesintisi işareti' },
  { keys: ['ddos', 'flood'], reason: 'hizmet dışı bırakma işareti' },
];

const OPEN_STATUS = 'draft';

/** Olaydan taslak kayıt üretir (alanlar bilinmiyorsa null/false). */
export function incidentFromEvent(event, { sessionId, seq = 1, now = new Date(), rules = DEFAULT_KEYWORD_RULES } = {}) {
  const reasons = [];
  let dataLoss = false;
  let unauthorized = false;
  const haystack = `${event.title ?? ''} ${JSON.stringify(event.raw ?? {})}`.toLowerCase();

  for (const rule of rules ?? DEFAULT_KEYWORD_RULES) {
    if (rule.keys.some((k) => haystack.includes(k))) {
      reasons.push(rule.reason);
      if (rule.dataLoss) dataLoss = true;
      if (rule.unauthorized) unauthorized = true;
    }
  }

  const id = `INC-${String(now.getFullYear())}-${String(seq).padStart(4, '0')}`;
  return {
    incident_id: id,
    session_id: sessionId ?? null,
    status: OPEN_STATUS,
    origin: 'siem',
    siem_event_id: event.id ?? null,
    detected_at: event.ts ?? now.toISOString(),
    source: event.source ?? 'siem',
    title: String(event.title ?? '').slice(0, 300),
    severity: event.severity ?? 'low',
    classification: 'unclassified',
    suggested_classification: unauthorized || dataLoss || event.severity === 'high' ? 'major' : 'unclassified',
    matched_reasons: reasons,
    affected_customers: null,
    outage_minutes: null,
    economic_impact_eur: null,
    data_loss: dataLoss,
    unauthorized_access: unauthorized,
    affected_member_states: [],
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
}

/** Olay kayıt açmaya değer mi? */
export function shouldCreateIncident(event, { minSeverity = 'high', rules = DEFAULT_KEYWORD_RULES } = {}) {
  const haystack = `${event.title ?? ''} ${JSON.stringify(event.raw ?? {})}`.toLowerCase();
  const keywordHit = (rules ?? DEFAULT_KEYWORD_RULES).some((r) => (r.keys ?? []).some((k) => haystack.includes(String(k).toLowerCase())));
  const sevRank = { low: 1, medium: 2, high: 3 };
  const meets = (sevRank[event.severity] ?? 0) >= (sevRank[minSeverity] ?? 3);
  return {
    yes: keywordHit || meets,
    reasons: [
      ...(keywordHit ? ['anahtar kelime eşleşti'] : []),
      ...(meets ? [`önem ≥ ${minSeverity}`] : []),
    ],
  };
}

/** Var olan kayıtlarla birleştirir; aynı SIEM olayı ikinci kez kayıt açmaz. */
export function mergeIncidents(existing, created) {
  const seen = new Set((existing ?? []).map((x) => x.siem_event_id).filter(Boolean));
  const added = [];
  for (const inc of created) {
    if (inc.siem_event_id && seen.has(inc.siem_event_id)) continue;
    seen.add(inc.siem_event_id);
    added.push(inc);
  }
  return { added, all: [...(existing ?? []), ...added] };
}

/** Dışarıdan gelen kural listesini doğrular ve sadeleştirir. */
export function normalizeRules(input) {
  const list = Array.isArray(input) ? input : [];
  const out = [];
  for (const r of list.slice(0, 50)) {
    const keys = (Array.isArray(r.keys) ? r.keys : String(r.keys ?? '').split(','))
      .map((k) => String(k).trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 20);
    if (!keys.length) continue;
    out.push({
      keys,
      reason: String(r.reason ?? 'anahtar kelime').slice(0, 120),
      dataLoss: Boolean(r.dataLoss ?? r.data_loss),
      unauthorized: Boolean(r.unauthorized),
    });
  }
  return out.length ? out : DEFAULT_KEYWORD_RULES;
}

export function nextSeq(existing) {
  return (existing ?? []).length + 1;
}

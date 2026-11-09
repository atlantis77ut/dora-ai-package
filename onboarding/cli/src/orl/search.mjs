// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 ustauretim
//
// Genel arama: süreç, kontrol, ajan, terim ve DORA maddesi kataloglarında metin arama.
// Türkçe duyarsız eşleşme: küçük harfe indirir, ı/i, ş/s, ğ/g, ç/c, ö/o, ü/u eşlenir.

const FOLD = { ı: 'i', İ: 'i', ş: 's', ğ: 'g', ç: 'c', ö: 'o', ü: 'u', â: 'a', î: 'i', û: 'u' };

export function fold(s) {
  return String(s ?? '')
    .toLocaleLowerCase('tr-TR')
    .replace(/[ıİşğçöüâîû]/g, (c) => FOLD[c] ?? c);
}

const TYPE_LABEL = {
  process: 'Süreç',
  control: 'Kontrol',
  role: 'Ajan',
  term: 'Terim',
  article: 'DORA maddesi',
};

/**
 * Kataloglardan arama dizini üretir.
 * @param {{processes?: any[], controls?: any[], roles?: any[], terms?: any[], articles?: any[]}} catalogs
 */
export function buildIndex(catalogs = {}) {
  const items = [];
  const push = (type, id, title, parts, ref) => {
    const text = [title, ...parts].filter(Boolean).join(' \n ');
    items.push({ type, id: String(id ?? ''), title: String(title ?? id ?? ''), text, ref: ref ?? null, haystack: fold(text) });
  };

  for (const p of catalogs.processes ?? []) {
    push('process', p.id, p.name?.tr ?? p.id, [
      p.purpose?.tr,
      p.trigger?.tr,
      p.owner_role,
      ...(p.sub_processes ?? []).map((s) => s.name?.tr ?? s.id),
      ...(p.decision_rules ?? []).map((r) => `${r.condition} ${r.action}`),
    ]);
  }
  for (const c of catalogs.controls ?? []) {
    push('control', c.id, c.name?.tr ?? c.id, [c.description?.tr, c.objective?.tr, c.test_procedure?.tr, ...(c.evidence_requirements ?? [])]);
  }
  for (const r of catalogs.roles ?? []) {
    push('role', r.id, r.name?.tr ?? r.id, [r.purpose?.tr, r.layer, r.reports_to, ...(r.responsibilities ?? []).map((x) => x.desc?.tr)]);
  }
  for (const t of catalogs.terms ?? []) {
    push('term', t.id, t.name?.tr ?? t.id, [t.definition?.source_quote, ...(t.classification_criteria ?? [])]);
  }
  for (const a of catalogs.articles ?? []) {
    push('article', a.id, a.title ?? a.id, [...(a.obligations ?? []), a.chapter], a.chapter ?? null);
  }
  return items;
}

/** Basit arama: başlık eşleşmesi öne çıkar, sonra metin. */
export function search(index, query, limit = 30) {
  const q = fold(query).trim();
  if (!q) return [];
  const terms = q.split(/\s+/).filter(Boolean);
  const results = [];

  for (const item of index) {
    let score = 0;
    const title = fold(item.title);
    for (const t of terms) {
      if (title.includes(t)) score += 5;
      const occurrences = item.haystack.split(t).length - 1;
      if (occurrences > 0) score += Math.min(5, occurrences);
    }
    if (score <= 0) continue;
    results.push({ ...item, score, snippet: snippet(item.text, terms) });
  }

  results.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, 'tr'));
  return results.slice(0, limit).map(({ haystack, ...rest }) => rest);
}

function snippet(text, terms, width = 140) {
  const flat = String(text ?? '').replace(/\s+/g, ' ').trim();
  const lower = fold(flat);
  let at = -1;
  for (const t of terms) {
    const i = lower.indexOf(t);
    if (i >= 0 && (at < 0 || i < at)) at = i;
  }
  if (at < 0) return flat.slice(0, width) + (flat.length > width ? '…' : '');
  const start = Math.max(0, at - 40);
  const part = flat.slice(start, start + width);
  return (start > 0 ? '…' : '') + part + (start + width < flat.length ? '…' : '');
}

export const SEARCH_TYPES = TYPE_LABEL;

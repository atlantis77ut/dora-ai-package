// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 ustauretim
//
// SIEM konnektörü — gerçek olay çekme (test değil).
// Desteklenen ürünler: splunk, elastic, sentinel, qradar, generic.
// Tümü bağımlılıksız `fetch` ile çalışır; yanıt boyutu ve süre sınırlıdır.

const MAX_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 15_000;

export const SIEM_VENDORS = ['splunk', 'elastic', 'sentinel', 'qradar', 'generic'];

function assertEndpoint(endpoint) {
  let u;
  try {
    u = new URL(String(endpoint));
  } catch {
    throw new Error('endpoint geçerli bir URL değil');
  }
  if (!/^https?:$/.test(u.protocol)) throw new Error('yalnız http/https desteklenir');
  // bulut meta veri ucu: kimlik bilgisi sızdırma riski
  if (['169.254.169.254', 'metadata.google.internal'].includes(u.hostname)) {
    throw new Error('bulut meta veri adresine istek yasak');
  }
  return u;
}

async function limitedText(res) {
  const len = Number(res.headers.get('content-length') ?? 0);
  if (len && len > MAX_BYTES) throw new Error(`yanıt çok büyük: ${len} bayt (sınır 5 MB)`);
  const text = await res.text();
  if (text.length > MAX_BYTES) throw new Error('yanıt 5 MB sınırını aştı');
  return text;
}

function joinUrl(endpoint, suffix) {
  return String(endpoint).replace(/\/+$/, '') + suffix;
}

function getPath(obj, path) {
  const parts = path.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    if (p in cur) {
      cur = cur[p];
      continue;
    }
    // büyük/küçük harf duyarsız eşleşme (Sentinel: TimeGenerated, Severity…)
    const alt = Object.keys(cur).find((k) => k.toLowerCase() === p.toLowerCase());
    if (!alt) return undefined;
    cur = cur[alt];
  }
  return cur;
}

function pick(obj, keys) {
  for (const k of keys) {
    const v = getPath(obj, k);
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
}

function toIso(v) {
  if (!v) return new Date().toISOString();
  if (typeof v === 'number') return new Date(v < 1e12 ? v * 1000 : v).toISOString();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function severityOf(v) {
  const s = String(v ?? '').toLowerCase();
  if (['critical', 'kritik', '5', 'high'].includes(s)) return 'high';
  if (['medium', 'orta', '4', '3', 'warning', 'warn'].includes(s)) return 'medium';
  return 'low';
}

export function normalizeEvent(vendor, raw, i) {
  return {
    id: String(pick(raw, ['id', '_id', 'event_id', 'eventid', 'EventID']) ?? `${vendor}-${i}`),
    ts: toIso(pick(raw, ['@timestamp', 'timestamp', 'time', '_time', 'event_time', 'starttime'])),
    severity: severityOf(pick(raw, ['severity', 'level', 'priority', 'risk_score', 'urgency'])),
    source: String(pick(raw, ['host', 'hostname', 'src_ip', 'source', 'device', 'logsource']) ?? vendor),
    title: String(pick(raw, ['message', 'signature', 'rule_name', 'event_name', 'description', 'name']) ?? 'olay').slice(0, 300),
    raw,
  };
}

function authHeaders(vendor, token) {
  if (!token) return {};
  if (vendor === 'elastic') {
    // API key veya kullanıcı:parola (basic) desteklenir
    const value = token.includes(':') ? 'Basic ' + Buffer.from(token).toString('base64') : 'ApiKey ' + token;
    return { Authorization: value };
  }
  if (vendor === 'qradar') return { SEC: token };
  return { Authorization: 'Bearer ' + token };
}

async function postJson(url, body, headers) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`SIEM yanıtı: HTTP ${res.status}`);
    return await limitedText(res);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Olayları çeker. Dönen: { vendor, fetched_at, count, events, truncated }
 */
export async function fetchSiemEvents(cfg, { limit = 100, sinceMinutes = 1440, query } = {}) {
  const vendor = String(cfg.vendor ?? '').toLowerCase();
  const endpoint = assertEndpoint(cfg.endpoint);
  if (!SIEM_VENDORS.includes(vendor)) throw new Error(`desteklenmeyen SIEM ürünü: ${vendor || '(boş)'}`);
  const headers = authHeaders(vendor, cfg.token);
  const n = Math.max(1, Math.min(500, Number(limit) || 100));

  let rawEvents = [];

  if (vendor === 'splunk') {
    const since = Math.max(1, Math.floor(sinceMinutes / 60));
    const search = query || `search index=* | head ${n}`;
    const body = new URLSearchParams({
      search,
      output_mode: 'json',
      earliest_time: `-${since}h`,
      latest_time: 'now',
    });
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let text;
    try {
      const res = await fetch(joinUrl(endpoint, '/services/search/jobs/export'), {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/x-www-form-urlencoded' },
        body,
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`Splunk yanıtı: HTTP ${res.status}`);
      text = await limitedText(res);
    } finally {
      clearTimeout(timer);
    }
    rawEvents = text
      .split('\n')
      .filter((l) => l.trim())
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .map((x) => x.result ?? x);
  } else if (vendor === 'elastic') {
    const text = await postJson(
      joinUrl(endpoint, '/_search'),
      {
        size: n,
        sort: [{ '@timestamp': 'desc' }],
        query: query
          ? { query_string: { query } }
          : { range: { '@timestamp': { gte: `now-${Math.max(1, sinceMinutes)}m` } } },
      },
      headers,
    );
    const doc = JSON.parse(text);
    rawEvents = (doc.hits?.hits ?? []).map((h) => h._source ?? h);
  } else if (vendor === 'sentinel') {
    const text = await postJson(
      endpoint.toString(),
      {
        query: query || 'SecurityEvent | take 100',
        timespan: `PT${Math.max(5, sinceMinutes)}M`,
      },
      headers,
    );
    const doc = JSON.parse(text);
    const table = doc.tables?.[0];
    if (table?.columns && table?.rows) {
      rawEvents = table.rows.map((row) => Object.fromEntries(table.columns.map((c, i) => [c.name, row[i]])));
    }
  } else if (vendor === 'qradar') {
    const u = new URL(joinUrl(endpoint, '/api/ariel/searches'));
    if (query) u.searchParams.set('query_expression', query);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(u.toString(), { headers: { ...headers, accept: 'application/json' }, signal: ctrl.signal });
      if (!res.ok) throw new Error(`QRadar yanıtı: HTTP ${res.status}`);
      const doc = JSON.parse(await limitedText(res));
      rawEvents = doc.events ?? doc.flows ?? [];
    } finally {
      clearTimeout(timer);
    }
  } else {
    const u = new URL(endpoint);
    u.searchParams.set('limit', String(n));
    if (query) u.searchParams.set('q', query);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(u.toString(), { headers: { ...headers, accept: 'application/json' }, signal: ctrl.signal });
      if (!res.ok) throw new Error(`SIEM yanıtı: HTTP ${res.status}`);
      const doc = JSON.parse(await limitedText(res));
      rawEvents = Array.isArray(doc) ? doc : (doc.events ?? doc.data ?? doc.items ?? []);
    } finally {
      clearTimeout(timer);
    }
  }

  const sliced = rawEvents.slice(0, n);
  return {
    vendor,
    fetched_at: new Date().toISOString(),
    count: sliced.length,
    truncated: rawEvents.length > sliced.length,
    events: sliced.map((r, i) => normalizeEvent(vendor, r, i)),
  };
}

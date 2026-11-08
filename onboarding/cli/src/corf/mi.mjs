// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 ustauretim
//
// MI paketi: yönetim kuruluna giden tek sayfalık dönem raporu.
// KPI'lar oturum artefaktlarından ve depodaki eşlemeden hesaplanır; veri yoksa
// "veri yok" yazılır — uydurma değer üretilmez. Deterministik, ajan kullanmaz.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from './yaml.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '../../../..');
const CAL = path.join(ROOT, 'data', 'regulatory-calendar.yaml');
const MAP = path.join(ROOT, 'data', 'mapping', 'dora-articles.yaml');

export function loadCalendar(file = CAL) {
  if (!fs.existsSync(file)) throw new Error('Takvim bulunamadı: ' + file);
  return parse(fs.readFileSync(file, 'utf8'));
}

function readJson(dir, name) {
  const f = path.join(dir, name);
  if (!fs.existsSync(f)) return null;
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; }
}

function coverage() {
  if (!fs.existsSync(MAP)) return null;
  const doc = parse(fs.readFileSync(MAP, 'utf8'));
  const arts = doc.articles ?? [];
  if (!arts.length) return null;
  const covered = arts.filter((a) => a.status === 'covered').length;
  return { covered, total: arts.length, pct: Math.round((covered / arts.length) * 100) };
}

const KPI = (id, label, unit, source) => ({ id, label, unit, source, value: null });

export function computeKpis(dir) {
  const kpis = [];

  const cov = coverage();
  kpis.push({
    ...KPI('coverage', 'DORA kapsamı', '%', 'data/mapping/dora-articles.yaml'),
    value: cov ? cov.pct : null,
    detail: cov ? `${cov.covered}/${cov.total} madde` : 'eşleme okunamadı',
  });

  const inc = readJson(dir, 'incident-record.json');
  kpis.push({
    ...KPI('open_major', 'Açık büyük olay', 'adet', 'incident-record.json'),
    value: inc ? (inc.closed_at ? 0 : 1) : null,
    detail: inc ? (inc.closed_at ? 'kapandı ' + String(inc.closed_at).slice(0, 10) : 'açık') : 'kayıt yok',
  });

  const receipt = readJson(dir, 'notification-receipt.json');
  kpis.push({
    ...KPI('sla_4h', '4 saat bildirim uyumu', '%', 'notification-receipt.json'),
    value: receipt && typeof receipt.within_sla === 'boolean' ? (receipt.within_sla ? 100 : 0) : null,
    detail: receipt ? 'ilk bildirim kaydı' : 'bildirim kaydı yok',
  });

  const gap = readJson(dir, 'gap-analysis.json');
  kpis.push({
    ...KPI('high_findings', 'Kritik boşluk', 'adet', 'gap-analysis.json#high_severity'),
    value: gap && typeof gap.high_severity === 'number' ? gap.high_severity : null,
    detail: gap ? `kabul edilmiş risk: ${(gap.risk_acceptance ?? []).length}` : 'boşluk analizi yok',
  });

  const go = readJson(dir, 'go-live.json');
  kpis.push({
    ...KPI('annual_review', 'Yıllık gözden geçirme', 'tarih', 'go-live.json#annual_review_date'),
    value: go?.annual_review_date ?? null,
    detail: go?.annual_review_date ? 'planlı' : 'tarih yok',
  });

  const tpp = readJson(dir, 'register-of-information.json');
  kpis.push({
    ...KPI('concentration', 'Yoğunlaşma eşiği aşımı', 'adet', 'register-of-information.json'),
    value: tpp && typeof tpp.concentration_breaches === 'number' ? tpp.concentration_breaches : null,
    detail: tpp ? 'bilgi kaydı' : 'bilgi kaydı yok',
  });

  return kpis;
}

export function buildMi({ dir, session, period, outDir, write = true }) {
  const now = new Date();
  const p = period ?? now.toISOString().slice(0, 7);
  const kpis = computeKpis(dir);
  const cal = loadCalendar();
  const obligations = cal.obligations ?? [];
  const monthly = obligations.filter((o) => o.frequency === 'monthly');
  const eventDriven = obligations.filter((o) => o.frequency === 'event_driven');
  const inc = readJson(dir, 'incident-record.json');
  const missing = kpis.filter((k) => k.value === null).map((k) => k.id);

  const redFlags = [];
  const openMajor = kpis.find((k) => k.id === 'open_major')?.value;
  if (openMajor > 0) redFlags.push('açık büyük olay var');
  const cov = kpis.find((k) => k.id === 'coverage')?.value;
  if (typeof cov === 'number' && cov < 100) redFlags.push('kapsam %100 değil');
  const high = kpis.find((k) => k.id === 'high_findings')?.value;
  if (high > 0) redFlags.push('kritik boşluk açık');

  const payload = {
    session_id: session.session_id,
    institution: session.institution ?? readJson(dir, 'institution-profile.json')?.institution ?? 'Kurum',
    tier: session.tier ?? null,
    regulator: session.regulator ?? null,
    period: p,
    generated_at: now.toISOString(),
    kpis,
    red_flags: redFlags,
    missing,
    incidents: inc ? [inc] : [],
    obligations: { monthly, event_driven: eventDriven },
  };

  const files = ['mi-' + p + '.html', 'mi-' + p + '.json'];
  if (write) {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, files[0]), renderHtml(payload), 'utf8');
    fs.writeFileSync(path.join(outDir, files[1]), JSON.stringify(payload, null, 2) + '\n', 'utf8');
  }
  return { payload, files, outDir };
}

const esc = (s) => String(s ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const val = (k) => (k.value === null ? '<span class="na">veri yok</span>' : esc(k.value) + (k.unit === '%' ? '%' : ''));

function renderHtml(p) {
  const cards = p.kpis
    .map(
      (k) => `    <div class="card ${k.value === null ? 'na-card' : ''}">
      <div class="lbl">${esc(k.label)}</div>
      <div class="num">${val(k)}</div>
      <div class="det">${esc(k.detail)}</div>
      <div class="src">${esc(k.source)}</div>
    </div>`,
    )
    .join('\n');

  const flags = p.red_flags.length
    ? '<ul class="flags">' + p.red_flags.map((f) => '<li>' + esc(f) + '</li>').join('') + '</ul>'
    : '<p class="none">Kırmızı bayrak yok.</p>';

  const incRows = p.incidents.length
    ? p.incidents
        .map(
          (i) => `      <tr><td>${esc(i.incident_id)}</td><td>${esc(i.classification ?? '-')}</td><td>${esc(i.detected_at ?? '-')}</td><td>${esc(i.closed_at ?? 'açık')}</td></tr>`,
        )
        .join('\n')
    : '      <tr><td colspan="4" class="na">Olay kaydı yok</td></tr>';

  const oblRows = [...p.obligations.monthly, ...p.obligations.event_driven]
    .map(
      (o) => `      <tr><td>${esc(o.name?.tr ?? o.id)}</td><td>${esc(o.dora_ref)}</td><td>${esc(o.deadline)}</td><td>${esc(o.owner_role)}</td></tr>`,
    )
    .join('\n');

  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<title>MI Paketi — ${esc(p.period)}</title>
<style>
  :root { --ink:#16202e; --muted:#5c6b7f; --line:#dbe2ea; --bad:#b42318; --ok:#0f7b4f; --accent:#1f3a5f; }
  * { box-sizing: border-box; }
  body { margin:0; padding:28px; font:13px/1.5 "Segoe UI",system-ui,sans-serif; color:var(--ink); }
  h1 { font-size:20px; margin:0 0 2px; color:var(--accent); }
  .sub { color:var(--muted); margin-bottom:18px; }
  .grid { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:18px; }
  .card { border:1px solid var(--line); border-radius:10px; padding:10px 12px; }
  .lbl { font-size:10.5px; text-transform:uppercase; letter-spacing:.05em; color:var(--muted); }
  .num { font-size:22px; font-weight:700; margin:2px 0; }
  .det { font-size:11px; color:var(--muted); }
  .src { font-family:Consolas,monospace; font-size:9.5px; color:#93a1b5; margin-top:4px; }
  .na { color:#97a3b4; font-weight:500; font-size:15px; }
  .na-card { background:#fafbfc; }
  h2 { font-size:13px; text-transform:uppercase; letter-spacing:.05em; color:var(--muted); margin:20px 0 6px; }
  table { width:100%; border-collapse:collapse; }
  th,td { text-align:left; padding:6px 8px; border-bottom:1px solid var(--line); font-size:12px; vertical-align:top; }
  th { font-size:10.5px; color:var(--muted); text-transform:uppercase; }
  ul.flags { margin:4px 0 0 18px; padding:0; color:var(--bad); }
  .none { color:var(--ok); margin:4px 0 0; }
  footer { margin-top:22px; border-top:1px solid var(--line); padding-top:8px; color:var(--muted); font-size:10.5px; }
  @media print { body { padding:0; } .card { break-inside:avoid; } }
</style>
</head>
<body>
  <h1>DORA MI Paketi — ${esc(p.period)}</h1>
  <div class="sub">${esc(p.institution)} · tier=${esc(p.tier ?? '-')} · ${esc(p.regulator ?? '-')} · üretim ${esc(p.generated_at)}</div>

  <div class="grid">
${cards}
  </div>

  <h2>Kırmızı bayraklar</h2>
  ${flags}

  <h2>Olaylar (dönem)</h2>
  <table>
    <thead><tr><th>Olay</th><th>Sınıf</th><th>Tespit</th><th>Kapanış</th></tr></thead>
    <tbody>
${incRows}
    </tbody>
  </table>

  <h2>Bu dönem yükümlülükler</h2>
  <table>
    <thead><tr><th>Yükümlülük</th><th>Madde</th><th>Süre</th><th>Sahip</th></tr></thead>
    <tbody>
${oblRows}
    </tbody>
  </table>

  <footer>
    ${p.missing.length ? 'Veri yok: ' + esc(p.missing.join(', ')) + '. ' : ''}Bu paket deterministik bir araç tarafından üretildi;
    her KPI'nın kaynağı kartın altında yazılıdır. Onay: PRC-RSK-06 / CTL-RSK-012.
  </footer>
</body>
</html>
`;
}

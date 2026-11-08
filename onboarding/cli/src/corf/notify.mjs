// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 ustauretim
//
// Bildirim formu üretimi: ITS 2024/2956 alan sözlüğünü (data/mapping/its-2024-2956.yaml)
// oturum artefaktlarıyla doldurur ve yazdırılabilir HTML + Markdown üretir.
//
// Deterministik: ajan/LLM kullanmaz. Eksik alan varsa form "EKSİK" olarak işaretlenir,
// üretim yine de yapılır — böylece eksik bilgi denetimde görünür olur.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parse } from './yaml.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../../..');
export const ITS_FILE = path.join(ROOT, 'data', 'mapping', 'its-2024-2956.yaml');

export const PHASES = ['initial', 'intermediate', 'final'];

export function loadIts(file = ITS_FILE) {
  if (!fs.existsSync(file)) throw new Error('ITS alan sözlüğü bulunamadı: ' + file);
  const doc = parse(fs.readFileSync(file, 'utf8'));
  return doc.templates ?? [];
}

function readJsonSafe(dir, name) {
  const f = path.join(dir, name);
  if (!fs.existsSync(f)) return { exists: false, data: null };
  try {
    return { exists: true, data: JSON.parse(fs.readFileSync(f, 'utf8')) };
  } catch {
    return { exists: true, data: null };
  }
}

/** "incident-record.json#incident_id" → { value, status } */
function resolveSource(dir, source) {
  const [file, pointer] = String(source).split('#');
  // JSON olmayan kaynaklar (ör. rca-report.pdf) yalnızca varlık ve ad ile temsil edilir.
  if (!file.endsWith('.json')) {
    const f = path.join(dir, file);
    return fs.existsSync(f)
      ? { value: file, status: 'ok' }
      : { value: null, status: 'kaynak dosya yok: ' + file };
  }
  const r = readJsonSafe(dir, file);
  if (!r.exists) return { value: null, status: 'kaynak dosya yok: ' + file };
  if (r.data === null) return { value: null, status: 'kaynak okunamadı: ' + file };
  if (!pointer) return { value: '(dosya)', status: 'ok' };
  const parts = pointer.split('/').filter(Boolean);
  let cur = r.data;
  for (const p of parts) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return { value: null, status: 'alan yok: ' + pointer };
    cur = cur[p];
  }
  if (cur === undefined || cur === null || cur === '') return { value: null, status: 'alan boş: ' + pointer };
  return { value: cur, status: 'ok' };
}

const esc = (s) =>
  String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

export function buildNotification({ dir, session, phase, outDir, write = true }) {
  const templates = loadIts();
  const tpl = templates.find((t) => t.phase === phase);
  if (!tpl) throw new Error(`Bilinmeyen bildirim fazı: ${phase} (geçerli: ${PHASES.join(', ')})`);

  const rows = (tpl.fields ?? []).map((f) => {
    const r = resolveSource(dir, f.source);
    return {
      name: f.name,
      description: f.description ?? '',
      required: !!f.required,
      source: f.source,
      present: r.status === 'ok',
      status: r.status,
      value: r.value,
    };
  });

  const missing = rows.filter((r) => r.required && !r.present).map((r) => r.name);
  const payload = {
    template: 'ITS 2024/2956',
    phase,
    phase_name: tpl.name?.tr ?? phase,
    deadline: tpl.deadline ?? null,
    process: tpl.process ?? null,
    control: tpl.control ?? null,
    session_id: session.session_id,
    generated_at: new Date().toISOString(),
    complete: missing.length === 0,
    missing,
    fields: rows,
  };
  payload.digest = 'sha256:' + crypto.createHash('sha256').update(JSON.stringify(payload.fields)).digest('hex');

  const base = 'notification-' + phase;
  const files = [base + '.json', base + '.md', base + '.html'];
  if (write) {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, base + '.json'), JSON.stringify(payload, null, 2) + '\n', 'utf8');
    fs.writeFileSync(path.join(outDir, base + '.md'), renderMarkdown(payload), 'utf8');
    fs.writeFileSync(path.join(outDir, base + '.html'), renderHtml(payload), 'utf8');
  }

  return { payload, files, outDir };
}

function renderMarkdown(p) {
  const lines = [];
  lines.push('# DORA Bildirim Formu — ' + p.phase_name);
  lines.push('');
  lines.push('| | |');
  lines.push('|---|---|');
  lines.push('| Şablon | ' + p.template + ' |');
  lines.push('| Süre | ' + (p.deadline ?? '-') + ' |');
  lines.push('| Süreç | ' + (p.process ?? '-') + ' · ' + (p.control ?? '-') + ' |');
  lines.push('| Oturum | ' + p.session_id + ' |');
  lines.push('| Üretim | ' + p.generated_at + ' |');
  lines.push('| Durum | ' + (p.complete ? 'TAM' : 'EKSİK: ' + p.missing.join(', ')) + ' |');
  lines.push('');
  lines.push('| Alan | Değer | Kaynak | Durum |');
  lines.push('|---|---|---|---|');
  for (const f of p.fields) {
    const v = f.present ? String(f.value) : '—';
    lines.push('| ' + f.name + (f.required ? ' *' : '') + ' | ' + v.replaceAll('|', '\\|') + ' | ' + f.source + ' | ' + (f.present ? 'ok' : f.status) + ' |');
  }
  lines.push('');
  lines.push('\\* zorunlu alan. Özet: ' + p.digest);
  return lines.join('\n') + '\n';
}

function renderHtml(p) {
  const rows = p.fields
    .map(
      (f) => `      <tr class="${f.present ? '' : 'missing'}">
        <td class="name">${esc(f.name)}${f.required ? ' <span class="req">*</span>' : ''}</td>
        <td class="val">${f.present ? esc(f.value) : '<em>boş</em>'}</td>
        <td class="src">${esc(f.source)}</td>
        <td class="st">${f.present ? 'ok' : esc(f.status)}</td>
      </tr>`,
    )
    .join('\n');

  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<title>DORA Bildirim Formu — ${esc(p.phase_name)}</title>
<style>
  :root { --ink:#16202e; --muted:#5c6b7f; --line:#dbe2ea; --bad:#b42318; --ok:#0f7b4f; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 32px; color: var(--ink); font: 13px/1.55 "Segoe UI", system-ui, sans-serif; }
  h1 { font-size: 21px; margin: 0 0 4px; }
  .sub { color: var(--muted); margin-bottom: 20px; }
  .meta { display: grid; grid-template-columns: 150px 1fr; gap: 6px 12px; margin-bottom: 22px; }
  .meta dt { color: var(--muted); }
  .meta dd { margin: 0; }
  .badge { display:inline-block; padding: 3px 10px; border-radius: 999px; font-weight: 700; font-size: 11px; }
  .badge.ok { background:#e7f6ee; color: var(--ok); }
  .badge.bad { background:#fdecea; color: var(--bad); }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--line); vertical-align: top; }
  th { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
  td.name { font-family: Consolas, ui-monospace, monospace; font-size: 12px; }
  td.src { color: var(--muted); font-size: 11.5px; }
  tr.missing td { background: #fff6f5; }
  tr.missing td.val em { color: var(--bad); }
  .req { color: var(--bad); }
  footer { margin-top: 26px; color: var(--muted); font-size: 11px; border-top: 1px solid var(--line); padding-top: 10px; }
  @media print { body { padding: 0; } .badge { border: 1px solid currentColor; } }
</style>
</head>
<body>
  <h1>DORA Bildirim Formu — ${esc(p.phase_name)}</h1>
  <div class="sub">ITS 2024/2956 şablonu · ${esc(p.template)} · süre: ${esc(p.deadline ?? '-')}</div>
  <dl class="meta">
    <dt>Oturum</dt><dd>${esc(p.session_id)}</dd>
    <dt>Süreç / kontrol</dt><dd>${esc(p.process ?? '-')} · ${esc(p.control ?? '-')}</dd>
    <dt>Üretim</dt><dd>${esc(p.generated_at)}</dd>
    <dt>Durum</dt><dd><span class="badge ${p.complete ? 'ok' : 'bad'}">${p.complete ? 'TAM' : 'EKSİK'}</span>
      ${p.complete ? '' : ' · eksik: ' + esc(p.missing.join(', '))}</dd>
  </dl>
  <table>
    <thead><tr><th>Alan</th><th>Değer</th><th>Kaynak</th><th>Durum</th></tr></thead>
  <tbody>
${rows}
  </tbody>
  </table>
  <footer>
    Bu form deterministik bir araç tarafından üretildi; ajan/LLM kullanılmadı. Zorunlu alanlar (*)
    boşsa bildirim gönderilmemelidir. Alan özeti: ${esc(p.digest)}
  </footer>
</body>
</html>
`;
}

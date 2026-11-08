#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 ustauretim
//
// Depodaki YAML dosyalarından statik dashboard sitesi üretir:
//   dashboard/index.html      — özet (KPI, kapsama, fazlar, açık noktalar)
//   dashboard/processes.html  — süreçlerin tamamı (kural, SLA, kontrol)
//   dashboard/controls.html   — kontroller (kanıt alanları, test prosedürü)
//   dashboard/data.json       — makine okunur veri
//
// Kullanım: node docs/tools/build-dashboard.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '../../onboarding/cli/src/corf/yaml.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const OUT = path.join(REPO, 'dashboard');

const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');

// ── süreçler ──────────────────────────────────────────────
const processes = [];
for (const f of fs.readdirSync(path.join(REPO, 'data', 'processes')).filter((x) => x.endsWith('.yaml'))) {
  const doc = parse(read(`data/processes/${f}`));
  const pillarName = doc.pillar?.name?.tr ?? doc.pillar?.id ?? f;
  for (const p of doc.processes ?? []) processes.push({ ...p, pillarName, file: f });
}

// ── kontroller ────────────────────────────────────────────
const controls = parse(read('data/controls/controls-catalog.yaml')).controls ?? [];

// ── roller, terimler ──────────────────────────────────────
const roles = parse(read('data/roles/roles-catalog.yaml')).roles ?? [];
const terms = parse(read('data/glossary/glossary-full.yaml')).terms ?? [];

// ── senaryolar ────────────────────────────────────────────
const scnDir = path.join(REPO, 'tests', 'synthetic-scenarios');
const scenarios = fs
  .readdirSync(scnDir)
  .filter((f) => f.startsWith('scenario-') && f.endsWith('.yaml'))
  .map((f) => {
    const d = parse(fs.readFileSync(path.join(scnDir, f), 'utf8')).scenario ?? {};
    return { id: d.id, name: d.name?.tr, assertions: d.assertions_total, severity: d.severity };
  });

// ── DORA eşlemesi ─────────────────────────────────────────
const articles = parse(read('data/mapping/dora-articles.yaml')).articles ?? [];
const byStatus = { covered: 0, partial: 0, gap: 0 };
for (const a of articles) byStatus[a.status] = (byStatus[a.status] ?? 0) + 1;
const coveragePct = Math.round((byStatus.covered / articles.length) * 100);

// ── CORF fazları ──────────────────────────────────────────
const phases = (parse(read('onboarding/corf-lifecycle.yaml')).phases ?? []).map((p) => ({
  id: p.id,
  name: p.name?.tr ?? p.id,
  corf: p.corf_phase,
  steps: (p.wizard_steps ?? []).length,
  gates: (p.exit_gate?.criteria ?? []).length,
  days: p.duration_days ?? null,
  level: Object.keys(p.agents ?? {}).filter((k) => k !== 'description')[0] ?? '—',
}));

// ── sağlık ────────────────────────────────────────────────
const procIds = new Set(processes.map((p) => p.id));
const ctlIds = new Set(controls.map((c) => c.id));
const issues = [];
for (const c of controls) if (c.process_id && !procIds.has(c.process_id)) issues.push(`${c.id} → tanımsız süreç ${c.process_id}`);
for (const a of articles) {
  for (const p of a.processes ?? []) if (!procIds.has(p)) issues.push(`${a.id} → tanımsız süreç ${p}`);
  for (const c of a.controls ?? []) if (!ctlIds.has(c)) issues.push(`${a.id} → tanımsız kontrol ${c}`);
}
for (const p of processes) {
  for (const c of p.control_ids ?? []) if (!ctlIds.has(c)) issues.push(`${p.id} → tanımsız kontrol ${c}`);
}

const pkg = JSON.parse(read('onboarding/cli/package.json'));
const changelog = read('CHANGELOG.md').match(/^## \[([^\]]+)\] — (.+)$/m);

const fams = {};
for (const c of controls) {
  const f = c.id.split('-')[1];
  fams[f] = (fams[f] ?? 0) + 1;
}

const data = {
  generated_at: new Date().toISOString(),
  package: { name: 'DORA AI Ajan Paketi', version: pkg.version, license: 'AGPL-3.0 + ticari' },
  kpis: {
    processes: processes.length,
    controls: controls.length,
    roles: roles.length,
    terms: terms.length,
    scenarios: scenarios.length,
    assertions: scenarios.reduce((s, x) => s + Number(x.assertions ?? 0), 0),
    orCodes: new Set(roles.flatMap((r) => r.corf_process_codes ?? [])).size,
    coverage: coveragePct,
  },
  coverage: { total: articles.length, ...byStatus },
  control_families: fams,
  phases,
  gaps: articles.filter((a) => a.status !== 'covered').map((a) => ({ id: a.id, title: a.title, status: a.status })),
  scenarios,
  health: { ok: issues.length === 0, issues },
  changelog: changelog ? { version: changelog[1], date: changelog[2] } : null,
};

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'data.json'), JSON.stringify(data, null, 2) + '\n');

// ── ortak parçalar ────────────────────────────────────────
const CSS = `
  :root { --bg:#0b1020; --panel:#131a2e; --line:#24304d; --fg:#e8edf7; --muted:#93a1c0;
    --ok:#34d399; --warn:#fbbf24; --bad:#f87171; --accent:#60a5fa; --accent2:#a78bfa; }
  * { box-sizing:border-box; }
  body { margin:0; padding:30px; background:radial-gradient(1200px 600px at 20% -10%,#1a2542 0%,var(--bg) 55%);
    color:var(--fg); font:14px/1.55 "Segoe UI",system-ui,-apple-system,sans-serif; }
  .wrap { max-width:1180px; margin:0 auto; }
  header { display:flex; align-items:baseline; justify-content:space-between; gap:16px; margin-bottom:6px; }
  h1 { font-size:22px; margin:0; letter-spacing:.2px; }
  .sub { color:var(--muted); font-size:12.5px; }
  nav { display:flex; gap:8px; margin:16px 0 22px; flex-wrap:wrap; }
  nav a { text-decoration:none; color:var(--muted); border:1px solid var(--line); border-radius:999px;
    padding:5px 13px; font-size:12.5px; }
  nav a.on, nav a:hover { color:var(--fg); border-color:#3b4d78; background:#18213a; }
  .badge { display:inline-block; padding:2px 8px; border:1px solid var(--line); border-radius:999px; font-size:11.5px; color:var(--muted); }
  .grid { display:grid; grid-template-columns:repeat(6,1fr); gap:12px; margin:4px 0 18px; }
  .card { background:linear-gradient(180deg,rgba(255,255,255,.03),rgba(255,255,255,0)); border:1px solid var(--line);
    border-radius:12px; padding:14px 16px; }
  .card .label { color:var(--muted); font-size:11.5px; text-transform:uppercase; letter-spacing:.6px; }
  .card .value { font-size:26px; font-weight:650; margin-top:6px; }
  .card .hint { color:var(--muted); font-size:11.5px; margin-top:2px; }
  section { background:var(--panel); border:1px solid var(--line); border-radius:14px; padding:18px 20px; margin-bottom:16px; }
  h2 { font-size:14px; margin:0 0 14px; letter-spacing:.3px; }
  h2 span { color:var(--muted); font-weight:400; margin-left:8px; font-size:12px; }
  .bar { display:flex; height:12px; border-radius:999px; overflow:hidden; border:1px solid var(--line); }
  .bar > i { display:block; }
  .b-ok{background:var(--ok)} .b-warn{background:var(--warn)} .b-bad{background:var(--bad)}
  .legend { display:flex; gap:18px; margin-top:10px; color:var(--muted); font-size:12px; }
  .legend b { color:var(--fg); }
  table { width:100%; border-collapse:collapse; }
  th,td { text-align:left; padding:8px 10px; border-bottom:1px solid rgba(36,48,77,.7); font-size:12.5px; vertical-align:top; }
  th { color:var(--muted); font-weight:600; text-transform:uppercase; font-size:10.5px; letter-spacing:.7px; }
  td.num,th.num { text-align:right; font-variant-numeric:tabular-nums; }
  .mono { font-family:ui-monospace,"Cascadia Mono",Consolas,monospace; font-size:12px; color:var(--accent); }
  .pill { border:1px solid var(--line); border-radius:999px; padding:1px 8px; font-size:11px; color:var(--muted); white-space:nowrap; }
  .pill.ok { color:var(--ok); border-color:#1f5142; } .pill.warn { color:var(--warn); border-color:#5a4614; }
  .pill.bad { color:var(--bad); border-color:#5b2626; }
  .two { display:grid; grid-template-columns:1.35fr 1fr; gap:16px; }
  .list { margin:0; padding-left:18px; color:var(--muted); font-size:12.5px; }
  .list li { margin:6px 0; }
  .ok{color:var(--ok)} .warn{color:var(--warn)} .bad{color:var(--bad)}
  details { border-top:1px solid rgba(36,48,77,.6); padding:8px 0; }
  details summary { cursor:pointer; color:var(--muted); font-size:12px; }
  details summary:hover { color:var(--fg); }
  .kv { display:grid; grid-template-columns:130px 1fr; gap:4px 12px; margin:10px 0 4px; font-size:12.5px; }
  .kv dt { color:var(--muted); } .kv dd { margin:0; }
  footer { color:var(--muted); font-size:11.5px; text-align:center; margin-top:8px; }
`;

const head = (title, subtitle, right) => `
  <header>
    <div><h1>${title}</h1><div class="sub">${subtitle}</div></div>
    <span class="badge">${right}</span>
  </header>`;

const nav = (active) => `
  <nav>
    <a href="index.html" class="${active === 'index' ? 'on' : ''}">Genel bakış</a>
    <a href="processes.html" class="${active === 'processes' ? 'on' : ''}">Süreçler (${processes.length})</a>
    <a href="controls.html" class="${active === 'controls' ? 'on' : ''}">Kontroller (${controls.length})</a>
  </nav>`;

const page = (title, content) => `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><style>${CSS}</style></head>
<body><div class="wrap">${content}
  <footer>Depodaki YAML dosyalarından üretildi · <span class="mono">node docs/tools/build-dashboard.mjs</span></footer>
</div></body></html>
`;

const pct = (n) => Math.round((n / data.coverage.total) * 100);
const stamp = new Date(data.generated_at).toLocaleString('tr-TR');

// ── index ─────────────────────────────────────────────────
const kpi = (label, value, hint = '') => `
      <div class="card"><div class="label">${label}</div><div class="value">${value}</div>
      ${hint ? `<div class="hint">${hint}</div>` : ''}</div>`;

const indexHtml = page(
  'DORA AI Ajan Paketi — Dashboard',
  `${head(
    data.package.name,
    `v${data.package.version} · ${data.package.license} · ${phases.length} CORF fazı · ${
      data.health.ok ? '<span class="ok">sağlık: temiz</span>' : '<span class="bad">sağlık: sorun var</span>'
    }`,
    stamp,
  )}
  ${nav('index')}
  <div class="grid">
    ${kpi('Süreç', data.kpis.processes, '5 sütun')}
    ${kpi('Kontrol', data.kpis.controls, Object.entries(fams).map(([k, v]) => `${k} ${v}`).join(' · '))}
    ${kpi('Ajan', data.kpis.roles, `${data.kpis.orCodes} CORF kodu`)}
    ${kpi('Terim', data.kpis.terms, 'DORA + RTS/ITS')}
    ${kpi('Senaryo', data.kpis.scenarios, `${data.kpis.assertions} assertion`)}
    ${kpi('DORA kapsama', data.kpis.coverage + '%', `${data.coverage.covered}/${data.coverage.total} madde`)}
  </div>
  <section>
    <h2>DORA kapsama <span>madde bazında</span></h2>
    <div class="bar">
      <i class="b-ok" style="width:${pct(data.coverage.covered)}%"></i>
      <i class="b-warn" style="width:${pct(data.coverage.partial)}%"></i>
      <i class="b-bad" style="width:${pct(data.coverage.gap)}%"></i>
    </div>
    <div class="legend"><span><b>${data.coverage.covered}</b> kapsandı</span><span><b>${data.coverage.partial}</b> kısmi</span>
      <span><b>${data.coverage.gap}</b> boşluk</span><span>toplam <b>${data.coverage.total}</b></span></div>
  </section>
  <div class="two">
    <section>
      <h2>CORF uygulama fazları <span>geçiş kapıları</span></h2>
      <table><thead><tr><th>Faz</th><th>Adım</th><th>CORF</th><th class="num">Adım</th><th class="num">Kapı</th><th class="num">Gün</th><th>Ajan modu</th></tr></thead>
      <tbody>${phases
        .map(
          (p) => `<tr><td class="mono">${p.id}</td><td>${p.name.replace(/^Faz \d+ — /, '')}</td>
          <td class="mono">${p.corf}</td><td class="num">${p.steps}</td><td class="num">${p.gates}</td>
          <td class="num">${p.days ?? '—'}</td><td><span class="pill">${p.level.replace(/_/g, ' ')}</span></td></tr>`,
        )
        .join('')}</tbody></table>
    </section>
    <section>
      <h2>Açık noktalar <span>kapatılmadan C5 geçmez</span></h2>
      <ul class="list">${data.gaps
        .map(
          (g) =>
            `<li><b class="${g.status === 'gap' ? 'bad' : 'warn'}">${g.id}</b> — ${g.title} <span class="pill ${g.status === 'gap' ? 'bad' : 'warn'}">${g.status}</span></li>`,
        )
        .join('')}</ul>
    </section>
  </div>
  <section>
    <h2>Kabul senaryoları <span>sentetik testler</span></h2>
    <table><thead><tr><th>Senaryo</th><th>Ad</th><th class="num">Assertion</th></tr></thead>
    <tbody>${scenarios.map((s) => `<tr><td class="mono">${s.id}</td><td>${s.name ?? ''}</td><td class="num">${s.assertions}</td></tr>`).join('')}</tbody></table>
  </section>`,
);

// ── processes ─────────────────────────────────────────────
const procDetail = (p) => `
  <details>
    <summary><span class="mono">${p.id}</span> &nbsp;<b>${p.name?.tr ?? ''}</b> &nbsp;
      <span class="pill">${p.pillarName}</span>
      <span class="pill">${(p.decision_rules ?? []).length} kural</span>
      <span class="pill">${(p.slas ?? []).length} SLA</span>
      <span class="pill">${(p.control_ids ?? []).length} kontrol</span></summary>
    <dl class="kv">
      <dt>Tetikleyici</dt><dd>${p.trigger ?? '—'}</dd>
      <dt>Sorumlu</dt><dd>${(p.responsible_roles ?? []).join(', ') || '—'}</dd>
      <dt>Onaylayan</dt><dd>${(p.approval_roles ?? []).join(', ') || '—'}</dd>
      <dt>Girdi</dt><dd>${(p.inputs ?? []).map((i) => `${i.name} <span class="pill">${i.format}</span>`).join(' · ') || '—'}</dd>
      <dt>Çıktı</dt><dd>${(p.outputs ?? []).map((o) => `${o.name} <span class="pill">${o.format}</span>`).join(' · ') || '—'}</dd>
      <dt>SLA</dt><dd>${(p.slas ?? []).map((s) => `${s.trigger}: <b>${s.duration} ${s.unit}</b>`).join('<br>') || '—'}</dd>
      <dt>Karar kuralları</dt><dd>${(p.decision_rules ?? [])
        .map((r) => `<span class="mono">${r.rule_id}</span> ${r.condition} → ${r.action}`)
        .join('<br>') || '—'}</dd>
      <dt>Kontroller</dt><dd>${(p.control_ids ?? []).map((c) => `<span class="mono">${c}</span>`).join(' · ') || '—'}</dd>
      <dt>Bağımlılık</dt><dd>↑ ${((p.dependencies ?? {}).upstream ?? []).join(', ') || '—'} · ↓ ${((p.dependencies ?? {}).downstream ?? []).join(', ') || '—'}</dd>
    </dl>
  </details>`;

const processesHtml = page(
  'Süreçler — DORA AI Ajan Paketi',
  `${head('Süreç Kütüphanesi', `${processes.length} süreç · ${controls.length} kontrol · CORF 6 fazı`, stamp)}
  ${nav('processes')}
  <section>
    <h2>Sütun dağılımı <span>DORA 5 sütun</span></h2>
    <table><thead><tr><th>Süreç</th><th>Ad</th><th>Sütun</th><th class="num">Kural</th><th class="num">SLA</th><th class="num">Kontrol</th></tr></thead>
    <tbody>${processes
      .map(
        (p) => `<tr><td class="mono">${p.id}</td><td>${p.name?.tr ?? ''}</td>
        <td><span class="pill">${(p.pillarName.split('—')[1] ?? p.pillarName).trim()}</span></td>
        <td class="num">${(p.decision_rules ?? []).length}</td><td class="num">${(p.slas ?? []).length}</td>
        <td class="num">${(p.control_ids ?? []).length}</td></tr>`,
      )
      .join('')}</tbody></table>
  </section>
  <section>
    <h2>Ayrıntılar <span>satıra tıklayın</span></h2>
    ${processes.map(procDetail).join('')}
  </section>`,
);

// ── controls ──────────────────────────────────────────────
const ctlDetail = (c) => `
  <details>
    <summary><span class="mono">${c.id}</span> &nbsp;<b>${c.name?.tr ?? ''}</b> &nbsp;
      <span class="pill">${c.type}</span><span class="pill">${c.frequency}</span>
      <span class="pill">${c.process_id}</span></summary>
    <dl class="kv">
      <dt>Sahip</dt><dd>${c.owner_role ?? '—'}</dd>
      <dt>Kanıt</dt><dd>${c.evidence_spec?.format ?? '—'} · ${c.evidence_spec?.immutability ?? '—'}</dd>
      <dt>Zorunlu alanlar</dt><dd>${(c.evidence_spec?.fields ?? [])
        .map((f) => `${f.name}: ${f.type}${f.required ? ' *' : ''}`)
        .join(' · ')}</dd>
      <dt>DORA</dt><dd>${c.dora_ref?.article ?? '—'}</dd>
      <dt>Test prosedürü</dt><dd>${c.test_procedure ?? '—'}</dd>
    </dl>
  </details>`;

const controlsHtml = page(
  'Kontroller — DORA AI Ajan Paketi',
  `${head('Kontrol Kataloğu', `${controls.length} kontrol · kanıt şartnamesi ve test prosedürü`, stamp)}
  ${nav('controls')}
  <section>
    <h2>Tüm kontroller <span>ayrıntı için satıra tıklayın</span></h2>
    <table><thead><tr><th>Kontrol</th><th>Ad</th><th>Süreç</th><th>Tip</th><th>Sıklık</th><th class="num">Alan</th></tr></thead>
    <tbody>${controls
      .map(
        (c) => `<tr><td class="mono">${c.id}</td><td>${c.name?.tr ?? ''}</td><td class="mono">${c.process_id}</td>
        <td><span class="pill">${c.type}</span></td><td>${c.frequency}</td>
        <td class="num">${(c.evidence_spec?.fields ?? []).length}</td></tr>`,
      )
      .join('')}</tbody></table>
  </section>
  <section>
    <h2>Ayrıntılar <span>kanıt alanları ve test prosedürü</span></h2>
    ${controls.map(ctlDetail).join('')}
  </section>`,
);

fs.writeFileSync(path.join(OUT, 'index.html'), indexHtml);
fs.writeFileSync(path.join(OUT, 'processes.html'), processesHtml);
fs.writeFileSync(path.join(OUT, 'controls.html'), controlsHtml);

console.log(`dashboard: dashboard/ → index.html · processes.html · controls.html · data.json`);
console.log(
  `süreç ${processes.length} · kontrol ${controls.length} · ajan ${roles.length} · senaryo ${scenarios.length} · kapsama %${coveragePct} · sağlık ${
    issues.length === 0 ? 'temiz' : issues.length + ' sorun'
  }`,
);
if (issues.length) {
  for (const i of issues) console.error(' -', i);
  process.exitCode = 1;
}

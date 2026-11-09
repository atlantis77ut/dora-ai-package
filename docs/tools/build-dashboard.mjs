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
import { parse } from '../../onboarding/cli/src/orl/yaml.mjs';

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

// ── ORL fazları ──────────────────────────────────────────
const phases = (parse(read('onboarding/orl-lifecycle.yaml')).phases ?? []).map((p) => ({
  id: p.id,
  name: p.name?.tr ?? p.id,
  orl: p.lifecycle_phase,
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
    orCodes: new Set(roles.flatMap((r) => r.process_codes ?? [])).size,
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
    <a href="roles.html" class="${active === 'roles' ? 'on' : ''}">Ajanlar (${roles.length})</a>
    <a href="glossary.html" class="${active === 'glossary' ? 'on' : ''}">Sözlük (${terms.length})</a>
    <a href="mapping.html" class="${active === 'mapping' ? 'on' : ''}">DORA eşlemesi (${articles.length})</a>
    <a href="sources.html" class="${active === 'sources' ? 'on' : ''}">Veri kaynakları</a>
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
    `v${data.package.version} · ${data.package.license} · ${phases.length} ORL fazı · ${
      data.health.ok ? '<span class="ok">sağlık: temiz</span>' : '<span class="bad">sağlık: sorun var</span>'
    }`,
    stamp,
  )}
  ${nav('index')}
  <div class="grid">
    ${kpi('Süreç', data.kpis.processes, '5 sütun')}
    ${kpi('Kontrol', data.kpis.controls, Object.entries(fams).map(([k, v]) => `${k} ${v}`).join(' · '))}
    ${kpi('Ajan', data.kpis.roles, `${data.kpis.orCodes} ORL kodu`)}
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
      <h2>ORL uygulama fazları <span>geçiş kapıları</span></h2>
      <table><thead><tr><th>Faz</th><th>Adım</th><th>ORL</th><th class="num">Adım</th><th class="num">Kapı</th><th class="num">Gün</th><th>Ajan modu</th></tr></thead>
      <tbody>${phases
        .map(
          (p) => `<tr><td class="mono">${p.id}</td><td>${p.name.replace(/^Faz \d+ — /, '')}</td>
          <td class="mono">${p.orl}</td><td class="num">${p.steps}</td><td class="num">${p.gates}</td>
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
  `${head('Süreç Kütüphanesi', `${processes.length} süreç · ${controls.length} kontrol · ORL 6 fazı`, stamp)}
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


// ── roles ─────────────────────────────────────────────────
const roleDetail = (r) => `
  <details>
    <summary><span class="mono">${r.id}</span> &nbsp;<b>${r.name?.tr ?? ''}</b> &nbsp;
      <span class="pill">${r.layer ?? '—'}</span>
      <span class="pill">${(r.process_codes ?? []).length} süreç kodu</span>
      <span class="pill">${(r.skills ?? []).length} beceri</span></summary>
    <dl class="kv">
      <dt>Amaç</dt><dd>${r.purpose?.tr ?? '—'}</dd>
      <dt>Raporlar</dt><dd>${r.reports_to ?? '—'}</dd>
      <dt>İnsan muadili</dt><dd>${r.human_equivalent?.tr ?? '—'}</dd>
      <dt>Sorumluluklar</dt><dd>${(r.responsibilities ?? [])
        .map((x) => `${x.desc?.tr ?? ''} <span class="pill">${x.dora_ref?.article ?? ''}</span>`)
        .join('<br>') || '—'}</dd>
      <dt>Beceriler</dt><dd>${(r.skills ?? [])
        .map((s) => `${s.name ?? s.skill_id} <span class="pill">${s.autonomy_level}</span>`)
        .join(' · ')}</dd>
      <dt>İnsan gözetimi</dt><dd>${(r.human_oversight?.required_for ?? []).join(', ') || '—'}${
        r.human_oversight?.approver_role ? ` · onaylayan: ${r.human_oversight.approver_role}` : ''
      }</dd>
      <dt>Süreç kodları</dt><dd>${(r.process_codes ?? []).map((c) => `<span class="mono">${c}</span>`).join(' · ') || '—'}</dd>
      <dt>Tier</dt><dd>${(r.tier_activation ?? []).join(', ') || '—'}</dd>
      <dt>Bağımsızlık</dt><dd>${(r.independence_constraints ?? []).join(', ') || 'yok'}</dd>
    </dl>
  </details>`;

const rolesHtml = page(
  'Ajanlar — DORA AI Ajan Paketi',
  `${head('Ajan Kataloğu', `${roles.length} ajan · üç savunma hattı · CORF/ORL süreç kodları`, stamp)}
  ${nav('roles')}
  <section>
    <h2>Ajanlar <span>satıra tıklayın</span></h2>
    <table><thead><tr><th>Ajan</th><th>Ad</th><th>Katman</th><th>Raporlar</th><th class="num">Beceri</th><th class="num">Kod</th></tr></thead>
    <tbody>${roles
      .map(
        (r) => `<tr><td class="mono">${r.id}</td><td>${r.name?.tr ?? ''}</td>
        <td><span class="pill">${r.layer ?? '—'}</span></td><td>${r.reports_to ?? '—'}</td>
        <td class="num">${(r.skills ?? []).length}</td><td class="num">${(r.process_codes ?? []).length}</td></tr>`,
      )
      .join('')}</tbody></table>
  </section>
  <section><h2>Ayrıntılar</h2>${roles.map(roleDetail).join('')}</section>`,
);

// ── glossary ──────────────────────────────────────────────
const catName = {
  risk: 'Risk',
  incident: 'Olay',
  testing: 'Test',
  third_party: 'Üçüncü taraf',
  info_sharing: 'Bilgi paylaşımı',
  governance: 'Yönetişim',
};
const termRow = (x) => `
  <details>
    <summary><span class="mono">${x.id}</span> &nbsp;<b>${x.name?.tr ?? ''}</b> &nbsp;
      <span class="pill">${catName[x.category] ?? x.category ?? '—'}</span>
      <span class="pill">${x.dora_ref?.article ?? ''}</span></summary>
    <dl class="kv">
      <dt>Tanım</dt><dd>${x.definition?.source_quote ?? '—'}</dd>
      <dt>Kaynak</dt><dd>${x.definition?.source ?? '—'}</dd>
      <dt>Kriterler</dt><dd>${(x.classification_criteria ?? []).join('<br>') || '—'}</dd>
      <dt>İlgili roller</dt><dd>${(x.related_roles ?? []).map((c) => `<span class="mono">${c}</span>`).join(' · ') || '—'}</dd>
      <dt>İlgili süreçler</dt><dd>${(x.related_processes ?? []).map((c) => `<span class="mono">${c}</span>`).join(' · ') || '—'}</dd>
    </dl>
  </details>`;

const glossaryHtml = page(
  'Sözlük — DORA AI Ajan Paketi',
  `${head('DORA Sözlüğü', `${terms.length} terim · DORA + RTS/ITS referanslı`, stamp)}
  ${nav('glossary')}
  <section>
    <h2>Terimler <span>satıra tıklayın</span></h2>
    <table><thead><tr><th>Terim</th><th>Ad</th><th>Kategori</th><th>DORA</th><th class="num">Rol</th><th class="num">Süreç</th></tr></thead>
    <tbody>${terms
      .map(
        (x) => `<tr><td class="mono">${x.id}</td><td>${x.name?.tr ?? ''}</td>
        <td><span class="pill">${catName[x.category] ?? x.category ?? '—'}</span></td>
        <td>${x.dora_ref?.article ?? '—'}</td>
        <td class="num">${(x.related_roles ?? []).length}</td>
        <td class="num">${(x.related_processes ?? []).length}</td></tr>`,
      )
      .join('')}</tbody></table>
  </section>
  <section><h2>Tanımlar</h2>${terms.map(termRow).join('')}</section>`,
);

// ── mapping ───────────────────────────────────────────────
const mapRow = (a) => `
  <details>
    <summary><span class="mono">${a.id}</span> &nbsp;<b>${a.title}</b> &nbsp;
      <span class="pill ${a.status === 'covered' ? 'ok' : a.status === 'partial' ? 'warn' : 'bad'}">${a.status}</span></summary>
    <dl class="kv">
      <dt>Bölüm</dt><dd>${a.chapter ?? '—'}</dd>
      <dt>Yükümlülükler</dt><dd>${(a.obligations ?? []).map((o) => '• ' + o).join('<br>') || '—'}</dd>
      <dt>Süreçler</dt><dd>${(a.processes ?? []).map((c) => `<span class="mono">${c}</span>`).join(' · ') || '—'}</dd>
      <dt>Kontroller</dt><dd>${(a.controls ?? []).map((c) => `<span class="mono">${c}</span>`).join(' · ') || '—'}</dd>
      <dt>Sahip roller</dt><dd>${(a.roles ?? []).map((c) => `<span class="mono">${c}</span>`).join(' · ') || '—'}</dd>
      ${a.note ? `<dt>Not</dt><dd>${a.note}</dd>` : ''}
    </dl>
  </details>`;

const mappingHtml = page(
  'DORA eşlemesi — DORA AI Ajan Paketi',
  `${head('DORA Madde Eşlemesi', `${articles.length} madde · ${byStatus.covered} kapsandı · ${byStatus.partial} kısmi · ${byStatus.gap} boşluk`, stamp)}
  ${nav('mapping')}
  <section>
    <h2>Maddeler <span>satıra tıklayın</span></h2>
    <table><thead><tr><th>Madde</th><th>Başlık</th><th>Süreçler</th><th>Kontroller</th><th>Durum</th></tr></thead>
    <tbody>${articles
      .map(
        (a) => `<tr><td class="mono">${a.id}</td><td>${a.title}</td>
        <td>${(a.processes ?? []).length}</td><td>${(a.controls ?? []).length}</td>
        <td><span class="pill ${a.status === 'covered' ? 'ok' : a.status === 'partial' ? 'warn' : 'bad'}">${a.status}</span></td></tr>`,
      )
      .join('')}</tbody></table>
  </section>
  <section><h2>Ayrıntılar</h2>${articles.map(mapRow).join('')}</section>`,
);

// ── sources ───────────────────────────────────────────────
const sourcesHtml = page(
  'Veri kaynakları — DORA AI Ajan Paketi',
  `${head('Veri Nereden Girilir', 'tanımlar dosyada · oturum verisi sihirbazda · kanıt oturum dizininde', stamp)}
  ${nav('sources')}
  <section>
    <h2>1. Tanımlar — depodaki YAML dosyaları</h2>
    <table><thead><tr><th>Ne</th><th>Dosya</th><th class="num">Kayıt</th><th>Nasıl değişir</th></tr></thead>
    <tbody>
      <tr><td>Süreçler</td><td class="mono">data/processes/pillar-*.yaml</td><td class="num">${processes.length}</td><td>YAML düzenle → \`build-dashboard\`</td></tr>
      <tr><td>Kontroller</td><td class="mono">data/controls/controls-catalog.yaml</td><td class="num">${controls.length}</td><td>YAML düzenle</td></tr>
      <tr><td>Ajan rolleri</td><td class="mono">data/roles/roles-catalog.yaml</td><td class="num">${roles.length}</td><td>YAML düzenle</td></tr>
      <tr><td>Sözlük</td><td class="mono">data/glossary/glossary-full.yaml</td><td class="num">${terms.length}</td><td>YAML düzenle</td></tr>
      <tr><td>DORA eşlemesi</td><td class="mono">data/mapping/dora-articles.yaml</td><td class="num">${articles.length}</td><td>YAML düzenle → \`render-mapping\`</td></tr>
      <tr><td>Ajan → süreç kodu</td><td class="mono">data/orl-integration/agent-to-orl-mapping.yaml</td><td class="num">${roles.reduce((s, r) => s + (r.process_codes ?? []).length, 0)}</td><td>YAML düzenle</td></tr>
      <tr><td>Kurulum fazları</td><td class="mono">onboarding/orl-lifecycle.yaml</td><td class="num">${phases.length}</td><td>YAML düzenle</td></tr>
      <tr><td>Senaryolar</td><td class="mono">tests/synthetic-scenarios/*.yaml</td><td class="num">${scenarios.length}</td><td>YAML düzenle</td></tr>
    </tbody></table>
    <p class="sub" style="margin-top:12px">Şema doğrulaması: <span class="mono">node bin/dora-onboard.mjs validate --strict</span></p>
  </section>

  <section>
    <h2>2. Oturum verisi — kurumun kendi bilgileri</h2>
    <p class="sub">Sihirbaz çalıştırıldığında <span class="mono">.dora-onboarding/&lt;oturum&gt;/</span> altında JSON artefaktlar üretilir.</p>
    <table><thead><tr><th>Komut</th><th>Ne yapar</th><th>Ürettiği dosya</th></tr></thead>
    <tbody>
      <tr><td class="mono">init --tier tier2 --regulator BDDK</td><td>Oturum açar, profil ve yargı alanı</td><td>session.json · institution-profile.json · jurisdiction.json</td></tr>
      <tr><td class="mono">phase C1 --demo</td><td>İş hizmetleri kataloğu</td><td>business-service-catalogue.json</td></tr>
      <tr><td class="mono">phase C2 --demo</td><td>Etki toleransları, risk iştahı, SLA</td><td>impact-tolerances.json · risk-appetite.json · sla-overrides.json</td></tr>
      <tr><td class="mono">phase C3 --demo</td><td>Envanter, ajan aktivasyonu, eşleme</td><td>ict-inventory.json · agent-activation.json · orl-mapping.json</td></tr>
      <tr><td class="mono">ingest --inventory &lt;csv&gt; --providers &lt;csv&gt;</td><td>Dış veri alımı (CMDB/tedarikçi)</td><td>ict-inventory.json güncellenir</td></tr>
      <tr><td class="mono">rules --session &lt;id&gt;</td><td>Karar kurallarını olgularla değerlendirir</td><td>rule-evaluation.json</td></tr>
      <tr><td class="mono">scenario --all --golden</td><td>27 kabul assertion'ı</td><td>scenario-&lt;ID&gt;-results.json</td></tr>
      <tr><td class="mono">export --session &lt;id&gt;</td><td>Kanıt paketi + manifest</td><td>evidence-bundle.zip</td></tr>
    </tbody></table>
  </section>

  <section>
    <h2>3. Düzenle → yayınla döngüsü</h2>
    <ol class="list">
      <li>YAML dosyasını düzenle (ör. <span class="mono">data/processes/pillar-2-incident.yaml</span>)</li>
      <li><span class="mono">node bin/dora-onboard.mjs validate --strict</span> — şema hatası varsa burada durur</li>
      <li><span class="mono">node docs/tools/render-mapping.mjs</span> — DORA eşlemesi dokümanı</li>
      <li><span class="mono">node docs/tools/build-dashboard.mjs</span> — bu siteyi yeniden üretir</li>
      <li>Tarayıcıyı yenile (sunucu dosyaları diskten okur, yeniden başlatma gerekmez)</li>
    </ol>
  </section>

  <section>
    <h2>4. Hangi dosyada ne var — tam liste</h2>
    <table><thead><tr><th>Klasör</th><th>İçerik</th></tr></thead>
    <tbody>
      <tr><td class="mono">schema/</td><td>${5} JSON Schema — tüm veri dosyalarının sözleşmesi</td></tr>
      <tr><td class="mono">data/</td><td>Tanımlar: süreç, kontrol, rol, sözlük, eşleme</td></tr>
      <tr><td class="mono">onboarding/</td><td>6 fazlı yaşam döngüsü tanımı + CLI</td></tr>
      <tr><td class="mono">tests/</td><td>Kabul senaryoları + golden kanıtlar + fixture'lar</td></tr>
      <tr><td class="mono">docs/</td><td>Mimari, DORA eşlemesi, TR mevzuatı, lisanslama, kararlar (${21}+ dosya)</td></tr>
      <tr><td class="mono">pilots/</td><td>Pilot seçim, sözleşme, vaka şablonu</td></tr>
      <tr><td class="mono">dashboard/ · site/</td><td>Bu site — üretilen çıktı, elle düzenlenmez</td></tr>
      <tr><td class="mono">.dora-onboarding/</td><td>Oturum verisi (git'e girmez)</td></tr>
    </tbody></table>
  </section>`,
);

fs.writeFileSync(path.join(OUT, 'index.html'), indexHtml);
fs.writeFileSync(path.join(OUT, 'processes.html'), processesHtml);
fs.writeFileSync(path.join(OUT, 'controls.html'), controlsHtml);
fs.writeFileSync(path.join(OUT, 'roles.html'), rolesHtml);
fs.writeFileSync(path.join(OUT, 'glossary.html'), glossaryHtml);
fs.writeFileSync(path.join(OUT, 'mapping.html'), mappingHtml);
fs.writeFileSync(path.join(OUT, 'sources.html'), sourcesHtml);

console.log(`dashboard: dashboard/ → index · processes · controls · roles · glossary · mapping · sources · data.json`);
console.log(
  `süreç ${processes.length} · kontrol ${controls.length} · ajan ${roles.length} · senaryo ${scenarios.length} · kapsama %${coveragePct} · sağlık ${
    issues.length === 0 ? 'temiz' : issues.length + ' sorun'
  }`,
);
if (issues.length) {
  for (const i of issues) console.error(' -', i);
  process.exitCode = 1;
}

#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 ustauretim
//
// El kitabını (TR + EN Markdown) tek dosyalık HTML'e çevirir: app/el-kitabi.html
// Sayfa iki bölüm içerir; üstteki TR/EN düğmeleri (app/el-kitabi.js) birini gösterir.
//
// Kullanım: node docs/tools/build-manual.mjs [--check]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const SRC_TR = path.join(ROOT, 'docs/KULLANICI-EL-KITABI.md');
const SRC_EN = path.join(ROOT, 'docs/KULLANICI-EL-KITABI.en.md');
const OUT = path.join(ROOT, 'app/el-kitabi.html');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

const slug = (s) => s.toLowerCase().replace(/[^\wğüşıöç]+/gi, '-').replace(/^-|-$/g, '');

export function renderMarkdown(md) {
  const lines = String(md).replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    if (/^```/.test(line)) {
      const lang = line.slice(3).trim();
      const body = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) body.push(lines[i++]);
      i++;
      out.push(`<pre><code${lang ? ` class="lang-${esc(lang)}"` : ''}>${esc(body.join('\n'))}</code></pre>`);
      continue;
    }

    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      out.push(`<h${level} id="${slug(h[2])}">${inline(h[2])}</h${level}>`);
      i++;
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      out.push('<hr>');
      i++;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const body = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) body.push(lines[i++].replace(/^>\s?/, ''));
      out.push(`<blockquote>${inline(body.join(' '))}</blockquote>`);
      continue;
    }

    if (line.includes('|') && /^\s*\|/.test(line) && /^\s*\|?[\s:-]+\|/.test(lines[i + 1] ?? '')) {
      const head = line.split('|').map((c) => c.trim()).filter(Boolean);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) {
        rows.push(lines[i].split('|').map((c) => c.trim()).filter(Boolean));
        i++;
      }
      out.push(
        `<table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${rows
          .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`)
          .join('')}</tbody></table>`,
      );
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) items.push(lines[i++].replace(/^[-*]\s+/, ''));
      out.push(`<ul>${items.map((x) => `<li>${inline(x)}</li>`).join('')}</ul>`);
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) items.push(lines[i++].replace(/^\d+\.\s+/, ''));
      out.push(`<ol>${items.map((x) => `<li>${inline(x)}</li>`).join('')}</ol>`);
      continue;
    }

    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|```|>|\||[-*]\s|\d+\.\s|---)/.test(lines[i])) {
      para.push(lines[i++]);
    }
    out.push(`<p>${inline(para.join(' '))}</p>`);
  }

  return out.join('\n');
}

function tocFor(md, lang) {
  const entries = [];
  for (const m of md.matchAll(/^##\s+(.*)$/gm)) entries.push({ level: 2, text: m[1] });
  for (const m of md.matchAll(/^###\s+(.*)$/gm)) entries.push({ level: 3, text: m[1] });
  const title = lang === 'en' ? 'Contents' : 'İçindekiler';
  return `<div class="toc"><strong>${title}</strong><br>${entries
    .map((x) => `<a class="t${x.level}" href="#${slug(x.text)}">${inline(x.text)}</a>`)
    .join('')}</div>`;
}

function diagrams(lang) {
  const en = lang === 'en';
  const setup = en
    ? ['Services', 'Tolerances', 'Assets/Owners', 'Scenarios', 'Self-assessment', 'Go-live']
    : ['Hizmetler', 'Toleranslar', 'Varlık/Sorumlu', 'Senaryolar', 'Öz değerlendirme', 'Canlıya geçiş'];
  const flow = en
    ? [['SIEM event', 10, 150], ['Draft record', 212, 150], ['Active record + deadlines', 414, 160], ['Reporting', 626, 124]]
    : [['SIEM olayı', 10, 150], ['Taslak kayıt', 212, 150], ['Aktif kayıt + süreler', 414, 160], ['Raporlama', 626, 124]];
  return `
<figure>
<svg viewBox="0 0 760 120" width="100%" height="120" role="img" aria-label="${en ? 'Setup flow' : 'Kurulum akışı'}">
  <g font-family="Segoe UI, sans-serif" font-size="12" fill="#e9eefb">
    ${setup
      .map((label, idx) => {
        const x = 10 + idx * 125;
        return `<rect x="${x}" y="30" width="110" height="46" rx="10" fill="#182343" stroke="#2a3a63"/>
        <text x="${x + 55}" y="58" text-anchor="middle">${label}</text>
        ${idx < 5 ? `<path d="M${x + 112} 53 L${x + 122} 53" stroke="#5b9cff" stroke-width="2" marker-end="url(#a)"/>` : ''}`;
      })
      .join('')}
    <defs><marker id="a" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="#5b9cff"/></marker></defs>
    <text x="10" y="105" fill="#93a3c4">${en ? 'Step 1 to 6 - each step has a "check this step" button' : 'Adım 1 → 6 · her adımda "adımı denetle"'}</text>
  </g>
</svg>
</figure>
<figure>
<svg viewBox="0 0 760 130" width="100%" height="130" role="img" aria-label="${en ? 'Incident and reporting flow' : 'Olay ve raporlama akışı'}">
  <g font-family="Segoe UI, sans-serif" font-size="12" fill="#e9eefb">
    ${flow
      .map(([label, x, w], i) => `<rect x="${x}" y="20" width="${w}" height="44" rx="10" fill="#182343" stroke="#2a3a63"/>
        <text x="${x + w / 2}" y="47" text-anchor="middle">${label}</text>
        ${i < 3 ? `<path d="M${x + w + 2} 42 L${x + w + 48} 42" stroke="#5b9cff" stroke-width="2" marker-end="url(#b)"/>` : ''}`)
      .join('')}
    <text x="10" y="95" fill="#93a3c4">${en ? '4h initial notification · 72h intermediate report · 1 month final report (from detection)' : '4 saat ilk bildirim · 72 saat ara rapor · 1 ay nihai rapor (tespit anından)'}</text>
    <defs><marker id="b" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="#5b9cff"/></marker></defs>
  </g>
</svg>
</figure>
`;
}

const CSS = `
:root{--bg:#0a0e18;--panel:#121a2b;--line:#223049;--fg:#e9eefb;--muted:#93a3c4;--accent:#5b9cff}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.65 "Segoe UI",system-ui,sans-serif}
.wrap{max-width:900px;margin:0 auto;padding:32px 22px 80px}
header{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:10px;flex-wrap:wrap}
header a{color:var(--accent);text-decoration:none;font-size:13px;border:1px solid var(--line);padding:6px 12px;border-radius:8px}
.langs{display:flex;gap:6px;align-items:center}
.langs button{cursor:pointer;background:#131c30;color:var(--muted);border:1px solid var(--line);border-radius:8px;padding:6px 12px;font:inherit;font-size:13px}
.langs button.on{color:#08101f;background:var(--accent);border-color:var(--accent);font-weight:600}
h1{font-size:26px;margin:14px 0 6px}
h2{font-size:19px;margin:32px 0 8px;padding-top:14px;border-top:1px solid var(--line)}
h3{font-size:15px;margin:22px 0 6px;color:#cfe0ff}
p,li{color:#dbe4f7}
code{background:#0c1322;border:1px solid var(--line);border-radius:5px;padding:1px 5px;font-size:13px}
pre{background:#0c1322;border:1px solid var(--line);border-radius:10px;padding:14px;overflow:auto}
pre code{border:0;background:none;padding:0}
table{width:100%;border-collapse:collapse;margin:14px 0;font-size:13.5px}
th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top}
th{color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.4px}
blockquote{border-left:3px solid var(--accent);margin:14px 0;padding:8px 14px;background:#131c30;border-radius:0 8px 8px 0;color:#cfe0ff}
hr{border:0;border-top:1px solid var(--line);margin:26px 0}
figure{margin:18px 0}
a{color:var(--accent)}
.toc{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px 18px;font-size:14px}
.toc a{display:inline-block;margin:3px 10px 3px 0}
.toc a.t3{margin-left:16px;font-size:13px;color:#9db4d6}
[data-doc][hidden]{display:none}
`;

const mdTr = fs.readFileSync(SRC_TR, 'utf8');
const mdEn = fs.readFileSync(SRC_EN, 'utf8');

const section = (lang, md) => `<section data-doc="${lang}" lang="${lang}"${lang === 'en' ? ' hidden' : ''}>
${diagrams(lang)}
${tocFor(md, lang)}
${renderMarkdown(md)}
</section>`;

const html = `<!doctype html>
<html lang="tr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>User Handbook — DORA Agent Package</title>
<style>${CSS}</style></head>
<body><div class="wrap">
<header>
  <strong>DORA Agent Package · Handbook</strong>
  <span class="langs">
    <button data-lang-btn="tr" class="on">Türkçe</button>
    <button data-lang-btn="en">English</button>
    <a href="/app/">← Uygulamaya dön / Back to app</a>
  </span>
</header>
${section('tr', mdTr)}
${section('en', mdEn)}
</div>
<script src="/app/el-kitabi.js"></script>
</body></html>
`;

const checkOnly = process.argv.includes('--check');
if (checkOnly) {
  if (fs.existsSync(OUT) && fs.readFileSync(OUT, 'utf8') !== html) {
    console.error('el-kitabi.html güncel değil — node docs/tools/build-manual.mjs');
    process.exit(1);
  }
  console.log('el-kitabi.html güncel');
  process.exit(0);
}

fs.writeFileSync(OUT, html, 'utf8');
console.log(`yazıldı: ${path.relative(ROOT, OUT)} (${(html.length / 1024).toFixed(1)} KB)`);
console.log(`  TR: ${mdTr.split('\n').length} satır · EN: ${mdEn.split('\n').length} satır`);
console.log(`  h2: TR ${(mdTr.match(/^##\s+/gm) ?? []).length} · EN ${(mdEn.match(/^##\s+/gm) ?? []).length}`);

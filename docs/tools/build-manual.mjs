#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 ustauretim
//
// El kitabını (Markdown) tek dosyalık HTML'e çevirir: app/el-kitabi.html
// Desteklenen Markdown: h1-h3, paragraf, **kalın**, `kod`, kod bloğu, listeler, tablolar,
// alıntı, yatay çizgi, bağlantı. Yeterli ve bağımlılıksız.
//
// Kullanım: node docs/tools/build-manual.mjs [--check]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const SRC = path.join(ROOT, 'docs/KULLANICI-EL-KITABI.md');
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

    // kod bloğu
    if (/^```/.test(line)) {
      const lang = line.slice(3).trim();
      const body = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) body.push(lines[i++]);
      i++;
      out.push(`<pre><code${lang ? ` class="lang-${esc(lang)}"` : ''}>${esc(body.join('\n'))}</code></pre>`);
      continue;
    }

    // başlık
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const text = h[2];
      out.push(`<h${level} id="${slug(text)}">${inline(text)}</h${level}>`);
      i++;
      continue;
    }

    // yatay çizgi
    if (/^---+$/.test(line.trim())) {
      out.push('<hr>');
      i++;
      continue;
    }

    // alıntı
    if (/^>\s?/.test(line)) {
      const body = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) body.push(lines[i++].replace(/^>\s?/, ''));
      out.push(`<blockquote>${inline(body.join(' '))}</blockquote>`);
      continue;
    }

    // tablo
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

    // sırasız liste
    if (/^[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) items.push(lines[i++].replace(/^[-*]\s+/, ''));
      out.push(`<ul>${items.map((x) => `<li>${inline(x)}</li>`).join('')}</ul>`);
      continue;
    }

    // sıralı liste
    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) items.push(lines[i++].replace(/^\d+\.\s+/, ''));
      out.push(`<ol>${items.map((x) => `<li>${inline(x)}</li>`).join('')}</ol>`);
      continue;
    }

    // paragraf
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|```|>|\||[-*]\s|\d+\.\s|---)/.test(lines[i])) {
      para.push(lines[i++]);
    }
    out.push(`<p>${inline(para.join(' '))}</p>`);
  }

  return out.join('\n');
}

const DIAGRAM = `
<figure>
<svg viewBox="0 0 760 120" width="100%" height="120" role="img" aria-label="Kurulum akışı">
  <g font-family="Segoe UI, sans-serif" font-size="12" fill="#e9eefb">
    ${['Hizmetler', 'Toleranslar', 'Varlık/Sorumlu', 'Senaryolar', 'Öz değerlendirme', 'Canlıya geçiş']
      .map((label, idx) => {
        const x = 10 + idx * 125;
        return `<rect x="${x}" y="30" width="110" height="46" rx="10" fill="#182343" stroke="#2a3a63"/>
        <text x="${x + 55}" y="58" text-anchor="middle">${label}</text>
        ${idx < 5 ? `<path d="M${x + 112} 53 L${x + 122} 53" stroke="#5b9cff" stroke-width="2" marker-end="url(#a)"/>` : ''}`;
      })
      .join('')}
    <defs><marker id="a" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="#5b9cff"/></marker></defs>
    <text x="10" y="105" fill="#93a3c4">Adım 1 → 6 · her adımda "adımı denetle"</text>
  </g>
</svg>
</figure>
<figure>
<svg viewBox="0 0 760 130" width="100%" height="130" role="img" aria-label="Olay ve raporlama akışı">
  <g font-family="Segoe UI, sans-serif" font-size="12" fill="#e9eefb">
    <rect x="10" y="20" width="150" height="44" rx="10" fill="#182343" stroke="#2a3a63"/>
    <text x="85" y="47" text-anchor="middle">SIEM olayı</text>
    <path d="M162 42 L210 42" stroke="#5b9cff" stroke-width="2" marker-end="url(#b)"/>
    <rect x="212" y="20" width="150" height="44" rx="10" fill="#182343" stroke="#2a3a63"/>
    <text x="287" y="47" text-anchor="middle">Taslak kayıt</text>
    <path d="M364 42 L412 42" stroke="#5b9cff" stroke-width="2" marker-end="url(#b)"/>
    <rect x="414" y="20" width="160" height="44" rx="10" fill="#182343" stroke="#2a3a63"/>
    <text x="494" y="47" text-anchor="middle">Aktif kayıt + süreler</text>
    <path d="M576 42 L624 42" stroke="#5b9cff" stroke-width="2" marker-end="url(#b)"/>
    <rect x="626" y="20" width="124" height="44" rx="10" fill="#182343" stroke="#2a3a63"/>
    <text x="688" y="47" text-anchor="middle">Raporlama</text>
    <text x="10" y="95" fill="#93a3c4">4 saat ilk bildirim · 72 saat ara rapor · 1 ay nihai rapor (tespit anından)</text>
    <defs><marker id="b" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="#5b9cff"/></marker></defs>
  </g>
</svg>
</figure>
`;

const CSS = `
:root{--bg:#0a0e18;--panel:#121a2b;--line:#223049;--fg:#e9eefb;--muted:#93a3c4;--accent:#5b9cff}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.65 "Segoe UI",system-ui,sans-serif}
.wrap{max-width:900px;margin:0 auto;padding:32px 22px 80px}
header{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;gap:12px}
header a{color:var(--accent);text-decoration:none;font-size:13px;border:1px solid var(--line);padding:6px 12px;border-radius:8px}
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
`;

const md = fs.readFileSync(SRC, 'utf8');
const body = renderMarkdown(md);
const title = (md.match(/^#\s+(.*)$/m) ?? [, 'El kitabı'])[1];

const toc = [
  ...[...md.matchAll(/^##\s+(.*)$/gm)].map((m) => ({ level: 2, text: m[1] })),
  ...[...md.matchAll(/^###\s+(.*)$/gm)].map((m) => ({ level: 3, text: m[1] })),
]
  .map((x) => `<a class="t${x.level}" href="#${slug(x.text)}">${inline(x.text)}</a>`)
  .join('');
const html = `<!doctype html>
<html lang="tr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — DORA Ajan Paketi</title>
<style>${CSS}</style></head>
<body><div class="wrap">
<header><strong>DORA Ajan Paketi · El Kitabı</strong>
<span><a href="/app/">← Uygulamaya dön</a></span></header>
${DIAGRAM}
<div class="toc"><strong>İçindekiler</strong><br>${toc}</div>
${body}
</div></body></html>
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
console.log(`  başlık: ${title}`);
console.log(`  bölüm: ${(md.match(/^##\s+/gm) ?? []).length}`);

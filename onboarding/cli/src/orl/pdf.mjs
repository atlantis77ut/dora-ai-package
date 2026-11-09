// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 ustauretim
//
// Küçük PDF yazıcı (bağımlılıksız): A4, Helvetica, başlık/paragraf/satır.
// Türkçe karakterler WinAnsi'de bulunmadığı için ASCII'ye çevrilir (ı→i, ş→s, ğ→g …).
// Bu, raporun okunabilirliğini korur; tipografik birebir değildir.

const A4 = { width: 595, height: 842 };
const MARGIN = 50;
const TRANSLIT = {
  ı: 'i', İ: 'I', ş: 's', Ş: 'S', ğ: 'g', Ğ: 'G', ç: 'c', Ç: 'C', ö: 'o', Ö: 'O', ü: 'u', Ü: 'U',
  â: 'a', î: 'i', û: 'u', '’': "'", '“': '"', '”': '"', '–': '-', '—': '-', '…': '...', '·': '-', '×': 'x',
};

export function toAscii(s) {
  return String(s ?? '')
    .replace(/[ıİşŞğĞçÇöÖüÜâîû’“”–—…·×]/g, (c) => TRANSLIT[c] ?? c)
    .replace(/[^\x20-\x7E\n]/g, '?');
}

function esc(s) {
  return toAscii(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

/** Yaklaşık karakter genişliği (Helvetica için size * 0.5). */
function wrap(text, size, maxWidth) {
  const perLine = Math.max(20, Math.floor(maxWidth / (size * 0.5)));
  const out = [];
  for (const raw of String(text ?? '').split('\n')) {
    if (!raw) {
      out.push('');
      continue;
    }
    let line = '';
    for (const word of raw.split(/\s+/)) {
      if (!line) line = word;
      else if ((line + ' ' + word).length <= perLine) line += ' ' + word;
      else {
        out.push(line);
        line = word;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

/**
 * @param {{title: string, subtitle?: string, meta?: string[], sections: Array<{heading: string, lines?: string[], table?: {head: string[], rows: string[][]}}>}} doc
 * @returns {Buffer}
 */
export function buildPdf(doc) {
  const pages = [];
  let content = [];
  let y = A4.height - MARGIN;

  const newPage = () => {
    if (content.length) pages.push(content.join('\n'));
    content = [];
    y = A4.height - MARGIN;
  };

  const text = (s, size = 11, bold = false, indent = 0) => {
    for (const line of wrap(s, size, A4.width - MARGIN * 2 - indent)) {
      if (y < MARGIN + 30) newPage();
      content.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf 1 0 0 1 ${MARGIN + indent} ${y} Tm (${esc(line)}) Tj ET`);
      y -= size * 1.45;
    }
  };

  const rule = () => {
    if (y < MARGIN + 30) newPage();
    content.push(`0.6 w ${MARGIN} ${y + 6} m ${A4.width - MARGIN} ${y + 6} l S`);
    y -= 10;
  };

  text(doc.title, 18, true);
  if (doc.subtitle) text(doc.subtitle, 11);
  for (const m of doc.meta ?? []) text(m, 9);
  rule();

  for (const sec of doc.sections ?? []) {
    if (y < MARGIN + 60) newPage();
    text(sec.heading, 13, true);
    for (const line of sec.lines ?? []) text(line, 10);
    if (sec.table) {
      const cols = sec.table.head.length;
      const colW = (A4.width - MARGIN * 2) / cols;
      text(sec.table.head.map((h) => String(h).slice(0, Math.floor(colW / 5))).join(' | '), 9, true);
      for (const row of sec.table.rows) {
        text(row.map((c) => String(c).slice(0, Math.floor(colW / 5))).join(' | '), 9);
      }
    }
    y -= 6;
  }
  if (content.length) pages.push(content.join('\n'));
  if (!pages.length) pages.push('BT /F1 11 Tf 1 0 0 1 50 800 Tm (Bos rapor) Tj ET');

  // PDF nesneleri
  const objects = [];
  const pageObjIds = [];
  let nextId = 3; // 1 catalog, 2 pages
  for (const contentStr of pages) {
    const pageId = nextId++;
    const contentId = nextId++;
    pageObjIds.push(pageId);
    objects.push(
      `${pageId} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4.width} ${A4.height}] ` +
        `/Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >> ` +
        `/F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >> >> >> ` +
        `/Contents ${contentId} 0 R >> endobj`,
    );
    const stream = contentStr;
    objects.push(`${contentId} 0 obj << /Length ${Buffer.byteLength(stream, 'latin1')} >> stream\n${stream}\nendstream endobj`);
  }

  const header = ['%PDF-1.4', '%âãÏÓ'];
  const catalog = '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj';
  const pagesObj = `2 0 obj << /Type /Pages /Kids [${pageObjIds.map((id) => id + ' 0 R').join(' ')}] /Count ${pageObjIds.length} >> endobj`;

  const parts = [...header, catalog, pagesObj, ...objects];
  let out = '';
  const offsets = [];
  for (const part of parts) {
    offsets.push(Buffer.byteLength(out, 'latin1'));
    out += part + '\n';
  }
  const xrefStart = Buffer.byteLength(out, 'latin1');
  const count = parts.length + 1;
  let xref = `xref\n0 ${count}\n0000000000 65535 f \n`;
  // nesne numaraları sıralı değil; her nesnenin kendi numarasını başlıktan al
  const byId = new Map();
  parts.forEach((p, i) => {
    const m = p.match(/^(\d+) 0 obj/);
    if (m) byId.set(Number(m[1]), offsets[i]);
  });
  for (let id = 1; id < count; id++) {
    const off = byId.get(id);
    xref += off === undefined ? '0000000000 65535 f \n' : String(off).padStart(10, '0') + ' 00000 n \n';
  }
  const trailer = `trailer << /Size ${count} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(out + xref + trailer, 'latin1');
}

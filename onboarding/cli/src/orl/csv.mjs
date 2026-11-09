// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 ustauretim
//
// Küçük CSV okuyucu + envanter eşlemesi.
// Ayırıcı otomatik seçilir (, veya ;), tırnaklı alanlar, kaçışlı tırnak ("") ve
// satır sonu içeren alanlar desteklenir. Başlık satırı varsa sütun adlarından eşlenir.

const CRIT_MAP = {
  critical: 'critical',
  kritik: 'critical',
  'çok yüksek': 'critical',
  cok_yuksek: 'critical',
  important: 'important',
  önemli: 'important',
  onemli: 'important',
  yüksek: 'important',
  yuksek: 'important',
  standard: 'standard',
  standart: 'standard',
  normal: 'standard',
  düşük: 'standard',
  dusuk: 'standard',
  low: 'standard',
};

/** Ham CSV metnini satır dizisine çevirir. */
export function parseCsv(text) {
  const src = String(text ?? '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  if (!src.trim()) return [];

  const firstLine = src.split('\n')[0];
  const delimiter = (firstLine.match(/;/g) ?? []).length > (firstLine.match(/,/g) ?? []).length ? ';' : ',';

  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') {
      quoted = true;
      continue;
    }
    if (c === delimiter) {
      row.push(field);
      field = '';
      continue;
    }
    if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }
    field += c;
  }
  row.push(field);
  rows.push(row);

  return rows
    .map((r) => r.map((v) => v.trim()))
    .filter((r) => r.some((v) => v !== ''));
}

/** Envanter CSV'sini varlık listesine çevirir. */
export function parseInventoryCsv(text) {
  const rows = parseCsv(text);
  if (!rows.length) return [];
  const header = rows[0].map((h) => h.toLowerCase());
  const hasHeader = header.some((h) => ['ad', 'name', 'varlık', 'varlik', 'kritiklik', 'criticality'].includes(h));
  const body = hasHeader ? rows.slice(1) : rows;

  const idx = (names, fallback) => {
    if (!hasHeader) return fallback;
    const i = header.findIndex((h) => names.includes(h));
    return i >= 0 ? i : fallback;
  };
  const nameI = idx(['ad', 'name', 'varlık', 'varlik', 'sistem', 'system'], 0);
  const critI = idx(['kritiklik', 'criticality', 'önem', 'onem', 'seviye'], 1);
  const provI = idx(['tedarikçi', 'tedarikci', 'provider', 'vendor'], 2);
  const idI = idx(['id', 'kod', 'code'], -1);

  return body
    .map((r, i) => {
      const name = (r[nameI] ?? '').trim();
      if (!name) return null;
      return {
        id: (idI >= 0 ? r[idI] : '') || `AST-${String(i + 1).padStart(3, '0')}`,
        name,
        criticality: CRIT_MAP[String(r[critI] ?? '').toLowerCase().trim()] ?? 'standard',
        provider: (r[provI] ?? '').trim(),
      };
    })
    .filter(Boolean);
}

export const INVENTORY_CSV_TEMPLATE = `id,ad,kritiklik,tedarikçi
AST-001,Core Banking,critical,Vendor X
AST-002,API Gateway,important,Vendor Y
AST-003,Raporlama,standard,iç ekip
`;

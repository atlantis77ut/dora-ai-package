// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 ustauretim
//
// Kural motoru: süreçlerdeki `decision_rules[].condition` ifadelerini deterministik olarak
// değerlendirir. Doğal dil yorumlamaz; desteklenen söz diziminin dışına çıkan kural
// "parse_error" olarak raporlanır — sessizce yanlış sonuç üretmez.
//
// Desteklenen söz dizimi:
//   karşılaştırma : ==  !=  >  >=  <  <=
//   mantık        : AND / OR / NOT  (&& || ! de kabul edilir)
//   liste         : IN [a, b, c]   ·  NOT IN [...]
//   parantez      : ( ... )
//   değerler      : sayı (90, 9.0), metin ('kritik', "kabul edilemez"), true/false/null
//   alan          : a.b.c (nokta ile iç içe)
//   birim         : sayıdan sonra gelen ay/gun/gün/saat/yil/yıl/EUR/adet/kez yok sayılır;
//                   %30 biçimi 30 olarak okunur.
//
// Kural: alan bulunamazsa `undefined` kabul edilir, karşılaştırma false döner ve alan
// "eksik" olarak raporlanır (kural yanlışlıkla tetiklenmesin diye görünür kılınır).

const UNIT_WORDS = new Set(['ay', 'gun', 'gün', 'saat', 'yil', 'yıl', 'eur', 'adet', 'kez', 'dk', 'dakika', 'saniye']);

function tokenize(src) {
  const tokens = [];
  let i = 0;
  const s = String(src ?? '');

  const isIdStart = (c) => /[A-Za-zÇĞİÖŞÜçğıöşü_]/.test(c);
  const isIdPart = (c) => /[A-Za-z0-9ÇĞİÖŞÜçğıöşü_.]/.test(c);

  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    // operatörler
    const two = s.slice(i, i + 2);
    if (['==', '!=', '>=', '<='].includes(two)) {
      tokens.push({ type: 'op', value: two });
      i += 2;
      continue;
    }
    if (two === '&&') {
      tokens.push({ type: 'op', value: 'AND' });
      i += 2;
      continue;
    }
    if (two === '||') {
      tokens.push({ type: 'op', value: 'OR' });
      i += 2;
      continue;
    }
    if ('><'.includes(c)) {
      tokens.push({ type: 'op', value: c });
      i++;
      continue;
    }
    if (c === '(' || c === ')') {
      tokens.push({ type: c });
      i++;
      continue;
    }
    if (c === '[' || c === ']' || c === ',') {
      tokens.push({ type: c });
      i++;
      continue;
    }
    if (c === '!') {
      tokens.push({ type: 'op', value: 'NOT' });
      i++;
      continue;
    }
    // sayı (%)

    if (/[0-9%]/.test(c)) {
      let j = i;
      let pct = false;
      if (s[j] === '%') {
        pct = true;
        j++;
      }
      let num = '';
      while (j < s.length && /[0-9.]/.test(s[j])) {
        num += s[j];
        j++;
      }
      tokens.push({ type: 'num', value: Number(num) });
      i = j;
      continue;
    }
    // metin
    if (c === "'" || c === '"') {
      const quote = c;
      let j = i + 1;
      let str = '';
      while (j < s.length && s[j] !== quote) {
        str += s[j];
        j++;
      }
      tokens.push({ type: 'str', value: str });
      i = j + 1;
      continue;
    }
    // tanımlayıcı / anahtar kelime / birim
    if (isIdStart(c)) {
      let j = i;
      let id = '';
      while (j < s.length && isIdPart(s[j])) {
        id += s[j];
        j++;
      }
      i = j;
      const lower = id.toLowerCase();
      if (lower === 'and') tokens.push({ type: 'op', value: 'AND' });
      else if (lower === 'or') tokens.push({ type: 'op', value: 'OR' });
      else if (lower === 'not') tokens.push({ type: 'op', value: 'NOT' });
      else if (lower === 'in') tokens.push({ type: 'op', value: 'IN' });
      else if (lower === 'true') tokens.push({ type: 'lit', value: true });
      else if (lower === 'false') tokens.push({ type: 'lit', value: false });
      else if (lower === 'null') tokens.push({ type: 'lit', value: null });
      else if (UNIT_WORDS.has(lower)) {
        const prev = tokens[tokens.length - 1];
        // yalnız sayıdan sonra birim olarak yok say
        if (prev && prev.type === 'num') continue;
        tokens.push({ type: 'id', value: id });
      } else tokens.push({ type: 'id', value: id });
      continue;
    }
    throw new Error(`beklenmeyen karakter: "${c}"`);
  }
  return tokens;
}

function parse(tokens) {
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  function parseOr() {
    let left = parseAnd();
    while (peek() && peek().type === 'op' && peek().value === 'OR') {
      next();
      left = { type: 'or', left, right: parseAnd() };
    }
    return left;
  }

  function parseAnd() {
    let left = parseNot();
    while (peek() && peek().type === 'op' && peek().value === 'AND') {
      next();
      left = { type: 'and', left, right: parseNot() };
    }
    return left;
  }

  function parseNot() {
    if (peek() && peek().type === 'op' && peek().value === 'NOT') {
      next();
      return { type: 'not', expr: parseNot() };
    }
    return parseComparison();
  }

  function parseComparison() {
    const left = parsePrimary();
    const t = peek();
    if (t && t.type === 'op' && ['==', '!=', '>', '>=', '<', '<='].includes(t.value)) {
      next();
      const right = parsePrimary();
      return { type: 'cmp', op: t.value, left, right };
    }
    if (t && t.type === 'op' && t.value === 'IN') {
      next();
      const list = parseList();
      return { type: 'in', expr: left, list };
    }
    if (t && t.type === 'op' && t.value === 'NOT' && tokens[pos + 1]?.value === 'IN') {
      next();
      next();
      const list = parseList();
      return { type: 'notin', expr: left, list };
    }
    return left;
  }

  function parseList() {
    if (!peek() || peek().type !== '[') throw new Error('IN için [ liste ] bekleniyordu');
    next();
    const items = [];
    while (peek() && peek().type !== ']') {
      if (peek().type === ',') {
        next();
        continue;
      }
      items.push(parsePrimary());
    }
    if (!peek()) throw new Error('liste kapanmadı: ]');
    next();
    return items;
  }

  function parsePrimary() {
    const t = next();
    if (!t) throw new Error('ifade eksik');
    if (t.type === '(') {
      const expr = parseOr();
      if (!peek() || peek().type !== ')') throw new Error('parantez kapanmadı');
      next();
      return expr;
    }
    if (t.type === 'num' || t.type === 'str' || t.type === 'lit') return { type: 'val', value: t.value };
    if (t.type === 'id') return { type: 'id', path: t.value };
    throw new Error(`beklenmeyen simge: ${t.type} ${t.value ?? ''}`);
  }

  const ast = parseOr();
  if (pos < tokens.length) throw new Error('ifade sonunda beklenmeyen simge');
  return ast;
}

function resolve(facts, path, missing) {
  let cur = facts;
  for (const key of path.split('.')) {
    if (cur === null || cur === undefined || typeof cur !== 'object' || !(key in cur)) {
      missing.add(path);
      return undefined;
    }
    cur = cur[key];
  }
  return cur;
}

function evalNode(node, facts, missing) {
  switch (node.type) {
    case 'val':
      return node.value;
    case 'id': {
      // Nokta içermeyen ve facts'te bulunmayan tanımlayıcı: metin sabiti kabul et
      // (ör. kurum.tier == tier1)
      if (!node.path.includes('.')) {
        const known = resolve(facts, node.path, new Set());
        if (known !== undefined) return known;
        if (!(node.path in facts)) {
          missing.add(node.path);
          return node.path;
        }
        return known;
      }
      return resolve(facts, node.path, missing);
    }
    case 'not':
      return !truthy(evalNode(node.expr, facts, missing));
    // Kısa devre yok: her iki taraf da değerlendirilir ki eksik alanlar raporlanabilsin
    case 'and': {
      const l = truthy(evalNode(node.left, facts, missing));
      const r = truthy(evalNode(node.right, facts, missing));
      return l && r;
    }
    case 'or': {
      const l = truthy(evalNode(node.left, facts, missing));
      const r = truthy(evalNode(node.right, facts, missing));
      return l || r;
    }
    case 'cmp': {
      const a = evalNode(node.left, facts, missing);
      const b = evalNode(node.right, facts, missing);
      return compare(node.op, a, b);
    }
    case 'in': {
      const v = evalNode(node.expr, facts, missing);
      const list = node.list.map((x) => evalNode(x, facts, missing));
      return list.includes(v);
    }
    case 'notin': {
      const v = evalNode(node.expr, facts, missing);
      const list = node.list.map((x) => evalNode(x, facts, missing));
      return !list.includes(v);
    }
    default:
      throw new Error(`bilinmeyen düğüm: ${node.type}`);
  }
}

function truthy(v) {
  if (typeof v === 'string') return v !== '' && v !== 'false';
  return Boolean(v);
}

function compare(op, a, b) {
  if (op === '==') return a === b || (typeof a !== typeof b && String(a) === String(b));
  if (op === '!=') return !(a === b || (typeof a !== typeof b && String(a) === String(b)));
  const na = typeof a === 'number' ? a : Number(a);
  const nb = typeof b === 'number' ? b : Number(b);
  if (Number.isNaN(na) || Number.isNaN(nb)) return false;
  switch (op) {
    case '>':
      return na > nb;
    case '>=':
      return na >= nb;
    case '<':
      return na < nb;
    case '<=':
      return na <= nb;
    default:
      return false;
  }
}

/** Tek bir koşulu değerlendirir. */
export function evaluateCondition(condition, facts = {}) {
  const missing = new Set();
  try {
    const ast = parse(tokenize(condition));
    const value = evalNode(ast, facts, missing);
    return { ok: true, matched: truthy(value), value, missing: [...missing] };
  } catch (e) {
    return { ok: false, error: e.message, matched: false, missing: [...missing] };
  }
}

/**
 * Süreç dosyasındaki tüm kuralları değerlendirir.
 * @returns {Array<{process, rule_id, condition, status, detail, missing}>}
 */
export function evaluateRules(processDoc, facts = {}) {
  const out = [];
  for (const p of processDoc.processes ?? []) {
    for (const r of p.decision_rules ?? []) {
      const res = evaluateCondition(r.condition, facts);
      out.push({
        process: p.id,
        rule_id: r.rule_id,
        condition: r.condition,
        action: r.action,
        status: res.ok ? (res.matched ? 'matched' : 'not_matched') : 'parse_error',
        detail: res.ok ? (res.matched ? 'koşul sağlandı' : 'koşul sağlanmadı') : res.error,
        missing: res.missing ?? [],
      });
    }
  }
  return out;
}

/** Tüm süreçleri tarar, yalnızca söz dizimi uyumunu raporlar (facts gerekmez). */
export function auditRules(processDoc) {
  const rows = [];
  for (const p of processDoc.processes ?? []) {
    for (const r of p.decision_rules ?? []) {
      const res = evaluateCondition(r.condition, {});
      rows.push({
        process: p.id,
        rule_id: r.rule_id,
        condition: r.condition,
        parseable: res.ok,
        error: res.ok ? null : res.error,
      });
    }
  }
  const parseable = rows.filter((r) => r.parseable).length;
  return { rows, total: rows.length, parseable, manual: rows.length - parseable };
}

// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 ustauretim
// Minimal YAML okuyucu — yalnızca bu depodaki tanım dosyalarının alt kümesini destekler.
// Desteklenen: blok eşleme, blok liste, akış eşleme {a: 1}, akış liste [a, b],
// tırnaklı/tırnaksız skaler, sayı/bool/null, yorum satırları, blok skaler (> ve |).

function stripComment(line) {
  let inS = false;
  let inD = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === "'" && !inD) inS = !inS;
    else if (c === '"' && !inS) inD = !inD;
    else if (c === '#' && !inS && !inD && (i === 0 || line[i - 1] === ' ')) return line.slice(0, i);
  }
  return line;
}

function indentOf(line) {
  return line.length - line.trimStart().length;
}

function splitKey(rest) {
  // ilk ':' — tırnak ve parantez dışında
  let inS = false;
  let inD = false;
  let depth = 0;
  for (let i = 0; i < rest.length; i++) {
    const c = rest[i];
    if (c === "'" && !inD) inS = !inS;
    else if (c === '"' && !inS) inD = !inD;
    else if (!inS && !inD) {
      if (c === '{' || c === '[') depth++;
      else if (c === '}' || c === ']') depth--;
      else if (c === ':' && depth === 0) return [rest.slice(0, i).trim(), rest.slice(i + 1).trim()];
    }
  }
  return null;
}

export function parseScalar(raw) {
  const s = raw.trim();
  if (s === '') return null;
  if (s === 'null' || s === '~') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (/^-?\d+$/.test(s)) return parseInt(s, 10);
  if (/^-?\d+\.\d+$/.test(s)) return parseFloat(s);
  if (s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1).replace(/\\"/g, '"');
  if (s.startsWith("'") && s.endsWith("'")) return s.slice(1, -1).replace(/''/g, "'");
  if (s.startsWith('[') && s.endsWith(']')) {
    const inner = s.slice(1, -1).trim();
    if (!inner) return [];
    return splitFlow(inner).map(parseScalar);
  }
  if (s.startsWith('{') && s.endsWith('}')) {
    const inner = s.slice(1, -1).trim();
    if (!inner) return {};
    const obj = {};
    for (const part of splitFlow(inner)) {
      const kv = splitKey(part);
      if (kv) obj[parseScalar(kv[0]).toString()] = parseScalar(kv[1]);
    }
    return obj;
  }
  return s;
}

function splitFlow(s) {
  const out = [];
  let depth = 0;
  let inS = false;
  let inD = false;
  let cur = '';
  for (const c of s) {
    if (c === "'" && !inD) inS = !inS;
    else if (c === '"' && !inS) inD = !inD;
    if (!inS && !inD) {
      if (c === '{' || c === '[') depth++;
      else if (c === '}' || c === ']') depth--;
      else if (c === ',' && depth === 0) {
        out.push(cur.trim());
        cur = '';
        continue;
      }
    }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

export function parse(text) {
  const raw = text.split('\n').map((l) => stripComment(l).replace(/\s+$/, ''));
  const lines = raw.filter((l) => l.trim() !== '');
  let i = 0;

  function parseBlock(indent) {
    if (i >= lines.length) return null;
    if (indentOf(lines[i]) < indent) return null;
    const isList = lines[i].trimStart().startsWith('- ');
    return isList ? parseList(indent) : parseMap(indent);
  }

  function parseBlockScalar(indent, style) {
    const collected = [];
    while (i < lines.length && indentOf(lines[i]) > indent) {
      collected.push(lines[i].trim());
      i++;
    }
    return style === '|' ? collected.join('\n') : collected.join(' ');
  }

  function parseList(indent) {
    const arr = [];
    while (i < lines.length && indentOf(lines[i]) === indent && lines[i].trimStart().startsWith('- ')) {
      const content = lines[i].trimStart().slice(2).trim();
      i++;
      if (content === '') {
        arr.push(parseBlock(indent + 2));
        continue;
      }
      const kv = splitKey(content);
      if (kv && !content.startsWith('{')) {
        const obj = {};
        obj[kv[0]] = kv[1] === '' ? parseBlock(indent + 4) : parseScalar(kv[1]);
        // aynı öğenin devam eden anahtarları
        while (i < lines.length && indentOf(lines[i]) > indent && !lines[i].trimStart().startsWith('- ')) {
          const lineIndent = indentOf(lines[i]);
          const [k, v] = splitKey(lines[i].trim()) ?? [null, null];
          i++;
          if (k === null) break;
          obj[k] = v === '' ? parseBlock(lineIndent + 2) : parseScalar(v);
        }
        arr.push(obj);
      } else {
        arr.push(parseScalar(content));
      }
    }
    return arr;
  }

  function parseMap(indent) {
    const obj = {};
    while (i < lines.length && indentOf(lines[i]) === indent && !lines[i].trimStart().startsWith('- ')) {
      const kv = splitKey(lines[i].trim());
      i++;
      if (!kv) continue;
      const [k, v] = kv;
      if (v === '' || v === '>' || v === '|') {
        if (v === '>' || v === '|') {
          obj[k] = parseBlockScalar(indent, v);
        } else if (i < lines.length && indentOf(lines[i]) > indent) {
          obj[k] = parseBlock(indentOf(lines[i]));
        } else {
          obj[k] = null;
        }
      } else {
        obj[k] = parseScalar(v);
      }
    }
    return obj;
  }

  return parseBlock(0);
}

// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 ustauretim
//
// Senaryo çalıştırıcısı: bir kabul senaryosunun assertion'larını oturum
// artefaktları üzerinde deterministik olarak değerlendirir.
//
// Assertion'da "check" bloğu varsa çalıştırılır; yoksa "manuel" sayılır.
// Desteklenen işlemler: exists, eq, ne, gte, lte, truthy, contains ve any_of.

import fs from 'node:fs';
import path from 'node:path';
import { parse } from './yaml.mjs';

const OPS = ['exists', 'eq', 'ne', 'gte', 'lte', 'truthy', 'contains'];

function readArtifact(dir, file) {
  const f = path.join(dir, file);
  if (!fs.existsSync(f)) return { found: false };
  const raw = fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, '');
  if (file.endsWith('.json')) {
    try {
      return { found: true, value: JSON.parse(raw) };
    } catch (e) {
      return { found: true, error: 'JSON okunamadı: ' + e.message };
    }
  }
  if (file.endsWith('.yaml') || file.endsWith('.yml')) {
    try {
      return { found: true, value: parse(raw) };
    } catch (e) {
      return { found: true, error: 'YAML okunamadı: ' + e.message };
    }
  }
  return { found: true, value: raw };
}

function pick(value, pointer) {
  if (!pointer) return value;
  let cur = value;
  for (const key of String(pointer).split('.')) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return undefined;
    cur = Array.isArray(cur) ? cur[Number(key)] : cur[key];
  }
  return cur;
}

function evalCheck(check, dir) {
  const art = readArtifact(dir, check.file);
  if (!art.found) return { ok: false, detail: 'dosya yok: ' + check.file };
  if (art.error) return { ok: false, detail: art.error };

  const v = pick(art.value, check.path);
  const shown = v === undefined ? '(yok)' : JSON.stringify(v).slice(0, 60);

  if (check.exists === true && v === undefined) return { ok: false, detail: check.file + '#' + (check.path ?? '') + ' alanı yok' };
  if (check.exists === false && v !== undefined) return { ok: false, detail: 'alan beklenmiyordu: ' + shown };
  if ('eq' in check && v !== check.eq) return { ok: false, detail: 'beklenen ' + JSON.stringify(check.eq) + ', gelen ' + shown };
  if ('ne' in check && v === check.ne) return { ok: false, detail: 'değer ' + shown + ' olmamalıydı' };
  if ('gte' in check && !(typeof v === 'number' && v >= check.gte)) return { ok: false, detail: 'en az ' + check.gte + ' bekleniyordu, gelen ' + shown };
  if ('lte' in check && !(typeof v === 'number' && v <= check.lte)) return { ok: false, detail: 'en çok ' + check.lte + ' bekleniyordu, gelen ' + shown };
  if ('truthy' in check && !!v !== !!check.truthy) return { ok: false, detail: 'doğruluk değeri uyuşmuyor: ' + shown };
  if ('contains' in check) {
    const has = Array.isArray(v) ? v.includes(check.contains) : String(v ?? '').includes(String(check.contains));
    if (!has) return { ok: false, detail: shown + ' içinde ' + JSON.stringify(check.contains) + ' yok' };
  }
  return { ok: true, detail: check.file + (check.path ? '#' + check.path : '') + ' = ' + shown };
}

export function evaluateAssertion(assertion, dir) {
  const check = assertion.check;
  if (!check) return { status: 'manual', detail: 'check tanımlı değil' };

  if (check.all_of) {
    const runs = check.all_of.map((c) => evalCheck(c, dir));
    const bad = runs.filter((r) => !r.ok);
    return {
      status: bad.length ? 'fail' : 'pass',
      detail: bad.length ? bad.map((r) => r.detail).join(' | ') : runs.map((r) => r.detail).join(' · '),
    };
  }

  if (check.any_of) {
    const runs = check.any_of.map((c) => evalCheck(c, dir));
    const ok = runs.some((r) => r.ok);
    return {
      status: ok ? 'pass' : 'fail',
      detail: ok ? runs.find((r) => r.ok).detail : 'hiçbir koşul sağlanmadı: ' + runs.map((r) => r.detail).join(' | '),
    };
  }

  const used = OPS.filter((op) => op in check);
  if (!used.length && check.exists === undefined) {
    return { status: 'manual', detail: 'check işlemi tanımsız' };
  }
  const r = evalCheck(check, dir);
  return { status: r.ok ? 'pass' : 'fail', detail: r.detail };
}

export function runScenario({ file, dir }) {
  const doc = parse(fs.readFileSync(file, 'utf8'));
  const s = doc.scenario ?? {};
  const assertions = doc.then?.assertions ?? [];

  const results = assertions.map((a) => {
    const r = evaluateAssertion(a, dir);
    return { id: a.id, statement: a.statement, process: a.process, control: a.control, ...r };
  });

  const passed = results.filter((r) => r.status === 'pass').length;
  const failed = results.filter((r) => r.status === 'fail').length;
  const manual = results.filter((r) => r.status === 'manual').length;

  const payload = {
    scenario: s.id,
    name: s.name?.tr ?? s.id,
    file: path.basename(file),
    run_at: new Date().toISOString(),
    total: results.length,
    passed,
    failed,
    manual,
    results,
  };

  const outFile = path.join(dir, 'scenario-' + (s.id ?? 'unknown') + '-results.json');
  fs.writeFileSync(outFile, JSON.stringify(payload, null, 2) + '\n', 'utf8');

  return { payload, outFile };
}

/**
 * Altın koşu (golden run) artefaktlarını oturuma kopyalar.
 * Senaryo assertion'ları bu dosyalar üzerinde değerlendirilir.
 * Yalnızca üst düzeydeki .json/.yaml/.yml dosyaları alınır.
 */
export function seedArtifacts(dir, sourceDir) {
  if (!sourceDir || !fs.existsSync(sourceDir)) return { copied: [], source: sourceDir ?? null, found: false };
  const copied = [];
  for (const name of fs.readdirSync(sourceDir).sort()) {
    if (!/\.(json|yaml|yml)$/i.test(name)) continue;
    fs.copyFileSync(path.join(sourceDir, name), path.join(dir, name));
    copied.push(name);
  }
  return { copied, source: sourceDir, found: true };
}

// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 ustauretim
//
// Katalog doğrulaması: data/ altındaki YAML dosyalarını schema/ altındaki
// JSON Schema'lara göre denetler. Bu, paketin kendi verisinin kendi şemasına
// uyduğunu garanti eden tek kontrol.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from './yaml.mjs';
import { validate } from './jsonschema.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '../../../..');
const SCHEMA_DIR = path.join(ROOT, 'schema');

function targets() {
  const procDir = path.join(ROOT, 'data', 'processes');
  const processes = fs.existsSync(procDir)
    ? fs.readdirSync(procDir).filter((f) => f.endsWith('.yaml')).sort().map((f) => 'data/processes/' + f)
    : [];
  return [
    { name: 'glossary', schema: 'glossary.schema.json', files: ['data/glossary/glossary-full.yaml'] },
    { name: 'roles', schema: 'roles.schema.json', files: ['data/roles/roles-catalog.yaml'] },
    { name: 'processes', schema: 'processes.schema.json', files: processes },
    { name: 'controls', schema: 'controls.schema.json', files: ['data/controls/controls-catalog.yaml'] },
    { name: 'mapping', schema: 'mapping.schema.json', files: ['data/mapping/dora-articles.yaml'] },
    { name: 'lifecycle', schema: 'lifecycle.schema.json', files: ['onboarding/corf-lifecycle.yaml'] },
  ];
}


/** Senaryo dosyaları: şema + iş kuralı (assertion sayısı, benzersiz ID, katalog referansları). */
export function validateScenarios(root = ROOT) {
  const dir = path.join(root, 'tests', 'synthetic-scenarios');
  if (!fs.existsSync(dir)) return [];
  const schemaPath = path.join(root, 'schema', 'scenario.schema.json');
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

  const procIds = new Set();
  const procDir = path.join(root, 'data', 'processes');
  for (const f of fs.readdirSync(procDir).filter((x) => x.endsWith('.yaml'))) {
    const t = fs.readFileSync(path.join(procDir, f), 'utf8');
    for (const m of t.matchAll(/^  - id: (PRC-[A-Z]{3}-\d{2})$/gm)) procIds.add(m[1]);
  }
  const ctlIds = new Set(
    [...fs.readFileSync(path.join(root, 'data', 'controls', 'controls-catalog.yaml'), 'utf8')
      .matchAll(/^  - id: (CTL-[A-Z]{3}-\d{3})$/gm)].map((m) => m[1]),
  );

  const results = [];
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.yaml')).sort();

  for (const f of files) {
    const rel = 'tests/synthetic-scenarios/' + f;
    let doc;
    try {
      doc = parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    } catch (e) {
      results.push({ file: rel, schema: 'scenario.schema.json', ok: false, errors: [{ path: '(ayrıştırma)', message: e.message }] });
      continue;
    }
    const errs = validate(doc, schema, '', { doc: schema, baseDir: path.join(root, 'schema'), cache: new Map() });
    const s = doc.scenario ?? {};

    const total = doc.then?.assertions?.length ?? 0;
    if (s.assertions_total !== total) {
      errs.push({ path: 'scenario.assertions_total', message: 'ilan edilen ' + s.assertions_total + ', gerçek ' + total });
    }
    const seen = new Set();
    for (const a of doc.then?.assertions ?? []) {
      if (seen.has(a.id)) errs.push({ path: 'scenario.then.assertions', message: 'tekrarlanan assertion id: ' + a.id });
      seen.add(a.id);
      if (a.process && !procIds.has(a.process)) errs.push({ path: 'scenario.then.' + a.id + '.process', message: 'tanımsız süreç: ' + a.process });
      if (a.control && !ctlIds.has(a.control)) errs.push({ path: 'scenario.then.' + a.id + '.control', message: 'tanımsız kontrol: ' + a.control });
    }
    for (const p of s.processes_exercised ?? []) {
      if (!procIds.has(p)) errs.push({ path: 'scenario.processes_exercised', message: 'tanımsız süreç: ' + p });
    }
    for (const c of s.controls_checked ?? []) {
      if (!ctlIds.has(c)) errs.push({ path: 'scenario.controls_checked', message: 'tanımsız kontrol: ' + c });
    }

    results.push({ file: rel, schema: 'scenario.schema.json', ok: errs.length === 0, errors: errs });
  }
  return results;
}

export function validateCatalogs(root = ROOT) {
  const results = [];
  const cache = new Map();

  for (const t of targets()) {
    const schemaPath = path.join(root, 'schema', t.schema);
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    for (const rel of t.files) {
      const file = path.join(root, rel);
      if (!fs.existsSync(file)) {
        results.push({ file: rel, schema: t.schema, ok: false, errors: [{ path: '(dosya)', message: 'bulunamadı' }] });
        continue;
      }
      let doc;
      try {
        doc = parse(fs.readFileSync(file, 'utf8'));
      } catch (e) {
        results.push({ file: rel, schema: t.schema, ok: false, errors: [{ path: '(ayrıştırma)', message: e.message }] });
        continue;
      }
      const errs = validate(doc, schema, '', { doc: schema, baseDir: path.join(root, 'schema'), cache });
      results.push({ file: rel, schema: t.schema, ok: errs.length === 0, errors: errs });
    }
  }
  return results.concat(validateScenarios(root));
}

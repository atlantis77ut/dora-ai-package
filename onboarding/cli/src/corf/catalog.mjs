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
  return results;
}

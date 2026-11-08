// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 ustauretim
//
// Dış veri alımı (ingest): konnektörlerin bıraktığı dosyaları oturuma alır,
// her dosyanın sha256'sını ve kaynağını ingest-log.json'a yazar.
//
// Sözleşme: konnektör (Splunk, ServiceNow, Archer, ...) yalnızca dosya bırakır;
// DORA paketi dosyayı doğrular ve sürümler. API/credential yönetimi paketin dışındadır.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { validate } from './jsonschema.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SCHEMA_DIR = path.resolve(HERE, '../../../..', 'schema', 'artifacts');

export const OPAQUE_EXT = new Set(['.pdf', '.xml', '.xbrl', '.csv', '.zip']);

export function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/** Desteklenen alan adları: JSON artefaktlar + opak kanıt dosyaları. */
export function classify(name) {
  const ext = path.extname(name).toLowerCase();
  if (ext === '.json') return 'json';
  if (OPAQUE_EXT.has(ext)) return 'opaque';
  return 'unknown';
}

/** Dosya adına karşılık gelen artefakt şemasını yükler (yoksa null). */
export function loadArtifactSchema(name, schemaDir = SCHEMA_DIR) {
  const base = path.basename(name, '.json');
  const f = path.join(schemaDir, base + '.schema.json');
  if (!fs.existsSync(f)) return null;
  try {
    return { file: base + '.schema.json', schema: JSON.parse(fs.readFileSync(f, 'utf8')) };
  } catch {
    return null;
  }
}

export function ingest({ dir, from, allowUnknown = false, lenient = false, now = new Date() }) {
  if (!fs.existsSync(from)) throw new Error('Kaynak dizin yok: ' + from);
  const logFile = path.join(dir, 'ingest-log.json');
  const log = fs.existsSync(logFile) ? JSON.parse(fs.readFileSync(logFile, 'utf8')) : [];

  const ingested = [];
  const rejected = [];

  for (const name of fs.readdirSync(from).sort()) {
    const src = path.join(from, name);
    if (!fs.statSync(src).isFile()) continue;
    const kind = classify(name);
    if (kind === 'unknown' && !allowUnknown) {
      rejected.push({ file: name, reason: 'desteklenmeyen tür' });
      continue;
    }
    const data = fs.readFileSync(src);
    let schemaNote = 'şema yok';
    if (kind === 'json') {
      let parsed;
      try {
        parsed = JSON.parse(data.toString('utf8').replace(/^\uFEFF/, ''));
      } catch {
        rejected.push({ file: name, reason: 'geçersiz JSON' });
        continue;
      }
      const found = loadArtifactSchema(name);
      if (found) {
        const errs = validate(parsed, found.schema);
        if (errs.length) {
          const detail = errs.slice(0, 2).map((e) => e.path + ': ' + e.message).join(' | ');
          if (lenient) {
            schemaNote = 'şema uyarısı: ' + detail;
          } else {
            rejected.push({ file: name, reason: 'şema: ' + detail });
            continue;
          }
        } else {
          schemaNote = 'şema uyumlu (' + found.file + ')';
        }
      }
    }
    fs.writeFileSync(path.join(dir, name), data);
    const entry = {
      file: name,
      kind,
      bytes: data.length,
      sha256: sha256(data),
      source: path.basename(from),
      schema: schemaNote,
      ingested_at: now.toISOString(),
    };
    log.push(entry);
    ingested.push(entry);
  }

  fs.writeFileSync(logFile, JSON.stringify(log, null, 2) + '\n', 'utf8');
  return { ingested, rejected, logFile };
}

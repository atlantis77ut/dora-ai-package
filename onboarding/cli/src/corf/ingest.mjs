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

export function ingest({ dir, from, allowUnknown = false, now = new Date() }) {
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
    if (kind === 'json') {
      try {
        JSON.parse(data.toString('utf8').replace(/^\uFEFF/, ''));
      } catch {
        rejected.push({ file: name, reason: 'geçersiz JSON' });
        continue;
      }
    }
    fs.writeFileSync(path.join(dir, name), data);
    const entry = {
      file: name,
      kind,
      bytes: data.length,
      sha256: sha256(data),
      source: path.basename(from),
      ingested_at: now.toISOString(),
    };
    log.push(entry);
    ingested.push(entry);
  }

  fs.writeFileSync(logFile, JSON.stringify(log, null, 2) + '\n', 'utf8');
  return { ingested, rejected, logFile };
}

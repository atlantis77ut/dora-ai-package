#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 ustauretim
//
// Birim test koşucusu: test dosyalarını açıkça listeler.
// Neden: `node --test tests/unit` dizin argümanı Node 18 ve 22'de farklı yorumlanıyor
// (bazı sürümlerde "Cannot find module" hatası). Dosya listesi tüm sürümlerde çalışır.
//
// Kullanım: node tests/run.mjs [ek-dosya ...]

import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, 'unit');
const files = readdirSync(dir)
  .filter((f) => f.endsWith('.test.mjs'))
  .sort()
  .map((f) => join(dir, f))
  .concat(process.argv.slice(2));

const res = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
process.exit(res.status ?? 1);

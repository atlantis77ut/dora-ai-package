// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 ustauretim
//
// app/*.js CommonJS olarak yazılmış (tarayıcıda <script> ile yükleniyor).
// Node 18, CJS modüllerinden isimli export okumayı desteklemez; bu yardımcı
// createRequire ile yükler, böylece testler 18/20/22'de aynı davranır.

import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const APP = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../app');

export function loadApp(file) {
  return require(resolve(APP, file));
}

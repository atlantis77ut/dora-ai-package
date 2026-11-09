#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 ustauretim
//
// SATICI ARACI — lisans anahtarı üretir. Özel anahtar bu depoda tutulmaz.
//
// Kullanım:
//   node tools/license-gen.mjs --key <private.pem> --licensee "Banka A.Ş." --tier tier2 \
//        --phases C1,C2,C3,C4,C5,C6 --expires 2027-11-03 [--id LIC-2026-001]
//
// Anahtar çifti yoksa (yalnız geliştirme için):
//   node tools/license-gen.mjs --init-dev-keys
//   -> onboarding/license/dev-private.pem + public-key.pem üretir (.gitignore'da)

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { sign } from '../src/orl/license.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LIC_DIR = path.resolve(HERE, '../../license');

const { values } = parseArgs({
  options: {
    key: { type: 'string' },
    licensee: { type: 'string' },
    tier: { type: 'string' },
    phases: { type: 'string', default: 'C1,C2,C3,C4,C5,C6' },
    expires: { type: 'string' },
    id: { type: 'string' },
    modules: { type: 'string', default: 'agents,processes,orl,pilot' },
    'init-dev-keys': { type: 'boolean' },
    force: { type: 'boolean' },
  },
});

if (values['init-dev-keys']) {
  fs.mkdirSync(LIC_DIR, { recursive: true });
  // Dağıtılan açık anahtar ticari lisansların doğrulama köküdür: kazara üzerine yazmak
  // mevcut müşteri lisanslarını geçersiz kılar. Bu yüzden açıkça --force istenir.
  if (fs.existsSync(path.join(LIC_DIR, 'public-key.pem')) && !values.force) {
    console.error('public-key.pem zaten var — üzerine yazmak mevcut lisansları geçersiz kılar.');
    console.error('Gerçekten yeni bir anahtar çifti istiyorsanız --force ekleyin.');
    process.exit(1);
  }
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  fs.writeFileSync(path.join(LIC_DIR, 'dev-private.pem'), privateKey.export({ type: 'pkcs8', format: 'pem' }));
  fs.writeFileSync(path.join(LIC_DIR, 'public-key.pem'), publicKey.export({ type: 'spki', format: 'pem' }));
  console.log('geliştirme anahtar çifti üretildi:');
  console.log('  onboarding/license/dev-private.pem  (SIR — commit etmeyin)');
  console.log('  onboarding/license/public-key.pem   (dağıtılabilir)');
  process.exit(0);
}

if (!values.key || !values.licensee || !values.tier || !values.expires) {
  console.error('eksik parametre: --key, --licensee, --tier, --expires zorunlu');
  process.exit(1);
}

const payload = {
  license_id: values.id ?? `LIC-${new Date().toISOString().slice(0, 10)}-001`,
  licensee: values.licensee,
  tier: values.tier,
  tiers: values.tier === 'enterprise' ? ['tier1', 'tier2', 'tier3'] : undefined,
  phases: values.phases.split(',').map((s) => s.trim()),
  modules: values.modules.split(',').map((s) => s.trim()),
  issued_at: new Date().toISOString(),
  expires_at: new Date(values.expires + 'T23:59:59Z').toISOString(),
};

const token = sign(payload, fs.readFileSync(values.key, 'utf8'));
console.log(token);

// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 ustauretim
// Faz tanımını yükler, doğrular ve faz modüllerini çalıştırır.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from './yaml.mjs';
import { writeJson, readJson } from './session.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LIFECYCLE_FILE = path.resolve(HERE, '../../../orl-lifecycle.yaml');

export function loadLifecycle(file = LIFECYCLE_FILE) {
  if (!fs.existsSync(file)) throw new Error(`Faz tanımı bulunamadı: ${file}`);
  const doc = parse(fs.readFileSync(file, 'utf8'));
  validateLifecycle(doc);
  return doc;
}

export function validateLifecycle(doc) {
  const problems = [];
  if (!doc?.lifecycle?.id) problems.push('lifecycle.id yok');
  const phases = doc?.phases;
  if (!Array.isArray(phases) || phases.length !== 6) problems.push('6 faz bekleniyordu');
  const ids = (phases ?? []).map((p) => p.id);
  if (ids.join(',') !== 'C1,C2,C3,C4,C5,C6') problems.push(`faz sırası beklenmedik: ${ids.join(',')}`);
  for (const p of phases ?? []) {
    if (!p.name?.tr) problems.push(`${p.id}: name.tr yok`);
    if (!Array.isArray(p.exit_gate?.criteria) || p.exit_gate.criteria.length === 0) problems.push(`${p.id}: exit_gate.criteria boş`);
    if (!Array.isArray(p.wizard_steps) || p.wizard_steps.length === 0) problems.push(`${p.id}: wizard_steps boş`);
  }
  if (problems.length) throw new Error('Faz tanımı geçersiz:\n - ' + problems.join('\n - '));
  return true;
}

export function phaseById(doc, id) {
  const p = (doc.phases ?? []).find((x) => x.id === id);
  if (!p) throw new Error(`Bilinmeyen faz: ${id}`);
  return p;
}

export function nextPhase(doc, id) {
  const ids = (doc.phases ?? []).map((p) => p.id);
  const i = ids.indexOf(id);
  return i >= 0 && i + 1 < ids.length ? ids[i + 1] : null;
}

// Faz çalıştırıcıları: gerçek kurulumda veri toplar; burada iskelet + demo verisi.
const RUNNERS = {
  C1: (session, dir, opts) => {
    if (opts.demo) {
      writeJson(path.join(dir, 'business-service-catalogue.json'), {
        services: [
          { id: 'SVC-001', name: 'Ödeme hizmetleri', owner: 'Ödeme Direktörü', critical: true, assets: ['AST-001'] },
          { id: 'SVC-002', name: 'Mevduat işlemleri', owner: 'Bireysel Bankacılık Direktörü', critical: true, assets: ['AST-001'] },
        ],
      });
    }
    return { phase: 'C1', wrote: opts.demo ? ['business-service-catalogue.json'] : [] };
  },
  C2: (session, dir, opts) => {
    if (opts.demo) {
      writeJson(path.join(dir, 'impact-tolerances.json'), {
        tolerances: [
          { service: 'SVC-001', mtd_hours: 24, rto_hours: 4, rpo_hours: 0 },
          { service: 'SVC-002', mtd_hours: 48, rto_hours: 8, rpo_hours: 1 },
        ],
      });
      writeJson(path.join(dir, 'risk-appetite.json'), {
        thresholds: [{ metric: 'yillik_kesinti_suresi_dk', max: 240 }, { metric: 'kritik_bulgu', max: 0 }],
      });
      writeJson(path.join(dir, 'sla-overrides.json'), {
        overrides: [
          { process: 'PRC-INC-02', dora_hours: 4, new_hours: 4, reason: 'DORA taban çizgisi' },
          { process: 'PRC-INC-03', dora_hours: 72, new_hours: 72, reason: 'DORA taban çizgisi' },
        ],
      });
    }
    return { phase: 'C2', wrote: opts.demo ? ['impact-tolerances.json', 'risk-appetite.json', 'sla-overrides.json'] : [] };
  },
  C3: (session, dir, opts) => {
    if (opts.demo) {
      writeJson(path.join(dir, 'ict-inventory.json'), {
        assets: [{ id: 'AST-001', name: 'Core Banking', criticality: 'critical', provider: 'PRV-014' }],
      });
      writeJson(path.join(dir, 'agent-activation.json'), {
        activated: ['ROL-CIO-01', 'ROL-INC-01', 'ROL-RSK-01', 'ROL-CMP-01'],
        human_mapping: {
          'ROL-CIO-01': 'Z. Kaya (CIO)',
          'ROL-INC-01': 'M. Demir (Olay Yöneticisi)',
          'ROL-RSK-01': 'S. Aydın (ICT Risk)',
          'ROL-CMP-01': 'A. Şahin (Uyum)',
        },
        independence_checks: [
          { check: 'IND-01', result: 'PASS' },
          { check: 'IND-02', result: 'PASS' },
          { check: 'IND-03', result: 'PASS' },
          { check: 'IND-04', result: 'PASS' },
        ],
      });
      writeJson(path.join(dir, 'orl-mapping.json'), {
        all_codes: ['OR.RIA', 'OR.INCRM', 'OR.STRAM', 'OR.IRR'],
        owned_codes: ['OR.RIA', 'OR.INCRM', 'OR.STRAM', 'OR.IRR'],
      });
    }
    return { phase: 'C3', wrote: opts.demo ? ['ict-inventory.json', 'agent-activation.json', 'orl-mapping.json'] : [] };
  },
  C4: (session, dir, opts) => {
    if (opts.demo) {
      writeJson(path.join(dir, 'scenario-results.json'), {
        runs: [
          { scenario: 'SCN-01', assertions_passed: 8, assertions_total: 8 },
          { scenario: 'SCN-02', assertions_passed: 7, assertions_total: 7 },
          { scenario: 'SCN-03', assertions_passed: 6, assertions_total: 6 },
        ],
        classification_accuracy: 96,
        sla_violations: 0,
        audit_chain_verified: true,
      });
    }
    return { phase: 'C4', wrote: opts.demo ? ['scenario-results.json'] : [] };
  },
  C5: (session, dir, opts) => {
    if (opts.demo) {
      writeJson(path.join(dir, 'coverage-matrix.json'), {
        articles: [
          { article: 'Madde 6', covered_by: ['PRC-RSK-01'], status: 'covered' },
          { article: 'Madde 18', covered_by: ['PRC-INC-01'], status: 'covered' },
        ],
      });
      writeJson(path.join(dir, 'gap-analysis.json'), {
        high_severity: 0,
        risk_acceptance: [],
        independent_review_signed_by: 'Denetim Komitesi',
      });
    }
    return { phase: 'C5', wrote: opts.demo ? ['coverage-matrix.json', 'gap-analysis.json'] : [] };
  },
  C6: (session, dir, opts) => {
    if (opts.demo) {
      writeJson(path.join(dir, 'autonomy-grant.json'), {
        grants: [
          { role: 'ROL-RSK-01', level: 'act_autonomous' },
          { role: 'ROL-INF-01', level: 'act_autonomous' },
          { role: 'ROL-INC-01', level: 'act_with_approval' },
        ],
      });
      writeJson(path.join(dir, 'go-live.json'), {
        shadow_days: 14,
        semi_auto_days: 30,
        mos_dashboard: true,
        regwatch_agent: true,
        annual_review_date: '2027-11-03',
      });
    }
    return { phase: 'C6', wrote: opts.demo ? ['autonomy-grant.json', 'go-live.json'] : [] };
  },
};

export function runPhase(phaseId, session, dir, opts = {}) {
  const runner = RUNNERS[phaseId];
  if (!runner) throw new Error(`Faz modülü yok: ${phaseId}`);
  return runner(session, dir, opts);
}

export function readArtifact(dir, name) {
  return readJson(dir, name);
}

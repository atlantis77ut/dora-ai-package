#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 ustauretim
//
// İnceleme için demo oturumu üretir: altı adımın çıktıları + olaylar + onay + süreler.
// Mevcut oturumlara ve ayarlara DOKUNMAZ; yalnız yeni bir klasör açar.
//
// Kullanım: node tools/seed-demo.mjs [--id ob-demo-1] [--clean]

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { parse } from '../src/orl/yaml.mjs';
import { createReporting } from '../src/orl/deadlines.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const SESSIONS = path.join(ROOT, '.dora-onboarding');

const { values } = parseArgs({
  options: { id: { type: 'string', default: 'ob-demo-inceleme' }, clean: { type: 'boolean' } },
});

const id = values.id.replace(/[^a-zA-Z0-9._-]/g, '');
const dir = path.join(SESSIONS, id);

if (values.clean && fs.existsSync(dir)) {
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('silindi:', id);
}

const now = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const write = (name, obj) => {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), JSON.stringify(obj, null, 2) + '\n', 'utf8');
};

// ── oturum ───────────────────────────────────────────────
write('session.json', {
  session_id: id,
  mode: 'demo',
  tier: 'tier2',
  regulator: 'BDDK',
  disclaimer: 'İNCELEME İÇİN ÖRNEK VERİ — gerçek kurum verisi değildir.',
  created_at: iso(now),
  current_phase: 'C4',
  phases: {
    C1: { status: 'completed', gate: 'pass', at: iso(now - 5 * 86400e3) },
    C2: { status: 'completed', gate: 'pass', at: iso(now - 4 * 86400e3) },
    C3: { status: 'completed', gate: 'pass', at: iso(now - 3 * 86400e3) },
    C4: { status: 'in_progress' },
  },
  license: { mode: 'trial', expires_at: iso(now + 30 * 86400e3) },
});

write('institution-profile.json', {
  institution: 'Örnek Katılım Bankası A.Ş. (demo)',
  tier: 'tier2',
  tier_justification: 'Orta ölçek — demo verisi',
  determined_at: iso(now - 6 * 86400e3),
});
write('jurisdiction.json', { jurisdiction: 'TR', regulator: 'BDDK', competent_authority: 'BDDK' });

// ── adım 1: hizmetler ────────────────────────────────────
const services = [
  { id: 'SVC-001', name: 'Ödeme hizmetleri', owner: 'Ödeme Direktörü', critical: true, assets: ['AST-001', 'AST-002'] },
  { id: 'SVC-002', name: 'Mevduat işlemleri', owner: 'Bireysel Bankacılık Direktörü', critical: true, assets: ['AST-001'] },
  { id: 'SVC-003', name: 'Kredi başvuru', owner: 'Kredi Direktörü', critical: false, assets: ['AST-003'] },
];
write('business-service-catalogue.json', { services });

// ── adım 2: toleranslar ──────────────────────────────────
write('impact-tolerances.json', {
  tolerances: [
    { service: 'SVC-001', mtd_hours: 4, rto_hours: 2, rpo_hours: 0 },
    { service: 'SVC-002', mtd_hours: 8, rto_hours: 4, rpo_hours: 1 },
    { service: 'SVC-003', mtd_hours: 24, rto_hours: 12, rpo_hours: 4 },
  ],
});
write('risk-appetite.json', { thresholds: [{ metric: 'yillik_kesinti_dk', max: 240 }] });
write('sla-overrides.json', {
  rows: [{ process: 'PRC-INC-02', from_hours: 4, to_hours: 4, justification: 'DR-001 — indirilemez' }],
});

// ── adım 3: envanter, ajanlar, eşleme ────────────────────
write('ict-inventory.json', {
  assets: [
    { id: 'AST-001', name: 'Core Banking', criticality: 'critical', provider: 'Vendor X' },
    { id: 'AST-002', name: 'API Gateway', criticality: 'critical', provider: 'Vendor Y' },
    { id: 'AST-003', name: 'Kredi Skorlama', criticality: 'important', provider: 'Vendor Z' },
    { id: 'AST-004', name: 'Raporlama', criticality: 'standard', provider: 'iç ekip' },
    { id: 'AST-005', name: 'Yedekleme', criticality: 'important', provider: 'Vendor X' },
  ],
  assets_by_provider: { 'Vendor X': 2, 'Vendor Y': 1, 'Vendor Z': 1, 'iç ekip': 1 },
  source: 'demo',
  reconciled_at: iso(now - 3 * 86400e3),
});

write('agent-activation.json', {
  activated: ['ROL-RSK-01', 'ROL-INC-01', 'ROL-CIO-01', 'ROL-CMP-01', 'ROL-TPR-01'],
  human_mapping: {
    'ROL-RSK-01': 'Zeynep Kaya (Risk)',
    'ROL-INC-01': 'Murat Demir (Olay)',
    'ROL-CIO-01': 'Ayşe Yılmaz (BT)',
    'ROL-CMP-01': 'Elif Şahin (Uyum)',
    'ROL-TPR-01': 'Burak Aydın (Tedarikçi)',
  },
  independence_checks: [
    { check: 'IND-01', result: 'PASS', note: 'demo' },
    { check: 'IND-02', result: 'PASS', note: 'demo' },
    { check: 'IND-03', result: 'PASS', note: 'demo' },
    { check: 'IND-04', result: 'PASS', note: 'demo' },
  ],
  updated_at: iso(now - 3 * 86400e3),
});

// orl-mapping: tüm kodlar sahipli (demo)
write('orl-mapping.json', {
  owned_codes: ['OR.RIA', 'OR.KIB.BSACM', 'OR.INC', 'OR.TPR', 'OR.TST'],
  all_codes: ['OR.RIA', 'OR.KIB.BSACM', 'OR.INC', 'OR.TPR', 'OR.TST'],
  unowned_codes: [],
  generated_at: iso(now - 3 * 86400e3),
});

// ── adım 4: senaryolar ───────────────────────────────────
write('scenario-results.json', {
  runs: [
    { scenario: 'Büyük olay', accuracy: 98, sla_violations: 0, audit_chain: true, ran_at: iso(now - 2 * 86400e3) },
    { scenario: 'Tedarikçi çıkışı', accuracy: 96, sla_violations: 0, audit_chain: true, ran_at: iso(now - 2 * 86400e3) },
    { scenario: 'Regülatör talebi', accuracy: 100, sla_violations: 0, audit_chain: true, ran_at: iso(now - 2 * 86400e3) },
  ],
  classification_accuracy: 98,
  sla_violations: 0,
  audit_chain_verified: true,
  generated_at: iso(now - 2 * 86400e3),
});

// ── adım 5: kapsama ──────────────────────────────────────
const articles = parse(fs.readFileSync(path.join(ROOT, 'data/mapping/dora-articles.yaml'), 'utf8')).articles ?? [];
const coverage = articles.map((a, i) => ({
  id: a.id,
  status: i % 9 === 0 ? 'partial' : 'covered',
  note: i % 9 === 0 ? 'kanıt kısmi — demo' : '',
}));
write('coverage-matrix.json', {
  articles: coverage,
  summary: { covered: coverage.filter((c) => c.status === 'covered').length, partial: coverage.filter((c) => c.status === 'partial').length, gap: 0 },
  generated_at: iso(now - 86400e3),
});
write('gap-analysis.json', {
  high_severity: 0,
  partial_count: coverage.filter((c) => c.status === 'partial').length,
  risk_acceptance: [],
  independent_review_signed_by: 'Bağımsız Denetim A.Ş. (demo)',
  reviewed_at: iso(now - 86400e3),
});

// ── adım 6: otonomi + canlıya geçiş ─────────────────────
write('autonomy-grant.json', {
  grants: [
    { role: 'ROL-RSK-01', level: 'recommend', approved_by: 'Demo' },
    { role: 'ROL-INC-01', level: 'act_with_approval', approved_by: 'Demo' },
    { role: 'ROL-CIO-01', level: 'recommend', approved_by: 'Demo' },
    { role: 'ROL-CMP-01', level: 'observe', approved_by: 'Demo' },
  ],
  generated_at: iso(now - 86400e3),
});
write('go-live.json', {
  shadow_days: 21,
  semi_auto_days: 45,
  mos_dashboard: true,
  regwatch_agent: true,
  annual_review_date: '2027-11-09',
  decided_at: iso(now - 86400e3),
});

// ── olaylar: biri gecikmiş, biri yeni ────────────────────
const detectedOld = now - 6 * 3600e3;
const detectedNew = now - 30 * 60e3;
const incidents = [
  {
    incident_id: 'INC-2026-0001',
    status: 'open',
    origin: 'siem',
    severity: 'high',
    title: 'Core Banking üzerinde yetkisiz erişim denemesi',
    detected_at: iso(detectedOld),
    classification: 'major',
    affected_customers: 250000,
    outage_minutes: 45,
    economic_impact_eur: 750000,
    data_loss: false,
    unauthorized_access: true,
    affected_member_states: ['TR'],
    reporting: createReporting(iso(detectedOld)),
    timeline: [
      { at: iso(detectedOld + 60e3), by: 'utemir', action: 'created', detail: 'SIEM olayından taslak' },
      { at: iso(detectedOld + 300e3), by: 'utemir', action: 'updated', detail: 'affected_customers, outage_minutes' },
      { at: iso(detectedOld + 420e3), by: 'utemir', action: 'promoted', detail: 'aktif kayıt' },
    ],
  },
  {
    incident_id: 'INC-2026-0002',
    status: 'draft',
    origin: 'siem',
    severity: 'medium',
    title: 'API Gateway üzerinde anormal istek hacmi',
    detected_at: iso(detectedNew),
    classification: 'not_major',
    affected_customers: 1200,
    outage_minutes: 0,
    economic_impact_eur: 0,
    data_loss: false,
    unauthorized_access: false,
    affected_member_states: [],
    reporting: createReporting(iso(detectedNew)),
    timeline: [{ at: iso(detectedNew + 30e3), by: 'utemir', action: 'created', detail: 'SIEM olayından taslak' }],
  },
];
write('incidents.json', { incidents, updated_at: iso(now) });
write('incident-record.json', {
  incident_id: incidents[0].incident_id,
  detected_at: incidents[0].detected_at,
  classification: 'major',
  affected_customers: 250000,
  outage_minutes: 45,
  economic_impact_eur: 750000,
  data_loss: false,
  unauthorized_access: true,
  affected_member_states: ['TR'],
  reporting: incidents[0].reporting,
  promoted_at: iso(detectedOld + 420e3),
});

// ── onay talebi ─────────────────────────────────────────
write('approvals.json', {
  approvals: [
    {
      id: 'apr-demo0001',
      type: 'go_live',
      target: id,
      payload: { shadow_days: 21, semi_auto_days: 45 },
      requested_by: 'utemir',
      requested_at: iso(now - 3600e3),
      comment: 'pilot tamamlandı (demo)',
      status: 'pending',
      decided_by: null,
      decided_at: null,
      decision_comment: null,
    },
  ],
  updated_at: iso(now - 3600e3),
});

// ── SIEM olayları ───────────────────────────────────────
write('siem-events.json', {
  vendor: 'generic',
  fetched_at: iso(now - 30 * 60e3),
  count: 3,
  truncated: false,
  events: [
    { id: 'evt-1', ts: iso(detectedOld), severity: 'high', source: 'core-db', title: 'Unauthorized access attempt', raw: {} },
    { id: 'evt-2', ts: iso(detectedNew), severity: 'medium', source: 'api-gw', title: 'Anormal istek hacmi', raw: {} },
    { id: 'evt-3', ts: iso(now - 2 * 3600e3), severity: 'low', source: 'edge', title: 'Port taraması', raw: {} },
  ],
});

console.log('demo oturumu hazır:', id);
console.log('  klasör:', path.relative(ROOT, dir));
console.log('  dosya :', fs.readdirSync(dir).length);
console.log('  içerik: 6 adım + 2 olay + raporlama süreleri + 1 onay talebi + SIEM olayları');
console.log('  not   : uygulama → Genel bakış → "Aktif oturum" listesinden seçebilirsiniz');

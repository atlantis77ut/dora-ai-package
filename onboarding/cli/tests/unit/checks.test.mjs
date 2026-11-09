import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { evaluatePhase } from '../../src/orl/checks.mjs';
import { sign, verify } from '../../src/orl/license.mjs';

function dir(files = {}) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'dora-chk-'));
  for (const [name, data] of Object.entries(files)) {
    fs.writeFileSync(path.join(d, name), JSON.stringify(data, null, 2));
  }
  return d;
}

const trialSession = () => ({
  session_id: 'ob-t',
  tier: 'tier2',
  regulator: 'BDDK',
  license: { mode: 'trial', expires_at: new Date(Date.now() + 30 * 86400000).toISOString() },
});

test('kapı C1: eksik kanıtla geçmez', () => {
  const d = dir();
  const r = evaluatePhase('C1', { dir: d, session: trialSession() });
  assert.equal(r.passed, false);
  assert.ok(r.results.some((x) => !x.passed));
});

test('kapı C1: profil + yargı alanı + hizmet listesiyle geçer', () => {
  const d = dir({
    'institution-profile.json': { institution: 'Test', tier: 'tier2' },
    'jurisdiction.json': { jurisdiction: 'TR', regulator: 'BDDK' },
    'business-service-catalogue.json': { services: [{ id: 'SVC-1', name: 'Ödeme', owner: 'Direktör', critical: true }] },
  });
  const r = evaluatePhase('C1', { dir: d, session: trialSession() });
  assert.equal(r.passed, true, JSON.stringify(r.results));
});

test('kapı C1: deneme süresi dolmuşsa geçmez', () => {
  const d = dir({
    'institution-profile.json': { tier: 'tier2' },
    'jurisdiction.json': { jurisdiction: 'TR', regulator: 'BDDK' },
    'business-service-catalogue.json': { services: [{ id: 'SVC-1', name: 'A', owner: 'B', critical: true }] },
  });
  const s = trialSession();
  s.license.expires_at = new Date(Date.now() - 86400000).toISOString();
  const r = evaluatePhase('C1', { dir: d, session: s });
  assert.equal(r.passed, false);
});

test('kapı C3: envanter + ajan + eşleme ile geçer', () => {
  const d = dir({
    'ict-inventory.json': { assets: [{ id: 'AST-1', name: 'Core' }] },
    'agent-activation.json': {
      activated: ['ROL-A', 'ROL-B'],
      human_mapping: { 'ROL-A': 'Ali', 'ROL-B': 'Ayşe' },
      independence_checks: [
        { check: 'IND-01', result: 'PASS' },
        { check: 'IND-02', result: 'PASS' },
        { check: 'IND-03', result: 'PASS' },
        { check: 'IND-04', result: 'PASS' },
      ],
    },
    'orl-mapping.json': { owned_codes: ['OR.A', 'OR.B'], all_codes: ['OR.A', 'OR.B'] },
  });
  const r = evaluatePhase('C3', { dir: d, session: trialSession() });
  assert.equal(r.passed, true, JSON.stringify(r.results));
});

test('kapı C4: doğruluk eşiği ve zincir koşulu', () => {
  const okDir = dir({
    'scenario-results.json': {
      runs: [{ scenario: 'a' }, { scenario: 'b' }, { scenario: 'c' }],
      classification_accuracy: 96,
      sla_violations: 0,
      audit_chain_verified: true,
    },
  });
  assert.equal(evaluatePhase('C4', { dir: okDir, session: trialSession() }).passed, true);

  const badDir = dir({
    'scenario-results.json': {
      runs: [{ scenario: 'a' }],
      classification_accuracy: 80,
      sla_violations: 2,
      audit_chain_verified: false,
    },
  });
  assert.equal(evaluatePhase('C4', { dir: badDir, session: trialSession() }).passed, false);
});

test('kapı C6: deneme lisansı üretime geçişi engeller', () => {
  const d = dir({
    'autonomy-grant.json': { grants: [{ role: 'ROL-A', level: 'recommend' }] },
    'go-live.json': { shadow_days: 20, semi_auto_days: 40, mos_dashboard: true, regwatch_agent: true, annual_review_date: '2027-01-01' },
  });
  const r = evaluatePhase('C6', { dir: d, session: trialSession() });
  assert.equal(r.passed, false);
  const lic = r.results.find((x) => x.id === 'LIC' || x.id === 'C6-0');
  assert.ok(lic && !lic.passed);
});

test('lisans: imzalı token doğrulanır, süresi dolmuş reddedilir', () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();

  const valid = sign(
    { license_id: 'L1', licensee: 'Test', tier: 'tier2', phases: ['C1'], modules: [], issued_at: new Date().toISOString(), expires_at: '2030-01-01T00:00:00.000Z' },
    privatePem,
  );
  const v = verify(valid, publicPem);
  assert.equal(v.valid, true);

  const expired = sign(
    { license_id: 'L2', licensee: 'Test', tier: 'tier2', phases: ['C1'], modules: [], issued_at: '2020-01-01T00:00:00.000Z', expires_at: '2021-01-01T00:00:00.000Z' },
    privatePem,
  );
  assert.equal(verify(expired, publicPem).valid, false);
  assert.equal(verify(expired, publicPem).reason, 'suresi_dolmus');

  const forged = valid.slice(0, -6) + 'AAAAAA';
  assert.equal(verify(forged, publicPem).valid, false);
});

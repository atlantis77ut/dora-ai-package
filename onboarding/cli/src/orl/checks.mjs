// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 ustauretim
// Faz geçiş kapıları: her fazın ölçülebilir kontrol listesi.
// orl-lifecycle.yaml içindeki exit_gate.criteria metinleri burada çalıştırılabilir
// kontrollere dönüşür. Metin ile kontrol aynı sırada; ikisi birlikte güncellenmeli.

import { readJson, hasFile } from './session.mjs';
import { verify, loadPublicKey, entitlement, REASON_TEXT } from './license.mjs';

function ok(id, passed, detail) {
  return { id, passed: !!passed, detail };
}

/** Lisans kontrolü: C1'de deneme moduna izin verir, C6'da vermez. */
function licenseCheck(session, phase, { requireCommercial = false } = {}) {
  const lic = session?.license;
  if (!lic) return ok('LIC', false, 'lisans kaydı yok — kurulum init --license ile yapılmalı');

  const now = new Date();
  if (lic.mode === 'trial') {
    const exp = new Date(lic.expires_at);
    const daysLeft = Math.ceil((exp - now) / 86400000);
    if (exp.getTime() < now.getTime()) return ok('LIC', false, 'deneme süresi dolmuş');
    if (requireCommercial) return ok('LIC', false, `deneme modu — üretime geçiş için ticari lisans gerekli (${daysLeft} gün kaldı)`);
    return ok('LIC', true, `deneme modu — ${daysLeft} gün kaldı`);
  }

  const pub = loadPublicKey();
  const v = verify(lic.token, pub, now);
  if (!v.valid) return ok('LIC', false, REASON_TEXT[v.reason] ?? v.reason);

  const e = entitlement(v.claims, { tier: session.tier, phase });
  if (!e.ok) return ok('LIC', false, e.reason);

  return ok('LIC', true, `${v.claims.tier} · ${v.claims.licensee} · bitiş ${String(v.claims.expires_at).slice(0, 10)}`);
}

export const PHASE_CHECKS = {
  C1: [
    {
      id: 'C1-0',
      text: 'Geçerli lisans anahtarı (imza + süre + tier)',
      run: (ctx) => licenseCheck(ctx.session, 'C1'),
    },
    {
      id: 'C1-1',
      text: 'Kurum profili ve tier seçimi kaydedilmiş',
      run: (ctx) => {
        const p = readJson(ctx.dir, 'institution-profile.json');
        return ok('C1-1', p?.tier, p ? `tier=${p.tier}` : 'institution-profile.json yok');
      },
    },
    {
      id: 'C1-2',
      text: 'Regülatör ve yargı alanı tanımlı',
      run: (ctx) => {
        const j = readJson(ctx.dir, 'jurisdiction.json');
        return ok('C1-2', j?.regulator && j?.jurisdiction, j ? `${j.jurisdiction}/${j.regulator}` : 'jurisdiction.json yok');
      },
    },
    {
      id: 'C1-3',
      text: 'İş hizmetleri kataloğu (BSC) en az bir hizmet içeriyor',
      run: (ctx) => {
        const b = readJson(ctx.dir, 'business-service-catalogue.json');
        const n = b?.services?.length ?? 0;
        return ok('C1-3', n > 0, n ? `${n} hizmet` : 'business-service-catalogue.json yok veya boş');
      },
    },
    {
      id: 'C1-4',
      text: 'Her hizmetin sahibi ve kritiklik işareti var',
      run: (ctx) => {
        const b = readJson(ctx.dir, 'business-service-catalogue.json');
        const services = b?.services ?? [];
        if (services.length === 0) return ok('C1-4', false, 'BSC yok — hizmet tanımlanmamış');
        const bad = services.filter((s) => !s.owner || typeof s.critical !== 'boolean');
        return ok('C1-4', bad.length === 0, bad.length ? `${bad.length}/${services.length} hizmet eksik alanlı` : `${services.length} hizmet tam`);
      },
    },
  ],

  C2: [
    {
      id: 'C2-1',
      text: 'Her kritik hizmet için MTD/RTO/RPO tanımlı',
      run: (ctx) => {
        const t = readJson(ctx.dir, 'impact-tolerances.json');
        const rows = t?.tolerances ?? [];
        const bad = rows.filter((r) => !(r.mtd_hours > 0 && r.rto_hours > 0 && r.rpo_hours >= 0));
        return ok('C2-1', rows.length > 0 && bad.length === 0, rows.length ? `${rows.length} kayıt, ${bad.length} eksik` : 'impact-tolerances.json yok');
      },
    },
    {
      id: 'C2-2',
      text: 'SLA override yalnızca daha katı yönde',
      run: (ctx) => {
        const s = readJson(ctx.dir, 'sla-overrides.json');
        const rows = s?.overrides ?? [];
        const loosened = rows.filter((r) => r.new_hours > r.dora_hours);
        return ok('C2-2', loosened.length === 0, loosened.length ? `${loosened.length} gevşetme tespit edildi` : `${rows.length} override, gevşetme yok`);
      },
    },
    {
      id: 'C2-3',
      text: 'Risk iştahı eşikleri kaydedilmiş',
      run: (ctx) => {
        const a = readJson(ctx.dir, 'risk-appetite.json');
        return ok('C2-3', a?.thresholds?.length > 0, a ? `${a.thresholds.length} eşik` : 'risk-appetite.json yok');
      },
    },
  ],

  C3: [
    {
      id: 'C3-1',
      text: 'ICT envanteri en az bir varlık içeriyor',
      run: (ctx) => {
        const i = readJson(ctx.dir, 'ict-inventory.json');
        const n = i?.assets?.length ?? 0;
        return ok('C3-1', n > 0, n ? `${n} varlık` : 'ict-inventory.json yok');
      },
    },
    {
      id: 'C3-2',
      text: 'Aktive edilen her ajanın insan muadili atanmış',
      run: (ctx) => {
        const a = readJson(ctx.dir, 'agent-activation.json');
        const agents = a?.activated ?? [];
        const map = a?.human_mapping ?? {};
        const missing = agents.filter((r) => !map[r]);
        return ok('C3-2', agents.length > 0 && missing.length === 0, agents.length ? `${agents.length} ajan, ${missing.length} eşlemesiz` : 'agent-activation.json yok');
      },
    },
    {
      id: 'C3-3',
      text: 'Dört bağımsızlık kontrolü PASS',
      run: (ctx) => {
        const a = readJson(ctx.dir, 'agent-activation.json');
        const checks = a?.independence_checks ?? [];
        const failed = checks.filter((c) => c.result !== 'PASS');
        return ok('C3-3', checks.length >= 4 && failed.length === 0, checks.length ? `${checks.length} kontrol, ${failed.length} FAIL` : 'bağımsızlık kaydı yok');
      },
    },
    {
      id: 'C3-4',
      text: 'Her OR.* süreç kodu en az bir ajan tarafından sahiplenilmiş',
      run: (ctx) => {
        const m = readJson(ctx.dir, 'orl-mapping.json');
        const owned = m?.owned_codes ?? [];
        const all = m?.all_codes ?? [];
        const orphan = all.filter((c) => !owned.includes(c));
        return ok('C3-4', all.length > 0 && orphan.length === 0, all.length ? `${all.length} kod, ${orphan.length} sahipsiz` : 'orl-mapping.json yok');
      },
    },
  ],

  C4: [
    {
      id: 'C4-1',
      text: 'Üç senaryo da çalıştırılmış',
      run: (ctx) => {
        const r = readJson(ctx.dir, 'scenario-results.json');
        const runs = r?.runs ?? [];
        return ok('C4-1', runs.length >= 3, `${runs.length} senaryo`);
      },
    },
    {
      id: 'C4-2',
      text: 'Sınıflandırma doğruluğu >= %95',
      run: (ctx) => {
        const r = readJson(ctx.dir, 'scenario-results.json');
        const acc = r?.classification_accuracy;
        return ok('C4-2', typeof acc === 'number' && acc >= 95, acc !== undefined ? `${acc}%` : 'ölçüm yok');
      },
    },
    {
      id: 'C4-3',
      text: 'SLA ihlali yok',
      run: (ctx) => {
        const r = readJson(ctx.dir, 'scenario-results.json');
        const v = r?.sla_violations;
        return ok('C4-3', v === 0, v !== undefined ? `${v} ihlal` : 'ölçüm yok');
      },
    },
    {
      id: 'C4-4',
      text: 'Denetim izi hash zinciri doğrulandı',
      run: (ctx) => {
        const r = readJson(ctx.dir, 'scenario-results.json');
        return ok('C4-4', r?.audit_chain_verified === true, String(r?.audit_chain_verified ?? 'yok'));
      },
    },
  ],

  C5: [
    {
      id: 'C5-1',
      text: 'Kapsama matrisi dolu',
      run: (ctx) => {
        const c = readJson(ctx.dir, 'coverage-matrix.json');
        const n = c?.articles?.length ?? 0;
        return ok('C5-1', n > 0, n ? `${n} madde` : 'coverage-matrix.json yok');
      },
    },
    {
      id: 'C5-2',
      text: 'Kritik boşluk yok veya kabul edilmiş risk kaydı var',
      run: (ctx) => {
        const g = readJson(ctx.dir, 'gap-analysis.json');
        const high = g?.high_severity ?? null;
        const accepted = g?.risk_acceptance ?? [];
        return ok('C5-2', high === 0 || accepted.length > 0, high === null ? 'veri yok' : `yüksek=${high}, kabul=${accepted.length}`);
      },
    },
    {
      id: 'C5-3',
      text: 'Bağımsız doğrulama imzalı',
      run: (ctx) => {
        const g = readJson(ctx.dir, 'gap-analysis.json');
        return ok('C5-3', !!g?.independent_review_signed_by, g?.independent_review_signed_by ?? 'imza yok');
      },
    },
  ],

  C6: [
    {
      id: 'C6-0',
      text: 'Üretime geçiş için ticari lisans geçerli',
      run: (ctx) => licenseCheck(ctx.session, 'C6', { requireCommercial: true }),
    },
    {
      id: 'C6-1',
      text: 'Her ajanın otonomi seviyesi yazılı atanmış',
      run: (ctx) => {
        const a = readJson(ctx.dir, 'autonomy-grant.json');
        const rows = a?.grants ?? [];
        return ok('C6-1', rows.length > 0 && rows.every((r) => r.role && r.level), `${rows.length} atama`);
      },
    },
    {
      id: 'C6-2',
      text: 'Gölge mod ve yarı-otomatik mod tamamlanmış',
      run: (ctx) => {
        const c = readJson(ctx.dir, 'go-live.json');
        return ok('C6-2', c?.shadow_days >= 14 && c?.semi_auto_days >= 30, `gölge=${c?.shadow_days ?? 0}g, yarı=${c?.semi_auto_days ?? 0}g`);
      },
    },
    {
      id: 'C6-3',
      text: 'MOS panosu ve regülasyon izleme ajanı aktif',
      run: (ctx) => {
        const c = readJson(ctx.dir, 'go-live.json');
        return ok('C6-3', c?.mos_dashboard === true && c?.regwatch_agent === true, `pano=${c?.mos_dashboard}, izleme=${c?.regwatch_agent}`);
      },
    },
    {
      id: 'C6-4',
      text: 'Yıllık gözden geçirme takvimi kurulmuş',
      run: (ctx) => {
        const c = readJson(ctx.dir, 'go-live.json');
        return ok('C6-4', typeof c?.annual_review_date === 'string', c?.annual_review_date ?? 'tarih yok');
      },
    },
  ],
};

export function phaseArtifacts() {
  return {
    C1: ['institution-profile.json', 'jurisdiction.json', 'business-service-catalogue.json'],
    C2: ['impact-tolerances.json', 'risk-appetite.json', 'sla-overrides.json'],
    C3: ['ict-inventory.json', 'agent-activation.json', 'orl-mapping.json'],
    C4: ['scenario-results.json'],
    C5: ['coverage-matrix.json', 'gap-analysis.json'],
    C6: ['autonomy-grant.json', 'go-live.json'],
  };
}

export function evaluatePhase(phaseId, ctx) {
  const checks = PHASE_CHECKS[phaseId];
  if (!checks) throw new Error(`Faz için kontrol tanımı yok: ${phaseId}`);
  const results = checks.map((c) => c.run(ctx));
  return {
    phase: phaseId,
    passed: results.every((r) => r.passed),
    results,
  };
}

export function describeArtifacts(phaseId, dir) {
  return (phaseArtifacts()[phaseId] ?? []).map((name) => ({ name, present: hasFile(dir, name) }));
}

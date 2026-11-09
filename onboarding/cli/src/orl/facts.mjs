// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 ustauretim
//
// Kanıt → olgu (fact) adaptörü.
//
// Kural koşulları alan adlarını Türkçe tutar (`etkilenen_musteri`), kanıt dosyaları ise
// İngilizce alan adları taşır (`affected_customers`). Bu adaptör ikisi arasında açık ve
// denetlenebilir bir eşleme kurar: hangi kanıt alanının hangi kural olgusuna karşılık
// geldiği aşağıdaki tabloda tek tek yazılıdır. Eşlenmeyen alan "eksik olgu" olarak raporlanır.

import fs from 'node:fs';
import path from 'node:path';
import { parse } from './yaml.mjs';

/** Tek bir kanıt nesnesinden kural olguları üretir. */
const MAPPERS = {
  'incident-record.json': (o) => ({
    etkilenen_musteri: o.affected_customers,
    kesinti_suresi: typeof o.outage_minutes === 'number' ? Math.round((o.outage_minutes / 60) * 100) / 100 : undefined,
    ekonomik_etki: o.economic_impact_eur,
    etkilenen_uyelik_devleti: Array.isArray(o.affected_member_states) ? o.affected_member_states.length : undefined,
    veri_kaybi: o.data_loss,
    yetkisiz_erisim: o.unauthorized_access,
    olay_kaynagi: o.source,
    siniflandirma: o.classification,
    varlik_kritik: undefined,
  }),
  'classification-decision.json': (o) => ({
    siniflandirma: o.classification,
    eslesen_kriterler: o.matched_criteria,
    karar_onayi: o.approved_by,
    karar_zamani: o.decided_at,
  }),
  'notification-receipt.json': (o) => ({
    ilk_bildirim_dakika: o.elapsed_minutes,
    onay_once_gonderim: o.approved_before_send,
    bildirim_yuku: o.xml_file,
    bildirim_kanali: o.channel,
  }),
  'intermediate-report.json': (o) => ({ ara_rapor_saat: o.hours_after_initial }),
  'final-report.json': (o) => ({ nihai_rapor_gun: o.days_after_close }),
  'rca-report.json': (o) => ({
    kok_neden: o.root_cause,
    kok_neden_kategorisi: o.category,
    aksiyon_toplam: o.actions_total,
    aksiyon_kapali: o.actions_closed,
  }),
  'control-update-record.json': (o) => ({
    guncellenen_kontrol: o.updated_control,
    kontrol_guncellemesi_dogrulandi: o.verified_by_audit,
  }),
  'access-review-record.json': (o) => ({
    kapatilan_pasif_hesap: o.dormant_accounts_closed,
    iptal_edilen_hesap: o.revoked_count,
    ayricalikli_hesap_sayisi: o.privileged_accounts,
    erisim_gozden_gecirme_imzali: Boolean(o.signed_at),
  }),
  'crypto-inventory.yaml': (o) => ({
    sifreleme: o.assets?.['AST-001'],
    'sifreleme.in_transit': o.assets?.['AST-001']?.in_transit,
    'sifreleme.at_rest': o.assets?.['AST-001']?.at_rest,
  }),
  'segmentation-evidence.json': (o) => ({
    segment: o.zones?.['DMZ-01'],
    'segment.default_deny': o.zones?.['DMZ-01']?.default_deny,
  }),
  'vulnerability-closure.json': (o) => ({
    zafiyet: {
      cvss: o.cvss,
      yas_gun: o.days_open,
      kapandi: Boolean(o.closed_at),
      istisna: o.exception_ref ?? null,
    },
    'zafiyet.cvss': o.cvss,
    'zafiyet.yas_gun': o.days_open,
  }),
  'register-of-information.json': (o) => ({
    tedarikci_durumu: o.providers?.['PRV-014']?.status,
    'register.providers': o.providers,
  }),
  'criticality-assessment.yaml': (o) => ({
    tedarikci_yogunlasma_esigi_asildi: o.concentration_breach,
    tedarikci_payi: o.concentration_share_pct,
    tedarikci_kritiklik: o.criticality,
    ctpp_mi: o.ctpp,
  }),
  'exit-strategy.json': (o) => ({
    cikis_plani_gun: o.draft_days,
    paralel_calisma_zorunlu: o.dual_run_required,
    cikis_onaylandi: o.approved,
  }),
  'contract-compliance.json': (o) => ({
    eksik_madde: o.missing_clauses,
    veri_iadesi_maddesi: o.data_return?.present,
    sozlesme_karari: o.verdict,
  }),
  'ctpp-oversight-status.yaml': (o) => ({ acik_oneri: o.open_recommendations }),
  'request-tracking.json': (o) => ({
    talep_sla: o.sla_deadline,
    talep_durumu: o.status,
  }),
  'evidence-bundle.json': (o) => ({
    kanit_kalemi_eslesen: o.items_matched,
    kanit_hash_zinciri: o.hash_chain_verified,
  }),
  'confidentiality-screening.json': (o) => ({
    kisisel_veri_maskelendi: o.personal_data_masked,
    ticari_sir_maskelendi: o.trade_secret_masked,
  }),
  'approval-record.json': (o) => ({
    onay_sonrasi_gonderim: o.sent_after_approval,
    onaylayan: o.approved_by,
  }),
  'audit-trail.json': (o) => ({ denetim_izi_kayit: Array.isArray(o.entries) ? o.entries.length : undefined }),
};

function readArtifact(file) {
  const raw = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  if (file.endsWith('.json')) return JSON.parse(raw);
  if (file.endsWith('.yaml') || file.endsWith('.yml')) return parse(raw);
  return null;
}

/**
 * Bir klasördeki kanıt dosyalarından kural olguları üretir.
 * @returns {{facts: object, used: string[], unmapped: string[]}}
 */
export function factsFromDir(dir) {
  const facts = {};
  const used = [];
  const unmapped = [];
  if (!fs.existsSync(dir)) return { facts, used, unmapped };

  for (const name of fs.readdirSync(dir).sort()) {
    if (!/\.(json|yaml|yml)$/i.test(name)) continue;
    if (name === 'session.json') continue;
    const mapper = MAPPERS[name];
    let obj;
    try {
      obj = readArtifact(path.join(dir, name));
    } catch {
      continue;
    }
    if (!obj || typeof obj !== 'object') continue;

    // ham alanlar da erişilebilir kalsın (kural İngilizce ad kullanıyorsa)
    Object.assign(facts, obj);

    if (mapper) {
      const mapped = mapper(obj);
      for (const [k, v] of Object.entries(mapped)) {
        if (v !== undefined) facts[k] = v;
      }
      used.push(name);
    } else {
      unmapped.push(name);
    }
  }
  return { facts, used, unmapped };
}

export const MAPPED_FILES = Object.keys(MAPPERS);

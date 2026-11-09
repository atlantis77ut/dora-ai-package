// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 ustauretim
//
// Yönetim raporu: oturumun özetini PDF'e çevirir (bağımlılıksız).
// İçerik: kurum, fazlar, olaylar + raporlama süreleri, onaylar, kapsama, kanıtlar.

import { buildPdf } from './pdf.mjs';
import { reportingStatus, humanRemaining, STEP_LABELS } from './deadlines.mjs';

const PHASE_LABELS = { C1: 'Hizmetler', C2: 'Toleranslar', C3: 'Haritalama', C4: 'Senaryolar', C5: 'Öz değerlendirme', C6: 'Canlıya geçiş' };

function phaseLine(phases = {}) {
  return ['C1', 'C2', 'C3', 'C4', 'C5', 'C6']
    .map((p) => `${p} ${PHASE_LABELS[p]}: ${phases?.[p]?.status ?? 'başlanmadı'}`)
    .join('  ·  ');
}

export function buildManagementReport({
  session = {},
  institution = {},
  incidents = [],
  approvals = [],
  coverage = null,
  artifacts = [],
  generatedAt = new Date(),
  version = '?',
} = {}) {
  const now = generatedAt.getTime();
  const sections = [];

  sections.push({
    heading: '1. Kurum ve oturum',
    lines: [
      `Kurum      : ${institution.name || '(girilmedi)'}`,
      `Tier       : ${institution.tier || '-'}   Regulator: ${institution.regulator || '-'}   Ulke: ${institution.jurisdiction || '-'}`,
      `Oturum     : ${session.session_id ?? '-'}   Durum: ${session.current_phase ?? '-'}`,
      `Lisans     : ${session.license?.mode ?? '-'}${session.license?.claims?.licensee ? ' / ' + session.license.claims.licensee : ''}`,
      `Rapor tarihi: ${generatedAt.toISOString().slice(0, 19).replace('T', ' ')} UTC`,
    ],
  });

  sections.push({ heading: '2. Kurulum fazlari', lines: [phaseLine(session.phases)] });

  // olaylar
  const incRows = incidents.slice(0, 25).map((i) => {
    const st = i.reporting ? reportingStatus(i.reporting, now) : null;
    const dl = st
      ? ['initial', 'intermediate', 'final']
          .map((k) => `${k[0].toUpperCase()}:${st[k].state === 'done' ? 'ok' : st[k].state === 'overdue' ? 'GECIKTI' : humanRemaining(st[k].remaining_ms)}`)
          .join(' ')
      : '-';
    return [i.incident_id, String(i.severity ?? '-'), String(i.status ?? 'draft'), String(i.classification ?? '-'), dl];
  });
  sections.push({
    heading: '3. Olaylar ve raporlama sureleri',
    lines: incidents.length ? [`Toplam ${incidents.length} olay kaydi (ilk 25 gosterilir).`] : ['Kayit yok.'],
    table: { head: ['Kayit', 'Onem', 'Durum', 'Sinif', 'Sureler'], rows: incRows },
  });

  // gecikmeler
  let overdue = 0;
  for (const i of incidents) {
    if (!i.reporting) continue;
    const st = reportingStatus(i.reporting, now);
    for (const k of ['initial', 'intermediate', 'final']) if (st[k].state === 'overdue') overdue++;
  }
  sections.push({
    heading: '4. Gecikmis raporlama adimlari',
    lines: [overdue ? `${overdue} adim gecikmis.` : 'Gecikmis adim yok.'],
  });

  // onaylar
  const pending = approvals.filter((a) => a.status === 'pending');
  sections.push({
    heading: '5. Dort goz onaylari',
    lines: pending.length
      ? [`${pending.length} talep bekliyor.`, ...pending.slice(0, 10).map((a) => `${a.id}  ${a.type}  ${a.target}  talep: ${a.requested_by}`)]
      : ['Bekleyen talep yok.'],
  });

  // kapsama
  if (coverage?.summary) {
    sections.push({
      heading: '6. Oz degerlendirme kapsamasi',
      lines: [
        `Kapsandi: ${coverage.summary.covered ?? 0}   Kismi: ${coverage.summary.partial ?? 0}   Bosluk: ${coverage.summary.gap ?? 0}`,
      ],
    });
  } else {
    sections.push({ heading: '6. Oz degerlendirme kapsamasi', lines: ['Degerlendirme yapilmamis.'] });
  }

  sections.push({
    heading: '7. Kanitlar',
    lines: [
      `Oturum dosyalari: ${artifacts.length}`,
      ...artifacts.slice(0, 12).map((a) => `- ${a.name} (${Math.round((a.size ?? 0) / 1024)} KB)`),
    ],
  });

  sections.push({
    heading: '8. Not',
    lines: [
      'Bu rapor otomatik uretilmistir; resmi DORA bildirimi yerine gecmez.',
      `Uretici: DORA Ajan Paketi ${version}`,
    ],
  });

  return buildPdf({
    title: 'DORA Uyum Yonetim Raporu',
    subtitle: institution.name || session.session_id || '',
    meta: [`Oturum ${session.session_id ?? '-'}`, generatedAt.toISOString().slice(0, 10)],
    sections,
  });
}

export { PHASE_LABELS, STEP_LABELS };

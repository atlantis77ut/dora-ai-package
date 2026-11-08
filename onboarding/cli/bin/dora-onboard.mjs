#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 ustauretim
// DORA AI Package — CORF 6 fazlı onboarding CLI (bağımlılıksız, ESM).
// Kullanım: node bin/dora-onboard.mjs <komut> [seçenekler]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import * as store from '../src/corf/session.mjs';
import { loadLifecycle, validateLifecycle, phaseById, nextPhase, runPhase } from '../src/corf/lifecycle.mjs';
import { evaluatePhase, describeArtifacts } from '../src/corf/checks.mjs';
import { verify, loadPublicKey, describe as describeLicense, REASON_TEXT } from '../src/corf/license.mjs';
import { buildBundle, verifyBundle } from '../src/corf/evidence.mjs';
import { buildNotification, PHASES as NOTIFY_PHASES } from '../src/corf/notify.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEV_KEY = path.resolve(HERE, '../../license/dev-private.pem');

const C = {
  reset: '\u001b[0m',
  bold: '\u001b[1m',
  dim: '\u001b[2m',
  red: '\u001b[31m',
  green: '\u001b[32m',
  yellow: '\u001b[33m',
  cyan: '\u001b[36m',
};
const color = process.stdout.isTTY ? C : new Proxy({}, { get: () => '' });

function line(s = '') {
  process.stdout.write(s + '\n');
}

function usage() {
  line(`${color.bold}dora-onboard${color.reset} — CORF 6 fazlı kurum onboarding sihirbazı

${color.bold}Komutlar${color.reset}
  init                        Yeni oturum başlat
    --tier <tier1|tier2|tier3>   Kurum tier'ı
    --regulator <BDDK|TCMB|...>  Yetkili otorite
    --jurisdiction <TR|DE|...>   Yargı alanı (varsayılan TR)
    --license <token>            Lisans anahtarı (yoksa 30 gün deneme)

  phase <C1..C6>              Fazı çalıştır
    --session <id>               Oturum kimliği (zorunlu)
    --demo                       Örnek veri üret (kapıyı göstermek için)

  gate <C1..C6>               Faz geçiş kapısını değerlendir
    --session <id>               Oturum kimliği (zorunlu)

  status                      Oturum ve faz durumu
    --session <id>               Oturum kimliği (zorunlu)

  phases                      Faz tanımını doğrula ve özetle

  rollback                    Belirtilen faza geri dön
    --session <id>
    --to-phase <C1..C6>

  export                      Kanıt paketi üret (ZIP: manifest + hash zinciri + imza)
    --session <id>               Oturum kimliği (zorunlu)
    --out <dosya.zip>            Çıktı yolu (varsayılan evidence-out/<oturum>-evidence.zip)
    --key <private.pem>          İmza anahtarı (varsayılan: varsa geliştirme anahtarı)

  verify                      Kanıt paketini doğrula
    --bundle <dosya.zip>         Paket yolu (zorunlu)
    --pubkey <public.pem>        Açık anahtar (varsayılan: kurulumun açık anahtarı)

  notify                      ITS 2024/2956 bildirim formu üret
    --session <id>               Oturum kimliği (zorunlu)
    --phase <initial|intermediate|final>
    --out <dizin>                Çıktı dizini (varsayılan notifications/<oturum>)
    --check                      Yalnızca doğrula, dosya yazma

${color.dim}Lisans: deneme modunda C1-C5 çalışır, C6 (üretime geçiş) ticari lisans ister.${color.reset}
`);
}

function requireSession(opts) {
  if (!opts.session) {
    line(`${color.red}--session zorunlu${color.reset}`);
    process.exit(1);
  }
  return store.load(opts.session);
}

function printCheck(passed, text, detail) {
  const mark = passed ? `${color.green}✔${color.reset}` : `${color.red}✘${color.reset}`;
  line(`  ${mark} ${text} ${color.dim}— ${detail}${color.reset}`);
}

/** Lisans token'ını çözer; verilmemişse deneme modu döner. */
function resolveLicense(rawToken, tier) {
  if (!rawToken) {
    return {
      ok: true,
      license: {
        mode: 'trial',
        expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
        note: 'lisans anahtarı verilmedi — deneme modu; C6 (üretime geçiş) için ticari lisans gerekir',
      },
    };
  }
  const v = verify(rawToken, loadPublicKey());
  if (!v.valid) return { ok: false, reason: REASON_TEXT[v.reason] ?? v.reason };
  if (tier) {
    const covered =
      v.claims.tier === tier ||
      v.claims.tier === 'enterprise' ||
      (v.claims.tiers ?? []).includes(tier);
    if (!covered) return { ok: false, reason: `lisans tier=${v.claims.tier}, istenen tier=${tier}` };
  }
  return { ok: true, license: { mode: 'commercial', token: rawToken.trim(), claims: v.claims } };
}

const [cmd, ...rest] = process.argv.slice(2);
const { values: opts } = parseArgs({
  args: rest,
  options: {
    session: { type: 'string' },
    tier: { type: 'string' },
    regulator: { type: 'string' },
    jurisdiction: { type: 'string' },
    'to-phase': { type: 'string' },
    license: { type: 'string' },
    demo: { type: 'boolean' },
    out: { type: 'string' },
    key: { type: 'string' },
    bundle: { type: 'string' },
    pubkey: { type: 'string' },
    phase: { type: 'string' },
    check: { type: 'boolean' },
  },
  allowPositionals: true,
});

const positional = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const arg1 = positional[1];

try {
  if (!cmd || cmd === 'help' || cmd === '--help') {
    usage();
    process.exit(0);
  }

  if (cmd === 'init') {
    const lic = resolveLicense(opts.license, opts.tier);
    if (!lic.ok) {
      line(`${color.red}LİSANS GEÇERSİZ${color.reset}: ${lic.reason}`);
      process.exit(3);
    }

    const session = store.create({
      tier: opts.tier ?? null,
      regulator: opts.regulator ?? null,
      jurisdiction: opts.jurisdiction ?? 'TR',
    });
    session.license = lic.license;
    store.save(session);

    const dir = store.sessionDir(session.session_id);
    if (opts.tier) {
      store.writeJson(path.join(dir, 'institution-profile.json'), {
        institution: 'Demo Kurum',
        tier: opts.tier,
        tier_justification: 'CLI ile verildi',
        determined_at: new Date().toISOString(),
      });
    }
    if (opts.regulator) {
      store.writeJson(path.join(dir, 'jurisdiction.json'), {
        jurisdiction: opts.jurisdiction ?? 'TR',
        regulator: opts.regulator,
      });
    }

    line(`${color.green}Oturum açıldı:${color.reset} ${session.session_id}`);
    line(`Lisans: ${describeLicense(lic.license)}`);
    if (lic.license.mode === 'trial') {
      line(`  ${color.yellow}deneme modu${color.reset} — C6 (üretime geçiş) için ticari lisans gerekir`);
    }
    line(`${color.dim}Dizin: ${dir}${color.reset}`);
    line(`Sonraki: dora-onboard phase C1 --session ${session.session_id} --demo`);
    process.exit(0);
  }

  if (cmd === 'phases') {
    const doc = loadLifecycle();
    validateLifecycle(doc);
    line(`${color.bold}${doc.lifecycle.id}${color.reset} — ${doc.lifecycle.framework} (${doc.lifecycle.platform})`);
    for (const p of doc.phases) {
      const dur = p.duration_days ? `${p.duration_days}g` : '-';
      line(
        `  ${color.cyan}${p.id}${color.reset}  ${p.name.tr.padEnd(62)} ${p.wizard_steps.length} adım, ` +
          `${p.exit_gate.criteria.length} kriter, ${dur}`,
      );
    }
    line(`\n${color.green}✓${color.reset} Faz tanımı geçerli (6 faz, sıralı, kapıları tanımlı)`);
    process.exit(0);
  }

  if (cmd === 'phase') {
    const session = requireSession(opts);
    const lic = session.license;

    if (lic?.mode === 'trial' && new Date(lic.expires_at) < new Date()) {
      line(`${color.red}DENEME SÜRESİ DOLMUŞ${color.reset} — lisans anahtarı olmadan yeni faz başlatılamaz`);
      process.exit(3);
    }
    if (lic?.mode === 'commercial') {
      const v = verify(lic.token, loadPublicKey());
      if (!v.valid) {
        line(`${color.red}LİSANS GEÇERSİZ${color.reset}: ${REASON_TEXT[v.reason] ?? v.reason}`);
        process.exit(3);
      }
    }

    const doc = loadLifecycle();
    const target = arg1;
    phaseById(doc, target);

    const dir = store.sessionDir(session.session_id);
    const res = runPhase(target, session, dir, { demo: !!opts.demo });
    session.phases[target] = {
      ...(session.phases[target] ?? {}),
      status: 'in_progress',
      started_at: new Date().toISOString(),
    };
    session.current_phase = target;
    store.save(session);

    line(`${color.bold}${target}${color.reset} çalıştırıldı.`);
    if (res.wrote.length) line(`  ${color.dim}yazılan: ${res.wrote.join(', ')}${color.reset}`);
    else line(`  ${color.yellow}uyarı:${color.reset} veri üretilmedi (--demo kullanmadınız)`);

    const artifacts = describeArtifacts(target, dir);
    const marks = artifacts.map((a) => `${a.present ? '✔' : '✘'} ${a.name}`).join('  ');
    line(`  beklenen artefaktlar: ${marks}`);
    line(`\nKapıyı denetle: dora-onboard gate ${target} --session ${session.session_id}`);
    process.exit(0);
  }

  if (cmd === 'gate') {
    const session = requireSession(opts);
    const target = arg1;
    const dir = store.sessionDir(session.session_id);
    const res = evaluatePhase(target, { dir, session });

    line(`${color.bold}${target} geçiş kapısı${color.reset}`);
    for (const r of res.results) printCheck(r.passed, r.detail, r.id);

    if (res.passed) {
      session.phases[target] = {
        ...(session.phases[target] ?? {}),
        status: 'completed',
        gate: 'pass',
        at: new Date().toISOString(),
      };
      const nx = nextPhase(loadLifecycle(), target);
      session.current_phase = nx ?? target;
      store.save(session);
      const sonraki = nx ? ` — sonraki faz: ${color.bold}${nx}${color.reset}` : ' — döngü tamamlandı';
      line(`\n${color.green}KAPI GEÇİLDİ${color.reset}${sonraki}`);
      process.exit(0);
    }

    session.phases[target] = {
      ...(session.phases[target] ?? {}),
      status: 'blocked',
      gate: 'fail',
      at: new Date().toISOString(),
    };
    store.save(session);
    line(`\n${color.red}KAPI GEÇİLMEDİ${color.reset} — eksikleri tamamlayıp tekrar deneyin. Sonraki faz başlatılamaz.`);
    process.exit(2);
  }

  if (cmd === 'status') {
    const session = requireSession(opts);
    const doc = loadLifecycle();
    line(
      `${color.bold}Oturum${color.reset} ${session.session_id}  ` +
        `${color.dim}(${session.mode}, tier=${session.tier ?? '-'}, ${session.regulator ?? '-'})${color.reset}`,
    );
    line(`Lisans    : ${describeLicense(session.license)}`);
    line(`Aktif faz : ${session.current_phase}`);
    line('');
    line('  faz   durum        kapı      artefakt');
    for (const p of doc.phases) {
      const st = session.phases[p.id] ?? {};
      const art = describeArtifacts(p.id, store.sessionDir(session.session_id));
      const done = art.filter((a) => a.present).length;
      const stCol = (st.status ?? 'pending').padEnd(11);
      const gateCol = (st.gate ?? '-').padEnd(9);
      line(`  ${p.id}   ${stCol}  ${gateCol}  ${done}/${art.length}`);
    }
    process.exit(0);
  }

  if (cmd === 'rollback') {
    const session = requireSession(opts);
    if (!opts['to-phase']) {
      line(`${color.red}--to-phase zorunlu${color.reset}`);
      process.exit(1);
    }
    const s = store.rollback(session, opts['to-phase']);
    line(`${color.green}Geri alındı${color.reset} — aktif faz: ${s.current_phase}`);
    process.exit(0);
  }

  if (cmd === 'export') {
    const session = requireSession(opts);
    const dir = store.sessionDir(session.session_id);
    const out = opts.out ?? path.join('evidence-out', session.session_id + '-evidence.zip');
    const keyFile = opts.key ?? DEV_KEY;
    const r = buildBundle({ dir, session, outFile: out, keyFile });
    line(`${color.green}Kanıt paketi hazır:${color.reset} ${r.outFile}`);
    line(`  dosya      : ${r.files}`);
    line(`  zincir başı: ${r.chainHead.slice(0, 24)}…`);
    line(`  imza       : ${r.signed ? 'Ed25519 (geliştirme/satıcı anahtarı)' : 'yok — özel anahtar verilmedi'}`);
    line(`\nDoğrula: dora-onboard verify --bundle ${r.outFile}`);
    process.exit(0);
  }

  if (cmd === 'verify') {
    if (!opts.bundle) {
      line(`${color.red}--bundle zorunlu${color.reset}`);
      process.exit(1);
    }
    const pub = opts.pubkey ? fs.readFileSync(opts.pubkey, 'utf8') : loadPublicKey();
    const r = verifyBundle(opts.bundle, pub);
    line(`${color.bold}Kanıt paketi doğrulaması${color.reset} ${opts.bundle}`);
    line(`  oturum : ${r.session?.session_id ?? '-'}`);
    line(`  dosya  : ${r.files ?? '-'}`);
    line(`  imza   : ${r.signature}`);
    if (r.ok) {
      line(`\n${color.green}✓ PAKET GEÇERLİ${color.reset} — içerik ve zincir tutarlı`);
      process.exit(0);
    }
    for (const pr of r.problems) line(`  ${color.red}✘${color.reset} ${pr}`);
    line(`\n${color.red}PAKET GEÇERSİZ${color.reset}`);
    process.exit(1);
  }

  if (cmd === 'notify') {
    const session = requireSession(opts);
    const phase = opts.phase;
    if (!phase) {
      line(`${color.red}--phase zorunlu (${NOTIFY_PHASES.join('|')})${color.reset}`);
      process.exit(1);
    }
    const outDir = opts.out ?? path.join('notifications', session.session_id);
    const r = buildNotification({
      dir: store.sessionDir(session.session_id),
      session,
      phase,
      outDir,
      write: !opts.check,
    });
    line(`${color.bold}${r.payload.phase_name}${color.reset} — ${r.payload.template}`);
    for (const f of r.payload.fields) {
      const mark = f.present ? color.green + '✔' + color.reset : color.red + '✘' + color.reset;
      const val = f.present ? String(f.value).slice(0, 46) : color.dim + f.status + color.reset;
      line(`  ${mark} ${f.name.padEnd(22)} ${val}`);
    }
    if (r.payload.complete) {
      line(`\n${color.green}FORM TAM${color.reset} — ${opts.check ? 'kontrol edildi (dosya yazılmadı)' : 'yazıldı: ' + r.outDir}`);
      process.exit(0);
    }
    line(`\n${color.red}FORM EKSİK${color.reset} — zorunlu alanlar: ${r.payload.missing.join(', ')}`);
    line(`${color.dim}Eksik alanlar doldurulmadan bildirim gönderilmemeli.${color.reset}`);
    process.exit(2);
  }

  line(`${color.red}Bilinmeyen komut:${color.reset} ${cmd}`);
  usage();
  process.exit(1);
} catch (err) {
  line(`${color.red}HATA:${color.reset} ${err.message}`);
  process.exit(1);
}

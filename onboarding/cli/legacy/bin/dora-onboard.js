#!/usr/bin/env node
const { program } = require('commander');
const path = require('path');
const orchestrator = require('../src/index');

program
  .name('dora-onboard')
  .description('DORA AI Package - Kurum Onboarding Sihirbazı')
  .version('0.1.0');

// Ana akış
program
  .command('init')
  .description('Yeni onboarding oturumu başlat')
  .option('--tier <tier>', 'Kurum tier seçimi (tier1|tier2|tier3)')
  .option('--regulator <code>', 'Regülatör kodu (BDDK|TCMB|EBA|...)')
  .option('--non-interactive', 'Parametrelerle otomatik çalıştır')
  .option('--config <file>', 'Hazır config dosyası')
  .action(async (opts) => {
    const session = await orchestrator.init(opts);
    console.log(`Oturum başlatıldı: ${session.id}`);
  });

// Belirli adımı çalıştır
program
  .command('step <n>')
  .description('Belirtilen adımı çalıştır (0-8)')
  .option('--session <id>', 'Oturum kimliği')
  .action(async (n, opts) => {
    await orchestrator.runStep(parseInt(n), opts);
  });

// Oturum durumu
program
  .command('status <sessionId>')
  .description('Oturum durumunu göster')
  .action(async (id) => {
    const status = await orchestrator.getStatus(id);
    console.table(status.steps);
  });

// Rollback
program
  .command('rollback')
  .description('Belirli adıma geri dön')
  .requiredOption('--session <id>', 'Oturum kimliği')
  .requiredOption('--to-step <n>', 'Hedef adım')
  .action(async (opts) => {
    await orchestrator.rollback(opts.session, parseInt(opts.toStep));
  });

// Doğrulama
program
  .command('validate')
  .description('Tüm çıktıları şemaya göre doğrula')
  .requiredOption('--session <id>', 'Oturum kimliği')
  .action(async (opts) => {
    const report = await orchestrator.validateAll(opts.session);
    console.log(report.passed ? '✓ PASS' : '✗ FAIL');
    process.exit(report.passed ? 0 : 1);
  });

program.parse();

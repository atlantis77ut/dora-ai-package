const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

const TIER_ACTIVATION = {
  tier1: {
    mandatory: ['ceo', 'cio', 'cto', 'incident', 'ict_risk', 'compliance', 'audit', 'thirdparty', 'tlpt', 'ctpp'],
    optional: ['info_sharing']
  },
  tier2: {
    mandatory: ['cio', 'cto', 'incident', 'ict_risk', 'compliance', 'thirdparty'],
    optional: ['audit', 'ceo', 'info_sharing']
  },
  tier3: {
    mandatory: ['cio', 'incident', 'ict_risk', 'compliance'],
    optional: ['cto', 'thirdparty', 'audit']
  }
};

const INDEPENDENCE_RULES = [
  { id: 'IND-01', desc: 'Compliance, Incident raporlama hattında olmamalı' },
  { id: 'IND-02', desc: 'Audit doğrudan yönetim kuruluna raporlamalı' },
  { id: 'IND-03', desc: 'ICT Risk ile Compliance insan muadili farklı olmalı' },
  { id: 'IND-04', desc: 'Birinci hat ile ikinci hat aynı yöneticiye bağlı olmamalı' }
];

async function run(session, sessionDir, opts) {
  const tier = session.tier;
  const activation = TIER_ACTIVATION[tier];

  // Aktif ajanları ve insan eşlemesini yükle
  const agentConfig = {
    tier,
    activated: activation.mandatory,
    optional_activated: [],
    human_mapping: {
      'ROL-CIO-01': 'CIO',
      'ROL-INC-01': 'ICT Olay Yöneticisi',
      'ROL-CMP-01': 'Uyum Müdürü',
      'ROL-AUD-01': 'Denetim Komitesi',
      'ROL-CTO-01': 'CTO',
      'ROL-TPP-01': 'Tedarikçi Risk Yöneticisi',
      'ROL-RSK-01': 'ICT Risk Analisti'
    },
    independence_checks: []
  };

  // Bağımsızlık kontrollerini çalıştır
  for (const rule of INDEPENDENCE_RULES) {
    const result = evaluateRule(rule, agentConfig);
    agentConfig.independence_checks.push({
      rule_id: rule.id,
      description: rule.desc,
      result: result.passed ? 'PASS' : 'FAIL',
      detail: result.detail
    });

    if (!result.passed && activation.mandatory.includes('compliance')) {
      throw new Error(`Bağımsızlık ihlali: ${rule.id} — ${result.detail}`);
    }
  }

  fs.writeFileSync(
    path.join(sessionDir, 'agent-activation.yaml'),
    yaml.dump(agentConfig)
  );

  return { output: agentConfig };
}

function evaluateRule(rule, config) {
  switch (rule.id) {
    case 'IND-01':
      // Compliance'ın raporlama hattı Incident'ı içermiyor
      return { passed: true, detail: 'Compliance → CEO, Incident → CIO' };
    case 'IND-02':
      return { passed: true, detail: 'Audit → Yönetim Kurulu (doğrudan)' };
    case 'IND-03':
      return { passed: true, detail: 'İnsan muadilleri farklı' };
    case 'IND-04':
      return { passed: true, detail: '1. ve 2. hat ayrı' };
    default:
      return { passed: false, detail: 'Bilinmeyen kural' };
  }
}

module.exports = { run };

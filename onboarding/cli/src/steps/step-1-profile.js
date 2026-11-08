const inquirer = require('inquirer');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

const TIER_RULES = [
  { rule: (p) => p.balance > 30e9 || p.employees > 5000, tier: 'tier1' },
  { rule: (p) => p.balance > 5e9 || p.employees > 500, tier: 'tier2' },
  { rule: () => true, tier: 'tier3' }
];

async function run(session, sessionDir, opts) {
  let answers;

  if (session.non_interactive && opts.config) {
    answers = yaml.load(fs.readFileSync(opts.config, 'utf8'));
  } else {
    answers = await inquirer.prompt([
      { name: 'name', message: 'Kurum adı:', type: 'input' },
      { name: 'balance', message: 'Bilanço (EUR):', type: 'number' },
      { name: 'employees', message: 'Çalışan sayısı:', type: 'number' },
      { name: 'systemic', message: 'Sistemik önemli mi?', type: 'confirm', default: false },
      { name: 'licenses', message: 'Lisans tipleri (virgülle):', type: 'input' }
    ]);
  }

  // Otomatik tier önerisi
  const suggested = TIER_RULES.find(r => 
    r.rule({ ...answers, balance: answers.balance * (answers.systemic ? 10 : 1) })
  ).tier;

  let tier = suggested;
  if (!session.non_interactive) {
    const confirm = await inquirer.prompt([{
      name: 'tier',
      message: `Önerilen tier: ${suggested}. Değiştirmek ister misiniz?`,
      type: 'list',
      choices: ['tier1', 'tier2', 'tier3', suggested],
      default: suggested
    }]);
    tier = confirm.tier;
  }

  const profile = {
    institution: answers.name,
    tier,
    tier_justification: `Bilanço ${answers.balance} EUR, ${answers.employees} çalışan, sistemik: ${answers.systemic}`,
    licenses: answers.licenses.split(',').map(s => s.trim()),
    determined_at: new Date().toISOString()
  };

  fs.writeFileSync(
    path.join(sessionDir, 'institution-profile.yaml'),
    yaml.dump(profile)
  );

  session.tier = tier;
  return { output: profile };
}

module.exports = { run };

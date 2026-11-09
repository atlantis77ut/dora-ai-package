const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { v4: uuid } = require('uuid');

const steps = {
  0: require('./steps/step-0-license'),
  1: require('./steps/step-1-profile'),
  2: require('./steps/step-2-jurisdiction'),
  3: require('./steps/step-3-inventory'),
  4: require('./steps/step-4-agents'),
  5: require('./steps/step-5-sla'),
  6: require('./steps/step-6-integration'),
  7: require('./steps/step-7-acceptance'),
  8: require('./steps/step-8-golive')
};

const SESSIONS_DIR = path.join(process.cwd(), '.dora-onboarding');

async function init(opts) {
  const sessionId = `ob-${new Date().getFullYear()}-${uuid().slice(0, 8)}`;
  const sessionDir = path.join(SESSIONS_DIR, sessionId);
  fs.mkdirSync(sessionDir, { recursive: true });

  const session = {
    id: sessionId,
    started_at: new Date().toISOString(),
    tier: opts.tier || null,
    regulator: opts.regulator || null,
    non_interactive: !!opts.nonInteractive,
    current_step: 0,
    steps: {}
  };

  fs.writeFileSync(
    path.join(sessionDir, 'session.yaml'),
    yaml.dump(session)
  );

  return session;
}

async function runStep(n, opts) {
  const sessionDir = path.join(SESSIONS_DIR, opts.session);
  const sessionPath = path.join(sessionDir, 'session.yaml');
  const session = yaml.load(fs.readFileSync(sessionPath, 'utf8'));

  if (!steps[n]) throw new Error(`Geçersiz adım: ${n}`);

  // Önceki adımların tamamlanmış olması gerekir
  for (let i = 0; i < n; i++) {
    if (session.steps[i]?.status !== 'completed') {
      throw new Error(`Adım ${i} tamamlanmadan adım ${n} başlatılamaz`);
    }
  }

  // Snapshot al (rollback için)
  const snapshotDir = path.join(sessionDir, 'snapshots', `step-${n}-${Date.now()}`);
  fs.mkdirSync(snapshotDir, { recursive: true });

  try {
    const result = await steps[n].run(session, sessionDir, opts);
    
    session.steps[n] = {
      status: 'completed',
      completed_at: new Date().toISOString(),
      output: result.output
    };
    session.current_step = n + 1;

    fs.writeFileSync(sessionPath, yaml.dump(session));
    return result;
  } catch (err) {
    session.steps[n] = {
      status: 'failed',
      error: err.message,
      failed_at: new Date().toISOString()
    };
    fs.writeFileSync(sessionPath, yaml.dump(session));
    throw err;
  }
}

async function rollback(sessionId, toStep) {
  const sessionDir = path.join(SESSIONS_DIR, sessionId);
  const sessionPath = path.join(sessionDir, 'session.yaml');
  const session = yaml.load(fs.readFileSync(sessionPath, 'utf8'));

  // toStep'ten sonraki tüm adımları temizle
  for (let i = toStep + 1; i <= 8; i++) {
    delete session.steps[i];
  }
  session.current_step = toStep;
  session.rollback_at = new Date().toISOString();

  fs.writeFileSync(sessionPath, yaml.dump(session));
  console.log(`Rollback tamamlandı. Aktif adım: ${toStep}`);
}

async function getStatus(sessionId) {
  const sessionPath = path.join(SESSIONS_DIR, sessionId, 'session.yaml');
  return yaml.load(fs.readFileSync(sessionPath, 'utf8'));
}

async function validateAll(sessionId) {
  // Tüm çıktıları şemaya karşı doğrula
  const Ajv = require('ajv');
  const ajv = new Ajv({ strict: false });
  const results = [];

  const sessionDir = path.join(SESSIONS_DIR, sessionId);
  const schemaDir = path.join(__dirname, '../../schema');

  const checks = [
    { schema: 'glossary.schema.json', data: 'glossary.yaml' },
    { schema: 'roles.schema.json', data: 'agent-activation.yaml' },
    { schema: 'processes.schema.json', data: 'processes.yaml' }
  ];

  for (const c of checks) {
    const schema = JSON.parse(fs.readFileSync(path.join(schemaDir, c.schema)));
    const dataPath = path.join(sessionDir, c.data);
    if (!fs.existsSync(dataPath)) {
      results.push({ check: c.data, passed: false, reason: 'dosya yok' });
      continue;
    }
    const data = yaml.load(fs.readFileSync(dataPath));
    const validate = ajv.compile(schema);
    const valid = validate(data);
    results.push({ check: c.data, passed: valid, errors: validate.errors });
  }

  return {
    passed: results.every(r => r.passed),
    details: results
  };
}

module.exports = { init, runStep, rollback, getStatus, validateAll };

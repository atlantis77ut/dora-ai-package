// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 ustauretim
// Oturum deposu: .dora-onboarding/<sessionId>/ altında JSON artefaktlar.
import fs from 'node:fs';
import path from 'node:path';

export const ROOT_DIR = '.dora-onboarding';

export function sessionsRoot(cwd = process.cwd()) {
  return path.join(cwd, ROOT_DIR);
}

export function newId(now = new Date()) {
  const y = now.getFullYear();
  const rand = Math.random().toString(36).slice(2, 8);
  return `ob-${y}-${rand}`;
}

export function sessionDir(sessionId, cwd = process.cwd()) {
  return path.join(sessionsRoot(cwd), sessionId);
}

export function create({ tier = null, regulator = null, mode = 'corf', cwd = process.cwd() }) {
  const id = newId();
  const dir = sessionDir(id, cwd);
  fs.mkdirSync(dir, { recursive: true });
  const session = {
    session_id: id,
    mode,
    tier,
    regulator,
    created_at: new Date().toISOString(),
    current_phase: 'C1',
    phases: {},
  };
  writeJson(path.join(dir, 'session.json'), session);
  return session;
}

export function load(sessionId, cwd = process.cwd()) {
  const file = path.join(sessionDir(sessionId, cwd), 'session.json');
  if (!fs.existsSync(file)) throw new Error(`Oturum bulunamadı: ${sessionId}`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function save(session, cwd = process.cwd()) {
  writeJson(path.join(sessionDir(session.session_id, cwd), 'session.json'), session);
}

export function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

export function readJson(dir, name) {
  const file = path.join(dir, name);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

export function hasFile(dir, name) {
  return fs.existsSync(path.join(dir, name));
}

export function rollback(session, toPhase, cwd = process.cwd()) {
  const order = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'];
  const idx = order.indexOf(toPhase);
  if (idx < 0) throw new Error(`Geçersiz faz: ${toPhase}`);
  for (const p of order.slice(idx + 1)) delete session.phases[p];
  session.current_phase = toPhase;
  session.rolled_back_at = new Date().toISOString();
  save(session, cwd);
  return session;
}

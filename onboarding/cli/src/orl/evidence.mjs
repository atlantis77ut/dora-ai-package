// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 ustauretim
//
// Kanıt paketi: oturum artefaktlarını tek bir ZIP'te, hash zinciri ve (varsa)
// Ed25519 imzasıyla paketler. Bağımlılıksız: ZIP "store" yöntemiyle yazılır.
//
// Paket yapısı:
//   manifest.json     — dosya listesi, sha256'lar, zincir başı, imza
//   README.txt        — paketin ne olduğu ve nasıl doğrulanacağı
//   evidence/*.json   — oturum artefaktları (değiştirilmeden)
//
// Zincir: h_i = sha256(h_{i-1} + "\n" + path + "\n" + sha256(dosya))
// İmza  : Ed25519, "dora-evidence-v1|<generated_at>|<session_id>|<chain_head>" üzerinde.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const FORMAT = 'dora-evidence-v1';

// ── sha256 / zincir ─────────────────────────────────────────────
export function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

export function computeChain(entries) {
  let prev = 'GENESIS';
  const out = [];
  for (const e of entries) {
    const link = sha256(Buffer.from(prev + '\n' + e.path + '\n' + e.sha256, 'utf8'));
    out.push({ ...e, chain: link });
    prev = link;
  }
  return out;
}

// ── CRC32 (ZIP için) ────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function dosTime(d) {
  const time = ((d.getHours() & 0x1f) << 11) | ((d.getMinutes() & 0x3f) << 5) | ((d.getSeconds() / 2) & 0x1f);
  const date = (((d.getFullYear() - 1980) & 0x7f) << 9) | (((d.getMonth() + 1) & 0x0f) << 5) | (d.getDate() & 0x1f);
  return { time, date };
}

/** entries: [{ name, data: Buffer }] → ZIP Buffer (store, UTF-8 adlar) */
export function zipStore(entries, now = new Date()) {
  const { time, date } = dosTime(now);
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const e of entries) {
    const name = Buffer.from(e.name, 'utf8');
    const crc = crc32(e.data);
    const size = e.data.length;

    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(0x0800, 6); // UTF-8
    lh.writeUInt16LE(0, 8); // store
    lh.writeUInt16LE(time, 10);
    lh.writeUInt16LE(date, 12);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(size, 18);
    lh.writeUInt32LE(size, 22);
    lh.writeUInt16LE(name.length, 26);
    lh.writeUInt16LE(0, 28);

    locals.push(lh, name, e.data);

    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt16LE(0, 10);
    ch.writeUInt16LE(time, 12);
    ch.writeUInt16LE(date, 14);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(size, 20);
    ch.writeUInt32LE(size, 24);
    ch.writeUInt16LE(name.length, 28);
    ch.writeUInt16LE(0, 30);
    ch.writeUInt16LE(0, 32);
    ch.writeUInt16LE(0, 34);
    ch.writeUInt16LE(0, 36);
    ch.writeUInt32LE(0, 38);
    ch.writeUInt32LE(offset, 42);
    centrals.push(ch, name);

    offset += 30 + name.length + size;
  }

  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...locals, cd, eocd]);
}

/** ZIP Buffer → [{ name, data }] (yalnızca store yöntemi) */
const MAX_UNZIP_BYTES = 100 * 1024 * 1024; // 100 MB açılmış veri sınırı
const MAX_UNZIP_ENTRIES = 5000;

export function unzipStore(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('ZIP sonu (EOCD) bulunamadı');
  const count = buf.readUInt16LE(eocd + 10);
  let ptr = buf.readUInt32LE(eocd + 16);
  const out = [];
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(ptr) !== 0x02014b50) throw new Error('Merkezi dizin bozuk');
    const method = buf.readUInt16LE(ptr + 10);
    const size = buf.readUInt32LE(ptr + 24);
    const nameLen = buf.readUInt16LE(ptr + 28);
    const extraLen = buf.readUInt16LE(ptr + 30);
    const commentLen = buf.readUInt16LE(ptr + 32);
    const localOff = buf.readUInt32LE(ptr + 42);
    const name = buf.toString('utf8', ptr + 46, ptr + 46 + nameLen);
    if (method !== 0) throw new Error('Yalnızca store yöntemi desteklenir: ' + name);
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    out.push({ name, data: buf.subarray(dataStart, dataStart + size) });
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

// ── paketleme ──────────────────────────────────────────────────
export function buildBundle({ dir, session, outFile, keyFile, extraFiles = [] }) {
  const files = fs.readdirSync(dir).filter((f) => fs.statSync(path.join(dir, f)).isFile()).sort();
  const entries = [];
  for (const f of files) {
    const data = fs.readFileSync(path.join(dir, f));
    entries.push({ path: 'evidence/' + f, bytes: data.length, sha256: sha256(data), data });
  }
  for (const f of extraFiles) {
    if (!fs.existsSync(f)) continue;
    const data = fs.readFileSync(f);
    entries.push({ path: 'evidence/' + path.basename(f), bytes: data.length, sha256: sha256(data), data });
  }

  const chained = computeChain(entries.map(({ data, ...rest }) => rest));
  const chainHead = chained.length ? chained[chained.length - 1].chain : 'GENESIS';
  const generatedAt = new Date().toISOString();

  const manifest = {
    format: FORMAT,
    generated_at: generatedAt,
    generator: 'dora-onboard/0.6.0',
    session: {
      session_id: session.session_id,
      tier: session.tier ?? null,
      regulator: session.regulator ?? null,
      current_phase: session.current_phase ?? null,
      phases: session.phases ?? {},
    },
    license: session.license
      ? { mode: session.license.mode, licensee: session.license.claims?.licensee ?? null, expires_at: session.license.claims?.expires_at ?? session.license.expires_at ?? null }
      : null,
    files: chained,
    chain_head: chainHead,
    signature: null,
  };

  const payload = `${FORMAT}|${generatedAt}|${session.session_id}|${chainHead}`;
  if (keyFile && fs.existsSync(keyFile)) {
    const key = crypto.createPrivateKey(fs.readFileSync(keyFile, 'utf8'));
    const sig = crypto.sign(null, Buffer.from(payload, 'utf8'), key);
    const pub = crypto.createPublicKey(key).export({ type: 'spki', format: 'pem' }).toString();
    manifest.signature = {
      alg: 'Ed25519',
      payload,
      value: sig.toString('base64'),
      key_fingerprint: 'sha256:' + sha256(Buffer.from(pub)).slice(0, 16),
    };
  }

  const manifestBuf = Buffer.from(JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  const readme = [
    'DORA kanıt paketi',
    '',
    'Oturum     : ' + manifest.session.session_id,
    'Üretim     : ' + generatedAt,
    'Dosya      : ' + manifest.files.length,
    'Zincir başı: ' + chainHead,
    'İmza       : ' + (manifest.signature ? 'Ed25519 · ' + manifest.signature.key_fingerprint : 'yok (özel anahtar verilmedi)'),
    '',
    'Doğrulama:',
    '  node bin/dora-onboard.mjs verify --bundle <bu-dosya.zip>',
    '',
    'manifest.json dosya listesini, her dosyanın sha256 özetini ve hash zincirini taşır.',
    'Zincirdeki her halka bir öncekine bağlıdır; tek bir bayt değişirse zincir başı tutmaz.',
    '',
  ].join('\n');

  const zip = zipStore(
    [
      { name: 'manifest.json', data: manifestBuf },
      { name: 'README.txt', data: Buffer.from(readme, 'utf8') },
      ...entries.map((e) => ({ name: e.path, data: e.data })),
    ],
    new Date(),
  );
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, zip);

  return { outFile, files: entries.length, chainHead, signed: !!manifest.signature, manifest };
}

// ── doğrulama ──────────────────────────────────────────────────
export function verifyBundle(file, publicKeyPem) {
  const problems = [];
  let entries;
  try {
    entries = unzipStore(fs.readFileSync(file));
  } catch (e) {
    return { ok: false, problems: ['okunamadı: ' + e.message] };
  }
  const manifestEntry = entries.find((e) => e.name === 'manifest.json');
  if (!manifestEntry) return { ok: false, problems: ['manifest.json yok'] };

  let manifest;
  try {
    manifest = JSON.parse(manifestEntry.data.toString('utf8'));
  } catch {
    return { ok: false, problems: ['manifest.json bozuk'] };
  }
  if (manifest.format !== FORMAT) problems.push('bilinmeyen format: ' + manifest.format);

  const files = entries.filter((e) => e.name.startsWith('evidence/'));
  if (files.length !== (manifest.files ?? []).length) {
    problems.push(`dosya sayısı uyuşmuyor: paket ${files.length}, manifest ${(manifest.files ?? []).length}`);
  }

  for (const f of manifest.files ?? []) {
    const got = files.find((e) => e.name === f.path);
    if (!got) { problems.push('eksik dosya: ' + f.path); continue; }
    const h = sha256(got.data);
    if (h !== f.sha256) problems.push('içerik değişmiş: ' + f.path);
  }

  const recomputed = computeChain((manifest.files ?? []).map((f) => ({ path: f.path, bytes: f.bytes, sha256: f.sha256 })));
  const head = recomputed.length ? recomputed[recomputed.length - 1].chain : 'GENESIS';
  if (head !== manifest.chain_head) problems.push('hash zinciri tutmuyor');

  let signature = 'yok';
  if (manifest.signature) {
    if (!publicKeyPem) {
      signature = 'doğrulanamadı (açık anahtar yok)';
      problems.push('imza var ama açık anahtar verilmedi');
    } else {
      try {
        const ok = crypto.verify(
          null,
          Buffer.from(manifest.signature.payload, 'utf8'),
          crypto.createPublicKey(publicKeyPem),
          Buffer.from(manifest.signature.value, 'base64'),
        );
        if (!ok) problems.push('imza geçersiz');
        signature = ok ? 'geçerli' : 'geçersiz';
      } catch {
        problems.push('imza doğrulanamadı');
        signature = 'hata';
      }
    }
  }

  return {
    ok: problems.length === 0,
    problems,
    session: manifest.session,
    files: (manifest.files ?? []).length,
    chainHead: manifest.chain_head,
    signature,
    generated_at: manifest.generated_at,
  };
}

#!/usr/bin/env node
// Board output guard (2026-10-27). Fails when a board build carries anything but the public
// Supabase URL + anon key.
//
//   node scripts/board-secret-guard.mjs [--source] <file-or-dir> [...]
//
// Fails on: an `sb_secret_` key, any JWT whose role is not `anon` (service_role etc.), any of
// the live board tokens (full-power ?k= links for ARCH, RISE, SwishDM), an env file, and (build
// output only) a file/folder name starting with "_" or "." (Jekyll-built Pages sites such as
// madebyarch.com silently drop those, so the board would 404 its own chunk).
// --source: checking a source tree (board-app/): skips node_modules and the dot-name rule.
// Used by scripts/build-board-app.sh for every target (so also by publish-board-host.sh) and by
// scripts/sync-board-app.sh.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// This repo is public, so the live board tokens are matched by SHA-256, never stored in clear.
// Tokens are 24 hex chars; every 24-char window of every hex run in a file is hashed.
const TOKEN_SHA256 = new Set([
  '0df777729b5f600ec3c005d3756d2ddc657e59afd1e3ad4c9f633626febd25d0',
  'd00367a8112b95adb4446542c5be92593f7ad2e4fb3fd1b9e0d6f3b999eb6a9a',
  '03a21f6d83afef5940133e4ecd9d36d27a8c1ae221216a5e91cdd46f93dd02c1',
]);
const TOKEN_LEN = 24;

const args = process.argv.slice(2);
const source = args[0] === '--source';
const targets = source ? args.slice(1) : args;
if (!targets.length) {
  console.error('usage: board-secret-guard.mjs [--source] <file-or-dir> [...]');
  process.exit(2);
}

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const bad = [];
let files = 0;
const check = (file) => {
  files++;
  const base = path.basename(file);
  if (/^\.env/.test(base) || /\.local$/.test(base)) bad.push(`${file}: env file`);
  const s = fs.readFileSync(file, 'latin1');
  if (s.includes('sb_secret_')) bad.push(`${file}: sb_secret_ key`);
  for (const m of s.matchAll(/[0-9a-fA-F]{24,}/g)) {
    const run = m[0].toLowerCase();
    for (let i = 0; i + TOKEN_LEN <= run.length; i++) {
      if (TOKEN_SHA256.has(sha(run.slice(i, i + TOKEN_LEN)))) { bad.push(`${file}: live board token`); break; }
    }
  }
  for (const m of s.matchAll(/eyJ[A-Za-z0-9_-]{10,}\.([A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]{10,}/g)) {
    let role = '?';
    try { role = JSON.parse(Buffer.from(m[1], 'base64url').toString()).role; } catch { /* not a JWT */ }
    if (role !== 'anon') bad.push(`${file}: jwt role ${role}`);
  }
};
const walk = (p, top) => {
  const name = path.basename(p);
  const st = fs.statSync(p);
  if (st.isDirectory()) {
    if (source && name === 'node_modules') return;
    if (!top && !source && /^[._]/.test(name)) bad.push(`${p}: name starts with "${name[0]}" (Jekyll drops it)`);
    for (const f of fs.readdirSync(p)) walk(path.join(p, f), false);
    return;
  }
  if (!top && !source && /^[._]/.test(name)) bad.push(`${p}: name starts with "${name[0]}" (Jekyll drops it)`);
  check(p);
};
for (const t of targets) {
  if (!fs.existsSync(t)) { console.error(`board guard: missing ${t}`); process.exit(1); }
  walk(t, true);
}
if (bad.length) {
  console.error('board guard: refusing\n  ' + bad.join('\n  '));
  process.exit(1);
}
console.log(`board guard: ${files} files clean (${targets.join(', ')})`);

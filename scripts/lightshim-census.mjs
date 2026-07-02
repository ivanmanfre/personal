// scripts/lightshim-census.mjs
// Finds dark-era Tailwind classes used in legacy dashboard panels that
// theme/light.css does not remap. Exit 1 when any are missing.
import fs from 'node:fs';
import path from 'node:path';

const PANEL_DIRS = ['components/dashboard', 'components/dashboard-v2/sections'];
const SHIM = fs.readFileSync('components/dashboard-v2/theme/light.css', 'utf8');

// Class families that are dark-theme-only and must be shimmed or absent.
// - Any chain of variant prefixes (hover:, disabled:, focus:, group-hover:, sm:hover:, ...)
//   is allowed and kept intact in the captured class.
// - `text-` utilities: tiers 200-950 (matches the acceptance list's text-emerald-400/70).
// - bg/ring/border/placeholder/from/to/shadow utilities: tiers 600-950 (matches bg-zinc-700/60).
const VARIANT_CHAIN = '(?:[a-z-]+:)*';
const COLOR_FAMILIES = '(?:zinc|neutral|slate|red|amber|sky|emerald|violet|indigo)';
const DARK_CLASS = new RegExp(
  `(?:^|[\\s"'\`])(${VARIANT_CHAIN}(?:text-${COLOR_FAMILIES}-[2-9]\\d\\d|(?:bg|ring|border|placeholder|from|to|shadow)-${COLOR_FAMILIES}-[6-9]\\d\\d)(?:\\/\\d+)?)(?=[\\s"'\`}])`,
  'g'
);

const used = new Map();
for (const dir of PANEL_DIRS) {
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.tsx')) continue;
    const p = path.join(dir, f);
    const lines = fs.readFileSync(p, 'utf8').split('\n');
    lines.forEach((line, i) => {
      for (const m of line.matchAll(DARK_CLASS)) {
        const cls = m[1];
        if (!used.has(cls)) used.set(cls, []);
        used.get(cls).push(`${p}:${i + 1}`);
      }
    });
  }
}

// A class is covered only if light.css contains it as an EXACT escaped selector
// token — not merely as a string prefix of a longer selector (e.g.
// `.hover\:bg-zinc-800` must not be satisfied by `.hover\:bg-zinc-800\/30:hover`).
const esc = (c) => c.replace(/\//g, '\\/').replace(/:/g, '\\:');
const isCoveredIn = (shimText, cls) => {
  const selector = `.${esc(cls)}`;
  let idx = shimText.indexOf(selector);
  while (idx !== -1) {
    const next = shimText[idx + selector.length];
    // The token continues (and thus doesn't match exactly) if the next char
    // extends the class name: alphanumeric/hyphen, or a backslash starting
    // another escaped segment (e.g. the `\/30` in `...zinc-800\/30:hover`).
    // A bare CSS terminator — space, comma, brace, or a `:pseudo-class` — is
    // a valid exact-match boundary.
    if (!next || !/[A-Za-z0-9\-\\]/.test(next)) return true;
    idx = shimText.indexOf(selector, idx + 1);
  }
  return false;
};
const isCovered = (cls) => isCoveredIn(SHIM, cls);

// Self-check (uses a synthetic shim snippet, independent of light.css's real
// content): a selector that only exists as a longer opacity variant must NOT
// satisfy the bare class as "covered".
if (isCoveredIn('.hover\\:bg-zinc-800\\/30:hover { color: red; }', 'hover:bg-zinc-800')) {
  throw new Error('lightshim-census self-check failed: hover:bg-zinc-800 wrongly reported covered');
}

const missing = [];
for (const [cls, files] of [...used.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  if (!isCovered(cls)) missing.push({ cls, files: files.slice(0, 4) });
}
console.log(JSON.stringify({ usedCount: used.size, missing }, null, 2));
process.exit(missing.length ? 1 : 0);

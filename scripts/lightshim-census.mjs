// scripts/lightshim-census.mjs
// Finds dark-era Tailwind classes used in legacy dashboard panels that
// theme/light.css does not remap. Exit 1 when any are missing.
import fs from 'node:fs';
import path from 'node:path';

const PANEL_DIRS = ['components/dashboard', 'components/dashboard-v2/sections'];
const SHIM = fs.readFileSync('components/dashboard-v2/theme/light.css', 'utf8');

// Class families that are dark-theme-only and must be shimmed or absent.
const DARK_CLASS = /(?:^|[\s"'`])((?:hover:)?(?:bg|text|ring|border|placeholder|from|to|shadow)-(?:zinc|neutral|slate|red|amber|sky|emerald|violet|indigo)-(?:[89]\d\d|950)(?:\/\d+)?)(?=[\s"'`}])/g;

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

// A class is covered if light.css mentions it as an escaped selector.
const esc = (c) => c.replace('/', '\\/').replace(':', '\\:');
const missing = [];
for (const [cls, files] of [...used.entries()].sort()) {
  if (!SHIM.includes(`.${esc(cls)}`)) missing.push({ cls, files: files.slice(0, 4) });
}
console.log(JSON.stringify({ usedCount: used.size, missing }, null, 2));
process.exit(missing.length ? 1 : 0);

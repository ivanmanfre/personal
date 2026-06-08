import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

export function parseFrontmatter(md) {
  const fm = md.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) return { name: null, description: null };
  const block = fm[1];
  const grab = (key) => {
    const m = block.match(new RegExp(`^${key}:\\s*["']?(.+?)["']?\\s*$`, 'm'));
    return m ? m[1].trim() : null;
  };
  return { name: grab('name'), description: grab('description') };
}
export function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
export function scanSkillDir(root, kind, group, file = 'SKILL.md') {
  if (!existsSync(root)) return [];
  const rows = [];
  for (const entry of readdirSync(root)) {
    const dir = join(root, entry);
    if (!statSync(dir).isDirectory()) continue;
    const md = join(dir, file);
    if (!existsSync(md)) continue;
    const { name, description } = parseFrontmatter(readFileSync(md, 'utf8'));
    rows.push({
      kind, slug: slugify(name || entry), name: name || entry,
      description, group, source_path: md, status: 'live',
    });
  }
  return rows;
}
export function deprecateMissing(fresh, dbSlugs) {
  const live = new Set(fresh.map((r) => `${r.kind}:${r.slug}`));
  return dbSlugs.filter((r) => !live.has(`${r.kind}:${r.slug}`));
}

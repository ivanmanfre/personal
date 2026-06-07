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

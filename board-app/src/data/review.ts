// What changed in a post after the client last reviewed it, and where each line note sits in that text.
import type { Comment, Model, Post } from './model';
import { diffBlocks, type Block } from './diff';

export const lineKey = (s: string) => s.replace(/\s+/g, ' ').trim().slice(0, 240);

export type Review = {
  /** The text as it read when it was reviewed. */
  base: string;
  /** When the text changed. */
  at?: string;
  blocks: Block[];
  added: number; removed: number; reworded: number;
};

const time = (s?: string | null) => { const t = s ? new Date(s).getTime() : NaN; return Number.isFinite(t) ? t : 0; };

/** Null when nothing changed since the review, or the post is already out. */
export function reviewOf(post: Post, body: string, m: Model): Review | null {
  if (post.status === 'live' || post.status === 'archived') return null;
  let base = post.reviewBase?.body;
  let at = post.reviewBase?.at;
  if (base == null) {
    // No stored review text: fall back to the change log, from the first edit after the client's first look.
    const seen = [post.approvedAt, ...m.comments.filter(c => c.ref === post.id).map(c => c.at)].map(time).filter(Boolean).sort((x, y) => x - y)[0];
    if (!seen) return null;
    const e = m.activity
      .filter(a => a.action === 'edit_copy' && a.ref === post.id && typeof a.before === 'string' && time(a.at) > seen)
      .sort((x, y) => time(x.at) - time(y.at))[0];
    if (!e) return null;
    base = e.before as string; at = e.at;
  }
  if (base.trim() === body.trim()) return null;
  const blocks = diffBlocks(base, body);
  const real = blocks.filter(b => b.text.trim());
  return {
    base, at, blocks,
    added: real.filter(b => b.kind === 'add').length,
    removed: real.filter(b => b.kind === 'del').length,
    reworded: real.filter(b => b.kind === 'change').length,
  };
}

/** `l<line>` for a paragraph in the text as it reads now, `d<baseLine>` for one that was removed. */
export type Pin = { n: number; key: string; block?: Block; index: number };

/** Numbered pins for the line notes on a post, in reading order. A note keeps its place when its line was
    reworded or removed, as long as the review text is known. Notes with no place get no pin. */
export function pinsOf(notes: Comment[], body: string, review: Review | null, isResolved: (c: Comment) => boolean): Map<string, Pin> {
  const lines = body.split('\n').map(lineKey);
  const baseLines = review ? review.base.split('\n').map(lineKey) : [];
  const found: { id: string; at: string; key: string; pos: number; block?: Block; index: number }[] = [];
  for (const c of notes) {
    if (!c.quote || c.parent) continue;
    const i = lines.indexOf(c.quote);
    if (i >= 0) {
      if (isResolved(c)) continue;
      const index = review ? review.blocks.findIndex(b => b.kind !== 'del' && b.line === i) : -1;
      found.push({ id: c.id, at: c.at, key: `l${i}`, pos: review && index >= 0 ? index : i, block: index >= 0 ? review!.blocks[index] : undefined, index });
      continue;
    }
    if (!review) continue;
    const j = baseLines.indexOf(c.quote);
    if (j < 0) continue;
    const index = review.blocks.findIndex(b => (b.kind === 'del' || b.kind === 'change') && b.baseLine === j);
    if (index < 0) continue;
    const b = review.blocks[index];
    found.push({ id: c.id, at: c.at, key: b.kind === 'del' ? `d${b.baseLine}` : `l${(b as { line: number }).line}`, pos: index, block: b, index });
  }
  found.sort((x, y) => x.pos - y.pos || x.at.localeCompare(y.at));
  return new Map(found.map((f, k) => [f.id, { n: k + 1, key: f.key, block: f.block, index: f.index }]));
}

export type Fix = { kind: 'reworded' | 'removed' | 'added'; blocks: Block[] };

/** What happened to a note's line once the text changed after the note was written. */
export function fixOf(pin: Pin | undefined, c: Comment, review: Review | null): Fix | null {
  if (!pin || !review || !pin.block) return null;
  if (review.at && time(review.at) < time(c.at)) return null;
  const b = pin.block;
  if (b.kind === 'change') return { kind: 'reworded', blocks: [b] };
  if (b.kind === 'del') return { kind: 'removed', blocks: [b] };
  // The line itself stands: show what was added straight after it. A line that ends in a colon opens a
  // list, so lines added anywhere in the list under it count too.
  const out: Block[] = [];
  const opens = /:\s*$/.test(b.text);
  let inList = false, listDone = !opens;
  for (let k = pin.index + 1; k < review.blocks.length; k++) {
    const x = review.blocks[k];
    if (!x.text.trim()) { if (inList) listDone = true; continue; }
    if (x.kind === 'add') { out.push(x); if (!listDone) inList = true; continue; }
    if (x.kind === 'same' && !listDone) { inList = true; continue; }
    break;
  }
  return out.length ? { kind: 'added', blocks: out } : null;
}

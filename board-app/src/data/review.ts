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

/** Who is not the client on a board action (matches tg_board_review_base). */
const OURS = /(ivan|operator|codex|claude|system|content team|inboundonsteroids)/i;

const time = (s?: string | null) => { const t = s ? new Date(s).getTime() : NaN; return Number.isFinite(t) ? t : 0; };

/** Null when nothing changed since the review, the post is already out, or the client approved it again
    after the change. The review text is stored on the draft by the database when a reviewed post is edited. */
export function reviewOf(post: Post, body: string, _m?: Model): Review | null {
  if (post.status === 'live' || post.status === 'archived') return null;
  const base = post.reviewBase?.body;
  const at = post.reviewBase?.at;
  if (base == null || base.trim() === body.trim()) return null;
  // The client approving again after the change closes the round. An approval Ivan or an operator gave on
  // the client's behalf does not: the client has still not seen this text. Same rule as the database.
  if (at && post.approvedAt && time(post.approvedAt) > time(at) && !OURS.test(post.approvedBy || '')) return null;
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
export type Pin = { n: number; key: string; block?: Block; index: number;
  /** The quoted sentence appears more than once, so the paragraph is a best guess: no claim about what changed. */
  loose?: boolean };

/** Numbered pins for the line notes on a post, in reading order. A note keeps its place when its line was
    reworded or removed, as long as the review text is known. Notes with no place get no pin. */
export function pinsOf(notes: Comment[], body: string, review: Review | null, isResolved: (c: Comment) => boolean): Map<string, Pin> {
  const lines = body.split('\n').map(lineKey);
  const baseLines = review ? review.base.split('\n').map(lineKey) : [];
  const found: { id: string; at: string; key: string; pos: number; block?: Block; index: number; loose?: boolean }[] = [];
  const count = (list: string[], q: string) => list.reduce((n, l) => n + (l === q ? 1 : 0), 0);
  // A paragraph of the reviewed text, followed through the change: where it is now, or that it was removed.
  const viaBase = (c: Comment) => {
    if (!review) return false;
    const j = baseLines.indexOf(c.quote!);
    // The same sentence twice in the reviewed text: which one the note was on is unknown, so nothing is inferred.
    if (j < 0 || count(baseLines, c.quote!) > 1) return false;
    const index = review.blocks.findIndex(b => b.kind !== 'add' && b.baseLine === j);
    if (index < 0) return false;
    const b = review.blocks[index];
    if (b.kind === 'same' && isResolved(c)) return true; // its line stands and the note is closed: no pin
    found.push({ id: c.id, at: c.at, key: b.kind === 'del' ? `d${b.baseLine}` : `l${(b as { line: number }).line}`, pos: index, block: b, index });
    return true;
  };
  const viaNow = (c: Comment) => {
    const i = lines.indexOf(c.quote!);
    if (i < 0) return false;
    if (isResolved(c)) return true;
    const index = review ? review.blocks.findIndex(b => b.kind !== 'del' && b.line === i) : -1;
    const loose = count(lines, c.quote!) > 1 || count(baseLines, c.quote!) > 1;
    found.push({ id: c.id, at: c.at, key: `l${i}`, pos: review && index >= 0 ? index : i, block: index >= 0 ? review!.blocks[index] : undefined, index, loose });
    return true;
  };
  for (const c of notes) {
    if (!c.quote || c.parent) continue;
    // A note written before the text changed quotes the reviewed text, so it is placed there first. That keeps
    // it on its own paragraph when the same sentence also appears elsewhere in the post.
    const before = !!review && (!review.at || time(c.at) <= time(review.at));
    if (before) { if (!viaBase(c)) viaNow(c); } else if (!viaNow(c)) viaBase(c);
  }
  found.sort((x, y) => x.pos - y.pos || x.at.localeCompare(y.at));
  return new Map(found.map((f, k) => [f.id, { n: k + 1, key: f.key, block: f.block, index: f.index, loose: f.loose }]));
}

export type Fix = { kind: 'reworded' | 'removed' | 'added'; blocks: Block[] };

/** What happened to a note's line once the text changed after the note was written. */
export function fixOf(pin: Pin | undefined, c: Comment, review: Review | null): Fix | null {
  if (!pin || !review || !pin.block || pin.loose) return null;
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

import React from 'react';
import { linkedInFold } from '../../lib/linkedinFold';

/**
 * Renders a LinkedIn-style post preview from raw text:
 *   - Paragraphs separated by blank lines, line breaks within a paragraph respected
 *   - URLs auto-linked
 *   - #hashtags styled emerald
 *   - @mentions styled emerald
 *   - Unicode-bold/italic letters preserved (LinkedIn-style emphasis tricks)
 *   - Fold rule drawn where the feed actually cuts (3 rendered lines, lib/linkedinFold),
 *     with everything behind "…see more" dimmed
 *
 * Used in Carousel + LM editors to give Ivan a preview of how the caption will
 * render before publishing — closes the raw-textarea gap.
 */

const URL_RE = /(\bhttps?:\/\/[^\s]+)/g;
const HASHTAG_RE = /(?:^|\s)(#[\p{L}\p{N}_-]+)/gu;
const MENTION_RE = /(?:^|\s)(@[\p{L}\p{N}_.-]+)/gu;

function tokenize(line: string): React.ReactNode[] {
  // Replace URLs/hashtags/mentions with markers, then split.
  // Simple approach: walk the string, find next match across all 3 regexes, emit.
  const out: React.ReactNode[] = [];
  let cursor = 0;
  const matches: { i: number; end: number; node: React.ReactNode }[] = [];
  let m: RegExpExecArray | null;

  const urlRe = new RegExp(URL_RE.source, 'g');
  while ((m = urlRe.exec(line))) {
    matches.push({
      i: m.index, end: m.index + m[0].length,
      node: <a key={`u-${m.index}`} href={m[0]} target="_blank" rel="noreferrer" className="text-emerald-400 hover:text-emerald-300 underline">{m[0]}</a>,
    });
  }
  const htagRe = new RegExp(HASHTAG_RE.source, 'gu');
  while ((m = htagRe.exec(line))) {
    const tag = m[1];
    const idx = m.index + m[0].indexOf(tag);
    matches.push({
      i: idx, end: idx + tag.length,
      node: <span key={`h-${idx}`} className="text-emerald-400">{tag}</span>,
    });
  }
  const mentionRe = new RegExp(MENTION_RE.source, 'gu');
  while ((m = mentionRe.exec(line))) {
    const tag = m[1];
    const idx = m.index + m[0].indexOf(tag);
    matches.push({
      i: idx, end: idx + tag.length,
      node: <span key={`m-${idx}`} className="text-emerald-400">{tag}</span>,
    });
  }
  matches.sort((a, b) => a.i - b.i);

  // Filter overlapping (URL beats hashtag/mention if collision)
  const used: { i: number; end: number; node: React.ReactNode }[] = [];
  for (const mm of matches) {
    if (used.some((u) => mm.i < u.end && mm.end > u.i)) continue;
    used.push(mm);
  }

  for (const u of used) {
    if (u.i > cursor) out.push(line.slice(cursor, u.i));
    out.push(u.node);
    cursor = u.end;
  }
  if (cursor < line.length) out.push(line.slice(cursor));
  return out;
}

const PostPreview: React.FC<{ text: string; showFold?: boolean }> = ({ text, showFold = true }) => {
  if (!text?.trim()) {
    return <div className="text-sm text-zinc-600 italic">Nothing to preview yet.</div>;
  }

  const { visible, hidden, folded } = linkedInFold(text);
  const drawFold = showFold && folded;

  // Split into paragraphs by double-newline; within paragraph, render single \n as <br>
  const paras = (chunk: string, keyPrefix: string, dim: boolean) =>
    chunk.replace(/\r\n/g, '\n').split(/\n\s*\n/).map((para, pi) => (
      <p key={`${keyPrefix}-${pi}`} className={dim ? 'whitespace-pre-wrap opacity-40' : 'whitespace-pre-wrap'}>
        {para.split('\n').map((line, li, arr) => (
          <React.Fragment key={li}>
            {tokenize(line)}
            {li < arr.length - 1 && <br />}
          </React.Fragment>
        ))}
      </p>
    ));

  return (
    <div className="text-[13.5px] text-zinc-200 leading-relaxed font-sans space-y-3">
      {paras(drawFold ? visible : text, 'v', false)}
      {drawFold && (
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-zinc-500 -my-1.5">
          <div className="flex-1 h-px bg-amber-700/40" />
          <span className="text-amber-500/80">…see more · {visible.length} chars above the fold</span>
          <div className="flex-1 h-px bg-amber-700/40" />
        </div>
      )}
      {drawFold && paras(hidden, 'h', true)}
    </div>
  );
};

export default PostPreview;

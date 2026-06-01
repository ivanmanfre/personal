import React from 'react';

/**
 * Renders a LinkedIn-style post preview from raw text:
 *   - Paragraphs separated by blank lines, line breaks within a paragraph respected
 *   - URLs auto-linked
 *   - #hashtags styled emerald
 *   - @mentions styled emerald
 *   - Unicode-bold/italic letters preserved (LinkedIn-style emphasis tricks)
 *   - Fold-line indicator at character 210 (LinkedIn feed truncation point)
 *
 * Used in Carousel + LM editors to give Ivan a preview of how the caption will
 * render before publishing — closes the raw-textarea gap.
 */

const URL_RE = /(\bhttps?:\/\/[^\s]+)/g;
const HASHTAG_RE = /(?:^|\s)(#[\p{L}\p{N}_-]+)/gu;
const MENTION_RE = /(?:^|\s)(@[\p{L}\p{N}_.-]+)/gu;
const FOLD_AT = 210;

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

  // Split into paragraphs by double-newline; within paragraph, render single \n as <br>
  const paragraphs = text.replace(/\r\n/g, '\n').split(/\n\s*\n/);

  // Find which paragraph contains the fold (210 chars in)
  let runningLen = 0;
  let foldParaIdx = -1;
  let foldOffset = -1;
  if (showFold && text.length > FOLD_AT) {
    for (let i = 0; i < paragraphs.length; i++) {
      const pLen = paragraphs[i].length + (i > 0 ? 2 : 0);
      if (runningLen + pLen >= FOLD_AT) {
        foldParaIdx = i;
        foldOffset = FOLD_AT - runningLen;
        break;
      }
      runningLen += pLen;
    }
  }

  return (
    <div className="text-[13.5px] text-zinc-200 leading-relaxed font-sans space-y-3">
      {paragraphs.map((para, pi) => (
        <p key={pi} className="whitespace-pre-wrap">
          {para.split('\n').map((line, li, arr) => (
            <React.Fragment key={li}>
              {tokenize(line)}
              {li < arr.length - 1 && <br />}
            </React.Fragment>
          ))}
        </p>
      ))}
      {showFold && foldParaIdx >= 0 && (
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-zinc-500 -my-1.5">
          <div className="flex-1 h-px bg-amber-700/40" />
          <span className="text-amber-500/80">…see more · LinkedIn truncates ~{FOLD_AT} chars</span>
          <div className="flex-1 h-px bg-amber-700/40" />
        </div>
      )}
    </div>
  );
};

export default PostPreview;

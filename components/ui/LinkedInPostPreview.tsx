import React, { useState } from 'react';
import { ThumbsUp, MessageSquare, Repeat2, Send, Globe, MoreHorizontal } from 'lucide-react';

/**
 * Pixel-accurate LinkedIn feed post preview. Renders the actual LinkedIn UI
 * around the caption text — profile header, "see more" fold, reaction strip,
 * action bar — so the editor preview reads like the published post will.
 *
 * Differences from a raw text preview:
 *   - White card with LinkedIn-blue accents
 *   - Avatar + name + headline + post timestamp + "Edited" badge
 *   - Caption rendered with LinkedIn's exact line-height + 14px size
 *   - Truncates at the 210-char fold with a real "…see more" button (toggles)
 *   - Inline media slot (carousel cover / single image)
 *   - Reaction count strip with the 👍 emoji + visible likes/comments counts
 *   - Like / Comment / Repost / Send action bar
 */

const URL_RE = /(\bhttps?:\/\/[^\s]+)/g;
const HASHTAG_RE = /(?:^|\s)(#[\p{L}\p{N}_-]+)/gu;
const MENTION_RE = /(?:^|\s)(@[\p{L}\p{N}_.-]+)/gu;
const FOLD_AT = 210;

function tokenize(line: string): React.ReactNode[] {
  const matches: { i: number; end: number; node: React.ReactNode }[] = [];
  let m: RegExpExecArray | null;
  const urlRe = new RegExp(URL_RE.source, 'g');
  while ((m = urlRe.exec(line))) {
    matches.push({ i: m.index, end: m.index + m[0].length,
      node: <a key={`u-${m.index}`} href={m[0]} target="_blank" rel="noreferrer" className="text-[#0a66c2] hover:underline">{m[0]}</a> });
  }
  const tagRe = new RegExp(HASHTAG_RE.source, 'gu');
  while ((m = tagRe.exec(line))) {
    const tag = m[1];
    const idx = m.index + m[0].indexOf(tag);
    matches.push({ i: idx, end: idx + tag.length,
      node: <span key={`h-${idx}`} className="text-[#0a66c2] font-semibold cursor-pointer">{tag}</span> });
  }
  const menRe = new RegExp(MENTION_RE.source, 'gu');
  while ((m = menRe.exec(line))) {
    const men = m[1];
    const idx = m.index + m[0].indexOf(men);
    matches.push({ i: idx, end: idx + men.length,
      node: <span key={`m-${idx}`} className="text-[#0a66c2] font-semibold cursor-pointer">{men}</span> });
  }
  matches.sort((a, b) => a.i - b.i);
  const out: React.ReactNode[] = [];
  let cursor = 0;
  for (const m of matches) {
    if (m.i < cursor) continue;
    if (m.i > cursor) out.push(line.slice(cursor, m.i));
    out.push(m.node);
    cursor = m.end;
  }
  if (cursor < line.length) out.push(line.slice(cursor));
  return out;
}

interface Props {
  text: string;
  /** Display name. Default 'Iván Manfredi'. */
  author?: string;
  /** Sub-title (job line). */
  headline?: string;
  /** Avatar image url. */
  avatarUrl?: string;
  /** Optional preview media (image URL). For carousel, pass slide-1 thumbnail. */
  mediaUrl?: string | null;
  /** When false, don't show the LinkedIn truncation fold. */
  showFold?: boolean;
  /** Optional fake stats to demo the strip. */
  stats?: { reactions?: number; comments?: number };
  /** When true, renders a smaller condensed card suitable for a 2-column grid. */
  compact?: boolean;
}

const LinkedInPostPreview: React.FC<Props> = ({
  text,
  author = 'Iván Manfredi',
  headline = 'Agent-Ready Ops · AI systems for $1-10M service firms',
  avatarUrl = '/ivan-portrait.jpg',
  mediaUrl,
  showFold = true,
  stats,
  compact = false,
}) => {
  const [expanded, setExpanded] = useState(false);
  // Compact cards are always clamped via CSS — skip the JS fold logic.
  const truncate = !compact && showFold && text.length > FOLD_AT && !expanded;
  const visibleText = truncate ? text.slice(0, FOLD_AT).trimEnd() : text;
  const paragraphs = visibleText.replace(/\r\n/g, '\n').split(/\n\s*\n/);
  const reactionCount = stats?.reactions ?? Math.max(48, Math.floor(text.length / 22));
  const commentCount = stats?.comments ?? Math.max(3, Math.floor(text.length / 180));

  if (compact) {
    return (
      <div className="rounded-lg bg-white text-[#1d2226] shadow-sm border border-[#dce6f1] overflow-hidden font-sans w-full">
        {/* Compact header */}
        <div className="flex items-start gap-2 px-3 py-2">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={author}
              className="w-9 h-9 rounded-full object-cover bg-zinc-200 shrink-0"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-zinc-200 shrink-0" aria-hidden />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold leading-tight text-[#0a66c2] truncate">{author}</div>
            <div className="text-[11px] text-[#666] leading-tight mt-0.5 truncate">{headline}</div>
          </div>
        </div>

        {/* Compact caption — clamped to 6 lines */}
        <div className="px-3 pb-2">
          <div
            className="text-[13px] text-[#1d2226] leading-snug"
            style={{ display: '-webkit-box', WebkitLineClamp: 6, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
          >
            {paragraphs.map((para, pi) => (
              <p key={pi} className={pi > 0 ? 'mt-2' : ''}>
                {para.split('\n').map((line, li, arr) => (
                  <React.Fragment key={li}>
                    {tokenize(line)}
                    {li < arr.length - 1 && <br />}
                  </React.Fragment>
                ))}
              </p>
            ))}
          </div>
        </div>

        {/* Compact reaction strip */}
        <div className="px-3 pt-1 pb-1.5 text-[11px] text-[#666] flex items-center gap-1 border-t border-[#dce6f1]">
          <span className="inline-flex -space-x-1">
            <span className="w-3.5 h-3.5 rounded-full bg-[#0a66c2] flex items-center justify-center ring-1 ring-white text-white text-[8px]">👍</span>
          </span>
          <span className="ml-1">{reactionCount.toLocaleString()}</span>
          <span className="ml-auto">{commentCount} comments</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-white text-[#1d2226] shadow-sm border border-[#dce6f1] overflow-hidden font-sans w-full max-w-[552px] mx-auto">
      {/* Header */}
      <div className="flex items-start gap-2 px-4 py-3">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={author}
            className="w-12 h-12 rounded-full object-cover bg-zinc-200 shrink-0"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-zinc-200 shrink-0" aria-hidden />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-semibold leading-tight text-[#0a66c2] hover:underline cursor-pointer truncate">{author}</div>
          <div className="text-[12px] text-[#666] leading-tight mt-0.5 truncate">{headline}</div>
          <div className="text-[12px] text-[#666] leading-tight mt-0.5 flex items-center gap-1">
            <span>1d</span>
            <span>·</span>
            <span>Edited</span>
            <span>·</span>
            <Globe className="w-3 h-3 inline-block" />
          </div>
        </div>
        <button className="p-1.5 rounded-full hover:bg-[#f3f2ef] text-[#666] transition-colors">
          <MoreHorizontal className="w-5 h-5" />
        </button>
      </div>

      {/* Caption */}
      <div className="px-4 pb-3">
        <div className="text-[14px] text-[#1d2226] leading-[1.4] whitespace-pre-wrap">
          {paragraphs.map((para, pi) => (
            <p key={pi} className={pi > 0 ? 'mt-3' : ''}>
              {para.split('\n').map((line, li, arr) => (
                <React.Fragment key={li}>
                  {tokenize(line)}
                  {li < arr.length - 1 && <br />}
                </React.Fragment>
              ))}
            </p>
          ))}
          {truncate && (
            <>
              <span className="text-[#666]">…</span>
              <button
                onClick={() => setExpanded(true)}
                className="ml-1 text-[#666] font-semibold hover:text-[#0a66c2] hover:underline"
              >
                see more
              </button>
            </>
          )}
        </div>
      </div>

      {/* Media slot */}
      {mediaUrl && (
        <div className="border-y border-[#dce6f1] bg-[#f9fafb]">
          <img src={mediaUrl} alt="Post media" className="w-full max-h-[480px] object-contain" loading="lazy" />
        </div>
      )}

      {/* Reaction count strip */}
      <div className="px-4 pt-3 pb-2 text-[12px] text-[#666] flex items-center gap-1">
        <span className="inline-flex -space-x-1">
          <span className="w-4 h-4 rounded-full bg-[#0a66c2] flex items-center justify-center ring-1 ring-white text-white text-[9px]">👍</span>
          <span className="w-4 h-4 rounded-full bg-[#df704d] flex items-center justify-center ring-1 ring-white text-white text-[9px]">❤</span>
          <span className="w-4 h-4 rounded-full bg-[#6dae4f] flex items-center justify-center ring-1 ring-white text-white text-[9px]">💡</span>
        </span>
        <span className="ml-1">{reactionCount.toLocaleString()}</span>
        <span className="ml-auto">{commentCount} comments</span>
      </div>

      {/* Action bar */}
      <div className="border-t border-[#dce6f1] px-2 py-1 flex items-center justify-around">
        {[
          { icon: ThumbsUp, label: 'Like' },
          { icon: MessageSquare, label: 'Comment' },
          { icon: Repeat2, label: 'Repost' },
          { icon: Send, label: 'Send' },
        ].map((a) => (
          <button
            key={a.label}
            className="flex items-center gap-1.5 px-3 py-2 rounded text-[#666] hover:bg-[#f3f2ef] transition-colors text-[13px] font-semibold"
          >
            <a.icon className="w-5 h-5" />
            <span>{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default LinkedInPostPreview;

import React, { useState } from 'react';
import { ThumbsUp, MessageSquare, Repeat2, Send, Globe, MoreHorizontal, ChevronLeft, ChevronRight } from 'lucide-react';
import { avatarInitials } from './LinkedInPostPreview';

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
  for (const match of matches) {
    if (match.i < cursor) continue;
    if (match.i > cursor) out.push(line.slice(cursor, match.i));
    out.push(match.node);
    cursor = match.end;
  }
  if (cursor < line.length) out.push(line.slice(cursor));
  return out;
}

interface Props {
  text: string;
  slides: string[];
  /** Text-slide cards (heading + body). When present, the media area renders styled text
   *  slides instead of images — used for carousels the builder drafts as copy, not artwork. */
  textSlides?: { heading: string; body: string }[];
  author?: string;
  headline?: string;
  avatarUrl?: string;
  /** Prospect brand, mirrored onto text-slide carousels so they read as the founder's own. */
  accentHex?: string;
  brandName?: string;
  showFold?: boolean;
  stats?: { reactions?: number; comments?: number };
}

/**
 * LinkedIn post card with a swipeable carousel media area.
 * Identical chrome to LinkedInPostPreview (header + caption + reaction strip + action bar),
 * but the media slot renders one slide at a time with prev/next chevron overlays and page dots.
 */
const LinkedInCarouselCard: React.FC<Props> = ({
  text,
  slides,
  textSlides,
  author = 'Iván Manfredi',
  headline = 'AI content systems for agencies',
  avatarUrl = '/ivan-portrait.jpg',
  accentHex,
  brandName,
  showFold = true,
  stats,
}) => {
  const [index, setIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const accent = accentHex && /^#?[0-9a-fA-F]{6}$/.test(accentHex) ? (accentHex[0] === '#' ? accentHex : '#' + accentHex) : '#0a66c2';

  const hasTextSlides = Array.isArray(textSlides) && textSlides.length > 0;
  const total = hasTextSlides ? textSlides!.length : slides.length;
  const clampedIndex = Math.min(index, Math.max(0, total - 1));
  const truncate = showFold && text.length > FOLD_AT && !expanded;
  const visibleText = truncate ? text.slice(0, FOLD_AT).trimEnd() : text;
  const paragraphs = visibleText.replace(/\r\n/g, '\n').split(/\n\s*\n/);
  const reactionCount = stats?.reactions ?? Math.max(48, Math.floor(text.length / 22));
  const commentCount = stats?.comments ?? Math.max(3, Math.floor(text.length / 180));

  const prev = () => setIndex((i) => Math.max(0, i - 1));
  const next = () => setIndex((i) => Math.min(total - 1, i + 1));

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
          <div className="w-12 h-12 rounded-full bg-[#e3ebf3] text-[#0a66c2] shrink-0 flex items-center justify-center text-[15px] font-semibold" aria-hidden>{avatarInitials(author)}</div>
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

      {/* Carousel media area */}
      {total > 0 && (
        <div className="border-y border-[#dce6f1] bg-[#f0f2f5] relative">
          {/* Slide media — 4:5 portrait aspect. Text carousels render styled copy cards. */}
          <div className="relative w-full" style={{ aspectRatio: '4 / 5' }}>
            {hasTextSlides ? (
              <div className="absolute inset-0 flex flex-col justify-center p-6 sm:p-8 pb-14" style={{ background: 'linear-gradient(150deg,#1d2733 0%,#0f1620 100%)' }}>
                <span aria-hidden style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, background: accent }} />
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: accent }}>
                  {clampedIndex + 1} / {total}
                </div>
                <h4 className="mt-3 text-white font-bold leading-[1.15]" style={{ fontSize: 'clamp(1.15rem, 5vw, 1.6rem)' }}>
                  {textSlides![clampedIndex].heading}
                </h4>
                <p className="mt-3 text-white/80 leading-[1.5]" style={{ fontSize: 'clamp(0.85rem, 3.4vw, 1rem)' }}>
                  {textSlides![clampedIndex].body}
                </p>
                <div className="absolute left-6 sm:left-8 bottom-4 flex items-center gap-2">
                  <span aria-hidden style={{ width: 8, height: 8, background: accent, display: 'inline-block' }} />
                  <span className="text-white/85 font-semibold" style={{ fontSize: 12, letterSpacing: '-0.01em' }}>{brandName || author}</span>
                </div>
              </div>
            ) : (
              <img
                src={slides[clampedIndex]}
                alt={`Slide ${clampedIndex + 1} of ${total}`}
                className="absolute inset-0 w-full h-full object-contain"
                loading="lazy"
              />
            )}

            {/* Slide counter badge */}
            <div className="absolute top-2 right-2 bg-black/50 text-white text-[11px] font-semibold px-2 py-0.5 rounded-full backdrop-blur-sm">
              {clampedIndex + 1} / {total}
            </div>

            {/* Left arrow */}
            {clampedIndex > 0 && (
              <button
                onClick={prev}
                aria-label="Previous slide"
                className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 shadow-md flex items-center justify-center text-[#1d2226] hover:bg-white transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}

            {/* Right arrow */}
            {clampedIndex < total - 1 && (
              <button
                onClick={next}
                aria-label="Next slide"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 shadow-md flex items-center justify-center text-[#1d2226] hover:bg-white transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Page dots */}
          {total > 1 && (
            <div className="flex items-center justify-center gap-1.5 py-2">
              {Array.from({ length: total }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIndex(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  className={`rounded-full transition-all ${
                    i === clampedIndex ? 'w-2 h-2' : 'w-1.5 h-1.5 bg-[#b0b8c1] hover:bg-[#666]'
                  }`}
                  style={i === clampedIndex ? { background: accent } : undefined}
                />
              ))}
            </div>
          )}
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

export default LinkedInCarouselCard;

import React, { useState } from 'react';
import { ThumbsUp, MessageSquare, Repeat2, Send, Globe, MoreHorizontal } from 'lucide-react';
import type { BrandKitSpec, ImageCardSpec } from '../../lib/linkedinFeedSpec';
import { useGoogleFonts } from '../../hooks/useGoogleFonts';

/** First letters of the first two words, for the no-photo avatar fallback. */
export function avatarInitials(name?: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '·';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}

/** LinkedIn's fold, cut at a word boundary — never mid-word. Falls back to the raw cut
 *  only when the visible window contains no space at all (one giant token). */
export function foldAtWordBoundary(text: string, at: number): string {
  const raw = text.slice(0, at);
  const lastSpace = Math.max(raw.lastIndexOf(' '), raw.lastIndexOf('\n'));
  return (lastSpace > at * 0.6 ? raw.slice(0, lastSpace) : raw).trimEnd();
}

/** Normalize a hex to #rrggbb, or undefined when invalid. */
export function safeHex(h?: string): string | undefined {
  if (!h || !/^#?[0-9a-fA-F]{6}$/.test(h)) return undefined;
  return h[0] === '#' ? h : '#' + h;
}

/** Dark vs light ink for a given surface, so brand cards stay legible on any color. */
export function inkOnSurface(hex?: string): string {
  const h = (hex || '').replace(/[^0-9a-fA-F]/g, '');
  if (h.length !== 6) return '#16181B';
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.55 ? '#16181B' : '#FFFFFF';
}

/** CSS family stack with the prospect font first and a safe fallback always present. */
export function familyStack(fam?: string, fallback = 'system-ui, -apple-system, sans-serif'): string {
  const first = (fam || '').split(',')[0].replace(/["']/g, '').trim();
  return first ? `'${first}', ${fallback}` : fallback;
}

/** The designed media card for image posts: the prospect's brand surface, kicker,
 *  headline in their heading font, an optional dominant figure, sub line and logo chip.
 *  1200x1500 proportion (4:5), flat surfaces only. `captionFirstLine` lets the card
 *  defensively hide its sub when the generator duplicated the caption opener. */
export const BrandImageCard: React.FC<{ card: ImageCardSpec; brand?: BrandKitSpec; companyName?: string; captionFirstLine?: string }> = ({ card, brand, companyName, captionFirstLine }) => {
  useGoogleFonts([brand?.font_heading, brand?.font_body]);
  const surface = safeHex(brand?.surface_hex) ?? (brand?.is_dark ? (safeHex(brand?.ink_hex) ?? '#15181C') : '#FFFFFF');
  const ink = inkOnSurface(surface);
  const sub = ink === '#FFFFFF' ? 'rgba(255,255,255,0.72)' : 'rgba(22,24,27,0.68)';
  const hair = ink === '#FFFFFF' ? 'rgba(255,255,255,0.18)' : 'rgba(22,24,27,0.14)';
  const accent = safeHex(brand?.accent_hex) ?? '#0a66c2';
  const headingFont = familyStack(brand?.font_heading);
  const bodyFont = familyStack(brand?.font_body);
  const norm = (t?: string) => (t || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
  const showSub = Boolean(card.sub) && norm(card.sub) !== norm(captionFirstLine);
  const wordmark = companyName || '';
  return (
    <div className="relative w-full overflow-hidden" style={{ aspectRatio: '4 / 5', background: surface }}>
      <div className="absolute inset-0 flex flex-col justify-center" style={{ padding: 'clamp(24px, 8%, 56px)' }}>
        {card.kicker && (
          <div style={{ fontFamily: bodyFont, fontSize: 'clamp(10px, 2.6vw, 13px)', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: accent }}>
            {card.kicker}
          </div>
        )}
        <span aria-hidden style={{ display: 'block', width: 34, height: 3, background: accent, marginTop: card.kicker ? 12 : 0 }} />
        {card.figure && (
          <div style={{ fontFamily: headingFont, fontWeight: 800, fontSize: 'clamp(2.6rem, 14vw, 5rem)', lineHeight: 0.95, letterSpacing: '-0.02em', color: ink, marginTop: 18 }}>
            {card.figure}
          </div>
        )}
        <h4 style={{ fontFamily: headingFont, fontWeight: 800, fontSize: card.figure ? 'clamp(1.1rem, 4.6vw, 1.7rem)' : 'clamp(1.4rem, 6.4vw, 2.4rem)', lineHeight: 1.12, letterSpacing: '-0.015em', color: ink, marginTop: card.figure ? 14 : 18 }}>
          {card.headline}
        </h4>
        {showSub && (
          <p style={{ fontFamily: bodyFont, fontSize: 'clamp(0.85rem, 3.2vw, 1.05rem)', lineHeight: 1.45, color: sub, marginTop: 12, maxWidth: '38ch' }}>
            {card.sub}
          </p>
        )}
      </div>
      {/* logo chip — the prospect's mark; falls back to their name as a wordmark */}
      {(brand?.logo_url || wordmark) && (
        <div className="absolute flex items-center gap-2" style={{ left: 'clamp(24px, 8%, 56px)', bottom: 'clamp(18px, 6%, 40px)', borderTop: `1px solid ${hair}`, paddingTop: 10, right: 'clamp(24px, 8%, 56px)' }}>
          {brand?.logo_url ? (
            <img src={brand.logo_url} alt={wordmark || 'logo'} style={{ height: 22, width: 'auto', maxWidth: 150, objectFit: 'contain', display: 'block' }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
          ) : null}
          {wordmark && (
            <span style={{ fontFamily: headingFont, fontWeight: 700, fontSize: 13, letterSpacing: '-0.01em', color: ink }}>{wordmark}</span>
          )}
        </div>
      )}
    </div>
  );
};

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
  /** Optional video URL. When set, the media slot renders a player (cover = poster). */
  videoUrl?: string | null;
  /** Designed brand media card (scan image posts). Takes the media slot over mediaUrl;
   *  existing call sites that don't pass it render exactly as before. */
  imageCard?: ImageCardSpec | null;
  /** Prospect brand kit for the imageCard (surface, fonts, accent, logo). */
  brand?: BrandKitSpec | null;
  /** Company name — the imageCard's wordmark fallback when there's no logo. */
  companyName?: string;
  /** When false, don't show the LinkedIn truncation fold. */
  showFold?: boolean;
  /** Optional fake stats to demo the strip. */
  stats?: { reactions?: number; comments?: number };
  /** When true, renders a smaller condensed card suitable for a 2-column grid. */
  compact?: boolean;
  /** Compact caption clamp, in lines. Default 6. */
  clampLines?: number;
  /** Replaces the "1d · Edited" timestamp with a neutral marker (e.g. "Preview") —
   *  for future/example posts that were never actually published. */
  timeLabel?: string;
}

const LinkedInPostPreview: React.FC<Props> = ({
  text,
  author = 'Iván Manfredi',
  headline = 'AI content systems for agencies',
  avatarUrl = '/ivan-portrait.jpg',
  mediaUrl,
  videoUrl,
  imageCard,
  brand,
  companyName,
  showFold = true,
  stats,
  compact = false,
  clampLines = 6,
  timeLabel,
}) => {
  const [expanded, setExpanded] = useState(false);
  // Compact cards are always clamped via CSS — skip the JS fold logic.
  const truncate = !compact && showFold && text.length > FOLD_AT && !expanded;
  const visibleText = truncate ? foldAtWordBoundary(text, FOLD_AT) : text;
  const paragraphs = visibleText.replace(/\r\n/g, '\n').split(/\n\s*\n/);
  const reactionCount = stats?.reactions ?? Math.max(48, Math.floor(text.length / 22));
  const commentCount = stats?.comments ?? Math.max(3, Math.floor(text.length / 180));

  if (compact) {
    return (
      <div className="rounded-lg bg-white text-[#1d2226] shadow-sm border border-[#dce6f1] overflow-hidden font-sans w-full" style={{ fontFamily: '-apple-system, "Segoe UI", "Helvetica Neue", Roboto, Arial, sans-serif' }}>
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
            <div className="w-9 h-9 rounded-full bg-[#e3ebf3] text-[#0a66c2] shrink-0 flex items-center justify-center text-[12px] font-semibold" aria-hidden>{avatarInitials(author)}</div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold leading-tight text-[#0a66c2] truncate">{author}</div>
            <div className="text-[11px] text-[#666] leading-tight mt-0.5 truncate">{headline}</div>
          </div>
        </div>

        {/* Compact caption — clamped to 6 lines */}
        <div className="px-3 pb-2">
          <div
            className="text-[14px] text-[#1d2226] leading-normal"
            style={{ display: '-webkit-box', WebkitLineClamp: clampLines, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
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

        {/* Compact media thumb — existing call sites pass mediaUrl={null}, unchanged */}
        {mediaUrl && (
          <img
            src={mediaUrl}
            alt=""
            loading="lazy"
            className="w-full object-cover"
            style={{ maxHeight: 132, objectPosition: 'top', borderTop: '1px solid #dce6f1' }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        )}

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
    <div className="rounded-lg bg-white text-[#1d2226] shadow-sm border border-[#dce6f1] overflow-hidden font-sans w-full max-w-[552px] mx-auto" style={{ fontFamily: '-apple-system, "Segoe UI", "Helvetica Neue", Roboto, Arial, sans-serif' }}>
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
            {timeLabel ? (
              <span>{timeLabel}</span>
            ) : (
              <>
                <span>1d</span>
                <span>·</span>
                <span>Edited</span>
              </>
            )}
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

      {/* Media slot — video player, else the designed brand card, else image */}
      {videoUrl ? (
        <div className="border-y border-[#dce6f1] bg-black">
          <video
            src={videoUrl}
            poster={mediaUrl || undefined}
            controls
            playsInline
            className="w-full max-h-[480px] object-contain bg-black"
          />
        </div>
      ) : imageCard?.headline ? (
        <div className="border-y border-[#dce6f1]">
          <BrandImageCard card={imageCard} brand={brand || undefined} companyName={companyName} captionFirstLine={(text || '').split('\n')[0]} />
        </div>
      ) : mediaUrl ? (
        <div className="border-y border-[#dce6f1] bg-[#f9fafb]">
          <img src={mediaUrl} alt="Post media" className="w-full max-h-[480px] object-contain" loading="lazy" />
        </div>
      ) : null}

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
            aria-label={a.label}
            className="flex flex-1 min-w-0 items-center justify-center gap-1 px-1 py-2 rounded text-[#666] hover:bg-[#f3f2ef] transition-colors text-[12px] font-semibold sm:flex-none sm:gap-1.5 sm:px-3 sm:text-[13px]"
          >
            <a.icon className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
            {/* Cramped widths drop the label entirely (icon-only) — never "Com…". */}
            <span className="hidden min-[420px]:inline whitespace-nowrap">{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default LinkedInPostPreview;

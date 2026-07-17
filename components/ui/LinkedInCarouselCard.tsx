import React, { useState } from 'react';
import { ThumbsUp, MessageSquare, Repeat2, Send, Globe, MoreHorizontal, ChevronLeft, ChevronRight } from 'lucide-react';
import { avatarInitials, foldAtWordBoundary, safeHex, inkOnSurface, familyStack } from './LinkedInPostPreview';
import type { BrandKitSpec, TextSlideSpec } from '../../lib/linkedinFeedSpec';
import { useGoogleFonts } from '../../hooks/useGoogleFonts';

/** WCAG relative luminance of a #rrggbb color. */
function relLuminance(hex: string): number {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two #rrggbb colors (1..21). */
function contrastRatio(a: string, b: string): number {
  const la = relLuminance(a);
  const lb = relLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

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
  /** Text-slide cards (heading + body[, role/kicker/figure]). When present, the media area
   *  renders styled text slides instead of images — carousels drafted as copy, not artwork. */
  textSlides?: TextSlideSpec[];
  author?: string;
  headline?: string;
  avatarUrl?: string;
  /** Prospect brand accent, mirrored onto text-slide carousels (legacy single-value prop). */
  accentHex?: string;
  brandName?: string;
  /** FULL prospect brand kit (fonts, surface, logo, secondary accents). Supersedes
   *  accentHex when present; existing call sites without it render as before. */
  brand?: BrandKitSpec | null;
  /** Company name — wordmark fallback on cover/action slides when there's no logo. */
  companyName?: string;
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
  brand,
  companyName,
  showFold = true,
  stats,
}) => {
  const [index, setIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  // Prospect brand tokens — the brand kit governs INSIDE the media area (the platform-
  // artifact exception: LinkedIn chrome stays LinkedIn; the slides are the prospect's).
  useGoogleFonts([brand?.font_heading, brand?.font_body]);
  const accent = safeHex(brand?.accent_hex) ?? safeHex(accentHex) ?? '#0a66c2';
  const surface = safeHex(brand?.surface_hex) ?? (brand?.is_dark ? (safeHex(brand?.ink_hex) ?? '#15181C') : '#FFFFFF');
  const slideInk = inkOnSurface(surface);
  // Contrast guard: brand accents must actually read on the brand surface (a #0000ee
  // kicker on near-black fails). Below 3:1 the secondary falls back to the primary
  // accent, and if that fails too, to the slide ink.
  const legible = (c: string) => contrastRatio(c, surface) >= 3;
  const safeAccent = legible(accent) ? accent : slideInk;
  const rawAccent2 = safeHex(brand?.accent2) ?? safeHex(brand?.accent_secondary) ?? accent;
  const accent2 = legible(rawAccent2) ? rawAccent2 : safeAccent;
  const slideSub = slideInk === '#FFFFFF' ? 'rgba(255,255,255,0.74)' : 'rgba(22,24,27,0.68)';
  const slideHair = slideInk === '#FFFFFF' ? 'rgba(255,255,255,0.18)' : 'rgba(22,24,27,0.14)';
  const headingFont = familyStack(brand?.font_heading);
  const bodyFont = familyStack(brand?.font_body);
  const wordmark = companyName || brandName || author;

  const hasTextSlides = Array.isArray(textSlides) && textSlides.length > 0;
  const total = hasTextSlides ? textSlides!.length : slides.length;
  const clampedIndex = Math.min(index, Math.max(0, total - 1));
  const truncate = showFold && text.length > FOLD_AT && !expanded;
  const visibleText = truncate ? foldAtWordBoundary(text, FOLD_AT) : text;
  const paragraphs = visibleText.replace(/\r\n/g, '\n').split(/\n\s*\n/);
  const reactionCount = stats?.reactions ?? Math.max(48, Math.floor(text.length / 22));
  const commentCount = stats?.comments ?? Math.max(3, Math.floor(text.length / 180));

  const prev = () => setIndex((i) => Math.max(0, i - 1));
  const next = () => setIndex((i) => Math.min(total - 1, i + 1));

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
          {/* Slide media — 4:5 portrait aspect. Text carousels render designed brand slides.
              Content is inset 48px horizontally so the chevron overlays never sit on text. */}
          <div className="relative w-full" style={{ aspectRatio: '4 / 5' }}>
            {hasTextSlides ? (() => {
              const slide = textSlides![clampedIndex];
              const role: NonNullable<TextSlideSpec['role']> = slide.role
                ?? (clampedIndex === 0 ? 'cover' : clampedIndex === total - 1 ? 'action' : 'point');
              const pad = 'clamp(44px, 12%, 64px)';
              // Logo OR wordmark text — never both. The text is only the onError fallback.
              const LogoChip = ({ size = 22 }: { size?: number }) => (
                <span className="flex items-center gap-2 min-w-0">
                  {brand?.logo_url && !logoFailed ? (
                    <img src={brand.logo_url} alt={wordmark || 'logo'} style={{ height: size, width: 'auto', maxWidth: 140, objectFit: 'contain', display: 'block' }} onError={() => setLogoFailed(true)} />
                  ) : (
                    <span className="truncate" style={{ fontFamily: headingFont, fontWeight: 700, fontSize: 13, letterSpacing: '-0.01em', color: slideInk }}>{wordmark}</span>
                  )}
                </span>
              );
              if (role === 'cover') {
                return (
                  <div className="absolute inset-0 flex flex-col justify-center" style={{ background: surface, padding: `28px ${pad} 56px` }}>
                    <div style={{ fontFamily: bodyFont, fontWeight: 700, fontSize: 'clamp(11px, 2.8vw, 14px)', letterSpacing: '0.16em', textTransform: 'uppercase', color: accent2 }}>
                      {slide.kicker || headline}
                    </div>
                    <span aria-hidden style={{ display: 'block', width: 44, height: 4, background: safeAccent, marginTop: 14 }} />
                    <h4 style={{ fontFamily: headingFont, fontWeight: 800, fontSize: 'clamp(2.1rem, 8.5vw, 3.4rem)', lineHeight: 1.06, letterSpacing: '-0.02em', color: slideInk, marginTop: 20 }}>
                      {slide.heading}
                    </h4>
                    {slide.body && (
                      <p style={{ fontFamily: bodyFont, fontSize: 'clamp(1.05rem, 4.2vw, 1.4rem)', lineHeight: 1.55, color: slideSub, marginTop: 18, maxWidth: '30ch' }}>{slide.body}</p>
                    )}
                    <div className="absolute flex items-center" style={{ left: pad, right: pad, bottom: 20, borderTop: `1px solid ${slideHair}`, paddingTop: 10 }}>
                      <LogoChip />
                    </div>
                  </div>
                );
              }
              if (role === 'action') {
                return (
                  <div className="absolute inset-0 flex flex-col justify-center" style={{ background: surface, padding: `28px ${pad} 56px` }}>
                    {slide.kicker && (
                      <div style={{ fontFamily: bodyFont, fontWeight: 700, fontSize: 'clamp(11px, 2.8vw, 14px)', letterSpacing: '0.16em', textTransform: 'uppercase', color: accent2 }}>{slide.kicker}</div>
                    )}
                    <h4 style={{ fontFamily: headingFont, fontWeight: 800, fontSize: 'clamp(2rem, 8vw, 3.2rem)', lineHeight: 1.08, letterSpacing: '-0.018em', color: slideInk, marginTop: slide.kicker ? 16 : 0 }}>
                      {slide.heading}
                    </h4>
                    {slide.body && (
                      <p style={{ fontFamily: bodyFont, fontSize: 'clamp(1.1rem, 4.5vw, 1.5rem)', lineHeight: 1.6, color: slideSub, marginTop: 20, maxWidth: '30ch' }}>{slide.body}</p>
                    )}
                    <span aria-hidden style={{ display: 'block', width: 44, height: 4, background: safeAccent, marginTop: 22 }} />
                    <div className="flex items-center" style={{ marginTop: 14 }}>
                      <LogoChip size={24} />
                    </div>
                  </div>
                );
              }
              // point / proof
              const isProof = role === 'proof' || (role === 'point' && Boolean(slide.figure));
              return (
                <div className="absolute inset-0 flex flex-col justify-center" style={{ background: surface, padding: `28px ${pad} 56px` }}>
                  <div style={{ fontFamily: bodyFont, fontWeight: 700, fontSize: 'clamp(11px, 2.8vw, 14px)', letterSpacing: '0.16em', textTransform: 'uppercase', color: accent2 }}>
                    {slide.kicker || `${clampedIndex + 1} / ${total}`}
                  </div>
                  {isProof && slide.figure && (
                    <div style={{ fontFamily: headingFont, fontWeight: 800, fontSize: 'clamp(3.2rem, 16vw, 5.6rem)', lineHeight: 0.95, letterSpacing: '-0.02em', color: safeAccent, marginTop: 16 }}>
                      {slide.figure}
                    </div>
                  )}
                  <h4 style={{ fontFamily: headingFont, fontWeight: 800, fontSize: isProof ? 'clamp(1.6rem, 6vw, 2.4rem)' : 'clamp(2.1rem, 8vw, 3.4rem)', lineHeight: 1.1, letterSpacing: '-0.015em', color: slideInk, marginTop: 18 }}>
                    {slide.heading}
                  </h4>
                  {slide.body && (
                    <p style={{ fontFamily: bodyFont, fontSize: 'clamp(1.1rem, 4.5vw, 1.5rem)', lineHeight: 1.6, color: slideSub, marginTop: 20, maxWidth: '30ch' }}>{slide.body}</p>
                  )}
                  <div className="absolute flex items-center" style={{ left: pad, right: pad, bottom: 20, borderTop: `1px solid ${slideHair}`, paddingTop: 10 }}>
                    <LogoChip size={18} />
                  </div>
                </div>
              );
            })() : (
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
            aria-label={a.label}
            className="flex items-center gap-1.5 px-2 py-2 rounded text-[#666] hover:bg-[#f3f2ef] transition-colors text-[13px] font-semibold sm:px-3"
          >
            <a.icon className="w-5 h-5 shrink-0" />
            {/* Cramped widths drop the label entirely (icon-only) — never "Com…". */}
            <span className="hidden min-[420px]:inline whitespace-nowrap">{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default LinkedInCarouselCard;

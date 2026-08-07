import React, { useLayoutEffect, useRef, useState } from 'react';
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

// ── Text-slide fitting guard ────────────────────────────────────────────
// A drafted carousel slide has no length contract — a heading or a lead's raw
// LinkedIn headline (see safeKicker below) can be arbitrarily long. FitText makes
// every text block physically incapable of overlapping its neighbors: it is
// line-clamped from first paint (CSS-only, holds before any measurement runs),
// then steps its font size down (up to STEP_DOWN_STEPS times, floor MIN_FONT_PX)
// to try to recover the full text within that clamp — ellipsis is the terminal
// fallback, never overlap or bleed past the slide.
const STEP_DOWN_RATIO = 0.86;
const STEP_DOWN_STEPS = 2;
const MIN_FONT_PX = 11;

interface FitTextProps {
  as: 'div' | 'h4' | 'p';
  text: string;
  style: React.CSSProperties;
  /** 1 = single-line truncation (nowrap + ellipsis); >1 = multi-line clamp. */
  maxLines: number;
  className?: string;
}

/** Multi-line "does it fit" check. Deliberately NOT a raw scrollHeight-vs-clientHeight
 *  pixel diff: web fonts (this card renders in the prospect's/lead's brand font) can
 *  carry line-gap metrics that make a browser's line-box math overshoot scrollHeight by
 *  a few px EVEN ON TEXT THAT ALREADY FITS — confirmed directly (DM Sans: +5px on a
 *  2-line heading that renders with zero visual defect; the system-font fallback: +0px on
 *  the identical box). A flat pixel tolerance would have to be guessed per font; rounding
 *  to a whole line count is font-metric-agnostic and matches how a human reads the box
 *  ("does this take more lines than allowed"), not how sub-pixel layout rounds. */
function fitsLines(el: HTMLElement, maxLines: number): boolean {
  const lineHeightPx = parseFloat(getComputedStyle(el).lineHeight) || parseFloat(getComputedStyle(el).fontSize) * 1.2;
  return Math.round(el.scrollHeight / lineHeightPx) <= maxLines;
}

const FitText: React.FC<FitTextProps> = ({ as: Tag, text, style, maxLines, className }) => {
  const ref = useRef<HTMLElement>(null);
  const [step, setStep] = useState(0);
  // Set only once step-down is exhausted and the text still doesn't fit at the floor
  // size — a JS-truncated prefix (not CSS-only ellipsis) so the box's own scrollHeight
  // stops exceeding its clientHeight. CSS line-clamp is a fine VISUAL terminal fallback,
  // but the DOM still reports the untruncated content as "overflowing" itself even
  // though nothing bleeds past the box — so for slides drafted well past the char
  // budget, cut the string for real rather than lean on CSS to hide it.
  const [truncated, setTruncated] = useState<string | null>(null);
  const singleLine = maxLines <= 1;

  // Text changed (e.g. slide navigation) — restart at the default size.
  useLayoutEffect(() => { setStep(0); setTruncated(null); }, [text]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || truncated !== null || step >= STEP_DOWN_STEPS) return;
    const overflowing = singleLine ? el.scrollWidth - el.clientWidth > 2 : !fitsLines(el, maxLines);
    if (!overflowing) return;
    const currentPx = parseFloat(getComputedStyle(el).fontSize);
    if (currentPx > MIN_FONT_PX + 0.5) setStep((s) => s + 1);
  }, [step, text, singleLine, truncated, maxLines]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || truncated !== null || step < STEP_DOWN_STEPS) return;
    const fits = () => (singleLine ? el.scrollWidth - el.clientWidth <= 2 : fitsLines(el, maxLines));
    if (fits()) return;
    const original = el.textContent;
    let lo = 0;
    let hi = text.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      el.textContent = `${text.slice(0, mid).trimEnd()}…`;
      if (fits()) lo = mid; else hi = mid - 1;
    }
    el.textContent = original;
    setTruncated(`${text.slice(0, lo).trimEnd()}…`);
  }, [step, text, singleLine, truncated, maxLines]);

  const scale = Math.pow(STEP_DOWN_RATIO, step);
  const baseFontSize = style.fontSize;
  const fontSize = baseFontSize && step > 0 ? `max(${MIN_FONT_PX}px, calc(${baseFontSize} * ${scale}))` : baseFontSize;

  // Multi-line clamp deliberately does NOT use -webkit-line-clamp: Chromium's
  // -webkit-box + -webkit-line-clamp reports scrollHeight a few px ABOVE clientHeight
  // even for content that already fits (confirmed empirically — a single "…" character
  // in a 3-line-clamped box still shows scrollHeight-clientHeight>0), which would make
  // the fits()-check above loop forever truncating text that was never actually
  // overflowing. A plain max-height (line-height em × maxLines) + overflow hidden
  // measures cleanly (0 diff when content fits, real diff when it doesn't) at the cost
  // of no native ellipsis glyph — moot, since by the time content is long enough to hit
  // this box the JS truncation above has already appended our own "…".
  const lineHeightMultiplier = typeof style.lineHeight === 'number' ? style.lineHeight : 1.2;
  const fitStyle: React.CSSProperties = singleLine
    ? { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
    : {
        maxHeight: `${lineHeightMultiplier * maxLines}em`,
        overflow: 'hidden',
        overflowWrap: 'break-word',
        wordBreak: 'break-word',
      };

  return React.createElement(
    Tag,
    { ref, className, style: { ...style, ...(fontSize ? { fontSize } : {}), minHeight: 0, ...fitStyle } },
    truncated ?? text
  );
};

/** Cover/interior slide kicker label. Guards against runaway source text — e.g. a
 *  lead's ENTIRE LinkedIn headline landing in the kicker slot when a generator omits
 *  slide.kicker and the caller falls back to the profile headline prop. Caps to a
 *  short label (<=3 words, <=maxChars) or drops to `fallback` (the "n / total"
 *  counter style used on interior slides) when the source text doesn't qualify. */
function safeKicker(raw: string | undefined, fallback: string, maxChars = 40): string {
  const s = (raw || '').trim();
  if (!s) return fallback;
  if (s.length > maxChars) return fallback;
  const words = s.split(/\s+/);
  return words.length > 3 ? words.slice(0, 3).join(' ') : s;
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
              // Kicker/heading/body/figure are each their own guarded box, stacked in a
              // flex column with a fixed gap — never absolutely-positioned, never able to
              // intersect a sibling. The slide root clips (overflow hidden) as the last-resort
              // net; FitText's per-block clamp + step-down is what actually keeps them off it.
              if (role === 'cover') {
                return (
                  <div className="absolute inset-0 flex flex-col justify-center" style={{ background: surface, padding: `28px ${pad} 56px`, overflow: 'hidden' }}>
                    <div className="flex flex-col" style={{ gap: 16, minHeight: 0, overflow: 'hidden' }}>
                      <FitText as="div" maxLines={1} text={safeKicker(slide.kicker, `${clampedIndex + 1} / ${total}`)}
                        style={{ fontFamily: bodyFont, fontWeight: 700, fontSize: 'clamp(11px, 2.8vw, 14px)', letterSpacing: '0.16em', textTransform: 'uppercase', color: accent2 }} />
                      <span aria-hidden style={{ display: 'block', width: 44, height: 4, background: safeAccent }} />
                      <FitText as="h4" maxLines={3} text={slide.heading}
                        style={{ fontFamily: headingFont, fontWeight: 800, fontSize: 'clamp(2.1rem, 8.5vw, 3.4rem)', lineHeight: 1.06, letterSpacing: '-0.02em', color: slideInk }} />
                      {slide.body && (
                        <FitText as="p" maxLines={4} text={slide.body}
                          style={{ fontFamily: bodyFont, fontSize: 'clamp(1.05rem, 4.2vw, 1.4rem)', lineHeight: 1.55, color: slideSub, maxWidth: '30ch' }} />
                      )}
                    </div>
                    <div className="absolute flex items-center" style={{ left: pad, right: pad, bottom: 20, borderTop: `1px solid ${slideHair}`, paddingTop: 10 }}>
                      <LogoChip />
                    </div>
                  </div>
                );
              }
              if (role === 'action') {
                const actionKicker = slide.kicker ? safeKicker(slide.kicker, '') : '';
                return (
                  <div className="absolute inset-0 flex flex-col justify-center" style={{ background: surface, padding: `28px ${pad} 56px`, overflow: 'hidden' }}>
                    <div className="flex flex-col" style={{ gap: 16, minHeight: 0, overflow: 'hidden' }}>
                      {actionKicker && (
                        <FitText as="div" maxLines={1} text={actionKicker}
                          style={{ fontFamily: bodyFont, fontWeight: 700, fontSize: 'clamp(11px, 2.8vw, 14px)', letterSpacing: '0.16em', textTransform: 'uppercase', color: accent2 }} />
                      )}
                      <FitText as="h4" maxLines={3} text={slide.heading}
                        style={{ fontFamily: headingFont, fontWeight: 800, fontSize: 'clamp(2rem, 8vw, 3.2rem)', lineHeight: 1.08, letterSpacing: '-0.018em', color: slideInk }} />
                      {slide.body && (
                        <FitText as="p" maxLines={4} text={slide.body}
                          style={{ fontFamily: bodyFont, fontSize: 'clamp(1.1rem, 4.5vw, 1.5rem)', lineHeight: 1.6, color: slideSub, maxWidth: '30ch' }} />
                      )}
                      <span aria-hidden style={{ display: 'block', width: 44, height: 4, background: safeAccent }} />
                    </div>
                    <div className="flex items-center" style={{ marginTop: 14 }}>
                      <LogoChip size={24} />
                    </div>
                  </div>
                );
              }
              // point / proof
              const isProof = role === 'proof' || (role === 'point' && Boolean(slide.figure));
              return (
                <div className="absolute inset-0 flex flex-col justify-center" style={{ background: surface, padding: `28px ${pad} 56px`, overflow: 'hidden' }}>
                  <div className="flex flex-col" style={{ gap: 16, minHeight: 0, overflow: 'hidden' }}>
                    <FitText as="div" maxLines={1} text={safeKicker(slide.kicker, `${clampedIndex + 1} / ${total}`)}
                      style={{ fontFamily: bodyFont, fontWeight: 700, fontSize: 'clamp(11px, 2.8vw, 14px)', letterSpacing: '0.16em', textTransform: 'uppercase', color: accent2 }} />
                    {isProof && slide.figure && (
                      <FitText as="div" maxLines={1} text={slide.figure}
                        style={{ fontFamily: headingFont, fontWeight: 800, fontSize: 'clamp(3.2rem, 16vw, 5.6rem)', lineHeight: 0.95, letterSpacing: '-0.02em', color: safeAccent }} />
                    )}
                    <FitText as="h4" maxLines={isProof ? 2 : 3} text={slide.heading}
                      style={{ fontFamily: headingFont, fontWeight: 800, fontSize: isProof ? 'clamp(1.6rem, 6vw, 2.4rem)' : 'clamp(2.1rem, 8vw, 3.4rem)', lineHeight: 1.1, letterSpacing: '-0.015em', color: slideInk }} />
                    {slide.body && (
                      <FitText as="p" maxLines={4} text={slide.body}
                        style={{ fontFamily: bodyFont, fontSize: 'clamp(1.1rem, 4.5vw, 1.5rem)', lineHeight: 1.6, color: slideSub, maxWidth: '30ch' }} />
                    )}
                  </div>
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

/**
 * LmNight: the Lead magnets tab in the ARCH report's look (NIGHT MOCKUP, local only,
 * 2026-09-29). Rendered by DeskLeadMagnetsSurface only when `?night` is on the URL; the
 * light desk never mounts it.
 *
 * NIGHT v4 (Ivan 2026-09-29, v3 "looks way less cool"): v2's look is back (spotlight cards
 * with covers, 3-up at 1200px, ghost cards with a dot grid for what is being built, the
 * caps eyebrow with the yellow rule, the newsletter pointer box) while every v3 word stays:
 * the plain headline, "sign-ups", "Visitors not counted yet", "Being built", the one
 * exception mark per card and the plain newsletter sentence. No "live" chip on every card.
 *
 * Presentation only. Every figure and sentence arrives already computed by the surface
 * (live shelf, drawn-up-next pipeline, totals, announce marks); nothing here derives or
 * invents a number. An absent visitor count renders the honest blank, never a zero.
 */
import React, { type CSSProperties } from 'react';
import { MotionRoot } from './motion';
import { BlurFade, MagicCard, DotPattern } from './magicui';
import { PK_CSS } from './styles';

export type LmNightShelfItem = {
  id: string;
  title: string;
  formatLabel: string;
  coverUrl?: string;
  url?: string;
  promise?: string;
  gateKeyword?: string;
  /** Feed-announce mark, only when the data carries it. */
  mark: string | null;
  /** undefined = the board carries no count: render the blank, never 0. */
  visitors?: number;
  /** Present only for gated pages that carry a count. */
  optins?: number;
};

export type LmNightPipelineItem = { id: string; title: string; meta?: string | null };

export type LmNightProps = {
  liveN: number;
  pipelineN: number;
  shelf: LmNightShelfItem[];
  pipeline: LmNightPipelineItem[];
  newsletter?: { name: string } | null;
  totals: { visitors?: number; optins?: number };
  onOpen: (id: string) => void;
};

const LMN_CSS = `
.lmn { position: relative; isolation: isolate; color: rgb(var(--nt-fg, 255 255 255)); font-family: var(--cb-body, Manrope), 'Helvetica Neue', Arial, sans-serif; font-size: 16px; line-height: 1.55; letter-spacing: -0.004em; -webkit-font-smoothing: antialiased; padding: 2px 0 8px; }
.lmn > .pk-glow { left: -120px; width: min(560px, 100vw); }
.lmn-hero { position: relative; display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 10px 28px; padding: 4px 0 2px; }
.lmn-lede { margin: 0; max-width: 34ch; font-size: clamp(21px, 5.4vw, 28px); line-height: 1.22; letter-spacing: -0.025em; text-wrap: balance; color: rgb(var(--nt-fg, 255 255 255)); }
.lmn-lede b { font-weight: 500; color: var(--cb-accent); }
.lmn-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 18px; }
.lmn-sub-t { font-size: 14px; font-weight: 600; color: rgb(var(--nt-fg, 255 255 255) / .68); }
.lmn-sub-t b { font-family: var(--cb-serif, Sora), sans-serif; font-weight: 400; font-size: 17px; letter-spacing: -0.02em; color: rgb(var(--nt-fg, 255 255 255)); margin-right: 5px; }
.lmn-dot { position: relative; display: inline-block; flex: none; width: 7px; height: 7px; border-radius: 999px; background: var(--cb-accent); box-shadow: 0 0 10px rgba(255,199,29,.6); }

.lmn-grid { display: grid; gap: 14px; margin: 26px 0 0; padding: 0; list-style: none; }
@media (min-width: 768px) { .lmn-grid { grid-template-columns: repeat(2, minmax(0,1fr)); gap: 18px; } }
@media (min-width: 1200px) { .lmn-grid { grid-template-columns: repeat(3, minmax(0,1fr)); gap: 16px; } }
.lmn-grid > li { border-radius: 26px 8px 8px 8px; min-width: 0; }
.lmn-open { height: 100%; border-radius: inherit; cursor: pointer; outline: none; }
.lmn-open:focus-visible { box-shadow: 0 0 0 2px var(--cb-accent); }
.lmn-open .pk-mcard { box-shadow: 0 18px 40px rgba(0,0,0,.35); }
@media (hover: hover) and (prefers-reduced-motion: no-preference) { .lmn-open .pk-mcard { transition: transform .2s ease, box-shadow .2s ease; } .lmn-open:hover .pk-mcard { transform: translateY(-2px); box-shadow: 0 24px 50px rgba(0,0,0,.5); } }
/* calm pass: the cursor spotlight only where a cursor exists; a phone gets the plain edge */
@media (hover: none) { .lmn .pk-mcard { background: linear-gradient(#171717 0 0) padding-box, linear-gradient(rgb(var(--nt-fg, 255 255 255) / .09), rgb(var(--nt-fg, 255 255 255) / .09)) border-box !important; } .lmn .pk-mcard-glow { display: none; } }
.lmn .pk-mcard-body { padding: 14px 14px 6px; }
@media (min-width: 768px) { .lmn .pk-mcard-body { padding: 16px 18px 8px; } }
.lmn-cover { position: relative; overflow: hidden; aspect-ratio: 1.3 / 1; border-radius: 18px 6px 6px 6px; background: #0e0e0e; border: 1px solid rgb(var(--nt-fg, 255 255 255) / .07); }
@media (min-width: 768px) { .lmn-cover { aspect-ratio: 1.45 / 1; } }
@media (min-width: 1200px) { .lmn-cover { aspect-ratio: 1.7 / 1; } }
.lmn-cover-bg { position: absolute; inset: -12%; width: 124%; height: 124%; object-fit: cover; filter: blur(28px) saturate(1.15) brightness(.8); opacity: .28; }
.lmn-cover-img { position: relative; display: block; width: 100%; height: 100%; object-fit: contain; }
.lmn-cover-none { position: absolute; inset: 0; background: repeating-linear-gradient(45deg, rgb(var(--nt-fg, 255 255 255) / .04) 0 4px, transparent 4px 9px); }
.lmn-tags { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 14px; }
.lmn-chip { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 999px; border: 1px solid rgb(var(--nt-fg, 255 255 255) / .18); background: rgb(var(--nt-fg, 255 255 255) / .04); font-size: 11.5px; font-weight: 700; line-height: 1.35; color: rgb(var(--nt-fg, 255 255 255) / .78); white-space: nowrap; }
.lmn-live { display: inline-flex; align-items: center; gap: 7px; padding: 3px 10px; border-radius: 999px; border: 1px solid rgba(255,199,29,.35); background: rgba(255,199,29,.1); font-size: 11.5px; font-weight: 800; line-height: 1.35; color: var(--cb-accent); white-space: nowrap; }
.lmn-live .lmn-dot { width: 6px; height: 6px; }
.lmn-title { margin: 12px 0 0; font-family: var(--cb-serif, Sora), sans-serif; font-weight: 500 !important; font-size: 19px; line-height: 1.25; letter-spacing: -0.02em; text-wrap: balance; }
.lmn-mark { margin-top: 6px; font-size: 13px; font-weight: 600; line-height: 1.4; color: rgb(var(--nt-fg, 255 255 255) / .66); }
.lmn-stats { display: flex; flex-wrap: wrap; gap: 8px 22px; margin-top: 14px; }
.lmn-stat { display: inline-flex; align-items: baseline; gap: 7px; }
.lmn-stat b { font-family: var(--cb-serif, Sora), sans-serif; font-weight: 400; font-size: 28px; line-height: 1; letter-spacing: -0.04em; }
.lmn-stat > span { font-size: 13px; font-weight: 700; color: rgb(var(--nt-fg, 255 255 255) / .66); }
.lmn-blank { display: inline-flex; align-items: center; gap: 8px; padding: 5px 11px; border-radius: 999px; border: 1px dashed rgb(var(--nt-fg, 255 255 255) / .2); font-size: 12.5px; font-weight: 700; color: rgb(var(--nt-fg, 255 255 255) / .64); }
.lmn-url { display: inline-flex; align-items: flex-start; gap: 5px; margin-top: 12px; max-width: 100%; font-size: 13px; font-weight: 600; line-height: 1.4; color: rgb(var(--nt-fg, 255 255 255) / .68); text-decoration: none; overflow-wrap: anywhere; }
.lmn-url:hover { color: rgb(var(--nt-fg, 255 255 255)); }
.lmn-url svg { flex: none; margin-top: 3px; color: var(--cb-accent); }
.lmn-det { margin-top: auto; }
.lmn-det-wrap { margin-top: auto; padding-top: 12px; }
.lmn-det summary { list-style: none; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 11px 0 9px; border-top: 1px solid rgb(var(--nt-fg, 255 255 255) / .08); cursor: pointer; font-size: 11px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: rgb(var(--nt-fg, 255 255 255) / .64); }
.lmn-det summary::-webkit-details-marker { display: none; }
.lmn-det summary svg { color: rgb(var(--nt-fg, 255 255 255) / .55); }
@media (prefers-reduced-motion: no-preference) { .lmn-det summary svg { transition: transform .2s ease; } }
.lmn-det[open] summary svg { transform: rotate(45deg); }
.lmn-det dl { display: grid; grid-template-columns: auto minmax(0,1fr); gap: 6px 14px; margin: 2px 0 12px; font-size: 13px; line-height: 1.45; }
.lmn-det dt { font-weight: 700; color: rgb(var(--nt-fg, 255 255 255) / .64); }
.lmn-det dd { margin: 0; color: rgb(var(--nt-fg, 255 255 255) / .85); overflow-wrap: anywhere; }

.lmn-pipe { display: grid; gap: 12px; margin: 22px 0 0; padding: 0; list-style: none; }
@media (min-width: 560px) { .lmn-pipe { grid-template-columns: repeat(2, minmax(0,1fr)); gap: 16px; } }
.lmn-ghost { position: relative; overflow: hidden; height: 100%; min-height: 128px; display: flex; flex-direction: column; border-radius: 22px 8px 8px 8px; border: 1px dashed rgb(var(--nt-fg, 255 255 255) / .18); background: linear-gradient(160deg, rgb(var(--nt-fg, 255 255 255) / .045), rgb(var(--nt-fg, 255 255 255) / .01)); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); padding: 16px 18px 18px; }
.lmn-ghost .pk-dots { mask-image: radial-gradient(260px 160px at 100% 0%, #000 0%, transparent 75%); -webkit-mask-image: radial-gradient(260px 160px at 100% 0%, #000 0%, transparent 75%); }
.lmn-ghost-n { font-family: var(--cb-serif, Sora), sans-serif; font-size: 13px; letter-spacing: .02em; color: rgb(var(--nt-fg, 255 255 255) / .45); font-variant-numeric: tabular-nums; }
.lmn-ghost .lmn-title { margin-top: 8px; color: rgb(var(--nt-fg, 255 255 255) / .9); }
.lmn-ghost .lmn-tags { margin-top: auto; padding-top: 14px; }

.lmn-nl { display: flex; align-items: flex-start; gap: 14px; margin-top: 18px; padding: 18px; border-radius: 22px 8px 8px 8px; border: 1px solid rgb(var(--nt-fg, 255 255 255) / .09); background: rgb(var(--nt-fg, 255 255 255) / .025); }
.lmn-nl-ic { flex: none; display: grid; place-items: center; width: 38px; height: 38px; border-radius: 999px; background: rgba(255,199,29,.1); border: 1px solid rgba(255,199,29,.3); color: var(--cb-accent); }
.lmn-nl-t { margin-top: 8px; font-size: 14.5px; line-height: 1.5; color: rgb(var(--nt-fg, 255 255 255) / .8); }
.lmn-nl .lmn-chip { margin-top: 10px; white-space: normal; }

/* QUIET (2026-09-29, "private-bank quiet, receipts first"): white cards with a hairline and
   no drop shadow, covers on a light well (no blurred halo), ink everywhere yellow was text,
   plain dashed outlines for what is being built. Night never matches [data-quiet]. */
[data-quiet] .lmn-lede b { color: #111; }
[data-quiet] .lmn .pk-mcard, [data-quiet] .lmn-open .pk-mcard { background: #FFFFFF !important; border: 1px solid rgba(17,17,17,.09) !important; box-shadow: none; }
@media (hover: hover) and (prefers-reduced-motion: no-preference) { [data-quiet] .lmn-open:hover .pk-mcard { transform: none; box-shadow: none; border-color: rgba(17,17,17,.24) !important; } }
[data-quiet] .lmn-open:focus-visible { box-shadow: 0 0 0 2px #111; }
[data-quiet] .lmn-cover { background: #EFEFEC; border-color: rgba(17,17,17,.07); }
[data-quiet] .lmn-cover-bg { display: none; }
[data-quiet] .lmn-cover-none { background: repeating-linear-gradient(45deg, rgba(17,17,17,.05) 0 4px, transparent 4px 9px); }
[data-quiet] .lmn-chip { background: #F5F5F3; border-color: rgba(17,17,17,.12); color: rgba(17,17,17,.78); }
[data-quiet] .lmn-live { background: #FFFFFF; border-color: rgba(17,17,17,.14); color: #111; }
[data-quiet] .lmn-dot { box-shadow: none; }
[data-quiet] .lmn-url svg { color: #111; }
[data-quiet] .lmn-url:hover { text-decoration: underline; text-underline-offset: 3px; }
[data-quiet] .lmn-ghost { background: transparent; border-color: rgba(17,17,17,.20); backdrop-filter: none; -webkit-backdrop-filter: none; }
[data-quiet] .lmn-ghost-n { color: rgba(17,17,17,.55); }
[data-quiet] .lmn-ghost .lmn-title { color: #111; }
[data-quiet] .lmn-nl { background: #FFFFFF; border-color: rgba(17,17,17,.09); }
[data-quiet] .lmn-nl-ic { background: #E9E9E6; border-color: transparent; color: #111; }
[data-quiet] .lmn-nl-t { color: rgba(17,17,17,.78); }

`;

const Plus = () => (
  <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
);
const Out = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M3 1h6v6M9 1L1.5 8.5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const Mail = () => (
  <svg width="17" height="17" viewBox="0 0 20 20" aria-hidden="true"><rect x="2.5" y="4.5" width="15" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.6" fill="none" /><path d="M3.5 6l6.5 5 6.5-5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

function Cover({ src, title }: { src?: string; title: string }) {
  return (
    <div className="lmn-cover">
      {src ? (
        <>
          <img className="lmn-cover-bg" src={src} alt="" aria-hidden="true" loading="lazy" />
          <img
            className="lmn-cover-img"
            src={src}
            alt={`Cover: ${title}`}
            loading="lazy"
            onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
          />
        </>
      ) : <span className="lmn-cover-none" aria-hidden="true" />}
    </div>
  );
}

function ShelfCard({ it, i, onOpen }: { it: LmNightShelfItem; i: number; onOpen: (id: string) => void }) {
  const open = () => onOpen(it.id);
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  return (
    <BlurFade as="li" delay={(i % 3) * 0.05}>
      <div
        className="lmn-open"
        role="button"
        tabIndex={0}
        aria-label={`Open ${it.title}`}
        onClick={open}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } }}
      >
        <MagicCard size={260}>
          <Cover src={it.coverUrl} title={it.title} />
          {/* Every card here is live, so "live" is not said on each one: the format chip and
              the one exception (not posted about yet) or the posting day. */}
          <div className="lmn-tags">
            <span className="lmn-chip">{it.formatLabel}</span>
          </div>
          <h3 className="lmn-title">{it.title}</h3>
          {it.mark && <div className="lmn-mark">{it.mark}</div>}
          <div className="lmn-stats">
            {typeof it.visitors === 'number' ? (
              <span className="lmn-stat" data-metric="">
                <b>{fmt(it.visitors)}</b>
                <span>{it.visitors === 1 ? 'visitor' : 'visitors'}</span>
              </span>
            ) : (
              <span className="lmn-blank" data-metric="">Visitors not counted yet</span>
            )}
            {typeof it.optins === 'number' && (
              <span className="lmn-stat" data-metric="">
                <b>{fmt(it.optins)}</b>
                <span>{it.optins === 1 ? 'sign-up' : 'sign-ups'}</span>
              </span>
            )}
          </div>
          {it.url && (
            <a className="lmn-url" href={it.url} target="_blank" rel="noreferrer" onClick={stop}>
              <span>{it.url.replace(/^https?:\/\//, '')}</span><Out />
            </a>
          )}
          <div className="lmn-det-wrap" onClick={stop} onKeyDown={stop}>
            <details className="lmn-det">
              <summary>Details <Plus /></summary>
              <dl>
                <dt>Format</dt><dd>{it.formatLabel}</dd>
                {it.promise && <><dt>Inside</dt><dd>{it.promise}</dd></>}
                {it.gateKeyword && <><dt>Comment word</dt><dd>{it.gateKeyword}</dd></>}
                {it.url && <><dt>Lives at</dt><dd>{it.url}</dd></>}
              </dl>
            </details>
          </div>
        </MagicCard>
      </div>
    </BlurFade>
  );
}

const fmt = (n: number) => n.toLocaleString('en-US');

export default function LmNight({ liveN, pipelineN, shelf, pipeline, newsletter, totals, onOpen }: LmNightProps) {
  return (
    <MotionRoot>
      <style>{PK_CSS + LMN_CSS}</style>
      <div className="lmn" data-lm-night="">
        {/* v2: the warm glow behind the headline (the page glow sits too high on a long tab) */}
        <div aria-hidden className="pk-glow" />
        {/* v3's words (said once, no "live right now" pill), v2's type: Sora headline with the
            live count in yellow, the totals beside it once. */}
        <section className="lmn-hero" aria-labelledby="lmn-hero">
          <h1 id="lmn-hero" className="lmn-lede pk-disp">
            <b>{liveN}</b> lead {liveN === 1 ? 'magnet is' : 'magnets are'} live.
            {pipelineN > 0 ? <> {pipelineN} more {pipelineN === 1 ? 'is' : 'are'} being built.</> : null}
          </h1>
          <div className="lmn-meta">
            {typeof totals.visitors === 'number'
              ? <span className="lmn-sub-t" data-metric=""><b>{fmt(totals.visitors)}</b>{totals.visitors === 1 ? 'visit' : 'visits'} across the pages</span>
              : <span className="lmn-blank" data-metric="">Visitors not counted yet</span>}
            {typeof totals.optins === 'number' && <span className="lmn-sub-t" data-metric=""><b>{fmt(totals.optins)}</b>{totals.optins === 1 ? 'sign-up' : 'sign-ups'}</span>}
          </div>
        </section>

        {shelf.length > 0 ? (
          <ul className="lmn-grid" data-viz="">
            {shelf.map((it, i) => <ShelfCard key={it.id} it={it} i={i} onOpen={onOpen} />)}
          </ul>
        ) : (
          <div className="lmn-ghost" style={{ marginTop: 26, alignItems: 'center', justifyContent: 'center' } as CSSProperties}>
            <span className="lmn-sub-t">No lead magnets live yet.</span>
          </div>
        )}

        {pipeline.length > 0 && (
          <section className="pk-sec" style={{ paddingTop: 48 }} aria-labelledby="lmn-next">
            {/* The count is in the headline above, so this section carries its label only. */}
            <div id="lmn-next" role="heading" aria-level={2} className="pk-cap pk-capline">Being built</div>
            <ul className="lmn-pipe">
              {pipeline.map((p, i) => (
                <BlurFade as="li" key={p.id} delay={(i % 2) * 0.08}>
                  <div className="lmn-ghost">
                    <DotPattern gap={14} />
                    <span className="lmn-ghost-n" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                    <h3 className="lmn-title">{p.title}</h3>
                    {p.meta && <div className="lmn-tags">{p.meta.split(' · ').map((c) => <span key={c} className="lmn-chip">{c}</span>)}</div>}
                  </div>
                </BlurFade>
              ))}
            </ul>
          </section>
        )}

        {newsletter && (
          <BlurFade className="lmn-nl">
            <span className="lmn-nl-ic"><Mail /></span>
            <div className="lmn-nl-t" style={{ minWidth: 0 }}>Everyone who signs up joins {newsletter.name}. The Newsletter tab shows what they get.</div>
          </BlurFade>
        )}

      </div>
    </MotionRoot>
  );
}

/**
 * home-night: the week page's night pieces (NIGHT MOCKUP, local only, 2026-09-29).
 * DeskWeekSurface uses these only when `useNight()` is true; the light desk never renders
 * them. Pure presentation: no data, no numbers, no words of their own.
 *   HOME_NIGHT_CSS  the week heading (caps eyebrow + Sora headline), glance tiles with a lit
 *                   ring on today, the lit full-width plate around the picked day's post, and
 *                   the lit day-by-day timeline under it
 *   GlanceShell     the glass frame around one glance tile
 *
 * Night v4 (2026-09-29): v2's look is back (tracked caps labels, Sora 400 headline, static
 * glow on today's tile, the plate's lit edge, the lit rail and today row). v3's words and
 * speed stay: no helper line under the rail, nothing loops, "ships today" is said once on
 * the page (by the banner), no funnel codes on rows.
 */
import React, { type ReactNode } from 'react';

export const HOME_NIGHT_CSS = `
/* the week heading: caps eyebrow with the dates, then one Sora line */
.hm-week-head { margin-top: 10px; }
.hm-cap { margin: 0; }
.hm-h2 { margin: 12px 0 0; font-family: var(--cb-serif, Sora), sans-serif; font-weight: 400; font-size: clamp(25px, 6.4vw, 34px); line-height: 1.15; letter-spacing: -0.03em; text-wrap: balance; color: rgb(var(--nt-fg, 255 255 255)); }
.hm-h2 b { font-weight: 400; color: var(--cb-accent-fg, var(--cb-accent)); }
.hm-lede { margin: 8px 0 0; max-width: 52ch; font-size: 16px; line-height: 1.5; color: rgb(var(--nt-fg, 255 255 255) / .78); }

/* glance rail: glass tiles */
.hm-rail { display: flex; gap: 8px; margin-top: 16px; }
/* The desk skin sets \`[data-skin="desk"] * { box-shadow: none !important }\`, so every glow here
   either lives on a pseudo-element (which \`*\` does not match) or carries the skin prefix. */
.hm-gtw { position: relative; flex: 1 1 0; min-width: 0; border-radius: 10px; }
.hm-gtw::before { content: ''; position: absolute; inset: -3px; border-radius: 12px; border: 2px solid transparent; pointer-events: none; }
.hm-gtw.on::before { border-color: color-mix(in srgb, var(--pk-acc, #FFC71D) 75%, transparent); }
.hm-gtw.today::before { border-color: var(--cb-accent); box-shadow: 0 0 22px color-mix(in srgb, var(--pk-acc, #FFC71D) 45%, transparent), 0 0 60px color-mix(in srgb, var(--pk-acc, #FFC71D) 16%, transparent); }
.hm-gt { position: relative; z-index: 1; overflow: hidden; border-radius: 10px; border: 1px solid rgb(var(--nt-fg, 255 255 255) / .09); background: #171717; }
.hm-gt .cb-weekrail-tile { flex: none !important; width: 100%; border-radius: 9px !important; }
.hm-gtw.today .hm-gt-day { color: var(--cb-accent-ink, #111) !important; background: var(--cb-accent) !important; }
.hm-gtw.weekend .hm-gt { opacity: .5; }
.hm-gtw.weekend.on .hm-gt { opacity: .8; }
/* a text post's opening line: hidden on a phone (a 44px tile holds one word a line) */
@media (max-width: 767px) { .hm-gline { display: none; } }
.hm-gline { font-size: 12px !important; line-height: 1.3 !important; color: rgb(var(--nt-fg, 255 255 255) / .86) !important; }
.hm-railbase { height: 1px; margin-top: 12px; background: linear-gradient(90deg, transparent, rgb(var(--nt-fg, 255 255 255) / .14) 12%, rgb(var(--nt-fg, 255 255 255) / .14) 88%, transparent); }
@media (prefers-reduced-motion: no-preference) and (hover: hover) {
  .hm-gtw { transition: transform .16s cubic-bezier(.25,1,.5,1); }
  .hm-gtw:hover { transform: translateY(-2px); }
}
/* "Lead magnet" under its day, in a row that mirrors the tiles */
.hm-lmrow { display: flex; gap: 8px; margin-top: 10px; }
.hm-lmrow > span { flex: 1 1 0; min-width: 0; text-align: center; font-family: var(--cb-body, Manrope), sans-serif; font-size: 11px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; line-height: 1.3; color: var(--cb-mint); }

/* the picked day's post on a lit plate, full width, the day list under it (v2's order) */
.hm-week { display: grid; grid-template-columns: minmax(0, 1fr); gap: 28px; margin-top: 26px; }
.hm-stage, .hm-days { min-width: 0; }
.hm-plate { position: relative; isolation: isolate; overflow: hidden; border-radius: 26px 8px 8px 8px; border: 1px solid rgb(var(--nt-fg, 255 255 255) / .08); background: linear-gradient(180deg, #181818, #121212); padding: clamp(18px, 2.4vw, 26px); }
@media (max-width: 639px) { .hm-plate { padding: 18px 14px 18px; } }
.hm-plate::after { content: ''; position: absolute; inset: 0; border-radius: inherit; padding: 1px; pointer-events: none; background: linear-gradient(135deg, color-mix(in srgb, var(--pk-acc, #FFC71D) 85%, transparent), color-mix(in srgb, var(--pk-acc, #FFC71D) 28%, transparent) 26%, rgb(var(--nt-fg, 255 255 255) / .07) 58%, color-mix(in srgb, var(--pk-acc, #FFC71D) 30%, transparent)); -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); mask-composite: exclude; }
.hm-plate::before { content: ''; position: absolute; z-index: -1; left: -140px; top: -120px; width: 520px; height: 460px; background: radial-gradient(closest-side, color-mix(in srgb, var(--pk-acc, #FFC71D) 10%, transparent), transparent); pointer-events: none; }
.hm-plate-head { display: flex; align-items: center; justify-content: space-between; gap: 10px 14px; flex-wrap: wrap; margin-bottom: 16px; }
.hm-plate-head .pk-cap { color: rgb(var(--nt-fg, 255 255 255) / .66); }
.hm-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.hm-actions:empty { display: none; }
.hm-actions button { font-size: 12px !important; padding: 6px 14px !important; }
.hm-frame { cursor: pointer; max-width: 579px; margin: 0 auto; padding: clamp(8px, 1.3vw, 12px); border-radius: 18px; border: 1px solid rgb(var(--nt-fg, 255 255 255) / .12); background: linear-gradient(180deg, rgb(var(--nt-fg, 255 255 255) / .06), rgb(var(--nt-fg, 255 255 255) / .02)); }
[data-skin="desk"] .hm-frame { box-shadow: 0 24px 70px rgba(0,0,0,.55) !important; }
.hm-frame:focus-visible { outline: 2px solid var(--cb-accent); outline-offset: 3px; }
.hm-li { font-size: 13px; font-weight: 700; color: var(--cb-accent-fg, var(--cb-accent)); text-decoration: underline; text-underline-offset: 3px; }
.hm-note { margin: 0 0 10px; font-size: 13px; color: rgb(var(--nt-fg, 255 255 255) / .66); }
.hm-deck { margin-top: 16px; }
.hm-deck .hm-note { margin: 0; }
.hm-out { display: flex; align-items: baseline; gap: 8px; margin-top: 18px; padding-top: 14px; border-top: 1px solid rgb(var(--nt-fg, 255 255 255) / .08); font-size: 14px; color: rgb(var(--nt-fg, 255 255 255) / .66); }
.hm-out .hm-out-n { font-family: var(--cb-serif, Sora), sans-serif; font-weight: 300; font-size: 30px; line-height: 1; letter-spacing: -0.04em; color: rgb(var(--nt-fg, 255 255 255)); }

/* day by day: lit timeline */
.hm-tl { position: relative; }
.hm-tl > :first-child .hm-rail-line { top: 10px; }
.hm-row { position: relative; border-radius: 14px 4px 4px 4px; }
.hm-row.today { background: linear-gradient(90deg, color-mix(in srgb, var(--pk-acc, #FFC71D) 8%, transparent), color-mix(in srgb, var(--pk-acc, #FFC71D) 1.5%, transparent) 60%, transparent); }
.hm-rail-line { position: absolute; left: 9px; top: -12px; bottom: -12px; width: 1px; background: rgb(var(--nt-fg, 255 255 255) / .1); }
.hm-rail-line.lit { background: linear-gradient(to bottom, var(--cb-accent), color-mix(in srgb, var(--pk-acc, #FFC71D) 35%, transparent)); }
[data-skin="desk"] .hm-rail-line.lit { box-shadow: 0 0 8px color-mix(in srgb, var(--pk-acc, #FFC71D) 35%, transparent) !important; }
.hm-rail-line.fade { background: linear-gradient(to bottom, color-mix(in srgb, var(--pk-acc, #FFC71D) 55%, transparent), rgb(var(--nt-fg, 255 255 255) / .1) 70%); }
.hm-dot { position: absolute; z-index: 1; left: 4px; top: 6px; width: 11px; height: 11px; border-radius: 999px; background: #0D0D0D; border: 1.5px solid rgb(var(--nt-fg, 255 255 255) / .35); }
.hm-dot.past { background: var(--cb-accent); border-color: var(--cb-accent); opacity: .65; }
.hm-dot.today { left: 1px; top: 3px; width: 17px; height: 17px; background: var(--cb-accent); border: 3px solid #111; }
.hm-dot.today::before { content: ''; position: absolute; inset: -4.5px; border-radius: 999px; border: 1.5px solid var(--cb-accent); box-shadow: 0 0 14px color-mix(in srgb, var(--pk-acc, #FFC71D) 85%, transparent), 0 0 34px color-mix(in srgb, var(--pk-acc, #FFC71D) 40%, transparent); }
.hm-dot.empty { border-style: dashed; }
.hm-state { flex: none; font-size: 11px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: rgb(var(--nt-fg, 255 255 255) / .66); }
.hm-lbl { margin-top: 12px; font-size: 11px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: rgb(var(--nt-fg, 255 255 255) / .66); }
.hm-lbl:first-child { margin-top: 0; }

/* the rest of the queue, folded under the week */
.hm-beyond { margin: 6px 0 0 122px; border-top: 1px solid rgb(var(--nt-fg, 255 255 255) / .08); }
@media (max-width: 480px) { .hm-beyond { margin-left: 0; } }
.hm-beyond > summary > span:first-child { font-size: 14px !important; font-weight: 700 !important; color: rgb(var(--nt-fg, 255 255 255)) !important; }
.hm-beyond-row { display: flex; gap: 12px; align-items: baseline; padding: 8px 0; border-top: 1px solid rgb(var(--nt-fg, 255 255 255) / .07); }
.hm-beyond-row:first-child { border-top: 0; }
.hm-beyond-d { flex: none; width: 76px; font-size: 12px; font-weight: 800; color: rgb(var(--nt-fg, 255 255 255) / .66); }
.hm-beyond-row button { flex: 1 1 auto; min-width: 0; text-align: left; font: 600 13.5px/1.4 var(--cb-body, Manrope), sans-serif; color: rgb(var(--nt-fg, 255 255 255)); background: none; border: 0; padding: 0; cursor: pointer; }

/* QUIET (2026-09-29, "private-bank quiet, receipts first"): the same week on a light ground.
   White plate with the white LinkedIn card on it (hairline, no mat), light tiles with a white day band,
   the picked day ringed in ink, today's day band and today's dot the only yellow. No glow,
   no lit edge, no gradient. The tile and band colours are inline styles in DeskWeekSurface,
   hence the !important. [data-quiet][data-skin] outranks the desk skin's shadow rules. */
[data-quiet] .hm-h2 b { color: #111; }
[data-quiet] .hm-gt { background: #EFEFEC; border-color: rgba(17,17,17,.09); }
[data-quiet] .hm-gtw.on::before { border-color: #111; }
[data-quiet] .hm-gtw.today:not(.on)::before { border-color: transparent; }
[data-quiet][data-skin] .hm-gtw.today::before { box-shadow: none !important; }
[data-quiet] .hm-gtw.weekend .hm-gt, [data-quiet] .hm-gtw.weekend.on .hm-gt { opacity: 1; }
[data-quiet] .hm-gt .cb-weekrail-tile { background: #EFEFEC !important; }
[data-quiet] .hm-gt .cb-weekrail-tile:has(.cb-glance-linebox) { background: #FFFFFF !important; }
[data-quiet] .hm-gtw.weekend .hm-gt .cb-weekrail-tile { background: repeating-linear-gradient(45deg, rgba(17,17,17,.045) 0 4px, transparent 4px 9px), #F5F5F3 !important; border-color: rgba(17,17,17,.16) !important; }
[data-quiet] .hm-gline { color: #111 !important; }
[data-quiet] .hm-gt .hm-gt-day { color: rgba(17,17,17,.62) !important; backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
[data-quiet] .hm-gt .cb-weekrail-tile:has(img) .hm-gt-day { background: #FFFFFF !important; color: #111 !important; border-top: 1px solid rgba(17,17,17,.09); }
[data-quiet] .hm-gtw.today .hm-gt .cb-weekrail-tile .hm-gt-day { background: var(--cb-accent) !important; color: #111 !important; }
[data-quiet] .hm-railbase { background: rgba(17,17,17,.1); }
[data-quiet] .hm-lmrow > span { color: rgba(17,17,17,.62); }

[data-quiet] .hm-plate { background: #FFFFFF; border-color: rgba(17,17,17,.09); }
[data-quiet] .hm-plate::before, [data-quiet] .hm-plate::after { display: none; }
[data-quiet] .hm-plate-head .pk-cap { color: rgba(17,17,17,.62); }
/* no mat: the white card sits straight on the white plate, held by its own hairline */
[data-quiet] .hm-frame { background: none; border: 0; padding: 0; border-radius: 14px; }
[data-quiet][data-skin] .hm-frame { box-shadow: none !important; }
[data-quiet][data-skin] .hm-frame .cb-linkedin-preview { box-shadow: none !important; border-color: rgba(17,17,17,.10) !important; }
[data-quiet] .hm-li { color: #111; text-decoration-color: rgba(17,17,17,.4); }
[data-quiet] .hm-note { color: rgba(17,17,17,.62); }

[data-quiet] .hm-row.today { background: #FFFFFF; outline: 1px solid rgba(17,17,17,.09); outline-offset: -1px; }
[data-quiet] .hm-rail-line { background: rgba(17,17,17,.12); }
[data-quiet] .hm-rail-line.lit { background: #111; }
[data-quiet][data-skin] .hm-rail-line.lit { box-shadow: none !important; }
[data-quiet] .hm-rail-line.fade { background: rgba(17,17,17,.3); }
[data-quiet] .hm-dot { background: #FFFFFF; border-color: rgba(17,17,17,.4); }
[data-quiet] .hm-dot.past { background: #111; border-color: #111; opacity: 1; }
[data-quiet] .hm-dot.today { border-color: #111; }
[data-quiet] .hm-dot.today::before { display: none; }
[data-quiet] .hm-state, [data-quiet] .hm-lbl, [data-quiet] .hm-beyond-d { color: rgba(17,17,17,.62); }
/* the fold's "+" is the desk kit's accent glyph; on light it reads as yellow text */
[data-quiet] [data-surface="week"] details.drill > summary .more::after { color: rgba(17,17,17,.62); }
`;

/** One glance tile in a glass frame; today carries the static lit ring. */
export function GlanceShell({ today, weekend, on, children }: { today: boolean; weekend: boolean; on: boolean; children: ReactNode }) {
  return (
    <div className={['hm-gtw', today && 'today', weekend && 'weekend', on && 'on'].filter(Boolean).join(' ')}>
      <div className="hm-gt">{children}</div>
    </div>
  );
}

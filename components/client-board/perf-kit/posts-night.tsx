/**
 * NIGHT MOCKUP (local only, 2026-09-29): the Posts tab in the ARCH report's look. Only
 * DeskReviewSurface renders these, and only when `useNight()` is true, so the light desk is
 * untouched. Every number and sentence is passed in by the surface; nothing here computes or
 * words a fact of its own.
 *
 *   PostsSummary   the tab's one sentence ("35 posts are scheduled, the last one on Tue 17
 *                  Nov. 49 are already out.") in a glass box
 *   SlideGroup     a row of toggles whose active highlight slides between them (layoutId)
 *   RailRow        a glass post card on a lit date rail (today solid, next ringed); from
 *                  1024px wide it is one compact line
 *   StatusMark     the per-row exception mark: ships today, approved, out...
 *   NightSection   the fold header (caps label + count pill), e.g. SCHEDULED 35
 *
 * Night v4 (2026-09-29): v2's look is back (date rail, glass cards, tracked caps labels,
 * yellow toggles and count pills). v3's words and speed stay: one summary sentence, no split
 * bar or buffer count, "Written, no date yet", the post's first line as the title, no funnel
 * codes, no "scheduled" mark on every row, no blurbs under headings. Rows render at once; the
 * only motion is the sliding toggle highlight and the inline preview opening on a tap.
 */
import React, { type CSSProperties, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { PK_CSS } from './styles';

const cx = (...p: Array<string | false | null | undefined>) => p.filter(Boolean).join(' ');

export const POSTS_NIGHT_CSS = `
[data-surface="review"][data-night-posts] { --prs-acc-08: color-mix(in srgb, var(--cb-accent) 8%, transparent); --prs-acc-14: color-mix(in srgb, var(--cb-accent) 14%, transparent); --prs-acc-30: color-mix(in srgb, var(--cb-accent) 30%, transparent); --prs-acc-45: color-mix(in srgb, var(--cb-accent) 45%, transparent); }

/* summary: the tab's one sentence in a glass box */
.prs-sum { margin-top: 4px; padding: 18px 18px 18px; border-radius: 22px 8px 8px 8px; border: 1px solid rgb(var(--nt-fg, 255 255 255) / .08); background: linear-gradient(180deg, rgb(var(--nt-fg, 255 255 255) / .045), rgb(var(--nt-fg, 255 255 255) / .012)); }
/* max-width in em, not ch: the web font lands after first paint, and a width set in the
   fallback's ch let the line wrap then unwrap (a jump of everything below). */
.prs-lede { margin: 0; max-width: 34em; min-height: 2.7em; font-family: var(--cb-serif, Sora), sans-serif; font-weight: 400; font-size: clamp(17px, 4.4vw, 20px); line-height: 1.35; letter-spacing: -0.015em; color: rgb(var(--nt-fg, 255 255 255) / .66); text-wrap: pretty; }
@media (min-width: 900px) { .prs-sum { padding: 20px 26px; } }
@media (min-width: 1200px) { .prs-lede { max-width: none; min-height: 0; } }
.prs-lede b { font-weight: 700; color: rgb(var(--nt-fg, 255 255 255)); }

/* toggles with a sliding highlight */
.prs-tools { margin-top: 18px; display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
.prs-seg-ctl { display: inline-flex; padding: 4px; gap: 2px; border-radius: 999px; background: rgb(var(--nt-fg, 255 255 255) / .035); border: 1px solid rgb(var(--nt-fg, 255 255 255) / .09); }
.prs-tg { position: relative; isolation: isolate; flex: none; border: 0; background: none; cursor: pointer; border-radius: 999px; padding: 8px 16px; min-height: 36px; font: 700 13px/1.2 var(--cb-body, Manrope), sans-serif; color: rgb(var(--nt-fg, 255 255 255) / .62); white-space: nowrap; -webkit-tap-highlight-color: transparent; }
.prs-seg-ctl .prs-tg { padding: 8px 18px; }
.prs-tg:hover { color: rgb(var(--nt-fg, 255 255 255)); }
.prs-tg[aria-pressed="true"] { color: var(--cb-accent-fg, var(--cb-accent)); }
.prs-tg-on { position: absolute; inset: 0; z-index: -1; border-radius: inherit; background: var(--prs-acc-14); border: 1px solid var(--prs-acc-45); box-shadow: 0 0 18px -4px var(--prs-acc-45); }
.prs-tg:focus-visible { outline: 2px solid var(--cb-accent); outline-offset: 2px; }
.prs-filters { margin-top: 14px; padding-top: 14px; border-top: 1px solid rgb(var(--nt-fg, 255 255 255) / .07); display: grid; grid-template-columns: 58px minmax(0,1fr); row-gap: 8px; column-gap: 10px; align-items: center; }
.prs-filters > .pk-cap { color: rgb(var(--nt-fg, 255 255 255) / .62); letter-spacing: .12em; font-size: 11px; }
.prs-frow { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; min-width: 0; }
.prs-frow .prs-tg { border: 1px solid rgb(var(--nt-fg, 255 255 255) / .11); padding: 7px 14px; }
.prs-frow .prs-tg[aria-pressed="true"] { border-color: transparent; }
@media (max-width: 639px) {
  .prs-frow { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; margin-right: -16px; padding-right: 28px; -webkit-mask-image: linear-gradient(90deg, #000 calc(100% - 30px), transparent); mask-image: linear-gradient(90deg, #000 calc(100% - 30px), transparent); }
  .prs-frow::-webkit-scrollbar { display: none; }
}
.prs-clear { background: none; border: 0; cursor: pointer; padding: 6px 8px; font: 700 12.5px var(--cb-body, Manrope), sans-serif; color: rgb(var(--nt-fg, 255 255 255) / .66); text-decoration: underline; text-underline-offset: 3px; white-space: nowrap; }

/* section folds */
.prs-sec { margin-top: 26px; }
.prs-sec-h { position: relative; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 4px 0 12px; cursor: pointer; }
.prs-sec-h::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 1px; background: linear-gradient(90deg, var(--cb-accent), rgb(var(--nt-fg, 255 255 255) / .14) 34%, rgb(var(--nt-fg, 255 255 255) / .04)); }
.prs-sec-h .pk-cap { color: rgb(var(--nt-fg, 255 255 255)); font-size: 12px; }
.prs-chev { display: inline-flex; width: 22px; height: 22px; align-items: center; justify-content: center; border-radius: 999px; border: 1px solid rgb(var(--nt-fg, 255 255 255) / .14); color: rgb(var(--nt-fg, 255 255 255) / .7); flex: none; }
.prs-chev svg { transition: transform .2s ease; }
.prs-sec-h[aria-expanded="true"] .prs-chev { border-color: var(--prs-acc-45); color: var(--cb-accent-fg, var(--cb-accent)); }
.prs-sec-h[aria-expanded="true"] .prs-chev svg { transform: rotate(90deg); }
.prs-count { display: inline-flex; align-items: center; min-width: 26px; justify-content: center; padding: 2px 9px; border-radius: 999px; background: rgb(var(--nt-fg, 255 255 255) / .07); font: 800 12.5px/1.3 var(--cb-body, Manrope), sans-serif; font-variant-numeric: tabular-nums; color: rgb(var(--nt-fg, 255 255 255)); }
.prs-sec-h[aria-expanded="true"] .prs-count { background: var(--prs-acc-14); color: var(--cb-accent-fg, var(--cb-accent)); }
.prs-glyph { display: inline-flex; vertical-align: middle; margin: -3px 10px 0 0; font-size: 11px; line-height: 1; letter-spacing: 0; }
.prs-blurb { font-size: 12.5px; font-weight: 600; color: rgb(var(--nt-fg, 255 255 255) / .62); }
.prs-aimrow { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; min-width: 0; }
.prs-aimrow > .prs-frow { flex-wrap: wrap; margin-right: 0; padding-right: 0; -webkit-mask-image: none; mask-image: none; overflow: visible; }
.prs-sub { margin-top: 16px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding-bottom: 4px; }
.prs-sub .pk-cap { color: rgb(var(--nt-fg, 255 255 255) / .66); }

/* rail + rows */
.prs-list { list-style: none; margin: 14px 0 0; padding: 0; }
.prs-row { position: relative; display: grid; grid-template-columns: 42px minmax(0,1fr); column-gap: 16px; }
.prs-row + .prs-row { margin-top: 10px; }
.prs-rail { position: relative; padding-top: 13px; text-align: center; line-height: 1; }
.prs-rail::before { content: ''; position: absolute; top: -10px; bottom: 0; right: -8.5px; width: 1px; background: rgb(var(--nt-fg, 255 255 255) / .1); }
.prs-row:first-child .prs-rail::before { top: 38px; }
.prs-row:last-child .prs-rail::before { bottom: auto; height: 48px; }
.prs-row:first-child:last-child .prs-rail::before { display: none; }
.prs-dot { position: absolute; top: 34px; right: -13px; width: 10px; height: 10px; border-radius: 999px; background: #1b1b1b; border: 1px solid rgb(var(--nt-fg, 255 255 255) / .28); box-sizing: border-box; }
.prs-wd { font-size: 11px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: rgb(var(--nt-fg, 255 255 255) / .62); }
.prs-d { margin-top: 4px; font-family: var(--cb-serif, Sora), sans-serif; font-size: 24px; font-weight: 400; letter-spacing: -0.04em; font-variant-numeric: tabular-nums; color: rgb(var(--nt-fg, 255 255 255)); }
.prs-mo { margin-top: 4px; font-size: 11px; font-weight: 700; color: rgb(var(--nt-fg, 255 255 255) / .62); }
.prs-nd { padding-top: 6px; font-size: 11px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: rgb(var(--nt-fg, 255 255 255) / .62); line-height: 1.25; }
.prs-row.is-nodate .prs-dot { background: transparent; border: 1px dashed rgb(var(--nt-fg, 255 255 255) / .35); }
.prs-row.is-out .prs-d { color: rgb(var(--nt-fg, 255 255 255) / .72); }
.prs-row.is-next .prs-dot { background: #111; border: 2px solid var(--cb-accent); box-shadow: 0 0 12px var(--prs-acc-45); }
.prs-row.is-next .prs-d { color: var(--cb-accent-fg, var(--cb-accent)); }
.prs-row.is-today .prs-dot { background: var(--cb-accent); border: 0; box-shadow: 0 0 0 4px var(--prs-acc-14), 0 0 18px var(--cb-accent); }
.prs-row.is-today .prs-d, .prs-row.is-today .prs-wd, .prs-row.is-today .prs-mo { color: var(--cb-accent-fg, var(--cb-accent)); }
.prs-row.is-today .prs-d { text-shadow: 0 0 22px var(--prs-acc-45); }

.prs-card { position: relative; min-width: 0; border-radius: 18px 6px 6px 6px; border: 1px solid rgb(var(--nt-fg, 255 255 255) / .08); background: linear-gradient(180deg, rgb(var(--nt-fg, 255 255 255) / .045), rgb(var(--nt-fg, 255 255 255) / .015)); padding: 12px; transition: border-color .15s ease; }
@media (hover: hover) { .prs-card:hover { border-color: rgb(var(--nt-fg, 255 255 255) / .2); } }
.prs-row.is-today .prs-card { border-color: var(--prs-acc-45); background: linear-gradient(135deg, var(--prs-acc-14), rgb(var(--nt-fg, 255 255 255) / .02) 58%); box-shadow: 0 18px 48px -20px var(--prs-acc-45), inset 0 1px 0 rgb(var(--nt-fg, 255 255 255) / .06); }
.prs-row.is-flash .prs-card { border-color: var(--prs-acc-45); }
.prs-head { --prs-th: 52px; display: grid; grid-template-columns: var(--prs-th) minmax(0,1fr); column-gap: 12px; row-gap: 10px; align-items: start; cursor: pointer; border-radius: 12px; }
.prs-head.no-img { grid-template-columns: minmax(0,1fr); }
.prs-head:focus-visible { outline: 2px solid var(--cb-accent); outline-offset: 4px; }
.prs-thumb { display: block; object-fit: cover; object-position: top; }
.prs-title { align-self: center; min-width: 0; font-size: 15px; font-weight: 700; line-height: 1.35; letter-spacing: -0.005em; color: rgb(var(--nt-fg, 255 255 255)); overflow-wrap: anywhere; }
/* a long first line holds two lines on the card; the whole post is one tap away */
@media (max-width: 1023px) { .prs-title { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; } }
.prs-meta { grid-column: 1 / -1; display: flex; gap: 6px; flex-wrap: wrap; align-items: center; min-width: 0; }
@media (min-width: 640px) {
  .prs-head { --prs-th: 64px; grid-template-rows: auto 1fr; row-gap: 8px; }
  .prs-head .prs-thumb { grid-row: 1 / span 2; }
  .prs-title { align-self: end; }
  .prs-head:not(.no-img) .prs-meta { grid-column: 2; align-self: start; }
}
.prs-chip { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 999px; border: 1px solid rgb(var(--nt-fg, 255 255 255) / .12); background: rgb(var(--nt-fg, 255 255 255) / .035); font-size: 11.5px; font-weight: 700; line-height: 1.35; color: rgb(var(--nt-fg, 255 255 255) / .72); white-space: nowrap; }
.prs-status { margin-left: auto; display: inline-flex; align-items: center; gap: 7px; white-space: nowrap; font-size: 11.5px; font-weight: 800; letter-spacing: .02em; color: rgb(var(--nt-fg, 255 255 255) / .5); }
.prs-status i { position: relative; width: 6px; height: 6px; border-radius: 999px; background: rgb(var(--nt-fg, 255 255 255) / .35); display: block; flex: none; }
.prs-status.is-today { padding: 4px 11px; border-radius: 999px; background: var(--cb-accent); color: var(--cb-accent-ink, #111); box-shadow: 0 0 20px var(--prs-acc-45); }
.prs-status.is-today i { background: var(--cb-accent-ink, #111); }
.prs-status.is-out { color: rgb(var(--nt-fg, 255 255 255) / .55); }
.prs-reads { margin-left: auto; display: inline-flex; align-items: baseline; gap: 6px; white-space: nowrap; }
.prs-reads b { font-family: var(--cb-serif, Sora), sans-serif; font-weight: 400; font-size: 20px; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; color: rgb(var(--nt-fg, 255 255 255)); }
.prs-reads span { font-size: 11.5px; font-weight: 700; color: rgb(var(--nt-fg, 255 255 255) / .66); }
.prs-link { font-size: 12px; font-weight: 800; color: rgb(var(--nt-fg, 255 255 255)); text-decoration: none; border-bottom: 2px solid var(--cb-accent); padding-bottom: 1px; }
.prs-extra { margin-top: 8px; }
.prs-extra:empty { display: none; }
.prs-extra details.drill { border-top-color: rgb(var(--nt-fg, 255 255 255) / .08) !important; }

/* the row's Open control (the full drawer) and the inline LinkedIn preview */
.prs-open { flex: none; margin-left: auto; display: inline-flex; align-items: center; gap: 4px; min-height: 30px; padding: 4px 12px; border-radius: 999px; border: 1px solid rgb(var(--nt-fg, 255 255 255) / .16); background: rgb(var(--nt-fg, 255 255 255) / .04); cursor: pointer; font: 700 12px/1.2 var(--cb-body, Manrope), sans-serif; color: rgb(var(--nt-fg, 255 255 255)); white-space: nowrap; }
.prs-open:hover { border-color: var(--prs-acc-45); color: var(--cb-accent-fg, var(--cb-accent)); }
.prs-open:focus-visible { outline: 2px solid var(--cb-accent); outline-offset: 2px; }
.prs-status + .prs-open, .prs-reads + .prs-open { margin-left: 0; }
@media (max-width: 639px) { .prs-open { min-height: 28px; padding: 3px 11px; } }
.prs-row.is-open .prs-card { border-color: rgb(var(--nt-fg, 255 255 255) / .22); }
.prs-inline { margin-top: 12px; padding: clamp(6px, 1.2vw, 10px); border-radius: 16px; border: 1px solid rgb(var(--nt-fg, 255 255 255) / .12); background: rgb(var(--nt-fg, 255 255 255) / .035); }
.prs-inline > * { max-width: 555px; margin: 0 auto; }

/* >=1024: one compact line per post (date, thumb, hook, format, aim, status, open) */
@media (min-width: 1024px) {
  .prs-list { margin-top: 10px; }
  .prs-row { grid-template-columns: 104px minmax(0,1fr); column-gap: 18px; }
  .prs-row + .prs-row { margin-top: 4px; }
  .prs-rail { display: flex; align-items: baseline; justify-content: flex-start; gap: 6px; padding-top: 0; height: 50px; align-items: center; text-align: left; }
  .prs-rail::before { top: -4px; right: -9.5px; }
  .prs-row:first-child .prs-rail::before { top: 25px; }
  .prs-row:last-child .prs-rail::before { height: 29px; }
  .prs-dot { top: 20px; right: -14px; }
  .prs-wd { width: 30px; }
  .prs-d { margin-top: 0; font-size: 19px; width: 26px; }
  .prs-mo { margin-top: 0; }
  .prs-nd { padding-top: 0; }
  .prs-card { padding: 7px 10px 7px 8px; border-radius: 12px 5px 5px 5px; }
  .prs-head, .prs-head.no-img { --prs-th: 34px; grid-template-columns: var(--prs-th) minmax(0,1fr) auto; grid-template-rows: auto; column-gap: 14px; row-gap: 0; align-items: center; min-height: 34px; }
  .prs-head .prs-thumb { grid-row: auto; border-radius: 8px !important; }
  .prs-head.no-img .prs-title { grid-column: 2; }
  .prs-title { align-self: center; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .prs-head .prs-meta, .prs-head:not(.no-img) .prs-meta { grid-column: 3; flex-wrap: nowrap; gap: 8px; }
  .prs-head .prs-meta > .prs-chip { min-width: 92px; justify-content: center; }
  .prs-status, .prs-reads { margin-left: 4px; min-width: 88px; justify-content: flex-end; }
  .prs-status.is-today { min-width: 0; }
}

/* LinkedIn simulation grid: a dark stage, the posts themselves stay white */
[data-night-posts] .cb-licard-grid { background: rgb(var(--nt-fg, 255 255 255) / .025); border: 1px solid rgb(var(--nt-fg, 255 255 255) / .07); border-radius: 22px 8px 8px 8px; }
[data-night-posts] .cb-licard-grid textarea { background: #151515 !important; border-color: rgb(var(--nt-fg, 255 255 255) / .14) !important; color: rgb(var(--nt-fg, 255 255 255)) !important; }
[data-night-posts] .cb-licard [data-sched-tag] { box-shadow: 0 0 18px var(--prs-acc-30); }

/* lower folds (edit history, photo library) */
[data-night-posts] .prs-fold-h { align-items: center !important; padding: 4px 0 12px !important; border-bottom: 1px solid rgb(var(--nt-fg, 255 255 255) / .08) !important; }
[data-night-posts] .prs-fold-h > div:first-child { display: block; line-height: 22px; font-size: 11.5px !important; color: rgb(var(--nt-fg, 255 255 255) / .7) !important; }
[data-night-posts] .prs-fold-h > div:first-child > span[aria-hidden] { display: inline-flex !important; vertical-align: middle; margin: -2px 10px 0 0; align-items: center; justify-content: center; flex: none; width: 22px !important; height: 22px; border-radius: 999px; border: 1px solid rgb(var(--nt-fg, 255 255 255) / .12); font-size: 8px !important; color: rgb(var(--nt-fg, 255 255 255) / .66); }
[data-night-posts] .prs-fold-h[aria-expanded="true"] > div:first-child > span[aria-hidden] { border-color: var(--prs-acc-45); color: var(--cb-accent-fg, var(--cb-accent)); }
[data-night-posts] .prs-fold-h + * { margin-top: 12px; }
[data-night-posts] .prs-earlier > summary > span:first-child { font-size: 13.5px !important; font-weight: 700 !important; color: rgb(var(--nt-fg, 255 255 255) / .85) !important; }

/* QUIET (2026-09-29, "private-bank quiet, receipts first"): the same tab on a light ground.
   White cards and boxes, pale wells, ink type. Yellow only as a fill with ink text (the
   List/Calendar switch, "Ships today") and today's dot; filters pick in ink. No gradient,
   no halo. Thumbnails and the textarea carry inline dark grounds, hence the !important. */
[data-quiet] .prs-sum { background: #FFFFFF; border-color: rgba(17,17,17,.09); }
[data-quiet] .prs-lede { color: rgba(17,17,17,.66); }
[data-quiet] .prs-lede b { color: #111; }
[data-quiet] .prs-seg-ctl { background: #FFFFFF; border-color: rgba(17,17,17,.1); }
[data-quiet] .prs-tg[aria-pressed="true"] { color: #111; }
[data-quiet] .prs-tg-on { background: var(--cb-accent); border-color: var(--cb-accent); box-shadow: none; }
[data-quiet] .prs-frow .prs-tg { background: #FFFFFF; }
[data-quiet] .prs-frow .prs-tg[aria-pressed="true"] { color: #FFFFFF; background: none; }
[data-quiet] .prs-frow .prs-tg-on { background: #111; border-color: #111; }
[data-quiet] .prs-filters { border-top-color: rgba(17,17,17,.09); }
[data-quiet] .prs-sec-h::after { background: rgba(17,17,17,.12); }
[data-quiet] .prs-sec-h[aria-expanded="true"] .prs-chev { border-color: rgba(17,17,17,.3); color: #111; }
[data-quiet] .prs-sec-h[aria-expanded="true"] .prs-count { background: rgba(17,17,17,.07); color: #111; }
[data-quiet] .prs-dot { background: #FFFFFF; border-color: rgba(17,17,17,.35); }
[data-quiet] .prs-row.is-next .prs-dot { background: #FFFFFF; border: 2px solid #111; box-shadow: none; }
[data-quiet] .prs-row.is-next .prs-d { color: #111; }
[data-quiet] .prs-row.is-today .prs-dot { background: var(--cb-accent); border: 2px solid #111; box-shadow: none; }
[data-quiet] .prs-row.is-today .prs-d, [data-quiet] .prs-row.is-today .prs-wd, [data-quiet] .prs-row.is-today .prs-mo { color: #111; }
[data-quiet] .prs-card { background: #FFFFFF; border-color: rgba(17,17,17,.09); }
@media (hover: hover) { [data-quiet] .prs-card:hover { border-color: rgba(17,17,17,.22); } }
[data-quiet] .prs-row.is-today .prs-card { background: #FFFFFF; border-color: #111; box-shadow: inset 0 0 0 1px #111; }
[data-quiet] .prs-row.is-flash .prs-card { border-color: #111; }
[data-quiet] .prs-row.is-open .prs-card { border-color: rgba(17,17,17,.24); }
[data-quiet] .prs-thumb { background: #EFEFEC !important; border-color: rgba(17,17,17,.1) !important; }
[data-quiet] .prs-chip { background: #FFFFFF; border-color: rgba(17,17,17,.14); color: rgba(17,17,17,.72); }
[data-quiet] .prs-status { color: rgba(17,17,17,.62); }
[data-quiet] .prs-status.is-today { color: #111; box-shadow: none; }
[data-quiet] .prs-link { border-bottom-color: #111; border-bottom-width: 1.5px; }
[data-quiet] .prs-open { background: #FFFFFF; border-color: rgba(17,17,17,.16); }
[data-quiet] .prs-open:hover { border-color: #111; color: #111; }
[data-quiet] .prs-inline { background: none; border: 0; padding: 0; }
[data-quiet][data-skin] .prs-inline .cb-linkedin-preview { box-shadow: none !important; border-color: rgba(17,17,17,.10) !important; }
[data-quiet] [data-night-posts] .cb-licard-grid { background: #FFFFFF; border-color: rgba(17,17,17,.09); }
[data-quiet] [data-night-posts] .cb-licard-grid textarea { background: #FFFFFF !important; border-color: rgba(17,17,17,.16) !important; color: #111 !important; }
[data-quiet][data-skin] [data-night-posts] .cb-licard [data-sched-tag] { box-shadow: none !important; }
[data-quiet][data-skin] [data-night-posts] .cb-licard-grid .cb-linkedin-preview { box-shadow: none !important; border-color: rgba(17,17,17,.10) !important; }
[data-quiet] [data-night-posts] .prs-fold-h[aria-expanded="true"] > div:first-child > span[aria-hidden] { border-color: rgba(17,17,17,.3); color: #111; }
[data-quiet] [data-surface="review"] details.drill > summary .more::after { color: rgba(17,17,17,.62); }
`;

/** One stylesheet for the tab: the perf-kit base plus this file's classes. */
export function PostsNightStyle() {
  return <style>{PK_CSS + POSTS_NIGHT_CSS}</style>;
}

/** The tab opens on one sentence built from the queue, in a glass box. No bar, no split. */
export function PostsSummary({ line }: { line: ReactNode }) {
  return (
    <section className="prs-sum" aria-label="All content">
      <p className="prs-lede">{line}</p>
    </section>
  );
}

/* ───────────────────────────── sliding toggles ───────────────────────────── */

export type SlideItem = { id: string; label: ReactNode };

/** A group of toggle buttons; the active one wears a highlight that slides between them.
 *  `segmented` draws them in one capsule (the List / Calendar switch). */
export function SlideGroup({ group, items, value, onPick, segmented = false, label }: {
  group: string; items: SlideItem[]; value: string | null; onPick: (id: string) => void; segmented?: boolean; label?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <div className={segmented ? 'prs-seg-ctl' : 'prs-frow'} role="group" aria-label={label}>
      {items.map((it) => {
        const on = value === it.id;
        return (
          <button key={it.id} type="button" className="prs-tg" aria-pressed={on} onClick={() => onPick(it.id)}>
            {on && (
              <motion.span
                layoutId={`prs-on-${group}`}
                className="prs-tg-on"
                aria-hidden
                transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 460, damping: 36 }}
              />
            )}
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

/* ───────────────────────────── section folds ───────────────────────────── */

/** `blurb` and `glyph` serve review boards, which keep the light board's words in the dark:
 *  the blurb after the count, and the fold's own ▾/▸ inside the label instead of the chevron. */
export function NightSection({ label, count, open, onToggle, aside, children, blurb, glyph = false }: {
  label: string; count: number; open: boolean; onToggle: () => void; aside?: ReactNode; children?: ReactNode; blurb?: string; glyph?: boolean;
}) {
  return (
    <div className="prs-sec">
      <div
        role="button" tabIndex={0} aria-expanded={open} className="prs-sec-h"
        onClick={onToggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
      >
        {glyph ? (
          <span className="pk-cap"><span className="prs-chev prs-glyph" aria-hidden>{open ? '▾' : '▸'}</span>{label}</span>
        ) : <>
          <span className="prs-chev" aria-hidden>
            <svg width="8" height="10" viewBox="0 0 8 10"><path d="M2 1.5 5.5 5 2 8.5" stroke="currentColor" strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
          <span className="pk-cap">{label}</span>
        </>}
        <span className="prs-count">{count}</span>
        {blurb ? <span className="prs-blurb">{blurb}</span> : null}
        {aside ? (
          <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 8, alignItems: 'center' }} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} role="presentation">{aside}</span>
        ) : null}
      </div>
      {open ? children : null}
    </div>
  );
}

/* ───────────────────────────── rail rows ───────────────────────────── */

export type RailTone = 'today' | 'next' | 'out' | 'nodate' | 'plain';

/** A dated glass card on the rail. `date` is an ISO day (YYYY-MM-DD) or null for undated.
 *  Renders at once: a long list never reveals row by row. */
export function RailRow({ date, tone, flash, open, children }: { date: string | null; tone: RailTone; flash?: boolean; open?: boolean; children: ReactNode }) {
  const d = date ? new Date(date + 'T12:00:00Z') : null;
  return (
    <li className={cx('prs-row', `is-${tone}`, flash && 'is-flash', open && 'is-open')}>
      <div className="prs-rail" aria-hidden>
        {d ? (
          <>
            <div className="prs-wd">{d.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })}</div>
            <div className="prs-d">{Number(date!.slice(8, 10))}</div>
            <div className="prs-mo">{d.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })}</div>
          </>
        ) : <div className="prs-nd">no date</div>}
        <span className="prs-dot" />
      </div>
      <div className="prs-card">{children}</div>
    </li>
  );
}

export function RailList({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <ul className="prs-list" style={style}>{children}</ul>;
}

export type StatusKind = 'today' | 'out' | 'plain';

export function StatusMark({ kind, children }: { kind: StatusKind; children: ReactNode }) {
  return <span className={cx('prs-status', `is-${kind}`)}><i aria-hidden />{children}</span>;
}

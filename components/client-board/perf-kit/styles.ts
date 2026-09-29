/**
 * perf-kit stylesheet: the ARCH monthly report's styles.css (arch-report-app), ported to
 * plain `pk-*` classes scoped under `.pk`, with the accent read from the board
 * (`--cb-accent`, RISE yellow) and the magenta removed. Every animation sits behind
 * prefers-reduced-motion: no-preference; with reduced motion the page is simply finished.
 */
export const PK_CSS = `
.pk { position: relative; overflow: hidden; isolation: isolate; background: #111; color: rgb(var(--nt-fg, 255 255 255)); font-family: var(--cb-body, Manrope), 'Helvetica Neue', Arial, sans-serif; font-size: 16px; line-height: 1.55; letter-spacing: -0.004em; -webkit-font-smoothing: antialiased; border-radius: 26px 8px 8px 8px; padding: 8px clamp(20px, 4vw, 44px) 36px; color-scheme: dark; }
@media (max-width: 639px) { .pk { margin: -24px -16px 0; border-radius: 0; padding: 4px 20px 32px; } }
.pk ::selection { background: rgba(255,199,29,.35); }
.pk :focus-visible { outline: 2px solid var(--cb-accent); outline-offset: 3px; }
.pk-sr { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
.pk-cap { font-family: var(--cb-body, Manrope), sans-serif; font-weight: 800; font-size: 11px; line-height: 1.3; letter-spacing: .14em; text-transform: uppercase; }
.pk-capline { display: flex; align-items: center; gap: 10px; color: var(--cb-accent); }
.pk-capline::before { content: ''; width: 20px; height: 1px; background: var(--cb-accent); flex: none; }
.pk-disp { font-family: var(--cb-serif, Sora), 'Helvetica Neue', Arial, sans-serif; font-weight: 400; letter-spacing: -0.03em; }
.pk-mute { color: rgb(var(--nt-fg, 255 255 255) / .55); }
.pk-panel { position: relative; border-radius: 26px 8px 8px 8px; border: 1px solid rgb(var(--nt-fg, 255 255 255) / .09); background: rgb(var(--nt-fg, 255 255 255) / .025); }
.pk-glow { position: absolute; left: -160px; top: -60px; width: 560px; height: 520px; background: radial-gradient(closest-side, rgba(255,199,29,.13), transparent); pointer-events: none; z-index: -1; }
.pk-dots { position: absolute; inset: 0; width: 100%; height: 100%; color: rgb(var(--nt-fg, 255 255 255) / .09); pointer-events: none; z-index: -1; mask-image: radial-gradient(520px 380px at 18% 22%, #000 0%, transparent 72%); -webkit-mask-image: radial-gradient(520px 380px at 18% 22%, #000 0%, transparent 72%); }

/* header */
.pk-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 16px 0; border-bottom: 1px solid rgb(var(--nt-fg, 255 255 255) / .08); }
.pk-pick { position: relative; display: inline-flex; align-items: center; }
.pk-pick select { appearance: none; -webkit-appearance: none; border: 1px solid rgb(var(--nt-fg, 255 255 255) / .2); border-radius: 999px; background: rgb(var(--nt-fg, 255 255 255) / .04); color: rgb(var(--nt-fg, 255 255 255)); font: 700 13px/1.35 var(--cb-body, Manrope), sans-serif; padding: 8px 34px 8px 15px; cursor: pointer; max-width: 100%; }
.pk-pick select option, .pk-pick select optgroup { color: #111; background: #fff; }
.pk-pick svg { position: absolute; right: 13px; pointer-events: none; color: rgb(var(--nt-fg, 255 255 255) / .7); }

/* hero */
.pk-top { display: grid; gap: 32px; padding-top: 28px; }
@media (min-width: 900px) { .pk-top { grid-template-columns: minmax(0,1fr) minmax(0,430px); gap: 48px; align-items: center; padding-top: 40px; } }
.pk-hero-h { display: flex; align-items: flex-end; gap: 16px; margin-top: 12px; }
.pk-hero-n { font-family: var(--cb-serif, Sora), sans-serif; font-weight: 300; font-size: clamp(120px, 36vw, 190px); line-height: .82; letter-spacing: -0.07em; margin-left: -4px; padding-right: .04em; }
.pk-grad { background-image: linear-gradient(90deg, var(--cb-accent), #FFE7A0, var(--cb-accent)); background-size: 300% 100%; -webkit-background-clip: text; background-clip: text; color: transparent; }
.pk-hero-l { display: block; font-size: clamp(25px, 6.6vw, 38px); line-height: 1.1; padding-bottom: 6px; }
.pk-hero-sub { display: block; margin-top: 8px; font-size: 16px; font-weight: 500; color: rgb(var(--nt-fg, 255 255 255) / .55); }
.pk-who { display: flex; align-items: center; gap: 16px; margin-top: 28px; }
.pk-note { margin-top: 26px; max-width: 56ch; border-left: 2px solid var(--cb-accent); padding-left: 16px; font-size: 17px; line-height: 1.55; color: rgb(var(--nt-fg, 255 255 255) / .82); }
.pk-quiet { margin-top: 10px; font-size: 13.5px; color: rgb(var(--nt-fg, 255 255 255) / .5); }

/* avatars */
.pk-avs { display: flex; flex: none; }
.pk-av { position: relative; display: flex; align-items: center; justify-content: center; flex: none; border-radius: 999px; border: 2px solid #111; background: var(--cb-accent); color: #111; font-weight: 800; letter-spacing: .02em; margin-left: -10px; }
.pk-av:first-child { margin-left: 0; }
.pk-av-plain { background: #2a2a2a; color: rgb(var(--nt-fg, 255 255 255)); }
.pk-av-more { background: #fff; color: #111; font-weight: 700; }

/* funnel */
.pk-fnp { padding: 22px 20px; }
@media (min-width: 768px) { .pk-fnp { padding: 28px; } }
.pk-fn { display: grid; grid-template-columns: 146px minmax(0,1fr); column-gap: 14px; margin-top: 24px; }
.pk-fn-stages { grid-column: 1; grid-row: 1; display: flex; flex-direction: column; gap: var(--fn-gap); list-style: none; margin: 0; padding: 0; }
.pk-fn-row { height: var(--fn-stage); display: flex; flex-direction: column; justify-content: center; }
.pk-fn-col { grid-column: 2; grid-row: 1; position: relative; }
.pk-fn-reveal { position: absolute; inset: 0; }
.pk-fn-svg { width: 100%; height: 100%; overflow: visible; display: block; filter: drop-shadow(0 12px 22px rgba(255,199,29,.2)); mask-image: linear-gradient(to bottom, transparent 0, #000 22px); -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 22px); }
.pk-fn-slice { stroke: #141414; stroke-width: 2; }
.pk-fn-pct { position: absolute; left: 50%; translate: -50% -50%; padding: 3px 9px; border-radius: 999px; border: 1px solid rgb(var(--nt-fg, 255 255 255) / .14); background: #171717; font-size: 12px; font-weight: 800; line-height: 1.2; font-variant-numeric: tabular-nums; color: rgb(var(--nt-fg, 255 255 255) / .85); white-space: nowrap; }
.pk-fn-num { font-family: var(--cb-serif, Sora), sans-serif; font-size: 30px; line-height: 1; letter-spacing: -0.04em; }

/* beam */
.pk-beam { pointer-events: none; position: absolute; inset: 0; border-radius: inherit; border: 1px solid transparent; mask: linear-gradient(transparent, transparent), linear-gradient(#000, #000); -webkit-mask: linear-gradient(transparent, transparent), linear-gradient(#000, #000); mask-clip: padding-box, border-box; -webkit-mask-clip: padding-box, border-box; mask-composite: intersect; -webkit-mask-composite: source-in, xor; }
.pk-beam-dot { position: absolute; aspect-ratio: 1; background: linear-gradient(to left, var(--cb-accent), rgba(255,199,29,0), transparent); }

/* sections */
.pk-sec { padding-top: 64px; }
@media (min-width: 768px) { .pk-sec { padding-top: 84px; } }
.pk-h2 { margin: 12px 0 0; font-family: var(--cb-serif, Sora), sans-serif; font-weight: 400; font-size: clamp(25px, 6.4vw, 34px); line-height: 1.15; letter-spacing: -0.03em; text-wrap: balance; color: rgb(var(--nt-fg, 255 255 255)); }

/* call cards */
.pk-cards { display: grid; gap: 12px; margin: 24px 0 0; padding: 0; list-style: none; }
@media (min-width: 768px) { .pk-cards { grid-template-columns: repeat(3, minmax(0,1fr)); gap: 16px; } }
.pk-cards > li { border-radius: 26px 8px 8px 8px; }
.pk-mcard { position: relative; isolation: isolate; overflow: hidden; height: 100%; border-radius: inherit; border: 1px solid transparent; }
.pk-mcard-glow { position: absolute; inset: 1px; z-index: 1; border-radius: inherit; pointer-events: none; }
.pk-mcard-body { position: relative; z-index: 2; height: 100%; display: flex; flex-direction: column; padding: 20px; }
@media (min-width: 768px) { .pk-mcard-body { padding: 24px; } }
.pk-pill { display: inline-flex; align-items: center; gap: 8px; flex: none; border-radius: 999px; border: 1px solid rgba(255,199,29,.35); background: rgba(255,199,29,.12); color: var(--cb-accent); padding: 6px 12px; font-size: 11px; }
.pk-pill i { width: 6px; height: 6px; border-radius: 999px; background: var(--cb-accent); display: block; }
.pk-link { display: inline-block; font-weight: 800; font-size: 13.5px; color: rgb(var(--nt-fg, 255 255 255)); text-decoration: none; border-bottom: 2px solid var(--cb-accent); padding-bottom: 1px; }

/* rows (came to you, posts) */
.pk-rows { margin: 22px 0 0; padding: 0; list-style: none; border-top: 1px solid rgb(var(--nt-fg, 255 255 255) / .14); }
.pk-rows > li { display: flex; gap: 14px; align-items: baseline; padding: 14px 0; border-bottom: 1px solid rgb(var(--nt-fg, 255 255 255) / .08); }
.pk-rows .t { flex: 1 1 auto; min-width: 0; }
.pk-rows .n { flex: none; font-family: var(--cb-serif, Sora), sans-serif; font-size: 24px; line-height: 1; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; text-align: right; min-width: 2ch; }
.pk-chip { display: inline-block; margin-left: 6px; padding: 1px 9px; border-radius: 999px; border: 1px solid rgb(var(--nt-fg, 255 255 255) / .2); font-size: 11.5px; font-weight: 700; color: rgb(var(--nt-fg, 255 255 255) / .75); vertical-align: 2px; }

/* weekly chart */
.pk-wkp { margin-top: 24px; padding: 20px 16px 8px; }
@media (min-width: 768px) { .pk-wkp { padding: 32px 32px 12px; } }
.pk-legend { display: flex; flex-wrap: wrap; gap: 6px 18px; margin: 0; padding: 0; list-style: none; font-size: 13px; font-weight: 700; color: rgb(var(--nt-fg, 255 255 255) / .7); }
.pk-legend li { display: inline-flex; align-items: center; gap: 7px; }
.pk-sw { width: 10px; height: 10px; border-radius: 3px; }
.pk-sw-msg { background: rgb(var(--nt-fg, 255 255 255) / .28); }
.pk-sw-rep { background: var(--cb-accent); }
.pk-sw-call { border-radius: 999px; background: var(--cb-accent); box-shadow: 0 0 0 3px rgba(255,199,29,.22); }
.pk-chart { --plot: 172px; --slot: 34px; --lab: 44px; position: relative; margin-top: 18px; }
@media (min-width: 768px) { .pk-chart { --plot: 240px; --slot: 40px; margin-top: 26px; } }
.pk-grid { position: absolute; left: 0; right: 0; top: var(--slot); height: var(--plot); pointer-events: none; }
.pk-gl { position: absolute; left: 0; right: 0; height: 0; border-top: 1px dashed rgb(var(--nt-fg, 255 255 255) / .08); }
.pk-gl.base { bottom: 0; border-top: 1px solid rgb(var(--nt-fg, 255 255 255) / .2); }
.pk-cols { position: relative; display: flex; }
.pk-col { position: relative; isolation: isolate; flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; align-items: center; padding: 0; border: 0; background: none; color: inherit; font: inherit; border-radius: 12px; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.pk-col::before { content: ''; position: absolute; z-index: -1; inset: calc(var(--slot) - 6px) 2px 10px; border-radius: 999px 999px 14px 14px; background: linear-gradient(to top, rgba(255,199,29,.13), rgba(255,199,29,.04) 50%, rgb(var(--nt-fg, 255 255 255) / 0)); opacity: 0; pointer-events: none; }
.pk-col.on::before { opacity: 1; }
.pk-col.on .pk-wl-t { background: var(--cb-accent); color: #111; }
@media (prefers-reduced-motion: no-preference) { .pk-col::before { transition: opacity 220ms ease; } .pk-wl-t { transition: background-color 200ms ease, color 200ms ease; } }
.pk-slot { height: var(--slot); display: flex; align-items: center; }
.pk-bars { height: var(--plot); display: flex; align-items: flex-end; gap: 3px; }
@media (min-width: 768px) { .pk-bars { gap: 7px; } }
.pk-bar { position: relative; display: block; width: clamp(11px, 3.4vw, 34px); min-height: 2px; }
.pk-fill { position: absolute; inset: 0; border-radius: 4px 4px 1px 1px; transform-origin: bottom; }
.pk-bar-msg .pk-fill { background: rgb(var(--nt-fg, 255 255 255) / .22); }
.pk-bar-rep .pk-fill { background: var(--cb-accent); box-shadow: 0 0 16px rgba(255,199,29,.28); }
.pk-col.partial .pk-fill { background-image: repeating-linear-gradient(135deg, rgba(17,17,17,.45) 0 2px, transparent 2px 6px); }
.pk-val { position: absolute; left: -12px; right: -12px; bottom: 100%; margin-bottom: 5px; text-align: center; font-size: 10.5px; font-weight: 800; line-height: 1; font-variant-numeric: tabular-nums; white-space: nowrap; }
.pk-bar-msg .pk-val { color: rgb(var(--nt-fg, 255 255 255) / .55); }
.pk-bar-rep .pk-val { color: var(--cb-accent); }
@media (min-width: 768px) { .pk-val { font-size: 13px; } }
.pk-badge { display: inline-flex; align-items: center; padding: 3px 7px; border-radius: 999px; background: var(--cb-accent); color: #111; font-size: 10.5px; font-weight: 800; line-height: 1.2; white-space: nowrap; box-shadow: 0 0 18px rgba(255,199,29,.35); }
.pk-wl { height: var(--lab); padding-top: 7px; font-size: 12px; font-weight: 700; line-height: 1.1; text-align: center; white-space: nowrap; }
@media (min-width: 768px) { .pk-wl { font-size: 13px; } }
.pk-wl-t { display: inline-block; padding: 3px 6px; border-radius: 999px; }
.pk-wl small { display: block; margin-top: 2px; font-size: 9.5px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: rgb(var(--nt-fg, 255 255 255) / .45); }
.pk-readout { margin-top: 12px; min-height: 92px; }
.pk-rd-week { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin: 0; }
.pk-rd-hint { font-size: 12px; font-weight: 600; color: rgb(var(--nt-fg, 255 255 255) / .4); white-space: nowrap; }
.pk-rd-stats { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 10px; max-width: 560px; margin: 10px 0 0; }
.pk-rd-stats > div { border-left: 2px solid rgb(var(--nt-fg, 255 255 255) / .22); padding-left: 10px; display: flex; flex-direction: column; justify-content: space-between; }
.pk-rd-stats dt { font-size: 12px; font-weight: 700; line-height: 1.25; color: rgb(var(--nt-fg, 255 255 255) / .6); }
.pk-rd-stats dd { margin: 4px 0 0; font-family: var(--cb-serif, Sora), sans-serif; font-size: 30px; line-height: 1; letter-spacing: -0.04em; }
.pk-rd-stats .hi { border-left-color: var(--cb-accent); }
.pk-rd-stats .hi dd { color: var(--cb-accent); }
.pk-rd-stats .none dd { color: rgb(var(--nt-fg, 255 255 255) / .4); }

/* all numbers */
.pk-disc { display: flex; width: 100%; align-items: center; justify-content: space-between; padding: 14px 0 12px; border: 0; background: none; font: 800 15px var(--cb-body, Manrope), sans-serif; color: rgb(var(--nt-fg, 255 255 255) / .85); cursor: pointer; }
.pk-nums { width: 100%; margin-top: 4px; border-collapse: collapse; table-layout: fixed; font-variant-numeric: tabular-nums; }
.pk-nums th, .pk-nums td { padding: 10px 0 10px 6px; border-bottom: 1px solid rgb(var(--nt-fg, 255 255 255) / .07); text-align: right; font-size: 14px; font-weight: 700; line-height: 1.25; }
.pk-nums th:first-child { width: 40%; padding-left: 0; text-align: left; }
.pk-nums thead th { padding-top: 0; font-size: 9.5px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; color: rgb(var(--nt-fg, 255 255 255) / .5); border-bottom-color: rgb(var(--nt-fg, 255 255 255) / .16); }
.pk-nums td.hit { color: var(--cb-accent); font-weight: 800; }
.pk-nums td.zero { color: rgb(var(--nt-fg, 255 255 255) / .4); font-weight: 500; }
.pk-figs { margin: 6px 0 0; padding: 0; list-style: none; }
.pk-figs li { display: flex; gap: 14px; align-items: baseline; padding: 10px 0; border-bottom: 1px solid rgb(var(--nt-fg, 255 255 255) / .07); }
.pk-figs b { flex: none; min-width: 3ch; text-align: right; font-family: var(--cb-serif, Sora), sans-serif; font-size: 20px; font-weight: 400; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
.pk-figs span { font-size: 14px; line-height: 1.4; color: rgb(var(--nt-fg, 255 255 255) / .8); }
.pk-figs small { display: block; font-size: 12.5px; color: rgb(var(--nt-fg, 255 255 255) / .5); }
.pk-subcap { margin: 22px 0 6px; color: rgb(var(--nt-fg, 255 255 255) / .55); }

.pk-foot { margin-top: 40px; border-top: 1px solid rgb(var(--nt-fg, 255 255 255) / .08); padding-top: 18px; font-size: 13px; line-height: 1.55; color: rgb(var(--nt-fg, 255 255 255) / .45); text-wrap: pretty; }

/* Animated Blur Number (21st.dev, serafimcloud): only changed digits move. */
.an-root { --an-spring: linear(0, 0.028 2.5%, 0.0995 5%, 0.198 7.5%, 0.3106 10%, 0.4272 12.5%, 0.5405 15%, 0.6454 17.5%, 0.7387 20%, 0.819 22.5%, 0.8856 25%, 0.9391 27.5%, 0.9803 30%, 1.0107 32.5%, 1.0317 35%, 1.045 37.5%, 1.052 40%, 1.0543 42.5%, 1.053 45%, 1.0493 47.5%, 1.044 50%, 1.0379 52.5%, 1.0316 55%, 1.0254 57.5%, 1.0197 60%, 1.0146 62.5%, 1.0102 65%, 1.0065 67.5%, 1.0035 70%, 1.0012 72.5%, 0.9995 75%, 0.9984 77.5%, 0.9976 80%, 0.9972 82.5%, 0.9971 85%, 0.9971 87.5%, 0.9973 90%, 0.9976 92.5%, 0.9979 95%, 0.9983 97.5%, 1); --an-dist: .55em; display: inline-flex; align-items: baseline; white-space: nowrap; font-variant-numeric: tabular-nums; }
.an-slot { position: relative; display: inline-block; }
.an-layer { display: inline-block; }
.an-out { position: absolute; inset: 0; }
@media (prefers-reduced-motion: no-preference) {
  .an-in { animation: an-slide-in var(--an-dur, 450ms) var(--an-spring) both, an-resolve var(--an-dur, 450ms) cubic-bezier(.22,1,.36,1) both; }
  .an-out { animation: an-slide-out var(--an-dur, 450ms) cubic-bezier(.4,0,1,1) both, an-dissolve var(--an-dur, 450ms) cubic-bezier(.4,0,1,1) both; }
}
@media (prefers-reduced-motion: reduce) { .an-out { display: none; } }
@keyframes an-slide-in { from { transform: translateY(calc(var(--an-dir, 1) * var(--an-dist))); } to { transform: translateY(0); } }
@keyframes an-slide-out { from { transform: translateY(0); } to { transform: translateY(calc(var(--an-dir, 1) * var(--an-dist) * -1)); } }
@keyframes an-resolve { from { opacity: 0; filter: blur(var(--an-blur, 14px)); } to { opacity: 1; filter: blur(0); } }
@keyframes an-dissolve { from { opacity: 1; filter: blur(0); } to { opacity: 0; filter: blur(var(--an-blur, 14px)); } }

/* ticker */
.pk-ticker { display: inline-grid; font-variant-numeric: tabular-nums; }
.pk-ticker-ghost { visibility: hidden; grid-area: 1 / 1; }
.pk-ticker-live { grid-area: 1 / 1; }

@media print { .pk-disc-body { height: auto !important; opacity: 1 !important; } }

/* NIGHT v4: v2's look; the gradient numbers hold still and the beam never runs. */
[data-night] .pk-grad { animation: none !important; }
[data-night] .pk-beam { display: none !important; }

/* QUIET: no glow, dots or beam; money numbers in ink with a yellow marker swipe; yellow caps become ink. */
[data-quiet] .pk { background: #FFFFFF; color-scheme: light; border: 1px solid rgba(17,17,17,.08); }
@media (max-width: 639px) { [data-quiet] .pk { background: transparent; border: 0; } }
[data-quiet] .pk-glow, [data-quiet] .pk-dots, [data-quiet] .pk-beam, [data-quiet] .pk-mcard-glow { display: none !important; }
[data-quiet] .pk-grad { color: #111 !important; -webkit-text-fill-color: #111; background: linear-gradient(transparent 60%, color-mix(in srgb, var(--cb-accent) 75%, transparent) 60%, color-mix(in srgb, var(--cb-accent) 75%, transparent) 90%, transparent 90%) !important; -webkit-background-clip: border-box !important; background-clip: border-box !important; animation: none !important; }
[data-quiet] .pk-capline { color: rgba(17,17,17,.62); }
[data-quiet] .pk-mcard { background: #fff !important; border: 1px solid rgba(17,17,17,.09) !important; }
[data-quiet] [class*="glow"], [data-quiet] [class*="-lit"] { box-shadow: none !important; }
[data-quiet] .pk-fn-svg { filter: none !important; }

/* NIGHT v5 (2026-09-29, Ivan + second opinion: "glow is what reads AI-template"): dark v4 kept,
   decoration flat. No haze, dots, glow halos, lit borders or gradient text; yellow stays solid
   and only where it means something (numbers that matter, today, the main button, booked marks). */
[data-skin][data-night]:not([data-quiet]) { background: #0D0D0D !important; }
[data-night]:not([data-quiet]) .pk-glow, [data-night]:not([data-quiet]) .pk-dots, [data-night]:not([data-quiet]) .pk-mcard-glow { display: none !important; }
[data-night]:not([data-quiet]) .pk-grad { background: none !important; -webkit-background-clip: border-box !important; background-clip: border-box !important; color: var(--cb-accent) !important; -webkit-text-fill-color: var(--cb-accent); }
[data-night]:not([data-quiet]) .pk.hm-hero, [data-night]:not([data-quiet]) .hm-frame, [data-night]:not([data-quiet]) .hm-rail-line.lit, [data-night]:not([data-quiet]) .pk-fill, [data-night]:not([data-quiet]) .prs-tg-on, [data-night]:not([data-quiet]) .prs-dot, [data-night]:not([data-quiet]) .prs-card,
[data-night]:not([data-quiet]) .prs-status.is-today, [data-night]:not([data-quiet]) .pk-mcard, [data-night]:not([data-quiet]) .nln-fill, [data-night]:not([data-quiet]) .pk-badge, [data-night]:not([data-quiet]) .pn-card, [data-night]:not([data-quiet]) .pk-av, [data-night]:not([data-quiet]) .hm-hero .pk-sw-call,
[data-night]:not([data-quiet]) .hm-chart .pk-col.on .pk-fill, [data-night]:not([data-quiet]) main i, [data-night]:not([data-quiet]) .cb-stickybar button, [data-night]:not([data-quiet]) main button { box-shadow: none !important; }
[data-night]:not([data-quiet]) .pk-mcard { background: #161616 !important; border: 1px solid rgb(255 255 255 / .09) !important; }
[data-night]:not([data-quiet]) .pn-card.gold { background: #161616 !important; border-color: color-mix(in srgb, var(--cb-accent) 45%, transparent) !important; }
[data-night]:not([data-quiet]) .pk-fn-svg { filter: none !important; }
[data-skin][data-night]:not([data-quiet]) .cb-stickybar { background: #161616 !important; border-color: rgb(255 255 255 / .10) !important; }
[data-night]:not([data-quiet]) .hm-chart .pk-col.today::before, [data-night]:not([data-quiet]) .hm-chart .pk-col.on::before { background: none !important; }
/* Home on a phone: posts one screen sooner. The period already sits on the All numbers line. */
@media (max-width: 639px) {
  [data-night]:not([data-quiet]) .hm-hero .pk-capline { display: none; }
  [data-night]:not([data-quiet]) .hm-hero .pk-hero-n { font-size: clamp(88px, 26vw, 112px); }
  [data-night]:not([data-quiet]) .hm-chart { --plot: 96px; --slot: 22px; }
  [data-night]:not([data-quiet]) .hm-legend { display: none; }
}
`;

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { prefersReduced } from './editorial';

// ─────────────────────────────────────────────────────────────────────────────
// SystemFlowDiagram — the interactive "how it works" diagram for /content-system.
//
// One idea flows left → right through the whole production engine: four sources
// feed the Content Brain, a five-step pipeline drafts + de-slops it in your
// voice, you approve in one tap (the only human step), and it splits into a
// scheduled LinkedIn post and a self-publishing lead magnet — then the top
// performers loop back into the Brain so next week is weighted to what landed.
//
// Beats the Interlude proposal's dark looping SVG:
//   1. Wires self-draw on scroll-into-view (framer-motion pathLength).
//   2. Glowing "idea" particles travel each wire (SMIL animateMotion + <mpath>).
//   3. A sequenced wave + gate pulse make the pipeline feel alive, not static.
//   4. CLICK any step → it lifts, the rest dims, and a detail card opens with a
//      real screenshot from the live product (board, editor, calendar, etc.).
//   5. Rendered big, bold, and in this page's cream/sage editorial palette.
// Honours prefers-reduced-motion: fully drawn, no motion. Keyboard accessible.
// Brand source of truth: ~/.claude/memory/global/brand-visual-system.md
// ─────────────────────────────────────────────────────────────────────────────

const R = prefersReduced;

type StepDetail = {
  kicker: string;
  title: string;
  body: string;
  bullets?: string[];
  shot?: { src: string; alt: string };
};

const STEPS: Record<string, StepDetail> = {
  brain: {
    kicker: 'The engine',
    title: 'Content Brain',
    body: "It pulls ideas from your sales and partnership calls, the open web and Hacker News, your own past winners, and a news radar that scans every two hours. Then it scores every idea by how well it'll land with your buyers and picks the best. You never start from a blank page.",
    bullets: ['Four idea sources, always on', 'Fit-scored nightly', 'Newsjack radar every 2h'],
  },
  ctx: {
    kicker: 'Pipeline · 1',
    title: 'Context retrieval',
    body: 'It pulls the most relevant moments from your real calls and your strongest past posts, so the draft is grounded in things you have actually said — not generic AI filler.',
  },
  fmt: {
    kicker: 'Pipeline · 2',
    title: 'Format routing',
    body: 'It decides what the idea should become: a text post, a single image, a carousel in one of nine on-brand styles, or a full lead magnet — and routes it down the right track.',
  },
  hook: {
    kicker: 'Pipeline · 3',
    title: 'Hook generation',
    body: 'It writes a batch of opening hooks and keeps the strongest one: the first line that stops the scroll. The whole post lives or dies on this, so it gets its own step.',
  },
  write: {
    kicker: 'Pipeline · 4',
    title: 'Drafted in your voice',
    body: 'Trained on your voice and grounded in your conversations, it writes the full post so it reads like you on your best day. You can tweak any word in the editor before it ships.',
    shot: { src: '/content-system/ui/editor.webp', alt: 'The post editor — edit a draft’s copy, image, and schedule' },
  },
  qa: {
    kicker: 'Pipeline · 5',
    title: 'Anti-slop gate',
    body: 'A nine-point review checks the draft against the structural tells that make content read as AI-written, and rewrites until it passes. Slop physically cannot reach your feed.',
  },
  approve: {
    kicker: 'Your only step',
    title: 'You approve in one tap',
    body: 'Finished drafts queue on your board. Read it, tweak the copy, image or timing if you want, and tap approve. Once it is running, your daily lift is under ten minutes.',
    shot: { src: '/content-system/ui/board.webp', alt: 'The content board where finished drafts queue for one-tap approval' },
  },
  post: {
    kicker: 'Output',
    title: 'Published to LinkedIn',
    body: 'It posts natively, on your schedule, with no copy-paste. The calendar fills itself and you can see everything that is queued to go out across the month at a glance.',
    shot: { src: '/content-system/ui/calendar.webp', alt: 'The publishing calendar with scheduled posts across the month' },
  },
  leadmagnet: {
    kicker: 'Output',
    title: 'A lead magnet that publishes itself',
    body: 'From the same idea it builds an interactive asset, ships it on a live hosted page at your domain, adds every signup to your email list, and routes the best-fit leads straight to a call. No designer, no dev.',
    shot: { src: '/content-system/ui/leadmagnets.webp', alt: 'The lead-magnet studio with built, on-brand assets' },
  },
  loop: {
    kicker: 'The loop',
    title: 'It learns what works',
    body: 'Every post’s performance is tracked, and the top performers feed back into the Content Brain — so next week’s ideas are weighted toward what actually landed with your audience. The system gets sharper the longer it runs.',
    shot: { src: '/content-system/ui/performance.webp', alt: 'The performance dashboard — impressions and engagement per post' },
  },
};

// One connector wire: soft underglow + a thin self-drawing line + a travelling particle.
const Wire: React.FC<{ id: string; d: string; delay?: number; dur?: number; pDelay?: number }> = ({
  id, d, delay = 0, dur = 2.6, pDelay = 0,
}) => (
  <>
    <path className="sfd-underglow" d={d} />
    <motion.path
      id={id}
      className="sfd-wire"
      d={d}
      initial={R ? false : { pathLength: 0, opacity: 0 }}
      whileInView={R ? undefined : { pathLength: 1, opacity: 0.92 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.95, delay, ease: [0.22, 0.84, 0.36, 1] }}
    />
    {!R && (
      <circle className="sfd-particle" r={4.6}>
        <animateMotion dur={`${dur}s`} begin={`${1 + pDelay}s`} repeatCount="indefinite" rotate="auto">
          <mpath href={`#${id}`} />
        </animateMotion>
      </circle>
    )}
  </>
);

export const SystemFlowDiagram: React.FC = () => {
  const [active, setActive] = useState<string | null>(null);
  const d = active ? STEPS[active] : null;

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setActive(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);

  const Pick: React.FC<{ id: string; children: React.ReactNode }> = ({ id, children }) => (
    <g
      className={`sfd-node ${active === id ? 'is-active' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={`${STEPS[id].title} — open detail`}
      onClick={() => setActive(id)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActive(id); } }}
    >
      {children}
    </g>
  );

  const beads = [
    { id: 'ctx', x: 402, n: '1', cap: 'CONTEXT' },
    { id: 'fmt', x: 472, n: '2', cap: 'FORMAT' },
    { id: 'hook', x: 542, n: '3', cap: 'HOOK' },
    { id: 'write', x: 612, n: '4', cap: 'WRITE' },
    { id: 'qa', x: 682, n: '5', cap: 'DE-SLOP' },
  ];

  return (
    <div className={`sfd-root ${active ? 'has-active' : ''}`}>
      <style>{CSS}</style>
      <div className="sfd-wrap">
        <svg
          className="sfd"
          viewBox="0 16 1340 462"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label="How it works: your calls, the web, past winners and a news radar feed the Content Brain; a five-step pipeline drafts the post in your voice and strips AI tells; you approve in one tap — your only step; then it ships a scheduled LinkedIn post and a self-publishing lead magnet that adds every signup to your email list and books calls; top performers feed back into the brain."
        >
          <defs>
            <filter id="sfd-glow" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="3" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="sfd-soft" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="5" />
            </filter>
            <filter id="sfd-shadow" x="-60%" y="-60%" width="220%" height="220%">
              <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#1A1A1A" floodOpacity="0.18" />
            </filter>
          </defs>

          <motion.g
            initial={R ? false : { opacity: 0 }}
            whileInView={R ? undefined : { opacity: 1 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6 }}
          >
            {/* ── Feedback loop (behind everything) ─────────────────── */}
            <path className="sfd-loopwire" id="sfd-loop" d="M925,148 C 770,52 460,52 312,250" />
            {!R && (
              <circle className="sfd-particle sfd-particle-loop" r={4}>
                <animateMotion dur="5s" begin="1.4s" repeatCount="indefinite" rotate="auto">
                  <mpath href="#sfd-loop" />
                </animateMotion>
              </circle>
            )}
            <path className="sfd-loop-arrow" d="M312,250 l12,-4 l-2,12 z" />
            <text className="sfd-loop-lbl" x="600" y="44">Top performers feed back in</text>

            {/* ── Wires ─────────────────────────────────────────────── */}
            <Wire id="sfd-c1" d="M182,104 C 240,104 252,260 284,272" delay={0.05} dur={3.0} pDelay={0} />
            <Wire id="sfd-c2" d="M182,220 C 242,220 258,272 284,278" delay={0.1} dur={2.8} pDelay={0.4} />
            <Wire id="sfd-c3" d="M182,336 C 242,336 258,290 284,284" delay={0.15} dur={2.8} pDelay={0.8} />
            <Wire id="sfd-c4" d="M182,452 C 240,452 252,302 284,290" delay={0.2} dur={3.0} pDelay={1.2} />
            <Wire id="sfd-spine" d="M345,280 H 716" delay={0.5} dur={3.4} pDelay={0.3} />
            <Wire id="sfd-cli" d="M774,280 C 846,280 868,182 898,176" delay={0.85} dur={2.5} pDelay={0.2} />
            <Wire id="sfd-clm" d="M774,280 C 846,280 868,390 898,414" delay={0.85} dur={2.5} pDelay={1.0} />

            {/* Delivery fans */}
            <path className="sfd-fan" d="M952,176 H 1046" />
            <path className="sfd-fan" d="M952,414 C 1000,414 1012,366 1046,366" />
            <path className="sfd-fan" d="M952,414 H 1046" />
            <path className="sfd-fan" d="M952,414 C 1000,414 1012,452 1046,452" />

            {/* ── Sources (labels left of the dots, clear of the wires) ─ */}
            <g>
              <text className="sfd-src-lbl" x="164" y="109">Your calls</text>
              <circle className="sfd-src r1" cx="182" cy="104" r="6.5" />
              <text className="sfd-src-lbl" x="164" y="225">The web &amp; HN</text>
              <circle className="sfd-src r2" cx="182" cy="220" r="6.5" />
              <text className="sfd-src-lbl" x="164" y="341">Past winners</text>
              <circle className="sfd-src r3" cx="182" cy="336" r="6.5" />
              <text className="sfd-src-lbl" x="164" y="457">News radar · 2h</text>
              <circle className="sfd-src r4" cx="182" cy="452" r="6.5" />
            </g>

            {/* ── Content Brain ─────────────────────────────────────── */}
            <Pick id="brain">
              {!R && <circle className="sfd-ring p1" cx="312" cy="280" r="40" />}
              {!R && <circle className="sfd-ring p2" cx="312" cy="280" r="40" />}
              <circle className="sfd-core" cx="312" cy="280" r="32" />
              <circle className="sfd-core-dot" cx="312" cy="280" r="6" />
              <text className="sfd-stg" x="312" y="344">CONTENT BRAIN</text>
            </Pick>

            {/* ── Pipeline beads (sequenced activation wave) ─────────── */}
            {beads.map((b, i) => (
              <Pick id={b.id} key={b.id}>
                {!R && (
                  <circle className="sfd-bead-ring" cx={b.x} cy="280" r="23" style={{ animationDelay: `${i * 0.42}s` }} />
                )}
                <circle className="sfd-bead" cx={b.x} cy="280" r="23" />
                <text className="sfd-num" x={b.x} y="280">{b.n}</text>
                <text className="sfd-cap" x={b.x} y="318">{b.cap}</text>
              </Pick>
            ))}

            {/* ── Approve gate (attention pulse) ────────────────────── */}
            <Pick id="approve">
              <rect className="sfd-onlypill" x="684" y="205" width="122" height="22" rx="11" />
              <text className="sfd-onlypill-t" x="745" y="219">YOUR ONLY STEP</text>
              {!R && <path className="sfd-gate-pulse" d="M716,280 L745,247 L774,280 L745,313 Z" />}
              <path className="sfd-gate" d="M716,280 L745,247 L774,280 L745,313 Z" />
              <path className="sfd-check" d="M732,281 l8,9 l15,-18" />
              <text className="sfd-stg sfd-stg-em" x="745" y="344">YOU APPROVE</text>
            </Pick>

            {/* ── Outputs ───────────────────────────────────────────── */}
            <Pick id="post">
              <rect className="sfd-out" x="898" y="148" width="54" height="54" rx="13" />
              <path className="sfd-out-i" d="M913,184 v-13 M913,165 v-1 M925,184 v-9 M937,184 v-15" />
              <text className="sfd-out-lbl" x="925" y="222">LINKEDIN POST</text>
            </Pick>
            <Pick id="leadmagnet">
              <rect className="sfd-out" x="898" y="388" width="54" height="54" rx="13" />
              <path className="sfd-out-i" d="M912,404 h26 M912,414 h26 M912,424 h16" />
              <text className="sfd-out-lbl" x="925" y="462">LEAD MAGNET</text>
            </Pick>

            {/* ── Deliverables ──────────────────────────────────────── */}
            <g>
              <circle className="sfd-dlv-dot" cx="1052" cy="176" r="4.5" />
              <text className="sfd-dlv" x="1064" y="176">Posts on your schedule</text>
              <circle className="sfd-dlv-dot" cx="1052" cy="366" r="4.5" />
              <text className="sfd-dlv" x="1064" y="366">Live landing page</text>
              <circle className="sfd-dlv-dot" cx="1052" cy="414" r="4.5" />
              <text className="sfd-dlv" x="1064" y="414">Every signup to your list</text>
              <circle className="sfd-dlv-dot" cx="1052" cy="452" r="4.5" />
              <text className="sfd-dlv" x="1064" y="452">Best-fit calls booked</text>
            </g>
          </motion.g>
        </svg>
      </div>
      <p className="sfd-hint">Click any step to see it in the real product</p>

      {/* ── Detail card ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {d && (
          <motion.div
            className="sfd-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setActive(null)}
          >
            <motion.div
              className={`sfd-card ${d.shot ? 'has-shot' : ''}`}
              initial={R ? false : { opacity: 0, scale: 0.92, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={R ? undefined : { opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.28, ease: [0.22, 0.84, 0.36, 1] }}
              role="dialog"
              aria-label={d.title}
              onClick={(e) => e.stopPropagation()}
            >
              <button className="sfd-card-x" onClick={() => setActive(null)} aria-label="Close">
                <X size={18} />
              </button>
              <div className="sfd-card-text">
                <div className="sfd-card-kicker">{d.kicker}</div>
                <h4 className="sfd-card-title">{d.title}</h4>
                <p className="sfd-card-body">{d.body}</p>
                {d.bullets && (
                  <ul className="sfd-card-bul">
                    {d.bullets.map((b) => <li key={b}>{b}</li>)}
                  </ul>
                )}
              </div>
              {d.shot && (
                <div className="sfd-card-shot">
                  <div className="sfd-card-chrome" aria-hidden="true"><span /><span /><span /></div>
                  <img src={d.shot.src} alt={d.shot.alt} loading="lazy" />
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const CSS = `
.sfd-root{position:relative}
.sfd-wrap{width:100%;overflow-x:auto;overflow-y:hidden;position:relative;-webkit-overflow-scrolling:touch}
.sfd{display:block;width:100%;min-width:920px;height:auto}
.sfd text{fill:var(--color-ink-soft)}
.sfd-hint{font-family:"IBM Plex Mono",monospace;font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--color-accent-ink);margin:20px 0 0;text-align:center}
@media(max-width:820px){
  .sfd-wrap::after{content:'';position:absolute;top:0;right:0;width:42px;height:100%;background:linear-gradient(to right,rgba(247,244,239,0),var(--color-paper-sunk) 84%);pointer-events:none}
}

/* Wires */
.sfd-underglow{fill:none;stroke:var(--color-accent);stroke-width:9;opacity:.09;filter:url(#sfd-soft);stroke-linecap:round}
.sfd-wire{fill:none;stroke:var(--color-accent);stroke-width:2.4;opacity:.92;stroke-linecap:round}
.sfd-fan{fill:none;stroke:var(--color-accent);stroke-width:1.2;opacity:.34;stroke-dasharray:3 7;animation:sfd-flow 1.5s linear infinite}
@keyframes sfd-flow{to{stroke-dashoffset:-10}}
.sfd-particle{fill:#2FA876;filter:url(#sfd-glow)}
.sfd-particle-loop{fill:#5FB98A;opacity:.85}

/* Feedback loop */
.sfd-loopwire{fill:none;stroke:var(--color-accent);stroke-width:1.4;opacity:.42;stroke-dasharray:5 6;animation:sfd-flow-slow 1.6s linear infinite}
@keyframes sfd-flow-slow{to{stroke-dashoffset:-11}}
.sfd-loop-arrow{fill:var(--color-accent);opacity:.75}
.sfd-loop-lbl{font-family:"IBM Plex Mono",monospace;font-size:13px;font-weight:700;letter-spacing:.13em;text-transform:uppercase;fill:var(--color-accent-ink);text-anchor:middle;opacity:.9}

/* Sources */
.sfd-src{fill:var(--color-accent)}
.sfd-src.r1{animation:sfd-pulse 2.6s ease-in-out infinite}
.sfd-src.r2{animation:sfd-pulse 2.6s ease-in-out .7s infinite}
.sfd-src.r3{animation:sfd-pulse 2.6s ease-in-out 1.3s infinite}
.sfd-src.r4{animation:sfd-pulse 2.6s ease-in-out 1.9s infinite}
@keyframes sfd-pulse{0%,100%{opacity:.45}50%{opacity:1}}
.sfd-src-lbl{font-family:"Source Serif 4",Georgia,serif;font-style:italic;font-size:21px;fill:var(--color-ink);text-anchor:end}

/* Clickable nodes + active/dim state */
.sfd-node{cursor:pointer;outline:none;transition:opacity .3s}
.sfd-root.has-active .sfd-node:not(.is-active){opacity:.2}

/* Content Brain */
.sfd-ring{fill:none;stroke:var(--color-accent);stroke-width:1.4;transform-box:fill-box;transform-origin:center}
.sfd-ring.p1{animation:sfd-ping 3.4s ease-out infinite}
.sfd-ring.p2{animation:sfd-ping 3.4s ease-out 1.7s infinite}
@keyframes sfd-ping{0%{transform:scale(.5);opacity:.5}80%{opacity:0}100%{transform:scale(1.3);opacity:0}}
.sfd-core{fill:var(--color-paper-raise);stroke:var(--color-accent);stroke-width:2.6;filter:url(#sfd-shadow)}
.sfd-node:hover .sfd-core,.sfd-node:focus-visible .sfd-core,.sfd-node.is-active .sfd-core{filter:url(#sfd-glow);stroke-width:3.2}
.sfd-core-dot{fill:var(--color-accent);animation:sfd-pulse 2.2s ease-in-out infinite}

/* Stage labels */
.sfd-stg{font-family:"IBM Plex Mono",monospace;font-size:14.5px;font-weight:700;letter-spacing:.16em;fill:var(--color-ink);text-anchor:middle}
.sfd-stg-em{fill:var(--color-accent-ink)}

/* Pipeline beads + sequenced activation wave */
.sfd-bead{fill:var(--color-paper-raise);stroke:var(--color-accent);stroke-width:2.2;filter:url(#sfd-shadow)}
.sfd-node:hover .sfd-bead,.sfd-node:focus-visible .sfd-bead,.sfd-node.is-active .sfd-bead{filter:url(#sfd-glow);stroke-width:2.8}
.sfd-bead-ring{fill:none;stroke:var(--color-accent);stroke-width:1.8;transform-box:fill-box;transform-origin:center;opacity:0;pointer-events:none;animation:sfd-beadwave 4.6s ease-out infinite}
@keyframes sfd-beadwave{0%{transform:scale(1);opacity:.75}40%{opacity:0}100%{transform:scale(2);opacity:0}}
.sfd-num{font-family:"DM Serif Display",Georgia,serif;font-style:italic;font-size:30px;fill:var(--color-accent-ink);text-anchor:middle;dominant-baseline:central;pointer-events:none}
.sfd-cap{font-family:"IBM Plex Mono",monospace;font-size:11px;font-weight:700;letter-spacing:.08em;fill:var(--color-ink-mute);text-anchor:middle}

/* Approve gate + attention pulse */
.sfd-gate{fill:var(--color-accent-soft);stroke:var(--color-accent);stroke-width:2.6;filter:url(#sfd-shadow)}
.sfd-node:hover .sfd-gate,.sfd-node:focus-visible .sfd-gate,.sfd-node.is-active .sfd-gate{filter:url(#sfd-glow);stroke-width:3.2}
.sfd-gate-pulse{fill:none;stroke:var(--color-accent);stroke-width:2;transform-box:fill-box;transform-origin:center;opacity:0;pointer-events:none;animation:sfd-gatepulse 2.8s ease-out infinite}
@keyframes sfd-gatepulse{0%{transform:scale(1);opacity:.6}70%{opacity:0}100%{transform:scale(1.5);opacity:0}}
.sfd-check{stroke:var(--color-accent-ink);stroke-width:3;fill:none;stroke-linecap:round;stroke-linejoin:round}
.sfd-onlypill{fill:var(--color-accent)}
.sfd-onlypill-t{font-family:"IBM Plex Mono",monospace;font-size:9.5px;font-weight:700;letter-spacing:.14em;fill:#fff;text-anchor:middle}

/* Outputs */
.sfd-out{fill:var(--color-accent-soft);stroke:var(--color-accent);stroke-width:2.2;filter:url(#sfd-shadow)}
.sfd-node:hover .sfd-out,.sfd-node:focus-visible .sfd-out,.sfd-node.is-active .sfd-out{filter:url(#sfd-glow);stroke-width:2.8}
.sfd-out-i{stroke:var(--color-accent-ink);stroke-width:2.1;fill:none;stroke-linecap:round}
.sfd-out-lbl{font-family:"IBM Plex Mono",monospace;font-size:12px;font-weight:700;letter-spacing:.1em;fill:var(--color-ink);text-anchor:middle}

/* Deliverables */
.sfd-dlv-dot{fill:var(--color-accent)}
.sfd-dlv{font-family:"IBM Plex Mono",monospace;font-size:14.5px;font-weight:600;letter-spacing:.03em;fill:var(--color-ink-soft);text-anchor:start;dominant-baseline:central}

/* Detail card overlay */
.sfd-overlay{position:absolute;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(31,30,28,.34);backdrop-filter:blur(3px);border-radius:inherit}
.sfd-card{position:relative;width:100%;max-width:580px;background:var(--color-paper-raise);border:1px solid var(--color-hairline-bold);border-radius:20px;box-shadow:0 30px 80px -24px rgba(0,0,0,.4);padding:28px 28px 26px;max-height:90%;overflow-y:auto}
.sfd-card.has-shot{max-width:960px;display:grid;grid-template-columns:1fr 1.15fr;gap:28px;align-items:center}
@media(max-width:760px){.sfd-card.has-shot{grid-template-columns:1fr;gap:18px;max-width:580px}.sfd-card.has-shot .sfd-card-shot{order:-1}}
.sfd-card-x{position:absolute;top:12px;right:12px;z-index:2;display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:9px;border:1px solid var(--color-hairline);background:var(--color-paper);color:var(--color-ink-soft);cursor:pointer;transition:background .2s,color .2s}
.sfd-card-x:hover{background:var(--color-paper-sunk);color:var(--color-ink)}
.sfd-card-kicker{font-family:"IBM Plex Mono",monospace;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--color-accent-ink);margin-bottom:10px}
.sfd-card-title{font-family:"DM Serif Display",Georgia,serif;font-size:29px;line-height:1.1;letter-spacing:-.01em;color:#1A1A1A;margin:0 0 12px}
.sfd-card-body{font-family:"Source Serif 4",Georgia,serif;font-size:16px;line-height:1.65;color:var(--color-ink-soft);margin:0}
.sfd-card-bul{list-style:none;padding:0;margin:16px 0 0;display:flex;flex-direction:column;gap:8px}
.sfd-card-bul li{position:relative;padding-left:18px;font-family:"IBM Plex Mono",monospace;font-size:11.5px;letter-spacing:.02em;color:var(--color-ink-mute);text-transform:uppercase}
.sfd-card-bul li::before{content:'';position:absolute;left:0;top:6px;width:7px;height:7px;background:var(--color-accent);border-radius:1px}
.sfd-card-shot{border-radius:12px;overflow:hidden;border:1px solid var(--color-hairline-bold);background:#0E0F12;box-shadow:0 18px 50px -18px rgba(0,0,0,.5)}
.sfd-card-chrome{display:flex;gap:6px;align-items:center;padding:9px 12px;border-bottom:1px solid rgba(255,255,255,.07)}
.sfd-card-chrome span{width:9px;height:9px;border-radius:50%;background:rgba(255,255,255,.18)}
.sfd-card-shot img{display:block;width:100%}
`;

export default SystemFlowDiagram;

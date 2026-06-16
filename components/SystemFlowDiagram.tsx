import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { prefersReduced } from './editorial';

// ─────────────────────────────────────────────────────────────────────────────
// SystemFlowDiagram — the interactive "how it works" diagram for /content-system.
//
// One idea flows left → right through the real production engine: four sources
// feed the Content Brain, a six-step pipeline drafts, QA-checks and de-slops it
// in your voice, you approve in one tap (the only human step), and it splits
// into a scheduled LinkedIn post and a self-publishing lead magnet that fans out
// into a landing page, resource page, cover, email capture and booked calls.
// Top performers loop back into the Brain.
//
// Design notes:
//   - CALM motion on purpose: wires draw once on scroll-in; then only a few slow
//     "idea" particles + one gate pulse keep it alive. No competing loops.
//   - Big and tall so every real step fits and breathes.
//   - CLICK any step → it lifts, the rest dims, a detail card opens with a real
//     product screenshot. Keyboard accessible, Esc to close.
//   - Honours prefers-reduced-motion (fully drawn, no motion).
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
    body: 'It pulls ideas from your sales calls, the open web, Hacker News, your past winners, and a news radar that scans every two hours. Then it scores each idea for how well it fits your buyers and picks the best. No blank page to face.',
    bullets: ['Four idea sources, always on', 'Fit-scored nightly', 'Newsjack radar every 2h'],
  },
  ctx: {
    kicker: 'Pipeline · 1',
    title: 'Context retrieval',
    body: 'It pulls the most relevant moments from your real calls and your strongest past posts, so the draft is built on things you have actually said, not generic filler.',
  },
  fmt: {
    kicker: 'Pipeline · 2',
    title: 'Format routing',
    body: 'It decides what the idea should become: a text post, a single image, a carousel in one of nine on-brand styles, or a full lead magnet, then sends it down the right track.',
  },
  hook: {
    kicker: 'Pipeline · 3',
    title: 'Hook generation',
    body: 'It writes a batch of opening lines and keeps the strongest one: the first line that decides whether anyone reads the rest. It earns its own step.',
  },
  write: {
    kicker: 'Pipeline · 4',
    title: 'Drafted in your voice',
    body: 'Trained on your voice and built on your real conversations, it writes the full post so it sounds like you. You can edit any word before it ships.',
    shot: { src: '/content-system/ui/editor.png', alt: 'The post editor: edit a draft’s copy, image, and schedule' },
  },
  qa: {
    kicker: 'Pipeline · 5',
    title: 'Anti-AI-patterns QA',
    body: 'A QA agent scores the draft on nine things: voice, specificity, structure, evidence, and the patterns that make writing feel machine-made. It rewrites the weak spots until the draft clears the bar.',
  },
  deslop: {
    kicker: 'Pipeline · 6',
    title: 'De-slop lint',
    body: 'A deterministic linter then strips the residual tells a model can miss: stock phrases, hedges, repetitive rhythms. The last gate before anything reaches you.',
  },
  approve: {
    kicker: 'Your only step',
    title: 'You approve in one tap',
    body: 'Finished drafts queue on your board. Read one, adjust the copy, image or timing if you want, and approve. Once it is running, your daily lift is under ten minutes.',
    shot: { src: '/content-system/ui/board.png', alt: 'The content board where finished drafts queue for one-tap approval' },
  },
  post: {
    kicker: 'Output',
    title: 'Published to LinkedIn',
    body: 'It posts natively, on your schedule, with no copy-paste. The calendar fills itself, so you can see everything queued for the month in one view.',
    shot: { src: '/content-system/ui/calendar.png', alt: 'The publishing calendar with scheduled posts across the month' },
  },
  leadmagnet: {
    kicker: 'Output',
    title: 'A lead magnet that publishes itself',
    body: 'From the same idea it builds an interactive asset and ships the whole funnel: a gated landing page, the resource page itself, an on-brand cover, and email capture that adds every signup to your list and routes the best-fit leads to a call. No designer, no dev.',
    bullets: ['Gated landing page', 'Resource page', 'On-brand cover', 'Email capture to your list'],
    shot: { src: '/content-system/ui/leadmagnets.png', alt: 'The lead-magnet studio with built, on-brand assets' },
  },
  loop: {
    kicker: 'The loop',
    title: 'It learns what works',
    body: 'Every post’s performance is tracked, and the top performers feed back into the Content Brain, so next week’s ideas lean toward what actually landed. The system sharpens the longer it runs.',
    shot: { src: '/content-system/ui/performance.png', alt: 'The performance dashboard: impressions and engagement per post' },
  },
};

// One connector wire: soft underglow + a thin self-drawing line. Particle is opt-in
// (only a few wires carry one, to keep the motion calm).
const Wire: React.FC<{ id: string; d: string; delay?: number; particle?: boolean; dur?: number; pDelay?: number }> = ({
  id, d, delay = 0, particle = false, dur = 4.5, pDelay = 0,
}) => (
  <>
    <path className="sfd-underglow" d={d} />
    <motion.path
      id={id}
      className="sfd-wire"
      d={d}
      initial={R ? false : { pathLength: 0, opacity: 0 }}
      whileInView={R ? undefined : { pathLength: 1, opacity: 0.9 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 1, delay, ease: [0.22, 0.84, 0.36, 1] }}
    />
    {!R && particle && (
      <circle className="sfd-particle" r={4}>
        <animateMotion dur={`${dur}s`} begin={`${1.1 + pDelay}s`} repeatCount="indefinite" rotate="auto">
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
      aria-label={`${STEPS[id].title}, open detail`}
      onClick={() => setActive(id)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActive(id); } }}
    >
      {children}
    </g>
  );

  const beads = [
    { id: 'ctx', x: 470, n: '1', cap: 'CONTEXT' },
    { id: 'fmt', x: 540, n: '2', cap: 'FORMAT' },
    { id: 'hook', x: 610, n: '3', cap: 'HOOK' },
    { id: 'write', x: 680, n: '4', cap: 'WRITE' },
    { id: 'qa', x: 750, n: '5', cap: 'QA' },
    { id: 'deslop', x: 820, n: '6', cap: 'DE-SLOP' },
  ];

  const lmDeliverables = [
    { y: 398, label: 'Gated landing page' },
    { y: 434, label: 'Resource page' },
    { y: 470, label: 'On-brand cover' },
    { y: 506, label: 'Email capture → list' },
    { y: 542, label: 'Best-fit calls booked' },
  ];

  return (
    <div className={`sfd-root ${active ? 'has-active' : ''}`}>
      <style>{CSS}</style>
      <div className="sfd-wrap">
        <svg
          className="sfd"
          viewBox="0 26 1440 560"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label="How it works: your calls, the web, past winners and a news radar feed the Content Brain; a six-step pipeline drafts the post in your voice, runs anti-AI-patterns QA and a de-slop lint; you approve in one tap, your only step; then it ships a scheduled LinkedIn post and a self-publishing lead magnet that fans into a landing page, resource page, cover, email capture and booked calls; top performers feed back into the brain."
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
              <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#1A1A1A" floodOpacity="0.16" />
            </filter>
          </defs>

          <motion.g
            initial={R ? false : { opacity: 0 }}
            whileInView={R ? undefined : { opacity: 1 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6 }}
          >
            {/* ── Feedback loop (behind everything) ─────────────────── */}
            <path className="sfd-loopwire" id="sfd-loop" d="M1080,178 C 880,76 540,76 340,284" />
            {!R && (
              <circle className="sfd-particle sfd-particle-loop" r={3.6}>
                <animateMotion dur="6s" begin="1.6s" repeatCount="indefinite" rotate="auto">
                  <mpath href="#sfd-loop" />
                </animateMotion>
              </circle>
            )}
            <path className="sfd-loop-arrow" d="M340,284 l13,-4 l-2,13 z" />
            <text className="sfd-loop-lbl" x="700" y="64">Top performers feed back in</text>

            {/* ── Wires (particles only on the main flow + outputs + loop) ── */}
            <Wire id="sfd-c1" d="M210,140 C 270,140 284,302 302,312" delay={0.05} />
            <Wire id="sfd-c2" d="M210,270 C 274,270 290,310 302,316" delay={0.1} />
            <Wire id="sfd-c3" d="M210,400 C 274,400 290,330 302,324" delay={0.15} />
            <Wire id="sfd-c4" d="M210,530 C 270,530 284,340 302,328" delay={0.2} />
            <Wire id="sfd-spine" d="M376,320 H 902" delay={0.5} particle dur={4.6} pDelay={0.2} />
            <Wire id="sfd-cli" d="M970,320 C 1024,320 1040,212 1053,205" delay={0.85} particle dur={4.4} pDelay={0.6} />
            <Wire id="sfd-clm" d="M970,320 C 1024,320 1040,462 1053,470" delay={0.85} particle dur={4.4} pDelay={1.4} />

            {/* LinkedIn delivery fans (static) */}
            <path className="sfd-fan" d="M1107,205 C 1136,205 1144,189 1162,189" />
            <path className="sfd-fan" d="M1107,205 C 1136,205 1144,221 1162,221" />
            {/* Lead-magnet delivery fans (static) */}
            {lmDeliverables.map((dlv) => (
              <path key={dlv.y} className="sfd-fan" d={`M1107,470 C 1142,470 1150,${dlv.y} 1162,${dlv.y}`} />
            ))}

            {/* ── Sources (labels left of dots, clear of wires) ─────── */}
            <g>
              <text className="sfd-src-lbl" x="192" y="145">Your calls</text>
              <circle className="sfd-src" cx="210" cy="140" r="7" />
              <text className="sfd-src-lbl" x="192" y="275">The web &amp; HN</text>
              <circle className="sfd-src" cx="210" cy="270" r="7" />
              <text className="sfd-src-lbl" x="192" y="405">Past winners</text>
              <circle className="sfd-src" cx="210" cy="400" r="7" />
              <text className="sfd-src-lbl" x="192" y="535">News radar · 2h</text>
              <circle className="sfd-src" cx="210" cy="530" r="7" />
            </g>

            {/* ── Content Brain ─────────────────────────────────────── */}
            <Pick id="brain">
              <circle className="sfd-core" cx="340" cy="320" r="36" />
              <circle className="sfd-core-dot" cx="340" cy="320" r="6.5" />
              <text className="sfd-stg" x="340" y="384">CONTENT BRAIN</text>
            </Pick>

            {/* ── Pipeline beads ────────────────────────────────────── */}
            {beads.map((b) => (
              <Pick id={b.id} key={b.id}>
                <circle className="sfd-bead" cx={b.x} cy="320" r="25" />
                <text className="sfd-num" x={b.x} y="320">{b.n}</text>
                <text className="sfd-cap" x={b.x} y="361">{b.cap}</text>
              </Pick>
            ))}

            {/* ── Approve gate (single attention pulse) ─────────────── */}
            <Pick id="approve">
              <rect className="sfd-onlypill" x="874" y="240" width="124" height="24" rx="12" />
              <text className="sfd-onlypill-t" x="936" y="255">YOUR ONLY STEP</text>
              {!R && <path className="sfd-gate-pulse" d="M902,320 L936,282 L970,320 L936,358 Z" />}
              <path className="sfd-gate" d="M902,320 L936,282 L970,320 L936,358 Z" />
              <path className="sfd-check" d="M922,321 l9,10 l16,-20" />
              <text className="sfd-stg sfd-stg-em" x="936" y="388">YOU APPROVE</text>
            </Pick>

            {/* ── Outputs ───────────────────────────────────────────── */}
            <Pick id="post">
              <rect className="sfd-out" x="1053" y="178" width="54" height="54" rx="13" />
              <path className="sfd-out-i" d="M1068,214 v-13 M1068,195 v-1 M1080,214 v-9 M1092,214 v-15" />
              <text className="sfd-out-lbl" x="1080" y="252">LINKEDIN POST</text>
            </Pick>
            <Pick id="leadmagnet">
              <rect className="sfd-out" x="1053" y="443" width="54" height="54" rx="13" />
              <path className="sfd-out-i" d="M1067,459 h26 M1067,469 h26 M1067,479 h16" />
              <text className="sfd-out-lbl" x="1080" y="517">LEAD MAGNET</text>
            </Pick>

            {/* ── Deliverables ──────────────────────────────────────── */}
            <g>
              <circle className="sfd-dlv-dot" cx="1166" cy="189" r="4.5" />
              <text className="sfd-dlv" x="1178" y="189">Published on your schedule</text>
              <circle className="sfd-dlv-dot" cx="1166" cy="221" r="4.5" />
              <text className="sfd-dlv" x="1178" y="221">Native, no copy-paste</text>
              {lmDeliverables.map((dlv) => (
                <g key={dlv.y}>
                  <circle className="sfd-dlv-dot" cx="1166" cy={dlv.y} r="4.5" />
                  <text className="sfd-dlv" x="1178" y={dlv.y}>{dlv.label}</text>
                </g>
              ))}
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
.sfd{display:block;width:100%;min-width:1040px;height:auto}
.sfd text{fill:var(--color-ink-soft)}
.sfd-hint{font-family:"IBM Plex Mono",monospace;font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--color-accent-ink);margin:20px 0 0;text-align:center}
@media(max-width:820px){
  .sfd-wrap::after{content:'';position:absolute;top:0;right:0;width:42px;height:100%;background:linear-gradient(to right,rgba(247,244,239,0),var(--color-paper-sunk) 84%);pointer-events:none}
}

/* Wires */
.sfd-underglow{fill:none;stroke:var(--color-accent);stroke-width:9;opacity:.08;filter:url(#sfd-soft);stroke-linecap:round}
.sfd-wire{fill:none;stroke:var(--color-accent);stroke-width:2.4;opacity:.9;stroke-linecap:round}
.sfd-fan{fill:none;stroke:var(--color-accent);stroke-width:1.4;opacity:.3;stroke-linecap:round}
.sfd-particle{fill:#2FA876;filter:url(#sfd-glow)}
.sfd-particle-loop{fill:#5FB98A;opacity:.8}

/* Feedback loop */
.sfd-loopwire{fill:none;stroke:var(--color-accent);stroke-width:1.4;opacity:.38;stroke-dasharray:6 7}
.sfd-loop-arrow{fill:var(--color-accent);opacity:.7}
.sfd-loop-lbl{font-family:"IBM Plex Mono",monospace;font-size:13px;font-weight:700;letter-spacing:.13em;text-transform:uppercase;fill:var(--color-accent-ink);text-anchor:middle;opacity:.85}

/* Sources (static, no pulsing) */
.sfd-src{fill:var(--color-accent)}
.sfd-src-lbl{font-family:"Source Serif 4",Georgia,serif;font-style:italic;font-size:21px;fill:var(--color-ink);text-anchor:end}

/* Clickable nodes + active/dim state */
.sfd-node{cursor:pointer;outline:none;transition:opacity .3s}
.sfd-root.has-active .sfd-node:not(.is-active){opacity:.2}

/* Content Brain (subtle dot pulse only) */
.sfd-core{fill:var(--color-paper-raise);stroke:var(--color-accent);stroke-width:2.6;filter:url(#sfd-shadow)}
.sfd-node:hover .sfd-core,.sfd-node:focus-visible .sfd-core,.sfd-node.is-active .sfd-core{filter:url(#sfd-glow);stroke-width:3.2}
.sfd-core-dot{fill:var(--color-accent);animation:sfd-pulse 2.6s ease-in-out infinite}
@keyframes sfd-pulse{0%,100%{opacity:.5}50%{opacity:1}}

/* Stage labels */
.sfd-stg{font-family:"IBM Plex Mono",monospace;font-size:14.5px;font-weight:700;letter-spacing:.16em;fill:var(--color-ink);text-anchor:middle}
.sfd-stg-em{fill:var(--color-accent-ink)}

/* Pipeline beads (no wave — calm) */
.sfd-bead{fill:var(--color-paper-raise);stroke:var(--color-accent);stroke-width:2.2;filter:url(#sfd-shadow)}
.sfd-node:hover .sfd-bead,.sfd-node:focus-visible .sfd-bead,.sfd-node.is-active .sfd-bead{filter:url(#sfd-glow);stroke-width:2.8}
.sfd-num{font-family:"DM Serif Display",Georgia,serif;font-style:italic;font-size:30px;fill:var(--color-accent-ink);text-anchor:middle;dominant-baseline:central;pointer-events:none}
.sfd-cap{font-family:"IBM Plex Mono",monospace;font-size:13px;font-weight:700;letter-spacing:.05em;fill:var(--color-ink);text-anchor:middle}

/* Approve gate + single attention pulse */
.sfd-gate{fill:var(--color-accent-soft);stroke:var(--color-accent);stroke-width:2.6;filter:url(#sfd-shadow)}
.sfd-node:hover .sfd-gate,.sfd-node:focus-visible .sfd-gate,.sfd-node.is-active .sfd-gate{filter:url(#sfd-glow);stroke-width:3.2}
.sfd-gate-pulse{fill:none;stroke:var(--color-accent);stroke-width:2;transform-box:fill-box;transform-origin:center;opacity:0;pointer-events:none;animation:sfd-gatepulse 3.6s ease-out infinite}
@keyframes sfd-gatepulse{0%{transform:scale(1);opacity:.5}70%{opacity:0}100%{transform:scale(1.5);opacity:0}}
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
.sfd-dlv{font-family:"IBM Plex Mono",monospace;font-size:14px;font-weight:600;letter-spacing:.03em;fill:var(--color-ink-soft);text-anchor:start;dominant-baseline:central}

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
.sfd-card-bul{list-style:none;padding:0;margin:16px 0 0;display:grid;grid-template-columns:1fr 1fr;gap:8px 16px}
.sfd-card-bul li{position:relative;padding-left:18px;font-family:"IBM Plex Mono",monospace;font-size:11px;letter-spacing:.02em;color:var(--color-ink-mute);text-transform:uppercase}
.sfd-card-bul li::before{content:'';position:absolute;left:0;top:5px;width:7px;height:7px;background:var(--color-accent);border-radius:1px}
.sfd-card-shot{border-radius:12px;overflow:hidden;border:1px solid var(--color-hairline-bold);background:#0E0F12;box-shadow:0 18px 50px -18px rgba(0,0,0,.5)}
.sfd-card-chrome{display:flex;gap:6px;align-items:center;padding:9px 12px;border-bottom:1px solid rgba(255,255,255,.07)}
.sfd-card-chrome span{width:9px;height:9px;border-radius:50%;background:rgba(255,255,255,.18)}
.sfd-card-shot img{display:block;width:100%}
`;

export default SystemFlowDiagram;

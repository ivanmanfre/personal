import React from 'react';
import { motion } from 'framer-motion';
import { prefersReduced } from './editorial';

// ─────────────────────────────────────────────────────────────────────────────
// SystemFlowDiagram — the "how it works" hero diagram for /content-system.
//
// One idea flows left → right through the whole engine: sources feed the Content
// Brain, a short pipeline drafts + de-slops it in your voice, you approve in one
// tap (the only human step), and it splits into a scheduled LinkedIn post and a
// self-publishing lead magnet that captures every signup to your email list.
//
// Built to out-class the Interlude proposal's dark looping SVG with three moves:
//   1. Wires DRAW THEMSELVES on scroll-into-view (framer-motion pathLength).
//   2. Glowing "idea" PARTICLES travel each wire continuously (SMIL animateMotion
//      + <mpath> — rock-solid cross-browser, no JS RAF loop).
//   3. Rendered in this page's cream/sage editorial palette, not transplanted dark.
// Honours prefers-reduced-motion: fully drawn, no motion.
// Brand source of truth: ~/.claude/memory/global/brand-visual-system.md
// ─────────────────────────────────────────────────────────────────────────────

const R = prefersReduced;

// One connector wire: soft underglow + a thin line that draws itself in-view, and
// (unless reduced-motion) a glowing particle that travels it on a loop.
const Wire: React.FC<{
  id: string;
  d: string;
  delay?: number;
  dur?: number;
  pDelay?: number;
}> = ({ id, d, delay = 0, dur = 2.6, pDelay = 0 }) => (
  <>
    <path className="sfd-underglow" d={d} />
    <motion.path
      id={id}
      className="sfd-wire"
      d={d}
      initial={R ? false : { pathLength: 0, opacity: 0 }}
      whileInView={R ? undefined : { pathLength: 1, opacity: 1 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.9, delay, ease: [0.22, 0.84, 0.36, 1] }}
    />
    {!R && (
      <circle className="sfd-particle" r={3.4}>
        <animateMotion dur={`${dur}s`} begin={`${1 + pDelay}s`} repeatCount="indefinite" rotate="auto">
          <mpath href={`#${id}`} />
        </animateMotion>
      </circle>
    )}
  </>
);

// A staged fade/scale-in wrapper for a node group.
const Node: React.FC<{ delay?: number; children: React.ReactNode }> = ({ delay = 0, children }) => (
  <motion.g
    className="sfd-node"
    initial={R ? false : { opacity: 0, scale: 0.7 }}
    whileInView={R ? undefined : { opacity: 1, scale: 1 }}
    viewport={{ once: true, margin: '-60px' }}
    transition={{ duration: 0.5, delay, ease: [0.22, 0.84, 0.36, 1] }}
    style={{ transformBox: 'fill-box', transformOrigin: 'center' } as React.CSSProperties}
  >
    {children}
  </motion.g>
);

export const SystemFlowDiagram: React.FC = () => {
  return (
    <div className="sfd-wrap">
      <style>{CSS}</style>
      <svg
        className="sfd"
        viewBox="0 0 1240 470"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="How it works: your calls, the web and past winners feed the Content Brain; a pipeline drafts the post in your voice and strips AI tells; you approve in one tap — your only step; then it ships a scheduled LinkedIn post and a self-publishing lead magnet that adds every signup to your email list and books calls."
      >
        <defs>
          <filter id="sfd-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="2.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="sfd-soft" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>

        {/* Ghost stage numerals — editorial depth behind the flow */}
        <text className="sfd-ghost" x="150" y="70">01</text>
        <text className="sfd-ghost" x="484" y="70">02</text>
        <text className="sfd-ghost" x="680" y="70">03</text>
        <text className="sfd-ghost" x="940" y="70">04</text>

        {/* ── Wires (drawn behind nodes) ───────────────────────────── */}
        <Wire id="sfd-c1" d="M66,112 C 168,112 198,222 268,231" delay={0.05} dur={2.9} pDelay={0} />
        <Wire id="sfd-c2" d="M66,235 H 268" delay={0.12} dur={2.6} pDelay={0.5} />
        <Wire id="sfd-c3" d="M66,358 C 168,358 198,249 268,239" delay={0.19} dur={2.9} pDelay={1} />
        <Wire id="sfd-spine" d="M332,235 H 656" delay={0.45} dur={3.1} pDelay={0.3} />
        <Wire id="sfd-cli" d="M704,235 C 772,235 792,160 858,155" delay={0.8} dur={2.4} pDelay={0.2} />
        <Wire id="sfd-clm" d="M704,235 C 772,235 792,318 858,333" delay={0.8} dur={2.4} pDelay={0.9} />

        {/* Delivery fans (static dashed, ambient flow) */}
        <path className="sfd-fan" d="M896,155 H 982" />
        <path className="sfd-fan" d="M896,333 C 944,333 956,298 982,298" />
        <path className="sfd-fan" d="M896,333 H 982" />
        <path className="sfd-fan" d="M896,333 C 944,333 956,368 982,368" />

        {/* ── Sources ──────────────────────────────────────────────── */}
        <Node delay={0}>
          <g>
            <circle className="sfd-src r1" cx="66" cy="112" r="5" />
            <text className="sfd-src-lbl" x="82" y="116">Your calls</text>
          </g>
          <g>
            <circle className="sfd-src r2" cx="66" cy="235" r="5" />
            <text className="sfd-src-lbl" x="82" y="239">The web</text>
          </g>
          <g>
            <circle className="sfd-src r3" cx="66" cy="358" r="5" />
            <text className="sfd-src-lbl" x="82" y="362">Past winners</text>
          </g>
        </Node>

        {/* ── Content Brain ────────────────────────────────────────── */}
        <g className="sfd-nodewrap" tabIndex={0}>
          <Node delay={0.3}>
            {!R && <circle className="sfd-ring p1" cx="300" cy="235" r="30" />}
            {!R && <circle className="sfd-ring p2" cx="300" cy="235" r="30" />}
            <circle className="sfd-core" cx="300" cy="235" r="22" />
            <circle className="sfd-core-dot" cx="300" cy="235" r="4.5" />
            <text className="sfd-stg" x="300" y="291">CONTENT BRAIN</text>
            <g className="sfd-detail">
              <rect x="198" y="300" width="204" height="54" rx="4" />
              <text className="sfd-dt-t" x="210" y="320">SCORES EVERY IDEA</text>
              <text className="sfd-dt-b" x="210" y="338">Ranks topics by what will</text>
              <text className="sfd-dt-b" x="210" y="352">actually land with your buyers.</text>
            </g>
          </Node>
        </g>

        {/* ── Pipeline beads ───────────────────────────────────────── */}
        {[
          { x: 412, n: '1', cap: 'DRAFT', t: 'WRITES THE DRAFT', b: 'Hook + body, end to end.' },
          { x: 484, n: '2', cap: 'VOICE', t: 'IN YOUR VOICE', b: 'Grounded in your real calls.' },
          { x: 556, n: '3', cap: 'DE-SLOP', t: 'STRIPS AI TELLS', b: 'Rewrites until it reads human.' },
        ].map((bd, i) => (
          <g className="sfd-nodewrap" tabIndex={0} key={bd.cap}>
            <Node delay={0.5 + i * 0.12}>
              <circle className="sfd-bead" cx={bd.x} cy="235" r="15" />
              <text className="sfd-num" x={bd.x} y="235">{bd.n}</text>
              <text className="sfd-cap" x={bd.x} y="266">{bd.cap}</text>
              <g className="sfd-detail">
                <rect x={bd.x - 95} y="158" width="190" height="50" rx="4" />
                <line className="sfd-dconn" x1={bd.x} y1="208" x2={bd.x} y2="220" />
                <text className="sfd-dt-t" x={bd.x - 83} y="178">{bd.t}</text>
                <text className="sfd-dt-b" x={bd.x - 83} y="196">{bd.b}</text>
              </g>
            </Node>
          </g>
        ))}

        {/* ── Approve gate — the only human step ────────────────────── */}
        <g className="sfd-nodewrap" tabIndex={0}>
          <Node delay={0.95}>
            <rect className="sfd-onlypill" x="619" y="168" width="122" height="20" rx="10" />
            <text className="sfd-onlypill-t" x="680" y="181">YOUR ONLY STEP</text>
            <path className="sfd-gate" d="M656,235 L680,211 L704,235 L680,259 Z" />
            <path className="sfd-check" d="M669,236 l7,8 l13,-16" />
            <text className="sfd-stg sfd-stg-em" x="680" y="291">YOU APPROVE</text>
            <g className="sfd-detail">
              <rect x="584" y="300" width="192" height="54" rx="4" />
              <text className="sfd-dt-t" x="596" y="320">ONE TAP</text>
              <text className="sfd-dt-b" x="596" y="338">Read it, tweak copy or timing,</text>
              <text className="sfd-dt-b" x="596" y="352">approve. Under 10 min a day.</text>
            </g>
          </Node>
        </g>

        {/* ── Outputs ──────────────────────────────────────────────── */}
        <g className="sfd-nodewrap" tabIndex={0}>
          <Node delay={1.05}>
            <rect className="sfd-out" x="858" y="136" width="38" height="38" rx="9" />
            <path className="sfd-out-i" d="M870,150 v10 M870,146 v0.5 M877,160 v-6 a0 0 0 0 1 0 0 M884,160 v-6" transform="translate(-1,-1)" />
            <text className="sfd-out-lbl" x="877" y="190">LINKEDIN POST</text>
          </Node>
          <Node delay={1.12}>
            <rect className="sfd-out" x="858" y="314" width="38" height="38" rx="9" />
            <path className="sfd-out-i" d="M870,325 h14 M870,331 h14 M870,337 h9" />
            <text className="sfd-out-lbl" x="877" y="368">LEAD MAGNET</text>
          </Node>
        </g>

        {/* ── Deliverables ─────────────────────────────────────────── */}
        <Node delay={1.25}>
          <circle className="sfd-dlv-dot" cx="988" cy="155" r="4" />
          <text className="sfd-dlv" x="1000" y="155">Posts on your schedule</text>
          <circle className="sfd-dlv-dot" cx="988" cy="298" r="4" />
          <text className="sfd-dlv" x="1000" y="298">Live landing page</text>
          <circle className="sfd-dlv-dot" cx="988" cy="333" r="4" />
          <text className="sfd-dlv" x="1000" y="333">Every signup to your list</text>
          <circle className="sfd-dlv-dot" cx="988" cy="368" r="4" />
          <text className="sfd-dlv" x="1000" y="368">Best-fit calls booked</text>
        </Node>
      </svg>
      <p className="sfd-hint">Swipe to follow the flow →</p>
    </div>
  );
};

const CSS = `
.sfd-wrap{width:100%;overflow-x:auto;overflow-y:hidden;position:relative;-webkit-overflow-scrolling:touch}
.sfd{display:block;width:100%;min-width:760px;height:auto}
.sfd text{fill:var(--color-ink-soft)}
.sfd-hint{display:none}
@media(max-width:820px){
  .sfd-wrap::after{content:'';position:absolute;top:0;right:0;width:42px;height:100%;background:linear-gradient(to right,rgba(247,244,239,0),var(--color-paper-sunk) 84%);pointer-events:none}
  .sfd-hint{display:block;font-family:"IBM Plex Mono",monospace;font-size:10px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:var(--color-accent-ink);margin:14px 0 0;text-align:center}
}

/* Wires */
.sfd-underglow{fill:none;stroke:var(--color-accent);stroke-width:6;opacity:.08;filter:url(#sfd-soft);stroke-linecap:round}
.sfd-wire{fill:none;stroke:var(--color-accent);stroke-width:1.6;opacity:.85;stroke-linecap:round}
.sfd-fan{fill:none;stroke:var(--color-accent);stroke-width:1;opacity:.32;stroke-dasharray:3 7;animation:sfd-flow 1.5s linear infinite}
@keyframes sfd-flow{to{stroke-dashoffset:-10}}
.sfd-particle{fill:#2FA876;filter:url(#sfd-glow)}

/* Ghost numerals */
.sfd-ghost{font-family:"DM Serif Display",Georgia,serif;font-style:italic;font-size:64px;fill:rgba(42,143,101,.09);text-anchor:middle;pointer-events:none;user-select:none}

/* Sources */
.sfd-src{fill:var(--color-accent)}
.sfd-src.r1{animation:sfd-pulse 2.6s ease-in-out infinite}
.sfd-src.r2{animation:sfd-pulse 2.6s ease-in-out .8s infinite}
.sfd-src.r3{animation:sfd-pulse 2.6s ease-in-out 1.6s infinite}
@keyframes sfd-pulse{0%,100%{opacity:.45}50%{opacity:1}}
.sfd-src-lbl{font-family:"Source Serif 4",Georgia,serif;font-style:italic;font-size:17px;fill:var(--color-ink-soft)}

/* Content Brain */
.sfd-ring{fill:none;stroke:var(--color-accent);stroke-width:1.2;transform-box:fill-box;transform-origin:center}
.sfd-ring.p1{animation:sfd-ping 3.4s ease-out infinite}
.sfd-ring.p2{animation:sfd-ping 3.4s ease-out 1.7s infinite}
@keyframes sfd-ping{0%{transform:scale(.5);opacity:.5}80%{opacity:0}100%{transform:scale(1.3);opacity:0}}
.sfd-core{fill:var(--color-paper-raise);stroke:var(--color-accent);stroke-width:1.6}
.sfd-core-dot{fill:var(--color-accent);animation:sfd-pulse 2.2s ease-in-out infinite}

/* Stage labels */
.sfd-stg{font-family:"IBM Plex Mono",monospace;font-size:12px;font-weight:700;letter-spacing:.16em;fill:var(--color-ink);text-anchor:middle}
.sfd-stg-em{fill:var(--color-accent-ink)}

/* Pipeline beads */
.sfd-bead{fill:var(--color-paper-raise);stroke:var(--color-accent);stroke-width:1.4;transform-box:fill-box;transform-origin:center;transition:transform .25s cubic-bezier(.22,.84,.36,1),filter .25s}
.sfd-nodewrap:hover .sfd-bead,.sfd-nodewrap:focus .sfd-bead{transform:scale(1.18);filter:url(#sfd-glow)}
.sfd-num{font-family:"DM Serif Display",Georgia,serif;font-style:italic;font-size:20px;fill:var(--color-accent-ink);text-anchor:middle;dominant-baseline:central;pointer-events:none}
.sfd-cap{font-family:"IBM Plex Mono",monospace;font-size:9px;font-weight:700;letter-spacing:.08em;fill:var(--color-ink-mute);text-anchor:middle}

/* Approve gate */
.sfd-gate{fill:var(--color-accent-soft);stroke:var(--color-accent);stroke-width:1.6;transform-box:fill-box;transform-origin:center;transition:transform .25s,filter .25s}
.sfd-nodewrap:hover .sfd-gate,.sfd-nodewrap:focus .sfd-gate{transform:scale(1.1);filter:url(#sfd-glow)}
.sfd-check{stroke:var(--color-accent-ink);stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round}
.sfd-onlypill{fill:var(--color-accent);}
.sfd-onlypill-t{font-family:"IBM Plex Mono",monospace;font-size:8.5px;font-weight:700;letter-spacing:.14em;fill:#fff;text-anchor:middle}

/* Outputs */
.sfd-out{fill:var(--color-accent-soft);stroke:var(--color-accent);stroke-width:1.4;transform-box:fill-box;transform-origin:center;transition:transform .25s,filter .25s}
.sfd-nodewrap:hover .sfd-out,.sfd-nodewrap:focus .sfd-out{transform:scale(1.08);filter:url(#sfd-glow)}
.sfd-out-i{stroke:var(--color-accent-ink);stroke-width:1.5;fill:none;stroke-linecap:round}
.sfd-out-lbl{font-family:"IBM Plex Mono",monospace;font-size:9.5px;font-weight:700;letter-spacing:.1em;fill:var(--color-ink);text-anchor:middle}

/* Deliverables */
.sfd-dlv-dot{fill:var(--color-accent)}
.sfd-dlv{font-family:"IBM Plex Mono",monospace;font-size:12px;font-weight:600;letter-spacing:.03em;fill:var(--color-ink-soft);text-anchor:start;dominant-baseline:central}

/* Hover detail cards */
.sfd-detail{opacity:0;transition:opacity .25s ease;pointer-events:none}
.sfd-nodewrap:hover .sfd-detail,.sfd-nodewrap:focus .sfd-detail{opacity:1}
.sfd-nodewrap{cursor:default;outline:none}
.sfd-detail rect{fill:var(--color-paper-raise);stroke:var(--color-accent);stroke-width:1;filter:drop-shadow(0 8px 20px rgba(0,0,0,.12))}
.sfd-dconn{stroke:var(--color-accent);stroke-width:1.2;opacity:.6}
.sfd-dt-t{font-family:"IBM Plex Mono",monospace;font-size:9px;font-weight:700;letter-spacing:.1em;fill:var(--color-accent-ink)}
.sfd-dt-b{font-family:"Source Serif 4",Georgia,serif;font-size:12px;fill:var(--color-ink-soft)}
`;

export default SystemFlowDiagram;

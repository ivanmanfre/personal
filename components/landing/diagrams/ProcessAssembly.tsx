import React, { useEffect, useMemo, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { serpentineLayout } from './layout';
import { DiagramNode } from './DiagramSvg';
import { DIAGRAM, prefersReducedMotion } from './tokens';

gsap.registerPlugin(ScrollTrigger);

// Scene 2: Diagnose → Design → Build as a pinned, scroll-scrubbed assembly.
// Stage 1 (0–33%): leak-point nodes scatter in, costliest leak outlined pink.
// Stage 2 (33–66%): connectors draw; scatter reorganizes into the pipeline;
//                   pink resolves to ink as the node gets wired in.
// Stage 3 (66–100%): sage pulse runs end-to-end; real counters settle.
// Desktop-only; the mobile fallback renders <StageSnapshot> per step.
// Reduced motion: no pin, final assembled state.

const LEAKS = ['manual triage', 'partner review', 're-keyed data', 'approval queue', 'status chasing'];
const PINK_INDEX = 3; // approval queue — the costliest leak (before-state)
const W = 560;
const H = 440;

// Hand-placed scatter (stage 1). Index-aligned with LEAKS; same coordinate
// space as the serpentine layout (which may return height > H — always read
// dimensions off the returned layout, never off W/H).
const SCATTER = [
  { cx: 150, cy: 70 },
  { cx: 430, cy: 110 },
  { cx: 110, cy: 250 },
  { cx: 460, cy: 300 },
  { cx: 260, cy: 390 },
];

type ProcessStep = { id: string; title: string; desc: React.ReactNode };

const COUNTERS = ['5% → 100% calls graded', 'multi-FTE → same-day turnaround'];

const ProcessAssembly: React.FC<{ steps: ProcessStep[] }> = ({ steps }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const ordered = useMemo(() => serpentineLayout(LEAKS, W, H), []);
  const reduced = prefersReducedMotion();

  useEffect(() => {
    if (reduced || !rootRef.current) return;
    const root = rootRef.current;
    const mm = gsap.matchMedia();
    let cancelled = false;

    mm.add('(min-width: 1024px)', () => {
      const svg = root.querySelector('svg')!;
      const groups = Array.from(svg.querySelectorAll('[data-diagram-node]')) as SVGGElement[];
      const rects = Array.from(svg.querySelectorAll('[data-node-rect]')) as SVGRectElement[];
      const ticks = Array.from(svg.querySelectorAll('[data-node-tick]')) as SVGRectElement[];
      const inkPath = svg.querySelector('[data-ink-path]') as SVGPathElement;
      const sagePath = svg.querySelector('[data-signal-path]') as SVGPathElement;
      const stepEls = Array.from(root.querySelectorAll('[data-process-step]')) as HTMLElement[];
      const counterEls = Array.from(root.querySelectorAll('[data-process-counter]')) as HTMLElement[];

      if (!inkPath || !sagePath) return;

      const inkLen = inkPath.getTotalLength();
      const sageLen = sagePath.getTotalLength();

      // initial states. NOTE: GSAP parses each <g>'s transform attribute into its
      // own x/y cache and REPLACES (not composes) the translation when x/y are
      // set — so all values here are ABSOLUTE svg coords, not offsets.
      gsap.set(groups, {
        opacity: 0,
        x: (i: number) => SCATTER[i].cx - ordered.nodes[i].w / 2,
        y: (i: number) => SCATTER[i].cy - ordered.nodes[i].h / 2,
      });
      gsap.set(inkPath, { strokeDasharray: inkLen, strokeDashoffset: inkLen });
      gsap.set(sagePath, { strokeDasharray: `${DIAGRAM.pulseLen} ${sageLen}`, strokeDashoffset: DIAGRAM.pulseLen, opacity: 1 });
      gsap.set(rects[PINK_INDEX], { stroke: DIAGRAM.pink });
      gsap.set(counterEls, { opacity: 0, y: 10 });
      gsap.set(stepEls, { opacity: 0.35 });

      // Autoplay once when the section enters view (no pin, no scrub — the
      // pinned version scroll-jacked and read as "stuck"; Ivan 2026-06-11).
      // timeScale 0.5 stretches the 3-unit choreography to ~6s of real time.
      const tl = gsap.timeline({ paused: true });
      tl.timeScale(0.5);
      // Stage 1 — Diagnose (t 0..1)
      tl.to(stepEls[0], { opacity: 1, duration: 0.1 }, 0);
      tl.to(groups, { opacity: 1, duration: 0.5, stagger: 0.12 }, 0.05);
      // Stage 2 — Design (t 1..2)
      tl.to(stepEls[0], { opacity: 0.35, duration: 0.1 }, 1);
      tl.to(stepEls[1], { opacity: 1, duration: 0.1 }, 1);
      tl.to(inkPath, { strokeDashoffset: 0, duration: 0.6, ease: 'none' }, 1.05);
      tl.to(
        groups,
        {
          x: (i: number) => ordered.nodes[i].x,
          y: (i: number) => ordered.nodes[i].y,
          duration: 0.7,
          ease: 'power2.inOut',
        },
        1.15,
      );
      tl.to(rects[PINK_INDEX], { stroke: DIAGRAM.ink, duration: 0.3 }, 1.6);
      // Stage 3 — Build (t 2..3)
      tl.to(stepEls[1], { opacity: 0.35, duration: 0.1 }, 2);
      tl.to(stepEls[2], { opacity: 1, duration: 0.1 }, 2);
      tl.to(sagePath, { strokeDashoffset: -sageLen, duration: 0.8, ease: 'none' }, 2.05);
      rects.forEach((r, i) => {
        const at = 2.05 + (i / (rects.length - 1)) * 0.8;
        tl.to(r, { stroke: DIAGRAM.inkDone, duration: 0.1 }, at);
        tl.to(ticks[i], { opacity: 1, duration: 0.1 }, at);
      });
      tl.to(counterEls, { opacity: 1, y: 0, duration: 0.3, stagger: 0.15 }, 2.6);
      // One-shot autoplay rests here forever — restore all steps to full
      // opacity so the section doesn't sit with two dimmed paragraphs.
      tl.to(stepEls, { opacity: 1, duration: 0.4 }, 3.1);

      // Webfonts (serif display faces) finish after ScrollTrigger's load-refresh
      // and shift trigger positions by hundreds of px — re-measure once ready.
      const onFonts = () => { if (!cancelled) ScrollTrigger.refresh(); };
      document.fonts.ready.then(onFonts);

      const st = ScrollTrigger.create({
        trigger: root,
        start: 'top 65%', // fire when the section is comfortably in view
        once: true,
        onEnter: () => tl.play(),
      });

      return () => {
        st.kill();
        tl.kill();
      };
    });

    return () => {
      cancelled = true;
      mm.revert();
    };
  }, [reduced, ordered]);

  // Reduced motion: final assembled state, no pin.
  const finalState = reduced;

  return (
    <div ref={rootRef} className="grid lg:grid-cols-[minmax(0,40%)_1fr] gap-12 items-center">
      <div className="flex flex-col gap-10">
        {steps.map((s) => (
          <div key={s.id} data-process-step style={finalState ? undefined : { opacity: 0.35 }}>
            <div
              style={{
                fontFamily: DIAGRAM.font,
                fontSize: 11,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: 'var(--color-accent-ink)',
                marginBottom: '8px',
              }}
            >
              {s.id}
            </div>
            <h3
              style={{
                fontFamily: '"DM Serif Display","Bodoni Moda",Georgia,serif',
                fontWeight: 400,
                fontStyle: 'italic',
                fontSize: 'clamp(1.6rem,2.2vw,2rem)',
                lineHeight: 1.1,
                letterSpacing: '-0.02em',
                color: '#1A1A1A',
                marginBottom: '10px',
              }}
            >
              {s.title}
            </h3>
            <p style={{ fontFamily: '"Source Serif 4",Georgia,serif', fontSize: '15px', lineHeight: 1.6, color: '#3D3D3B' }}>
              {s.desc}
            </p>
          </div>
        ))}
      </div>

      <div>
        <svg
          viewBox={`0 0 ${ordered.width} ${ordered.height}`}
          width="100%"
          role="img"
          aria-label="Workflow assembly: leak points are mapped, wired into a pipeline, then the system runs"
          style={{ display: 'block', overflow: 'visible' }}
        >
          <path data-ink-path d={ordered.pathD} stroke={DIAGRAM.connector} strokeWidth={DIAGRAM.nodeStroke} fill="none" />
          <path
            data-signal-path
            d={ordered.pathD}
            stroke={DIAGRAM.sage}
            strokeWidth={DIAGRAM.signalStroke}
            fill="none"
            opacity={finalState ? 1 : 0}
          />
          {ordered.nodes.map((n, i) => (
            <DiagramNode key={`${n.label}-${i}`} node={n} ticked={finalState} pink={!finalState && i === PINK_INDEX} />
          ))}
        </svg>
        <div className="flex gap-8 mt-6 flex-wrap">
          {COUNTERS.map((c) => (
            <div
              key={c}
              data-process-counter
              style={{
                fontFamily: DIAGRAM.font,
                fontSize: 13,
                letterSpacing: '0.06em',
                color: '#1A1A1A',
                opacity: finalState ? 1 : 0, // GSAP owns this when animating
              }}
            >
              {c}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Mobile fallback: one static glyph per step (no labels — at this size text
// would land under the 11px floor, so the snapshot reads as a stage glyph).
export const StageSnapshot: React.FC<{ stage: 1 | 2 | 3 }> = ({ stage }) => {
  const ordered = useMemo(() => serpentineLayout(LEAKS, W, H), []);
  return (
    <svg
      viewBox={`0 0 ${ordered.width} ${ordered.height}`}
      width="100%"
      aria-hidden="true"
      style={{ display: 'block', maxWidth: '120px' }}
    >
      {/* strokes are pre-scaled for the 560→~120px render (tokens would vanish at this scale) */}
      {stage >= 2 && (
        <path d={ordered.pathD} stroke={DIAGRAM.connector} strokeWidth={3} fill="none" />
      )}
      {stage === 3 && (
        <path d={ordered.pathD} stroke={DIAGRAM.sage} strokeWidth={4} fill="none" />
      )}
      {(stage === 1 ? SCATTER : ordered.nodes.map((n) => ({ cx: n.cx, cy: n.cy }))).map((p, i) => (
        <rect
          key={i}
          x={p.cx - 28}
          y={p.cy - 12}
          width={56}
          height={24}
          fill={DIAGRAM.paper}
          stroke={stage === 1 && i === PINK_INDEX ? DIAGRAM.pink : stage === 3 ? DIAGRAM.inkDone : DIAGRAM.ink}
          strokeWidth={2.5}
        />
      ))}
    </svg>
  );
};

export default ProcessAssembly;

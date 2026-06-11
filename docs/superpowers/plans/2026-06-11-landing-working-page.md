# The Working Page — Landing Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three brand-diagram demonstration scenes (hero pipeline, pinned process assembly, build-card micro-diagrams) to the landing page so it shows a running system instead of only describing one.

**Architecture:** A small `components/landing/diagrams/` module holds the diagram language: pure layout functions (unit-tested), SVG primitives, and one component per scene. GSAP + ScrollTrigger animate Scenes 1–2; Scene 3 is CSS-only. Framer-motion stays for everything else. Every scene has a static final-state fallback for reduced-motion and mobile.

**Tech Stack:** React 19, TypeScript, Vite, framer-motion (existing), **gsap + ScrollTrigger (new)**, vitest (node env — unit tests for pure functions only), playwright-driver for visual verification.

**Spec:** `docs/superpowers/specs/2026-06-11-landing-working-page-design.md` — read it before starting. Conversion guardrails (§8) are verification requirements, not suggestions.

**Git:** This repo has live automation committing to `main` (see memory `personal-site-concurrent-git-hazard`). Work in an isolated worktree off `origin/main`; push each milestone with `git push origin HEAD:main`. Never work directly in `~/Desktop/personal-site`'s main checkout.

**File map:**

| File | Responsibility |
|---|---|
| `components/landing/diagrams/tokens.ts` | Create — diagram language constants + reduced-motion helper |
| `components/landing/diagrams/layout.ts` | Create — pure layout math (horizontal + serpentine) |
| `components/landing/diagrams/layout.test.ts` | Create — unit tests for layout math |
| `components/landing/diagrams/DiagramSvg.tsx` | Create — `DiagramNode` SVG primitive |
| `components/landing/diagrams/BuildCardDiagram.tsx` | Create — Scene 3 static micro-diagram |
| `components/landing/diagrams/HeroPipeline.tsx` | Create — Scene 1 looping pipeline |
| `components/landing/diagrams/ProcessAssembly.tsx` | Create — Scene 2 pinned assembly + mobile snapshots |
| `components/LandingPage.tsx` | Modify — OUTCOMES data + card JSX (Scene 3), WorkSection rewrite (Scene 2) |
| `components/LandingHero.tsx` | Modify — grid layout + HeroPipeline (Scene 1) |
| `styles.css` | Modify — `.diagram-sage` hover hook |
| `~/.claude/memory/global/brand-visual-system.md` | Modify — brand doc additions (outside repo, no git) |

---

### Task 1: Worktree + GSAP install

**Files:** `package.json`, `package-lock.json`

- [ ] **Step 1: Create isolated worktree**

```bash
cd /Users/ivanmanfredi/Desktop/personal-site
git fetch origin main
git worktree add /tmp/ps-working-page origin/main
cd /tmp/ps-working-page
npm install
```

Expected: worktree at `/tmp/ps-working-page` on detached `origin/main`, deps installed. All subsequent tasks run here.

- [ ] **Step 2: Install gsap**

```bash
cd /tmp/ps-working-page && npm install gsap
```

Expected: `gsap` (^3.x) added to dependencies. ScrollTrigger ships inside the gsap package — no extra install.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add gsap for landing diagram scenes"
```

---

### Task 2: Diagram tokens

**Files:**
- Create: `components/landing/diagrams/tokens.ts`

- [ ] **Step 1: Write the tokens module**

```ts
// Diagram language tokens — canonical values for the brand's system-diagram
// vocabulary. Mirrored in brand-visual-system.md (Diagram Language section);
// if a value changes here, change it there in the same commit.
export const DIAGRAM = {
  ink: 'rgba(26,26,26,0.35)',        // node stroke, resting
  inkDone: '#1A1A1A',                // node stroke after the signal passes
  connector: 'rgba(26,26,26,0.25)',  // base connector line
  sage: '#2A8F65',                   // THE signal path — one lit path per diagram
  pink: '#E8366D',                   // before/failure states ONLY
  paper: '#F7F4EF',                  // node fill (hides the connector behind nodes)
  label: '#5A5752',                  // mono label color
  nodeStroke: 1,
  signalStroke: 1.5,
  pulseLen: 26,                      // px length of the traveling sage dash
  tick: 6,                           // sage corner square size (node done-state)
  font: '"IBM Plex Mono", monospace',
  fontSize: 11,                      // micro-type floor — never smaller
  easeCss: 'cubic-bezier(0.22, 0.84, 0.36, 1)',
} as const;

export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
```

- [ ] **Step 2: Typecheck and commit**

```bash
npx tsc --noEmit 2>&1 | grep "landing/diagrams" || echo "clean"
git add components/landing/diagrams/tokens.ts
git commit -m "feat(diagrams): brand diagram language tokens"
```

Expected: "clean".

---

### Task 3: Layout math (TDD)

**Files:**
- Create: `components/landing/diagrams/layout.test.ts`
- Create: `components/landing/diagrams/layout.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { nodeWidth, horizontalLayout, serpentineLayout, NODE_H } from './layout';

describe('nodeWidth', () => {
  it('grows with label length and respects max', () => {
    expect(nodeWidth('ab')).toBeLessThan(nodeWidth('abcdefgh'));
    expect(nodeWidth('a very very long label', 80)).toBe(80);
  });
});

describe('horizontalLayout', () => {
  const labels = ['call', 'transcript', 'rubric', 'route'];
  const l = horizontalLayout(labels, 380);

  it('places one node per label, left to right', () => {
    expect(l.nodes).toHaveLength(4);
    for (let i = 1; i < l.nodes.length; i++) {
      expect(l.nodes[i].x).toBeGreaterThan(l.nodes[i - 1].x + l.nodes[i - 1].w);
    }
  });

  it('centers nodes vertically and reports geometry', () => {
    for (const n of l.nodes) {
      expect(n.cy).toBe(l.height / 2);
      expect(n.h).toBe(NODE_H);
      expect(n.cx).toBeCloseTo(n.x + n.w / 2);
    }
  });

  it('path runs the full pipeline', () => {
    const last = l.nodes[l.nodes.length - 1];
    expect(l.pathD.startsWith('M ')).toBe(true);
    expect(l.pathD).toContain(`L ${last.x + last.w}`);
  });
});

describe('serpentineLayout', () => {
  const labels = ['call recorded', 'transcribed', 'graded vs 8-criteria rubric', 'risk flagged', 'routed < 1 hr'];
  const l = serpentineLayout(labels, 420, 520);

  it('alternates sides and descends monotonically', () => {
    for (let i = 1; i < l.nodes.length; i++) {
      expect(l.nodes[i].cy).toBeGreaterThan(l.nodes[i - 1].cy);
      expect(Math.sign(l.nodes[i].cx - 210)).not.toBe(Math.sign(l.nodes[i - 1].cx - 210));
    }
  });

  it('keeps nodes inside the canvas', () => {
    for (const n of l.nodes) {
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.x + n.w).toBeLessThanOrEqual(420);
      expect(n.y).toBeGreaterThanOrEqual(0);
      expect(n.y + n.h).toBeLessThanOrEqual(520);
    }
  });

  it('builds a cubic path through every node', () => {
    expect(l.pathD.startsWith('M ')).toBe(true);
    expect(l.pathD.split(' C ')).toHaveLength(labels.length); // M + (n-1) C segments
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run components/landing/diagrams/layout.test.ts
```

Expected: FAIL — cannot resolve `./layout`.

- [ ] **Step 3: Implement layout.ts**

```ts
export type PlacedNode = {
  label: string;
  x: number; y: number; w: number; h: number;
  cx: number; cy: number;
};

export type DiagramLayout = {
  nodes: PlacedNode[];
  pathD: string;
  width: number;
  height: number;
};

const CHAR_W = 6.6; // IBM Plex Mono advance @ 11px, approx
const PAD_X = 12;
export const NODE_H = 26;

export const nodeWidth = (label: string, maxW = Infinity): number =>
  Math.min(Math.ceil(label.length * CHAR_W) + PAD_X * 2, maxW);

export function horizontalLayout(labels: string[], width: number, height = 48): DiagramLayout {
  const widths = labels.map((l) => nodeWidth(l));
  const sum = widths.reduce((a, b) => a + b, 0);
  const gap = labels.length > 1 ? Math.max(16, (width - sum) / (labels.length - 1)) : 0;
  const cy = height / 2;
  let x = 0;
  const nodes: PlacedNode[] = labels.map((label, i) => {
    const w = widths[i];
    const n = { label, x, y: cy - NODE_H / 2, w, h: NODE_H, cx: x + w / 2, cy };
    x += w + gap;
    return n;
  });
  const last = nodes[nodes.length - 1];
  const pathD = `M ${nodes[0].x} ${cy} L ${last.x + last.w} ${cy}`;
  return { nodes, pathD, width: Math.max(width, x - gap), height };
}

export function serpentineLayout(labels: string[], width: number, height: number): DiagramLayout {
  const n = labels.length;
  const rowH = height / n;
  const nodes: PlacedNode[] = labels.map((label, i) => {
    const w = nodeWidth(label, width * 0.86);
    const rawCx = i % 2 === 0 ? width * 0.38 : width * 0.62;
    // clamp so wide nodes never overflow the canvas
    const cx = Math.min(Math.max(rawCx, w / 2), width - w / 2);
    const cy = rowH * i + rowH / 2;
    return { label, x: cx - w / 2, y: cy - NODE_H / 2, w, h: NODE_H, cx, cy };
  });
  let d = `M ${nodes[0].cx} ${nodes[0].cy}`;
  for (let i = 1; i < n; i++) {
    const a = nodes[i - 1];
    const b = nodes[i];
    const my = (a.cy + b.cy) / 2;
    d += ` C ${a.cx} ${my}, ${b.cx} ${my}, ${b.cx} ${b.cy}`;
  }
  return { nodes, pathD: d, width, height };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run components/landing/diagrams/layout.test.ts
```

Expected: all PASS. (If the serpentine alternating-sides test fails for the wide "graded vs 8-criteria rubric" node, its clamped cx crossed the centerline — narrow the clamp by reducing `width * 0.86` to `width * 0.8` and re-run.)

- [ ] **Step 5: Commit**

```bash
git add components/landing/diagrams/layout.ts components/landing/diagrams/layout.test.ts
git commit -m "feat(diagrams): layout math for horizontal + serpentine pipelines (TDD)"
```

---

### Task 4: SVG primitive

**Files:**
- Create: `components/landing/diagrams/DiagramSvg.tsx`

- [ ] **Step 1: Write the primitive**

```tsx
import React from 'react';
import { DIAGRAM } from './tokens';
import type { PlacedNode } from './layout';

// One node of a brand diagram. Sharp corners, 1px ink stroke, paper fill
// (the fill hides the connector line that runs behind every node, so a
// single path can travel the whole pipeline). data attrs are GSAP hooks.
export const DiagramNode: React.FC<{
  node: PlacedNode;
  ticked?: boolean;  // done-state: dark stroke + sage corner square
  pink?: boolean;    // before/failure state — diagrams' only sanctioned pink
}> = ({ node, ticked, pink }) => (
  <g data-diagram-node transform={`translate(${node.x}, ${node.y})`}>
    <rect
      data-node-rect
      width={node.w}
      height={node.h}
      fill={DIAGRAM.paper}
      stroke={ticked ? DIAGRAM.inkDone : pink ? DIAGRAM.pink : DIAGRAM.ink}
      strokeWidth={DIAGRAM.nodeStroke}
    />
    <text
      x={node.w / 2}
      y={node.h / 2}
      dominantBaseline="central"
      textAnchor="middle"
      fontFamily={DIAGRAM.font}
      fontSize={DIAGRAM.fontSize}
      letterSpacing="0.08em"
      fill={DIAGRAM.label}
    >
      {node.label.toUpperCase()}
    </text>
    <rect
      data-node-tick
      x={node.w - DIAGRAM.tick / 2}
      y={-DIAGRAM.tick / 2}
      width={DIAGRAM.tick}
      height={DIAGRAM.tick}
      fill={DIAGRAM.sage}
      opacity={ticked ? 1 : 0}
    />
  </g>
);
```

- [ ] **Step 2: Typecheck and commit**

```bash
npx tsc --noEmit 2>&1 | grep "landing/diagrams" || echo "clean"
git add components/landing/diagrams/DiagramSvg.tsx
git commit -m "feat(diagrams): DiagramNode SVG primitive"
```

---

### Task 5: Scene 3 — build-card micro-diagrams + receipts

**Files:**
- Create: `components/landing/diagrams/BuildCardDiagram.tsx`
- Modify: `styles.css` (append to end)
- Modify: `components/LandingPage.tsx` (OUTCOMES data ~line 305; card JSX ~line 377)

- [ ] **Step 1: Write BuildCardDiagram**

```tsx
import React, { useMemo } from 'react';
import { horizontalLayout } from './layout';
import { DiagramNode } from './DiagramSvg';
import { DIAGRAM } from './tokens';

// Scene 3: static micro-diagram on the build cards. The sage signal path
// lights on card hover via the .diagram-sage CSS hook (always lit on touch
// devices — see styles.css). No JS animation: this scene is CSS-only.
const BuildCardDiagram: React.FC<{ labels: string[] }> = ({ labels }) => {
  const layout = useMemo(() => horizontalLayout(labels, 380), [labels]);
  return (
    <svg
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      width="100%"
      role="img"
      aria-label={`Pipeline: ${labels.join(', then ')}`}
      style={{ display: 'block', maxHeight: '48px', overflow: 'visible' }}
    >
      <path d={layout.pathD} stroke={DIAGRAM.connector} strokeWidth={DIAGRAM.nodeStroke} fill="none" />
      <path
        className="diagram-sage"
        d={layout.pathD}
        stroke={DIAGRAM.sage}
        strokeWidth={DIAGRAM.signalStroke}
        fill="none"
      />
      {layout.nodes.map((n) => (
        <DiagramNode key={n.label} node={n} />
      ))}
    </svg>
  );
};

export default BuildCardDiagram;
```

- [ ] **Step 2: Append the CSS hook to `styles.css`**

```css
/* Diagram language — sage signal path reveal (Scene 3 build cards).
   Hidden until card hover; always lit where hover doesn't exist. */
.diagram-sage {
  opacity: 0;
  transition: opacity 0.35s cubic-bezier(0.22, 0.84, 0.36, 1);
}
.group:hover .diagram-sage {
  opacity: 1;
}
@media (hover: none) {
  .diagram-sage {
    opacity: 1;
  }
}
```

- [ ] **Step 3: Update OUTCOMES data in `LandingPage.tsx`**

Add the import at the top of the file:

```tsx
import BuildCardDiagram from './landing/diagrams/BuildCardDiagram';
```

Replace the four OUTCOMES entries' `qualifier` values and add a `pipeline` array to each (receipt lines per spec §7 — **each must be confirmed-real by Ivan at review**):

```tsx
const OUTCOMES = [
  {
    type: 'Sales-Call Auditor',
    category: 'Judgment-heavy AI',
    metric: '5% → 100%',
    metricLabel: 'of calls graded',
    story: "Their best manager could sample 5% of calls. Now every call is graded against her 8-criteria rubric, with risk routed within the hour.",
    qualifier: 'running daily · every call graded',
    pipeline: ['call', 'transcript', 'rubric', 'route'],
    href: '/work#case-01',
  },
  {
    type: 'Lead Magnet System',
    category: 'Productized build',
    metric: '15 min',
    metricLabel: 'idea to launched',
    story: "One idea in ClickUp generates the full package: landing page, email, smart link, scheduled post.",
    qualifier: 'idea to launched: 15 min',
    pipeline: ['idea', 'page', 'email', 'link', 'post'],
    href: '/work#case-02',
  },
  {
    type: 'SWPPP Automation',
    category: 'Back-office that runs itself',
    metric: 'Multi-FTE → same-day',
    metricLabel: 'permit turnaround',
    story: "Permit research that took hours per filing now runs intake-to-delivered across 50 states, no researcher in the loop.",
    qualifier: 'live across 50 states',
    pipeline: ['intake', 'state rules', 'research', 'delivered'],
    href: '/work#case-03',
  },
  {
    type: 'Supplier Menu Sync',
    category: 'Inventory orchestration',
    metric: '15+ hrs/week',
    metricLabel: 'manual entry removed',
    story: "Inventory from WhatsApp, supplier sites, and Google Sheets auto-consolidates into one standardized sheet, refreshed hourly.",
    qualifier: 'refreshes hourly',
    pipeline: ['wa · sites · sheets', 'consolidate', 'sheet'],
    href: '/work#case-06',
  },
];
```

- [ ] **Step 4: Insert the diagram into the card JSX**

In `BuildOutcomesSection`'s card markup, between the `{o.metricLabel}` div and the story `<p>`:

```tsx
            <div style={{ ...T.mono, marginBottom: '14px' }}>{o.metricLabel}</div>
            <div style={{ marginBottom: '18px' }}>
              <BuildCardDiagram labels={o.pipeline} />
            </div>
            <p style={{ fontFamily: '"Source Serif 4",Georgia,serif', fontSize: '14.5px', color: '#5A5752', lineHeight: 1.6, flex: 1 }}>
```

(Note: the metricLabel div's `marginBottom` changes from `'20px'` to `'14px'` to keep card rhythm.)

- [ ] **Step 5: Verify in the browser**

```bash
npm run dev &
sleep 4
PW_INSPECT_CONFIG='{"url":"http://localhost:5173","viewports":[375,1440],"waitFor":"h1"}' \
  node ~/.claude/skills/playwright-driver/templates/inspect.js | tail -n 1
```

Read the 1440 screenshot. Check: 4 cards each show a micro-diagram; nodes sharp-cornered; labels legible; no layout overflow at 375. Console errors array empty.

- [ ] **Step 6: Typecheck and commit**

```bash
npx tsc --noEmit 2>&1 | grep -E "LandingPage|landing/diagrams" || echo "clean"
git add components/landing/diagrams/BuildCardDiagram.tsx components/LandingPage.tsx styles.css
git commit -m "feat(landing): Scene 3 — build-card micro-diagrams + mono receipt lines"
```

---

### Task 6: Scene 1 — hero pipeline

**Files:**
- Create: `components/landing/diagrams/HeroPipeline.tsx`
- Modify: `components/LandingHero.tsx` (main content block, ~line 113)

- [ ] **Step 1: Write HeroPipeline**

```tsx
import React, { useEffect, useMemo, useRef } from 'react';
import gsap from 'gsap';
import { serpentineLayout, horizontalLayout } from './layout';
import { DiagramNode } from './DiagramSvg';
import { DIAGRAM, prefersReducedMotion } from './tokens';

// Scene 1: the Call Intelligence pipeline (real build) as the hero's visual
// anchor. Desktop: vertical serpentine in the right column, one sage pulse
// looping end-to-end (~5.5s travel + 2s rest). Nodes tick to done-state as
// the pulse passes. Mobile (compact): 3-node static horizontal version.
// Reduced motion: static final state (solid sage path, all nodes ticked).
const LABELS = ['call recorded', 'transcribed', 'graded vs 8-criteria rubric', 'risk flagged', 'routed < 1 hr'];
const COMPACT_LABELS = ['recorded', 'graded', 'routed'];
const W = 420;
const H = 520;
const TRAVEL = 5.5;

const HeroPipeline: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const layout = useMemo(
    () => (compact ? horizontalLayout(COMPACT_LABELS, 320, 48) : serpentineLayout(LABELS, W, H)),
    [compact],
  );
  const animate = !compact && !prefersReducedMotion();

  useEffect(() => {
    if (!animate || !svgRef.current) return;
    const svg = svgRef.current;
    const sage = svg.querySelector<SVGPathElement>('[data-signal-path]');
    const rects = Array.from(svg.querySelectorAll<SVGRectElement>('[data-node-rect]'));
    const ticks = Array.from(svg.querySelectorAll<SVGRectElement>('[data-node-tick]'));
    if (!sage) return;
    const total = sage.getTotalLength();
    gsap.set(sage, { strokeDasharray: `${DIAGRAM.pulseLen} ${total}`, opacity: 1 });
    const tl = gsap.timeline({ repeat: -1, repeatDelay: 2 });
    tl.fromTo(
      sage,
      { strokeDashoffset: DIAGRAM.pulseLen },
      { strokeDashoffset: -total, duration: TRAVEL, ease: 'none' },
      0,
    );
    rects.forEach((r, i) => {
      const at = (i / (rects.length - 1)) * TRAVEL;
      tl.fromTo(r, { stroke: DIAGRAM.ink }, { stroke: DIAGRAM.inkDone, duration: 0.3 }, at);
      tl.fromTo(ticks[i], { opacity: 0 }, { opacity: 1, duration: 0.3 }, at);
    });
    return () => {
      tl.kill();
    };
  }, [animate]);

  const isStatic = !animate; // compact or reduced-motion: render the final state
  return (
    <div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        width="100%"
        role="img"
        aria-label="Call Intelligence pipeline: call recorded, transcribed, graded against an 8-criteria rubric, risk flagged, routed within the hour"
        style={{ display: 'block', overflow: 'visible' }}
      >
        <path d={layout.pathD} stroke={DIAGRAM.connector} strokeWidth={DIAGRAM.nodeStroke} fill="none" />
        <path
          data-signal-path
          d={layout.pathD}
          stroke={DIAGRAM.sage}
          strokeWidth={DIAGRAM.signalStroke}
          fill="none"
          opacity={isStatic ? 1 : 0}
        />
        {layout.nodes.map((n) => (
          <DiagramNode key={n.label} node={n} ticked={isStatic} />
        ))}
      </svg>
      <div
        style={{
          fontFamily: DIAGRAM.font,
          fontSize: 11,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: DIAGRAM.label,
          marginTop: 12,
          textAlign: compact ? 'left' : 'right',
        }}
      >
        every call · daily
      </div>
    </div>
  );
};

export default HeroPipeline;
```

- [ ] **Step 2: Integrate into LandingHero**

Add the import at the top of `LandingHero.tsx`:

```tsx
import HeroPipeline from './landing/diagrams/HeroPipeline';
```

Replace the main-content inner container (currently `<div className="container mx-auto px-8 max-w-6xl"><div className="max-w-[680px] xl:max-w-[820px] pt-8 lg:pt-0">…copy…</div></div>`) with a two-column grid — copy left, diagram right, compact variant under the CTAs on mobile:

```tsx
        <div className="container mx-auto px-8 max-w-6xl">
          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_clamp(340px,30vw,430px)] lg:gap-16 lg:items-center">
            <div className="max-w-[680px] xl:max-w-[820px] pt-8 lg:pt-0">
              {/* …byline, headline, body, CTAs — unchanged… */}

              {/* Compact pipeline — mobile only, below the CTAs */}
              <div className="lg:hidden mt-14">
                <HeroPipeline compact />
              </div>
            </div>

            {/* Scene 1 — the system is the hero's visual object (desktop) */}
            <motion.div
              className="hidden lg:block"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.3, duration: 1.2, ease }}
              aria-hidden={false}
            >
              <HeroPipeline />
            </motion.div>
          </div>
        </div>
```

Only the wrapper structure changes — byline/headline/body/CTA JSX stays byte-identical inside the left column.

- [ ] **Step 3: Verify in the browser**

```bash
PW_INSPECT_CONFIG='{"url":"http://localhost:5173","viewports":[375,768,1440],"waitFor":"h1"}' \
  node ~/.claude/skills/playwright-driver/templates/inspect.js | tail -n 1
```

Read the 1440 screenshot: serpentine pipeline fills the right column, quieter than the headline (ink strokes lighter than headline text); headline does not wrap worse than before; CTAs above the fold. Read 375: compact 3-node version below CTAs, no horizontal scroll. Console errors empty.

**Restraint check (spec §5):** if the viewport reads busy (headline sage `2–3x` + pulse + blinking status dots), remove the `animate={{ opacity: [1, 0.2, 1] }}` pulse from the two status dots in `LandingHero.tsx` (keep the static sage squares). Judgment call — decide from the screenshot.

- [ ] **Step 4: Typecheck and commit**

```bash
npx tsc --noEmit 2>&1 | grep -E "LandingHero|landing/diagrams" || echo "clean"
git add components/landing/diagrams/HeroPipeline.tsx components/LandingHero.tsx
git commit -m "feat(landing): Scene 1 — Call Intelligence pipeline as hero visual anchor"
```

---

### Task 7: Scene 2 — pinned process assembly

**Files:**
- Create: `components/landing/diagrams/ProcessAssembly.tsx`
- Modify: `components/LandingPage.tsx` — `WorkSection` (~lines 582–667)

- [ ] **Step 1: Write ProcessAssembly**

```tsx
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

export const LEAKS = ['manual triage', 'partner review', 're-keyed data', 'approval queue', 'status chasing'];
const PINK_INDEX = 3; // approval queue — the costliest leak (before-state)
const W = 560;
const H = 440;

// Hand-placed scatter (stage 1). Index-aligned with LEAKS.
const SCATTER = [
  { cx: 150, cy: 70 },
  { cx: 430, cy: 110 },
  { cx: 110, cy: 250 },
  { cx: 460, cy: 300 },
  { cx: 260, cy: 390 },
];

export type ProcessStep = { id: string; title: string; desc: React.ReactNode };

const COUNTERS = ['5% → 100% calls graded', 'multi-FTE → same-day turnaround'];

const ProcessAssembly: React.FC<{ steps: ProcessStep[] }> = ({ steps }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const ordered = useMemo(() => serpentineLayout(LEAKS, W, H), []);
  const reduced = prefersReducedMotion();

  useEffect(() => {
    if (reduced || !rootRef.current) return;
    const root = rootRef.current;
    const svg = root.querySelector('svg')!;
    const groups = Array.from(svg.querySelectorAll<SVGGElement>('[data-diagram-node]'));
    const rects = Array.from(svg.querySelectorAll<SVGRectElement>('[data-node-rect]'));
    const ticks = Array.from(svg.querySelectorAll<SVGRectElement>('[data-node-tick]'));
    const inkPath = svg.querySelector<SVGPathElement>('[data-ink-path]')!;
    const sagePath = svg.querySelector<SVGPathElement>('[data-signal-path]')!;
    const stepEls = Array.from(root.querySelectorAll<HTMLElement>('[data-process-step]'));
    const counterEls = Array.from(root.querySelectorAll<HTMLElement>('[data-process-counter]'));

    const inkLen = inkPath.getTotalLength();
    const sageLen = sagePath.getTotalLength();

    // initial states
    gsap.set(groups, {
      opacity: 0,
      x: (i: number) => SCATTER[i].cx - ordered.nodes[i].cx,
      y: (i: number) => SCATTER[i].cy - ordered.nodes[i].cy,
    });
    gsap.set(inkPath, { strokeDasharray: inkLen, strokeDashoffset: inkLen });
    gsap.set(sagePath, { strokeDasharray: `${DIAGRAM.pulseLen} ${sageLen}`, strokeDashoffset: DIAGRAM.pulseLen, opacity: 1 });
    gsap.set(rects[PINK_INDEX], { stroke: DIAGRAM.pink });
    gsap.set(counterEls, { opacity: 0, y: 10 });
    gsap.set(stepEls, { opacity: 0.35 });

    const tl = gsap.timeline();
    // Stage 1 — Diagnose (t 0..1)
    tl.to(stepEls[0], { opacity: 1, duration: 0.1 }, 0);
    tl.to(groups, { opacity: 1, duration: 0.5, stagger: 0.12 }, 0.05);
    // Stage 2 — Design (t 1..2)
    tl.to(stepEls[0], { opacity: 0.35, duration: 0.1 }, 1);
    tl.to(stepEls[1], { opacity: 1, duration: 0.1 }, 1);
    tl.to(inkPath, { strokeDashoffset: 0, duration: 0.6, ease: 'none' }, 1.05);
    tl.to(groups, { x: 0, y: 0, duration: 0.7, ease: 'power2.inOut' }, 1.15);
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

    const st = ScrollTrigger.create({
      trigger: root,
      start: 'top top+=80',
      end: '+=150%', // spec: modest 150vh pin — conversion guardrail
      pin: true,
      scrub: 0.5,
      animation: tl,
    });
    return () => {
      st.kill();
      tl.kill();
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
          viewBox={`0 0 ${W} ${H}`}
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
            <DiagramNode key={n.label} node={n} ticked={finalState} pink={!finalState && i === PINK_INDEX} />
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
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" aria-hidden="true" style={{ display: 'block', maxWidth: '120px' }}>
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
```

- [ ] **Step 2: Rewrite WorkSection in `LandingPage.tsx`**

Add imports at the top of the file:

```tsx
import ProcessAssembly, { StageSnapshot } from './landing/diagrams/ProcessAssembly';
```

Replace the entire `WorkSection` component (the `DesignIcon` component above it is now unused — delete it and its `useScroll`/`useTransform`-only usages if nothing else references them):

```tsx
// ─── Section 5: How we work — Scene 2 pinned assembly ───────────────────────
const WorkSection: React.FC = () => {
  const steps = [
    {
      id: '01',
      title: 'Diagnose',
      desc: <>I map exactly <span style={{ fontStyle: 'italic', color: 'var(--color-accent-ink)' }}>where your time and money are leaking,</span> and hand you a clear plan: what to build first, what compounds, what to skip.</>,
    },
    {
      id: '02',
      title: 'Design',
      desc: <>I architect the full system end-to-end. Every data flow, decision point, and integration drawn out <span style={{ fontStyle: 'italic', color: 'var(--color-accent-ink)' }}>before anyone writes code.</span> You sign off on the spec. What gets built is exactly what we agreed on.</>,
    },
    {
      id: '03',
      title: 'Build',
      desc: <>I build, test, and deploy into your existing stack. Your team uses it <span style={{ fontStyle: 'italic', color: 'var(--color-accent-ink)' }}>the day it launches.</span> No multi-month rollout, no invisible progress. You see every step.</>,
    },
  ];

  return (
    <section className="py-12 md:py-20 border-t" style={DIVIDER}>
      <div className="container mx-auto px-8 max-w-6xl">
        <motion.div {...inView} className="mb-10 lg:mb-16">
          <Label>05</Label>
          <RevealH2 style={T.display('clamp(2.4rem,4vw,3.6rem)')}>
            Diagnose first.{' '}
            <span style={{ fontStyle: 'italic' }}>Build second.</span>
          </RevealH2>
        </motion.div>

        {/* Desktop: pinned scroll-scrubbed assembly */}
        <div className="hidden lg:block">
          <ProcessAssembly steps={steps} />
        </div>

        {/* Mobile: static rows with stage glyphs — never pin on touch */}
        <div className="lg:hidden flex flex-col">
          {steps.map((step, i) => (
            <motion.div
              key={step.id}
              {...inView}
              className="grid grid-cols-[1fr_96px] gap-5 py-7 border-t items-center"
              style={DIVIDER}
            >
              <div>
                <div style={{ ...T.mono, color: 'var(--color-accent-ink)', fontSize: '11px', marginBottom: '6px' }}>{step.id}</div>
                <h3 style={{ ...T.display('1.6rem'), marginBottom: '8px' }}>{step.title}</h3>
                <p style={{ ...T.serif, fontSize: '15px', lineHeight: 1.6 }}>{step.desc}</p>
              </div>
              <StageSnapshot stage={(i + 1) as 1 | 2 | 3} />
            </motion.div>
          ))}
        </div>

        <MidCTA>Want to see what I'd map in your business?</MidCTA>
      </div>
    </section>
  );
};
```

(The added `MidCTA` after the pinned zone is the spec §6 exit guardrail — the 150vh pin must not open a CTA dead zone. If a MidCTA already directly follows this section from another block, skip adding this one and verify the gap instead.)

- [ ] **Step 3: Verify the pinned scene**

```bash
cat > /tmp/pw-scene2-check.js <<'EOF'
const { chromium } = require('/Users/ivanmanfredi/.claude/skills/playwright-driver/node_modules/playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('h1');
  await page.waitForTimeout(2000);
  // find the pinned section and step through the scrub
  const y = await page.evaluate(() => {
    const el = [...document.querySelectorAll('h2')].find((h) => h.textContent.includes('Diagnose first'));
    return el.getBoundingClientRect().top + window.scrollY - 100;
  });
  for (const [i, frac] of [0, 0.25, 0.5, 0.75, 1].entries()) {
    await page.evaluate(({ y, frac }) => window.scrollTo(0, y + frac * window.innerHeight * 1.5), { y, frac });
    await page.waitForTimeout(700);
    await page.screenshot({ path: `/tmp/pw-out/scene2-${i}.png` });
  }
  await browser.close();
  console.log('done');
})();
EOF
node /tmp/pw-scene2-check.js
```

Read `/tmp/pw-out/scene2-0.png` through `scene2-4.png`. Check: stage 0–1 shows scattered nodes appearing (one pink); stage 2 shows connectors drawing + nodes converging; stage 4 shows sage path run, ticks on, both counters visible; left step copy highlights track the stages.

- [ ] **Step 4: Verify mobile + reduced motion**

```bash
PW_INSPECT_CONFIG='{"url":"http://localhost:5173","viewports":[375],"waitFor":"h1"}' \
  node ~/.claude/skills/playwright-driver/templates/inspect.js | tail -n 1
```

Read the 375 screenshot: three static rows with stage glyphs, NO pinning. Then re-run the Task-5/6 reduced-motion style capture (`reducedMotion: 'reduce'` context) and confirm the desktop section renders the final assembled state without a pin.

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit 2>&1 | grep -E "LandingPage|landing/diagrams" || echo "clean"
git add components/landing/diagrams/ProcessAssembly.tsx components/LandingPage.tsx
git commit -m "feat(landing): Scene 2 — pinned Diagnose/Design/Build assembly with real counters"
```

---

### Task 8: Brand doc update

**Files:**
- Modify: `~/.claude/memory/global/brand-visual-system.md` (memory file — no git)

- [ ] **Step 1: Apply the palette + hygiene edits**

In §1 Color Palette: replace the single sage row with the three-token family and add the contrast rule under the table:

```markdown
| Sage green | `#2A8F65` | THE accent — single color per image | PUNCTUATION only — NEVER fill or background |
| Sage light | `#4FB286` | Sage on dark bands only | Text/accents on `#1A1A1A` surfaces |
| Sage ink | `#1F6B4B` | Sage text under ~19px on paper | Contrast rule below |

**Contrast ladder:** sage `#2A8F65` on paper is 3.67:1 — any sage TEXT under ~19px on paper must use sage ink `#1F6B4B`. Large/display sage text (≥19px bold or ≥24px) may use `#2A8F65`.
```

In §2 Typography add after the table:

```markdown
**Italic discipline:** italic is for pivot phrases and one-liners ONLY — never body paragraphs (the single biggest readability tax found in the 2026-06-10 landing audit). **Micro-type floor:** no text under 11px on any surface.
```

In §3 Texture & Composition add:

```markdown
- **Dark bands:** dark `#1A1A1A` is a scarce band/block, never a default. Max one dark band per surface; two only when a closing founder block is used, and never adjacent. Paper-on-dark meta text at rgba(247,244,239,0.62) or stronger.
```

- [ ] **Step 2: Add the four new sections** (insert after §5 Voice on Image):

```markdown
## 5b. Evidence Register

Every brand surface carries at least ONE receipt: a real metric with its real unit, a real field/node/workflow name in mono, a real date, or a named outcome. Invented or rounded-for-effect numbers are an automatic reject (generalizes the fake-stats rejection of 2026-05-06). The aesthetic says "I have judgment"; the receipts say "I have proof" — both are required.

## 5c. Mono Register

Mono (IBM Plex Mono) is the system's voice; serif is the human voice. Anything that is DATA rather than prose renders mono: field names, statuses, log lines, metric labels, dates, counts, prices in tables. Sizes: 11px labels (uppercase, tracked) · 13px data lines · 18–20px featured figures. Serif speaks, mono proves. With Space Grotesk retired, mono-vs-serif is the brand's type tension.

## 5d. Diagram Language

Workflow/system diagrams are the brand's product photography. Canonical tokens (code source of truth: `personal-site/components/landing/diagrams/tokens.ts`):

| Element | Spec |
|---|---|
| Node | Sharp-cornered rect, 1px stroke `rgba(26,26,26,0.35)`, paper fill, no radius/shadow |
| Node label | Mono 11px uppercase, tracked, `#5A5752` |
| Node done-state | Stroke → `#1A1A1A` + 6px sage square at top-right corner |
| Connector | 1px `rgba(26,26,26,0.25)`, square ends, arrowheads ≤6px if any |
| Signal path | ONE active path per diagram in sage `#2A8F65` @1.5px — sage-as-punctuation extended to flows |
| Signal pulse | 8–26px sage dash traveling the path, house ease |
| Failure/before | Muted pink `#E8366D` 1px — pink's ONLY sanctioned job |
| Canvas | Always paper — diagrams never sit on dark bands |

## 5e. Motion

**Governing principle: motion demonstrates the system, it doesn't decorate the page.**

Confirmed vocabulary: sage highlight sweep behind the italic pivot (one per screen max) · sage cursor-spotlight · signal pulse traveling a diagram path · node ticking to done-state · counter settling on a REAL number. Economy: max one looping animation visible per viewport; sweeps max 2 per page. Every motion surface MUST have a complete static final-state fallback under prefers-reduced-motion (never blank, never mid-animation). Generic float/parallax with no demonstrative job is discouraged.

## 5f. Numeral Lockup (signature element)

Big italic DM Serif Display numeral + small mono-caps label, e.g. `17` over `DIAGNOSTIC QUESTIONS`. Numeral 3–6× the label's cap height; label tracked 0.14–0.22em; sage or ink numeral per the contrast ladder. Use wherever a number carries the message: metrics strips, step numbers, ROI outputs, stat cards.
```

- [ ] **Step 3: Sync the ClickUp-era references**

In §10 (ClickUp pages table) add a note at the top: `> ClickUp prompt docs retired 2026-06-04 — prompts now live in the content_prompts table + dashboard editor. Page IDs below are historical.` Update §2's "Signature type move" note to add: `(with Space Grotesk retired, serif-italic-inside-serif is a weak tell — prefer the mono register §5c for type tension).`

- [ ] **Step 4: Verify**

Re-read the edited file top to bottom once — check no contradiction with the Quick Test (§11) and that §11 gains one line: `9. If a diagram appears, it follows §5d and carries a real receipt (§5b)`.

---

### Task 9: Full verification pass + ship

**Files:** none new — verification only, then push.

- [ ] **Step 1: Unit tests + typecheck + build**

```bash
npx vitest run
npx tsc --noEmit 2>&1 | grep -E "Landing|landing/diagrams" || echo "touched files clean"
npm run build 2>&1 | tail -20
```

Expected: tests pass; touched files clean (dashboard files have known pre-existing TS errors — ignore those); build succeeds. Record the main bundle size delta vs a `git stash`-free build of `origin/main` — added JS must be ≤60KB gz (gsap core+ScrollTrigger ≈ 36KB gz; if the delta exceeds budget, lazy-import gsap inside the scene `useEffect`s via `await import('gsap')`).

- [ ] **Step 2: Multi-viewport + reduced-motion captures**

```bash
PW_INSPECT_CONFIG='{"url":"http://localhost:5173","viewports":[375,768,1440],"waitFor":"h1"}' \
  node ~/.claude/skills/playwright-driver/templates/inspect.js | tail -n 1
```

Plus a reduced-motion full-page capture (Playwright context `reducedMotion: 'reduce'`, as in Task 7 Step 4). Read every screenshot before claiming done (per `feedback-visual-work-test-yourself`). Console errors and network failures must be empty.

- [ ] **Step 3: CTA-gap measurement (spec §8 guardrail)**

```bash
cat > /tmp/pw-cta-gap.js <<'EOF'
const { chromium } = require('/Users/ivanmanfredi/.claude/skills/playwright-driver/node_modules/playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const gaps = await page.evaluate(() => {
    const ys = [...document.querySelectorAll('a[href="/start"]')]
      .map((a) => a.getBoundingClientRect().top + window.scrollY)
      .sort((a, b) => a - b);
    return ys.slice(1).map((y, i) => Math.round(y - ys[i]));
  });
  // NOTE: the Scene 2 pin adds ~150vh (1350px) of scroll between its neighbors
  // that getBoundingClientRect doesn't see — add 1350 to the gap spanning WorkSection.
  console.log(JSON.stringify({ gaps }));
  await browser.close();
})();
EOF
node /tmp/pw-cta-gap.js
```

Expected: every gap (with +1350px added to the one spanning the pinned section) ≤ ~2,600px. If exceeded, the Task 7 `MidCTA` placement needs to move closer to the pin exit.

- [ ] **Step 4: Push via refspec + verify deploy**

```bash
cd /tmp/ps-working-page
git push origin HEAD:main
```

GitHub Actions deploys main to Pages. After the workflow goes green, re-run Step 2's capture against `https://ivanmanfredi.com` and read the hero + one scene screenshot.

- [ ] **Step 5: Hand receipt lines to Ivan**

Per spec acceptance: list the four receipt lines + the Scene 2 leak labels + counters in the completion message for Ivan's confirm-real check. Any he can't verify get replaced (with a verifiable fact, never a vaguer one) in a follow-up commit.

- [ ] **Step 6: Clean up worktree**

```bash
cd /Users/ivanmanfredi/Desktop/personal-site
git worktree remove /tmp/ps-working-page --force
git pull --rebase origin main
```

# Content System — Dashboard Demo Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the real dashboard-v2 demo-ready — a guided Tour that drives the live UI through the six outcome promises, per-screen self-explanation, and a visual-consistency pass on the demo-path panels.

**Architecture:** Pure-logic modules (tour steps, demo-safe filter, state reducer, typed nav bus) are unit-tested with vitest. UI components (narrator card, spotlight, PanelIntro, lifecycle legend) follow the dashboard-v2 `dv-*` className + `--d-*` CSS-var convention and are verified visually with the playwright-driver skill. A small typed CustomEvent nav bus decouples cross-section navigation so the Tour (and existing Briefing) can drive Shell + ContentStudio.

**Tech Stack:** React 19, TypeScript 5.8 (strict), Vite 6, Tailwind 4 (v1 panels), CSS custom properties (v2), framer-motion 12, vitest 2 (node env, `*.test.ts`), playwright 1.59 (via playwright-driver skill).

**Scope:** This is **Plan 1 of 2**. Plan 2 (the `/content-system` page rebuild) is separate. This plan is presentation-layer only — no backend/n8n changes. Demo-path panels = Briefing, Content Studio ▸ Posts, Lead Magnets, Styles, Calendar, Performance, Video. All other panels are untouched.

**Source spec:** `docs/superpowers/specs/2026-06-14-content-system-demo-readiness-design.md`

---

## File Structure

**New files**
- `components/dashboard-v2/lib/navBus.ts` — typed CustomEvent nav bus (`dispatchNav`, `onNav`).
- `components/dashboard-v2/lib/navBus.test.ts` — vitest.
- `components/dashboard-v2/tour/tourSteps.ts` — declarative `TOUR_STEPS` + types.
- `components/dashboard-v2/tour/demoSafe.ts` — `DEMO_SAFE`, `getTourSteps()`.
- `components/dashboard-v2/tour/tour.test.ts` — vitest for steps + demo-safe filter.
- `components/dashboard-v2/tour/tourReducer.ts` — pure state machine.
- `components/dashboard-v2/tour/tourReducer.test.ts` — vitest.
- `components/dashboard-v2/tour/TourProvider.tsx` — context, wires reducer + navBus + URL.
- `components/dashboard-v2/tour/useTourSpotlight.ts` — scroll-to + highlight hook.
- `components/dashboard-v2/tour/TourNarratorCard.tsx` — narrator UI.
- `components/dashboard-v2/primitives/PanelIntro.tsx` — one-line purpose header + "?" popover.
- `components/dashboard-v2/primitives/LifecycleLegend.tsx` — status lifecycle legend.
- `components/dashboard-v2/lib/lifecycle.ts` — shared lifecycle stage data.

**Modified files**
- `components/dashboard-v2/dashboard-v2.css` — tour, PanelIntro, legend, consistency styles.
- `components/dashboard-v2/Shell.tsx` — Tour button, `?tour=1`, mount `TourProvider` + card, navBus section listener.
- `components/dashboard-v2/sections/ContentStudio.tsx` — navBus sub listener, PanelIntro per sub.
- `components/dashboard-v2/sections/Briefing.tsx` — `data-tour` anchors, PanelIntro.
- `components/dashboard-v2/primitives/index.ts` — export `PanelIntro`, `LifecycleLegend`.
- `components/dashboard/PostStudioPanel.tsx` — PanelIntro + lifecycle legend + empty state.
- `components/dashboard/LeadMagnetStudioPanel.tsx` — PanelIntro + empty state.
- `components/dashboard/StyleGalleryPanel.tsx` — PanelIntro.
- `components/dashboard/PerformancePanel.tsx` — PanelIntro.
- `components/dashboard/VideoStudioPanel.tsx` — PanelIntro + empty state.
- `components/dashboard-v2/sections/Calendar.tsx` (or `CalendarSection`) — PanelIntro.

---

## Task 1: Typed nav bus (pure)

**Files:**
- Create: `components/dashboard-v2/lib/navBus.ts`
- Test: `components/dashboard-v2/lib/navBus.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// components/dashboard-v2/lib/navBus.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dispatchNav, onNav, type NavDetail } from './navBus';

describe('navBus', () => {
  beforeEach(() => {
    // jsdom not enabled (node env); provide a minimal EventTarget-backed window shim.
    (globalThis as any).window = new EventTarget();
  });

  it('delivers section + sub to subscribers', () => {
    const seen: NavDetail[] = [];
    const off = onNav((d) => seen.push(d));
    dispatchNav({ section: 'content', sub: 'leadmagnets' });
    expect(seen).toEqual([{ section: 'content', sub: 'leadmagnets' }]);
    off();
  });

  it('stops delivering after unsubscribe', () => {
    const seen: NavDetail[] = [];
    const off = onNav((d) => seen.push(d));
    off();
    dispatchNav({ section: 'ops' });
    expect(seen).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/dashboard-v2/lib/navBus.test.ts`
Expected: FAIL — `Cannot find module './navBus'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// components/dashboard-v2/lib/navBus.ts
// Decoupled cross-section navigation. Shell listens for `section`; ContentStudio listens for `sub`.
export type SectionId =
  | 'briefing' | 'content' | 'reach' | 'ops' | 'clients'
  | 'knowledge' | 'agent' | 'ideas' | 'system' | 'personal';

export interface NavDetail {
  section: SectionId;
  sub?: string;
}

const EVENT = 'dv:navigate';

export function dispatchNav(detail: NavDetail): void {
  window.dispatchEvent(new CustomEvent<NavDetail>(EVENT, { detail }));
}

export function onNav(handler: (detail: NavDetail) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<NavDetail>).detail);
  window.addEventListener(EVENT, listener as EventListener);
  return () => window.removeEventListener(EVENT, listener as EventListener);
}
```

> Note: in jsdom-less node env, `CustomEvent` exists in Node ≥19. If the test runner lacks it, add at top of test: `if (!(globalThis as any).CustomEvent) (globalThis as any).CustomEvent = class<T> extends Event { detail: T; constructor(t: string, o: any){ super(t); this.detail = o?.detail; } };`

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/dashboard-v2/lib/navBus.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add components/dashboard-v2/lib/navBus.ts components/dashboard-v2/lib/navBus.test.ts
git commit -m "feat(dashboard-v2): typed nav bus for cross-section navigation"
```

---

## Task 2: Tour steps + demo-safe filter (pure)

**Files:**
- Create: `components/dashboard-v2/tour/tourSteps.ts`
- Create: `components/dashboard-v2/tour/demoSafe.ts`
- Test: `components/dashboard-v2/tour/tour.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// components/dashboard-v2/tour/tour.test.ts
import { describe, it, expect } from 'vitest';
import { TOUR_STEPS } from './tourSteps';
import { DEMO_SAFE, getTourSteps } from './demoSafe';

const DEMO_PATH = new Set(['briefing', 'content']);

describe('tour steps', () => {
  it('has 7 stops in promise order', () => {
    expect(TOUR_STEPS).toHaveLength(7);
    expect(TOUR_STEPS.map(s => s.id)).toEqual([
      'briefing', 'posts', 'post-review', 'calendar', 'leadmagnets', 'styles', 'performance',
    ]);
  });

  it('every step targets a demo-path section', () => {
    for (const s of TOUR_STEPS) expect(DEMO_PATH.has(s.section)).toBe(true);
  });

  it('every step has non-empty narrator copy and a data-tour target', () => {
    for (const s of TOUR_STEPS) {
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.body.length).toBeGreaterThan(0);
      expect(s.target.startsWith('[data-tour=')).toBe(true);
    }
  });
});

describe('demo-safe filter', () => {
  it('never includes a non-demo-safe sub', () => {
    const unsafe = ['agent', 'newsletter', 'clips', 'video-pipeline'];
    for (const u of unsafe) expect(DEMO_SAFE.has(u)).toBe(false);
  });

  it('getTourSteps returns only steps whose sub is demo-safe', () => {
    const steps = getTourSteps();
    for (const s of steps) {
      if (s.sub) expect(DEMO_SAFE.has(s.sub)).toBe(true);
    }
    expect(steps.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/dashboard-v2/tour/tour.test.ts`
Expected: FAIL — cannot find `./tourSteps`.

- [ ] **Step 3: Write the implementations**

```ts
// components/dashboard-v2/tour/tourSteps.ts
import type { SectionId } from '../lib/navBus';

export interface TourStep {
  id: string;
  section: SectionId;
  sub?: string;            // ContentStudio sub-tab key
  target: string;          // CSS selector, always a [data-tour="..."] anchor
  title: string;           // outcome headline
  body: string;            // one-line narrator copy
}

// 7 stops mapped to the six outcome promises (see spec §2/§3).
export const TOUR_STEPS: TourStep[] = [
  { id: 'briefing',    section: 'briefing', target: '[data-tour="briefing"]',
    title: 'It runs — and tells you so', body: 'The whole system’s health and what needs you, at a glance.' },
  { id: 'posts',       section: 'content', sub: 'posts', target: '[data-tour="posts"]',
    title: 'Never face a blank page', body: 'Ideas become drafts and move through review to published — automatically.' },
  { id: 'post-review', section: 'content', sub: 'posts', target: '[data-tour="post-lifecycle"]',
    title: 'It sounds like you, never slop', body: 'Every post is voice-trained and quality-checked before it reaches you.' },
  { id: 'calendar',    section: 'content', sub: 'calendar', target: '[data-tour="calendar"]',
    title: 'A feed that never goes quiet', body: 'Approved content schedules itself into a steady publishing rhythm.' },
  { id: 'leadmagnets', section: 'content', sub: 'leadmagnets', target: '[data-tour="leadmagnets"]',
    title: 'Attention → qualified leads', body: 'One idea becomes a live lead magnet that captures and qualifies signups.' },
  { id: 'styles',      section: 'content', sub: 'styles', target: '[data-tour="styles"]',
    title: 'One idea becomes everything', body: 'The same idea renders into nine on-brand carousel styles and video.' },
  { id: 'performance', section: 'content', sub: 'performance', target: '[data-tour="performance"]',
    title: 'It learns what lands', body: 'Real LinkedIn performance feeds back into what gets posted next.' },
];
```

```ts
// components/dashboard-v2/tour/demoSafe.ts
import { TOUR_STEPS, type TourStep } from './tourSteps';

// Content Studio subs that are polished enough to show live.
export const DEMO_SAFE = new Set<string>([
  'posts', 'leadmagnets', 'styles', 'calendar', 'performance', 'video',
]);

// Tour steps minus anything that would land on an unfinished surface.
export function getTourSteps(): TourStep[] {
  return TOUR_STEPS.filter(s => !s.sub || DEMO_SAFE.has(s.sub));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/dashboard-v2/tour/tour.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add components/dashboard-v2/tour/tourSteps.ts components/dashboard-v2/tour/demoSafe.ts components/dashboard-v2/tour/tour.test.ts
git commit -m "feat(dashboard-v2): declarative tour steps + demo-safe filter"
```

---

## Task 3: Tour state reducer (pure)

**Files:**
- Create: `components/dashboard-v2/tour/tourReducer.ts`
- Test: `components/dashboard-v2/tour/tourReducer.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// components/dashboard-v2/tour/tourReducer.test.ts
import { describe, it, expect } from 'vitest';
import { tourReducer, initialTourState, type TourState } from './tourReducer';

const N = 7;

describe('tourReducer', () => {
  it('starts inactive at index 0', () => {
    expect(initialTourState).toEqual({ active: false, index: 0 });
  });

  it('START activates at 0', () => {
    expect(tourReducer(initialTourState, { type: 'START', total: N })).toEqual({ active: true, index: 0 });
  });

  it('NEXT advances but clamps at last and never deactivates', () => {
    let s: TourState = { active: true, index: N - 2 };
    s = tourReducer(s, { type: 'NEXT', total: N });
    expect(s).toEqual({ active: true, index: N - 1 });
    s = tourReducer(s, { type: 'NEXT', total: N });
    expect(s).toEqual({ active: true, index: N - 1 });
  });

  it('BACK decrements but clamps at 0', () => {
    let s: TourState = { active: true, index: 1 };
    s = tourReducer(s, { type: 'BACK' });
    expect(s).toEqual({ active: true, index: 0 });
    s = tourReducer(s, { type: 'BACK' });
    expect(s).toEqual({ active: true, index: 0 });
  });

  it('END deactivates and resets index', () => {
    expect(tourReducer({ active: true, index: 4 }, { type: 'END' })).toEqual({ active: false, index: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/dashboard-v2/tour/tourReducer.test.ts`
Expected: FAIL — cannot find `./tourReducer`.

- [ ] **Step 3: Write minimal implementation**

```ts
// components/dashboard-v2/tour/tourReducer.ts
export interface TourState {
  active: boolean;
  index: number;
}

export type TourAction =
  | { type: 'START'; total: number }
  | { type: 'NEXT'; total: number }
  | { type: 'BACK' }
  | { type: 'GOTO'; index: number; total: number }
  | { type: 'END' };

export const initialTourState: TourState = { active: false, index: 0 };

export function tourReducer(state: TourState, action: TourAction): TourState {
  switch (action.type) {
    case 'START': return { active: true, index: 0 };
    case 'NEXT':  return { active: true, index: Math.min(state.index + 1, action.total - 1) };
    case 'BACK':  return { active: true, index: Math.max(state.index - 1, 0) };
    case 'GOTO':  return { active: true, index: Math.max(0, Math.min(action.index, action.total - 1)) };
    case 'END':   return { active: false, index: 0 };
    default:      return state;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/dashboard-v2/tour/tourReducer.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add components/dashboard-v2/tour/tourReducer.ts components/dashboard-v2/tour/tourReducer.test.ts
git commit -m "feat(dashboard-v2): tour state reducer"
```

---

## Task 4: TourProvider + useTour (context)

**Files:**
- Create: `components/dashboard-v2/tour/TourProvider.tsx`

- [ ] **Step 1: Implement the provider**

```tsx
// components/dashboard-v2/tour/TourProvider.tsx
import React, { createContext, useContext, useReducer, useCallback, useMemo } from 'react';
import { tourReducer, initialTourState } from './tourReducer';
import { getTourSteps } from './demoSafe';
import { dispatchNav } from '../lib/navBus';
import type { TourStep } from './tourSteps';

interface TourCtx {
  active: boolean;
  index: number;
  total: number;
  step: TourStep | null;
  start: () => void;
  next: () => void;
  back: () => void;
  end: () => void;
}

const Ctx = createContext<TourCtx | null>(null);

export function TourProvider({ children }: { children: React.ReactNode }) {
  const steps = useMemo(() => getTourSteps(), []);
  const total = steps.length;
  const [state, dispatch] = useReducer(tourReducer, initialTourState);

  // Navigate to the step's section/sub whenever the active step changes.
  const go = useCallback((idx: number) => {
    const s = steps[idx];
    if (s) dispatchNav({ section: s.section, sub: s.sub });
  }, [steps]);

  const start = useCallback(() => { dispatch({ type: 'START', total }); go(0); }, [go, total]);
  const next = useCallback(() => {
    const nextIdx = Math.min(state.index + 1, total - 1);
    dispatch({ type: 'NEXT', total }); go(nextIdx);
  }, [go, state.index, total]);
  const back = useCallback(() => {
    const prevIdx = Math.max(state.index - 1, 0);
    dispatch({ type: 'BACK' }); go(prevIdx);
  }, [go, state.index]);
  const end = useCallback(() => dispatch({ type: 'END' }), []);

  const value: TourCtx = {
    active: state.active,
    index: state.index,
    total,
    step: state.active ? steps[state.index] ?? null : null,
    start, next, back, end,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTour(): TourCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTour must be used within TourProvider');
  return v;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors from `tour/`.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard-v2/tour/TourProvider.tsx
git commit -m "feat(dashboard-v2): TourProvider context + useTour"
```

---

## Task 5: useTourSpotlight hook

**Files:**
- Create: `components/dashboard-v2/tour/useTourSpotlight.ts`

- [ ] **Step 1: Implement the hook**

```ts
// components/dashboard-v2/tour/useTourSpotlight.ts
import { useEffect } from 'react';

const HILITE = 'dv-tour-target';

// Highlights + scrolls to the element matching `selector` while the tour is on `selector`.
// Retries briefly because the target may mount after a section/sub switch.
export function useTourSpotlight(active: boolean, selector: string | undefined) {
  useEffect(() => {
    if (!active || !selector) return;
    let raf = 0;
    let tries = 0;
    let current: HTMLElement | null = null;

    const apply = () => {
      const el = document.querySelector<HTMLElement>(selector);
      if (el) {
        current = el;
        el.classList.add(HILITE);
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      if (tries++ < 30) raf = requestAnimationFrame(apply); // ~0.5s of retries
    };
    apply();

    return () => {
      cancelAnimationFrame(raf);
      current?.classList.remove(HILITE);
    };
  }, [active, selector]);
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard-v2/tour/useTourSpotlight.ts
git commit -m "feat(dashboard-v2): tour spotlight hook"
```

---

## Task 6: TourNarratorCard

**Files:**
- Create: `components/dashboard-v2/tour/TourNarratorCard.tsx`

- [ ] **Step 1: Implement the card**

```tsx
// components/dashboard-v2/tour/TourNarratorCard.tsx
import React from 'react';
import { useTour } from './TourProvider';
import { useTourSpotlight } from './useTourSpotlight';

export function TourNarratorCard() {
  const { active, step, index, total, next, back, end } = useTour();
  useTourSpotlight(active, step?.target);

  if (!active || !step) return null;
  const isFirst = index === 0;
  const isLast = index === total - 1;

  return (
    <>
      <div className="dv-tour-scrim" onClick={end} aria-hidden />
      <aside className="dv-tour-card" role="dialog" aria-label="Guided tour">
        <div className="dv-tour-progress">{index + 1} / {total}</div>
        <h3 className="dv-tour-title">{step.title}</h3>
        <p className="dv-tour-body">{step.body}</p>
        <div className="dv-tour-actions">
          <button type="button" className="dv-tour-skip" onClick={end}>End tour</button>
          <div className="dv-tour-nav">
            {!isFirst && <button type="button" className="dv-tour-btn" onClick={back}>Back</button>}
            {isLast
              ? <button type="button" className="dv-tour-btn dv-tour-btn--primary" onClick={end}>Done</button>
              : <button type="button" className="dv-tour-btn dv-tour-btn--primary" onClick={next}>Next</button>}
          </div>
        </div>
      </aside>
    </>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard-v2/tour/TourNarratorCard.tsx
git commit -m "feat(dashboard-v2): tour narrator card"
```

---

## Task 7: Tour CSS

**Files:**
- Modify: `components/dashboard-v2/dashboard-v2.css` (append a new block at end of file)

- [ ] **Step 1: Append the styles**

```css
/* ── Guided Tour ─────────────────────────────────────────── */
.dashboard-v2 .dv-tour-scrim {
  position: fixed; inset: 0; z-index: 60;
  background: rgba(0, 0, 0, 0.45);
  animation: dv-fade 0.2s var(--d-ease);
}
.dashboard-v2 .dv-tour-card {
  position: fixed; right: 24px; bottom: 24px; z-index: 61;
  width: 340px; max-width: calc(100vw - 48px);
  background: var(--d-ink-2);
  border: 1px solid var(--d-rule-strong);
  border-radius: var(--d-r);
  box-shadow: var(--d-shadow-2), var(--d-edge-light);
  padding: var(--sp-4);
  animation: dv-tour-in 0.28s var(--d-ease-spring);
}
.dashboard-v2 .dv-tour-progress { font-size: var(--t-xs); color: var(--d-paper-dimmer); letter-spacing: .04em; }
.dashboard-v2 .dv-tour-title { font-size: var(--t-lg); color: var(--d-paper); margin: 6px 0 4px; }
.dashboard-v2 .dv-tour-body { font-size: var(--t-base); color: var(--d-paper-dim); line-height: 1.5; }
.dashboard-v2 .dv-tour-actions { display: flex; align-items: center; justify-content: space-between; margin-top: var(--sp-4); }
.dashboard-v2 .dv-tour-nav { display: flex; gap: var(--sp-2); }
.dashboard-v2 .dv-tour-skip { background: none; border: none; color: var(--d-paper-dimmer); font-size: var(--t-sm); cursor: pointer; }
.dashboard-v2 .dv-tour-btn {
  font-size: var(--t-sm); padding: 6px 12px; border-radius: var(--d-r-sm);
  border: 1px solid var(--d-rule-strong); background: var(--d-ink-3); color: var(--d-paper); cursor: pointer;
  transition: background var(--d-dur) var(--d-ease);
}
.dashboard-v2 .dv-tour-btn:hover { background: var(--d-surface-2); }
.dashboard-v2 .dv-tour-btn--primary { background: var(--d-good); border-color: var(--d-good); color: #fff; }
.dashboard-v2 .dv-tour-btn--primary:hover { background: var(--d-good-hi); }

/* Spotlight: lift the active target above the scrim and ring it. */
.dashboard-v2 .dv-tour-target {
  position: relative; z-index: 61;
  outline: 2px solid var(--d-good);
  outline-offset: 4px;
  border-radius: var(--d-r);
  box-shadow: 0 0 0 9999px rgba(0,0,0,0.45);
  transition: outline-color var(--d-dur) var(--d-ease);
}

/* Tour trigger button in topbar */
.dashboard-v2 .dv-tour-trigger {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: var(--t-sm); padding: 5px 10px; border-radius: var(--d-r-sm);
  border: 1px solid var(--d-rule-strong); background: var(--d-ink-2); color: var(--d-paper); cursor: pointer;
}
.dashboard-v2 .dv-tour-trigger:hover { background: var(--d-surface-2); }

@keyframes dv-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes dv-tour-in { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
```

- [ ] **Step 2: Build check**

Run: `npm run build`
Expected: build succeeds (CSS compiles).

- [ ] **Step 3: Commit**

```bash
git add components/dashboard-v2/dashboard-v2.css
git commit -m "style(dashboard-v2): guided tour + spotlight styles"
```

---

## Task 8: Wire Tour into Shell

**Files:**
- Modify: `components/dashboard-v2/Shell.tsx`

Context (from current Shell): `ALL_SECTIONS` array, `const [active, setActive] = useState<SectionId>()`, URL sync via `?section=`, header `.dv-topbar` with `NotificationBell`.

- [ ] **Step 1: Import the tour pieces and nav bus**

At the top of `Shell.tsx`, add:

```tsx
import { TourProvider, useTour } from './tour/TourProvider';
import { TourNarratorCard } from './tour/TourNarratorCard';
import { onNav } from './lib/navBus';
```

- [ ] **Step 2: Listen for nav-bus section changes**

Inside the Shell component, alongside the existing keyboard/popstate effects, add:

```tsx
useEffect(() => {
  return onNav(({ section }) => setActive(section));
}, []);
```

- [ ] **Step 3: Add a Tour trigger button component**

Add this small component in `Shell.tsx` (it must render inside `TourProvider`):

```tsx
function TourTrigger() {
  const { start } = useTour();
  return (
    <button type="button" className="dv-tour-trigger" onClick={start} aria-label="Start guided tour">
      ▶ Tour
    </button>
  );
}
```

- [ ] **Step 4: Wrap the shell body in TourProvider and mount the trigger + card**

Wrap the shell's returned JSX with `<TourProvider> … </TourProvider>`. In the `.dv-topbar` header, add `<TourTrigger />` immediately before `<NotificationBell />`. After the main content (sibling to header), add `<TourNarratorCard />`. Example header edit:

```tsx
<header className="dv-topbar">
  <button type="button" className="dv-hamburger" aria-label="Open navigation" aria-expanded={navOpen} onClick={() => setNavOpen(true)}>
    <span /><span /><span />
  </button>
  <div className="dv-topbar-brand">Ivan <em>System</em></div>
  <div className="dv-topbar-right">
    <TourTrigger />
    <NotificationBell />
  </div>
</header>
```

Add to `dashboard-v2.css`: `.dashboard-v2 .dv-topbar-right { margin-left: auto; display: flex; align-items: center; gap: var(--sp-3); }`

- [ ] **Step 5: Auto-start on `?tour=1`**

Inside `TourProvider` (Task 4 file), add an effect after `start` is defined:

```tsx
// auto-start when the URL carries ?tour=1
React.useEffect(() => {
  if (new URLSearchParams(window.location.search).get('tour') === '1') start();
}, [start]);
```

- [ ] **Step 6: Verify build + typecheck**

Run: `npm run build && npx tsc --noEmit`
Expected: both succeed.

- [ ] **Step 7: Commit**

```bash
git add components/dashboard-v2/Shell.tsx components/dashboard-v2/tour/TourProvider.tsx components/dashboard-v2/dashboard-v2.css
git commit -m "feat(dashboard-v2): mount guided tour in shell (button + ?tour=1 + nav bus)"
```

---

## Task 9: Wire ContentStudio to the nav bus (sub-tab switching)

**Files:**
- Modify: `components/dashboard-v2/sections/ContentStudio.tsx`

Context: `const [sub, setSub] = useState<SubKey>(getInitialSub)`; `handleSub` already syncs to URL.

- [ ] **Step 1: Import and subscribe**

Add import: `import { onNav } from '../lib/navBus';`

Inside the component, add:

```tsx
useEffect(() => {
  return onNav(({ section, sub: nextSub }) => {
    if (section === 'content' && nextSub) {
      setSub(nextSub as SubKey);
      syncSubToUrl(nextSub as SubKey);
    }
  });
}, []);
```

(If `useEffect` is not yet imported, add it to the React import.)

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard-v2/sections/ContentStudio.tsx
git commit -m "feat(dashboard-v2): ContentStudio responds to nav bus sub changes"
```

---

## Task 10: PanelIntro primitive

**Files:**
- Create: `components/dashboard-v2/primitives/PanelIntro.tsx`
- Modify: `components/dashboard-v2/primitives/index.ts`
- Modify: `components/dashboard-v2/dashboard-v2.css`

- [ ] **Step 1: Implement PanelIntro**

```tsx
// components/dashboard-v2/primitives/PanelIntro.tsx
import React, { useState } from 'react';

interface PanelIntroProps {
  /** One-line purpose, e.g. "Where every post is born, reviewed, and shipped." */
  purpose: string;
  /** Optional deeper "how it works" shown in a popover behind a "?" */
  how?: string;
  /** data-tour anchor id so the guided tour can target this panel. */
  tourId?: string;
}

export function PanelIntro({ purpose, how, tourId }: PanelIntroProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="dv-panel-intro" data-tour={tourId}>
      <span className="dv-panel-intro-text">{purpose}</span>
      {how && (
        <span className="dv-panel-intro-how">
          <button
            type="button"
            className="dv-panel-intro-q"
            aria-label="How it works"
            aria-expanded={open}
            onClick={() => setOpen(o => !o)}
          >?</button>
          {open && <span className="dv-panel-intro-pop" role="note">{how}</span>}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Export from barrel**

In `components/dashboard-v2/primitives/index.ts`, add:

```ts
export { PanelIntro } from './PanelIntro';
```

- [ ] **Step 3: Add styles** (append to `dashboard-v2.css`)

```css
/* ── PanelIntro ──────────────────────────────────────────── */
.dashboard-v2 .dv-panel-intro {
  display: flex; align-items: center; gap: 8px;
  margin: 2px 0 var(--sp-4);
  font-size: var(--t-base); color: var(--d-paper-dim);
}
.dashboard-v2 .dv-panel-intro-how { position: relative; display: inline-flex; }
.dashboard-v2 .dv-panel-intro-q {
  width: 18px; height: 18px; border-radius: 50%;
  border: 1px solid var(--d-rule-strong); background: var(--d-ink-3);
  color: var(--d-paper-dim); font-size: var(--t-xs); line-height: 1; cursor: pointer;
}
.dashboard-v2 .dv-panel-intro-q:hover { color: var(--d-paper); }
.dashboard-v2 .dv-panel-intro-pop {
  position: absolute; top: 24px; left: 0; z-index: 20; width: 280px;
  background: var(--d-ink-2); border: 1px solid var(--d-rule-strong);
  border-radius: var(--d-r-sm); box-shadow: var(--d-shadow-1);
  padding: 10px 12px; font-size: var(--t-sm); color: var(--d-paper-dim); line-height: 1.5;
}
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard-v2/primitives/PanelIntro.tsx components/dashboard-v2/primitives/index.ts components/dashboard-v2/dashboard-v2.css
git commit -m "feat(dashboard-v2): PanelIntro primitive (purpose + how popover)"
```

---

## Task 11: Lifecycle legend (data + component)

**Files:**
- Create: `components/dashboard-v2/lib/lifecycle.ts`
- Create: `components/dashboard-v2/primitives/LifecycleLegend.tsx`
- Modify: `components/dashboard-v2/primitives/index.ts`
- Modify: `components/dashboard-v2/dashboard-v2.css`
- Test: `components/dashboard-v2/lib/lifecycle.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// components/dashboard-v2/lib/lifecycle.test.ts
import { describe, it, expect } from 'vitest';
import { LIFECYCLE_STAGES } from './lifecycle';

describe('lifecycle stages', () => {
  it('lists the pipeline in order', () => {
    expect(LIFECYCLE_STAGES.map(s => s.key)).toEqual([
      'idea', 'generating', 'review', 'approved', 'scheduled', 'published',
    ]);
  });
  it('each stage has a label and a severity', () => {
    for (const s of LIFECYCLE_STAGES) {
      expect(s.label.length).toBeGreaterThan(0);
      expect(['neutral', 'warn', 'good', 'accent']).toContain(s.severity);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/dashboard-v2/lib/lifecycle.test.ts`
Expected: FAIL — cannot find `./lifecycle`.

- [ ] **Step 3: Implement data + component**

```ts
// components/dashboard-v2/lib/lifecycle.ts
export type LifecycleSeverity = 'neutral' | 'warn' | 'good' | 'accent';

export interface LifecycleStage {
  key: string;
  label: string;
  severity: LifecycleSeverity;
}

export const LIFECYCLE_STAGES: LifecycleStage[] = [
  { key: 'idea',       label: 'Idea',       severity: 'neutral' },
  { key: 'generating', label: 'Generating', severity: 'accent'  },
  { key: 'review',     label: 'Review',     severity: 'warn'    },
  { key: 'approved',   label: 'Approved',   severity: 'good'    },
  { key: 'scheduled',  label: 'Scheduled',  severity: 'accent'  },
  { key: 'published',  label: 'Published',  severity: 'good'    },
];
```

```tsx
// components/dashboard-v2/primitives/LifecycleLegend.tsx
import React from 'react';
import { LIFECYCLE_STAGES } from '../lib/lifecycle';

export function LifecycleLegend() {
  return (
    <div className="dv-lifecycle" aria-label="Content lifecycle">
      {LIFECYCLE_STAGES.map((s, i) => (
        <React.Fragment key={s.key}>
          <span className={`dv-lifecycle-stage dv-lifecycle-stage--${s.severity}`}>{s.label}</span>
          {i < LIFECYCLE_STAGES.length - 1 && <span className="dv-lifecycle-arrow" aria-hidden>→</span>}
        </React.Fragment>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Export + styles**

In `primitives/index.ts`: `export { LifecycleLegend } from './LifecycleLegend';`

Append to `dashboard-v2.css`:

```css
/* ── Lifecycle legend ────────────────────────────────────── */
.dashboard-v2 .dv-lifecycle { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-bottom: var(--sp-4); }
.dashboard-v2 .dv-lifecycle-arrow { color: var(--d-paper-dimmer); font-size: var(--t-sm); }
.dashboard-v2 .dv-lifecycle-stage {
  font-size: var(--t-xs); padding: 3px 8px; border-radius: var(--d-r-sm);
  border: 1px solid var(--d-rule); background: var(--d-ink-3); color: var(--d-paper-dim);
}
.dashboard-v2 .dv-lifecycle-stage--good   { color: var(--d-good);   border-color: var(--d-good);   background: var(--d-good-bg); }
.dashboard-v2 .dv-lifecycle-stage--warn   { color: var(--d-warn);   border-color: var(--d-warn);   background: var(--d-warn-bg); }
.dashboard-v2 .dv-lifecycle-stage--accent { color: var(--d-accent); border-color: var(--d-accent); background: var(--d-accent-bg); }
```

- [ ] **Step 5: Run test + build**

Run: `npx vitest run components/dashboard-v2/lib/lifecycle.test.ts && npm run build`
Expected: test PASS (2), build succeeds.

- [ ] **Step 6: Commit**

```bash
git add components/dashboard-v2/lib/lifecycle.ts components/dashboard-v2/lib/lifecycle.test.ts components/dashboard-v2/primitives/LifecycleLegend.tsx components/dashboard-v2/primitives/index.ts components/dashboard-v2/dashboard-v2.css
git commit -m "feat(dashboard-v2): content lifecycle legend"
```

---

## Task 12: Attach PanelIntro + tour anchors to demo-path panels

Each demo-path surface gets a `PanelIntro` (purpose + how) and the `data-tour` anchor the tour targets. The Posts panel also gets the `LifecycleLegend`.

**Files:** `components/dashboard/PostStudioPanel.tsx`, `LeadMagnetStudioPanel.tsx`, `StyleGalleryPanel.tsx`, `PerformancePanel.tsx`, `VideoStudioPanel.tsx`, `components/dashboard-v2/sections/Calendar.tsx`, `components/dashboard-v2/sections/Briefing.tsx`.

- [ ] **Step 1: PostStudioPanel — intro + legend + anchor**

Import: `import { PanelIntro, LifecycleLegend } from '../dashboard-v2/primitives';`
Immediately inside the outer `<div className="space-y-6">` (before the title row at line ~255), insert:

```tsx
<PanelIntro
  tourId="posts"
  purpose="Where every post is born, reviewed, and shipped — without you writing it."
  how="Ideas arrive from a 6-source curator, are drafted in your trained voice, pass quality + lint gates, then schedule to LinkedIn automatically."
/>
<LifecycleLegend />
```

Add `data-tour="post-lifecycle"` to the status-filter/list container element (the wrapper around the kanban/list) so tour stop 3 can target it.

- [ ] **Step 2: LeadMagnetStudioPanel — intro + anchor**

Import `PanelIntro`. At the top of the panel's outer container insert:

```tsx
<PanelIntro
  tourId="leadmagnets"
  purpose="Turn attention into qualified leads — built and published automatically."
  how="One idea becomes an interactive asset on a live hosted page, with gated CTAs that route signups by fit and a full launch kit (post, DM, email, cover)."
/>
```

- [ ] **Step 3: StyleGalleryPanel — intro + anchor**

```tsx
<PanelIntro
  tourId="styles"
  purpose="One idea, rendered into nine on-brand carousel styles and video."
  how="Each style is a brand-locked layout kit; the system composes real logos and screenshots into slides, not text baked into images."
/>
```

- [ ] **Step 4: PerformancePanel — intro + anchor**

```tsx
<PanelIntro
  tourId="performance"
  purpose="What actually landed — and what the system learns from it."
  how="Daily LinkedIn metrics flow back in to inform which topics, hooks, and formats get posted next."
/>
```

- [ ] **Step 5: VideoStudioPanel — intro + anchor**

```tsx
<PanelIntro
  tourId="video"
  purpose="Animated, on-brand videos that publish natively to LinkedIn and Reels."
  how="Claude authors a per-topic spec; the render engine turns it into a vertical animated infographic you review and approve."
/>
```

- [ ] **Step 6: Calendar — intro + anchor**

At the top of the Calendar section render, insert:

```tsx
<PanelIntro
  tourId="calendar"
  purpose="A publishing rhythm that runs itself."
  how="Approved posts, carousels, and lead magnets schedule onto one calendar; drag to reschedule and the queue updates."
/>
```

- [ ] **Step 7: Briefing — anchor (stop 1)**

Add `data-tour="briefing"` to the `<Pulse>` wrapper (or the `HeadRow` container) so tour stop 1 targets the morning dispatch. No PanelIntro needed — `HeadRow` already explains it.

- [ ] **Step 8: Verify build + typecheck**

Run: `npm run build && npx tsc --noEmit`
Expected: both succeed.

- [ ] **Step 9: Commit**

```bash
git add components/dashboard/PostStudioPanel.tsx components/dashboard/LeadMagnetStudioPanel.tsx components/dashboard/StyleGalleryPanel.tsx components/dashboard/PerformancePanel.tsx components/dashboard/VideoStudioPanel.tsx components/dashboard-v2/sections/Calendar.tsx components/dashboard-v2/sections/Briefing.tsx
git commit -m "feat(dashboard-v2): per-panel PanelIntro + tour anchors on demo path"
```

---

## Task 13: Demo-path empty states

Replace bare empty grids with `EmptyState` on the panels that demo poorly when empty (per spec/audit: Lead Magnets inventory, Video, Call Clips — but Call Clips is NOT on the tour, so only fix the demo-path ones: LeadMagnet + Video).

**Files:** `components/dashboard/LeadMagnetStudioPanel.tsx`, `components/dashboard/VideoStudioPanel.tsx`

- [ ] **Step 1: LeadMagnetStudioPanel empty state**

Import: `import EmptyState from './shared/EmptyState';` (verify the existing relative path used elsewhere in this file; the component lives at `components/dashboard/shared/EmptyState.tsx`).
Where the list renders nothing (drafts length 0), render:

```tsx
<EmptyState
  title="No lead magnets yet"
  description="Pick a format and the system builds an interactive asset, publishes it to a live page, and writes the launch kit."
/>
```

- [ ] **Step 2: VideoStudioPanel empty state**

```tsx
<EmptyState
  title="No videos in review"
  description="When a post is a good fit for motion, an animated vertical video is generated and lands here for your approval."
/>
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/LeadMagnetStudioPanel.tsx components/dashboard/VideoStudioPanel.tsx
git commit -m "feat(dashboard-v2): friendly empty states on demo-path panels"
```

---

## Task 14: Consistency pass (demo-path CSS)

Standardize the v1-panel chrome on the demo path so seams disappear: panel title rows, card radius/shadow, and status chips should read as v2. The repo already has v1-panel overrides in `dashboard-v2.css` (lines ~487–608). Extend that block — do NOT edit the v1 panel components' Tailwind directly.

**Files:** `components/dashboard-v2/dashboard-v2.css`

- [ ] **Step 1: Add/extend demo-path overrides**

Append:

```css
/* ── Demo-path v1-panel consistency ──────────────────────── */
/* Normalize section titles inside wrapped v1 panels to the v2 head scale. */
.dashboard-v2 .dv-content-studio-body .dv-section-h {
  font-size: var(--t-xl); color: var(--d-paper); font-weight: 600; letter-spacing: -0.01em;
}
/* Cards/tiles in wrapped panels adopt v2 radius + shadow. */
.dashboard-v2 .dv-content-studio-body .rounded-xl { border-radius: var(--d-r) !important; }
.dashboard-v2 .dv-content-studio-body [class*="bg-zinc-900"] { box-shadow: var(--d-shadow-1), var(--d-edge-light); }
/* Quiet the emerald-on-zinc one-off accents toward the single sage token. */
.dashboard-v2 .dv-content-studio-body .text-emerald-400 { color: var(--d-good-hi); }
.dashboard-v2 .dv-content-studio-body .bg-emerald-500\/10 { background: var(--d-good-bg); }
```

> Verify these selectors against the real class usage when implementing (open the panel in the browser dev tools). Adjust the attribute selectors to match the actual Tailwind classes present; the intent is: unify radius, shadow, and the green token across the demo-path body without touching the v1 components.

- [ ] **Step 2: Verify build + visual spot-check**

Run: `npm run build`
Then load the dashboard locally (`npm run dev`) and confirm Posts / Lead Magnets / Styles read consistently. (Full visual verification is Task 15.)

- [ ] **Step 3: Commit**

```bash
git add components/dashboard-v2/dashboard-v2.css
git commit -m "style(dashboard-v2): consistency pass on demo-path panels"
```

---

## Task 15: End-to-end visual verification (playwright-driver)

No component-test harness exists; verify the tour + panels visually using the **playwright-driver skill** (Mode 2 drive against the authed dashboard, or Mode 1 inspect on localhost).

**Files:** none (verification only). Capture screenshots to a scratch dir.

- [ ] **Step 1: Start the app**

Run: `npm run dev`
Note the local URL (Vite default `http://localhost:5173`).

- [ ] **Step 2: Invoke the playwright-driver skill** to script this sequence against the dashboard (use a persistent profile if auth is required):
  1. Navigate to `<dashboard-url>/?section=briefing&tour=1`.
  2. Assert the narrator card is visible and shows "1 / 7" and the title "It runs — and tells you so".
  3. Assert an element with `[data-tour="briefing"]` has class `dv-tour-target`.
  4. Click "Next" 6 times; at each step assert: the card index increments, the correct section/sub is active (URL `?section=content` and the expected sub-tab visible), and the step's `data-tour` target carries `dv-tour-target`.
  5. At step 7 ("It learns what lands") assert the button reads "Done"; click it; assert the narrator card and scrim are gone.
  6. Screenshot each stop at 1440×900 and 390×844 (desktop + mobile) to confirm the card never covers the spotlighted target and is readable.

- [ ] **Step 3: Assert demo-safety**

Confirm no tour stop lands on Agent, Newsletter, Call Clips, or Video Pipeline. Confirm each demo-path panel shows its `PanelIntro` purpose line, and Posts shows the `LifecycleLegend`.

- [ ] **Step 4: Record results**

Save screenshots + a short pass/fail note. If any stop's target is missing (spotlight never applied), the `data-tour` anchor for that panel is wrong — fix the anchor in the relevant Task 12 file and re-run.

- [ ] **Step 5: Commit verification artifacts (optional)**

If you keep screenshots in-repo (e.g. `docs/superpowers/verification/`), commit them:

```bash
git add docs/superpowers/verification/
git commit -m "test(dashboard-v2): guided tour e2e verification screenshots"
```

---

## Self-Review (completed against spec)

- **Spec §3 A1 Guided Tour** → Tasks 2–9 (steps, reducer, provider, spotlight, card, Shell wiring, ContentStudio wiring). ✔
- **Spec §3 A1 demo-safe routing** → Task 2 `demoSafe.ts` + Task 15 step 3 assertion. ✔
- **Spec §3 A2 per-screen self-explanation** → Task 10 (PanelIntro), Task 11 (lifecycle legend), Task 12 (attach). ✔
- **Spec §3 A2 empty states** → Task 13. ✔
- **Spec §3 A3 consistency pass (demo path only)** → Task 14. ✔
- **Spec §3 A4 success criteria** → Task 15 verification. ✔
- **Honesty rule (no pending surfaces on tour)** → Task 2 + Task 15 step 3. ✔
- **Type consistency:** `SectionId` defined once in `navBus.ts` and imported by `tourSteps.ts`/`TourProvider`; `NavDetail`, `TourStep`, `TourState`, `LifecycleStage` each defined once and reused. Tour step ids in Task 2 test match `tourSteps.ts`. `dispatchNav`/`onNav` names consistent across Tasks 1, 8, 9. ✔
- **No placeholders:** every code step contains full code; CSS selector caveat in Task 14 is an explicit verify-in-devtools instruction, not a deferred TODO. ✔

> Known integration risk to watch during execution: Task 14's Tailwind attribute selectors depend on the exact classes the v1 panels emit — confirm in devtools and adjust. Task 9 assumes `getInitialSub`/`syncSubToUrl` exist in ContentStudio (confirmed present); reuse them rather than re-implementing URL sync.

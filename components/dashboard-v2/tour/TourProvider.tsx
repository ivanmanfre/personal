import React, { createContext, useContext, useReducer, useCallback, useMemo } from 'react';
import { tourReducer, initialTourState } from './tourReducer';
import { getTourSteps } from './demoSafe';
import { dispatchNav } from '../lib/navBus';
import { setTourIntent } from './tourBus';
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

  // Navigate to the step's section/sub whenever the active step changes, and
  // publish the step's UI intent (open compose form / open editor) so the
  // target panel can trigger the matching real interaction.
  const go = useCallback((idx: number) => {
    const s = steps[idx];
    if (!s) return;
    dispatchNav({ section: s.section, sub: s.sub });
    setTourIntent(s.intent ?? null);
  }, [steps]);

  const start = useCallback(() => { dispatch({ type: 'START', total }); go(0); }, [go, total]);
  const next = useCallback(() => {
    const idx = Math.min(state.index + 1, total - 1);
    dispatch({ type: 'GOTO', index: idx, total }); go(idx);
  }, [go, state.index, total]);
  const back = useCallback(() => {
    const idx = Math.max(state.index - 1, 0);
    dispatch({ type: 'GOTO', index: idx, total }); go(idx);
  }, [go, state.index, total]);
  const end = useCallback(() => { dispatch({ type: 'END' }); setTourIntent(null); }, []);

  React.useEffect(() => {
    if (new URLSearchParams(window.location.search).get('tour') === '1') {
      // Defer to the next task so the parent Shell's onNav subscription (a
      // parent effect, which runs AFTER this child effect) is attached before
      // step 0 dispatches its navigation — otherwise the first nav is lost and
      // the tour opens on the wrong section.
      const t = setTimeout(() => start(), 0);
      return () => clearTimeout(t);
    }
  }, [start]);

  const value = useMemo<TourCtx>(() => ({
    active: state.active,
    index: state.index,
    total,
    step: state.active ? steps[state.index] ?? null : null,
    start, next, back, end,
  }), [state.active, state.index, total, steps, start, next, back, end]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTour(): TourCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTour must be used within TourProvider');
  return v;
}

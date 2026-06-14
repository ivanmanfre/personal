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

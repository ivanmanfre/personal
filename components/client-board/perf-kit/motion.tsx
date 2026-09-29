// Motion plumbing for the perf-kit (ported from arch-report-app/src/motion.tsx, 2026-09-29).
// Rules: one-shot reveals, each under 900ms, final values always correct, reduced motion
// shows the finished page.
//
// Safety net (nothing may stay hidden if IntersectionObserver never fires):
//  - no IntersectionObserver at all, or printing: everything is revealed now.
//  - automated browsers (navigator.webdriver, headless full-page captures): everything is
//    revealed at 2.5s.
//  - real readers: at 2.5s anything sitting in the viewport that has not revealed is
//    revealed; content below the fold keeps its scroll reveal.
import { createContext, useContext, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { LazyMotion, domAnimation, useInView, useReducedMotion } from 'framer-motion';

export const EASE = [0.25, 1, 0.5, 1] as const;
const SAFETY_MS = 2500;

const ForceReveal = createContext(false);

export function MotionRoot({ children }: { children: ReactNode }) {
  const [forced, setForced] = useState(() => typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    const all = () => setForced(true);
    window.addEventListener('beforeprint', all);
    const t = navigator.webdriver ? window.setTimeout(all, SAFETY_MS) : 0;
    return () => {
      window.removeEventListener('beforeprint', all);
      window.clearTimeout(t);
    };
  }, []);
  return (
    <LazyMotion features={domAnimation}>
      <ForceReveal.Provider value={forced}>{children}</ForceReveal.Provider>
    </LazyMotion>
  );
}

/** true once the element has been in view (or a safety fired, or motion is reduced). */
export function useReveal<T extends Element>(amount = 0.15, margin?: string): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const inView = useInView(ref as RefObject<Element>, { once: true, amount, margin: margin as any });
  const forced = useContext(ForceReveal);
  const reduce = useReducedMotion();
  const [late, setLate] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => {
      const r = ref.current?.getBoundingClientRect();
      if (r && r.bottom > 0 && r.top < window.innerHeight) setLate(true);
    }, SAFETY_MS);
    return () => window.clearTimeout(t);
  }, []);
  return [ref, inView || forced || late || !!reduce];
}

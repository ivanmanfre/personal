import { useEffect, useRef, useState } from 'react';
const easeOut = (t:number) => 1 - Math.pow(1 - t, 3);
export function useCountUp(target:number, opts:{duration?:number}={}) {
  const dur = opts.duration ?? 1100;
  const [v, setV] = useState(0);
  const prevRef = useRef(0);
  useEffect(() => {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { prevRef.current = target; setV(target); return; }
    const from = prevRef.current;
    prevRef.current = target;
    const start = performance.now();
    let raf = 0;
    const step = (now:number) => {
      const p = Math.min(1, (now - start) / dur);
      setV(Math.round(from + easeOut(p) * (target - from)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, dur]);
  return v.toLocaleString();
}

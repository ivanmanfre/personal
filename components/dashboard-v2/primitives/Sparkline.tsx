import React, { useLayoutEffect, useRef } from 'react';

export function Sparkline({ points, stroke, width=74, height=30 }:{points:number[];stroke:string;width?:number;height?:number}) {
  const max = Math.max(...points), min = Math.min(...points), span = max - min || 1;
  const step = width / (points.length - 1);
  const d = points.map((p,i)=>`${i?'L':'M'}${(i*step).toFixed(1)},${(height - ((p-min)/span)*(height-4) - 2).toFixed(1)}`).join(' ');
  const pathRef = useRef<SVGPathElement>(null);
  useLayoutEffect(() => {
    const el = pathRef.current;
    if (!el) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const len = el.getTotalLength();
    el.style.strokeDasharray = String(len);
    if (reduce) {
      el.style.strokeDashoffset = '0';
    } else {
      el.style.strokeDashoffset = String(len);
      // trigger the CSS keyframe on next frame
      requestAnimationFrame(() => { el.style.animation = 'ds-draw 1.4s ease .3s forwards'; });
    }
  }, [d]);
  return (
    <svg width={width} height={height} className="ds-spark" aria-hidden>
      <path ref={pathRef} d={d} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round"/>
    </svg>
  );
}

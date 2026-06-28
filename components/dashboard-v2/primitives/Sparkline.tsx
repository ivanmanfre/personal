import React from 'react';

export function Sparkline({ points, stroke, width=74, height=30 }:{points:number[];stroke:string;width?:number;height?:number}) {
  const max = Math.max(...points), min = Math.min(...points), span = max - min || 1;
  const step = width / (points.length - 1);
  const d = points.map((p,i)=>`${i?'L':'M'}${(i*step).toFixed(1)},${(height - ((p-min)/span)*(height-4) - 2).toFixed(1)}`).join(' ');
  return (
    <svg width={width} height={height} className="ds-spark" aria-hidden>
      <path d={d} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round"
        style={{strokeDasharray:300, strokeDashoffset:300, animation:'ds-draw 1.4s ease .3s forwards'}}/>
    </svg>
  );
}

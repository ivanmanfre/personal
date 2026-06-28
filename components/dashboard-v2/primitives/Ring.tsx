import React from 'react';

export function Ring({ value, max=100, stroke, size=60 }:{value:number;max:number;stroke:string;size?:number}) {
  const r = size/2 - 4, c = 2*Math.PI*r, off = c - (value/max)*c;
  return (
    <svg width={size} height={size} aria-hidden>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--ds-line)" strokeWidth={7}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={stroke} strokeWidth={7} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{strokeDasharray:c, strokeDashoffset:c, animation:`ds-ring 1.4s cubic-bezier(.3,.8,.3,1) .3s forwards`, ['--off' as any]:off}}/>
    </svg>
  );
}

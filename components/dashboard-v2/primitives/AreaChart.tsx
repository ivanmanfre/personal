import React, { useLayoutEffect, useRef } from 'react';

interface AreaChartProps {
  points: number[];
  stroke: string;
  fillId: string;
  height?: number;
}

export function AreaChart({ points, stroke, fillId, height = 150 }: AreaChartProps) {
  const width = 560;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = max - min || 1;
  const step = width / (points.length - 1);

  const coords = points.map((p, i) => ({
    x: i * step,
    y: height - ((p - min) / span) * (height - 20) - 10,
  }));

  const linePath = coords
    .map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`)
    .join(' ');

  const fillPath =
    linePath +
    ` L${coords[coords.length - 1].x.toFixed(1)},${height} L0,${height} Z`;

  const lineRef = useRef<SVGPathElement>(null);

  useLayoutEffect(() => {
    const el = lineRef.current;
    if (!el) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const len = el.getTotalLength();
    el.style.strokeDasharray = String(len);
    if (reduce) {
      el.style.strokeDashoffset = '0';
    } else {
      el.style.strokeDashoffset = String(len);
      requestAnimationFrame(() => { el.style.animation = 'ds-draw 1.8s ease .3s forwards'; });
    }
  }, [linePath]);

  return (
    <svg
      className="ds-area"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={{ width: '100%', height, display: 'block', overflow: 'visible' }}
      aria-hidden
    >
      <defs>
        <linearGradient id={fillId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={stroke} stopOpacity={0.22} />
          <stop offset="1" stopColor={stroke} stopOpacity={0} />
        </linearGradient>
      </defs>
      {/* fill fades in after line draws */}
      <path
        d={fillPath}
        fill={`url(#${fillId})`}
        style={{ opacity: 0, animation: 'ds-fadein 1s ease 1s forwards' }}
      />
      {/* line draws on mount — dash values set by useLayoutEffect */}
      <path
        ref={lineRef}
        d={linePath}
        fill="none"
        stroke={stroke}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
    </svg>
  );
}

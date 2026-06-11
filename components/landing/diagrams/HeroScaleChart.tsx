import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { DIAGRAM, prefersReducedMotion } from './tokens';

// Hero chart: the value prop as a drawing — clients climb 2–3x while payroll
// stays flat. One draw-on-load entrance (≥lg, motion-ok); everything else
// gets the final state. The 2–3x marker is the headline's own claim, not a
// new statistic — the chart is explicitly schematic (no axis numbers).
const W = 1120;
const H = 240;
const X0 = 8;
const X1 = 1000;
const FLAT_Y = 168;
const RISE_END_Y = 44;
const flatD = `M ${X0} ${FLAT_Y} L ${X1} ${FLAT_Y}`;
const riseD = `M ${X0} ${FLAT_Y} C 320 ${FLAT_Y - 8}, 560 ${FLAT_Y - 34}, 740 ${FLAT_Y - 70} S 950 ${RISE_END_Y + 26}, ${X1} ${RISE_END_Y}`;

const MONO_LABEL: React.CSSProperties = {};

const HeroScaleChart: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const animate = !compact && !prefersReducedMotion();

  useEffect(() => {
    if (!animate || !svgRef.current) return;
    const svg = svgRef.current;
    const mm = gsap.matchMedia();
    mm.add('(min-width: 1024px)', () => {
      const flat = svg.querySelector('[data-flat-line]') as SVGPathElement;
      const rise = svg.querySelector('[data-rise-line]') as SVGPathElement;
      const marks = Array.from(svg.querySelectorAll('[data-chart-mark]')) as SVGElement[];
      if (!flat || !rise) return;
      const fl = flat.getTotalLength();
      const rl = rise.getTotalLength();
      gsap.set(flat, { strokeDasharray: fl, strokeDashoffset: fl });
      gsap.set(rise, { strokeDasharray: rl, strokeDashoffset: rl });
      gsap.set(marks, { opacity: 0, y: 6 });
      const tl = gsap.timeline({ delay: 1.45 }); // after the copy has settled
      tl.to(flat, { strokeDashoffset: 0, duration: 0.9, ease: 'power1.inOut' }, 0);
      tl.to(rise, { strokeDashoffset: 0, duration: 1.5, ease: 'power2.inOut' }, 0.15);
      tl.to(marks, { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out', stagger: 0.12 }, 1.35);
      return () => {
        tl.kill();
      };
    });
    return () => mm.revert();
  }, [animate]);

  const isStatic = !animate;
  const markStyle = isStatic ? {} : { opacity: 0 };
  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      role="img"
      aria-label="Schematic: client volume climbs 2 to 3 times while payroll stays flat"
      style={{ display: 'block', overflow: 'visible' }}
    >
      {/* faint horizontal guides — print-feel, not a data grid */}
      {[FLAT_Y, (FLAT_Y + RISE_END_Y) / 2, RISE_END_Y].map((y) => (
        <line key={y} x1={X0} y1={y} x2={X1} y2={y} stroke="#1A1A1A" strokeWidth={1} opacity={0.05} />
      ))}

      <path data-flat-line d={flatD} stroke={DIAGRAM.connector} strokeWidth={DIAGRAM.nodeStroke} fill="none" />
      <path data-rise-line d={riseD} stroke={DIAGRAM.sage} strokeWidth={DIAGRAM.signalStroke} fill="none" />

      {/* sage endpoint — done-state square, same vocabulary as the diagrams */}
      <rect data-chart-mark x={X1 - 4} y={RISE_END_Y - 4} width={8} height={8} fill={DIAGRAM.sage} style={markStyle} />

      {/* numeral lockup: italic serif 2–3x + mono caption */}
      <text
        data-chart-mark
        x={X1 + 16}
        y={RISE_END_Y + 12}
        fontFamily='"DM Serif Display", Georgia, serif'
        fontStyle="italic"
        fontSize={compact ? 30 : 44}
        fill={DIAGRAM.sage}
        style={markStyle}
      >
        2–3x
      </text>
      <text
        data-chart-mark
        x={X1 + 17}
        y={RISE_END_Y + 34}
        fontFamily={DIAGRAM.font}
        fontSize={11}
        letterSpacing="0.14em"
        fill={DIAGRAM.label}
        style={markStyle}
      >
        MORE CLIENTS
      </text>
      <text
        data-chart-mark
        x={X1 + 17}
        y={FLAT_Y + 4}
        fontFamily={DIAGRAM.font}
        fontSize={11}
        letterSpacing="0.14em"
        fill={DIAGRAM.label}
        style={markStyle}
      >
        PAYROLL · FLAT
      </text>
    </svg>
  );
};

export default HeroScaleChart;

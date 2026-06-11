import React, { useEffect, useMemo, useRef } from 'react';
import gsap from 'gsap';
import { serpentineLayout, horizontalLayout } from './layout';
import { DiagramNode } from './DiagramSvg';
import { DIAGRAM, prefersReducedMotion } from './tokens';

// Scene 1: the Call Intelligence pipeline (real build) as the hero's visual
// anchor. Desktop: vertical serpentine in the right column, one sage pulse
// looping end-to-end (~5.5s travel + 2s rest). Nodes tick to done-state as
// the pulse passes. Mobile (compact): 3-node static horizontal version.
// Reduced motion: static final state (solid sage path, all nodes ticked).
const LABELS = ['call recorded', 'transcribed', 'graded vs 8-criteria rubric', 'risk flagged', 'routed < 1 hr'];
const COMPACT_LABELS = ['recorded', 'graded', 'routed'];
const W = 420;
const H = 520;
const TRAVEL = 5.5;

const HeroPipeline: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const layout = useMemo(
    () => (compact ? horizontalLayout(COMPACT_LABELS, 320, 48) : serpentineLayout(LABELS, W, H)),
    [compact],
  );
  const animate = !compact && !prefersReducedMotion();

  useEffect(() => {
    if (!animate || !svgRef.current) return;
    const svg = svgRef.current;
    const mm = gsap.matchMedia();
    mm.add('(min-width: 1024px)', () => {
      const sage = svg.querySelector<SVGPathElement>('[data-signal-path]');
      const rects = Array.from(svg.querySelectorAll('[data-node-rect]')) as SVGRectElement[];
      const ticks = Array.from(svg.querySelectorAll('[data-node-tick]')) as SVGRectElement[];
      if (!sage) return;
      const total = sage.getTotalLength();
      gsap.set(sage, { strokeDasharray: `${DIAGRAM.pulseLen} ${total}`, opacity: 1 });
      const tl = gsap.timeline({ repeat: -1, repeatDelay: 2 });
      tl.fromTo(
        sage,
        { strokeDashoffset: DIAGRAM.pulseLen },
        { strokeDashoffset: -total, duration: TRAVEL, ease: 'none' },
        0,
      );
      rects.forEach((r, i) => {
        const at = (i / (rects.length - 1)) * TRAVEL;
        tl.fromTo(r, { stroke: DIAGRAM.ink }, { stroke: DIAGRAM.inkDone, duration: 0.3 }, at);
        tl.fromTo(ticks[i], { opacity: 0 }, { opacity: 1, duration: 0.3 }, at);
      });
      return () => {
        tl.kill();
      };
    });
    return () => mm.revert();
  }, [animate]);

  const isStatic = !animate; // compact or reduced-motion: render the final state
  return (
    <div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        width="100%"
        role="img"
        aria-label="Call Intelligence pipeline: call recorded, transcribed, graded against an 8-criteria rubric, risk flagged, routed within the hour"
        style={{ display: 'block', overflow: 'visible' }}
      >
        <path d={layout.pathD} stroke={DIAGRAM.connector} strokeWidth={DIAGRAM.nodeStroke} fill="none" />
        <path
          data-signal-path
          d={layout.pathD}
          stroke={DIAGRAM.sage}
          strokeWidth={DIAGRAM.signalStroke}
          fill="none"
          opacity={isStatic ? 1 : 0}
        />
        {layout.nodes.map((n, i) => (
          <DiagramNode key={`${n.label}-${i}`} node={n} ticked={isStatic} />
        ))}
      </svg>
      <div
        style={{
          fontFamily: DIAGRAM.font,
          fontSize: 11,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: DIAGRAM.label,
          marginTop: 12,
          textAlign: compact ? 'left' : 'right',
        }}
      >
        every call · daily
      </div>
    </div>
  );
};

export default HeroPipeline;

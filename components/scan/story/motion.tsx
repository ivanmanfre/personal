import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {animate, motion, useInView, useReducedMotion} from 'framer-motion';

/** Counts up to the value once it scrolls into view. */
export function NumberTicker({value, className}: {value: number; className?: string}) {
 const ref = useRef<HTMLSpanElement>(null), seen = useInView(ref, {once: true}), reduced = useReducedMotion();
 const [shown, setShown] = useState(reduced ? value : 0);
 useEffect(() => {
  if (!seen || reduced) { setShown(value); return; }
  const c = animate(0, value, {duration: Math.min(1.6, .5 + value / 40), ease: [.16, 1, .3, 1], onUpdate: v => setShown(Math.round(v))});
  return () => c.stop();
 }, [seen, value, reduced]);
 return <span ref={ref} className={`sm-num ${className ?? ''}`} style={{fontVariantNumeric: 'tabular-nums'}}>{shown}</span>;
}

/** Headline words sharpen in one after another as the line enters the screen. */
export function BlurWords({text, as: Tag = 'h2', className}: {text: string; as?: 'h1' | 'h2'; className?: string}) {
 const reduced = useReducedMotion();
 if (reduced) return <Tag className={className}>{text}</Tag>;
 const words = text.split(' ');
 return <Tag className={className} aria-label={text}>
  {words.map((w, i) => <motion.span key={i} aria-hidden="true" style={{display: 'inline-block', whiteSpace: 'pre'}}
   initial={{opacity: 0, filter: 'blur(10px)', y: 12}} whileInView={{opacity: 1, filter: 'blur(0px)', y: 0}} viewport={{once: true, amount: .6}}
   transition={{duration: .55, delay: i * .045, ease: [.22, .84, .36, 1]}}>{w}{i < words.length - 1 ? ' ' : ''}</motion.span>)}
 </Tag>;
}

/** An endless strip; pauses on hover, stands still for reduced motion. */
export function Marquee({children, seconds = 40}: {children: React.ReactNode; seconds?: number}) {
 return <div className="sm-marquee" style={{'--sm-duration': `${seconds}s`} as React.CSSProperties}>
  <div className="sm-marquee-track">{children}</div>
  <div className="sm-marquee-track" aria-hidden="true">{children}</div>
 </div>;
}

type Beam = {from: string; to: string; active?: boolean; vertical?: boolean};
/** Curved wires between named boxes inside a container, with a light pulse running along the active ones. */
export function Beams({root, beams, deps}: {root: React.RefObject<HTMLElement | null>; beams: Beam[]; deps: unknown[]}) {
 const [paths, setPaths] = useState<(Beam & {d: string})[]>([]), [size, setSize] = useState({w: 0, h: 0});
 const reduced = useReducedMotion();
 useLayoutEffect(() => {
  const el = root.current; if (!el) return;
  const update = () => {
   const base = el.getBoundingClientRect(); setSize({w: base.width, h: base.height});
   setPaths(beams.flatMap(b => {
    const a = el.querySelector<HTMLElement>(`[data-beam="${b.from}"]`)?.getBoundingClientRect(), z = el.querySelector<HTMLElement>(`[data-beam="${b.to}"]`)?.getBoundingClientRect();
    if (!a || !z) return [];
    if (b.vertical) { const x1 = a.left + a.width / 2 - base.left, y1 = a.bottom - base.top, x2 = z.left + z.width / 2 - base.left, y2 = z.top - base.top; return [{...b, d: `M ${x1} ${y1} L ${x2} ${y2}`}]; }
    const x1 = a.right - base.left, y1 = a.top + a.height / 2 - base.top, x2 = z.left - base.left, y2 = z.top + Math.min(z.height / 2, 90) - base.top, mx = (x1 + x2) / 2;
    return [{...b, d: `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}];
   }));
  };
  const ro = new ResizeObserver(update); ro.observe(el); el.querySelectorAll('[data-beam]').forEach(n => ro.observe(n)); update();
  return () => ro.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
 }, deps);
 return <svg className="sm-beams" width={size.w} height={size.h} aria-hidden="true">
  <defs><linearGradient id="sm-beam-grad" x1="0" x2="1"><stop offset="0" stopColor="#d9412b" stopOpacity="0"/><stop offset=".5" stopColor="#ff7a59"/><stop offset="1" stopColor="#ffd2a6" stopOpacity="0"/></linearGradient></defs>
  {paths.map(p => <g key={p.from + p.to} className={p.active ? 'is-active' : ''}>
   <path className="sm-beam-base" d={p.d}/>
   {!reduced && p.active && <path className="sm-beam-pulse" d={p.d} pathLength={100}/>}
  </g>)}
 </svg>;
}

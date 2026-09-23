import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export const visitorStops = [
  { id: 'content', label: 'Finds your post', icon: 'in' },
  { id: 'inbound', label: 'Requests your lead magnet', icon: '↗' },
  { id: 'outreach', label: 'Starts a conversation', icon: '↳' },
  { id: 'newsletter', label: 'Gets to know you', icon: '✉' },
  { id: 'together', label: 'Books a qualified call', icon: '✓' },
];

/** Original illustration. Limbs follow scroll distance; the visitor rests when scrolling stops. */
export function Visitor({ stride = 0 }: { stride?: number }) {
  return <svg viewBox="0 0 70 98" fill="none" aria-hidden="true" className="journey-visitor-art">
    <ellipse cx="36" cy="93" rx="21" ry="3" fill="#26384b" opacity=".1"/>
    <g style={{ transform: `rotate(${-stride}deg)`, transformOrigin: '33px 61px' }}><path d="M30 58L27 75L20 87" stroke="#304459" strokeWidth="10" strokeLinecap="round"/><path d="M18 85L14 91H26" stroke="#182a3c" strokeWidth="6" strokeLinecap="round"/></g>
    <g style={{ transform: `rotate(${stride}deg)`, transformOrigin: '38px 61px' }}><path d="M39 59L41 76L45 88" stroke="#536b81" strokeWidth="10" strokeLinecap="round"/><path d="M44 89H55" stroke="#182a3c" strokeWidth="6" strokeLinecap="round"/></g>
    <path d="M22 35C15 39 15 57 18 63L25 61L30 38" fill="#ab3826"/>
    <path d="M26 31C31 28 40 28 45 33L48 63C42 68 28 67 21 63L23 40Z" fill="#da5940"/>
    <path d="M31 30L35 42L41 30" fill="#eff5fb"/>
    <path d="M33 22V32C36 36 40 32 40 30V21" fill="#d9a37c"/>
    <path d="M26 12C26 3 46 3 48 14L46 25C44 32 31 30 28 23Z" fill="#edbe99"/>
    <path d="M26 19C18 9 27 1 38 3C49 0 54 9 48 16L45 11C40 16 31 10 30 20Z" fill="#293c4a"/>
    <circle cx="43" cy="19" r="1.3" fill="#263340"/><path d="M41 25L45 24" stroke="#ac7358" strokeWidth="1.3" strokeLinecap="round"/>
    <path d="M45 39L47 53L56 49" stroke="#c84730" strokeWidth="10" strokeLinecap="round"/><path d="M55 49L59 47" stroke="#edbe99" strokeWidth="7" strokeLinecap="round"/>
    <rect x="52" y="34" width="10" height="16" rx="2.5" transform="rotate(13 52 34)" fill="#26384b"/><path d="M55 38L60 39" stroke="#f1b29f" strokeWidth="2" strokeLinecap="round"/>
    <path d="M19 60L19 65" stroke="#edbe99" strokeWidth="6" strokeLinecap="round"/>
  </svg>;
}

export function JourneyVisitor() {
  const reduced = useReducedMotion();
  const [position, setPosition] = useState({ progress: 0, active: 0, visible: false, stride: 0 });
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const tops = visitorStops.map(s => document.getElementById(s.id)?.getBoundingClientRect().top ?? Infinity);
      const line = innerHeight * .45;
      let active = Math.max(0, tops.filter(t => t <= line).length - 1);
      const span = tops[active + 1] - tops[active];
      const within = active < 4 && Number.isFinite(span) ? Math.max(0, Math.min(1, (line - tops[active]) / span)) : 0;
      const end = document.getElementById('proof')?.getBoundingClientRect().top ?? Infinity;
      setPosition({ progress: Math.min(1, (active + within) / 4), active, visible: tops[0] <= line && end > line, stride: reduced ? 0 : Math.sin(scrollY / 34) * 14 });
    };
    const scroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    addEventListener('scroll', scroll, { passive: true }); addEventListener('resize', scroll); update();
    return () => { cancelAnimationFrame(frame); removeEventListener('scroll', scroll); removeEventListener('resize', scroll); };
  }, [reduced]);
  return <nav className={`visitor-rail ${position.visible ? 'is-visible' : ''}`} aria-label="Follow the example visitor">
    <div className="visitor-track"><div className="visitor-track-line"/><motion.div className="visitor-position" animate={{ y: position.progress * 300 }} transition={{ duration: reduced ? 0 : .18, ease: 'easeOut' }}><Visitor stride={position.stride}/></motion.div>
      {visitorStops.map((stop, i) => <a key={stop.id} href={`#${stop.id}`} style={{ top: `${i * 75}px` }} aria-label={stop.label} aria-current={position.active === i ? 'step' : undefined}><span>{stop.icon}</span><b>{stop.label}</b></a>)}
    </div>
    <div className="visitor-mobile"><Visitor stride={position.stride}/><div><b>{visitorStops[position.active].label}</b><div className="visitor-mobile-stops">{visitorStops.map((s, i) => <a key={s.id} href={`#${s.id}`} aria-label={s.label} aria-current={position.active === i ? 'step' : undefined} className={i <= position.active ? 'is-passed' : ''}/>)}</div></div><a href={`#${visitorStops[Math.min(4, position.active + 1)].id}`} aria-label="Next part of the story">↓</a></div>
  </nav>;
}

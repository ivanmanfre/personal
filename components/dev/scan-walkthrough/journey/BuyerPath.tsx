import React, { useEffect, useState } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring } from 'framer-motion';

/** The example reader: a small illustrated figure reading on a phone. Walk/idle motion is CSS-driven (see .rb-* rules). */
export function Buyer() {
  return <svg className="rb" viewBox="0 0 56 78" fill="none" aria-hidden="true">
    <ellipse className="rb-shadow" cx="28" cy="75" rx="13" ry="2.6" fill="#131210" opacity=".14"/>
    <g className="rb-figure" stroke="#131210" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
      <g className="rb-leg rb-leg-back"><path d="M26 47l-2 16-4 7"/><path d="M20 70l-5 1" strokeWidth="3.2"/></g>
      <g className="rb-leg rb-leg-front"><path d="M30 47l2 16 4 7"/><path d="M36 70l5 1" strokeWidth="3.2"/></g>
      <path className="rb-torso" d="M21 28h14l3 20H18z" fill="#c8361b" stroke="#c8361b"/>
      <path className="rb-strap" d="M23 28l8 20" stroke="#131210" strokeWidth="1.6" opacity=".55"/>
      <g className="rb-arm rb-arm-back"><path d="M22 31l-8 10 5 8"/></g>
      <g className="rb-arm rb-arm-front"><path d="M34 31l6 9-4 8"/><rect x="31" y="44" width="9" height="12" rx="1.5" fill="#fff" strokeWidth="1.8" transform="rotate(-18 35.5 50)"/></g>
      <path d="M28 22v6"/>
      <g className="rb-head"><path d="M19 12c0-7 18-8 18 0v6c0 5-4 8-9 8s-9-3-9-8z" fill="#fff"/><path d="M18 13c0-9 20-9 20 0l-3 1c-2-3-5-3-7 0-2-3-5-3-7 0z" fill="#131210" stroke="#131210"/><circle cx="33" cy="15" r=".8" fill="#131210" stroke="none"/></g>
    </g>
  </svg>;
}
/** Walks each chapter transition as the page scrolls. Position is spring-smoothed; the figure fades out once it has entered the next chapter. */
export function BuyerPath({ rootRef }: { rootRef: React.RefObject<HTMLElement|null> }) {
  const reduced = useReducedMotion();
  const [state,setState] = useState({walking:false,reverse:false,ready:false});
  const rawX = useMotionValue(0), rawY = useMotionValue(0), rawO = useMotionValue(0);
  const x = useSpring(rawX,{stiffness:150,damping:24,mass:.7}), y = useSpring(rawY,{stiffness:150,damping:24,mass:.7}), opacity = useSpring(rawO,{stiffness:110,damping:22});
  useEffect(() => {
    const root=rootRef.current;if(!root || reduced)return;
    let anchors:{el:HTMLElement;top:number;height:number}[]=[], frame=0, idle:ReturnType<typeof setTimeout>,lastY=-1,lastAnchor:HTMLElement|null=null;
    function measure(){const base=root!.getBoundingClientRect().top+window.scrollY;anchors=Array.from(root!.querySelectorAll<HTMLElement>('[data-journey-transition]')).map(el=>{const r=el.getBoundingClientRect();return {el,top:r.top+window.scrollY-base,height:r.height};});update(true);}
    function update(jump=false){frame=0;const base=root!.getBoundingClientRect().top+window.scrollY;const at=window.scrollY+window.innerHeight*.64-base;const anchor=[...anchors].reverse().find(a=>a.top<=at)||anchors[0];if(!anchor)return;const span=anchor.height-88;const progress=Math.min(1,Math.max(0,(at-anchor.top)/span));const desktop=window.innerWidth>=1024;const xv=desktop?root!.clientWidth/2-424:24+progress*75;const yv=anchor.top+progress*span;const visible=progress>.02&&progress<.98;
      if(jump||anchor.el!==lastAnchor){x.jump(xv);y.jump(yv);opacity.jump(0);lastY=-1;}lastAnchor=anchor.el;rawX.set(xv);rawY.set(yv);rawO.set(visible?1:0);
      const walking=visible&&Math.abs(yv-lastY)>.5;const reverse=lastY>=0&&yv<lastY-1;lastY=yv;for(const a of anchors)a.el.classList.toggle('is-active',a===anchor&&walking);
      setState(s=>({walking,reverse:walking?reverse:s.reverse,ready:true}));clearTimeout(idle);idle=setTimeout(()=>{for(const a of anchors)a.el.classList.remove('is-active');setState(s=>({...s,walking:false}));},130);}
    const scroll=()=>{if(!frame)frame=requestAnimationFrame(()=>update());};
    const observer=new ResizeObserver(measure);observer.observe(root);measure();window.addEventListener('scroll',scroll,{passive:true});window.addEventListener('resize',measure);
    return()=>{observer.disconnect();window.removeEventListener('scroll',scroll);window.removeEventListener('resize',measure);cancelAnimationFrame(frame);clearTimeout(idle);for(const a of anchors)a.el.classList.remove('is-active');};
  },[rootRef,reduced,rawX,rawY,rawO,x,y,opacity]);
  if(reduced || !state.ready)return null;
  return <motion.div className={`journey-buyer${state.walking?' is-walking':''}`} data-dir={state.reverse?'back':'forward'} aria-hidden="true" style={{x,y,opacity}}><span className="rb-flip"><Buyer/></span></motion.div>;
}

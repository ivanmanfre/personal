import React, { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

export function Buyer({ pose = 0, reverse = false }: {pose?: number; reverse?: boolean}) {
  const limbs = [ [0,0,0,0], [-22,20,24,-20],[-10,8,12,-9],[22,-20,-24,20],[10,-8,-12,9] ][pose];
  return <svg viewBox="0 0 48 64" fill="none" aria-hidden="true"><g transform={reverse?'translate(48 0) scale(-1 1)':undefined} stroke="#131210" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round"><path d="M18 22l-3 15 12 3 5-15" fill="#c8361b" stroke="#c8361b"/><path d="M20 38l-2 19-7 2" transform={`rotate(${limbs[2]} 20 38)`}/><path d="M26 39l3 17 7 3" transform={`rotate(${limbs[3]} 26 39)`}/><path d="M18 25l-8 11 4 8" transform={`rotate(${limbs[0]} 18 25)`}/><path d="M29 25l6 12 7-2" transform={`rotate(${limbs[1]} 29 25)`}/><path d="M22 19l-1 5"/><path d="M17 9c0-6 13-7 14 0l1 7-6 4-7-3z" fill="white"/><path d="M17 10l-2-6 8-3 7 3-2 5-5-2-2 4" fill="#131210"/><circle cx="28" cy="12" r=".65" fill="#131210" stroke="none"/></g></svg>;
}
export function BuyerPath({ rootRef }: { rootRef: React.RefObject<HTMLElement|null> }) {
  const reduced = useReducedMotion();
  const [position,setPosition] = useState({x:0,y:0,pose:0,reverse:false,ready:false});
  useEffect(() => {
    const root=rootRef.current;if(!root || reduced)return;
    let anchors:{top:number;height:number}[]=[], frame=0, idle:ReturnType<typeof setTimeout>,lastY=-1;
    function measure(){const base=root!.getBoundingClientRect().top+window.scrollY;anchors=Array.from(root!.querySelectorAll('[data-journey-transition]')).map(el=>{const r=el.getBoundingClientRect();return {top:r.top+window.scrollY-base,height:r.height};});update();}
    function update(){frame=0;const base=root!.getBoundingClientRect().top+window.scrollY;const at=window.scrollY+window.innerHeight*.64-base;const anchor=[...anchors].reverse().find(a=>a.top<=at)||anchors[0];if(!anchor)return;const progress=Math.min(1,Math.max(0,(at-anchor.top)/(anchor.height-48)));const desktop=window.innerWidth>=1024;const x=desktop?root!.clientWidth/2-420:24+progress*75;const y=anchor.top+progress*(anchor.height-48);const moving=Math.abs(y-lastY)>.5;const reverse=lastY>=0&&y<lastY;lastY=y;setPosition({x,y,pose:moving?1+Math.floor(y/9)%4:0,reverse,ready:true});clearTimeout(idle);idle=setTimeout(()=>setPosition(p=>({...p,pose:0})),130);}
    const scroll=()=>{if(!frame)frame=requestAnimationFrame(update);};
    const observer=new ResizeObserver(measure);observer.observe(root);measure();window.addEventListener('scroll',scroll,{passive:true});window.addEventListener('resize',measure);
    return()=>{observer.disconnect();window.removeEventListener('scroll',scroll);window.removeEventListener('resize',measure);cancelAnimationFrame(frame);clearTimeout(idle);};
  },[rootRef,reduced]);
  if(reduced || !position.ready)return null;
  return <div className="journey-buyer" aria-hidden="true" style={{transform:`translate3d(${position.x}px,${position.y}px,0)`}}><Buyer pose={position.pose} reverse={position.reverse}/></div>;
}

import React, {useLayoutEffect, useRef, useState} from 'react';

/** LinkedIn-style "…see more": long sample copy opens on the hook, the reader expands the rest. */
export function SeeMore({children, lines = 5}: {children: React.ReactNode; lines?: number}) {
 const ref = useRef<HTMLDivElement>(null);
 const [open, setOpen] = useState(false), [long, setLong] = useState(false);
 useLayoutEffect(() => {
  const el = ref.current; if (!el) return;
  const measure = () => { const lh = parseFloat(getComputedStyle(el).lineHeight) || 24; setLong(el.scrollHeight > lh * (lines + 1.5)); };
  measure(); const ro = new ResizeObserver(measure); ro.observe(el); return () => ro.disconnect();
 }, [lines]);
 return <div className={`see-more ${long && !open ? 'is-clamped' : ''}`} style={{'--see-more-lines': lines} as React.CSSProperties}>
  <div ref={ref} className="see-more-body">{children}</div>
  {long && <button type="button" className="see-more-toggle" aria-expanded={open} onClick={() => setOpen(v => !v)}>{open ? 'Show less' : '…see more'}</button>}
 </div>;
}

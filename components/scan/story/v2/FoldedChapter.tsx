import React, {useEffect, useRef, useState} from 'react';
import {ChevronDown} from 'lucide-react';
import {FOLD} from './copy';

const hashIs = (id: string) => typeof window !== 'undefined' && window.location.hash === `#${id}`;

/** A closed step card: number, label, title, one sentence and one compact visual. The samples mount on
 * first open (so their images are not fetched until asked for) and stay mounted after. */
export function FoldedChapter({id, n, label, title, why, preview, children}: {id: string; n: number; label: string; title: string; why: string; preview: React.ReactNode; children: () => React.ReactNode}) {
 const [open, setOpen] = useState(() => hashIs(id));
 const [mounted, setMounted] = useState(open);
 const root = useRef<HTMLElement>(null);
 const body = useRef<React.ReactNode>(null);
 if (mounted && body.current === null) body.current = children();
 useEffect(() => {
  const onHash = () => { if (hashIs(id)) { setOpen(true); setMounted(true); } };
  window.addEventListener('hashchange', onHash);
  return () => window.removeEventListener('hashchange', onHash);
 }, [id]);
 const toggle = () => {
  const next = !open;
  setOpen(next);
  if (next) { setMounted(true); root.current?.dispatchEvent(new CustomEvent('scan:fold', {bubbles: true, detail: {id, open: true}})); }
 };
 const panel = `${id}-samples`;
 return <section ref={root} className={`sv2-fold ${open ? 'is-open' : ''}`} id={id} data-scan-section={id}>
  <div className="sv2-fold-card">
   <div className="sv2-fold-text">
    <span className="sp-eyebrow"><b>{String(n).padStart(2, '0')}</b>{label}<em className="sp-eyebrow-group">{n <= 2 ? 'Inbound' : 'Outbound'}</em></span>
    <h2>{title}</h2>
    <p>{why}</p>
    <button type="button" className="sv2-fold-toggle" aria-expanded={open} aria-controls={panel} onClick={toggle}>{open ? FOLD.close : FOLD.open}<ChevronDown size={17} aria-hidden="true"/></button>
   </div>
   <div className="sv2-fold-preview" aria-hidden={open || undefined}>{preview}</div>
  </div>
  <div id={panel} className="sv2-fold-body" hidden={!open}>{mounted ? body.current : null}</div>
 </section>;
}

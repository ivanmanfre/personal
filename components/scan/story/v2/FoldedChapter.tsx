import React, {useEffect, useRef, useState} from 'react';
import {ChevronDown} from 'lucide-react';
import {FOLD} from './copy';

const hashIs = (id: string) => typeof window !== 'undefined' && window.location.hash === `#${id}`;

/** A closed step card: number, label, title, one sentence and one compact visual. A native details element,
 * so the samples are in the prerendered HTML, open without JavaScript and expose their state to assistive tech.
 * The card is the summary; the samples are the details body. */
export function FoldedChapter({id, n, label, title, why, preview, children}: {id: string; n: number; label: string; title: string; why: string; preview: React.ReactNode; children: () => React.ReactNode}) {
 const [open, setOpen] = useState(() => hashIs(id));
 const root = useRef<HTMLDetailsElement>(null);
 useEffect(() => {
  const onHash = () => { if (hashIs(id)) setOpen(true); };
  window.addEventListener('hashchange', onHash);
  return () => window.removeEventListener('hashchange', onHash);
 }, [id]);
 // A user opening the card (click, Enter or Space on the summary) reports one fold event; a hash open does not.
 const onSummary = () => { if (!root.current?.open) root.current?.dispatchEvent(new CustomEvent('scan:fold', {bubbles: true, detail: {id, open: true}})); };
 const panel = `${id}-samples`;
 return <section className="sv2-fold" id={id} data-scan-section={id}>
  <details ref={root} className="sv2-fold-details" open={open} onToggle={e => setOpen(e.currentTarget.open)}>
   <summary className="sv2-fold-card" aria-controls={panel} onClick={onSummary}>
    <span className="sv2-fold-text">
     <span className="sp-eyebrow"><b>{String(n).padStart(2, '0')}</b>{label}<em className="sp-eyebrow-group">{n <= 2 ? 'Inbound' : 'Outbound'}</em></span>
     <h2>{title}</h2>
     <span className="sv2-fold-why">{why}</span>
     <span className="sv2-fold-toggle"><span className="sv2-fold-when-closed">{FOLD.open}</span><span className="sv2-fold-when-open">{FOLD.close}</span><ChevronDown size={17} aria-hidden="true"/></span>
    </span>
    <span className="sv2-fold-preview" aria-hidden="true">{preview}</span>
   </summary>
   <div id={panel} className="sv2-fold-body">{children()}</div>
  </details>
 </section>;
}

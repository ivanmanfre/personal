import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
export const labels: Record<string,string> = { content: 'Get noticed', inbound: 'Capture the lead', newsletter: 'Stay in touch', outreach: 'Warm outreach', together: 'Bring it together' };
export function ReadingChapter({ id, number, title, why, children }: { id: string; number: string; title: string; why: string; children: React.ReactNode }) {
  return <section id={id} className="journey-chapter">
    <div className="journey-transition" aria-hidden="true"><span className="journey-step">{number}</span></div>
    <Reveal className="chapter-heading" as="header"><span className="journey-eyebrow">{number} / {labels[id]}</span><h2>{title}</h2><p>{why}</p></Reveal>
    <div className="journey-reading">{children}</div>
  </section>;
}
/** Scroll reveal: one rise per element, settled state under reduced motion. */
export function Reveal({ children, className, delay = 0, as = 'div', ...rest }: { children: React.ReactNode; className?: string; delay?: number; as?: 'div' | 'header' | 'article'; 'aria-label'?: string; 'data-mockup'?: string }) {
  const reduced = useReducedMotion();
  const Tag = as === 'header' ? motion.header : as === 'article' ? motion.article : motion.div;
  return <Tag {...rest} className={className} initial={reduced ? false : { opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .15 }} transition={{ duration: reduced ? 0 : .65, delay: reduced ? 0 : delay, ease: [.22, .84, .36, 1] }}>{children}</Tag>;
}
export function Paragraphs({ text, className = 'sample-body' }: {text: string; className?: string}) {
  return <div className={className}>{text.split(/\n\s*\n/).map((p,i) => <p key={i}>{p}</p>)}</div>;
}
export function Avatar({ src, name }: {src?: string; name: string}) {
  const [failed,setFailed] = React.useState(false);
  return <span className="journey-avatar">{src && !failed ? <img src={src} alt="" onError={() => setFailed(true)}/> : name.split(' ').map(n => n[0]).slice(0,2).join('')}</span>;
}

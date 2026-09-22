import React from 'react';
export function ReadingChapter({ id, number, title, why, children }: { id: string; number: string; title: string; why: string; children: React.ReactNode }) {
  return <section id={id} className="journey-chapter">
    <div className="journey-transition" data-journey-transition aria-hidden="true"><span className="journey-route-line"/><svg className="route-pulse" aria-hidden="true"><line x1="1" y1="0" x2="1" y2="100%"/></svg><span className="journey-step">{number}</span></div>
    <header className="chapter-heading"><span className="journey-eyebrow">{number} / {id === 'content' ? 'Get noticed' : id === 'inbound' ? 'Be useful' : id === 'newsletter' ? 'Stay in touch' : id === 'outreach' ? 'Start a conversation' : 'Bring it together'}</span><h2>{title}</h2><p>{why}</p></header>
    <div className="journey-reading">{children}</div>
  </section>;
}
export function Paragraphs({ text, className = 'sample-body' }: {text: string; className?: string}) {
  return <div className={className}>{text.split(/\n\s*\n/).map((p,i) => <p key={i}>{p}</p>)}</div>;
}
export function Avatar({ src, name }: {src?: string; name: string}) {
  const [failed,setFailed] = React.useState(false);
  return <span className="journey-avatar">{src && !failed ? <img src={src} alt="" onError={() => setFailed(true)}/> : name.split(' ').map(n => n[0]).slice(0,2).join('')}</span>;
}

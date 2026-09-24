import React, { useState } from 'react';
import { Check, Copy, Download } from 'lucide-react';
import { useStory } from './context';
import { RichText, cleanCopy } from './RichText';
import { BrandMark, brandFont, brandPalette } from './BrandSlide';
import type { ResourceOption } from './types';

/** Every resource mode read as one document: headed sections in order. */
function sectionsOf(o: ResourceOption) {
  const s: { heading: string; body: string }[] = [];
  if (o.team?.length) s.push({ heading: 'Team', body: o.team.map(t => `- ${t.role}: ${t.job}`).join('\n') });
  if (o.deliverables?.length) s.push({ heading: 'Deliverables', body: o.deliverables.map(d => `- ${d.label}: ${d.value}`).join('\n') });
  if (o.review) s.push({ heading: 'First client review', body: o.review });
  if (o.quote) s.push({ heading: 'Make the quotes comparable', body: o.changes ? `${o.quote}\n\n${o.changes}` : o.quote });
  if (o.rights) s.push({ heading: 'Usage and rights', body: o.rights });
  if (o.question) s.push({ heading: 'The question', body: o.question });
  if (o.people) s.push({ heading: 'Who takes part', body: o.people });
  if (o.record) s.push({ heading: 'Keep with each response', body: o.record });
  if (o.recruitment) s.push({ heading: 'Recruitment question', body: o.recruitment });
  return [...s, ...(o.sections || [])];
}

export function BrandResource() {
  const plan = useStory(), r = plan.resource, p = brandPalette(r.brand);
  const [index, setIndex] = useState(0), [copied, setCopied] = useState(false), [error, setError] = useState(false);
  const o = r.options[Math.min(index, r.options.length - 1)];
  const sections = sectionsOf(o);
  const text = [r.title, o.title, ...sections.map(s => `${s.heading}\n${cleanCopy(s.body)}`), `Example by ${plan.brand}. Adjust it to your project before using it.`].join('\n\n');
  async function copy() { try { await navigator.clipboard.writeText(text); setCopied(true); setError(false); } catch { setError(true); } }
  function download() { const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = `${plan.slug}-resource.txt`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
  const id = (i: number) => `resource-${index}-${i}`;
  return <article className="brand-resource" aria-label="Lead magnet sample" style={{ '--res-dark': p.dark, '--res-light': p.light, '--res-accent': p.accent, '--res-accent-ink': p.accentInk, '--res-mark': p.accentOnLight, '--res-font': brandFont(r.brand.font) } as React.CSSProperties}>
    <header className="brand-resource-bar"><BrandMark ground={p.dark} height={24}/><span>{plan.magnet}</span></header>
    <div className="brand-resource-grid">
      <aside className="brand-resource-side">
        <h3>{r.title}</h3>
        {r.options.length > 1 && <div className="brand-resource-options" role="group" aria-label="Choose an example">{r.options.map((x, i) => <button key={x.label} aria-pressed={i === index} onClick={() => { setIndex(i); setCopied(false); setError(false); }}>{x.label}</button>)}</div>}
        <nav aria-label="Sections"><ol>{sections.map((s, i) => <li key={s.heading}><a href={`#${id(i)}`}>{s.heading}</a></li>)}</ol></nav>
        <div className="brand-resource-actions"><button onClick={copy}>{copied ? <Check size={16}/> : <Copy size={16}/>}<span aria-live="polite">{copied ? 'Copied' : 'Copy the document'}</span></button><button onClick={download} aria-label="Download the document"><Download size={17}/></button></div>
        {error && <p role="status">Copy is unavailable here. Use the download button.</p>}
      </aside>
      <div className="brand-resource-doc" tabIndex={0} aria-label={o.title}>
        <p className="brand-resource-kicker">{o.title}</p>
        {sections.map((s, i) => <section key={s.heading} id={id(i)}><h4><span>{String(i + 1).padStart(2, '0')}</span>{s.heading}</h4><RichText text={s.body} className="brand-resource-body"/></section>)}
        <small>Example document. Businesses and numbers are illustrative.</small>
      </div>
    </div>
  </article>;
}

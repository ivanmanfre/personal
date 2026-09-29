import React, { useState } from 'react';
import { useStory } from './context';
import { RichText } from './RichText';
import { contrastInk } from './brandColors';

export const lum = (hex: string) => {
  const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
  return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
};
const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + .05) / (y + .05); };

/** The lead's palette as a dark ground, a light ground and an accent that reads on each. */
export function brandPalette(b: { surface: string; ink: string; accent: string }) {
  const [dark, light] = lum(b.surface) < lum(b.ink) ? [b.surface, b.ink] : [b.ink, b.surface];
  const accentOn = (ground: string) => contrast(b.accent, ground) >= 2.2 ? b.accent : ground === dark ? light : dark;
  return { dark, light, accent: b.accent, accentInk: contrastInk(b.accent), accentOnDark: accentOn(dark), accentOnLight: accentOn(light) };
}
/** Any logo becomes one colour that reads on the slide ground. */
export const logoOn = (ground: string) => lum(ground) < .35 ? 'brightness(0) invert(1)' : 'brightness(0)';
export const brandFont = (font?: string) => `${font ? `'${font}', ` : ''}'Schibsted Grotesk', Arial, sans-serif`;

export function BrandMark({ ground, height = 26 }: { ground: string; height?: number }) {
  const plan = useStory(), b = plan.resource.brand;
  const [failed, setFailed] = useState(false);
  return b.logo && !failed
    ? <img className="brand-mark" src={b.logo} alt={plan.brand} style={{ height, filter: logoOn(ground) }} onError={() => setFailed(true)}/>
    : <b className="brand-mark brand-wordmark">{plan.brand.split(/\s+[-|–:]\s+/)[0]}</b>;
}

export function BrandSlide({ index }: { index: number }) {
  const plan = useStory(), slide = plan.slides[index], n = plan.slides.length;
  const p = brandPalette(plan.resource.brand);
  const first = index === 0, last = index === n - 1 && n > 1;
  // Middle slides sit on the site's own background: a dark site stays dark.
  const siteDark = plan.resource.brand.surface === p.dark;
  const ground = first ? p.dark : last ? p.accent : siteDark ? p.dark : p.light;
  const ink = last ? p.accentInk : ground === p.dark ? p.light : p.dark;
  const mark = last ? p.accentInk : ground === p.dark ? p.accentOnDark : p.accentOnLight;
  const role = first ? 'hook' : last ? 'close' : 'point';
  const dense = slide.body.length + (slide.points || []).join('').length > 300;
  const points = slide.points || [];
  const layout = points.length >= 4 || index % 2 ? 'timeline' : 'tiles';
  const num = String(index + 1).padStart(2, '0');
  return <div className={`brand-slide brand-slide-${role}${dense ? ' is-dense' : ''}${points.length ? ` has-${layout}` : ' no-points'}`} style={{ background: ground, color: ink, fontFamily: brandFont(plan.resource.brand.font), '--slide-mark': mark, '--slide-pill-ink': contrastInk(mark) } as React.CSSProperties}>
    {!first && !last && <span className="brand-slide-ghost" aria-hidden="true">{num}</span>}
    {first && <svg className="brand-slide-orbit" viewBox="0 0 200 200" aria-hidden="true">{[96, 72, 48].map((r, i) => <circle key={r} cx="200" cy="200" r={r * 1.9} fill="none" stroke="var(--slide-mark)" strokeWidth={i === 2 ? 14 : 2} opacity={i === 2 ? .9 : .35}/>)}</svg>}
    <header><BrandMark ground={ground}/><span>{num} / {String(n).padStart(2, '0')}</span></header>
    <div className="brand-slide-copy">
      {!first && !last && <span className="brand-slide-rule" aria-hidden="true"/>}
      <h3>{slide.title}</h3>
      <RichText text={slide.body} className="brand-slide-body"/>
      {points.length ? <ol className={`brand-slide-points is-${layout}`}>{points.map((x, i) => <li key={x}><b>{String(i + 1).padStart(2, '0')}</b><span>{x}</span></li>)}</ol> : null}
      {last && plan.keyword && <div className="brand-slide-keyword"><small>Comment</small><b>{plan.keyword}</b></div>}
    </div>
    <footer>{first ? <><span className="brand-slide-steps" aria-hidden="true">{plan.slides.map((_, i) => <i key={i}/>)}</span><span className="brand-slide-pill">Swipe <i aria-hidden="true">→</i></span></> : last ? <span className="brand-slide-pill">Comment {plan.keyword} <i aria-hidden="true">↓</i></span> : <span aria-hidden="true">→</span>}</footer>
  </div>;
}

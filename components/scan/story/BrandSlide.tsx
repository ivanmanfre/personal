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
    : <b className="brand-mark brand-wordmark">{plan.brand}</b>;
}

export function BrandSlide({ index }: { index: number }) {
  const plan = useStory(), slide = plan.slides[index], n = plan.slides.length;
  const p = brandPalette(plan.resource.brand);
  const first = index === 0, last = index === n - 1 && n > 1;
  const ground = first ? p.dark : last ? p.accent : p.light;
  const ink = first ? p.light : last ? p.accentInk : p.dark;
  const mark = first ? p.accentOnDark : last ? p.accentInk : p.accentOnLight;
  const role = first ? 'hook' : last ? 'close' : 'point';
  const dense = slide.body.length + (slide.points || []).join('').length > 300;
  return <div className={`brand-slide brand-slide-${role}${dense ? ' is-dense' : ''}`} style={{ background: ground, color: ink, fontFamily: brandFont(plan.resource.brand.font), '--slide-mark': mark, '--slide-pill-ink': contrastInk(mark) } as React.CSSProperties}>
    <header><BrandMark ground={ground}/><span>{String(index + 1).padStart(2, '0')} / {String(n).padStart(2, '0')}</span></header>
    <div className="brand-slide-copy">
      {!first && <span className="brand-slide-rule" aria-hidden="true"/>}
      <h3>{slide.title}</h3>
      <RichText text={slide.body} className="brand-slide-body"/>
      {slide.points?.length ? <ul className="brand-slide-points">{slide.points.map(x => <li key={x}>{x}</li>)}</ul> : null}
    </div>
    <footer>{first ? <span className="brand-slide-pill">Swipe <i aria-hidden="true">→</i></span> : last ? <span className="brand-slide-pill">Comment {plan.keyword}</span> : <span aria-hidden="true">→</span>}</footer>
  </div>;
}

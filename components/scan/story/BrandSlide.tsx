import React, { useEffect, useState } from 'react';
import { useStory } from './context';
import { RichText } from './RichText';
import { contrastInk } from './brandColors';

export const lum = (hex: string) => {
  const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
  return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
};
const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + .05) / (y + .05); };
/** The accent pulled toward white (on a dark ground) or black (on a light one) just far enough to read as small text. Fills keep the brand colour. */
export function textAccentOn(accent: string, ground: string, min = 4.5) {
  if (contrast(accent, ground) >= min) return accent;
  const target = lum(ground) < .35 ? 255 : 0, rgb = [1, 3, 5].map(i => parseInt(accent.slice(i, i + 2), 16));
  for (let t = .02; t <= 1.0001; t += .02) {
    const hex = '#' + rgb.map(v => Math.round(v + (target - v) * t).toString(16).padStart(2, '0')).join('');
    if (contrast(hex, ground) >= min) return hex;
  }
  return target ? '#ffffff' : '#000000';
}

/** The lead's palette as a dark ground, a light ground and an accent that reads on each. */
export function brandPalette(b: { surface: string; ink: string; accent: string }) {
  const [dark, light] = lum(b.surface) < lum(b.ink) ? [b.surface, b.ink] : [b.ink, b.surface];
  const accentOn = (ground: string) => contrast(b.accent, ground) >= 2.2 ? b.accent : ground === dark ? light : dark;
  return { dark, light, accent: b.accent, accentInk: contrastInk(b.accent), accentOnDark: accentOn(dark), accentOnLight: accentOn(light), textOnDark: textAccentOn(b.accent, dark), textOnLight: textAccentOn(b.accent, light) };
}
/** Any logo becomes one colour that reads on the slide ground. */
export const logoOn = (ground: string) => lum(ground) < .35 ? 'brightness(0) invert(1)' : 'brightness(0)';
export const brandFont = (font?: string) => `${font ? `'${font}', ` : ''}'Schibsted Grotesk', Arial, sans-serif`;

type LogoKind = 'pending' | 'alpha' | 'opaque';
const logoKinds = new Map<string, LogoKind>(), logoProbes = new Map<string, Promise<LogoKind>>();
/** A logo with no transparent edge is a picture with its own background; the one-colour filter would turn it into a solid box. */
function probeLogo(url: string): Promise<LogoKind> {
  // Vector logos are drawn without a background, and many sit on hosts that block pixel reads.
  if (/\.svg([?#]|$)/i.test(url)) { logoKinds.set(url, 'alpha'); return Promise.resolve('alpha'); }
  let probe = logoProbes.get(url);
  if (!probe) {
    probe = new Promise<LogoKind>(resolve => {
      const done = (k: LogoKind) => { logoKinds.set(url, k); resolve(k); };
      const timer = window.setTimeout(() => done('opaque'), 6000);
      // Read the bytes with fetch and decode from a same-origin object URL: the canvas is never tainted, and the prerender's image stub does not touch fetch.
      fetch(url, { mode: 'cors' }).then(r => r.ok ? r.blob() : Promise.reject(new Error('logo'))).then(blob => new Promise<void>((ok, fail) => {
        const local = URL.createObjectURL(blob), img = new Image();
        img.onload = () => {
          try {
            const w = Math.min(img.naturalWidth, 120), h = Math.max(1, Math.round(w * img.naturalHeight / img.naturalWidth)), c = document.createElement('canvas');
            c.width = w; c.height = h;
            const ctx = c.getContext('2d', { willReadFrequently: true })!;
            ctx.drawImage(img, 0, 0, w, h);
            const edge = [...Array.from({ length: w }, (_, x) => [x, 0]), ...Array.from({ length: w }, (_, x) => [x, h - 1]), ...Array.from({ length: h }, (_, y) => [0, y]), ...Array.from({ length: h }, (_, y) => [w - 1, y])];
            done(edge.every(([x, y]) => ctx.getImageData(x, y, 1, 1).data[3] >= 250) ? 'opaque' : 'alpha');
            ok();
          } catch (e) { fail(e); } finally { URL.revokeObjectURL(local); }
        };
        img.onerror = () => { URL.revokeObjectURL(local); fail(new Error('logo')); };
        img.src = local;
      })).catch(() => done('opaque')).finally(() => window.clearTimeout(timer));
    });
    logoProbes.set(url, probe);
  }
  return probe;
}
/** The prerendered page already carries the answer: read it so the first client render does not flash. */
const knownLogoKind = (url: string): LogoKind => {
  const cached = logoKinds.get(url);
  if (cached) return cached;
  const baked = typeof document === 'undefined' ? null : [...document.querySelectorAll<HTMLImageElement>('img.brand-mark[data-logo]')].find(i => i.getAttribute('src') === url)?.getAttribute('data-logo');
  return baked === 'alpha' || baked === 'opaque' ? baked : 'pending';
};

export function BrandMark({ ground, height = 26 }: { ground: string; height?: number }) {
  const plan = useStory(), b = plan.resource.brand;
  const [failed, setFailed] = useState(false);
  const [kind, setKind] = useState<LogoKind>(() => b.logo ? knownLogoKind(b.logo) : 'pending');
  useEffect(() => {
    if (!b.logo || kind !== 'pending') return;
    let live = true;
    probeLogo(b.logo).then(k => { if (live) setKind(k); });
    return () => { live = false; };
  }, [b.logo, kind]);
  return b.logo && !failed
    ? <img className="brand-mark" data-logo={kind} src={b.logo} alt={plan.brand} style={{ height, filter: kind === 'alpha' ? logoOn(ground) : undefined }} onError={() => setFailed(true)}/>
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

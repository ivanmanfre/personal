import React, { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { useStory } from './context';
import { BrandMark, brandFont, brandPalette } from './BrandSlide';
import { buildAssessmentEmbedUrl } from '../../../lib/assessmentEmbed';

/** Assessment-mode lead magnet: the live interactive assessment, in the lead's brand. */
export function AssessmentResource() {
  const plan = useStory(), r = plan.resource, p = brandPalette(r.brand), o = r.options[0];
  const [loaded, setLoaded] = useState(false);
  const ref = o.assessment;
  const src = ref ? buildAssessmentEmbedUrl(
    { slug: ref.slug, brand: { accent_hex: r.brand.accent, font_heading: r.brand.font, font_body: r.brand.font, surface_hex: r.brand.surface, ink_hex: r.brand.ink } as any },
    { src: 'scan_story', prospectId: plan.slug, bname: plan.brand, blogo: r.brand.logo },
  ) : null;
  return <article className="brand-resource assessment-resource" aria-label="Lead magnet sample" style={{ '--res-dark': p.dark, '--res-light': p.light, '--res-accent': p.accent, '--res-accent-ink': p.accentInk, '--res-mark': p.accentOnLight, '--res-font': brandFont(r.brand.font) } as React.CSSProperties}>
    <header className="brand-resource-bar"><BrandMark ground={p.dark} height={24}/><span>{plan.magnet}</span>
      {src && <a className="assessment-open" href={src} target="_blank" rel="noopener noreferrer">Open full screen <ArrowUpRight size={15}/></a>}</header>
    {src
      ? <div className="assessment-frame">{!loaded && <p className="assessment-loading">Loading the assessment…</p>}
          <iframe src={src} title={o.title} loading="lazy" onLoad={() => setLoaded(true)} sandbox="allow-scripts allow-forms allow-popups allow-same-origin"/></div>
      : <div className="brand-resource-doc"><p className="brand-resource-kicker">{o.title}</p><p>{o.premise}</p></div>}
  </article>;
}

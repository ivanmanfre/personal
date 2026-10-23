import React, { useEffect, useRef, useState } from 'react';
import type { DtcCommercialEvidence } from '../../lib/scanTypes';
import { Evidence, RiseCallClose, displayBrandName, useRiseStoryMotion } from './DtcStoryShared';

type Mark = { x: number; y: number; w: number; h: number };
type Capture = { url: string; source_url: string; captured_at: string; kind?: 'ad' | 'page'; quote?: string; mark?: Mark };
type Section = { test_index: number; headline: string; body: string; action: string; lane: 'paid' | 'store'; proposal_type?: 'paid_creative'; capture?: Capture; captures?: Capture[]; ad?: { url: string; quote: string; destinations: string[]; observed_at?: string } };
export interface DtcStandardPresentation {
  version: 'rise-standard-2026-10-14'; domain: string; requested_domain?: string; headline: string; intro: string;
  review: { approved: boolean; checked_at?: string };
  hero_capture?: Capture | null; sections: Section[];
}
const safe = (url?: string) => { try { const u = new URL(url!); return /^https?:$/.test(u.protocol) && !u.username && !u.password; } catch { return false; } };
const dated = (date?: string) => !!date && Number.isFinite(Date.parse(date));
const date = (value?: string) => dated(value) ? new Date(value!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '';
const host = (url: string) => new URL(url).hostname.replace(/^www\./, '');
const samePage = (a: string, b: string) => { const x = new URL(a), y = new URL(b); return host(a) === host(b) && x.pathname.replace(/\/$/, '') === y.pathname.replace(/\/$/, '') && x.search === y.search; };

export function canShowStandardStory(data: DtcCommercialEvidence) {
  const s = data.presentation as DtcStandardPresentation;
  if (data.status !== 'present' || s?.version !== 'rise-standard-2026-10-14' || s.review?.approved !== true || !dated(s.review.checked_at) || typeof s.domain !== 'string' || !s.domain || (s.requested_domain != null && typeof s.requested_domain !== 'string') || typeof s.headline !== 'string' || !s.headline || typeof s.intro !== 'string' || !s.intro || !Array.isArray(s.sections) || !s.sections.length || !s.sections.every(x => x && Number.isInteger(x.test_index) && x.test_index >= 0)) return false;
  const markValid = (m?: Mark) => !!m && [m.x, m.y, m.w, m.h].every(n => typeof n === 'number' && n >= 0 && n <= 1) && m.w > 0 && m.h > 0 && m.x + m.w <= 1.001 && m.y + m.h <= 1.001;
  const captureValid = (c: Capture) => safe(c.url) && safe(c.source_url) && dated(c.captured_at) && host(c.source_url) === s.domain.replace(/^www\./, '');
  if (s.hero_capture && !captureValid(s.hero_capture)) return false;
  if (s.sections.length !== data.tests?.length || new Set(s.sections.map(x => x.test_index)).size !== s.sections.length) return false;
  return s.sections.every(x => {
    const t = data.tests[x.test_index];
    if (!t || !['title', 'observation', 'test', 'measure'].every(k => typeof t[k as keyof typeof t] === 'string' && t[k as keyof typeof t]) || x.headline !== t.title || x.body !== t.observation || x.action !== t.test || !Array.isArray(t.evidence) || !t.evidence.length || !t.evidence.every(e => e && typeof e.quote === 'string' && e.quote && safe(e.source_url)) || !t.evidence.some(e => e.kind === 'store' && host(e.source_url) === s.domain.replace(/^www\./, ''))) return false;
    const paid = t.evidence.some(e => e.kind === 'ad');
    if (x.lane !== (paid ? 'paid' : 'store')) return false;
    if (x.proposal_type !== t.proposal_type || (x.proposal_type && (paid || x.proposal_type !== 'paid_creative'))) return false;
    if (x.ad && (!Array.isArray(x.ad.destinations) || !x.ad.destinations.every(safe))) return false;
    if (x.captures != null && (!Array.isArray(x.captures) || !x.captures.every(c => c && safe(c.url) && dated(c.captured_at) && (c.kind === 'ad'
      ? t.evidence.some(e => e.kind === 'ad' && e.source_url === c.source_url && (c.quote == null || e.quote === c.quote)) && safe(c.source_url)
      : c.kind === 'page' && captureValid(c) && typeof c.quote === 'string' && t.evidence.some(e => e.kind === 'store' && e.quote === c.quote && samePage(e.source_url, c.source_url)) && markValid(c.mark))))) return false;
    if (x.capture && (!captureValid(x.capture) || !(t.evidence.some(e => samePage(e.source_url, x.capture!.source_url)) || x.ad?.destinations?.some(u => safe(u) && samePage(u, x.capture!.source_url))))) return false;
    if (x.ad && (!safe(x.ad.url) || !t.evidence.some(e => e.kind === 'ad' && e.source_url === x.ad!.url && e.quote === x.ad!.quote) || !data.journeys?.some(j => j.ad_url === x.ad!.url && JSON.stringify(j.destinations) === JSON.stringify(x.ad!.destinations)))) return false;
    return true;
  }) && !s.sections.some((x, i) => x.lane === 'paid' && s.sections.slice(0, i).some(y => y.lane === 'store'));
}

function AdEvidence({ ads }: { ads: any }) {
  return <section id="public-ads" className="ris-shell ris-public-ads"><p className="ris-label">Public ad records</p><div className="ris-ad-stats">{[['meta', 'Active Meta ads', 'active_ad_count'], ['google', 'Google creatives in the public records', 'ads_found']].map(([key, label, count]) => {
    const block = ads?.[key], value = block?.data?.[count];
    const confirmed = block?.status === 'present' || (block?.status === 'empty' && (key === 'google' || block.page_confirmed === true) && value === 0);
    return <div key={key}>{confirmed && Number.isInteger(value) && value >= 0 && dated(block.fetched_at) && safe(block.source_url) ? <><strong>{block.data.capped ? <small>At least </small> : null}{value}</strong><span>{label}</span><small>Checked {date(block.fetched_at)} · <a href={block.source_url} target="_blank" rel="noopener noreferrer">Source ↗</a></small></> : <><span>{key === 'meta' ? 'Meta' : 'Google'}</span><small>Ad activity could not be verified in this review.</small></>}</div>;
  })}<p>Public ad records do not show spend or sales.</p></div></section>;
}

function CaptureImage({ capture, alt, hero = false }: { capture: Capture; alt: string; hero?: boolean }) {
  const [failed, setFailed] = useState(false);
  return failed ? <span className="ris-capture-fallback">The screenshot is unavailable. Open the reviewed source page ↗</span> : <img src={capture.url} alt={alt} loading={hero ? 'eager' : 'lazy'} fetchPriority={hero ? 'high' : 'auto'} onError={() => setFailed(true)} />;
}

const MarkBox = ({ mark }: { mark?: Mark }) => mark ? <span className="ris-mark" aria-hidden="true" style={{ left: `${mark.x * 100}%`, top: `${mark.y * 100}%`, width: `${mark.w * 100}%`, height: `${mark.h * 100}%` }} /> : null;

// Full-size view: zoom steps, drag or scroll to pan, Escape or the close button to leave.
function ZoomView({ capture, alt, onClose }: { capture: Capture; alt: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null), pane = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1), [ratio, setRatio] = useState(4 / 3);
  const drag = useRef<{ x: number; y: number; left: number; top: number; moved: boolean } | null>(null);
  const focus = useRef<{ fx: number; fy: number } | null>(null);
  useEffect(() => { const d = dialog.current; if (d && !d.open) d.showModal?.(); }, []);
  useEffect(() => { const p = pane.current, f = focus.current; if (!p || !f) return; p.scrollLeft = f.fx * p.scrollWidth - p.clientWidth / 2; p.scrollTop = f.fy * p.scrollHeight - p.clientHeight / 2; focus.current = null; }, [scale]);
  const m = capture.mark, zoomTo = (next: number, fx = m ? m.x + m.w / 2 : .5, fy = m ? m.y + m.h / 2 : .5) => { focus.current = { fx, fy }; setScale(Math.min(4, Math.max(1, next))); };
  return <dialog ref={dialog} className="ris-zoom" aria-label={`Zoomed view: ${alt}`} onClose={onClose}>
    <div className="ris-zoom-bar"><span>{capture.quote ? <>Marked: “{capture.quote}”</> : capture.kind === 'ad' ? 'Your public ad' : 'Reviewed page'}</span><div>
      <button type="button" onClick={() => zoomTo(scale - 1)} disabled={scale <= 1} aria-label="Zoom out">−</button><output aria-live="polite">{scale * 100}%</output>
      <button type="button" onClick={() => zoomTo(scale + 1)} disabled={scale >= 4} aria-label="Zoom in">+</button>
      <a href={capture.source_url} target="_blank" rel="noopener noreferrer">{capture.kind === 'ad' ? 'View the ad ↗' : 'Open page ↗'}</a>
      <button type="button" className="ris-zoom-close" onClick={() => { dialog.current?.close?.(); onClose(); }} aria-label="Close zoomed view">×</button></div></div>
    <div ref={pane} className="ris-zoom-pane" data-scale={scale}
      onPointerDown={e => { const p = pane.current!; drag.current = { x: e.clientX, y: e.clientY, left: p.scrollLeft, top: p.scrollTop, moved: false }; }}
      onPointerMove={e => { const d = drag.current, p = pane.current; if (!d || !p || !(e.buttons & 1)) return; const dx = e.clientX - d.x, dy = e.clientY - d.y; if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true; p.scrollLeft = d.left - dx; p.scrollTop = d.top - dy; }}
      onPointerUp={() => { setTimeout(() => { drag.current = null; }, 0); }}>
      <div className="ris-zoom-frame" style={{ width: `calc(min(100%, (100dvh - 140px) * ${ratio}) * ${scale})` }} onClick={e => { if (drag.current?.moved) return; const r = e.currentTarget.getBoundingClientRect(); zoomTo(scale >= 4 ? 1 : scale + 1, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); }}>
        <img src={capture.url} alt={alt} draggable={false} onLoad={e => { const i = e.currentTarget; if (i.naturalWidth && i.naturalHeight) setRatio(i.naturalWidth / i.naturalHeight); }} /><MarkBox mark={capture.mark} />
      </div>
    </div>
  </dialog>;
}

function EvidenceShot({ capture, alt, hero = false }: { capture: Capture; alt: string; hero?: boolean }) {
  const [open, setOpen] = useState(false);
  const ad = capture.kind === 'ad';
  return <figure className={`ris-standard-capture ${capture.mark || ad ? 'ris-evidence-shot' : ''} ${ad ? 'ris-ad-shot' : ''}`} data-reveal>
    <button type="button" className="ris-zoom-open" onClick={() => setOpen(true)} aria-label={`Enlarge: ${alt}`}><CaptureImage capture={capture} alt={alt} hero={hero} /><MarkBox mark={capture.mark} /><span className="ris-zoom-hint" aria-hidden="true">Zoom ⤢</span></button>
    <figcaption>{ad ? <>{capture.quote ? <>Ad text: “{capture.quote}” · </> : 'Your public ad · '}Seen {date(capture.captured_at)} · <a href={capture.source_url} target="_blank" rel="noopener noreferrer">View&nbsp;the&nbsp;ad&nbsp;↗</a></> : <>{capture.quote ? <>Marked: “{capture.quote}” · </> : null}Page captured {date(capture.captured_at)} · <a href={capture.source_url} target="_blank" rel="noopener noreferrer">Open page ↗</a></>}</figcaption>
    {open ? <ZoomView capture={capture} alt={alt} onClose={() => setOpen(false)} /> : null}
  </figure>;
}

export function DtcGrowthStory({ companyName, domain, data, ads, bookingUrl, logo, cases = [] }: { companyName: string; domain: string; data: DtcCommercialEvidence; ads: any; bookingUrl: string; logo: string; cases?: { name: string; url: string; headline?: string; image?: string }[] }) {
  const s = data.presentation as DtcStandardPresentation;
  const { root, wrapper, content, navigate } = useRiseStoryMotion();
  const primary = s.sections.slice(0, 4), secondary = s.sections.slice(4);
  const brandName = displayBrandName(companyName);
  const finding = (section: Section, i: number) => {
    const captures = section.captures?.length ? section.captures : section.capture ? [section.capture] : [];
    const ads = captures.filter(c => c.kind === 'ad');
    const pages = captures.filter(c => c.kind !== 'ad');
    const primaryEvidence = ads.length ? ads : pages.length === 1 ? pages : [];
    const gallery = ads.length || pages.length > 1 ? pages : [];
    const action = <div className="ris-takeaway" data-reveal><span>One change</span><p>{section.action}</p></div>;
    const shot = (c: Capture) => <EvidenceShot key={c.url} capture={c} alt={c.kind === 'ad' ? `Public ad for ${section.headline}` : c.quote ? `“${c.quote}” on the source page for ${section.headline}` : `Source page for ${section.headline}`} />;
    return <section id={`finding-${section.test_index}`} key={section.test_index} className={`ris-standard-finding ${i % 2 ? 'ris-pair-section' : ''}`}>
      <div className="ris-shell ris-section">
        <p className="ris-label">{String(i + 1).padStart(2, '0')} / {section.proposal_type === 'paid_creative' ? 'Proposed paid test' : section.lane === 'paid' ? 'Paid ads' : 'Your store'}</p>
        <div className="ris-standard-grid">
          <div data-reveal>
            <h2>{section.headline}</h2>
            <div className="ris-observation">{section.body.split(/\n\s*\n/).map((paragraph, index) => <p className="ris-body" key={index}>{paragraph}</p>)}</div>
            {!ads.length ? action : null}
          </div>
          {primaryEvidence.length ? <div className="ris-evidence-shots">{primaryEvidence.map(shot)}</div> : null}
        </div>
        {ads.length ? action : null}
        {gallery.length ? <div className="ris-page-gallery"><p className="ris-label">Pages cited in this finding</p><div className="ris-evidence-shots">{gallery.map(shot)}</div></div> : null}
        <Evidence test={data.tests[section.test_index]} verbatim fullPlan />
      </div>
    </section>;
  };
  return <div className="ris-story ris-standard" ref={root} onClick={navigate} data-rise-story={s.version}>
    <nav className="ris-nav" aria-label="Report navigation"><a href="https://risedtc.com" className="ris-logo"><img src={logo} alt="RISE DTC" /></a><div><a href="#public-ads">Paid ads</a>{s.sections.some(x => x.lane === 'store' && !x.proposal_type) ? <a href={`#finding-${s.sections.find(x => x.lane === 'store' && !x.proposal_type)!.test_index}`}>Your store</a> : null}</div><a className="ris-nav-cta" href="#rise-conversation">Let’s talk ↗</a></nav>
    <div ref={wrapper} className="ris-smooth-wrapper"><div ref={content} className="ris-smooth-content"><header className="ris-hero"><div className="ris-shell ris-hero-grid"><div><p className="ris-label" data-reveal>Growth review · {s.sections.length} {s.sections.length === 1 ? 'finding' : 'findings'}</p><h1 data-reveal>{brandName || 'Your growth review'}</h1><p className="ris-lead" data-reveal>{s.intro}</p><a className="ris-explore" href={`#finding-${primary[0].test_index}`} data-reveal>Explore the findings <span>↓</span></a></div>{s.hero_capture ? <figure className="ris-standard-capture" data-reveal><a href={s.hero_capture.source_url} target="_blank" rel="noopener noreferrer"><CaptureImage capture={s.hero_capture} alt={`${brandName || 'Reviewed store'} homepage`} hero /></a><figcaption>Your store · Captured {date(s.hero_capture.captured_at)}</figcaption></figure> : null}</div><div className={`ris-shell ris-chapters ${primary.length === 1 ? 'ris-one-chapter' : ''}`}>{primary.map((x, i) => <a key={x.test_index} href={`#finding-${x.test_index}`}><b>{String(i + 1).padStart(2, '0')}</b><span><small>{x.proposal_type === 'paid_creative' ? 'Proposed paid test' : x.lane === 'paid' ? 'Paid ads' : 'Your store'}</small><strong>{x.headline}</strong></span></a>)}</div></header>
      <main><AdEvidence ads={ads} />{primary.map(finding)}<RiseCallClose companyName={companyName} bookingUrl={bookingUrl} cases={cases} />{secondary.length ? <details id="other-store-ideas" className="ris-secondary"><summary className="ris-shell"><div><strong>Other store ideas</strong><p>{secondary.length} additional {secondary.length === 1 ? 'finding' : 'findings'} from this review.</p></div><span aria-hidden="true">+</span></summary><div>{secondary.map((x, i) => finding(x, i + primary.length))}</div></details> : null}</main>
      <footer className="ris-shell ris-footer"><a href={`https://${domain}`} target="_blank" rel="noopener noreferrer">{brandName ? `Prepared for ${brandName}` : 'Reviewed store'} ↗</a><details><summary>About this review</summary><p>A dated review of store pages and available public ad records. These are proposed changes. Actual sales, acquisition costs and profit need store and ad-account data.</p></details></footer>
    </div></div>
  </div>;
}

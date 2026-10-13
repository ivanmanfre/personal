import React, { useState } from 'react';
import type { DtcCommercialEvidence } from '../../lib/scanTypes';
import { Evidence, RiseCallClose, useRiseStoryMotion } from './DtcStoryShared';

type Capture = { url: string; source_url: string; captured_at: string };
type Section = { test_index: number; headline: string; body: string; action: string; lane: 'paid' | 'store'; capture?: Capture; ad?: { url: string; quote: string; destinations: string[]; observed_at?: string } };
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
  const captureValid = (c: Capture) => safe(c.url) && safe(c.source_url) && dated(c.captured_at) && host(c.source_url) === s.domain.replace(/^www\./, '');
  if (s.hero_capture && !captureValid(s.hero_capture)) return false;
  if (s.sections.length !== data.tests?.length || new Set(s.sections.map(x => x.test_index)).size !== s.sections.length) return false;
  return s.sections.every(x => {
    const t = data.tests[x.test_index];
    if (!t || !['title', 'observation', 'test', 'measure'].every(k => typeof t[k as keyof typeof t] === 'string' && t[k as keyof typeof t]) || x.headline !== t.title || x.body !== t.observation || x.action !== t.test || !Array.isArray(t.evidence) || !t.evidence.length || !t.evidence.every(e => e && typeof e.quote === 'string' && e.quote && safe(e.source_url)) || !t.evidence.some(e => e.kind === 'store' && host(e.source_url) === s.domain.replace(/^www\./, ''))) return false;
    const paid = t.evidence.some(e => e.kind === 'ad');
    if (x.lane !== (paid ? 'paid' : 'store')) return false;
    if (x.ad && (!Array.isArray(x.ad.destinations) || !x.ad.destinations.every(safe))) return false;
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

export function DtcGrowthStory({ companyName, domain, data, ads, bookingUrl, logo, cases = [] }: { companyName: string; domain: string; data: DtcCommercialEvidence; ads: any; bookingUrl: string; logo: string; cases?: { name: string; url: string; headline?: string; image?: string }[] }) {
  const s = data.presentation as DtcStandardPresentation;
  const { root, wrapper, content, navigate } = useRiseStoryMotion();
  const primary = s.sections.slice(0, 2), secondary = s.sections.slice(2);
  const finding = (section: Section, i: number) => <section id={`finding-${section.test_index}`} key={section.test_index} className={`ris-standard-finding ${i % 2 ? 'ris-pair-section' : ''}`}><div className="ris-shell ris-section"><p className="ris-label">{String(i + 1).padStart(2, '0')} / {section.lane === 'paid' ? 'Paid ads' : 'Your store'}</p><div className="ris-standard-grid"><div data-reveal><h2>{section.headline}</h2><p className="ris-body">{section.body}</p>{section.ad ? <aside className="ris-standard-quote"><p className="ris-label">From your public ad</p><blockquote>“{section.ad.quote}”</blockquote><a href={section.ad.url} target="_blank" rel="noopener noreferrer">View the actual ad ↗</a></aside> : null}</div>{section.capture ? <figure className="ris-standard-capture" data-reveal><a href={section.capture.source_url} target="_blank" rel="noopener noreferrer"><CaptureImage capture={section.capture} alt={`Source page for ${section.headline}`} /></a><figcaption>Page captured {date(section.capture.captured_at)} · <a href={section.capture.source_url} target="_blank" rel="noopener noreferrer">Open page ↗</a></figcaption></figure> : null}</div><div className="ris-takeaway" data-reveal><span>One change</span><strong>{section.action}</strong></div><Evidence test={data.tests[section.test_index]} verbatim /></div></section>;
  return <div className="ris-story ris-standard" ref={root} onClick={navigate} data-rise-story={s.version}>
    <nav className="ris-nav" aria-label="Report navigation"><a href="https://risedtc.com" className="ris-logo"><img src={logo} alt="RISE DTC" /></a><div><a href="#public-ads">Paid ads</a>{s.sections.some(x => x.lane === 'store') ? <a href={`#finding-${s.sections.find(x => x.lane === 'store')!.test_index}`}>Your store</a> : null}</div><a className="ris-nav-cta" href="#rise-conversation">Let’s talk ↗</a></nav>
    <div ref={wrapper} className="ris-smooth-wrapper"><div ref={content} className="ris-smooth-content"><header className="ris-hero"><div className="ris-shell ris-hero-grid"><div><p className="ris-label" data-reveal>{companyName} · Growth review</p><h1 data-reveal>{s.headline}</h1><p className="ris-lead" data-reveal>{s.intro}</p><a className="ris-explore" href={`#finding-${primary[0].test_index}`} data-reveal>Explore the findings <span>↓</span></a></div>{s.hero_capture ? <figure className="ris-standard-capture" data-reveal><a href={s.hero_capture.source_url} target="_blank" rel="noopener noreferrer"><CaptureImage capture={s.hero_capture} alt={`${companyName} homepage`} hero /></a><figcaption>Your store · Captured {date(s.hero_capture.captured_at)}</figcaption></figure> : null}</div><div className="ris-shell ris-chapters">{primary.map((x, i) => <a key={x.test_index} href={`#finding-${x.test_index}`}><b>{String(i + 1).padStart(2, '0')}</b>{x.lane === 'paid' ? 'Ad opportunity' : 'Store opportunity'}</a>)}</div></header>
      <main><AdEvidence ads={ads} />{primary.map(finding)}<RiseCallClose companyName={companyName} bookingUrl={bookingUrl} cases={cases} />{secondary.length ? <details id="other-store-ideas" className="ris-secondary"><summary className="ris-shell"><div><strong>Other store ideas</strong><p>{secondary.length} additional {secondary.length === 1 ? 'finding' : 'findings'} from this review.</p></div><span aria-hidden="true">+</span></summary><div>{secondary.map((x, i) => finding(x, i + 2))}</div></details> : null}</main>
      <footer className="ris-shell ris-footer"><a href={`https://${domain}`} target="_blank" rel="noopener noreferrer">Prepared for {companyName} ↗</a><details><summary>About this review</summary><p>A dated review of store pages and available public ad records. These are proposed changes. Actual sales, acquisition costs and profit need store and ad-account data.</p></details></footer>
    </div></div>
  </div>;
}

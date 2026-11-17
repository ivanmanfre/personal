import React, { useEffect, useRef, useState } from 'react';
import type { DtcCommercialEvidence } from '../../lib/scanTypes';
import { RiseCallClose, displayBrandName, useRiseStoryMotion } from './DtcStoryShared';
import { canShowStandardStory } from './DtcGrowthStory';

// RISE growth scan, standard 2026-11-17: the first screen shows the brand's strongest observed gap with its own
// ad or page beside it. Pages built in the 2026-10-14 standard keep DtcGrowthStory, untouched.
export const V2_VERSION = 'rise-standard-2026-11-17';

type Mark = { x: number; y: number; w: number; h: number };
type Capture = { url: string; source_url: string; captured_at: string; kind?: 'ad' | 'page'; quote?: string; mark?: Mark; crop_url?: string; crop_mark?: Mark };
type Draft = { product_url: string; hook: string; body: string; proof_quote: string; proof_source_url: string };
type Section = {
  test_index: number; headline: string; test_title: string; body: string; action: string; lane: 'paid' | 'store';
  proposal_type?: 'paid_creative'; kind?: 'ad_vs_page'; focus_note?: string; demoted?: true; drafts?: Draft[];
  capture?: Capture; captures?: Capture[]; ad?: { url: string; quote: string; destinations: string[]; observed_at?: string };
};
type StripItem = { ad_url: string; image_url: string | null; start_date: string | null; opening: string | null; destination: string | null; destination_kind: 'product' | 'collection' | 'home' | 'other_page' | 'other_site' | 'none'; destination_title?: string };
export interface DtcStandardPresentationV2 {
  version: typeof V2_VERSION; domain: string; requested_domain?: string; headline: string; intro: string;
  review: { approved: boolean; checked_at?: string };
  first_screen: { case: 'advertiser' | 'zero_ads' | 'ads_unknown'; lead_test_index: number; ads_line: string | null; ads_note?: string };
  dm_quote?: { quote: string; said_on?: string };
  ads_strip?: { read: number; active: number | null; capped: boolean; observed_at?: string; source_url?: string | null; summary: string | null; items: StripItem[] };
  rival?: { advertiser: string; ad_url: string; image_url: string; opening_text: string; start_date: string; observed_at?: string };
  proof?: { vertical: string | null };
  sections: Section[];
}
type Test = DtcCommercialEvidence['tests'][number] & { gap?: string; finding_type?: 'ad_vs_page'; absent_terms?: string[]; ad_drafts?: Draft[]; demoted?: boolean };

const safe = (url?: string | null) => { try { const u = new URL(url!); return /^https?:$/.test(u.protocol) && !u.username && !u.password; } catch { return false; } };
const dated = (value?: string | null) => !!value && Number.isFinite(Date.parse(value));
const day = (value?: string | null) => dated(value) ? new Date(value!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '';
const hostOf = (url: string) => new URL(url).hostname.replace(/^www\./, '');
const markValid = (m?: Mark) => !!m && [m.x, m.y, m.w, m.h].every(n => typeof n === 'number' && n >= 0 && n <= 1) && m.w > 0 && m.h > 0 && m.x + m.w <= 1.001 && m.y + m.h <= 1.001;
const KINDS = ['product', 'collection', 'home', 'other_page', 'other_site', 'none'];

// Mirror of claude-code-railway dtc_story_v2.renders, clause for clause. The shared 10-14 rule runs on a view
// of the story whose headlines are the test titles; every 11-17 field is then checked here. Unsure means false.
export function canShowStandardStoryV2(data: DtcCommercialEvidence): boolean {
  try {
    const s = data?.presentation as unknown as DtcStandardPresentationV2;
    if (!s || s.version !== V2_VERSION || !Array.isArray(s.sections) || !s.sections.length || !Array.isArray(data.tests)) return false;
    const tests = data.tests as Test[];
    if (!s.sections.every(x => x && Number.isInteger(x.test_index) && x.test_index >= 0 && x.test_index < tests.length && tests[x.test_index])) return false;
    const head = (t: Test) => t.gap || t.title;
    if (!s.sections.every(x => x.headline === head(tests[x.test_index]))) return false;
    if (typeof s.headline !== 'string' || !s.headline) return false;
    const view = { ...data, presentation: { ...s, version: 'rise-standard-2026-10-14', hero_capture: undefined,
      sections: s.sections.map(x => ({ ...x, headline: tests[x.test_index].title })) } } as unknown as DtcCommercialEvidence;
    if (!canShowStandardStory(view)) return false;
    const own = s.domain.replace(/^www\./, '');
    for (const x of s.sections) {
      const t = tests[x.test_index];
      if (x.test_title !== t.title) return false;
      if ((x.kind == null) !== (t.finding_type == null) || (x.kind != null && (x.kind !== t.finding_type || x.kind !== 'ad_vs_page'))) return false;
      if (x.kind === 'ad_vs_page' && x.lane !== 'paid') return false;
      if (x.drafts != null) {
        if (x.proposal_type !== 'paid_creative' || !Array.isArray(x.drafts) || !x.drafts.length || x.drafts.length > 3 || JSON.stringify(x.drafts) !== JSON.stringify(t.ad_drafts)) return false;
        if (!x.drafts.every(d => d && safe(d.product_url) && hostOf(d.product_url) === own && ['hook', 'body', 'proof_quote'].every(k => typeof d[k as keyof Draft] === 'string' && (d[k as keyof Draft] as string).trim()) && safe(d.proof_source_url))) return false;
      }
      if (x.focus_note != null && !(typeof x.focus_note === 'string' && x.focus_note.trim())) return false;
      if (x.demoted != null && x.demoted !== true) return false;
      for (const c of x.captures || []) {
        if (c.crop_url != null && !(safe(c.crop_url) && markValid(c.crop_mark))) return false;
        if (c.crop_url == null && c.crop_mark != null) return false;
      }
    }
    const fs = s.first_screen;
    if (!fs || !['advertiser', 'zero_ads', 'ads_unknown'].includes(fs.case) || fs.lead_test_index !== s.sections[0].test_index) return false;
    if (fs.ads_line != null && typeof fs.ads_line !== 'string') return false;
    const strip = s.ads_strip;
    if (strip != null && (!Array.isArray(strip.items) || !Number.isInteger(strip.read) || !strip.items.every(i => i && safe(i.ad_url) && (i.image_url == null || safe(i.image_url)) && (i.destination == null || safe(i.destination)) && KINDS.includes(i.destination_kind)))) return false;
    const r = s.rival;
    if (r != null && !(safe(r.ad_url) && safe(r.image_url) && typeof r.opening_text === 'string' && r.opening_text.trim() && /^\d{4}-\d{2}-\d{2}$/.test(r.start_date || '') && dated(r.start_date))) return false;
    if (s.dm_quote != null && !(typeof s.dm_quote.quote === 'string' && s.dm_quote.quote.trim())) return false;
    return true;
  } catch { return false; }
}

const destinationLabel = (i: StripItem) => i.destination_kind === 'product' ? (i.destination_title || 'Product page')
  : i.destination_kind === 'collection' ? 'Collection page' : i.destination_kind === 'home' ? 'Homepage'
  : i.destination_kind === 'none' ? 'No link' : 'Another site';

function Zoom({ capture, alt, onClose }: { capture: Capture; alt: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = dialog.current; if (d && !d.open) d.showModal?.(); }, []);
  return <dialog ref={dialog} className="ris-zoom" aria-label={`Full image: ${alt}`} onClose={onClose}>
    <div className="ris-zoom-bar"><span>{capture.quote ? <>Marked: “{capture.quote}”</> : capture.kind === 'ad' ? 'Your public ad' : 'Reviewed page'}</span><div>
      <a href={capture.source_url} target="_blank" rel="noopener noreferrer">{capture.kind === 'ad' ? 'View the ad ↗' : 'Open page ↗'}</a>
      <button type="button" className="ris-zoom-close" onClick={() => { dialog.current?.close?.(); onClose(); }} aria-label="Close full image">×</button></div></div>
    <div className="ris-zoom-pane"><div className="ris-zoom-frame" style={{ width: '100%' }}><img src={capture.url} alt={alt} />{capture.mark ? <span className="ris-mark" aria-hidden="true" style={{ left: `${capture.mark.x * 100}%`, top: `${capture.mark.y * 100}%`, width: `${capture.mark.w * 100}%`, height: `${capture.mark.h * 100}%` }} /> : null}</div></div>
  </dialog>;
}

// Inline evidence is the crop around the quoted words when the builder made one; otherwise the full capture,
// positioned on its mark. The full image loads only when the zoom opens.
function Shot({ capture, alt, label, eager = false }: { capture: Capture; alt: string; label?: string; eager?: boolean }) {
  const [open, setOpen] = useState(false), [failed, setFailed] = useState(false);
  const crop = capture.crop_url && capture.crop_mark ? { src: capture.crop_url, mark: capture.crop_mark } : null;
  const m = crop ? crop.mark : capture.mark;
  // Without a crop the 1280 x 960 capture shows at its own pixel size (object-fit: none), its window centred on
  // the quoted words, so the text stays readable on a phone.
  const position = !crop && capture.mark && capture.kind !== 'ad'
    ? `calc(50% + ${Math.round((0.5 - (capture.mark.x + capture.mark.w / 2)) * 1280)}px) calc(50% + ${Math.round((0.5 - (capture.mark.y + capture.mark.h / 2)) * 960)}px)` : undefined;
  const ad = capture.kind === 'ad';
  return <figure className={`rv2-shot ${ad ? 'rv2-shot-ad' : 'rv2-shot-page'} ${crop ? 'rv2-crop' : ''}`} data-reveal>
    {label ? <p className="rv2-shot-label">{label}</p> : null}
    <button type="button" className="ris-zoom-open rv2-shot-frame" onClick={() => setOpen(true)} aria-label={`Enlarge: ${alt}`}>
      {failed ? <span className="ris-capture-fallback">The image is unavailable. Open the source ↗</span>
        : <img src={crop ? crop.src : capture.url} alt={alt} loading={eager ? 'eager' : 'lazy'} style={position ? { objectPosition: position } : undefined} onError={() => setFailed(true)} />}
      {m && (crop || !position) ? <span className="ris-mark" aria-hidden="true" style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%`, width: `${m.w * 100}%`, height: `${m.h * 100}%` }} /> : null}
    </button>
    <figcaption>{ad ? <>Seen {day(capture.captured_at)} · <a href={capture.source_url} target="_blank" rel="noopener noreferrer">View the ad ↗</a></>
      : <>Captured {day(capture.captured_at)} · <a href={capture.source_url} target="_blank" rel="noopener noreferrer">Open page ↗</a></>}</figcaption>
    {open ? <Zoom capture={capture} alt={alt} onClose={() => setOpen(false)} /> : null}
  </figure>;
}

const capturesOf = (x: Section) => x.captures?.length ? x.captures : x.capture ? [{ ...x.capture, kind: 'page' as const }] : [];

function Drafts({ drafts, brand }: { drafts: Draft[]; brand: string }) {
  return <div className="rv2-drafts">{drafts.slice(0, 3).map(d => <article key={d.product_url} className="rv2-draft" data-reveal>
    <p className="rv2-draft-tag">Draft ad, not running</p>
    <h3>{d.hook}</h3><p>{d.body}</p>
    <blockquote>“{d.proof_quote}”<a href={d.proof_source_url} target="_blank" rel="noopener noreferrer">Source ↗</a></blockquote>
    <a className="rv2-draft-product" href={d.product_url} target="_blank" rel="noopener noreferrer">{brand ? `${brand} product page` : 'Product page'} ↗</a>
  </article>)}</div>;
}

function Finding({ x, i, test, brand }: { x: Section; i: number; test: Test; brand: string }) {
  const caps = capturesOf(x), ads = caps.filter(c => c.kind === 'ad'), pages = caps.filter(c => c.kind !== 'ad');
  const label = x.proposal_type === 'paid_creative' ? 'Proposed paid test' : x.lane === 'paid' ? 'Paid ads' : 'Your store';
  const adQuote = test.evidence.find(e => e.kind === 'ad'), pageQuote = test.evidence.find(e => e.kind === 'store');
  const pair = x.kind === 'ad_vs_page' && adQuote && pageQuote;
  return <section id={`finding-${x.test_index}`} className="ris-standard-finding rv2-finding">
    <div className="ris-shell ris-section">
      <p className="ris-label">{String(i + 1).padStart(2, '0')} / {label}</p>
      <h2 data-reveal>{x.headline}</h2>
      {x.focus_note ? <p className="rv2-focus-note" data-reveal>{x.focus_note}</p> : null}
      <div className="ris-observation" data-reveal>{x.body.split(/\n\s*\n/).map((p, k) => <p className="ris-body" key={k}>{p}</p>)}</div>
      {pair ? <div className="rv2-pair" data-reveal>
        <div><p className="rv2-pair-label">Your ad says</p><blockquote>“{adQuote!.quote}”</blockquote>{ads[0] ? <Shot capture={ads[0]} alt={`Your ad for ${brand || 'your store'}`} /> : null}</div>
        <div><p className="rv2-pair-label">Your page says</p><blockquote>“{pageQuote!.quote}”</blockquote>
          {(test.absent_terms || []).map(term => <p key={term} className="rv2-absent">We did not find “{term}” on this page.</p>)}
          {pages[0] ? <Shot capture={pages[0]} alt={`Your page for ${brand || 'your store'}`} /> : null}</div>
      </div> : caps.length ? <div className="rv2-shots">{[...ads.slice(0, 2), ...pages.slice(0, 2)].map(c => <Shot key={c.url} capture={c} alt={c.kind === 'ad' ? `Public ad cited in: ${x.headline}` : `Page cited in: ${x.headline}`} />)}</div> : null}
      {x.drafts?.length ? <Drafts drafts={x.drafts} brand={brand} /> : null}
      <details className="ris-evidence rv2-test"><summary>The test we would run <span aria-hidden="true">+</span></summary><div>
        <p><strong>{x.test_title}</strong></p><p>{x.action}</p><p><strong>What to measure</strong><br />{test.measure}</p>
        {test.evidence.map((e, k) => <blockquote key={k}><p>“{e.quote}”</p><a href={e.source_url} target="_blank" rel="noopener noreferrer">{e.kind === 'ad' ? 'View the public ad' : 'Open source page'} ↗</a></blockquote>)}
      </div></details>
    </div>
  </section>;
}

function AdsStrip({ strip, google }: { strip: NonNullable<DtcStandardPresentationV2['ads_strip']>; google: any }) {
  const gd = google?.data, gOk = google?.status === 'present' && Number.isInteger(gd?.ads_found) && dated(google?.fetched_at);
  return <section id="public-ads" className="rv2-strip"><div className="ris-shell ris-section">
    <p className="ris-label">Public ad records</p>
    <h2>{`The ${strip.read} ads we read`}</h2>
    <p className="ris-body">{strip.summary ? `${strip.summary} ` : ''}{strip.capped && strip.active != null ? `Meta showed ${strip.active} active ads; we read ${strip.read} of them.` : ''}</p>
    <ol className="rv2-strip-row">{strip.items.map(i => <li key={i.ad_url}><a href={i.ad_url} target="_blank" rel="noopener noreferrer">
      {i.image_url ? <img src={i.image_url} alt="" loading="lazy" /> : <span className="rv2-strip-noimg" aria-hidden="true">Ad</span>}
      <small>{i.start_date ? `Started ${day(i.start_date)}` : 'Start date not shown'}</small>
      {i.opening ? <span className="rv2-strip-open">{i.opening}</span> : null}
      <b>→ {destinationLabel(i)}</b>
    </a></li>)}</ol>
    <p className="rv2-strip-foot">{gOk ? <>{gd.capped ? 'At least ' : ''}{gd.ads_found} Google creatives in the public records, checked {day(google.fetched_at)}. </> : null}Public ad records do not show spend or sales.{dated(strip.observed_at) ? ` Read ${day(strip.observed_at)}.` : ''}</p>
  </div></section>;
}

function Rival({ rival }: { rival: NonNullable<DtcStandardPresentationV2['rival']> }) {
  return <section className="rv2-rival"><div className="ris-shell ris-section rv2-rival-grid">
    <div data-reveal><p className="ris-label">A brand selling the same kind of product</p><h2>{rival.advertiser}</h2><blockquote>“{rival.opening_text}”</blockquote>
      <p className="rv2-rival-meta">Started {day(rival.start_date)}{dated(rival.observed_at) ? ` · live on ${day(rival.observed_at)}` : ''} · <a href={rival.ad_url} target="_blank" rel="noopener noreferrer">View the ad ↗</a></p></div>
    <figure data-reveal><img src={rival.image_url} alt={`${rival.advertiser} ad`} loading="lazy" /></figure>
  </div></section>;
}

export function DtcGrowthStoryV2({ companyName, domain, data, ads, bookingUrl, logo, cases = [] }: { companyName: string; domain: string; data: DtcCommercialEvidence; ads: any; bookingUrl: string; logo: string; cases?: { name: string; url: string; headline?: string; image?: string }[]; proofVertical?: string | null }) {
  const s = data.presentation as unknown as DtcStandardPresentationV2;
  const tests = data.tests as Test[];
  const { root, wrapper, content, navigate } = useRiseStoryMotion();
  const brand = displayBrandName(companyName);
  const visible = s.sections.filter(x => !x.demoted);
  const primary = visible.slice(0, 4), secondary = [...visible.slice(4), ...s.sections.filter(x => x.demoted)];
  const lead = s.sections[0], fs = s.first_screen;
  const leadCaps = capturesOf(lead), leadAd = leadCaps.find(c => c.kind === 'ad'), leadPage = leadCaps.find(c => c.kind !== 'ad');
  const firstDraft = lead.drafts?.[0];
  let side: React.ReactNode = null;
  if (fs.case === 'advertiser' && (leadAd || leadPage)) side = <div className="rv2-hero-pair">{leadAd ? <Shot capture={leadAd} alt={`Your ad, ${brand || 'your store'}`} label="Your ad" eager /> : null}{leadPage ? <Shot capture={leadPage} alt={`Your page, ${brand || 'your store'}`} label="Your page" eager /> : null}</div>;
  else if (fs.case === 'zero_ads' && s.rival) side = <figure className="rv2-hero-rival"><img src={s.rival.image_url} alt={`${s.rival.advertiser} ad`} /><figcaption>{`${s.rival.advertiser}'s ad, started ${day(s.rival.start_date)}${dated(s.rival.observed_at) ? `, live on ${day(s.rival.observed_at)}` : ''}`} · <a href={s.rival.ad_url} target="_blank" rel="noopener noreferrer">View ↗</a></figcaption></figure>;
  else if (fs.case === 'zero_ads' && firstDraft) side = <div className="rv2-hero-draft"><Drafts drafts={[firstDraft]} brand={brand} /></div>;
  else if (leadPage) side = <div className="rv2-hero-pair">{<Shot capture={leadPage} alt={`Your page, ${brand || 'your store'}`} label="Your page" eager />}</div>;
  const rivalBelow = s.rival && !(fs.case === 'zero_ads');
  return <div className="ris-story ris-standard rv2" ref={root} onClick={navigate} data-rise-story={s.version}>
    <nav className="ris-nav" aria-label="Report navigation"><a href="https://risedtc.com" className="ris-logo"><img src={logo} alt="RISE DTC" /></a><div>{s.ads_strip ? <a href="#public-ads">Your ads</a> : null}<a href={`#finding-${lead.test_index}`}>Findings</a></div><a className="ris-nav-cta" href="#rise-conversation">Let’s talk ↗</a></nav>
    <div ref={wrapper} className="ris-smooth-wrapper"><div ref={content} className="ris-smooth-content">
      <header className="ris-hero rv2-hero"><div className="ris-shell ris-hero-grid">
        <div>
          <p className="ris-label" data-reveal>Growth review · {visible.length} {visible.length === 1 ? 'finding' : 'findings'}</p>
          <h1 data-reveal>{brand || 'Your growth review'}</h1>
          {s.dm_quote ? <p className="rv2-said" data-reveal>You said: “{s.dm_quote.quote}”</p> : null}
          <p className="rv2-lede" data-reveal>{lead.headline}</p>
          {fs.ads_line ? <p className="rv2-ads-line" data-reveal>{fs.ads_line}</p> : null}
          <p className="rv2-intro" data-reveal>{s.intro}</p>
          <a className="ris-explore" href={`#finding-${lead.test_index}`} data-reveal>Explore the findings <span>↓</span></a>
        </div>
        {side}
      </div>
      <div className={`ris-shell ris-chapters ${primary.length === 1 ? 'ris-one-chapter' : ''}`}>{primary.map((x, i) => <a key={x.test_index} href={`#finding-${x.test_index}`}><b>{String(i + 1).padStart(2, '0')}</b><span><small>{x.proposal_type === 'paid_creative' ? 'Proposed paid test' : x.lane === 'paid' ? 'Paid ads' : 'Your store'}</small><strong>{x.headline}</strong></span></a>)}</div></header>
      <main>
        {s.ads_strip && fs.case === 'advertiser' ? <AdsStrip strip={s.ads_strip} google={ads?.google} /> : null}
        {primary.map((x, i) => <Finding key={x.test_index} x={x} i={i} test={tests[x.test_index]} brand={brand} />)}
        {rivalBelow ? <Rival rival={s.rival!} /> : null}
        <RiseCallClose companyName={companyName} bookingUrl={bookingUrl} cases={cases} />
        {secondary.length ? <details id="other-store-ideas" className="ris-secondary"><summary className="ris-shell"><div><strong>Other store ideas</strong><p>{secondary.length} additional {secondary.length === 1 ? 'finding' : 'findings'} from this review.</p></div><span aria-hidden="true">+</span></summary><div>{secondary.map((x, i) => <Finding key={x.test_index} x={x} i={i + primary.length} test={tests[x.test_index]} brand={brand} />)}</div></details> : null}
      </main>
      <footer className="ris-shell ris-footer"><a href={`https://${domain}`} target="_blank" rel="noopener noreferrer">{brand ? `Prepared for ${brand}` : 'Reviewed store'} ↗</a>
        {fs.ads_note ? <p className="rv2-footnote">{fs.ads_note}</p> : null}
        <details><summary>About this review</summary><p>A dated review of store pages and available public ad records. These are proposed changes. Actual sales, acquisition costs and profit need store and ad-account data.</p></details></footer>
    </div></div>
  </div>;
}

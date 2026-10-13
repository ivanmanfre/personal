import React, { useEffect, useRef, useState } from 'react';
import type { DtcCommercialEvidence } from '../../lib/scanTypes';
import './DtcInsightStory.css';

type Product = { name: string; image: string; url: string; price: number };
type Capture = { url: string; source_url: string; captured_at: string };
type Insight = { test_index: number; headline: string; body: string };
export interface DtcStoryPresentation {
  version: string;
  review: { approved: boolean; checked_at: string };
  headline: string;
  intro: string;
  hero_product: Product;
  route: Insight & { action: string; ad_quote: string; ad_url: string; current: Capture; proposed: Capture };
  pair: Insight & { products: Product[] };
  guidance: Insight & { product: Product };
  shipping: Insight & { threshold: number; currency: string; products: Product[] };
}
const safeUrl = (value: string) => { try { return /^https?:$/.test(new URL(value).protocol); } catch { return false; } };
const day = (value?: string) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '';
const words = (value: string) => value.replace(/[—–]/g, ',');
const money = (value: number, currency: string) => `${value.toLocaleString('en-GB', { maximumFractionDigits: 2 })} ${currency}`;

// The story is an optional, reviewed presentation of existing recommendations. Older scans
// retain their renderer. A missing ad journey or incomplete section cannot become a story.
export function canShowStory(data?: DtcCommercialEvidence, meta?: any): boolean {
  const s = data?.presentation;
  if (data?.status !== 'present' || s?.version !== 'rise-story-2026-10-14' || s.review?.approved !== true || meta?.status !== 'present') return false;
  if (!s.headline || !s.intro || !s.route || !s.pair || !s.guidance || !s.shipping) return false;
  const validProduct = (p?: Product) => !!p && !!p.name && safeUrl(p.image) && safeUrl(p.url) && Number.isFinite(p.price) && p.price > 0;
  if (!validProduct(s.hero_product) || !validProduct(s.guidance.product) || s.pair.products?.length !== 2 || s.shipping.products?.length !== 2 || ![...s.pair.products, ...s.shipping.products].every(validProduct)) return false;
  if (!Number.isFinite(s.shipping.threshold) || s.shipping.threshold <= 0 || !s.shipping.currency) return false;
  const sections = [s.route, s.pair, s.guidance, s.shipping];
  if (new Set(sections.map(x => x.test_index)).size !== 4 || !sections.every(x => {
    const test = data.tests?.[x.test_index];
    return x.headline && x.body && test?.observation && test.test && test.measure && test.evidence?.length && test.evidence.every(e => e.quote && safeUrl(e.source_url));
  })) return false;
  if (![s.route.current, s.route.proposed].every(c => c && safeUrl(c.url) && safeUrl(c.source_url) && day(c.captured_at))) return false;
  return !!s.route.ad_quote && safeUrl(s.route.ad_url) && !!data.journeys?.some(j => j.ad_url === s.route.ad_url && j.destinations.includes(s.route.current.source_url));
}

function Evidence({ test }: { test: DtcCommercialEvidence['tests'][number] }) {
  return <details className="ris-evidence"><summary>Sources &amp; how to check the result <span aria-hidden="true">+</span></summary><div><p><strong>What to measure</strong><br />{words(test.measure)}</p><p>{words(test.test)}</p>{test.evidence.map((e, i) => <blockquote key={i}><p>“{words(e.quote)}”</p><a href={e.source_url} target="_blank" rel="noopener noreferrer">{e.kind === 'ad' ? 'View the public ad' : 'Open source page'} ↗</a></blockquote>)}</div></details>;
}

export function ShippingExample({ data }: { data: DtcStoryPresentation['shipping'] }) {
  const [basket, setBasket] = useState(900);
  const [added, setAdded] = useState<number[]>([]);
  const total = basket + added.reduce((sum, index) => sum + data.products[index].price, 0);
  return <div className="ris-cart-example"><div className="ris-cart-label"><strong>Example basket</strong><span>Try the numbers</span></div><label className="ris-basket-input">Starting basket <span><input aria-label={`Example basket value in ${data.currency}`} type="number" min={0} max={100000} value={basket} onChange={e => setBasket(Math.max(0, Math.min(100000, Number(e.target.value) || 0)))} /> {data.currency}</span></label><div className="ris-addons">{data.products.map((p, i) => <button key={p.url} type="button" aria-pressed={added.includes(i)} onClick={() => setAdded(old => old.includes(i) ? old.filter(x => x !== i) : [...old, i])}><img src={p.image} alt="" loading="lazy" /><span>{added.includes(i) ? 'Remove' : 'Add'} {p.name}<small>+ {money(p.price, data.currency)}</small></span><b aria-hidden="true">{added.includes(i) ? '✓' : '+'}</b></button>)}</div><div className="ris-cart-total" aria-live="polite" aria-atomic="true"><span>New basket total</span><strong>{money(total, data.currency)}</strong><p>{total > data.threshold ? 'Above the free-shipping threshold' : total === data.threshold ? `Free shipping starts above ${money(data.threshold, data.currency)}` : 'Still below free shipping'}</p></div><p className="ris-example-note">Illustration using listed prices. This is a suggested cart feature.</p></div>;
}

export function DtcInsightStory({ companyName, domain, data, ads, bookingUrl, logo, cases = [] }: {
  companyName: string; domain: string; data: DtcCommercialEvidence; ads: any;
  bookingUrl: string; logo: string; cases?: { name: string; url: string }[];
}) {
  const s = data.presentation!;
  const root = useRef<HTMLDivElement>(null), wrapper = useRef<HTMLDivElement>(null), content = useRef<HTMLDivElement>(null);
  const smoother = useRef<any>(null);
  const [destination, setDestination] = useState<'current' | 'proposed'>('current');
  const meta = ads?.meta?.status === 'present' ? ads.meta : null;
  const google = ads?.google?.status === 'present' ? ads.google : null;
  useEffect(() => {
    let cancelled = false, context: any, media: any, observer: ResizeObserver | undefined, timer: ReturnType<typeof setTimeout>;
    const node = root.current;
    if (!node || typeof window.matchMedia !== 'function' || (window as Window & { __RISE_PRERENDER__?: boolean }).__RISE_PRERENDER__) return;
    Promise.all([import('gsap'), import('gsap/ScrollTrigger'), import('gsap/ScrollSmoother')]).then(([g, t, smooth]) => {
      if (cancelled || !wrapper.current || !content.current) return;
      const gsap = g.gsap, ScrollTrigger = t.ScrollTrigger, ScrollSmoother = smooth.ScrollSmoother;
      gsap.registerPlugin(ScrollTrigger, ScrollSmoother);
      context = gsap.context(() => {
        media = gsap.matchMedia();
        media.add({ motion: '(prefers-reduced-motion: no-preference)', desktop: '(min-width: 901px)' }, (ctx: any) => {
          if (!ctx.conditions.motion) return;
          if (ctx.conditions.desktop) smoother.current = ScrollSmoother.create({ wrapper: wrapper.current!, content: content.current!, smooth: 0.65, smoothTouch: 0, effects: false });
          gsap.from(node.querySelectorAll('.ris-hero [data-reveal]'), { y: 24, opacity: 0, duration: 0.8, stagger: 0.12, ease: 'power2.out' });
          node.querySelectorAll('main [data-reveal]').forEach(el => gsap.from(el, { y: 32, opacity: 0, duration: 0.7, ease: 'power2.out', scrollTrigger: { trigger: el, start: 'top 92%', once: true } }));
          node.querySelectorAll('[data-parallax]').forEach(el => gsap.fromTo(el, { y: 22 }, { y: -22, ease: 'none', scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: 0.6 } }));
          return () => { smoother.current?.kill(); smoother.current = null; };
        });
      }, node);
      observer = new ResizeObserver(() => { clearTimeout(timer); timer = setTimeout(() => ScrollTrigger.refresh(), 120); });
      observer.observe(content.current);
      document.fonts?.ready.then(() => { if (!cancelled) ScrollTrigger.refresh(); });
      if (location.hash) { const target = document.getElementById(location.hash.slice(1)); if (target && node.contains(target)) smoother.current?.scrollTo(target, false, 'top 92px'); }
    }).catch(() => { /* Native scroll and visible content remain the fallback. */ });
    return () => { cancelled = true; clearTimeout(timer); observer?.disconnect(); media?.revert(); context?.revert(); smoother.current = null; };
  }, []);
  const navigate = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = (event.target as Element).closest('a[href^="#"]');
    const id = anchor?.getAttribute('href')?.slice(1), target = id ? document.getElementById(id) : null;
    if (!target || !root.current?.contains(target)) return;
    event.preventDefault();
    if (smoother.current) smoother.current.scrollTo(target, true, 'top 92px');
    else target.scrollIntoView({ behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    target.tabIndex = -1; target.focus({ preventScroll: true }); history.pushState(null, '', `#${id}`);
  };
  const selected = s.route[destination];
  return <div className="ris-story" ref={root} onClick={navigate} data-rise-story={s.version}>
    <nav className="ris-nav" aria-label="Report navigation"><a href="https://risedtc.com" className="ris-logo"><img src={logo} alt="RISE DTC" /></a><div><a href="#paid-media">Paid ads</a><a href="#product-pair">Your store</a></div><a className="ris-nav-cta" href="#rise-conversation">Let’s talk ↗</a></nav>
    <div ref={wrapper} className="ris-smooth-wrapper"><div ref={content} className="ris-smooth-content">
      <header className="ris-hero"><div className="ris-shell ris-hero-grid"><div><p className="ris-label" data-reveal>{companyName} · Growth review</p><h1 data-reveal>{words(s.headline).split(' to ')[0]}<br /><span>to {words(s.headline).split(' to ').slice(1).join(' to ')}</span></h1><p className="ris-lead" data-reveal>{words(s.intro)}</p><a className="ris-explore" href="#paid-media" data-reveal>Start with the ad link <span>↓</span></a></div><figure className="ris-hero-product" data-reveal><div className="ris-product-stage"><img src={s.hero_product.image} alt={s.hero_product.name} fetchPriority="high" data-parallax /></div><figcaption>{s.hero_product.name} <a href={s.hero_product.url} target="_blank" rel="noopener noreferrer">On your store ↗</a></figcaption></figure></div><div className="ris-shell ris-chapters"><a href="#paid-media"><b>01</b> Ad click</a><a href="#product-pair"><b>02</b> Product pair</a><a href="#buying-guidance"><b>03</b> Buying advice</a><a href="#free-shipping"><b>04</b> Free shipping</a></div></header>
      <main>
        <section id="paid-media" className="ris-shell ris-section"><p className="ris-label">01 / Paid ads</p><div className="ris-section-intro" data-reveal><h2>{words(s.route.headline)}</h2><p>{words(s.route.body)}</p></div><div className="ris-ad-stats">{meta && Number.isFinite(meta.data?.active_ad_count) ? <div><strong>{meta.data.active_ad_count}</strong><span>Active Meta ads on the identified page</span><small>{day(meta.fetched_at) ? `Checked ${day(meta.fetched_at)}` : ''}{safeUrl(meta.source_url) ? <> · <a href={meta.source_url} target="_blank" rel="noopener noreferrer">Source ↗</a></> : null}</small></div> : null}{google && Number.isFinite(google.data?.ads_found) ? <div><strong>{google.data.capped ? <small>At least </small> : null}{google.data.ads_found}</strong><span>Google creatives in the public records</span><small>{day(google.fetched_at) ? `Checked ${day(google.fetched_at)}` : ''}{safeUrl(google.source_url) ? <> · <a href={google.source_url} target="_blank" rel="noopener noreferrer">Source ↗</a></> : null}</small></div> : null}<p>Public ad records do not show spend or sales.</p></div><div className="ris-route-grid"><aside className="ris-ad-quote" data-reveal><p className="ris-label">The swatch video</p><span className="ris-ad-symbol" aria-hidden="true">↗</span><blockquote>“{words(s.route.ad_quote)}”</blockquote><p>In English: swatching all Yananails fiber-gel colours.</p><a href={s.route.ad_url} target="_blank" rel="noopener noreferrer">View the actual ad ↗</a></aside><div className="ris-route-destination" data-reveal><div className="ris-switch" aria-label="Compare ad destinations">{(['current', 'proposed'] as const).map(key => <button type="button" key={key} aria-pressed={destination === key} onClick={() => setDestination(key)}>{key === 'current' ? 'Current link' : 'Proposed link'} <span>{key === 'current' ? 'One colour' : 'Gel collection'}</span></button>)}</div><a href={selected.source_url} target="_blank" rel="noopener noreferrer" className="ris-browser-image"><img src={selected.url} alt={`${destination === 'current' ? 'Current OSCAR product page' : 'Proposed gel collection destination'}, captured ${day(selected.captured_at)}`} loading="lazy" /></a><p className="ris-route-caption" aria-live="polite">{destination === 'current' ? 'The recorded ad link opens Fiber Gel OSCAR.' : 'Suggested destination: the gel collection. This change has not been tested.'} <a href={selected.source_url} target="_blank" rel="noopener noreferrer">Open page ↗</a><small>Page captured {day(selected.captured_at)}</small></p></div></div><div className="ris-takeaway" data-reveal><span>One change</span><strong>{words(s.route.action)}</strong></div><Evidence test={data.tests[s.route.test_index]} /></section>
        <section id="product-pair" className="ris-pair-section"><div className="ris-shell ris-section"><div className="ris-pair-grid"><div data-reveal><p className="ris-label">02 / Product pair</p><h2>{words(s.pair.headline)}</h2><p className="ris-body">{words(s.pair.body)}</p><div className="ris-pair-suggestion"><span>Suggested button</span><strong>Add Primer + Bonder ↗</strong></div></div><div className="ris-product-pair" data-reveal>{s.pair.products.map((p, i) => <React.Fragment key={p.url}>{i ? <span className="ris-pair-plus" aria-hidden="true">+</span> : null}<figure><img src={p.image} alt={p.name} loading="lazy" data-parallax /><figcaption><a href={p.url} target="_blank" rel="noopener noreferrer">{p.name} ↗</a></figcaption></figure></React.Fragment>)}</div></div><Evidence test={data.tests[s.pair.test_index]} /></div></section>
        <section id="buying-guidance" className="ris-guidance"><div className="ris-shell ris-section ris-guidance-grid"><div data-reveal><p className="ris-label">03 / Buying advice</p><h2>{words(s.guidance.headline)}</h2><p className="ris-body">{words(s.guidance.body)}</p><Evidence test={data.tests[s.guidance.test_index]} /></div><figure data-reveal><img src={s.guidance.product.image} alt={s.guidance.product.name} loading="lazy" data-parallax /><figcaption><a href={s.guidance.product.url} target="_blank" rel="noopener noreferrer">{s.guidance.product.name} ↗</a></figcaption></figure></div></section>
        <section id="free-shipping" className="ris-shell ris-section ris-shipping-grid"><div data-reveal><p className="ris-label">04 / Free shipping</p><div className="ris-threshold">{s.shipping.threshold}<span>kr</span></div><p className="ris-threshold-label">Free shipping above this amount in Sweden</p><h2>{words(s.shipping.headline)}</h2><p className="ris-body">{words(s.shipping.body)}</p><Evidence test={data.tests[s.shipping.test_index]} /></div><div data-reveal><ShippingExample data={s.shipping} /></div></section>
        <section id="rise-conversation" className="ris-close"><div className="ris-shell"><div className="ris-close-grid" data-reveal><img src="https://resources.risedtc.com/tools/assets/mattan.jpg" alt="Mattan Danino" width={300} height={350} loading="lazy" /><div><p className="ris-label">Mattan Danino / RISE DTC</p><h2>Let’s put your numbers behind these ideas.</h2><p>We’ll look at your ads and store together, then choose which change deserves a test.</p><a className="ris-booking" href={bookingUrl} data-cta="close" target="_blank" rel="noopener noreferrer">30 min with Mattan ↗</a></div></div>{cases.length ? <div className="ris-case-links"><span>Work RISE has run</span>{cases.map(c => <a href={c.url} key={c.url} target="_blank" rel="noopener noreferrer">{c.name} ↗</a>)}</div> : null}</div></section>
      </main><footer className="ris-shell ris-footer"><a href={`https://${domain}`} target="_blank" rel="noopener noreferrer">Prepared for {companyName} ↗</a><details><summary>About this review</summary><p>A dated review of public ads and store pages. These are proposed changes. Conversion, repeat orders and campaign performance need store and ad-account data.</p></details></footer>
    </div></div>
  </div>;
}

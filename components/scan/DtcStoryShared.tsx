import React, { useEffect, useRef } from 'react';
import type { DtcCommercialEvidence } from '../../lib/scanTypes';
const words = (value: string) => value.replace(/[—–]/g, ',');

// A stored domain is a source identifier; only an explicit company name supplies the brand.
export function displayBrandName(companyName: string) {
  const name = companyName.trim();
  return /^https?:\/\//i.test(name) || /^[^\s/]+\.[a-z]{2,}\/?$/i.test(name) ? '' : name;
}


export function Evidence({ test, verbatim = false, fullPlan = false }: { test: DtcCommercialEvidence['tests'][number]; verbatim?: boolean; fullPlan?: boolean }) {
  const text = verbatim ? (value: string) => value : words;
  return <details className="ris-evidence"><summary>{fullPlan ? 'Full test plan & sources' : 'Sources & how to check the result'} <span aria-hidden="true">+</span></summary><div>{fullPlan ? <p><strong>What we saw</strong><br />{text(test.observation)}</p> : null}<p><strong>What to measure</strong><br />{text(test.measure)}</p><p>{fullPlan ? <><strong>Test setup</strong><br /></> : null}{text(test.test)}</p>{test.evidence.map((e, i) => <blockquote key={i}><p>“{e.quote}”</p><a href={e.source_url} target="_blank" rel="noopener noreferrer">{e.kind === 'ad' ? 'View the public ad' : 'Open source page'} ↗</a></blockquote>)}</div></details>;
}


export function useRiseStoryMotion() {
  const root = useRef<HTMLDivElement>(null), wrapper = useRef<HTMLDivElement>(null), content = useRef<HTMLDivElement>(null);
  const smoother = useRef<any>(null);
  const refreshLayout = useRef<() => void>(() => {});
  useEffect(() => {
    let cancelled = false, context: any, media: any, observer: ResizeObserver | undefined, timer: ReturnType<typeof setTimeout>;
    const node = root.current;
    if (!node || typeof window.matchMedia !== 'function' || (window as Window & { __RISE_PRERENDER__?: boolean }).__RISE_PRERENDER__) return;
    Promise.all([import('gsap'), import('gsap/ScrollTrigger'), import('gsap/ScrollSmoother')]).then(([g, t, smooth]) => {
      if (cancelled || !wrapper.current || !content.current) return;
      const gsap = g.gsap, ScrollTrigger = t.ScrollTrigger, ScrollSmoother = smooth.ScrollSmoother;
      gsap.registerPlugin(ScrollTrigger, ScrollSmoother);
      refreshLayout.current = () => ScrollTrigger.refresh();
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
    return () => { cancelled = true; clearTimeout(timer); observer?.disconnect(); media?.revert(); context?.revert(); smoother.current = null; refreshLayout.current = () => {}; };
  }, []);
  const navigate = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = (event.target as Element).closest('a[href^="#"]');
    const id = anchor?.getAttribute('href')?.slice(1), target = id ? document.getElementById(id) : null;
    if (!target || !root.current?.contains(target)) return;
    event.preventDefault();
    const disclosure = target.closest('details');
    if (disclosure && !disclosure.open) { disclosure.open = true; refreshLayout.current(); }
    if (smoother.current) smoother.current.scrollTo(target, true, 'top 92px');
    else target.scrollIntoView({ behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    target.tabIndex = -1; target.focus({ preventScroll: true }); history.pushState(null, '', `#${id}`);
  };
  return { root, wrapper, content, navigate };
}

export function RiseCallClose({ companyName, bookingUrl, cases = [] }: { companyName: string; bookingUrl: string; cases?: { name: string; url: string; headline?: string; image?: string }[] }) {
  const brandName = displayBrandName(companyName);
  return <>
        <section id="rise-method" className="ris-method ris-shell ris-section"><div className="ris-method-grid"><div data-reveal><p className="ris-label">How RISE helps</p><h2>RISE runs paid ads for DTC brands.</h2><p className="ris-body">We run Meta and Google campaigns, produce creative, and improve the pages people buy from. Your product margins and ad costs guide what we test and scale.</p><p className="ris-method-context">For {brandName || 'your brand'}, the next step is checking the findings in this review against your actual sales and advertising costs.</p><a className="ris-explore" href="#rise-conversation">Talk through the growth opportunity <span>↓</span></a></div>{cases.some(c => c.headline) ? <div className="ris-results" data-reveal><h3>Published client results</h3>{cases.filter(c => c.headline).slice(0, 2).map(c => <a className="ris-result-card" href={c.url} key={c.url} target="_blank" rel="noopener noreferrer">{c.image ? <img src={c.image} alt="" loading="lazy" /> : null}<div><span>{c.name}</span><strong>{c.headline}</strong><span>Read the case study ↗</span></div></a>)}<p>Separate RISE client engagements.</p></div> : null}</div><details className="ris-method-video"><summary><span>Watch Mattan explain the RISE method <small>1 min 16 sec · Method excerpt</small></span><b aria-hidden="true">▶</b></summary><video controls playsInline preload="none" crossOrigin="anonymous" poster="https://bjbvqvzbzczjbatgmccb.supabase.co/storage/v1/object/public/post-videos/rise-dtc/scan-20261014-mattan-method-poster.jpg"><source src="https://bjbvqvzbzczjbatgmccb.supabase.co/storage/v1/object/public/post-videos/rise-dtc/scan-20261014-mattan-method-excerpt.mp4" type="video/mp4" /><track kind="captions" src="https://bjbvqvzbzczjbatgmccb.supabase.co/storage/v1/object/public/post-videos/rise-dtc/scan-20261014-mattan-method-excerpt.vtt" srcLang="en" label="English" default />Your browser does not support this video.</video></details></section>
        <section id="rise-conversation" className="ris-close"><div className="ris-shell"><div className="ris-close-grid" data-reveal><img src="https://resources.risedtc.com/tools/assets/mattan.jpg" alt="Mattan Danino" width={300} height={350} loading="lazy" /><div><p className="ris-label">Mattan Danino / RISE DTC</p><h2>{brandName ? `Let’s RISE ${brandName}` : 'Let’s plan your next paid test'}</h2><p>Bring your actual ad costs and product margins. We’ll use them to choose the first paid test for {brandName || 'your brand'} and see whether RISE’s performance model fits.</p><a className="ris-booking" href={bookingUrl} data-cta="close" target="_blank" rel="noopener noreferrer">Get 30 min with Mattan ↗</a></div></div></div></section>
  </>;
}

import React, { useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { asset, slideImagesFor, type JourneyFixture } from './model';
import { Avatar, Paragraphs, Reveal } from './ReadingChapter';
import { LinkedInActions } from '../StoryExhibits';

function Author({ fixture, meta }: { fixture: JourneyFixture; meta: string }) {
  return <div className="post-author"><Avatar src={fixture.founder.avatarUrl} name={fixture.founder.name}/><div><b>{fixture.founder.name}</b><span>{fixture.founder.headline}</span><small>{meta} · <i className="li-globe" aria-hidden="true"/></small></div></div>;
}
/** A written post as it sits in the feed: clamped, with LinkedIn's "…more" to open it in place. */
function FeedPost({ fixture, body, meta, open, onToggle }: { fixture: JourneyFixture; body: string; meta: string; open: boolean; onToggle: () => void }) {
  return <article className={`journey-post feed-post${open ? ' is-open' : ''}`} data-mockup="linkedin">
    <Author fixture={fixture} meta={meta}/>
    <div className="feed-post-body"><Paragraphs text={body}/>{!open && <button className="feed-more" onClick={onToggle}>…more</button>}</div>
    {open && <button className="feed-less" onClick={onToggle}>Show less</button>}
    <LinkedInActions/>
  </article>;
}
export function ContentChapter({ fixture }: {fixture: JourneyFixture}) {
  const posts = fixture.samples.posts || [];
  const carouselIndex = posts.findIndex(p => p.slides?.length || p.image_urls?.length);
  const carousel = posts[carouselIndex];
  const written = posts.map((p,i) => ({ p, i })).filter(({ i }) => i !== carouselIndex).slice(0,3);
  const [open,setOpen] = useState<number|null>(null);
  const slides = carousel?.slides || [];
  const images = carousel ? (carousel.image_urls?.length ? carousel.image_urls : slideImagesFor(fixture)) : [];
  const count = Math.max(slides.length, images.length);
  const [slide,setSlide] = useState(0);
  const [failed,setFailed] = useState(false);
  const touch = useRef<{x:number;y:number}|null>(null);
  const reduced = useReducedMotion();
  const current = slides[slide];
  const metas = ['2d', '4d', '6d'];
  function move(amount: number) { setSlide(i => Math.min(count - 1, Math.max(0,i + amount)));setFailed(false); }
  return <>
    {carousel && <Reveal as="article" className="journey-post journey-carousel-post" data-mockup="linkedin" aria-label="Carousel post">
      <Author fixture={fixture} meta="1d"/>
      <Paragraphs text={carousel.body || carousel.hook}/>
      <div className="journey-deck" aria-label="Carousel slides" tabIndex={0} onKeyDown={e => { if(e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault();move(e.key === 'ArrowRight'?1:-1); } }} onTouchStart={e => {touch.current={x:e.touches[0].clientX,y:e.touches[0].clientY};}} onTouchEnd={e => {if(!touch.current)return;const dx=e.changedTouches[0].clientX-touch.current.x,dy=e.changedTouches[0].clientY-touch.current.y;if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.5)move(dx<0?1:-1);touch.current=null;}}>
        <motion.div key={slide} className={`journey-slide slide-${current?.role || 'point'}${images[slide] && !failed ? ' is-image' : ''}`} data-mockup="prospect" initial={reduced ? false : {opacity:.4,x:16}} animate={{opacity:1,x:0}} transition={{duration:reduced?0:.3,ease:[.22,.84,.36,1]}}>
          {images[slide] && !failed ? <img src={images[slide]} alt={current?.heading || `Slide ${slide+1}`} onError={() => setFailed(true)}/> : <><span className="slide-counter">{slide+1} / {count}</span><span className="slide-rule" aria-hidden="true"/><div className="slide-copy"><h3>{current?.heading || 'Slide image unavailable'}</h3><p className="sample-body">{current?.body || ''}</p></div><span className="slide-logo" aria-hidden="true">{fixture.founder.company.trim().charAt(0).toUpperCase()}</span></>}
        </motion.div>
        <button className="slide-arrow slide-arrow-prev" aria-label="Previous slide" disabled={slide === 0} onClick={() => move(-1)}>‹</button>
        <button className="slide-arrow slide-arrow-next" aria-label="Next slide" disabled={slide === count-1} onClick={() => move(1)}>›</button>
        <span className="slide-badge" aria-hidden="true">{slide+1} / {count}</span>
      </div>
      <div className="slide-dots" aria-hidden="true">{Array.from({length:count}).map((_,i) => <i key={i} className={i === slide ? 'is-on' : ''}/>)}</div>
      <span className="slide-status" aria-live="polite">Slide {slide+1} of {count}</span>
      <LinkedInActions/>
    </Reveal>}
    <Reveal className="feed-row" aria-label="The rest of the week">
      {written.map(({ p, i },n) => <FeedPost key={i} fixture={fixture} body={p.body || p.hook || ''} meta={metas[n]} open={open === i} onToggle={() => setOpen(open === i ? null : i)}/>)}
    </Reveal>
    <Reveal as="article" className="li-profile" data-mockup="linkedin" aria-label="Profile preview">
      <div className="li-profile-banner"><span>{fixture.founder.company}</span></div>
      <div className="li-profile-top"><Avatar src={fixture.founder.avatarUrl} name={fixture.founder.name}/><div className="li-profile-actions"><span className="li-btn li-btn-primary">Follow</span><span className="li-btn">Message</span><span className="li-btn li-btn-icon">…</span></div></div>
      <div className="li-profile-body"><h3>{fixture.founder.name}</h3><p className="li-profile-headline">{fixture.founder.headline}</p><p className="li-profile-meta">{fixture.founder.company} · <span>Contact info</span></p></div>
      <div className="li-profile-section"><h4>Featured</h4><a className="li-featured" href="#inbound">{fixture.lm_cover_local && <img src={/^https?:/.test(fixture.lm_cover_local) ? fixture.lm_cover_local : asset(fixture.lm_cover_local)} alt="" loading="lazy"/>}<span><small>Link</small><b>{fixture.samples.lm?.title}</b><em>{fixture.domain}</em></span></a></div>
    </Reveal>
  </>;
}

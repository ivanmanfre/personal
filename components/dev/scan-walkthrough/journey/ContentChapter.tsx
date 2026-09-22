import React, { useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { JourneyFixture } from './model';
import { Avatar, Paragraphs, Reveal } from './ReadingChapter';
import { LinkedInActions } from '../StoryExhibits';

function Author({ fixture, meta }: { fixture: JourneyFixture; meta: string }) {
  return <div className="post-author"><Avatar src={fixture.founder.avatarUrl} name={fixture.founder.name}/><div><b>{fixture.founder.name}</b><span>{fixture.founder.headline}</span><small>{meta}</small></div></div>;
}
export function ContentChapter({ fixture }: {fixture: JourneyFixture}) {
  const posts = fixture.samples.posts || [];
  const carouselIndex = posts.findIndex(p => p.slides?.length || p.image_urls?.length);
  const carousel = posts[carouselIndex];
  const written = posts.map((p,i) => ({ p, i })).filter(({ i }) => i !== carouselIndex);
  const labels = fixture.post_labels || [];
  const [selected,setSelected] = useState(written.find(({ i }) => i === 2)?.i ?? written[0]?.i ?? 0);
  const post = posts[selected] || posts[0];
  const slides = carousel?.slides || [];
  const count = Math.max(slides.length, carousel?.image_urls?.length || 0);
  const [slide,setSlide] = useState(0);
  const [failed,setFailed] = useState(false);
  const touch = useRef<{x:number;y:number}|null>(null);
  const reduced = useReducedMotion();
  const current = slides[slide];
  function move(amount: number) { setSlide(i => Math.min(count - 1, Math.max(0,i + amount)));setFailed(false); }
  return <>
    {carousel && <Reveal as="article" className="journey-post journey-carousel-post" data-mockup="linkedin" aria-label="Carousel post sample">
      <div className="platform-bar"><span><b className="linkedin-mark">in</b> In their feed</span><span>Proposed carousel</span></div>
      <Author fixture={fixture} meta="1d · Edited · ◉"/>
      <Paragraphs text={carousel.body || carousel.hook}/>
      <div className="journey-deck" aria-label="Carousel slides" tabIndex={0} onKeyDown={e => { if(e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault();move(e.key === 'ArrowRight'?1:-1); } }} onTouchStart={e => {touch.current={x:e.touches[0].clientX,y:e.touches[0].clientY};}} onTouchEnd={e => {if(!touch.current)return;const dx=e.changedTouches[0].clientX-touch.current.x,dy=e.changedTouches[0].clientY-touch.current.y;if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.5)move(dx<0?1:-1);touch.current=null;}}>
        <motion.div key={slide} className={`journey-slide slide-${current?.role || 'point'}`} data-mockup="prospect" initial={reduced ? false : {opacity:.4,x:16}} animate={{opacity:1,x:0}} transition={{duration:reduced?0:.3,ease:[.22,.84,.36,1]}}>
          {carousel.image_urls?.[slide] && !failed ? <img src={carousel.image_urls[slide]} alt={current?.heading || `Carousel slide ${slide+1}`} onError={() => setFailed(true)}/> : <><span className="slide-counter">{slide+1} / {count}</span><span className="slide-rule" aria-hidden="true"/><div className="slide-copy"><h3>{current?.heading || 'Slide image unavailable'}</h3><p className="sample-body">{current?.body || 'Open the original scan to view this asset.'}</p></div><span className="slide-logo" aria-hidden="true">{fixture.founder.company.trim().charAt(0).toUpperCase()}</span></>}
        </motion.div>
        <button className="slide-arrow slide-arrow-prev" aria-label="Previous slide" disabled={slide === 0} onClick={() => move(-1)}>‹</button>
        <button className="slide-arrow slide-arrow-next" aria-label="Next slide" disabled={slide === count-1} onClick={() => move(1)}>›</button>
      </div>
      <div className="slide-dots" aria-hidden="true">{Array.from({length:count}).map((_,i) => <i key={i} className={i === slide ? 'is-on' : ''}/>)}</div>
      <span className="slide-status" aria-live="polite">Slide {slide+1} of {count}</span>
      <LinkedInActions/>
    </Reveal>}
    <div className="journey-bridge"><span aria-hidden="true">↓</span><p>Three more posts that week.<br/><strong>Pick one to read in full.</strong></p></div>
    <div className="sample-toolbar"><label htmlFor="journey-post">Your post samples</label><select id="journey-post" value={selected} onChange={e => setSelected(Number(e.target.value))}>{written.map(({ p, i }) => <option key={i} value={i}>{labels[i] || (p.hook || '').slice(0,60)}</option>)}</select></div>
    <Reveal as="article" className="journey-post" data-mockup="linkedin">
      <div className="platform-bar"><span><b className="linkedin-mark">in</b> In their feed</span><span>Proposed post</span></div>
      <Author fixture={fixture} meta="2d · ◉"/>
      <Paragraphs text={post.body || post.hook}/>
      {post.image_card && <div className="journey-brand-image" data-mockup="prospect"><div><span>{post.image_card.kicker}</span><b>{fixture.founder.company}</b></div>{post.image_card.figure && <strong className="brand-figure">{post.image_card.figure}</strong>}<h3>{post.image_card.headline}</h3><p>{post.image_card.sub}</p><i aria-hidden="true">↗</i></div>}
      <LinkedInActions/>
    </Reveal>
    {fixture.post_notes?.[String(selected)] && <p className="source-note">Original scan draft. {fixture.post_notes[String(selected)]}</p>}
    <div className="journey-bridge"><span aria-hidden="true">↓</span><p>They like the idea.<br/><strong>Now, who’s behind it?</strong></p></div>
    <Reveal as="article" className="journey-profile" data-mockup="linkedin">
      <div className="profile-cover"><span>{fixture.founder.company}</span><span>{fixture.domain}</span></div>
      <div className="profile-details"><Avatar src={fixture.founder.avatarUrl} name={fixture.founder.name}/><span className="sample-stamp">Profile preview</span><h3>{fixture.founder.name}</h3><p className="sample-body">{fixture.founder.headline}</p><span className="source-note">Headline from the original scan</span>
      <div className="profile-featured"><span className="journey-eyebrow">Featured / proposed</span><a href="#inbound"><span>Your next post starts here.<small>{fixture.samples.lm?.title}</small></span><b aria-hidden="true">↗</b></a></div></div>
    </Reveal>
  </>;
}

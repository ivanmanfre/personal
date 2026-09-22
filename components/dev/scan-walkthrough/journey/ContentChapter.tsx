import React, { useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { JourneyFixture } from './model';
import { Avatar, Paragraphs, Reveal } from './ReadingChapter';
import { LinkedInActions } from '../StoryExhibits';

export function ContentChapter({ fixture }: {fixture: JourneyFixture}) {
  const posts = fixture.samples.posts || [];
  const [selected,setSelected] = useState(2);
  const post = posts[selected] || posts[0];
  const labels = ['The interview question', 'The results file', 'Why readers come back', 'The 99-1 rule'];
  const carousel = posts.find(p => p.slides?.length || p.image_urls?.length);
  const slides = carousel?.slides || [];
  const count = Math.max(slides.length, carousel?.image_urls?.length || 0);
  const [slide,setSlide] = useState(0);
  const [failed,setFailed] = useState(false);
  const touch = useRef<{x:number;y:number}|null>(null);
  const reduced = useReducedMotion();
  const current = slides[slide];
  function move(amount: number) { setSlide(i => Math.min(count - 1, Math.max(0,i + amount)));setFailed(false); }
  return <>
    <div className="sample-toolbar"><label htmlFor="journey-post">Your post samples</label><select id="journey-post" value={selected} onChange={e => setSelected(Number(e.target.value))}>{posts.map((p,i) => <option key={i} value={i}>{labels[i] || p.hook}</option>)}</select></div>
    <Reveal as="article" className="journey-post" data-mockup="linkedin">
      <div className="platform-bar"><span><b className="linkedin-mark">in</b> In their feed</span><span>Proposed post</span></div>
      <div className="post-author"><Avatar src={fixture.founder.avatarUrl} name={fixture.founder.name}/><div><b>{fixture.founder.name}</b><span>{fixture.founder.company} · Storytelling & customer research</span><small>Sample · ◉</small></div></div>
      <Paragraphs text={post.body || post.hook}/>
      {post.image_card && <div className="journey-brand-image" data-mockup="cuevu"><div><span>{post.image_card.kicker}</span><b>CueVu</b></div>{post.image_card.figure && <strong className="brand-figure">{post.image_card.figure}</strong>}<h3>{post.image_card.headline}</h3><p>{post.image_card.sub}</p><i aria-hidden="true">↗</i></div>}
      <LinkedInActions/>
    </Reveal>
    {(selected === 1 || selected === 3) && <p className="source-note">Original scan draft. {selected === 1 ? 'The customer story and pilot price need Andrew’s confirmation.' : 'The statistics and study claims need checking before publishing.'}</p>}
    <div className="journey-bridge"><span aria-hidden="true">↓</span><p>Same idea, another format.<br/><strong>A carousel they can swipe through.</strong></p></div>
    <Reveal>
      <div className="journey-deck" aria-label="Carousel sample" tabIndex={0} onKeyDown={e => { if(e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault();move(e.key === 'ArrowRight'?1:-1); } }} onTouchStart={e => {touch.current={x:e.touches[0].clientX,y:e.touches[0].clientY};}} onTouchEnd={e => {if(!touch.current)return;const dx=e.changedTouches[0].clientX-touch.current.x,dy=e.changedTouches[0].clientY-touch.current.y;if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.5)move(dx<0?1:-1);touch.current=null;}}>
        <motion.article key={slide} className={`journey-slide slide-${current?.role || 'point'}`} data-mockup="cuevu" initial={reduced ? false : {opacity:.5,x:12}} animate={{opacity:1,x:0}} transition={{duration:reduced?0:.3,ease:[.22,.84,.36,1]}}>
          {carousel?.image_urls?.[slide] && !failed ? <img src={carousel.image_urls[slide]} alt={current?.heading || `Original carousel slide ${slide+1}`} onError={() => setFailed(true)}/> : <><div className="slide-top"><b>CueVu</b><span>{current?.kicker || 'Customer stories'}</span></div><span className="slide-ornament" aria-hidden="true">{slide === 0 ? '“' : String(slide+1).padStart(2,'0')}</span><div className="slide-copy"><h3>{current?.heading || 'Slide image unavailable'}</h3><p className="sample-body">{current?.body || 'Open the original scan to view this asset.'}</p></div><div className="slide-bottom"><span>Andrew Hayes</span><span>{String(slide+1).padStart(2,'0')} / {String(count).padStart(2,'0')}</span></div></>}
        </motion.article>
      </div>
      {carousel?.image_urls?.[slide] && current && <div className="slide-transcript"><h3>{current.heading}</h3><p className="sample-body">{current.body}</p></div>}
      <div className="carousel-controls"><button aria-label="Previous slide" disabled={slide === 0} onClick={() => move(-1)}>←</button><span aria-live="polite">Slide {slide+1} of {count}</span><button aria-label="Next slide" disabled={slide === count-1} onClick={() => move(1)}>→</button></div>
    </Reveal>
    <div className="journey-bridge"><span aria-hidden="true">↓</span><p>They like the idea.<br/><strong>Now, who’s behind it?</strong></p></div>
    <Reveal as="article" className="journey-profile" data-mockup="linkedin">
      <div className="profile-cover"><span>CueVu</span><span>Stories start<br/>with people.</span></div>
      <div className="profile-details"><Avatar src={fixture.founder.avatarUrl} name={fixture.founder.name}/><span className="sample-stamp">Profile preview</span><h3>{fixture.founder.name}</h3><p className="sample-body">{fixture.founder.headline}</p><span className="source-note">Headline from the original scan</span>
      <div className="profile-featured"><span className="journey-eyebrow">Featured / proposed</span><a href="#inbound"><span>Your next post starts here.<small>The 99-1 Readiness Score</small></span><b aria-hidden="true">↗</b></a></div></div>
    </Reveal>
  </>;
}

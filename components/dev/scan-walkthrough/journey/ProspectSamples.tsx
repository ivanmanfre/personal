import React, { useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { MagnetCover } from './MagnetCover';
import { Avatar, Paragraphs } from './ReadingChapter';
import { LinkedInActions } from '../StoryExhibits';
import {useStory} from '../../../scan/story/context';
import {BrandSlide} from '../../../scan/story/BrandSlide';
import type { StoryKind } from './connectedModel';
import type { JourneyFixture } from './model';

export function SampleArtwork({ kind, index = 0 }: { kind: StoryKind; index?: number }) {
  const plan = useStory();
  const slide = plan.slides[index];
  if (plan.art === 'custom') return <BrandSlide index={index}/>;
  return <div className={`bespoke-slide artwork-${kind} artwork-${index}`}>
    <div className="artwork-masthead"><b>{plan.brand}</b><span>{String(index + 1).padStart(2, '0')} / {String(plan.slides.length).padStart(2, '0')}</span></div>
    <h3>{slide.title}</h3>
    <p>{slide.body}</p>
    {index === 0 && (kind === 'creative' ? <div className="review-art" aria-hidden="true"><span>First internal review</span><div><i/><i/><i/><i/></div><small>Client access?</small><b>?</b></div> : <div className="question-art" aria-hidden="true"><span>Customer research</span><q>What were you feeling when you decided to switch?</q><div/></div>)}
    {index > 0 && slide.note && <div className="artwork-note">{slide.note}</div>}
    {index > 0 && !slide.note && <div className="artwork-document" aria-hidden="true"><span>{kind === 'creative' ? 'Project brief' : 'Research brief'}</span><div/><div/><div/></div>}
    <footer><span/><span aria-hidden="true">→</span></footer>
  </div>;
}

export function ProspectPost({ fixture, kind }: { fixture: JourneyFixture; kind: StoryKind }) {
  const [slide, setSlide] = useState(0);
  const reduced = useReducedMotion();
  const plan = useStory();
  const dir = useRef(1);
  const move = (amount: number) => { dir.current = amount; setSlide(v => Math.max(0, Math.min(plan.slides.length - 1, v + amount))); };
  return <article className="journey-post journey-carousel-post prospect-post" data-mockup="linkedin" aria-label="Proposed LinkedIn post">
    <header className="post-author"><Avatar src={fixture.founder.avatarUrl} name={fixture.founder.name}/><div><b>{fixture.founder.name}</b><span>{fixture.founder.company}</span><small><i className="li-globe" aria-hidden="true"/></small></div></header>
    <Paragraphs text={plan.post}/>
    <div className="journey-deck has-handles" tabIndex={0} aria-label="Carousel slides" onKeyDown={e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); move(e.key === 'ArrowRight' ? 1 : -1); } }}>
      <motion.div key={slide} drag={reduced ? false : 'x'} dragConstraints={{ left: 0, right: 0 }} dragElastic={.35} dragSnapToOrigin onDragEnd={(_, info) => { if (Math.abs(info.offset.x) > 60 || Math.abs(info.velocity.x) > 400) move(info.offset.x < 0 ? 1 : -1); }}
        initial={reduced ? false : { opacity: .5, x: dir.current * 40 }} animate={{ opacity: 1, x: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 32 }} style={{ touchAction: 'pan-y', cursor: reduced ? undefined : 'grab' }}><SampleArtwork kind={kind} index={slide}/></motion.div>
      <button className="deck-handle is-prev" aria-label="Previous slide" disabled={slide === 0} onClick={() => move(-1)}>‹</button>
      <button className="deck-handle is-next" aria-label="Next slide" disabled={slide === plan.slides.length - 1} onClick={() => move(1)}>›</button>
    </div>
    <div className="deck-dots" role="tablist" aria-label="Choose a slide">{plan.slides.map((_, i) => <button key={i} role="tab" aria-selected={i === slide} aria-label={`Slide ${i + 1} of ${plan.slides.length}`} onClick={() => { dir.current = i > slide ? 1 : -1; setSlide(i); }}/>)}<span className="slide-status" aria-live="polite">{slide + 1} / {plan.slides.length}</span></div>
    <LinkedInActions/>
  </article>;
}

export function TextPost({ fixture, kind, promotion = false }: { fixture: JourneyFixture; kind: StoryKind; promotion?: boolean }) {
  const plan = useStory();
  return <article className={`journey-post prospect-post text-only-post ${promotion ? 'magnet-promotion' : ''}`} data-mockup="linkedin" aria-label={promotion ? 'Post promoting the lead magnet' : 'Text-only LinkedIn post'}>
    <header className="post-author"><Avatar src={fixture.founder.avatarUrl} name={fixture.founder.name}/><div><b>{fixture.founder.name}</b><span>{fixture.founder.company}</span><small><i className="li-globe" aria-hidden="true"/></small></div></header>
    <Paragraphs text={promotion ? plan.magnetPost : plan.plainPost}/>
    {promotion && <MagnetCover kind={kind}/>}
    <LinkedInActions/>
  </article>;
}

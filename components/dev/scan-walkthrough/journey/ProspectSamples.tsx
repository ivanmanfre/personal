import React, { useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { MagnetCover } from './MagnetCover';
import { Avatar, Paragraphs } from './ReadingChapter';
import { LinkedInActions } from '../StoryExhibits';
import {useStory} from '../../../scan/story/context';
import type { StoryKind } from './connectedModel';
import type { JourneyFixture } from './model';

export function SampleArtwork({ kind, index = 0 }: { kind: StoryKind; index?: number }) {
  const plan = useStory();
  const slide = plan.slides[index];
  return <div className={`bespoke-slide artwork-${kind} artwork-${index}`} style={plan.art==='custom'?{background:plan.resource.brand.surface,color:plan.resource.brand.ink}:undefined}>
    <div className="artwork-masthead"><b>{plan.brand}</b><span>{String(index + 1).padStart(2, '0')} / {String(plan.slides.length).padStart(2, '0')}</span></div>
    <h3>{slide.title}</h3>
    <p>{slide.body}</p>
    {index === 0 && plan.art !== 'custom' && (kind === 'creative' ? <div className="review-art" aria-hidden="true"><span>First internal review</span><div><i/><i/><i/><i/></div><small>Client access?</small><b>?</b></div> : <div className="question-art" aria-hidden="true"><span>Customer research</span><q>What were you feeling when you decided to switch?</q><div/></div>)}
    {index > 0 && slide.note && <div className="artwork-note">{slide.note}</div>}
    {index > 0 && !slide.note && <div className="artwork-document" aria-hidden="true"><span>{plan.art === 'custom' ? plan.brand : kind === 'creative' ? 'Project brief' : 'Research brief'}</span><div/><div/><div/></div>}
    <footer><span/><span aria-hidden="true">→</span></footer>
  </div>;
}

export function ProspectPost({ fixture, kind }: { fixture: JourneyFixture; kind: StoryKind }) {
  const [slide, setSlide] = useState(0);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const reduced = useReducedMotion();
  const plan = useStory();
  const move = (amount: number) => setSlide(v => Math.max(0, Math.min(plan.slides.length - 1, v + amount)));
  return <article className="journey-post journey-carousel-post prospect-post" data-mockup="linkedin" aria-label="Proposed LinkedIn post">
    <header className="post-author"><Avatar src={fixture.founder.avatarUrl} name={fixture.founder.name}/><div><b>{fixture.founder.name}</b><span>{fixture.founder.company}</span><small><i className="li-globe" aria-hidden="true"/></small></div></header>
    <Paragraphs text={plan.post}/>
    <div className="journey-deck" tabIndex={0} aria-label="Carousel slides" onKeyDown={e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); move(e.key === 'ArrowRight' ? 1 : -1); } }} onTouchStart={e => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }} onTouchEnd={e => { if (!touch.current) return; const dx = e.changedTouches[0].clientX - touch.current.x, dy = e.changedTouches[0].clientY - touch.current.y; if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) move(dx < 0 ? 1 : -1); touch.current = null; }}>
      <motion.div key={slide} initial={reduced ? false : { opacity: .6, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: reduced ? 0 : .2 }}><SampleArtwork kind={kind} index={slide}/></motion.div>
    </div>
    <div className="deck-controls"><button aria-label="Previous slide" disabled={slide === 0} onClick={() => move(-1)}>←</button><span className="slide-status" aria-live="polite">Slide {slide + 1} of {plan.slides.length}</span><button aria-label="Next slide" disabled={slide === plan.slides.length - 1} onClick={() => move(1)}>→</button></div>
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

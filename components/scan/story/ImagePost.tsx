import React from 'react';
import type {JourneyFixture} from '../../dev/scan-walkthrough/journey/model';
import {Avatar, Paragraphs} from '../../dev/scan-walkthrough/journey/ReadingChapter';
import {LinkedInActions} from '../../dev/scan-walkthrough/StoryExhibits';
import {useStory} from './context';
import {BrandMark, brandFont, brandPalette} from './BrandSlide';

/** A single-image post: the richest point of the carousel, set as one square infographic. */
export function ImagePost({fixture}: {fixture: JourneyFixture}) {
 const plan = useStory(), p = brandPalette(plan.resource.brand);
 const middle = plan.slides.slice(1, -1);
 const slide = [...middle].sort((a, b) => (b.points?.length ?? 0) - (a.points?.length ?? 0) || b.body.length - a.body.length)[0] ?? plan.slides[0];
 if (!slide) return null;
 const points = (slide.points ?? []).slice(0, 4);
 return <article className="journey-post prospect-post image-post" data-mockup="linkedin" aria-label="Single-image LinkedIn post">
  <header className="post-author"><Avatar src={fixture.founder.avatarUrl} name={fixture.founder.name}/><div><b>{fixture.founder.name}</b><span>{fixture.founder.company}</span><small><i className="li-globe" aria-hidden="true"/></small></div></header>
  <Paragraphs text={slide.body}/>
  <div className="ip-art" style={{background: p.dark, color: p.light, fontFamily: brandFont(plan.resource.brand.font), '--ip-mark': p.accentOnDark} as React.CSSProperties}>
   <BrandMark ground={p.dark} height={18}/>
   <h3>{slide.title}</h3>
   {points.length > 0
    ? <ol className={points.length > 2 ? 'is-grid' : ''}>{points.map((x, i) => <li key={x}><b>{String(i + 1).padStart(2, '0')}</b>{x}</li>)}</ol>
    : <span className="ip-bar" aria-hidden="true"/>}
   <footer><Avatar src={fixture.founder.avatarUrl} name={fixture.founder.name}/><span>{fixture.founder.name}</span></footer>
  </div>
  <LinkedInActions/>
 </article>;
}

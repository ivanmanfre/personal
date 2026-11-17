import React from 'react';
import {useMetadata} from '../../../hooks/useMetadata';
import {useGoogleFonts} from '../../../hooks/useGoogleFonts';
import {StudioPlan} from './StudioPlan';
import {StudioPlanV2} from './StudioPlanV2';
import {bookUrl, countLine} from './v2/hero';
import {PLAN_TITLE} from './v2/copy';
import type {JourneyFixture} from '../../dev/scan-walkthrough/journey/model';
import type {StoryEdition} from './types';
import {StoryContext} from './context';
import {fillEdition} from './RichText';
import '../../dev/scan-walkthrough/story-exhibits.css';
import '../../dev/scan-walkthrough/journey/journey.css';
import './scan-studio.css';

/** V2 only when the build switch is not off and the scan carries a checked hero; anything else renders today's plan. */
export const useV2=(fixture:JourneyFixture)=>import.meta.env.VITE_SCAN_HERO!=='0'&&!!fixture.hero;
export function StoryBody({fixture,edition}:{fixture:JourneyFixture;edition:StoryEdition}){
 const clean=React.useMemo(()=>fillEdition(edition),[edition]);
 const Plan=useV2(fixture)?StudioPlanV2:StudioPlan;
 return <StoryContext.Provider value={clean}><Plan key={fixture.slug} fixture={fixture} kind={edition.art}/></StoryContext.Provider>;
}
/** "{First}, {count line}" when the hero has one, else the plan title the prerender already accepts. */
function v2Title(fixture:JourneyFixture){
 const hero=fixture.hero!,line=hero.lead?countLine(hero.count,hero.lead.source):null;
 return line?`${fixture.founder.firstName}, ${line.replace(/\.$/,'')}`:PLAN_TITLE(fixture.founder.firstName);
}
export default function ScanStoryReport({fixture,edition,review=false}:{fixture:JourneyFixture;edition:StoryEdition;review?:boolean}){
 React.useEffect(()=>{
  const icon=document.head.querySelector<HTMLLinkElement>('link[rel="icon"]');
  const previous=icon?.getAttribute('href');
  if(icon)icon.href=import.meta.env.BASE_URL+'studio-favicon.svg';
  return()=>{if(icon&&previous!==null&&previous!==undefined)icon.setAttribute('href',previous)};
 },[]);
 useGoogleFonts([fixture.samples.lm?.brand?.font_heading,edition.resource?.brand?.font]);
 const v2=useV2(fixture);
 useMetadata({title:v2?v2Title(fixture):`Turn LinkedIn into booked calls | ${fixture.founder.firstName}`,description:`Content, resources and outreach for ${fixture.founder.company}.`,canonical:`https://inboundonsteroids.com/scan/${fixture.slug}/`,ogImage:fixture.ogImage,noindex:true});
 return <main className="scan-journey scan-studio" id="top">
  <a href="#content" className="journey-skip">Skip to your samples</a>
  <div className="journey-topbar"><a href="#top" className="journey-wordmark" aria-label="InboundOnSteroids">inbound<b>on</b>steroids</a>{v2?<a className="studio-topbar-cta" href={bookUrl(fixture.slug,'header')} target="_blank" rel="noreferrer" data-scan-click="book-header">Book a call</a>:<a className="studio-topbar-cta" href="https://calendly.com/im-ivanmanfredi/30min">Book a call</a>}</div>
  <StoryBody fixture={fixture} edition={edition}/>
 </main>;
}

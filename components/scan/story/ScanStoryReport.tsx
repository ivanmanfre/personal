import React from 'react';
import {useMetadata} from '../../../hooks/useMetadata';
import {useGoogleFonts} from '../../../hooks/useGoogleFonts';
import {StudioPlan} from './StudioPlan';
import type {JourneyFixture} from '../../dev/scan-walkthrough/journey/model';
import type {StoryEdition} from './types';
import {StoryContext} from './context';
import {fillEdition} from './RichText';
import '../../dev/scan-walkthrough/story-exhibits.css';
import '../../dev/scan-walkthrough/journey/journey.css';
import './scan-studio.css';

export function StoryBody({fixture,edition}:{fixture:JourneyFixture;edition:StoryEdition}){
 const clean=React.useMemo(()=>fillEdition(edition),[edition]);
 return <StoryContext.Provider value={clean}><StudioPlan key={fixture.slug} fixture={fixture} kind={edition.art}/></StoryContext.Provider>;
}
export default function ScanStoryReport({fixture,edition,review=false}:{fixture:JourneyFixture;edition:StoryEdition;review?:boolean}){
 React.useEffect(()=>{
  const icon=document.head.querySelector<HTMLLinkElement>('link[rel="icon"]');
  const previous=icon?.getAttribute('href');
  if(icon)icon.href=import.meta.env.BASE_URL+'studio-favicon.svg';
  return()=>{if(icon&&previous!==null&&previous!==undefined)icon.setAttribute('href',previous)};
 },[]);
 useGoogleFonts([fixture.samples.lm?.brand?.font_heading,edition.resource?.brand?.font]);
 useMetadata({title:`Turn LinkedIn into booked calls | ${fixture.founder.firstName}`,description:`Content, resources and outreach for ${fixture.founder.company}.`,canonical:`https://inboundonsteroids.com/scan/${fixture.slug}/`,ogImage:fixture.ogImage,noindex:true});
 return <main className="scan-journey scan-studio" id="top">
  <a href="#content" className="journey-skip">Skip to your samples</a>
  <div className="journey-topbar"><a href="#top" className="journey-wordmark" aria-label="InboundOnSteroids">inbound<b>on</b>steroids</a><a className="studio-topbar-cta" href="https://calendly.com/im-ivanmanfredi/30min">Book a call</a></div>
  <StoryBody fixture={fixture} edition={edition}/>
 </main>;
}

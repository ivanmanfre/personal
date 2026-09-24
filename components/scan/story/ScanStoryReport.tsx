import React from 'react';
import {useMetadata} from '../../../hooks/useMetadata';
import {useGoogleFonts} from '../../../hooks/useGoogleFonts';
import {ConnectedJourney} from '../../dev/scan-walkthrough/journey/ConnectedJourney';
import type {JourneyFixture} from '../../dev/scan-walkthrough/journey/model';
import type {StoryEdition} from './types';
import {StoryContext} from './context';
import '../../dev/scan-walkthrough/story-exhibits.css';
import '../../dev/scan-walkthrough/journey/journey.css';

export function StoryBody({fixture,edition}:{fixture:JourneyFixture;edition:StoryEdition}){
 return <StoryContext.Provider value={edition}><ConnectedJourney key={fixture.slug} fixture={fixture} kind={edition.art}/></StoryContext.Provider>;
}
export default function ScanStoryReport({fixture,edition,review=false}:{fixture:JourneyFixture;edition:StoryEdition;review?:boolean}){
 useGoogleFonts([fixture.samples.lm?.brand?.font_heading,edition.resource?.brand?.font]);
 useMetadata({title:`${fixture.founder.firstName}, your LinkedIn plan for qualified calls`,description:`Content, resources and outreach for ${fixture.founder.company}.`,canonical:`https://inboundonsteroids.com/scan/${fixture.slug}/`,ogImage:fixture.ogImage,noindex:true});
 return <main className="scan-journey" id="top">
  <a href="#content" className="journey-skip">Skip to your samples</a>
  <div className="journey-topbar"><a href="#top" className="journey-wordmark" aria-label="InboundOnSteroids">INBOUND<b>ON</b>STEROIDS</a><a className="topbar-cta" href="https://calendly.com/im-ivanmanfredi/30min">Book a call</a></div>
  <StoryBody fixture={fixture} edition={edition}/>
 </main>;
}

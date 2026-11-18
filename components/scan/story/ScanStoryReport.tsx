import React from 'react';
import {useMetadata} from '../../../hooks/useMetadata';
import {useGoogleFonts} from '../../../hooks/useGoogleFonts';
import {StudioPlan} from './StudioPlan';
import {StudioPlanV2} from './StudioPlanV2';
import {hasScanV2} from '../../../scripts/scan-hero-switch.mjs';
import {bookUrl, countLine} from './v2/hero';
import {PLAN_TITLE} from './v2/copy';
import {PartnerView} from './v2/PartnerView';
import type {JourneyFixture} from '../../dev/scan-walkthrough/journey/model';
import type {StoryEdition} from './types';
import {StoryContext} from './context';
import {fillEdition} from './RichText';
import '../../dev/scan-walkthrough/story-exhibits.css';
import '../../dev/scan-walkthrough/journey/journey.css';
import './scan-studio.css';

/** V2 only when the build switch is exactly '1' and the scan carries a hero: a checked one, or one the checks rejected
 *  (that one gets the plainest first screen). No hero at all, or the switch off, renders today's plan. The adapter sets
 *  `hero` or `heroRejected` exactly when the stored hero is present, so this is the prerender's predicate (hasScanV2). */
export const useV2=(fixture:JourneyFixture)=>hasScanV2(import.meta.env.VITE_SCAN_HERO,fixture.hero??fixture.heroRejected);
/** Any throw inside the new layout renders today's layout instead, so a malformed scan can never blank the page. */
export class V2Guard extends React.Component<{fallback:React.ReactNode;onFail?:()=>void;children:React.ReactNode},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 componentDidCatch(){this.props.onFail?.();}
 render(){return this.state.failed?this.props.fallback:this.props.children;}
}
export function StoryBody({fixture,edition,legacy=false,onV2Fail}:{fixture:JourneyFixture;edition:StoryEdition;legacy?:boolean;onV2Fail?:()=>void}){
 const clean=React.useMemo(()=>fillEdition(edition),[edition]);
 const old=<StudioPlan key={fixture.slug} fixture={fixture} kind={edition.art}/>;
 const body=!legacy&&useV2(fixture)?<V2Guard fallback={old} onFail={onV2Fail}><StudioPlanV2 key={fixture.slug} fixture={fixture} kind={edition.art}/></V2Guard>:old;
 return <StoryContext.Provider value={clean}>{body}</StoryContext.Provider>;
}
/** "{First}, {count line}" when the hero has one, else the plan title the prerender already accepts. */
function v2Title(fixture:JourneyFixture){
 try{
  const hero=fixture.hero,line=hero?.lead?countLine(hero.count,hero.lead.source):null;
  return line?`${fixture.founder.firstName}, ${line.replace(/\.$/,'')}`:PLAN_TITLE(fixture.founder.firstName);
 }catch{return PLAN_TITLE(fixture.founder.firstName);}
}
export default function ScanStoryReport({fixture,edition,review=false,view='main'}:{fixture:JourneyFixture;edition:StoryEdition;review?:boolean;view?:'main'|'team'}){
 React.useEffect(()=>{
  const icon=document.head.querySelector<HTMLLinkElement>('link[rel="icon"]');
  const previous=icon?.getAttribute('href');
  if(icon)icon.href=import.meta.env.BASE_URL+'studio-favicon.svg';
  return()=>{if(icon&&previous!==null&&previous!==undefined)icon.setAttribute('href',previous)};
 },[]);
 useGoogleFonts([fixture.samples.lm?.brand?.font_heading,edition.resource?.brand?.font]);
 // A throw inside the new layout flips the whole page (title, top bar, body) back to today's layout.
 const [v2Failed,setV2Failed]=React.useState(false);
 const v2=useV2(fixture)&&!v2Failed,team=v2&&view==='team',fail=React.useCallback(()=>setV2Failed(true),[]);
 // Printing opens every closed disclosure (samples, the rest of the buyers) and puts them back afterwards.
 React.useEffect(()=>{
  if(!v2)return;
  // The state is captured once per print: a second beforeprint before afterprint keeps the first capture.
  let opened:HTMLDetailsElement[]|null=null;
  const before=()=>{if(opened)return;opened=[...document.querySelectorAll<HTMLDetailsElement>('.scan-studio details:not([open])')];opened.forEach(d=>{d.open=true;});};
  const after=()=>{if(!opened)return;opened.forEach(d=>{d.open=false;});opened=null;};
  window.addEventListener('beforeprint',before);window.addEventListener('afterprint',after);
  return()=>{window.removeEventListener('beforeprint',before);window.removeEventListener('afterprint',after);};
 },[v2]);
 // The V2 hero's first line is set in the display face: preload it so the swap cannot shift the page (the prerender bakes the tag).
 React.useEffect(()=>{
  if(!v2||document.head.querySelector('link[data-sv2-font]'))return;
  const l=document.createElement('link');l.rel='preload';l.as='font';l.type='font/woff2';l.crossOrigin='anonymous';l.href=import.meta.env.BASE_URL+'studio-fonts/Brico.woff2';l.setAttribute('data-sv2-font','');
  document.head.appendChild(l);
 },[v2]);
 useMetadata({title:team?`${fixture.founder.company||fixture.founder.name}: the short version`:v2?v2Title(fixture):`Turn LinkedIn into booked calls | ${fixture.founder.firstName}`,description:`Content, resources and outreach for ${fixture.founder.company}.`,canonical:`https://inboundonsteroids.com/scan/${fixture.slug}/${team?'team/':''}`,ogImage:fixture.ogImage,noindex:true});
 return <main className="scan-journey scan-studio" id="top">
  {!team&&<a href="#content" className="journey-skip">Skip to your samples</a>}
  <div className="journey-topbar"><a href="#top" className="journey-wordmark" aria-label="InboundOnSteroids">inbound<b>on</b>steroids</a>{v2?<a className="studio-topbar-cta" href={bookUrl(fixture.slug,team?'team-header':'header')} target="_blank" rel="noreferrer" data-scan-click={team?'book-team-header':'book-header'}>Book a call</a>:<a className="studio-topbar-cta" href="https://calendly.com/im-ivanmanfredi/30min">Book a call</a>}</div>
  {team?<V2Guard fallback={<StoryBody fixture={fixture} edition={edition} legacy/>} onFail={fail}><PartnerView fixture={fixture}/></V2Guard>:<StoryBody fixture={fixture} edition={edition} legacy={!v2} onV2Fail={fail}/>}
 </main>;
}

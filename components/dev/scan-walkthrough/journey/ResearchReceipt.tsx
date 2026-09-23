import React from 'react';
import type {JourneyFixture} from './model';
import type {StoryKind} from './connectedModel';
import {useStory} from '../../../scan/story/context';
import {assessAudience} from '../../../scan/story/assessment';
export function ResearchReceipt({fixture}:{fixture:JourneyFixture;kind:StoryKind}) {
 const plan=useStory(),assessment=assessAudience(fixture);
 const canQuote=assessment.state!=='no-posts'&&!!plan.sourceQuote;
 return <aside className="research-receipt" aria-label="Research behind these samples">
  <div><span>{canQuote?'From your own posts':'Your starting point'}</span>{canQuote&&<blockquote>“{plan.sourceQuote}”</blockquote>}<p>{assessment.state==='no-posts'?'These are proposed starting samples. We would build them from your offer, client questions and a conversation about your work.':plan.researchNote}</p><a href={fixture.source.url} target="_blank" rel="noreferrer">Source: your saved scan ↗</a></div>
  <div><span>Who we’d reach</span><dl>{plan.segments.map(s=><div key={s.label}><dt>{s.label}</dt><dd>{s.note}</dd></div>)}</dl><p className="research-filter">We check the company, their role and what they need before suggesting a call.</p></div>
 </aside>;
}

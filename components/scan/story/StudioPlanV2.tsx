import React from 'react';
import {ArrowUpRight} from 'lucide-react';
import {asset, type JourneyFixture} from '../../dev/scan-walkthrough/journey/model';
import type {StoryKind} from '../../dev/scan-walkthrough/journey/connectedModel';
import {ProspectPost, TextPost} from './StudioSamples';
import {EmailCapture} from '../../dev/scan-walkthrough/journey/EmailCapture';
import {StudioResults} from './StudioResults';
import {ProfileAuditSection} from '../../dev/scan-walkthrough/journey/ProfileAudit';
import {useStory} from './context';
import {StoryFlow, readerName, fillName} from './StudioFlow';
import {StudioBrain} from './StudioBrain';
import {ImagePost} from './StudioImagePost';
import {DiagnosisArtifacts} from './DiagnosisArtifacts';
import {GmailNewsletter} from './GmailNewsletter';
import {StepNav, SampleGrid, WarmChat, ColdChat, ResourcePreview, bubbles} from './StudioPlan';
import {HeroBuyer} from './v2/HeroBuyer';
import {BuyersSection} from './v2/BuyersSection';
import {OfferBlock} from './v2/OfferBlock';
import {FoldedChapter} from './v2/FoldedChapter';
import {PeopleStory} from './v2/PeopleStory';
import {bookUrl, pageShape, teamUrl} from './v2/hero';
import {storageImage, withOriginal} from './v2/storageImage';
import {CHAPTERS, CLOSE, PREVIEW, TEAM} from './v2/copy';
import '../../dev/scan-walkthrough/journey/connected.css';
import '../../dev/scan-walkthrough/journey/bold.css';
import '../../dev/scan-walkthrough/journey/studio.css';
import './story-brand.css';
import './story-plan.css';
import './story-motion.css';
import './competitor-engagers.css';
import './v2/scan-v2.css';

const headlineName = (name: string) => { const short = name.split(/\s+[-–|:]\s+/)[0].trim(); return short.length <= 24 ? short : ''; };
const Card = ({label, children}: {label: string; children: React.ReactNode}) => <div className="sv2-pv"><small>{label}</small>{children}</div>;

/** The four steps, each folded behind one tap with one compact visual built from data already on the page. */
function Steps({fixture, kind}: {fixture: JourneyFixture; kind: StoryKind}) {
 const plan = useStory(), rationale = plan.rationale, reader = readerName(plan);
 const brand = headlineName(plan.brand) || 'your brand';
 const cover = plan.coverImage || fixture.lm_cover_local;
 const firstBubble = bubbles(fillName(plan.message, reader))[0] || '';
 return <>
  <FoldedChapter id="content" n={1} label="Content" title={plan.contentHeading} why={rationale?.content ?? plan.contentWhy}
   preview={plan.slides[0] && <Card label={PREVIEW.content}><b>{plan.slides[0].title}</b></Card>}>
   {() => <>{plan.topicMap && <div className="sv2-fold-brain"><StudioBrain map={plan.topicMap} name={fixture.founder.name}/></div>}<SampleGrid cols={3} samples={[
    {key: 'carousel', render: () => <ProspectPost fixture={fixture} kind={kind}/>},
    {key: 'text', render: () => <TextPost fixture={fixture} kind={kind}/>},
    {key: 'image', render: () => <ImagePost fixture={fixture}/>},
   ]}/></>}
  </FoldedChapter>
  <FoldedChapter id="resource" n={2} label={CHAPTERS.resource.label} title={CHAPTERS.resource.title} why={rationale?.resource ?? plan.magnetWhy}
   preview={cover ? <img className="sv2-pv-cover" src={storageImage(cover, 480)} onError={withOriginal(cover)} alt="" width={240} loading="lazy" decoding="async"/> : <Card label={PREVIEW.resource}><b>{plan.resource.title}</b></Card>}>
   {() => <SampleGrid cols={2} samples={[
    {key: 'magnet-post', title: 'The post', hint: plan.keyword ? `One comment, “${plan.keyword}”, and they raise their hand.` : 'One comment and they raise their hand.', render: () => <TextPost fixture={fixture} kind={kind} promotion/>},
    {key: 'signup', title: 'The signup', hint: 'Every download becomes a name you own.', render: () => <EmailCapture kind={kind}/>},
    {key: 'resource', title: 'The lead magnet', hint: `Worth an email address. Built for ${brand}.`, full: true, render: () => <ResourcePreview kind={kind} domain={fixture.domain}/>},
   ]}/>}
  </FoldedChapter>
  <FoldedChapter id="conversations" n={3} label={CHAPTERS.conversations.label} title={CHAPTERS.conversations.title} why={rationale?.conversations ?? CHAPTERS.conversations.why}
   preview={firstBubble && <Card label={PREVIEW.conversations}><p>{firstBubble}</p></Card>}>
   {() => <SampleGrid cols={2} samples={[
    {key: 'warm', title: 'Warm reply', hint: 'They asked for it. We open the conversation.', render: () => <WarmChat/>},
    {key: 'cold', title: 'Signal-based outreach', hint: 'Another way this conversation can start: a buyer with a live project.', render: () => <ColdChat/>},
    {key: 'newsletter', title: 'Newsletter', hint: 'Stays in their inbox until the project is ready.', full: true, render: () => <GmailNewsletter fixture={fixture}/>},
   ]}/>}
  </FoldedChapter>
  <FoldedChapter id="calls" n={4} label={CHAPTERS.calls.label} title={CHAPTERS.calls.title} why={rationale?.calls ?? CHAPTERS.calls.why}
   preview={<Card label={PREVIEW.calls}><b>{plan.flow.callTitle}</b></Card>}>
   {() => <StoryFlow founder={fixture.founder.firstName}/>}
  </FoldedChapter>
 </>;
}

export function StudioPlanV2({fixture, kind}: {fixture: JourneyFixture; kind: StoryKind}) {
 const plan = useStory(), shape = pageShape(fixture.firm), hero = fixture.hero!;
 const profileFirst = hero.tier === 'profile';
 const profile = fixture.profileAudit && <div className="sp-profile" data-scan-section="profile"><ProfileAuditSection audit={fixture.profileAudit}/></div>;
 const buyers = <BuyersSection fixture={fixture}/>;
 const offer = <OfferBlock slug={fixture.slug} shape={shape} compact={shape === 'fast'}/>;
 // Considered (11+ staff): the offer follows the hero. Fast: the compact offer follows the hero, then the buyers.
 // On the profile tier the profile audit comes next to the hero; on the fast shape it sits under the compact offer.
 const top = shape === 'considered'
  ? <>{profileFirst && profile}{offer}{fixture.partnerStory && <PeopleStory story={fixture.partnerStory}/>}{buyers}</>
  : <>{offer}{profileFirst && profile}{buyers}</>;
 return <div className="connected-journey sample-story revenue-story story-plan story-plan-v2">
  <HeroBuyer fixture={fixture}/>
  <StepNav book={bookUrl(fixture.slug, 'nav')} hero=".sv2-hero"/>
  {top}
  {!profileFirst && profile}
  <div id="diagnosis" data-scan-section="diagnosis" style={{scrollMarginTop: 110}}><DiagnosisArtifacts fixture={fixture}/></div>
  <Steps fixture={fixture} kind={kind}/>
  <div id="stories" data-scan-section="stories" style={{scrollMarginTop: 90}}><StudioResults/></div>
  <section className="sp-close" data-scan-section="close">
   <img src={asset('/ivan-portrait-800.webp')} alt="Iván Manfredi" loading="lazy" decoding="async"/>
   <div><span className="close-byline">Iván Manfredi</span><h2>{CLOSE.title}</h2><p>{CLOSE.body}</p>
    <a className="studio-primary sp-close-cta" href={bookUrl(fixture.slug, 'close')} target="_blank" rel="noreferrer" data-scan-click="book-close">{CLOSE.cta} <ArrowUpRight size={18} aria-hidden="true"/></a>
    <small>{CLOSE.note}</small>
    {shape === 'fast' && <a className="sv2-share sv2-close-share" href={teamUrl(fixture.slug)}>{TEAM.share}<ArrowUpRight size={14} aria-hidden="true"/></a>}
   </div>
  </section>
  <footer className="journey-footer"><a href="#top">Back to the start ↑</a></footer>
 </div>;
}

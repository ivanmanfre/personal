import React from 'react';
import {ArrowLeft, Archive, OctagonAlert, Trash2, Mail, MoreVertical, ChevronDown, Star, Reply, Forward} from 'lucide-react';
import type {JourneyFixture} from '../../dev/scan-walkthrough/journey/model';
import {Avatar, Paragraphs} from '../../dev/scan-walkthrough/journey/ReadingChapter';
import {useStory} from './context';
import {readerName, fillName} from './StudioFlow';
import './gmail-newsletter.css';

/** A static Gmail reading view. The message is the scan's own newsletter sample. */
export function GmailNewsletter({fixture}: {fixture: JourneyFixture}) {
 const plan=useStory(), name=readerName(plan);
 return <article className="gmail-preview" data-mockup="email" aria-label="Newsletter sample in Gmail">
  <div className="gmail-appbar" aria-hidden="true">
   <svg className="gmail-mark" viewBox="0 0 24 18"><path fill="#4285f4" d="M0 4v12a2 2 0 0 0 2 2h2V7z"/><path fill="#34a853" d="M20 7v11h2a2 2 0 0 0 2-2V4z"/><path fill="#fbbc04" d="M20 7l4-3V2a2 2 0 0 0-3.2-1.6L20 1z"/><path fill="#ea4335" d="M4 1l8 6 8-6v6l-8 6-8-6z"/><path fill="#c5221f" d="M0 2v2l4 3V1L3.2.4A2 2 0 0 0 0 2z"/></svg>
   <span>Gmail</span>
  </div>
  <div className="gmail-message">
   <div className="gmail-toolbar" aria-hidden="true"><ArrowLeft/><i/><Archive/><OctagonAlert/><Trash2/><i/><Mail/><MoreVertical/></div>
   <header className="gmail-header">
    <h3>{plan.subject}<span className="gmail-inbox-label">Inbox</span></h3>
    <div className="gmail-sender">
     <Avatar src={fixture.founder.avatarUrl} name={fixture.founder.name}/>
     <div className="gmail-sender-name"><b>{fixture.founder.name}</b><small>to {name} <ChevronDown size={12} aria-hidden="true"/></small></div>
     <div className="gmail-sender-tools" aria-hidden="true"><Star/><Reply/><MoreVertical/></div>
    </div>
   </header>
   <div className="gmail-body"><Paragraphs text={fillName(plan.email,name)}/></div>
   <div className="gmail-subscription">You subscribed to {plan.brand}. <span>Unsubscribe</span></div>
   <div className="gmail-reply-actions" aria-hidden="true"><span><Reply/>Reply</span><span><Forward/>Forward</span></div>
  </div>
 </article>;
}

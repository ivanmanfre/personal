import React from 'react';
import { Check, Mail, ArrowDown } from 'lucide-react';
import {useStory} from '../../../scan/story/context';
import type { StoryKind } from './connectedModel';

export function EmailCapture({kind}:{kind:StoryKind}) {
 const plan=useStory(),brand=plan.brand;
 return <section className="capture-bridge" aria-label="Email capture and follow-up example">
  <header><h3>The next reader can join your list.</h3><p>They leave an email to receive the resource and choose whether to get your newsletter. You keep the list.</p></header>
  <div className="capture-example"><article className="signup-example"><span>Example signup</span><b>{plan.magnet}</b><div className="example-email"><Mail size={16}/><span>alex@example.com</span></div><div className="example-consent"><Check size={15}/><span>Yes, send me {plan.newsletterNote} too.</span></div><small>Optional. Unsubscribe at any time.</small></article><ArrowDown className="capture-arrow" aria-hidden="true"/><div className="delivery-sequence"><div><span>Right away</span><b>The resource arrives by email.</b></div><div><span>If they opt in · day 3</span><b>{plan.nurtureNote}</b></div><div><span>For newsletter subscribers</span><b>Useful emails keep the conversation open.</b></div></div></div>
  <footer><span><b>{brand} keeps:</b> the email, the resource requested and the subscription choice.</span><span>Replies go back to the conversation.</span></footer>
 </section>;
}

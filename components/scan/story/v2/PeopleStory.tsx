import React from 'react';
import {ArrowUpRight} from 'lucide-react';
import {asset} from '../../../dev/scan-walkthrough/journey/model';
import {STORIES} from './copy';

/** One people story card, from the results already on the page. Never stretched to fit a prospect. */
export function PeopleStory({story}: {story: keyof typeof STORIES}) {
 const s = STORIES[story];
 return <section className="sv2-story" data-scan-section="stories" aria-label={`What we ran for ${s.name}`}>
  <img src={s.photo.startsWith('http') ? s.photo : asset(s.photo)} alt={s.name} loading="lazy" decoding="async" width={64} height={64}/>
  <div>
   <b>{s.name}</b><span>{s.role}</span>
   <p><strong>{s.metric}</strong> {s.line}</p>
   {s.link && <a href={s.link} target="_blank" rel="noreferrer">{s.linkText}<ArrowUpRight size={15} aria-hidden="true"/></a>}
  </div>
 </section>;
}

import React, { useState } from 'react';
import type { JourneyFixture } from './model';
import { Avatar, Paragraphs } from './ReadingChapter';
import { LinkedInActions } from '../StoryExhibits';

export function ContentChapter({ fixture }: {fixture: JourneyFixture}) {
  const posts = fixture.samples.posts || [];
  const [selected,setSelected] = useState(2);
  const post = posts[selected] || posts[0];
  const labels = ['The interview question', 'The results file', 'Why readers come back', 'The 99-1 rule'];
  return <>
    <div className="sample-toolbar"><label htmlFor="journey-post">Your post samples</label><select id="journey-post" value={selected} onChange={e => setSelected(Number(e.target.value))}>{posts.map((p,i) => <option key={i} value={i}>{labels[i] || p.hook}</option>)}</select></div>
    <article className="journey-post" data-mockup="linkedin">
      <div className="platform-bar"><span><b className="linkedin-mark">in</b> In their feed</span><span>Proposed post</span></div>
      <div className="post-author"><Avatar src={fixture.founder.avatarUrl} name={fixture.founder.name}/><div><b>{fixture.founder.name}</b><span>{fixture.founder.company} · Storytelling & customer research</span><small>Sample · ◉</small></div></div>
      <Paragraphs text={post.body || post.hook}/>
      {post.image_card && <div className="journey-brand-image" data-mockup="cuevu"><div><span>{post.image_card.kicker}</span><b>CueVu</b></div>{post.image_card.figure && <strong className="brand-figure">{post.image_card.figure}</strong>}<h3>{post.image_card.headline}</h3><p>{post.image_card.sub}</p><i aria-hidden="true">↗</i></div>}
      <LinkedInActions/>
    </article>
    {(selected === 1 || selected === 3) && <p className="source-note">Original scan draft. {selected === 1 ? 'The customer story and pilot price need Andrew’s confirmation.' : 'The statistics and study claims need checking before publishing.'}</p>}
    <div className="journey-bridge"><span aria-hidden="true">↓</span><p>They like the idea.<br/><strong>Now, who’s behind it?</strong></p></div>
    <article className="journey-profile" data-mockup="linkedin">
      <div className="profile-cover"><span>CueVu</span><span>Stories start<br/>with people.</span></div>
      <div className="profile-details"><Avatar src={fixture.founder.avatarUrl} name={fixture.founder.name}/><span className="sample-stamp">Profile preview</span><h3>{fixture.founder.name}</h3><p className="sample-body">{fixture.founder.headline}</p><span className="source-note">Headline from the original scan</span>
      <div className="profile-featured"><span className="journey-eyebrow">Featured / proposed</span><a href="#inbound"><span>Your next post starts here.<small>The 99-1 Readiness Score</small></span><b aria-hidden="true">↗</b></a></div></div>
    </article>
  </>;
}

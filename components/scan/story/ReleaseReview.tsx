import React,{useEffect,useState} from 'react';
import {loadFixture} from '../../dev/scan-walkthrough/journey/load';
import type {JourneyFixture} from '../../dev/scan-walkthrough/journey/model';
import {reviewDraft} from './reviewDrafts';
import {validateEdition} from './validate';
import ScanStoryReport from './ScanStoryReport';

const scenarios=['live','zero-buyers','network','no-posts','no-engagement','missing-audit','missing-rubric','invalid-counts','broken-avatar'] as const;
export function applyReviewScenario(f:JourneyFixture,scenario:string):JourneyFixture{
 if(scenario==='live')return f;
 const rubric='Illustrative buyer criteria for a test scenario';
 const base={posts:5,engagers:13,engager_icp_count:0,buyer_definition:rubric,audited_at:f.source.capturedOn};
 const cases:Record<string,JourneyFixture['audience']>={'zero-buyers':base,network:{...base,network_icp_count:6,network_sample:100},'no-posts':{posts:0,engagers:0},'no-engagement':{posts:5,engagers:0},'missing-audit':undefined,'missing-rubric':{posts:5,engagers:13,engager_icp_count:0},'invalid-counts':{...base,engager_icp_count:99}};
 return scenario==='broken-avatar'?{...f,founder:{...f.founder,avatarUrl:'https://example.invalid/avatar.jpg'}}:{...f,audience:cases[scenario]};
}
export default function ReleaseReview(){
 const params=new URLSearchParams(location.search),slug=params.get('slug')||'luiza-vass-8c',scenario=params.get('case')||'live';
 const [fixture,setFixture]=useState<JourneyFixture|null>(null),[error,setError]=useState('');
 useEffect(()=>{let live=true;setFixture(null);setError('');loadFixture(slug).then(f=>{if(live)setFixture(f)}).catch(()=>{if(live)setError('This scan could not be loaded. No sample was substituted.')});return()=>{live=false}},[slug]);
 const result=fixture?validateEdition(reviewDraft(fixture),fixture):null;
 return <>{<aside className="release-review-bar" style={{padding:'12px 20px',background:'#24221f',color:'#fff',font:'13px/1.5 Arial',display:'flex',flexWrap:'wrap',gap:14}}><b>{scenario==='live'?'Release candidate · saved lead data':'TEST SCENARIO · illustrative audit data'}</b><a style={{color:'#fff'}} href="?slug=luiza-vass-8c">Luiza</a><a style={{color:'#fff'}} href="?slug=andrew-hayes-94">Andrew</a><a style={{color:'#fff'}} href="?slug=nerijus-danilevicius-43">Nerijus</a><label>Assessment <select value={scenario} onChange={e=>{location.search=`?slug=${encodeURIComponent(slug)}&case=${e.target.value}`}} style={{color:'#111'}}>{scenarios.map(s=><option key={s}>{s}</option>)}</select></label></aside>}
 {error?<p role="alert">{error}</p>:!fixture?<p role="status">Loading the saved scan…</p>:!result?.edition?<div role="alert" style={{padding:30}}><h1>This scan needs an editorial version.</h1><p>{result?.errors.join(' ')}</p><p>It has not been filled with another lead’s content.</p></div>:<ScanStoryReport review fixture={applyReviewScenario(fixture,scenario)} edition={result.edition}/>}
 </>;
}

import type {JourneyFixture} from '../../dev/scan-walkthrough/journey/model';
export type AssessmentState='buyers'|'network'|'zero-buyers'|'no-posts'|'no-engagement'|'unclassified'|'unavailable';
const count=(x:unknown):x is number=>typeof x==='number'&&Number.isSafeInteger(x)&&x>=0;
export function assessAudience(f:JourneyFixture){
 const a=f.audience, posts=a?.posts, people=a?.engagers, buyers=a?.engager_icp_count;
 const rubric=typeof a?.buyer_definition==='string'?a.buyer_definition.trim():'';
 const readable=!['blocked','error'].includes(a?.audit_status||'');
 const validEngagement=readable&&count(posts)&&count(people)&&(posts>0||people===0);
 const validBuyers=validEngagement&&count(buyers)&&buyers<=people!;
 const network=readable&&count(a?.network_sample)&&a!.network_sample!>0&&count(a?.network_icp_count)&&a!.network_icp_count!<=a!.network_sample!;
 const dateRaw=typeof a?.audited_at==='string'?a.audited_at:typeof f.source.capturedOn==='string'?f.source.capturedOn:'';
 const date=dateRaw&&Number.isFinite(Date.parse(dateRaw))?new Date(dateRaw).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}):null;
 let state:AssessmentState='unavailable';
 if(rubric&&validBuyers&&buyers!>0)state='buyers';
 else if(rubric&&network&&a!.network_icp_count!>0)state='network';
 else if(validEngagement&&posts===0)state='no-posts';
 else if(validEngagement&&people===0)state='no-engagement';
 else if(validEngagement&&people!>0)state=rubric&&validBuyers?'zero-buyers':'unclassified';
 const result={state,date,rubric,posts:validEngagement?posts:null,people:validEngagement?people:null,buyers:rubric&&validBuyers?buyers:null,networkCount:rubric&&network?a!.network_icp_count:null,networkSample:network?a!.network_sample:null};
 const labels:Record<AssessmentState,{heading:string;why:string;receipt:string}>={
  buyers:{heading:`${result.buyers} potential ${result.buyers===1?'buyer already engages':'buyers already engage'} with you.`,why:'Start with the people already showing interest. Check their needs before suggesting a call.',receipt:`${result.buyers} of ${result.people} people matched the recorded buyer criteria across ${result.posts} posts.`},
  network:{heading:`${result.networkCount} potential ${result.networkCount===1?'buyer in':'buyers in'} your network sample.`,why:'Start with relevant connections and check what they need. Content gives them a reason to reply.',receipt:`${result.networkCount} matches among ${result.networkSample} connections checked. This is the sample count, not an estimate of your whole network.`},
  'zero-buyers':{heading:'Reach buyers beyond your current audience.',why:'Lead with useful content and a researched list of people who could buy your service.',receipt:`No buyer matches among ${result.people} people who engaged with ${result.posts} posts. This does not mean you have no buyers elsewhere.`},
  'no-posts':{heading:'Give your next buyer a reason to notice you.',why:'Start with your offer and expertise. Build the first posts and reach relevant buyers directly.',receipt:'No posts were available in the recorded audit sample. This is not a claim that you have never posted.'},
  'no-engagement':{heading:'Get your work in front of the right people.',why:'Build useful posts and reach relevant buyers directly while the audience grows.',receipt:`The audit recorded no engagers across ${result.posts} posts. Your network may still contain relevant buyers.`},
  unclassified:{heading:`${result.people} people engaged. Who could become a client?`,why:'Check who fits your offer. Start conversations that can lead to qualified calls.',receipt:`The scan recorded ${result.people} engagers across ${result.posts} posts. Its buyer classification is not verified for this report.`},
  unavailable:{heading:`Build a path to qualified calls for ${f.founder.company||f.founder.firstName}.`,why:'Start with what you sell, who needs it and useful content that gives them a reason to reply.',receipt:'An audience assessment is not available. The samples below are proposed work; they do not depend on an existing audience.'},
 };
 return {...result,...labels[state]};
}

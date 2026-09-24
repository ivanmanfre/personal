import React,{useState} from 'react';
import {useStory} from '../../../scan/story/context';
import {contrastInk,logoFilter} from '../../../scan/story/brandColors';
import type { StoryKind } from './connectedModel';

/** The keyword belongs on the artwork, matching the lead-magnet post format. */
export function MagnetCover({kind}:{kind:StoryKind}) {
 const plan=useStory(), creative=plan.art==='creative';
 const colors=plan.resource.brand;
 const [logoFailed,setLogoFailed]=useState(false);
 const [imageFailed,setImageFailed]=useState(false);
 if(plan.coverImage&&!imageFailed)return <img className="magnet-cover magnet-cover-image" src={plan.coverImage} alt={`${plan.magnet}. Comment ${plan.keyword} and I’ll send it.`} loading="lazy" onError={()=>setImageFailed(true)}/>;
 const accentInk=contrastInk(colors.accent);
 const titleSize=Math.min(50,540/(Math.max(...plan.cover.lines.map(s=>s.length))*.56));
 const fit=(text:string,width:number,size:number)=>Math.min(size,width/(Math.max(1,text.length)*.56));
 return <svg className={`magnet-cover cover-${kind}`} viewBox="0 0 640 670" style={{fill:colors.ink}} role="img" aria-label={`${plan.brand}. ${plan.cover.lines.join(' ')} Comment ${plan.keyword} and I’ll send it.`}>
   <rect width="640" height="670" fill={colors.surface}/>
   {colors.logo&&!logoFailed ? <image onError={()=>setLogoFailed(true)} style={{filter:logoFilter(colors.logo,colors.surface)}} href={colors.logo} x="36" y="32" width="80" height="40"/> : <text x="36" y="65" fontSize={fit(plan.brand,545,34)} fontWeight="700">{plan.brand}</text>}
   <text x="36" y="149" className="cover-display" style={{fontSize:titleSize}}><tspan x="36">{plan.cover.lines[0]}</tspan><tspan x="36" dy="62">{plan.cover.lines[1]}</tspan></text>
   <g transform="translate(48 266) rotate(-5 150 120)"><rect width="330" height="224" rx="12" fill="#20201e"/><text x="25" y="40" fill="#fffcf5" fontSize={fit(plan.cover.left,280,18)}>{plan.cover.left}</text>{[0,1,2].map((v)=><g key={v} transform={`translate(${25+v*95} 72)`}><rect width="78" height="78" rx="39" fill={['#e6fd9e','#a38bc9','#e8bb9e'][v]}/><path d="M22 68Q39 39 56 68" fill="#20201e"/><circle cx="39" cy="29" r="12" fill="#20201e"/><rect y="96" width="70" height="5" rx="2" fill="#fffcf5" opacity=".6"/></g>)}</g>
   <g transform="translate(336 337) rotate(6 125 86)" fill={accentInk}><rect width="255" height="180" rx="12" fill={colors.accent}/><text x="22" y="38" fontSize={fit(plan.cover.right,211,17)}>{plan.cover.right}</text><path d="M23 64H219M23 76H192" stroke={accentInk} strokeWidth="5" opacity=".3"/><text x="22" y="117" fontSize={fit(plan.cover.details[0],211,16)}>{plan.cover.details[0]}</text><text x="22" y="145" fontSize={fit(plan.cover.details[1],211,16)}>{plan.cover.details[1]}</text></g>
   <rect x="24" y="553" width="592" height="93" rx="16" fill={creative?'#e6fd9e':'#20201e'}/>
   <text x="48" y="591" fontSize="23" fontWeight="700" fill={creative?'#20201e':'#fff'}>Comment {plan.keyword}</text><text x="48" y="622" fontSize="19" fill={creative?'#20201e':'#fff'}>and I’ll send it to you.</text>
   <text x="565" y="612" fontSize="34" fill={creative?'#20201e':'#fff'}>↗</text>
 </svg>;
}

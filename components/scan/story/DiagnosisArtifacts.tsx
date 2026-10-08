import React, {useId, useRef} from 'react';
import {useInView} from 'framer-motion';
import type {JourneyFixture} from '../../dev/scan-walkthrough/journey/model';
import './DiagnosisArtifacts.css';

const AREAS = [
 {key:'content', label:'Content', fallback:'Buyers already know you before the first call.'},
 {key:'inbound', label:'Lead magnets', fallback:'A list of named leads that grows every month.'},
 {key:'outbound', label:'Warm outreach', fallback:'A steady flow of booked calls with buyers who fit.'},
] as const;
type Cell = {today?: string; monthly?: string; result?: string};
type Row = {key: string; label: string; today: string; monthly: string; result: string};

const Receipts = ({text}: {text: string}) => <>{text.split(/(\$?\d+(?:[.,]\d+)*%?)/).map((part, i) => i % 2 ? <b key={i} className="dart-num">{part}</b> : part)}</>;

/** A different silhouette and mechanical action for each kind of work. No invented artifact copy. */
function WorkArtifact({area}: {area: string}) {
 return <svg className={`dart-object dart-object-${area}`} viewBox="0 0 220 124" fill="none" aria-hidden="true">
  {area === 'content' ? <>
   <g className="dart-sheet-back"><path d="M53 22h70v87H53z" fill="#a39c90" stroke="#0f0e0d" strokeWidth="2"/><path d="M63 36h38M63 42h49M63 55h38M63 61h41M63 67h31" stroke="#0f0e0d" strokeWidth="2"/></g>
   <g className="dart-sheet-middle"><path d="M86 13h70v87H86z" fill="#d7cebf" stroke="#0f0e0d" strokeWidth="2"/><path d="M97 26h12v12H97z" fill="#c8361b"/><path d="M116 28h29M116 35h20M97 48h48M97 54h40M97 60h45M97 73h31" stroke="#0f0e0d" strokeWidth="2"/></g>
   <g className="dart-sheet-front"><path d="M116 25h70v87h-70z" fill="#f3efe6" stroke="#0f0e0d" strokeWidth="2"/><path d="M127 38h12v12h-12z" fill="#c8361b"/><path d="M146 40h29M146 47h19" stroke="#0f0e0d" strokeWidth="2"/><path d="M127 60h48M127 66h40M127 72h45" stroke="#7d756a" strokeWidth="2"/><path d="M127 84h48v17h-48z" fill="#c8361b"/><path d="m136 94 7-5 9 6 8-9 7 5" stroke="#f3efe6" strokeWidth="1.5"/></g>
   <path className="dart-print-tick" d="m181 24 6 6 12-14" stroke="#e5502f" strokeWidth="3"/>
  </> : area === 'inbound' ? <>
   <path d="m63 27 48-10 48 19v68l-48 9-48-18z" fill="#171411" stroke="#f3efe6" strokeOpacity=".3"/>
   <g className="dart-resource"><path d="m76 18 68 10v80l-68-10z" fill="#d4c9b8"/><path d="m80 15 68 10v80L80 95z" fill="#f3efe6"/><path d="m69 11 67 10v81L69 92z" fill="#c8361b"/><path d="m69 11-9 4v81l9-4z" fill="#852612"/><path d="m79 27 46 7M79 34l35 5" stroke="#f3efe6" strokeWidth="3"/><path d="m79 45 21 3v26l-21-3z" stroke="#f3efe6" strokeWidth="1.5"/><path d="m104 49 21 3M104 56l21 3M104 63l15 2M79 83l46 7" stroke="#f3efe6" strokeWidth="1.5" opacity=".65"/></g>
   <g className="dart-download"><path d="M152 62h37v39h-37z" fill="#f3efe6" stroke="#0f0e0d" strokeWidth="2"/><path className="dart-download-arrow" d="M170.5 70v18m-6-6 6 6 6-6" stroke="#c8361b" strokeWidth="2.5"/><path d="M161 93h19" stroke="#0f0e0d" strokeWidth="1.5"/></g>
   <path className="dart-download-track" d="M151 111h39" stroke="#e5502f" strokeWidth="2"/>
  </> : <>
   <path d="M44 33h9M44 39h9M44 45h9" stroke="#f3efe6" strokeOpacity=".35"/>
   <g className="dart-message-first"><path d="M59 13h113v46H77L59 70V13Z" fill="#f3efe6"/><path d="M70 24h12v12H70z" fill="#c8361b"/><path d="M90 26h61M90 33h42M70 45h80" stroke="#0f0e0d" strokeWidth="2"/></g>
   <g className="dart-message-reply"><path d="M88 67h105v45l-16-10H88V67Z" fill="#c8361b"/><path d="M99 79h67M99 86h49" stroke="#f3efe6" strokeWidth="2"/><path d="m171 87 3 3 6-6m-2 6 6-6" stroke="#f3efe6" strokeWidth="1.5"/></g>
   <g className="dart-typing" fill="#f3efe6"><rect className="dart-dot-one" x="58" y="85" width="4" height="4"/><rect className="dart-dot-two" x="66" y="85" width="4" height="4"/><rect className="dart-dot-three" x="74" y="85" width="4" height="4"/></g>
  </>}
 </svg>;
}

function ArtifactLane({row, index}: {row: Row; index: number}) {
 const ref = useRef<HTMLLIElement>(null);
 const visible = useInView(ref, {margin: '40px 0px 40px 0px'});
 return <li ref={ref} className={`dart-lane ${visible ? 'is-live' : 'is-paused'}`} style={{'--dart-delay': `${index * -.8}s`} as React.CSSProperties}>
  <div className="dart-cell dart-today">
   <div className="dart-route"><h3 className="dart-name">{row.label}</h3><span className="dart-source" aria-hidden="true"/><span className="dart-wire" aria-hidden="true"/></div>
   <div className="dart-copy"><span className="dart-tag">Today</span><p><Receipts text={row.today}/></p></div>
  </div>
  <div className="dart-cell dart-month">
   <div className="dart-work" aria-hidden="true"><span className="dart-wire"/><WorkArtifact area={row.key}/><span className="dart-wire"/></div>
   <div className="dart-copy"><span className="dart-tag">Every month with us</span><p>{row.monthly}</p></div>
  </div>
  <div className="dart-cell dart-result">
   <div className="dart-arrival" aria-hidden="true"><span className="dart-wire"><i className="dart-signal"/></span><span className="dart-target"/></div>
   <div className="dart-copy"><span className="dart-tag">After 90 days</span><p>{row.result}</p></div>
  </div>
 </li>;
}

export function DiagnosisArtifacts({fixture}: {fixture: JourneyFixture}) {
 const titleId = useId();
 const diagnosis = fixture.diagnosis as Record<string,Cell> | undefined;
 const pillars = fixture.pillars as Record<string,{found?:string;projected?:string}> | undefined;
 const rows: Row[] = AREAS.map(area => {
  const saved = diagnosis?.[area.key];
  const cell: Cell = saved?.today && saved.monthly ? saved : {today:pillars?.[area.key]?.found,monthly:pillars?.[area.key]?.projected};
  return {...area,...cell,result:cell.result || area.fallback};
 }).filter((row): row is typeof row & Row => !!(row.today && row.monthly));
 if (rows.length < 2) return null;
 return <section className="dart" aria-labelledby={titleId}>
  <header className="dart-head"><h2 id={titleId}>Where you are today.<br/>Where this could go.</h2></header>
  <div className="dart-board">
   <div className="dart-band" aria-hidden="true"/>
   <div className="dart-axis" aria-hidden="true"><span>Today</span><span>Every month with us</span><span>After 90 days</span></div>
   <ul className="dart-list">{rows.map((row,i) => <ArtifactLane key={row.key} row={row} index={i}/>)}</ul>
  </div>
 </section>;
}

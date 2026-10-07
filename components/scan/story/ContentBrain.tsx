import React,{useEffect,useId,useRef} from 'react';
import type {ContentBrainMap} from './types';
import {attachContentBrain} from './contentBrainRenderer';
import './contentBrain.css';

/** The graph is the entire preview; provenance stays in the saved map. */
export function ContentBrain({map,name}:{map:ContentBrainMap;name:string}) {
 const canvas=useRef<HTMLCanvasElement>(null),description=useRef<HTMLSpanElement>(null),id=useId();
 useEffect(()=>{if(canvas.current&&description.current)return attachContentBrain(canvas.current,description.current,map,name)},[map,name]);
 return <div className="content-brain"><canvas ref={canvas} tabIndex={0} role="img" aria-label={`Connected content topics for ${name}`} aria-describedby={id}/><span ref={description} id={id} className="content-brain-sr">{map.nodes.filter(n=>n.kind!=='source').map(n=>n.label).join(', ')}</span></div>;
}

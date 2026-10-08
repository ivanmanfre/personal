import React, {useEffect,useId,useRef} from 'react';
import type {ContentBrainMap} from './types';
import {attachContentBrain} from './studioBrainRenderer';
import './contentBrain.css';

export function StudioBrain({map,name}:{map:ContentBrainMap;name:string}) {
 const canvas=useRef<HTMLCanvasElement>(null),description=useRef<HTMLSpanElement>(null),id=useId();
 useEffect(()=>{if(canvas.current&&description.current)return attachContentBrain(canvas.current,description.current,map,name)},[map,name]);
 return <figure className="studio-brain" id="brain" aria-labelledby={`${id}-title`}>
  <figcaption id={`${id}-title`}>Topics from your content</figcaption>
  <div className="content-brain"><canvas ref={canvas} tabIndex={0} role="img" aria-label={`Connected content topics for ${name}`} aria-describedby={id}/><span ref={description} id={id} className="content-brain-sr">{map.nodes.filter(n=>n.kind!=='source').map(n=>n.label).join(', ')}</span></div>
 </figure>;
}

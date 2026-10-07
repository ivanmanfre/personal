import type {ContentBrainMap} from './types';
type Point={x:number;y:number};
type Node=ContentBrainMap['nodes'][number]&{color:string;phase:number;weight:number;screen:Point};
type Edge=Omit<ContentBrainMap['edges'][number],'a'|'b'>&{a:Node;b:Node;index:number;weight:number};
type Label={n:Node;box:Point&{w:number;h:number};size:number;dx:number;dy:number;font:string;bold:string};
const colors=['#476b94','#936348','#78608f','#337d78','#9a5565','#6f7b45'];
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
const font=(size:number,bold=false)=>`${bold?'600':'400'} ${size}px "Schibsted Grotesk",Schibsted,Arial,sans-serif`;

/** One imperative renderer owns its observers, events and animation frame. No frame updates React. */
export function attachContentBrain(canvas:HTMLCanvasElement,description:HTMLElement,data:ContentBrainMap,name:string):()=>void {
 const ctx=canvas.getContext('2d');if(!ctx)return()=>{};
 const palette=new Map(data.nodes.filter(n=>n.kind==='cluster').map((n,i)=>[n.id,colors[i%colors.length]]));
 const nodes:Node[]=data.nodes.map((n,i)=>({...n,color:palette.get(n.group)!,phase:i*2.39996,weight:0,screen:{x:0,y:0}}));
 const byId=new Map(nodes.map(n=>[n.id,n]));
 const edges:Edge[]=data.edges.map((e,i)=>({...e,a:byId.get(e.a)!,b:byId.get(e.b)!,index:i,weight:0}));
 const adjacent=new Map(nodes.map(n=>[n.id,new Set<string>([n.id])]));
 for(const e of edges){adjacent.get(e.a.id)!.add(e.b.id);adjacent.get(e.b.id)!.add(e.a.id)}
 const order=[...nodes].sort((a,b)=>(b.kind==='cluster'?200:0)+b.sourceIds.length*8-((a.kind==='cluster'?200:0)+a.sourceIds.length*8));
 const widths=new Map<string,number>();
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
 let visible=true,disposed=false,raf=0,last=0,time=0,W=0,H=0,ratio=1,active:Node|null=null,selected:Node|null=null,labels:Label[]=[],labelKey='';
 let background='#ffffff',foreground='#393a3c';
 const pointer={x:0,y:0,tx:0,ty:0};const camera={x:0,y:0,k:1,tx:0,ty:0,tk:1};
 let drag:{p:Point;x:number;y:number;moved:boolean;id:number;touch:boolean}|null=null,keyboardIndex=-1;
 const bounds={x0:Math.min(...nodes.map(n=>n.x))-95,x1:Math.max(...nodes.map(n=>n.x))+95,y0:Math.min(...nodes.map(n=>n.y))-85,y1:Math.max(...nodes.map(n=>n.y))+85};
 const centre={x:(bounds.x0+bounds.x1)/2,y:(bounds.y0+bounds.y1)/2};
 const baseDescription=nodes.filter(n=>n.kind!=='source').map(n=>n.label).join(', ');
 const removers:(()=>void)[]=[];
 function on(target:EventTarget,type:string,handler:EventListener,options?:AddEventListenerOptions){target.addEventListener(type,handler,options);removers.push(()=>target.removeEventListener(type,handler,options))}
 function wake(){if(!disposed&&!raf&&visible&&!document.hidden&&W>0&&H>0)raf=requestAnimationFrame(draw)}
 function stop(){if(raf)cancelAnimationFrame(raf);raf=0;last=0}
 function resize(){if(disposed)return;W=canvas.parentElement!.clientWidth;H=canvas.parentElement!.clientHeight;ratio=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(W*ratio);canvas.height=Math.round(H*ratio);labelKey='';const style=getComputedStyle(canvas);background=style.getPropertyValue('--background').trim();
  if(!background){for(let element:HTMLElement|null=canvas;element;element=element.parentElement){const color=getComputedStyle(element).backgroundColor;if(color&&color!=='transparent'&&(!color.startsWith('rgba(')||Number(color.slice(color.lastIndexOf(',')+1,-1))===1)){background=color;break}}}
  background=background||'#ffffff';foreground=style.getPropertyValue('--foreground').trim()||style.getPropertyValue('--sg-ink').trim()||'#393a3c';wake()}
 function project(n:Node):Point {const depth=n.kind==='cluster'?.35:n.kind==='source'?.55:.75,drift=reduced.matches?0:Math.sin(time*.2+n.phase)*1.5;return{x:W/2+(n.x-centre.x)*(W-26)/(bounds.x1-bounds.x0)*camera.k+camera.x+pointer.x*depth+drift,y:H/2+(n.y-centre.y)*(H-68)/(bounds.y1-bounds.y0)*camera.k+camera.y+pointer.y*depth+drift*.5}}
 function connected(n:Node){return !!active&&(adjacent.get(active.id)!.has(n.id)||(active.kind==='cluster'&&n.group===active.id))}
 function setActive(n:Node|null){if(active!==n){active=n;wake()}}
 function announce(){canvas.setAttribute('aria-label',selected?`${selected.label}. Connected content topics for ${name}`:`Connected content topics for ${name}`);description.textContent=selected?`${selected.label}. Connected subjects: ${nodes.filter(n=>n!==selected&&connected(n)).map(n=>n.label).join(', ')}. ${baseDescription}`:baseDescription}
 function measure(text:string,f:string){const key=f+text;let width=widths.get(key);if(width===undefined){ctx!.font=f;width=ctx!.measureText(text).width;widths.set(key,width)}return width}
 function placeLabels(){labels=[];const cap=W<500?30:W<900?47:65;
  for(const n of order){if(labels.length>=cap)break;const p=n.screen;if(p.x<0||p.x>W||p.y<0||p.y>H)continue;
   const size=n.kind==='cluster'?(W<500?14:17):n.kind==='source'?11:W<500?11:12,f=font(size,n.kind==='cluster'),width=measure(n.label,f)+10,height=size+7;if(width>W-16)continue;
   const offsets=n.kind==='cluster'?[[0,-25],[0,24],[width/2+12,0],[-width/2-12,0],[0,-42],[0,42],[width/2+12,-35],[-width/2-12,35]]:[[width/2+9,0],[-width/2-9,0],[0,18],[0,-18],[width/2+11,22],[-width/2-11,-22],[0,35],[0,-35]];
   for(const [dx,dy] of offsets){const box={x:p.x+dx-width/2,y:p.y+dy-height/2,w:width,h:height};if(box.x<5||box.x+width>W-5||box.y<10||box.y+height>H-10||labels.some(l=>box.x<l.box.x+l.box.w+4&&box.x+box.w+4>l.box.x&&box.y<l.box.y+l.box.h+3&&box.y+box.h+3>l.box.y))continue;
    if(n.kind!=='cluster'&&nodes.some(other=>other!==n&&other.screen.x>box.x-2&&other.screen.x<box.x+width+2&&other.screen.y>box.y-2&&other.screen.y<box.y+height+2))continue;
    labels.push({n,box,size,dx,dy,font:f,bold:font(size,true)});break;
   }
  }
 }
 function curve(e:Edge,t:number):Point {const a=e.a.screen,b=e.b.screen,dx=b.x-a.x,dy=b.y-a.y,d=Math.max(1,Math.hypot(dx,dy)),bend=Math.sin(e.index*1.7)*12;return{x:lerp(a.x,b.x,t)-dy/d*Math.sin(t*Math.PI)*bend,y:lerp(a.y,b.y,t)+dx/d*Math.sin(t*Math.PI)*bend}}
 function draw(now:number){raf=0;if(disposed||!visible||document.hidden)return;const dt=Math.min(40,last?now-last:16);last=now;if(!reduced.matches)time+=dt/1000;const q=reduced.matches?1:1-Math.exp(-dt/110);
  pointer.x=lerp(pointer.x,pointer.tx,q);pointer.y=lerp(pointer.y,pointer.ty,q);camera.x=lerp(camera.x,camera.tx,q);camera.y=lerp(camera.y,camera.ty,q);camera.k=lerp(camera.k,camera.tk,q);
  ctx!.setTransform(ratio,0,0,ratio,0,0);ctx!.clearRect(0,0,W,H);
  for(const n of nodes){n.screen=project(n);n.weight=lerp(n.weight,connected(n)?1:0,q)}
  for(const e of edges){const focus=!!active&&(e.a===active||e.b===active||(active.kind==='cluster'&&e.a.group===active.id&&e.b.group===active.id));e.weight=lerp(e.weight,focus?1:0,q);const a=e.a.screen;
   ctx!.strokeStyle=e.weight>.05?(active?.color||e.a.color):e.a.color;ctx!.globalAlpha=active?lerp(.095,.72,e.weight):e.kind==='shared-source'?.32:e.kind==='group'?.27:.19;ctx!.lineWidth=lerp(.7,1.35,e.weight);ctx!.beginPath();ctx!.moveTo(a.x,a.y);for(let j=1;j<=10;j++){const p=curve(e,j/10);ctx!.lineTo(p.x,p.y)}ctx!.stroke();
   if(!reduced.matches&&(e.index%19===0||e.weight>.5)){const p=curve(e,(time*.085+e.index*.19)%1);ctx!.globalAlpha=active?lerp(.06,.7,e.weight):.42;ctx!.fillStyle=ctx!.strokeStyle;ctx!.beginPath();ctx!.arc(p.x,p.y,1.2+e.weight*.5,0,Math.PI*2);ctx!.fill()}
  }
  for(const n of nodes){const p=n.screen,r=n.kind==='cluster'?5.5:n.kind==='source'?2.8:2+Math.min(1.4,n.sourceIds.length*.28);ctx!.globalAlpha=active?lerp(.4,1,n.weight):1;ctx!.fillStyle=n.color;
   if(n.kind==='cluster'||n.weight>.6){ctx!.globalAlpha*=.085;ctx!.beginPath();ctx!.arc(p.x,p.y,r+10+n.weight*3,0,Math.PI*2);ctx!.fill();ctx!.globalAlpha=active?lerp(.4,1,n.weight):1}
   ctx!.beginPath();ctx!.arc(p.x,p.y,r+n.weight*1.2,0,Math.PI*2);ctx!.fill();ctx!.globalAlpha=.7;ctx!.fillStyle=background;ctx!.beginPath();ctx!.arc(p.x-r*.18,p.y-r*.2,r*.25,0,Math.PI*2);ctx!.fill();
  }
  const key=[W,H,Math.round(camera.k*15),Math.round(camera.x/18),Math.round(camera.y/18)].join(':');if(key!==labelKey){placeLabels();labelKey=key}
  ctx!.textAlign='center';ctx!.textBaseline='middle';
  for(const l of labels){const n=l.n,p=n.screen,x=p.x+l.dx,y=p.y+l.dy,alpha=active?lerp(n.kind==='cluster'?.65:.47,1,n.weight):n.kind==='source'?.69:1;ctx!.globalAlpha=alpha*.94;ctx!.fillStyle=background;ctx!.fillRect(x-l.box.w/2,y-l.box.h/2,l.box.w,l.box.h);ctx!.globalAlpha=alpha;ctx!.fillStyle=n.kind==='cluster'||n.weight>.4?n.color:foreground;ctx!.font=n.kind==='cluster'||n===active?l.bold:l.font;ctx!.fillText(n.label,x,y)}
  if(active&&!labels.some(l=>l.n===active)){const f=font(13,true),w=measure(active.label,f)+12,x=clamp(active.screen.x,w/2+5,W-w/2-5),y=clamp(active.screen.y-23,16,H-16);ctx!.font=f;ctx!.globalAlpha=.97;ctx!.fillStyle=background;ctx!.fillRect(x-w/2,y-11,w,22);ctx!.globalAlpha=1;ctx!.fillStyle=active.color;ctx!.fillText(active.label,x,y)}ctx!.globalAlpha=1;
  const unsettled=Math.abs(camera.x-camera.tx)+Math.abs(camera.y-camera.ty)+Math.abs(camera.k-camera.tk)+Math.abs(pointer.x-pointer.tx)+Math.abs(pointer.y-pointer.ty)>.01;
  if(!reduced.matches||unsettled)wake();
 }
 function position(e:MouseEvent):Point{const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}}
 function pick(p:Point):Node|null {const label=labels.find(l=>Math.abs(p.x-(l.n.screen.x+l.dx))<l.box.w/2&&Math.abs(p.y-(l.n.screen.y+l.dy))<l.box.h/2);if(label)return label.n;let result:Node|null=null,distance=18;for(const n of nodes){const d=Math.hypot(n.screen.x-p.x,n.screen.y-p.y);if(d<distance){distance=d;result=n}}return result}
 function release(){if(drag&&canvas.hasPointerCapture?.(drag.id))canvas.releasePointerCapture(drag.id);drag=null}
 function reset(){camera.tx=camera.ty=0;camera.tk=1;selected=null;setActive(null);announce();wake()}
 on(canvas,'pointermove',((e:PointerEvent)=>{const p=position(e);if(e.pointerType==='touch'){if(drag&&Math.hypot(p.x-drag.p.x,p.y-drag.p.y)>5)drag.moved=true;return}pointer.tx=reduced.matches?0:(p.x/W-.5)*10;pointer.ty=reduced.matches?0:(p.y/H-.5)*8;if(drag){camera.tx=clamp(drag.x+p.x-drag.p.x,-W*.7,W*.7);camera.ty=clamp(drag.y+p.y-drag.p.y,-H*.7,H*.7);drag.moved=drag.moved||Math.hypot(p.x-drag.p.x,p.y-drag.p.y)>5}else setActive(pick(p)||selected);wake()}) as EventListener);
 on(canvas,'pointerleave',()=>{pointer.tx=pointer.ty=0;setActive(selected);wake()});
 on(canvas,'pointerdown',((e:PointerEvent)=>{if(e.button!==0)return;drag={p:position(e),x:camera.tx,y:camera.ty,moved:false,id:e.pointerId,touch:e.pointerType==='touch'};if(!drag.touch)canvas.setPointerCapture?.(e.pointerId)}) as EventListener);
 on(canvas,'pointerup',((e:PointerEvent)=>{if(drag&&!drag.moved){const n=pick(position(e));selected=selected===n?null:n;setActive(selected);announce()}release();wake()}) as EventListener);
 on(canvas,'pointercancel',release);on(canvas,'lostpointercapture',()=>{drag=null});
 // Page scrolling is the default. A selected subject makes wheel zoom deliberate.
 on(canvas,'wheel',((e:WheelEvent)=>{if(!selected||e.ctrlKey||e.metaKey||!e.deltaY)return;const p=position(e),old=camera.tk,k=clamp(old*Math.exp(-clamp(e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?H:1),-100,100)*.002),1,2.8);if(k===old)return;e.preventDefault();camera.tx=(camera.tx-(p.x-W/2))*k/old+(p.x-W/2);camera.ty=(camera.ty-(p.y-H/2))*k/old+(p.y-H/2);camera.tk=k;if(k===1)camera.tx=camera.ty=0;setActive(selected);wake()}) as EventListener,{passive:false});
 on(canvas,'dblclick',reset);
 on(canvas,'keydown',((e:KeyboardEvent)=>{if(e.key==='Escape'||e.key==='Home'){e.preventDefault();reset()}else if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();keyboardIndex=(keyboardIndex+(e.key==='ArrowRight'?1:-1)+nodes.length)%nodes.length;selected=nodes[keyboardIndex];setActive(selected);announce();wake()}else if(e.key==='Enter'||e.key===' '){e.preventDefault();selected=selected?null:active||nodes[0];setActive(selected);announce();wake()}}) as EventListener);
 const ro=new ResizeObserver(resize);ro.observe(canvas.parentElement!);
 const io=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;if(visible){last=0;wake()}else stop()});io.observe(canvas);
 on(document,'visibilitychange',()=>{if(document.hidden)stop();else{last=0;wake()}});
 on(reduced,'change',()=>{pointer.tx=pointer.ty=0;labelKey='';wake()});
 const fontsChanged=()=>{if(disposed)return;widths.clear();labelKey='';wake()};
 if(document.fonts){on(document.fonts,'loadingdone',fontsChanged);void document.fonts.ready.then(fontsChanged)}
 resize();
 return()=>{disposed=true;stop();release();ro.disconnect();io.disconnect();removers.forEach(remove=>remove())};
}

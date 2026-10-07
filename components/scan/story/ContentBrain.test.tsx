// @vitest-environment jsdom
import React,{StrictMode} from 'react';
import {render,fireEvent,cleanup} from '@testing-library/react';
import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import {ContentBrain} from './ContentBrain';
import type {ContentBrainMap} from './types';
const graph:ContentBrainMap={version:1,sourceFingerprint:'saved',sources:[{id:'s',kind:'LinkedIn',label:'Post'}],nodes:[{id:'c',kind:'cluster',group:'c',label:'Expertise',x:0,y:0,sourceIds:['s']},{id:'t',kind:'topic',group:'c',label:'Specific topic',x:100,y:50,sourceIds:['s']}],edges:[{a:'c',b:'t',kind:'group',sourceIds:['s']}]};
let frames:Map<number,FrameRequestCallback>,next:number,reduced:boolean,observers:{disconnect:ReturnType<typeof vi.fn>;callback:Function}[],media:EventTarget;
beforeEach(()=>{
 frames=new Map();next=0;reduced=false;observers=[];media=new EventTarget();
 vi.stubGlobal('requestAnimationFrame',(fn:FrameRequestCallback)=>{frames.set(++next,fn);return next});
 vi.stubGlobal('cancelAnimationFrame',(id:number)=>frames.delete(id));
 vi.stubGlobal('matchMedia',()=>Object.assign(media,{matches:reduced}));
 class Observer {disconnect=vi.fn();constructor(public callback:Function){observers.push(this)}observe(){} }
 vi.stubGlobal('ResizeObserver',Observer);vi.stubGlobal('IntersectionObserver',Observer);
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(new Proxy({measureText:(text:string)=>({width:text.length*6})},{get:(o,k)=>k in o?o[k as keyof typeof o]:()=>{}}) as any);
 vi.spyOn(HTMLElement.prototype,'clientWidth','get').mockReturnValue(900);vi.spyOn(HTMLElement.prototype,'clientHeight','get').mockReturnValue(620);
});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals()});
const frame=()=>{const entry=frames.entries().next().value;if(entry){frames.delete(entry[0]);entry[1](16)}};
describe('content brain lifecycle and interaction',()=>{
 it('draws only the canvas and hidden descriptions; clears all loops and observers across StrictMode mounts',async()=>{
  const add=vi.spyOn(EventTarget.prototype,'addEventListener'),remove=vi.spyOn(EventTarget.prototype,'removeEventListener');
  const view=render(<StrictMode><ContentBrain map={graph} name="Alex"/></StrictMode>);await Promise.resolve();
  expect(view.container.querySelectorAll('canvas')).toHaveLength(1);expect(view.container.querySelector('button,a,h2,nav')).toBeNull();
  expect(frames.size).toBe(1);frame();expect(frames.size).toBe(1);view.unmount();await Promise.resolve();expect(frames.size).toBe(0);expect(observers.every(o=>o.disconnect.mock.calls.length===1)).toBe(true);
  for(let i=0;i<add.mock.calls.length;i++){const target=add.mock.instances[i],call=add.mock.calls[i];if(target instanceof HTMLCanvasElement||(target===document&&call[0]==='visibilitychange')||target===media)expect(remove.mock.calls.some((r,j)=>remove.mock.instances[j]===target&&r[0]===call[0]&&r[1]===call[1])).toBe(true)}
  media.dispatchEvent(new Event('change'));document.dispatchEvent(new Event('visibilitychange'));expect(frames.size).toBe(0);
 });
 it('settles reduced motion, suspends offscreen, and resumes when visible',()=>{
  reduced=true;render(<ContentBrain map={graph} name="Alex"/>);frame();expect(frames.size).toBe(0);
  const io=observers[1];io.callback([{isIntersecting:false}]);expect(frames.size).toBe(0);io.callback([{isIntersecting:true}]);expect(frames.size).toBe(1);frame();expect(frames.size).toBe(0);
 });
 it('matches label knockouts to the nearest painted ancestor and uses scan ink',()=>{
  const backgrounds:string[]=[],textColors:string[]=[];
  const context=new Proxy({fillStyle:'',measureText:(text:string)=>({width:text.length*6}),fillRect(){backgrounds.push(this.fillStyle)},fillText(){textColors.push(this.fillStyle)}},{get:(o,k)=>k in o?o[k as keyof typeof o]:()=>{}});
  vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(context as any);
  const view=render(<div style={{backgroundColor:'rgb(251, 250, 247)'}}><ContentBrain map={graph} name="Alex"/></div>);
  const canvas=view.getByRole('img');canvas.style.setProperty('--sg-ink','#131210');observers[0].callback();frame();
  expect(backgrounds.length).toBeGreaterThan(0);expect(backgrounds.every(color=>color==='rgb(251, 250, 247)')).toBe(true);expect(textColors).toContain('#131210');
 });
 it('pauses while the document is hidden',()=>{
  render(<ContentBrain map={graph} name="Alex"/>);expect(frames.size).toBe(1);
  const hidden=vi.spyOn(document,'hidden','get').mockReturnValue(true);document.dispatchEvent(new Event('visibilitychange'));expect(frames.size).toBe(0);
  hidden.mockReturnValue(false);document.dispatchEvent(new Event('visibilitychange'));expect(frames.size).toBe(1);
 });
 it('distinguishes a vertical touch scroll from a topic tap',()=>{
  const {getByRole}=render(<ContentBrain map={graph} name="Alex"/>);frame();const canvas=getByRole('img');
  const touch=(type:string,y:number)=>{const e=new MouseEvent(type,{clientX:299,clientY:y,button:0,bubbles:true});Object.defineProperties(e,{pointerType:{value:'touch'},pointerId:{value:1}});fireEvent(canvas,e)};
  touch('pointerdown',247);touch('pointermove',270);touch('pointerup',270);expect(canvas.getAttribute('aria-label')).toBe('Connected content topics for Alex');
  touch('pointerdown',247);touch('pointerup',247);expect(canvas.getAttribute('aria-label')).toContain('Expertise');
 });
 it('allows page wheel scrolling until deliberately selected with keyboard',()=>{
  const {getByRole}=render(<ContentBrain map={graph} name="Alex"/>);frame();const canvas=getByRole('img');
  expect(fireEvent.wheel(canvas,{deltaY:50,cancelable:true})).toBe(true);
  fireEvent.keyDown(canvas,{key:'ArrowRight'});expect(canvas.getAttribute('aria-label')).toContain('Expertise');
  expect(fireEvent.wheel(canvas,{deltaY:50,cancelable:true})).toBe(true);
  expect(fireEvent.wheel(canvas,{deltaY:-50,cancelable:true})).toBe(false);
  fireEvent.keyDown(canvas,{key:'Escape'});expect(fireEvent.wheel(canvas,{deltaY:50,cancelable:true})).toBe(true);
 });
});

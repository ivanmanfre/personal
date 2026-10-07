import {describe,it,expect} from 'vitest';
import rows from './__fixtures__/review-rows.json';
import {toStoryFixture} from './adapter';
import {reviewDraft} from './reviewDrafts';
import {validateEdition} from './validate';

const fixture=toStoryFixture(rows[0]);
const edition=reviewDraft(fixture)!;
const map=()=>({version:1,sourceFingerprint:'saved-source-v1',sources:[{id:'s',kind:'LinkedIn',label:'Public post'}],nodes:[{id:'c',kind:'cluster',label:'Expertise',group:'c',x:0,y:0,sourceIds:['s']},{id:'t',kind:'topic',label:'A specific subject',group:'c',x:50,y:20,sourceIds:['s']}],edges:[{a:'c',b:'t',kind:'group',sourceIds:['s']}]});
const check=(topicMap:unknown)=>validateEdition({...edition,topicMap},fixture);
describe('optional content graph',()=>{
 it('preserves an edition with no graph',()=>{const result=validateEdition(edition,fixture);expect(result.errors).toEqual([]);expect(result.edition).toEqual(edition)});
 it('preserves a complete evidence-backed map',()=>{const graph=map();expect(check(graph).edition?.topicMap).toEqual(graph)});
 it.each([
 ['unsupported version',(g:any)=>g.version=2],
 ['missing fingerprint',(g:any)=>g.sourceFingerprint=''],
 ['duplicate nodes',(g:any)=>g.nodes.push({...g.nodes[0]})],
 ['duplicate sources',(g:any)=>g.sources.push({...g.sources[0]})],
 ['nonfinite position',(g:any)=>g.nodes[1].x=Infinity],
 ['unknown group',(g:any)=>g.nodes[1].group='missing'],
 ['group is not a cluster',(g:any)=>g.nodes[1].group='t'],
 ['unknown node source',(g:any)=>g.nodes[1].sourceIds=['missing']],
 ['empty node provenance',(g:any)=>g.nodes[1].sourceIds=[]],
 ['unknown edge source',(g:any)=>g.edges[0].sourceIds=['missing']],
 ['empty edge provenance',(g:any)=>g.edges[0].sourceIds=[]],
 ['unknown edge endpoint',(g:any)=>g.edges[0].b='missing'],
 ['oversize label',(g:any)=>g.nodes[1].label='a'.repeat(201)],
 ['unsafe URL',(g:any)=>g.sources[0].url='javascript:alert(1)'],
 ['too many nodes',(g:any)=>g.nodes=Array.from({length:121},(_,i)=>({...g.nodes[1],id:'n'+i}))],
 ['too many edges',(g:any)=>g.edges=Array.from({length:401},()=>g.edges[0])],
 ['null map',()=>null],
 ])('omits %s without invalidating the edition',(_,mutate)=>{const graph=map();const value=mutate(graph)===null?null:graph;const result=check(value);expect(result.errors).toEqual([]);expect(result.edition).not.toBeNull();expect(result.edition).not.toHaveProperty('topicMap')});
 it('does not mutate the stored edition while dropping an invalid graph',()=>{const raw={...edition,topicMap:{version:2}};validateEdition(raw,fixture);expect(raw).toHaveProperty('topicMap')});
});

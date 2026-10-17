import { describe,it,expect } from 'vitest';
import { mentionsInText, mentionParts, openCommentThreads } from './commentMentions';
const jon={email:'jon@example.invalid',label:'Jonathan Kiekbusch'};
const ann={email:'ann@example.invalid',label:'Ann'};
describe('selected board mentions',()=>{
 it('keeps selected names only while their complete tag remains in the comment',()=>{
  expect(mentionsInText('@Jonathan Kiekbusch please check.',[jon])).toEqual([jon]);
  expect(mentionsInText('@Jonathan Kiek',[jon])).toEqual([]);
  expect(mentionsInText('@Anna please check',[ann])).toEqual([]);
  expect(mentionsInText('me@Ann',[ann])).toEqual([]);
 });
 it('highlights repeated complete tags and leaves unselected names as text',()=>{
  const parts=mentionParts('@Ann, ask @Jonathan Kiekbusch. Thanks @Ann!',[ann]);
  expect(parts.filter(p=>p.mention).map(p=>p.text)).toEqual(['@Ann','@Ann']);
  expect(parts.map(p=>p.text).join('')).toBe('@Ann, ask @Jonathan Kiekbusch. Thanks @Ann!');
 });
});
describe('open feedback counts',()=>{
 it('counts root threads once, includes mentions in replies and excludes resolved threads',()=>{
  const rows:any[]=[{id:'root',ref:'p',parent:null,text:'a'},{id:'reply',ref:'p',parent:'root',text:'b',mentions:[jon]},{id:'done',ref:'p',parent:null,text:'c',resolved_at:'2026-10-17T10:00:00Z',mentions:[jon]},{id:'else',ref:'q',parent:null,text:'d'},{id:'orphan',ref:'p',parent:'missing',mentions:[jon]}];
  expect(openCommentThreads(rows,'p','jon@example.invalid')).toEqual({open:1,mentioned:1});
  expect(openCommentThreads(rows,'q','jon@example.invalid')).toEqual({open:1,mentioned:0});
 });
});

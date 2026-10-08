import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,it,expect} from 'vitest';
import rows from './__fixtures__/review-rows.json';
import {toStoryFixture} from './adapter';
import {reviewDraft} from './reviewDrafts';
import {validateEdition} from './validate';
import {StoryBody} from './ScanStoryReport';

const fixture=toStoryFixture(rows[0]), raw={...reviewDraft(fixture),reviewStatus:'approved'};
describe('Studio production contract',()=>{
 it('accepts existing editions without rationale',()=>expect(validateEdition(raw,fixture,true).errors).toEqual([]));
 it('keeps personalized rationale bound to the prospect',()=>{
  const edition={...raw,rationale:{content:'Advice for this specific buyer.'}};
  expect(validateEdition(edition,fixture,true).edition?.rationale?.content).toBe('Advice for this specific buyer.');
  expect(validateEdition({...edition,slug:'another-person'},fixture,true).edition).toBeNull();
 });
 it('rejects malformed rationale and unapproved editions',()=>{
  expect(validateEdition({...raw,rationale:{content:42}},fixture,true).edition).toBeNull();
  expect(validateEdition({...raw,reviewStatus:'draft'},fixture,true).edition).toBeNull();
 });
 it('renders the approved default without browser query switches or a required graph',()=>{
  const edition=validateEdition(raw,fixture,true).edition!;
  const html=renderToStaticMarkup(<StoryBody fixture={fixture} edition={edition}/>);
  expect(html).toContain('See your scale plan');expect(html).toContain('gmail-preview');
  expect(html).not.toContain('What stood out');expect(html).not.toContain('Hatim');
 });
});

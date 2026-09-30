import {describe,it,expect} from 'vitest';
import rows from './__fixtures__/review-rows.json';
import {toStoryFixture} from './adapter';
import {reviewDraft} from './reviewDrafts';
import {validateEdition} from './validate';

const f=toStoryFixture(rows[0]),draft=reviewDraft(f);
const withResource=(options:any[])=>({...draft,resource:{...draft.resource,mode:'assessment',options}});
const option={label:'Assessment',title:'Pipeline Risk Score',premise:'Scores how exposed the pipeline is to one referral source drying up.'};

describe('assessment lead magnet',()=>{
 it('accepts a premise before the server publishes the assessment',()=>expect(validateEdition(withResource([option]),f).errors).toEqual([]));
 it('accepts the published reference',()=>expect(validateEdition(withResource([{...option,assessment:{slug:'x-1-assessment',categories:['Sources','Follow-up'],questions:14}}]),f).errors).toEqual([]));
 it('rejects a missing premise',()=>expect(validateEdition(withResource([{label:'Assessment',title:'Score'}]),f).errors).toContain('Assessment needs its premise.'));
 it('rejects a malformed reference',()=>expect(validateEdition(withResource([{...option,assessment:{slug:'Bad Slug',categories:[],questions:1.5}}]),f).errors).toContain('Invalid assessment reference.'));
});

import {describe,it,expect} from 'vitest';
import * as copy from './copy';

/** Every string the module can produce, functions called with sample arguments. */
function strings(x:unknown,out:string[]=[]):string[]{
 if(typeof x==='string')out.push(x);
 else if(typeof x==='function')strings((x as (...a:string[])=>unknown)('Sample Name','12 Nov'),out),strings((x as (...a:unknown[])=>unknown)(12,3),out);
 else if(Array.isArray(x))x.forEach(v=>strings(v,out));
 else if(x&&typeof x==='object')Object.values(x).forEach(v=>strings(v,out));
 return out;
}
describe('fixed copy',()=>{
 const all=strings(copy);
 it('has copy to check',()=>expect(all.length).toBeGreaterThan(30));
 it.each(all)('%s',s=>{
  expect(s).not.toMatch(/[—–]/);
  expect(s).not.toMatch(/\bnot just\b/i);
  expect(s).not.toMatch(/, not /);
  expect(s).not.toMatch(/isn['’]t [^.]*\. It['’]s/);
 });
 it('price line carries the public price',()=>expect(copy.OFFER.price).toContain('$3,000'));
 it("keeps Ivan's line word for word",()=>expect(copy.BRAND_LINE).toBe('Make your LinkedIn into a true revenue line.'));
});

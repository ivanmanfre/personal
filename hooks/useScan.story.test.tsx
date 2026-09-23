// @vitest-environment jsdom
import {describe,it,expect,vi,beforeEach} from 'vitest';
import {renderHook,waitFor,act} from '@testing-library/react';
const pending=vi.hoisted(()=>[] as Array<(x:any)=>void>);
vi.mock('../lib/supabase',()=>({supabase:{from:()=>({select:()=>({eq:()=>({eq:()=>({maybeSingle:()=>new Promise(resolve=>pending.push(resolve))})})})})}}));
import {useScan} from './useScan';
describe('scan identity while navigating',()=>{
 beforeEach(()=>pending.splice(0));
 it('clears the prior lead on a missing or failed next lookup',async()=>{
  const {result,rerender}=renderHook(({slug})=>useScan(slug),{initialProps:{slug:'lead-a'}});
  await act(async()=>pending.shift()!({data:{company_slug:'lead-a'},error:null}));
  expect(result.current.scan?.company_slug).toBe('lead-a');
  rerender({slug:'lead-b'});expect(result.current.scan).toBeNull();
  await act(async()=>pending.shift()!({data:null,error:null}));await waitFor(()=>expect(result.current.loading).toBe(false));expect(result.current.scan).toBeNull();
  rerender({slug:'lead-c'});await act(async()=>pending.shift()!({data:null,error:{message:'Unavailable'}}));expect(result.current.error).toBe('Unavailable');expect(result.current.scan).toBeNull();
 });
 it('ignores late responses from another lead',async()=>{
  const {result,rerender}=renderHook(({slug})=>useScan(slug),{initialProps:{slug:'lead-a'}});const a=pending.shift()!;
  rerender({slug:'lead-b'});const b=pending.shift()!;
  await act(async()=>b({data:{company_slug:'lead-b'},error:null}));await act(async()=>a({data:{company_slug:'lead-a'},error:null}));
  expect(result.current.scan?.company_slug).toBe('lead-b');
 });
});

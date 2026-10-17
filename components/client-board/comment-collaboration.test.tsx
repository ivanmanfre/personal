// @vitest-environment jsdom
import React from 'react';
import { afterEach,it,expect,vi } from 'vitest';
import { render,fireEvent,cleanup,waitFor } from '@testing-library/react';
import { BoardTeamProvider,PostComments,type BoardTeamValue,type BoardComment } from './team';
import BatchReviewOverview from './BatchReviewOverview';
afterEach(cleanup);
const root:BoardComment={id:'c1',ref:'post',at:'2026-10-17T10:00:00Z',by:'jon@example.invalid',text:'@Lyndsay K tighten the hook?',parent:null,mentions:[{email:'lyndsay@example.invalid',label:'Lyndsay K'}]};
const value=(over:Partial<BoardTeamValue>={}):BoardTeamValue=>({me:'lyndsay@example.invalid',comments:[root],members:[{email:'lyndsay@example.invalid',name:'Lyndsay K'}],approvalMeta:{},canComment:true,canApprove:true,addComment:async()=>({ok:true}),resolveComment:async()=>({ok:true}),...over});
it('highlights real mentions, resolves a thread and retains it for reopening',async()=>{
 function Harness(){const [comments,setComments]=React.useState([root]);return <BoardTeamProvider value={value({comments,resolveComment:async(id,resolved)=>{setComments(rows=>rows.map(c=>c.id===id?{...c,resolved_at:resolved?'2026-10-17T12:00:00Z':null,resolved_by:resolved?'lyndsay@example.invalid':null}:c));return {ok:true};}})}><PostComments refId="post" /></BoardTeamProvider>;}
 const r=render(<Harness/>);expect(r.container.querySelector('[data-comment-mention]')?.textContent).toBe('@Lyndsay K');
 fireEvent.click(r.getByRole('button',{name:'Resolve thread'}));
 await waitFor(()=>expect(r.getByText(/1 resolved thread/)).toBeTruthy());
 fireEvent.click(r.getByText(/1 resolved thread/));
 fireEvent.click(r.getByRole('button',{name:'Reopen thread'}));
 await waitFor(()=>expect(r.getByRole('button',{name:'Resolve thread'})).toBeTruthy());
});
it('keeps failed resolution open and lets viewers resolve only their own threads',async()=>{
 const resolveComment=vi.fn().mockResolvedValue({ok:false});
 const r=render(<BoardTeamProvider value={value({resolveComment})}><PostComments refId="post"/></BoardTeamProvider>);
 fireEvent.click(r.getByRole('button',{name:'Resolve thread'}));
 await waitFor(()=>expect(r.getByRole('alert').textContent).toContain('could not'));
 expect(r.getByText(/tighten the hook/)).toBeTruthy();cleanup();
 const v=render(<BoardTeamProvider value={value({canApprove:false})}><PostComments refId="post"/></BoardTeamProvider>);
 expect(v.queryByRole('button',{name:'Resolve thread'})).toBeNull();
});
it('preserves a comment draft when a network error rejects the save',async()=>{
 const r=render(<BoardTeamProvider value={value({addComment:async()=>{throw new Error('offline');}})}><PostComments refId="post"/></BoardTeamProvider>);
 const box=r.getByRole('combobox',{name:'Add a comment'});fireEvent.change(box,{target:{value:'Keep this feedback'}});
 fireEvent.click(r.getByRole('button',{name:'Comment'}));
 await waitFor(()=>expect(r.getByRole('alert')).toBeTruthy());expect((box as HTMLTextAreaElement).value).toBe('Keep this feedback');
 expect((r.getByRole('button',{name:'Comment'}) as HTMLButtonElement).disabled).toBe(false);
});
it('counts open threads on batch cards and filters posts mentioned to this viewer',()=>{
 const comments=[root,{...root,id:'r1',parent:'c1'},{...root,id:'done',resolved_at:'2026-10-17T12:00:00Z'}];
 const items:any[]=[{id:'post',kind:'post',title:'Mentioned post'},{id:'other',kind:'post',title:'Other post'}];
 const r=render(<BoardTeamProvider value={value({comments})}><BatchReviewOverview items={items} onOpen={()=>{}} statusFor={()=>'Awaiting approval'}/></BoardTeamProvider>);
 expect(r.getByText('1 open thread')).toBeTruthy();expect(r.getByText('Mentioned you')).toBeTruthy();
 fireEvent.click(r.getByRole('button',{name:/Mentioned you/}));
 expect(r.queryByText('Other post')).toBeNull();expect(r.getByRole('heading',{name:'Mentioned post'})).toBeTruthy();
 fireEvent.click(r.getByRole('button',{name:'All posts'}));expect(r.getByRole('heading',{name:'Other post'})).toBeTruthy();
});
it('preserves unsent text and selected recipients when Comments is collapsed',async()=>{
 const addComment=vi.fn().mockResolvedValue({ok:false});const r=render(<BoardTeamProvider value={value({addComment})}><PostComments refId="post"/></BoardTeamProvider>);
 const box=r.getByRole('combobox',{name:'Add a comment'});fireEvent.change(box,{target:{value:'@Lyn',selectionStart:4}});fireEvent.click(r.getByRole('option',{name:/Lyndsay K/}));
 fireEvent.click(r.getByRole('button',{name:/Comments \(1\)/}));fireEvent.click(r.getByRole('button',{name:/Comments \(1\)/}));
 expect((r.getByRole('combobox',{name:'Add a comment'}) as HTMLTextAreaElement).value).toBe('@Lyndsay K ');
 fireEvent.click(r.getByRole('button',{name:'Comment'}));
 await waitFor(()=>expect(addComment).toHaveBeenCalledWith('post','@Lyndsay K',null,[{email:'lyndsay@example.invalid',label:'Lyndsay K'}]));
});
it('preserves a reply draft and recipients when a refresh resolves its root',async()=>{
 const addComment=vi.fn().mockResolvedValue({ok:false});const provider=(comments:BoardComment[])=><BoardTeamProvider value={value({comments,addComment})}><PostComments refId="post"/></BoardTeamProvider>;
 const r=render(provider([root]));fireEvent.click(r.getByRole('button',{name:'Reply'}));
 const box=r.getByRole('combobox',{name:'Reply'});fireEvent.change(box,{target:{value:'@Lyn',selectionStart:4}});fireEvent.click(r.getByRole('option',{name:/Lyndsay K/}));
 r.rerender(provider([{...root,resolved_at:'2026-10-17T13:00:00Z'}]));fireEvent.click(r.getByText(/1 resolved thread/));
 expect((r.getByRole('combobox',{name:'Reply'}) as HTMLTextAreaElement).value).toBe('@Lyndsay K ');
 fireEvent.submit(r.getByRole('combobox',{name:'Reply'}).closest('form')!);
 await waitFor(()=>expect(addComment).toHaveBeenCalledWith('post','@Lyndsay K','c1',[{email:'lyndsay@example.invalid',label:'Lyndsay K'}]));
});

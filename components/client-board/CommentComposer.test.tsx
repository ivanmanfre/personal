// @vitest-environment jsdom
import React from 'react';
import { afterEach,it,expect,vi } from 'vitest';
import { render,fireEvent,cleanup,waitFor } from '@testing-library/react';
import CommentComposer from './CommentComposer';
afterEach(cleanup);
const members=[{email:'jon@example.invalid',name:'Jonathan Kiekbusch'},{email:'lyndsay@example.invalid',name:'Lyndsay K'}];
it('selects a real member with the keyboard and submits the tagged identity',async()=>{
 const onSend=vi.fn().mockResolvedValue(true);const r=render(<CommentComposer label="Add a comment" members={members} onSend={onSend} />);
 const box=r.getByRole('combobox');fireEvent.change(box,{target:{value:'Hey @Jon',selectionStart:8}});
 expect(r.getByRole('option',{name:/Jonathan Kiekbusch/})).toBeTruthy();
 fireEvent.keyDown(box,{key:'Enter'});
 expect((box as HTMLTextAreaElement).value).toBe('Hey @Jonathan Kiekbusch ');
 fireEvent.click(r.getByRole('button',{name:'Comment'}));
 await waitFor(()=>expect(onSend).toHaveBeenCalledWith('Hey @Jonathan Kiekbusch',[{email:'jon@example.invalid',label:'Jonathan Kiekbusch'}]));
 await waitFor(()=>expect((box as HTMLTextAreaElement).value).toBe(''));
});
it('keeps failed drafts and removes recipient metadata if the tag is deleted',async()=>{
 const onSend=vi.fn().mockResolvedValue(false);const r=render(<CommentComposer label="Add a comment" members={members} onSend={onSend} />);
 const box=r.getByRole('combobox');fireEvent.change(box,{target:{value:'@Lyn',selectionStart:4}});
 fireEvent.click(r.getByRole('option',{name:/Lyndsay K/}));
 fireEvent.click(r.getByRole('button',{name:'Comment'}));
 await waitFor(()=>expect(onSend).toHaveBeenCalledTimes(1));
 expect((box as HTMLTextAreaElement).value).toBe('@Lyndsay K ');
 fireEvent.change(box,{target:{value:'Plain feedback',selectionStart:14}});
 fireEvent.click(r.getByRole('button',{name:'Comment'}));
 await waitFor(()=>expect(onSend).toHaveBeenLastCalledWith('Plain feedback',[]));
});
it('dismisses mention choices without letting Escape close the post',()=>{
 const outer=vi.fn();const r=render(<div onKeyDown={outer}><CommentComposer label="Reply" members={members} onSend={async()=>false} /></div>);
 const box=r.getByRole('combobox');fireEvent.change(box,{target:{value:'@',selectionStart:1}});
 fireEvent.keyDown(box,{key:'Escape'});expect(r.queryByRole('listbox')).toBeNull();expect(outer).not.toHaveBeenCalled();
});
it('disambiguates identical member names so both selected identities survive submission',async()=>{
 const onSend=vi.fn().mockResolvedValue(true);const r=render(<CommentComposer label="Add a comment" members={[{email:'alex1@example.invalid',name:'Alex'},{email:'alex2@example.invalid',name:'Alex'}]} onSend={onSend}/>);
 const box=r.getByRole('combobox');fireEvent.change(box,{target:{value:'@Alex',selectionStart:5}});fireEvent.click(r.getByRole('option',{name:/alex1@example.invalid/}));
 const first=(box as HTMLTextAreaElement).value;fireEvent.change(box,{target:{value:first+'@Alex',selectionStart:first.length+5}});fireEvent.click(r.getByRole('option',{name:/alex2@example.invalid/}));
 fireEvent.click(r.getByRole('button',{name:'Comment'}));
 await waitFor(()=>expect(onSend).toHaveBeenCalledWith('@Alex (alex1@example.invalid) @Alex (alex2@example.invalid)',[{email:'alex1@example.invalid',label:'Alex (alex1@example.invalid)'},{email:'alex2@example.invalid',label:'Alex (alex2@example.invalid)'}]));
});
it('keeps ordinary prose after a selected tag out of the mention picker',()=>{
 const r=render(<CommentComposer label="Add a comment" members={members} onSend={async()=>false}/>);
 const box=r.getByRole('combobox');fireEvent.change(box,{target:{value:'@Lyn',selectionStart:4}});fireEvent.click(r.getByRole('option',{name:/Lyndsay K/}));
 fireEvent.change(box,{target:{value:'@Lyndsay K a',selectionStart:12}});
 expect(r.queryByRole('listbox')).toBeNull();expect(fireEvent.keyDown(box,{key:'Enter'})).toBe(true);
 expect((box as HTMLTextAreaElement).value).toBe('@Lyndsay K a');
 fireEvent.change(box,{target:{value:'@Lyndsay K a @Jon',selectionStart:17}});
 expect(r.getByRole('option',{name:/Jonathan Kiekbusch/})).toBeTruthy();
});

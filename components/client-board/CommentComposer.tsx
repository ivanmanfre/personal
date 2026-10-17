import React, { useId, useRef, useState } from 'react';
import type { BoardMember, BoardMention } from './team';
import { mentionLabel, mentionsInText } from './commentMentions';

export interface CommentDraft { text: string; mentions: BoardMention[] }

export default function CommentComposer({ label, members = [], onSend, disabled = false, submitLabel = 'Comment', onCancel, draft, onDraftChange }: {
  label: string; members?: BoardMember[]; onSend: (text: string, mentions: BoardMention[]) => Promise<boolean>;
  disabled?: boolean; submitLabel?: string; onCancel?: () => void;
  draft?: CommentDraft; onDraftChange?: (draft: CommentDraft) => void;
}) {
  const id = useId(), input = useRef<HTMLTextAreaElement>(null);
  const [localDraft,setLocalDraft] = useState<CommentDraft>({text:'',mentions:[]});
  const {text,mentions:selected} = draft || localDraft;
  const writeDraft = (next: CommentDraft) => onDraftChange ? onDraftChange(next) : setLocalDraft(next);
  const [trigger,setTrigger] = useState<{start:number;end:number;query:string}|null>(null);
  const [choice,setChoice] = useState(0), [sending,setSending] = useState(false);
  const suggestions = trigger ? members.filter(m => `${m.name || ''} ${m.email}`.toLowerCase().includes(trigger.query.toLowerCase())).slice(0,6) : [];
  const updateTrigger = (value: string, caret: number) => {
    const match = value.slice(0,caret).match(/(?:^|\s)@([^@\n]{0,80})$/);
    const start = match ? caret-match[1].length-1 : caret;
    const completed = match && mentionsInText(value.slice(start,caret),selected).length>0;
    setTrigger(match && members.length && !completed ? {start,end:caret,query:match[1]} : null);setChoice(0);
  };
  const pick = (member: BoardMember) => {
    if (!trigger) return;
    const mention = {email:member.email,label:mentionLabel(member,members)};
    const insertion = '@'+mention.label+' ';
    writeDraft({text:text.slice(0,trigger.start)+insertion+text.slice(trigger.end),mentions:[...selected.filter(m=>m.email!==mention.email),mention]});
    const caret = trigger.start+insertion.length;
    setTrigger(null);
    requestAnimationFrame(() => {input.current?.focus();input.current?.setSelectionRange(caret,caret);});
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();if (sending || disabled || !text.trim()) return;
    setSending(true);setTrigger(null);
    try { if (await onSend(text.trim(),mentionsInText(text,selected))) writeDraft({text:'',mentions:[]}); }
    finally {setSending(false);}
  };
  const busy = disabled || sending;
  const field: React.CSSProperties = { display:'block',width:'100%',boxSizing:'border-box',minHeight:64,resize:'vertical',padding:10,fontFamily:'inherit',fontSize:14,lineHeight:1.5,border:'1px solid var(--cb-line-bold,#c9c6bf)',borderRadius:10,background:'var(--cb-paper-raise,#fff)',color:'var(--cb-ink)' };
  const button: React.CSSProperties = {font:'inherit',fontSize:13,fontWeight:700,minHeight:44,padding:'8px 16px',border:0,borderRadius:999,background:'var(--cb-ink)',color:'var(--cb-paper,#fff)',cursor:'pointer'};
  return <form onSubmit={submit} style={{marginTop:8,display:'grid',gap:6}}>
    <div style={{position:'relative'}}>
      <textarea ref={input} aria-label={label} role={members.length ? 'combobox' : undefined} aria-autocomplete={members.length ? 'list' : undefined}
        aria-expanded={members.length ? !!trigger : undefined} aria-controls={trigger ? `${id}-suggestions` : undefined}
        aria-activedescendant={suggestions[choice] ? `${id}-choice-${choice}` : undefined} aria-describedby={members.length ? `${id}-hint` : undefined}
        rows={2} value={text} disabled={busy} maxLength={2000} placeholder={members.length ? 'Add feedback · @ to mention a teammate' : 'Add a comment for your team'} style={field}
        onChange={e => {writeDraft({text:e.target.value,mentions:mentionsInText(e.target.value,selected)});updateTrigger(e.target.value,e.target.selectionStart);}}
        onClick={e => updateTrigger(e.currentTarget.value,e.currentTarget.selectionStart)}
        onKeyUp={e => {if (e.key==='ArrowLeft' || e.key==='ArrowRight') updateTrigger(e.currentTarget.value,e.currentTarget.selectionStart);}}
        onBlur={() => setTrigger(null)}
        onKeyDown={e => {
          e.stopPropagation();
          if (e.nativeEvent.isComposing) return;
          if (!trigger) return;
          if (e.key==='Escape') {e.preventDefault();setTrigger(null);}
          if (suggestions.length && (e.key==='ArrowDown' || e.key==='ArrowUp')) {e.preventDefault();setChoice(i => (i+(e.key==='ArrowDown'?1:-1)+suggestions.length)%suggestions.length);}
          if (suggestions.length && e.key==='Enter') {e.preventDefault();pick(suggestions[choice] || suggestions[0]);}
        }} />
      {trigger && <div id={`${id}-suggestions`} role="listbox" aria-label="Mention a teammate" style={{marginTop:6,padding:4,border:'1px solid var(--cb-line-bold,#ccc)',borderRadius:10,background:'var(--cb-paper-raise,#fff)',boxShadow:'0 5px 16px #00000010'}}>
        {suggestions.length ? suggestions.map((m,i)=><button key={m.email} id={`${id}-choice-${i}`} type="button" role="option" aria-selected={i===choice}
          onMouseDown={e=>e.preventDefault()} onClick={()=>pick(m)} style={{display:'block',width:'100%',minHeight:44,padding:'8px 10px',border:0,borderRadius:6,textAlign:'left',background:i===choice?'var(--cb-paper-sunk,#f4f3ef)':'transparent',color:'var(--cb-ink)',font:'inherit',fontSize:13,cursor:'pointer',overflowWrap:'anywhere'}}>
          <strong>{m.name || m.email}</strong>{m.name && <span style={{display:'block',fontSize:12,color:'var(--cb-ink-mute)'}}>{m.email}</span>}
        </button>) : <div style={{padding:10,fontSize:13,color:'var(--cb-ink-mute)'}}>No matching teammate.</div>}
      </div>}
    </div>
    {members.length>0 && <span id={`${id}-hint`} style={{fontSize:12,color:'var(--cb-ink-mute)'}}>Use @ to mention a teammate. Mentions appear on their board.</span>}
    <div style={{display:'flex',gap:8}}><button type="submit" disabled={busy || !text.trim()} style={{...button,opacity:busy || !text.trim() ? .5 : 1}}>{sending ? 'Saving…' : submitLabel}</button>
      {onCancel && <button type="button" onClick={onCancel} disabled={busy} style={{...button,background:'transparent',color:'var(--cb-ink)',textDecoration:'underline'}}>Cancel</button>}
    </div>
  </form>;
}

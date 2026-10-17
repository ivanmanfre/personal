/**
 * Who-did-what on a live client board (2026-10-15): member names, "Approved by X, 14:02"
 * labels and per-post comments. Every action row carries `by` (stamped server-side: the
 * signed-in member's email, or 'board link' for the ?k= token). This module turns that into
 * client-safe labels and renders the comment thread for one post.
 *
 * The page owns the data (BoardTeamProvider value); surfaces read it through useBoardTeam(),
 * so nothing is threaded through the big surface prop lists. Absent provider = feature off
 * (preview/demo boards, tests): every component here renders nothing.
 */
import React, { createContext, useContext, useState } from 'react';
import { clientTz, boardZone } from '../ClientBoardPage';
import CommentComposer, { type CommentDraft } from './CommentComposer';
import { mentionParts } from './commentMentions';

export interface BoardMention { email: string; label: string }
export interface BoardMember { email: string; name?: string | null; role?: string | null }
export interface BoardComment { id: string; ref: string; at: string; by: string | null; text: string; parent: string | null; mentions?: BoardMention[]; resolved_at?: string | null; resolved_by?: string | null }
export interface ApprovalMeta { by: string | null; at: string }

export interface BoardTeamValue {
  /** Signed-in viewer's email ('' for the board link). */
  me: string;
  comments: BoardComment[];
  approvalMeta: Record<string, ApprovalMeta>;
  /** Posting needs an email session; the board link can read but not comment. */
  canComment: boolean;
  /** Viewers read and comment; approvers and admins sign off (server enforces it too). */
  canApprove: boolean;
  members?: BoardMember[];
  resolveComment?: (id: string, resolved: boolean) => Promise<{ ok: boolean; error?: string }>;
  addComment: (ref: string, text: string, parent?: string | null, mentions?: BoardMention[]) => Promise<{ ok: boolean; error?: string }>;
}

const Ctx = createContext<BoardTeamValue | null>(null);
export const BoardTeamProvider = Ctx.Provider;
export function useBoardTeam(): BoardTeamValue | null { return useContext(Ctx); }

const OPERATOR_HOSTS = ['ivanmanfredi.com', 'inboundonsteroids.com'];

/** True for an operator sign-in address (the agency's own domains). */
export function isOperatorEmail(email: string | null | undefined): boolean {
  const raw = (email || '').trim().toLowerCase();
  if (!raw.includes('@')) return false;
  const host = raw.slice(raw.lastIndexOf('@') + 1);
  return OPERATOR_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

/** The name operator actions show under. White-label boards (lib/boardHost) never name the
 *  agency, so the page sets a neutral label there. Set by the page once per render. */
let houseLabel = 'InboundOnSteroids';
let whiteLabelBoard = false;
export function boardHouseLabel(): string { return houseLabel; }
export function setBoardHouse(whiteLabel: boolean): void {
  whiteLabelBoard = whiteLabel;
  houseLabel = whiteLabel ? 'Content team' : 'InboundOnSteroids';
}

/** Module-level copy of the viewer's email for the non-hook history resolvers. Set by the
 *  page once per render, like setBoardZone. */
let viewerEmail = '';
export function setBoardViewer(email: string): void { viewerEmail = (email || '').toLowerCase(); }
/** Names the team gave each member (board_team_list), keyed by lower-case email. */
let memberNames: Record<string, string> = {};
export function setBoardNames(names: Record<string, string>): void { memberNames = names || {}; }
export function viewerKnown(): boolean { return !!viewerEmail; }
/** Full name of the signed-in viewer for their own screen: the name the team gave them,
 *  else the one read from their email. Null for the board link (no person signed in). */
export function viewerDisplayName(): string | null {
  if (!viewerEmail) return null;
  const given = (memberNames[viewerEmail] || '').trim();
  if (given) return given;
  return isOperatorEmail(viewerEmail) ? null : memberName(viewerEmail);
}

/** A member's display name from their email ("lyndsay.k@swishdm.com" → "Lyndsay K").
 *  Operator addresses and tooling ids return null: the caller keeps its house label. */
export function memberName(by: string | null | undefined): string | null {
  const raw = (by || '').trim().toLowerCase();
  if (!raw.includes('@')) return null;
  const host = raw.slice(raw.lastIndexOf('@') + 1);
  if (OPERATOR_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) return null;
  const given = (memberNames[raw] || '').trim();
  if (given) return given.split(/\s+/)[0];
  const local = raw.slice(0, raw.indexOf('@')).split('+')[0];
  const words = local.split(/[._\-]+/).filter(Boolean);
  if (!words.length) return null;
  return words.map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}

/** Label for an actor on THIS viewer's screen: "You", a member's name, or null (house label). */
export function actorLabel(by: string | null | undefined): string | null {
  const raw = (by || '').trim().toLowerCase();
  if (viewerEmail && raw === viewerEmail) return 'You';
  return memberName(raw);
}

/** Board role per member (board_team_list), keyed by lower-case email. */
let memberRoles: Record<string, string> = {};
export function setBoardRoles(roles: Record<string, string>): void { memberRoles = roles || {}; }
const ROLE_LABEL: Record<string, string> = { admin: 'Admin', approver: 'Approver', viewer: 'Viewer' };

/** Who wrote a comment or signed off, for THIS viewer's screen (2026-10-16). Every row carries
 *  the server-stamped `by` (the signed-in email); this never invents a person:
 *  - no `by` stored (old rows)      → "Unknown"
 *  - the ?k= board link (no sign-in) → "Board link" + "not signed in"
 *  - our side (operator address)     → the name the team list gives it + the house tag
 *                                      ("Ivan Manfredi · Content team"); house label alone if unnamed
 *  - a member                        → their name (or "You") + their board role */
export function authorParts(by: string | null | undefined, house: string = houseLabel, full = true): { name: string; tag: string | null; email: string | null } {
  const raw = (by || '').trim().toLowerCase();
  if (!raw) return { name: 'Unknown', tag: null, email: null };
  if (raw === 'board link') return { name: 'Board link', tag: 'not signed in', email: null };
  if (!raw.includes('@')) return { name: house, tag: null, email: null };
  const given = (memberNames[raw] || '').trim();
  const me = !!viewerEmail && raw === viewerEmail;
  if (isOperatorEmail(raw)) {
    if (!given) return { name: me ? 'You' : house, tag: me ? house : null, email: null };
    return { name: me ? 'You' : (full ? given : given.split(/\s+/)[0]), tag: house, email: null };
  }
  const name = me ? 'You' : ((full && given) || memberName(raw) || raw);
  const role = memberRoles[raw];
  return { name, tag: role ? (ROLE_LABEL[role] || null) : null, email: raw };
}

function whoLabel(by: string | null | undefined, house: string): string {
  return authorParts(by, house, false).name;
}

/** "2:02 AM PT" today, "14 Oct, 2:02 AM PT" otherwise, in the client's zone, written the
 *  same way as every scheduled time on the board (2026-10-16: a bare "02:37" read as the
 *  viewer's own clock). */
export function shortWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const tz = clientTz();
  const zone = boardZone();
  const day = (x: Date) => x.toLocaleDateString('en-GB', { timeZone: tz, day: 'numeric', month: 'short' });
  const time = zone.hour12
    ? d.toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true })
    : d.toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
  const stamp = `${time} ${zone.label}`;
  return day(d) === day(new Date()) ? stamp : `${day(d)}, ${stamp}`;
}

/** "Approved by Lyndsay, 14:02". Renders nothing without a server receipt. */
export function ApprovedBy({ refId, house: houseProp, style }: { refId: string; house?: string; style?: React.CSSProperties }) {
  const team = useBoardTeam();
  const house = houseProp ?? houseLabel;
  const meta = team?.approvalMeta[refId];
  if (!meta) return null;
  const by = (meta.by || '').trim();
  const who = whoLabel(by, house);
  const when = shortWhen(meta.at);
  return (
    <span data-approved-by title={by.includes('@') ? by : undefined} style={{ fontSize: 12.5, color: 'var(--cb-ink-mute)', ...style }}>
      {by.toLowerCase() === 'board link' ? 'Approved via the board link (not signed in)' : `Approved by ${who || 'Unknown'}`}{when ? ` · ${when}` : ''}
    </span>
  );
}

/** Per-post comment thread: top-level comments with one level of replies. */
export function PostComments({ refId, house: houseProp, compact = false }: { refId: string; house?: string; compact?: boolean }) {
  const team = useBoardTeam();
  const house = houseProp ?? houseLabel;
  const [open, setOpen] = useState(!compact);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [drafts,setDrafts] = useState<Record<string,CommentDraft>>({});
  const saveDraft = (key: string, draft: CommentDraft) => setDrafts(prev=>({...prev,[key]:draft}));
  const [busy, setBusy] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [status, setStatus] = useState('');
  if (!team) return null;
  const collaborative = !!team.resolveComment;
  const mine = team.comments.filter(c => c.ref === refId);
  const tops = mine.filter(c => !c.parent);
  const pending = tops.filter(c => !c.resolved_at), resolved = tops.filter(c => c.resolved_at);
  const repliesOf = (id: string) => mine.filter(c => c.parent === id);
  const send = async (body: string, parent: string | null, mentions: BoardMention[]) => {
    if (!body.trim() || busy || resolving) return false;
    setBusy(true); setErr(''); setStatus('');
    try {
      const r = team.members ? await team.addComment(refId,body.trim(),parent,mentions) : await team.addComment(refId,body.trim(),parent);
      if (!r.ok) {
        setErr(r.error === 'rate_limited' ? 'Too many comments in a short time. Try again in a few minutes.' : r.error === 'bad_mentions' ? 'A tagged teammate could not be found. Select their name again. Your text is kept.' : 'Your comment did not save. Your text is kept. Try again.');
        return false;
      }
      setStatus('Comment saved');return true;
    } catch { setErr('Your comment did not save. Your text is kept. Try again.');return false; }
    finally {setBusy(false);}
  };
  const resolve = async (c: BoardComment, next: boolean) => {
    if (!team.resolveComment || busy || resolving) return;
    setResolving(c.id);setErr('');setStatus('');
    try {
      const r = await team.resolveComment(c.id,next);
      if (!r.ok) {setErr('This thread could not be updated. Try again.');return;}
      setStatus(next ? 'Thread resolved' : 'Thread reopened');
    } catch {setErr('This thread could not be updated. Try again.');}
    finally {setResolving(null);}
  };
  const link: React.CSSProperties = {font:'inherit',fontSize:12.5,fontWeight:700,padding:'6px 2px',minHeight:44,border:0,background:'none',color:'var(--cb-ink)',textDecoration:'underline',textUnderlineOffset:3,cursor:'pointer'};
  const row = (c: BoardComment, reply = false) => {
    const author = authorParts(c.by,house);
    return <div style={{padding:'9px 0',borderTop:reply?'none':'1px solid var(--cb-line)',marginLeft:reply?18:0,paddingLeft:reply?12:0,borderLeft:reply?'2px solid var(--cb-line)':'none'}}>
      <div style={{display:'flex',gap:8,alignItems:'baseline',flexWrap:'wrap'}}>
        <b data-comment-author style={{fontSize:13,color:'var(--cb-ink)'}}>{author.name}</b>
        {author.tag && <span data-comment-role style={{fontSize:12,fontWeight:600,color:'var(--cb-ink-soft,var(--cb-ink-mute))'}}>{author.tag}</span>}
        {author.email && author.name!==author.email && <span style={{fontSize:12,color:'var(--cb-ink-mute)',overflowWrap:'anywhere'}}>{author.email}</span>}
        <span style={{fontSize:12,color:'var(--cb-ink-mute)'}}>{shortWhen(c.at)}</span>
      </div>
      <div style={{fontSize:13.5,lineHeight:1.55,color:'var(--cb-ink)',whiteSpace:'pre-wrap',overflowWrap:'anywhere',marginTop:3}}>
        {mentionParts(c.text,c.mentions).map((part,i)=>part.mention ? <mark key={i} data-comment-mention title={part.mention.email} style={{background:'var(--cb-paper-sunk,#f3f2ef)',color:'var(--cb-ink)',fontWeight:700,borderRadius:3,padding:'1px 2px'}}>{part.text}</mark> : part.text)}
      </div>
    </div>;
  };
  const thread = (c: BoardComment) => {
    const replies = repliesOf(c.id);
    const mentioned = team.me && [c,...replies].some(x=>x.mentions?.some(m=>m.email.toLowerCase()===team.me.toLowerCase()));
    const canResolve = collaborative && team.canComment && (team.canApprove || c.by?.toLowerCase()===team.me.toLowerCase());
    return <div key={c.id} data-comment-thread={c.id}>
      {row(c)}
      {mentioned && <span style={{display:'inline-block',fontSize:12,fontWeight:700,color:'var(--cb-ink-mute)',marginBottom:5}}>Mentioned you</span>}
      {replies.map(r=><React.Fragment key={r.id}>{row(r,true)}</React.Fragment>)}
      <div style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}>
        {team.canComment && <button type="button" onClick={()=>setReplyTo(replyTo===c.id?null:c.id)} style={{...link,marginLeft:18}}>Reply</button>}
        {canResolve && <button type="button" disabled={!!resolving || busy} aria-label={c.resolved_at?'Reopen thread':'Resolve thread'} onClick={()=>void resolve(c,!c.resolved_at)} style={{...link,marginLeft:'auto',opacity:resolving ? .5 : 1}}>{resolving===c.id?'Saving…':c.resolved_at?'Reopen':'Resolve'}</button>}
        {c.resolved_at && <span style={{fontSize:12,color:'var(--cb-ink-mute)'}}>Resolved by {authorParts(c.resolved_by,house).name} · {shortWhen(c.resolved_at)}</span>}
      </div>
      {replyTo===c.id && team.canComment && <div style={{marginLeft:18}}><CommentComposer label="Reply" draft={drafts[c.id]} onDraftChange={draft=>saveDraft(c.id,draft)} members={team.members} disabled={busy || !!resolving} submitLabel="Reply" onCancel={()=>{setReplyTo(null);saveDraft(c.id,{text:'',mentions:[]});}} onSend={async(text,mentions)=>{const ok=await send(text,c.id,mentions);if(ok)setReplyTo(null);return ok;}} /></div>}
    </div>;
  };
  return <div data-post-comments style={{marginTop:12}}>
    <button type="button" onClick={()=>setOpen(!open)} aria-expanded={open} style={{...link,textDecoration:'none',fontSize:13}}>{mine.length?`Comments (${mine.length})`:'Comments'} {open?'▾':'▸'}</button>
    {collaborative && <span style={{fontSize:12,color:'var(--cb-ink-mute)',marginLeft:10}}>{pending.length} open</span>}
    {open && <div style={{marginTop:4}}>
      {(collaborative?pending:tops).length===0 && <div style={{fontSize:13,color:'var(--cb-ink-mute)',padding:'4px 0 8px'}}>{tops.length?'No open feedback.':whiteLabelBoard?'No comments yet. Everyone on this board sees what you write here.':'No comments yet. Your whole team and InboundOnSteroids see what you write here.'}</div>}
      {(collaborative?pending:tops).map(thread)}
      {collaborative && resolved.length>0 && <details style={{marginTop:8,borderTop:'1px solid var(--cb-line)'}}><summary style={{minHeight:44,display:'list-item',paddingTop:12,fontSize:13,fontWeight:600,cursor:'pointer'}}>{resolved.length} resolved thread{resolved.length===1?'':'s'}</summary>{resolved.map(thread)}</details>}
      {team.canComment ? <CommentComposer label="Add a comment" draft={drafts.new} onDraftChange={draft=>saveDraft('new',draft)} members={team.members} disabled={busy || !!resolving} onSend={(text,mentions)=>send(text,null,mentions)} /> : <div style={{fontSize:12.5,color:'var(--cb-ink-mute)',marginTop:6}}>Sign in with your email to comment, so your team sees who wrote it.</div>}
      {status && <div role="status" style={{fontSize:13,color:'var(--cb-ink-mute)',marginTop:6}}>{status}</div>}
      {err && <div role="alert" style={{fontSize:13,color:'var(--cb-danger,#a12622)',marginTop:6}}>{err}</div>}
    </div>}
  </div>;
}

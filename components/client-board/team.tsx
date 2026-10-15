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
import { clientTz } from '../ClientBoardPage';

export interface BoardComment { id: string; ref: string; at: string; by: string | null; text: string; parent: string | null }
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
  addComment: (ref: string, text: string, parent?: string | null) => Promise<{ ok: boolean; error?: string }>;
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

function isOperator(by: string | null | undefined): boolean {
  const raw = (by || '').trim().toLowerCase();
  return raw.includes('@') && memberName(raw) === null;
}

function whoLabel(by: string | null | undefined, house: string): string {
  if ((by || '').trim().toLowerCase() === 'board link') return 'board link';
  if (isOperator(by)) return house;
  return actorLabel(by) || house;
}

/** "14:02" today, "14 Oct, 14:02" otherwise, in the client's zone. */
export function shortWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const tz = clientTz();
  const day = (x: Date) => x.toLocaleDateString('en-GB', { timeZone: tz, day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
  return day(d) === day(new Date()) ? time : `${day(d)}, ${time}`;
}

/** "Approved by Lyndsay, 14:02". Renders nothing without a server receipt. */
export function ApprovedBy({ refId, house: houseProp, style }: { refId: string; house?: string; style?: React.CSSProperties }) {
  const team = useBoardTeam();
  const house = houseProp ?? houseLabel;
  const meta = team?.approvalMeta[refId];
  if (!meta) return null;
  const by = (meta.by || '').trim();
  const who = by ? whoLabel(by, house) : '';
  const when = shortWhen(meta.at);
  return (
    <span data-approved-by title={by.includes('@') ? by : undefined} style={{ fontSize: 12.5, color: 'var(--cb-ink-mute)', ...style }}>
      {who ? `Approved by ${who}` : 'Approved'}{when ? `, ${when}` : ''}
    </span>
  );
}

/** Per-post comment thread: top-level comments with one level of replies. */
export function PostComments({ refId, house: houseProp, compact = false }: { refId: string; house?: string; compact?: boolean }) {
  const team = useBoardTeam();
  const house = houseProp ?? houseLabel;
  const [open, setOpen] = useState(!compact);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (!team) return null;
  const mine = team.comments.filter((c) => c.ref === refId);
  const tops = mine.filter((c) => !c.parent);
  const repliesOf = (id: string) => mine.filter((c) => c.parent === id);

  const send = async (body: string, parent: string | null) => {
    const t = body.trim();
    if (!t || busy) return false;
    setBusy(true); setErr('');
    const r = await team.addComment(refId, t, parent);
    setBusy(false);
    if (!r.ok) { setErr(r.error === 'rate_limited' ? 'Too many comments in a short time. Try again in a few minutes.' : 'Your comment did not save. Your text is kept. Try again.'); return false; }
    return true;
  };

  const field: React.CSSProperties = { display: 'block', width: '100%', boxSizing: 'border-box', minHeight: 44, resize: 'vertical', padding: 10, fontFamily: 'inherit', fontSize: 13.5, lineHeight: 1.5, border: '1px solid var(--cb-line-bold, #c9c6bf)', borderRadius: 10, background: 'var(--cb-paper-raise, #fff)', color: 'var(--cb-ink)' };
  const btn: React.CSSProperties = { font: 'inherit', fontSize: 13, fontWeight: 700, minHeight: 40, padding: '8px 16px', border: 0, borderRadius: 999, background: 'var(--cb-ink)', color: 'var(--cb-paper, #fff)', cursor: 'pointer' };
  const link: React.CSSProperties = { font: 'inherit', fontSize: 12.5, fontWeight: 700, padding: '6px 2px', minHeight: 32, border: 0, background: 'none', color: 'var(--cb-ink)', textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer' };

  const Row = ({ c, reply }: { c: BoardComment; reply?: boolean }) => (
    <div style={{ padding: '9px 0 9px', borderTop: reply ? 'none' : '1px solid var(--cb-line)', marginLeft: reply ? 18 : 0, paddingLeft: reply ? 12 : 0, borderLeft: reply ? '2px solid var(--cb-line)' : 'none' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <b style={{ fontSize: 13, color: 'var(--cb-ink)' }}>{whoLabel(c.by, house)}</b>
        {c.by && c.by.includes('@') && !isOperator(c.by) && <span style={{ fontSize: 12, color: 'var(--cb-ink-mute)', overflowWrap: 'anywhere' }}>{c.by}</span>}
        <span style={{ fontSize: 12, color: 'var(--cb-ink-mute)' }}>{shortWhen(c.at)}</span>
      </div>
      <div style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--cb-ink)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', marginTop: 3 }}>{c.text}</div>
    </div>
  );

  return (
    <div data-post-comments style={{ marginTop: 12 }}>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} style={{ ...link, textDecoration: 'none', fontSize: 13 }}>
        {mine.length ? `Comments (${mine.length})` : 'Comments'} {open ? '▾' : '▸'}
      </button>
      {open && (
        <div style={{ marginTop: 4 }}>
          {tops.length === 0 && <div style={{ fontSize: 13, color: 'var(--cb-ink-mute)', padding: '4px 0 8px' }}>{whiteLabelBoard ? 'No comments yet. Everyone on this board sees what you write here.' : 'No comments yet. Your whole team and InboundOnSteroids see what you write here.'}</div>}
          {tops.map((c) => (
            <div key={c.id}>
              <Row c={c} />
              {repliesOf(c.id).map((r) => <Row key={r.id} c={r} reply />)}
              {team.canComment && (replyTo === c.id ? (
                <form onSubmit={async (e) => { e.preventDefault(); if (await send(replyText, c.id)) { setReplyText(''); setReplyTo(null); } }} style={{ marginLeft: 18, marginTop: 4, display: 'grid', gap: 6 }}>
                  <textarea aria-label="Reply" rows={2} value={replyText} onChange={(e) => setReplyText(e.target.value)} maxLength={2000} style={field} autoFocus />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="submit" disabled={busy || !replyText.trim()} style={{ ...btn, opacity: busy || !replyText.trim() ? 0.5 : 1 }}>{busy ? 'Saving…' : 'Reply'}</button>
                    <button type="button" onClick={() => setReplyTo(null)} style={link}>Cancel</button>
                  </div>
                </form>
              ) : (
                <button type="button" onClick={() => { setReplyTo(c.id); setReplyText(''); }} style={{ ...link, marginLeft: 18 }}>Reply</button>
              ))}
            </div>
          ))}
          {team.canComment ? (
            <form onSubmit={async (e) => { e.preventDefault(); if (await send(text, null)) setText(''); }} style={{ marginTop: 8, display: 'grid', gap: 6 }}>
              <textarea aria-label="Add a comment" rows={2} value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder="Add a comment for your team" style={field} />
              <div><button type="submit" disabled={busy || !text.trim()} style={{ ...btn, opacity: busy || !text.trim() ? 0.5 : 1 }}>{busy ? 'Saving…' : 'Comment'}</button></div>
            </form>
          ) : (
            <div style={{ fontSize: 12.5, color: 'var(--cb-ink-mute)', marginTop: 6 }}>Sign in with your email to comment, so your team sees who wrote it.</div>
          )}
          {err && <div role="alert" style={{ fontSize: 13, color: 'var(--cb-danger, #a12622)', marginTop: 6 }}>{err}</div>}
        </div>
      )}
    </div>
  );
}

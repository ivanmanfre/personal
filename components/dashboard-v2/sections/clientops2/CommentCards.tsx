'use client';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { GATE } from './shared';

// Comments left on the client's own LinkedIn posts, classified and triaged.
//
// ⚠ There is NO send action here, deliberately. The comment system is read-only
// against LinkedIn: it detects and drafts, a human speaks. Approving in the DM
// inbox dispatches from the client's seat, which is why these live in their own
// panel instead of being folded into "Drafts waiting on you".
export interface CommentCard {
  comment_id: string;
  post_urn: string;
  author_name: string | null;
  author_headline: string | null;
  author_profile: string | null;
  distance: string | null;
  text: string;
  posted_at: string;
  category: string;
  action: 'auto' | 'escalate';
  gate_flags: string[];
  draft_text: string | null;
  model_reason: string | null;
}

// A ugcPost numeric is NOT an activity id — rewrapping it links a different
// post. /feed/update/ accepts both urn kinds, so pass the urn through as-is.
const postLink = (urn: string) => {
  const s = String(urn ?? '').trim();
  const full = /^urn:li:(activity|ugcPost):\d+$/.test(s) ? s : `urn:li:activity:${s.split(':').pop()}`;
  return `https://www.linkedin.com/feed/update/${full}/`;
};

const ago = (iso: string) => {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3.6e6);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

export function useCommentCards(clientId: string | null) {
  const [cards, setCards] = useState<CommentCard[] | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!clientId) { setCards(null); return; }
    setError('');
    const { data, error: err } = await supabase.rpc('operator_client_comment_cards', {
      p_gate: GATE, p_client_id: clientId,
    });
    if (err || (data && data.ok === false)) {
      setError(err?.message || data?.error || 'comment cards failed to load');
      setCards((prev) => prev ?? null);
      return;
    }
    setCards((data?.cards || []) as CommentCard[]);
  }, [clientId]);
  useEffect(() => { load(); }, [load]);
  return { cards, error, reload: load };
}

function Card({ c, clientId, onHandled }: { c: CommentCard; clientId: string; onHandled: () => void }) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const copy = async () => {
    if (!c.draft_text) return;
    await navigator.clipboard.writeText(c.draft_text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const markHandled = async () => {
    setBusy(true);
    await supabase.rpc('operator_mark_comment_handled', {
      p_gate: GATE, p_client_id: clientId, p_comment_id: c.comment_id,
    });
    setBusy(false);
    onHandled();
  };

  const isAuto = c.action === 'auto';
  return (
    <div className={`cc-card cc-card--${c.action}`}>
      <div className="cc-head">
        <a className="cc-who" href={c.author_profile || postLink(c.post_urn)} target="_blank" rel="noreferrer">
          {c.author_name || 'Unknown'}
        </a>
        <span className="cc-meta">{c.author_headline}</span>
        <span className="cc-when">{ago(c.posted_at)}</span>
      </div>

      <div className="cc-text">{c.text}</div>

      <div className="cc-verdict">
        <span className={`cc-tag cc-tag--${c.action}`}>
          {isAuto ? 'reply ready' : 'needs Mattan'}
        </span>
        <span className="cc-cat">{c.category}</span>
        {c.gate_flags?.length > 0 && <span className="cc-flags">{c.gate_flags.join(' · ')}</span>}
      </div>

      {c.model_reason && !isAuto && <div className="cc-reason">{c.model_reason}</div>}

      {isAuto && c.draft_text && (
        <div className="cc-draft">
          <div className="cc-draft-body">{c.draft_text}</div>
          <button className="cc-btn" onClick={copy}>{copied ? 'copied' : 'copy reply'}</button>
        </div>
      )}

      <div className="cc-actions">
        <a className="cc-btn cc-btn--ghost" href={postLink(c.post_urn)} target="_blank" rel="noreferrer">
          open thread
        </a>
        <button className="cc-btn cc-btn--ghost" onClick={markHandled} disabled={busy}>
          {busy ? '…' : 'mark handled'}
        </button>
      </div>
    </div>
  );
}

// Styles live with the component so it renders correctly anywhere it is mounted,
// rather than depending on a <style> block in a sibling file.
const CSS = `
.cc-wrap { margin-bottom:1.6rem; }
.cc-banner { font-family:var(--ec-sans); font-size:12px; line-height:1.5; color:var(--ec-body); background:rgba(19,18,16,0.04); border-left:3px solid var(--ec-ink); padding:0.7rem 0.9rem; margin-bottom:1rem; }
.cc-h { font-family:var(--ec-sans); font-size:11px; letter-spacing:0.08em; text-transform:uppercase; color:var(--ec-mute); margin:1.1rem 0 0.5rem; }
.cc-empty { font-family:var(--ec-sans); font-size:13px; color:var(--ec-mute); padding:1rem 0; }
.cc-card { border:1px solid rgba(19,18,16,0.10); border-left-width:3px; padding:0.85rem 1rem; margin-bottom:0.7rem; background:#fff; }
.cc-card--auto { border-left-color:#2e7d4f; }
.cc-card--escalate { border-left-color:#b8860b; }
.cc-head { display:flex; flex-wrap:wrap; align-items:baseline; gap:0.5rem; }
.cc-who { font-family:var(--ec-sans); font-size:13px; font-weight:600; color:var(--ec-ink); text-decoration:none; }
.cc-who:hover { text-decoration:underline; }
.cc-meta { font-family:var(--ec-sans); font-size:11px; color:var(--ec-mute); flex:1 1 auto; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cc-when { font-family:var(--ec-sans); font-size:11px; color:var(--ec-mute); }
.cc-text { font-family:var(--ec-sans); font-size:13px; line-height:1.55; color:var(--ec-body); margin:0.5rem 0 0.6rem; }
.cc-verdict { display:flex; flex-wrap:wrap; align-items:center; gap:0.5rem; }
.cc-tag { font-family:var(--ec-sans); font-size:10px; letter-spacing:0.06em; text-transform:uppercase; padding:0.15rem 0.45rem; border-radius:2px; }
.cc-tag--auto { background:rgba(46,125,79,0.12); color:#2e7d4f; }
.cc-tag--escalate { background:rgba(184,134,11,0.14); color:#8a6508; }
.cc-cat { font-family:var(--ec-sans); font-size:10.5px; letter-spacing:0.05em; color:var(--ec-mute); }
.cc-flags { font-family:var(--ec-sans); font-size:10.5px; color:#8a6508; }
.cc-reason { font-family:var(--ec-sans); font-size:12px; color:var(--ec-mute); margin-top:0.45rem; font-style:italic; }
.cc-draft { margin-top:0.6rem; display:flex; align-items:flex-start; gap:0.6rem; }
.cc-draft-body { flex:1 1 auto; font-family:var(--ec-sans); font-size:13px; line-height:1.5; color:var(--ec-ink); background:rgba(46,125,79,0.06); border-left:2px solid #2e7d4f; padding:0.55rem 0.7rem; }
.cc-actions { display:flex; gap:0.5rem; margin-top:0.65rem; }
.cc-btn { font-family:var(--ec-sans); font-size:11px; letter-spacing:0.04em; padding:0.32rem 0.65rem; border:1px solid rgba(19,18,16,0.18); background:#fff; color:var(--ec-ink); cursor:pointer; text-decoration:none; }
.cc-btn:hover { background:rgba(19,18,16,0.04); }
.cc-btn--ghost { color:var(--ec-mute); }
.cc-btn[disabled] { opacity:0.5; cursor:default; }
`;

export default function CommentCards({ clientId }: { clientId: string }) {
  const { cards, error, reload } = useCommentCards(clientId);

  if (error) return <div className="co2-err">{error}</div>;
  if (cards == null) return <div className="ws-loading">Loading comments…</div>;
  if (cards.length === 0) {
    return <div className="cc-empty"><style>{CSS}</style>No comments waiting. Anything Mattan already answered is hidden.</div>;
  }

  const auto = cards.filter((c) => c.action === 'auto');
  const esc = cards.filter((c) => c.action === 'escalate');

  return (
    <div className="cc-wrap">
      <style>{CSS}</style>
      <div className="cc-banner">
        Nothing here posts to LinkedIn. Replies are copied by hand; escalations go to Mattan.
      </div>
      {auto.length > 0 && (
        <>
          <h4 className="cc-h">Reply ready ({auto.length})</h4>
          {auto.map((c) => <Card key={c.comment_id} c={c} clientId={clientId} onHandled={reload} />)}
        </>
      )}
      {esc.length > 0 && (
        <>
          <h4 className="cc-h">Needs Mattan ({esc.length})</h4>
          {esc.map((c) => <Card key={c.comment_id} c={c} clientId={clientId} onHandled={reload} />)}
        </>
      )}
    </div>
  );
}

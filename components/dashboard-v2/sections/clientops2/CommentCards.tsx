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

const postLink = (urn: string) =>
  `https://www.linkedin.com/feed/update/urn:li:activity:${String(urn).split(':').pop()}/`;

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

export default function CommentCards({ clientId }: { clientId: string }) {
  const { cards, error, reload } = useCommentCards(clientId);

  if (error) return <div className="co2-err">{error}</div>;
  if (cards == null) return <div className="ws-loading">Loading comments…</div>;
  if (cards.length === 0) {
    return <div className="cc-empty">No comments waiting. Anything Mattan already answered is hidden.</div>;
  }

  const auto = cards.filter((c) => c.action === 'auto');
  const esc = cards.filter((c) => c.action === 'escalate');

  return (
    <div className="cc-wrap">
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

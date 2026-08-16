import React, { useCallback, useEffect, useState } from 'react';
import {
  fetchArchBallotPending,
  approveArchBallot,
  type ArchBallotPending,
} from '../../../lib/archBallotActions';

/**
 * ARCH biweekly lead ballot — approval card on Today. Renders only while a
 * cycle draft is pending (integration_config.arch_ballot_pending via the
 * k-gated webhook). Nothing reaches Davorin until Ivan approves here: the
 * approve fires the WhatsApp message with the ballot URL (to the ARCH group
 * once configured, until then to Ivan's own WhatsApp as a flagged fallback)
 * and clears the pending draft, so the card clears itself on success.
 */
export function ArchBallotCard() {
  const [pending, setPending] = useState<ArchBallotPending | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentNote, setSentNote] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchArchBallotPending().then(setPending).catch(() => setPending(null));
  }, []);
  useEffect(() => { load(); }, [load]);

  const approve = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await approveArchBallot();
      if (!res.ok) throw new Error(res.error || 'approve failed');
      setSentNote(res.groupMissing
        ? 'Sent to your WhatsApp (arch group not configured yet — forward to Davorin).'
        : `Sent to ${res.sentTo}.`);
      setPending(null);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }, []);

  if (!pending) {
    return sentNote ? (
      <div className="ec-box" style={{ marginBottom: '1.4rem' }}>
        <div className="ec-box-head">ARCH lead ballot · sent</div>
        <div className="ec-data" style={{ marginTop: '0.4rem' }}>{sentNote}</div>
      </div>
    ) : null;
  }

  return (
    <div className="ec-box" style={{ marginBottom: '1.4rem' }}>
      <div className="ec-box-head">ARCH lead ballot · waiting on you</div>
      <div className="ec-data" style={{ marginTop: '0.4rem' }}>
        cycle {pending.cycle || '?'} · drafted {pending.drafted_at ? new Date(pending.drafted_at).toLocaleString() : '?'}
        {' · '}
        <a href={pending.ballot_url} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>
          open ballot
        </a>
      </div>
      <p className="ec-note" style={{ marginTop: '0.6rem', whiteSpace: 'pre-wrap' }}>{pending.summary}</p>
      <div className="ws-actions" style={{ marginTop: '0.6rem' }}>
        <button className="ws-key ws-key--primary" disabled={busy} onClick={approve}>
          {busy ? 'Sending…' : 'Approve → WhatsApp'}
        </button>
      </div>
      <div className="ec-data" style={{ marginTop: '0.5rem' }}>
        Nothing reaches Davorin until you approve. Approving sends the ballot link to the arch chat.
      </div>
      {error ? (
        <div className="ec-data" style={{ marginTop: '0.5rem', color: 'var(--d-bad, #c0392b)' }}>{error}</div>
      ) : null}
    </div>
  );
}

export default ArchBallotCard;

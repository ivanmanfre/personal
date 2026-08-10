import React, { useCallback, useEffect, useState } from 'react';
import {
  fetchWeeklyNotePending,
  approveWeeklyNote,
  weeklyNoteReportUrl,
  type WeeklyNotePending,
} from '../../../lib/weeklyNoteActions';

/**
 * RISE weekly note — approval card on Today (Ivan 2026-08-10, reversing the
 * 07-26 "no approve gate" call). The Monday 19:00 Warsaw run drafts the note
 * and writes NOTHING client-visible; nothing reaches Mattan's board until it
 * is approved here or by WhatsApp reply. Silence publishes nothing, so this
 * card stays up until Ivan acts on it. Approving fires the same server-side
 * write as the WhatsApp path (focus_lines set, pending cleared, client card
 * re-rendered), which is why the card can clear itself on success.
 */
export function WeeklyNoteCard() {
  const [pending, setPending] = useState<WeeklyNotePending | null>(null);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchWeeklyNotePending().then(setPending).catch(() => setPending(null));
  }, []);
  useEffect(() => { load(); }, [load]);

  const send = useCallback(async (overrideText?: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await approveWeeklyNote(overrideText);
      if (!res.ok) throw new Error(res.error || 'approve failed');
      setPending(null);
      setEditing(false);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }, []);

  if (!pending) return null;

  return (
    <div className="ec-box" style={{ marginBottom: '1.4rem' }}>
      <div className="ec-box-head">RISE weekly note · waiting on you</div>
      <div className="ec-data" style={{ marginTop: '0.4rem' }}>
        week of {pending.week_start || '?'} · drafted {pending.sent_at ? new Date(pending.sent_at).toLocaleString() : '?'}
        {pending.week_start ? (
          <>
            {' · '}
            <a href={weeklyNoteReportUrl(pending.week_start)} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>
              full report
            </a>
          </>
        ) : null}
      </div>

      {editing ? (
        <div style={{ marginTop: '0.6rem' }}>
          <textarea
            autoFocus
            className="ws-edit"
            rows={8}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="ws-actions">
            <button className="ws-key ws-key--primary" disabled={busy || !text.trim()} onClick={() => send(text)}>
              {busy ? 'Sending…' : 'Approve my text'}
            </button>
            <button className="ws-key" disabled={busy} onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <>
          <p className="ec-note" style={{ marginTop: '0.6rem', whiteSpace: 'pre-wrap' }}>{pending.draft_text}</p>
          <div className="ws-actions" style={{ marginTop: '0.6rem' }}>
            <button className="ws-key ws-key--primary" disabled={busy} onClick={() => send()}>
              {busy ? 'Sending…' : 'Approve'}
            </button>
            <button
              className="ws-key"
              disabled={busy}
              onClick={() => { setText(pending.draft_text || ''); setEditing(true); }}
            >
              Rewrite
            </button>
          </div>
          <div className="ec-data" style={{ marginTop: '0.5rem' }}>
            Nothing reaches Mattan&apos;s board until you approve. A WhatsApp reply does the same thing.
          </div>
        </>
      )}

      {error ? (
        <div className="ec-data" style={{ marginTop: '0.5rem', color: 'var(--d-bad, #c0392b)' }}>{error}</div>
      ) : null}
    </div>
  );
}

export default WeeklyNoteCard;

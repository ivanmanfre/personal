import React, { useCallback, useEffect, useState } from 'react';
import {
  approveWeeklyNote,
  fetchWeeklyNotePending,
  weeklyNoteReportUrl,
  type WeeklyNotePending,
} from '../../../lib/weeklyNoteActions';
import { toastError, toastSuccess } from '../../../lib/dashboardActions';

/**
 * RISE weekly note — ops inbox card on Today ("Needs you" surface).
 * Shows the Sunday-drafted weekly note awaiting Ivan: draft text, link to
 * the full HTML report, Approve, and an override box. Actions hit the
 * k-gated n8n webhook; approving here does the same write as replying
 * "ok" on WhatsApp (which stays the second path). Card renders nothing
 * when no draft is pending, so the surface stays active-only.
 */
export function WeeklyNoteCard() {
  const [pending, setPending] = useState<WeeklyNotePending | null>(null);
  const [override, setOverride] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetchWeeklyNotePending().then(setPending).catch(() => setPending(null));
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async () => {
    setBusy(true);
    try {
      const r = await approveWeeklyNote(override);
      if (!r.ok) throw new Error(r.error || 'approve failed');
      toastSuccess(override.trim() ? 'Weekly note replaced with your text.' : 'Weekly note approved.');
      setPending(null);
      setOverride('');
    } catch (e) {
      toastError('approve weekly note', e);
    } finally {
      setBusy(false);
    }
  };

  if (!pending) return null;

  return (
    <div className="ec-box" style={{ marginBottom: '1.4rem' }}>
      <div className="ec-box-head">RISE weekly note awaits you</div>
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
      <p className="ec-note" style={{ marginTop: '0.6rem', whiteSpace: 'pre-wrap' }}>{pending.draft_text}</p>
      <textarea
        value={override}
        onChange={(e) => setOverride(e.target.value)}
        placeholder="Optional: your replacement text (sent verbatim instead of the draft)"
        rows={3}
        style={{ width: '100%', marginTop: '0.6rem', font: 'inherit', fontSize: 13, padding: '0.5rem', boxSizing: 'border-box' }}
      />
      <div style={{ marginTop: '0.6rem', display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
        <button type="button" className="ec-btn ec-btn--primary" disabled={busy} onClick={act}>
          {busy ? 'Working…' : override.trim() ? 'Send my text' : 'Approve'}
        </button>
        <span className="ec-data">WhatsApp reply “ok” still works as a second path.</span>
      </div>
    </div>
  );
}

export default WeeklyNoteCard;

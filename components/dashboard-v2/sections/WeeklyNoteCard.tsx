import React, { useCallback, useEffect, useState } from 'react';
import {
  fetchWeeklyNotePending,
  weeklyNoteReportUrl,
  type WeeklyNotePending,
} from '../../../lib/weeklyNoteActions';

/**
 * RISE weekly note — informational card on Today (Ivan 2026-07-26: no approve
 * gate, the note is a report). The Sunday draft auto-applies to the board;
 * this card just shows what went out, with the full-report link. Replacing
 * the text happens by WhatsApp reply before Monday 12:30 UTC. Renders
 * nothing outside the Sunday-to-Monday window (pending doubles as the
 * override window marker).
 */
export function WeeklyNoteCard() {
  const [pending, setPending] = useState<WeeklyNotePending | null>(null);

  const load = useCallback(() => {
    fetchWeeklyNotePending().then(setPending).catch(() => setPending(null));
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!pending) return null;

  return (
    <div className="ec-box" style={{ marginBottom: '1.4rem' }}>
      <div className="ec-box-head">RISE weekly note · on the board for Monday</div>
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
      <div className="ec-data" style={{ marginTop: '0.6rem' }}>
        To replace it, send your text on WhatsApp before Mon 12:30 UTC.
      </div>
    </div>
  );
}

export default WeeklyNoteCard;

import React, { useState } from 'react';
import '../editorial-cockpit.css';
import { useWarmPipeline } from '../../../lib/useCockpitData';

/**
 * Warm Pipeline — the born surface (Direction A, Black Box v4 register).
 *
 * Two modes: a funnel (engaged→DM'd→replied→call-booked from real outreach
 * timestamps, the call-booked tail honestly thin) and an approval queue
 * (followup_drafts pending). The latest genuine inbound reply renders live
 * as a clinical annotation, never hardcoded. This screen's single red is the
 * call-booked figure: the one number the whole funnel exists to move.
 */

type Mode = 'funnel' | 'queue';

function fmt(n: number | null): string {
  return n === null ? '-' : n.toLocaleString();
}

export function WarmPipeline() {
  const [mode, setMode] = useState<Mode>('funnel');
  const data = useWarmPipeline();

  // Stage counts span 938 → 2 (a ~470x spread); a linear width scale would
  // flatten every stage past the first to a sliver. sqrt compresses the range
  // while keeping widths honestly ordered and proportionate to magnitude.
  const maxCount = Math.max(1, ...data.stages.map((s) => s.count ?? 0), data.callBooked ?? 0);
  const maxScaled = Math.sqrt(maxCount);
  const width = (n: number | null) => (n === null ? 100 : Math.max(2, (Math.sqrt(Math.max(n, 0)) / maxScaled) * 100));

  const reply = data.reply;
  const at = reply.at ? new Date(reply.at) : null;

  return (
    <div className="ec">
      {/* Topline: compressed document header (the dark masthead band is cut) */}
      <div className="ec-topline">
        <span className="ec-topline-brand">Operator console · Warm pipeline</span>
        <span className="ec-topline-meta">
          outreach_prospects · {data.loading ? 'Reading' : `${fmt(data.stages[0]?.count ?? null)} ever contacted`}
        </span>
      </div>

      <h1 className="ec-hed ec-hed--today">Warm pipeline</h1>

      <div className="ec-tabs" role="tablist">
        <button role="tab" aria-selected={mode === 'funnel'} className="ec-tab" onClick={() => setMode('funnel')}>The funnel</button>
        <button role="tab" aria-selected={mode === 'queue'} className="ec-tab" onClick={() => setMode('queue')}>Approval queue</button>
      </div>

      {mode === 'funnel' ? (
        <div className="ec-cols">
          {/* Funnel data-spread */}
          <div className="ec-col-lead">
            <div className="ec-kicker">The spread</div>
            <div className="ec-data" title="bar width uses a sqrt scale so a 938→2 spread stays honestly ordered; linear would flatten every stage past the first">
              cumulative reach · sqrt-scaled bars
            </div>
            <div className="ec-funnel" style={{ marginTop: '1.2rem' }}>
              {data.stages.map((s) => (
                <div className="ec-fun-row" key={s.key}>
                  <span className="ec-fun-label">{s.label}</span>
                  <span className="ec-fun-track">
                    <span className={`ec-fun-fill ${s.count === null ? 'ec-fun-fill--off' : ''}`} style={{ width: `${width(s.count)}%` }} />
                  </span>
                  <span className="ec-fun-num">{fmt(s.count)}</span>
                </div>
              ))}
              {/* Call-booked tail — honestly thin */}
              <div className="ec-fun-row">
                <span className="ec-fun-label">Call booked</span>
                <span className="ec-fun-track">
                  <span className={`ec-fun-fill ec-fun-fill--tail ${data.callBooked === null ? 'ec-fun-fill--off' : ''}`} style={{ width: `${width(data.callBooked)}%` }} />
                </span>
                <span className="ec-fun-num ec-fun-num--tail">{fmt(data.callBooked)}</span>
              </div>
            </div>
          </div>

          {/* Pull-quote rail */}
          <div className="ec-col-rail">
            <div className="ec-card-lbl">Latest reply</div>
            {reply.state === 'loading' ? (
              <div className="ec-note">reading outreach_messages…</div>
            ) : reply.state === 'offline' ? (
              <span className="ec-offline">source offline{reply.error ? `: ${reply.error.slice(0, 50)}` : ''}</span>
            ) : reply.text ? (
              <blockquote className="ec-pull">
                <div className="ec-pull-q">“{reply.text.slice(0, 220)}{reply.text.length > 220 ? '…' : ''}”</div>
                <div className="ec-pull-attr">
                  {reply.name || 'a prospect'}
                  {reply.company ? <span> · {reply.company}</span> : null}
                  <br />
                  <span>
                    {at ? at.toISOString().slice(0, 16).replace('T', ' ') + 'Z' : ''} · inbound · linkedin
                  </span>
                </div>
              </blockquote>
            ) : (
              <div className="ec-note">No genuine inbound reply on record yet.</div>
            )}
          </div>
        </div>
      ) : (
        <div>
          <div className="ec-kicker">Waiting on you</div>
          <h2 className="ec-subhead">
            {data.queue.state === 'offline'
              ? 'Approval source offline'
              : data.loading
                ? 'Reading the queue…'
                : `${data.queue.items.length} warm draft${data.queue.items.length === 1 ? '' : 's'} pending approval.`}
          </h2>
          {data.queue.state === 'offline' ? (
            <span className="ec-offline">source offline{data.queue.error ? `: ${data.queue.error.slice(0, 60)}` : ''}</span>
          ) : data.queue.items.length === 0 && !data.loading ? (
            <p className="ec-note">No warm follow-ups awaiting approval. The war-room table is a roadmap source for this queue.</p>
          ) : (
            <div>
              {data.queue.items.map((it) => (
                <div className="ec-q-row" key={it.id}>
                  <div className="ec-q-head">
                    <span className="ec-q-name">{it.prospect}</span>
                    <span className="ec-item-tag">followup_drafts · pending</span>
                  </div>
                  {it.subject && <div className="ec-q-subject">{it.subject}</div>}
                  {it.preview && <div className="ec-q-preview">{it.preview}{it.preview.length >= 220 ? '…' : ''}</div>}
                  <div className="ec-q-actions">
                    <button className="ec-btn ec-btn--primary" disabled>Approve</button>
                    <button className="ec-btn" disabled>Edit</button>
                    <button className="ec-btn" disabled>Skip</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default WarmPipeline;

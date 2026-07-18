import React, { useMemo } from 'react';
import '../editorial-cockpit.css';
import { useTodayFeeds, type TriageFeed } from '../../../lib/useCockpitData';
import { usePulse } from '../../../lib/usePulse';
import type { SectionId } from '../types';

/**
 * Today — the Editorial Cockpit opening screen (Direction A).
 *
 * Front-page hierarchy: a masthead (the one dark band), an above-the-fold
 * triage strip built from §5f numeral lockups over REAL feeds, then a lead
 * "Needs you" column and a marginalia rail (client tile + freshness + n8n red).
 * Every count is live; a blocked feed shows an honest `offline` state.
 */

type NavFn = (section: SectionId, sub?: string) => void;

const nowLabel = () => {
  const d = new Date();
  return d
    .toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    .toUpperCase();
};

interface LockupProps {
  value: TriageFeed | { state: string; count: number };
  label: React.ReactNode;
  sub?: string;
  tone?: 'ink' | 'sage' | 'alarm' | 'muted';
  onClick?: () => void;
}

function Lockup({ value, label, sub, tone = 'ink', onClick }: LockupProps) {
  const offline = value.state === 'offline';
  const loading = value.state === 'loading';
  const numClass =
    tone === 'sage' ? 'ec-lockup-num--sage'
    : tone === 'alarm' ? 'ec-lockup-num--alarm'
    : tone === 'muted' ? 'ec-lockup-num--muted'
    : '';
  return (
    <button type="button" className="ec-lockup" onClick={onClick}>
      <span className={`ec-lockup-num ${offline || loading ? 'ec-lockup-num--muted' : numClass}`}>
        {offline ? '—' : loading ? '·' : value.count}
      </span>
      <span className="ec-lockup-label">{label}</span>
      {offline ? (
        <span className="ec-lockup-sub ec-lockup-sub--offline">source offline</span>
      ) : sub ? (
        <span className="ec-lockup-sub">{sub}</span>
      ) : null}
    </button>
  );
}

export function Today({ onNavigate }: { onNavigate?: NavFn }) {
  const feeds = useTodayFeeds();
  const { results: pulse, probedAt } = usePulse();

  // Drift alarms = live non-dormant sources that have gone quiet or frozen.
  const drift = useMemo(
    () => pulse.filter((r) => (r.status === 'quiet' || r.status === 'frozen')),
    [pulse],
  );

  const go = (s: SectionId, sub?: string) => () => onNavigate?.(s, sub);

  const firstTitle = (f: TriageFeed) => (f.items[0] ? f.items[0].slice(0, 22) + (f.items[0].length > 22 ? '…' : '') : '');

  // Build the "Needs you" lead list from the real pending items.
  const lead: { idx: string; title: string; meta: string; tag: string; alarm?: boolean }[] = [];
  feeds.postsReview.items.slice(0, 3).forEach((t) =>
    lead.push({ idx: '↳', title: t, meta: 'carousel_drafts · status=review', tag: 'approve post', alarm: false }),
  );
  if (feeds.warmFollowups.items[0]) {
    lead.push({ idx: '↳', title: `Warm follow-up ready for ${feeds.warmFollowups.items[0]}`, meta: 'followup_drafts · pending_approval', tag: 'send warm' });
  }
  feeds.commentDrafts.items.slice(0, 2).forEach((t) =>
    lead.push({ idx: '↳', title: `Comment drafted on ${t}`, meta: 'comment_feed · pending', tag: 'approve comment' }),
  );

  return (
    <div className="ec">
      {/* Masthead — the single dark band */}
      <div className="ec-masthead">
        <div className="ec-masthead-name">The <em>Cockpit</em></div>
        <div className="ec-masthead-meta">
          <span className="ec-edition">TODAY · EDITION</span>
          <span>{nowLabel()}</span>
          <span>{probedAt ? `PROBED ${new Date(probedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'PROBING…'}</span>
        </div>
      </div>

      <div className="ec-dateline">Front page · what needs you now</div>
      <h1 className="ec-hed">The work waiting on your judgment.</h1>
      <p className="ec-dek">
        Six live queues, read straight off the pipeline. Taste is the moat, so nothing here
        auto-fires — every number is a decision you still <span className="ec-sage-sweep">own</span>.
      </p>

      {/* Above-the-fold triage strip — §5f numeral lockups */}
      <div className="ec-strip">
        <Lockup value={feeds.postsReview} label={<>Posts in<br />review</>} sub={firstTitle(feeds.postsReview)} onClick={go('content', 'posts')} />
        <Lockup value={feeds.commentDrafts} label={<>Comment<br />drafts</>} tone="sage" sub={feeds.commentDrafts.items[0] || undefined} onClick={go('pipeline')} />
        <Lockup value={feeds.warmFollowups} label={<>Warm<br />follow-ups</>} tone="sage" sub={feeds.warmFollowups.items[0] || undefined} onClick={go('pipeline')} />
        <Lockup value={feeds.workflowsRed} label={<>Workflows<br />red / stuck</>} tone="alarm" sub={firstTitle(feeds.workflowsRed)} onClick={go('system')} />
        <Lockup value={feeds.scheduledToday} label={<>Scheduled<br />today</>} tone="muted" sub={firstTitle(feeds.scheduledToday)} onClick={go('content', 'calendar')} />
        <Lockup
          value={{ state: pulse.length ? 'ok' : 'loading', count: drift.length }}
          label={<>Drift<br />alarms</>}
          tone={drift.length ? 'alarm' : 'muted'}
          sub={drift[0]?.entry.label}
          onClick={go('system')}
        />
      </div>

      <div className="ec-cols">
        {/* Lead column — Needs you */}
        <div className="ec-col-lead">
          <div className="ec-kicker">Needs you</div>
          <h2 className="ec-subhead">The lead: {feeds.loading ? '…' : lead.length} items are one click from done.</h2>
          {feeds.loading ? (
            <p className="ec-note">Reading the pipeline…</p>
          ) : lead.length === 0 ? (
            <p className="ec-note">Queues clear. Nothing waiting on your approval right now.</p>
          ) : (
            <div className="ec-list">
              {lead.map((it, i) => (
                <div className="ec-item" key={i}>
                  <span className="ec-item-idx">{String(i + 1).padStart(2, '0')}</span>
                  <div className="ec-item-body">
                    <div className="ec-item-title">{it.title}</div>
                    <div className="ec-item-meta">{it.meta}</div>
                  </div>
                  <span className={`ec-item-tag ${it.alarm ? 'ec-item-tag--alarm' : ''}`}>{it.tag}</span>
                </div>
              ))}
            </div>
          )}

          <hr className="ec-rule" />

          {/* n8n red — real workflow names */}
          <div className="ec-kicker">System desk · n8n</div>
          <h2 className="ec-subhead">
            {feeds.workflowsRed.state === 'offline' ? 'Workflow health unreadable' : `${feeds.workflowsRed.count} workflows last ran red.`}
          </h2>
          {feeds.workflowsRed.state === 'offline' ? (
            <span className="ec-offline">source offline — {feeds.workflowsRed.error?.slice(0, 60)}</span>
          ) : (
            <div className="ec-list">
              {feeds.workflowsRed.items.slice(0, 5).map((w, i) => (
                <div className="ec-item" key={i}>
                  <span className="ec-item-idx" style={{ color: 'var(--ec-red)' }}>✕</span>
                  <div className="ec-item-body">
                    <div className="ec-item-title">{w}</div>
                    <div className="ec-item-meta">dashboard_workflow_stats · last_execution_status=error</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Rail — marginalia */}
        <div className="ec-col-rail">
          {/* Client tile */}
          <div className="ec-card">
            <div className="ec-card-lbl">Client of record</div>
            {feeds.clientTile.state === 'loading' ? (
              <div className="ec-note">reading client_registry…</div>
            ) : feeds.clientTile.rows > 0 ? (
              <>
                <div className="ec-card-headline">{feeds.clientTile.names[0] || `${feeds.clientTile.rows} clients`}</div>
                <div className="ec-data" style={{ marginTop: '0.4rem' }}>
                  client_registry · {feeds.clientTile.rows} row{feeds.clientTile.rows === 1 ? '' : 's'}
                </div>
              </>
            ) : (
              <>
                <div className="ec-card-headline">Registry present, anon-blocked.</div>
                <p className="ec-note" style={{ marginTop: '0.5rem' }}>
                  <span className="ec-mono">client_registry</span> returns 0 rows to the dashboard's public
                  key. Rise DTC — the first paying client — lives here; the rebuild reads it server-side.
                </p>
                <span className="ec-offline" style={{ marginTop: '0.5rem' }}>anon RLS · 0 rows</span>
              </>
            )}
          </div>

          {/* Freshness / drift */}
          <div className="ec-card">
            <div className="ec-card-lbl">Freshness watch</div>
            {pulse.length === 0 ? (
              <div className="ec-note">probing sources…</div>
            ) : drift.length === 0 ? (
              <>
                <div className="ec-card-headline">All live feeds fresh.</div>
                <div className="ec-data" style={{ marginTop: '0.4rem' }}>{pulse.length} sources probed · 0 drifting</div>
              </>
            ) : (
              <>
                <div className="ec-card-headline">{drift.length} feed{drift.length === 1 ? '' : 's'} drifting.</div>
                <div className="ec-list" style={{ marginTop: '0.6rem' }}>
                  {drift.slice(0, 5).map((r) => (
                    <div className="ec-item" key={r.entry.id} style={{ padding: '0.5rem 0' }}>
                      <div className="ec-item-body">
                        <div className="ec-item-title" style={{ fontSize: 13 }}>{r.entry.label}</div>
                        <div className="ec-item-meta">{r.entry.table}</div>
                      </div>
                      <span className={`ec-item-tag ${r.status === 'frozen' ? 'ec-item-tag--alarm' : ''}`}>{r.status}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Scheduled today marginalia */}
          <div className="ec-card">
            <div className="ec-card-lbl">On the schedule</div>
            {feeds.scheduledToday.state === 'offline' ? (
              <span className="ec-offline">source offline</span>
            ) : feeds.scheduledToday.count === 0 ? (
              <div className="ec-note">Nothing scheduled to post today.</div>
            ) : (
              <>
                <div className="ec-card-headline">{feeds.scheduledToday.count} post{feeds.scheduledToday.count === 1 ? '' : 's'} today.</div>
                {feeds.scheduledToday.items[0] && (
                  <p className="ec-note" style={{ marginTop: '0.4rem' }}>“{feeds.scheduledToday.items[0].slice(0, 90)}{feeds.scheduledToday.items[0].length > 90 ? '…' : ''}”</p>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <p className="ec-footnote">
        Editorial Cockpit · Direction A — born-dead tournament branch. All figures read live from Supabase
        via the dashboard's anon client; nothing writes. Blocked feeds are shown as “source offline,” never faked.
      </p>
    </div>
  );
}

export default Today;

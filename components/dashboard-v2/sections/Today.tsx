import React, { useMemo } from 'react';
import '../editorial-cockpit.css';
import { useTodayFeeds, type TriageFeed } from '../../../lib/useCockpitData';
import { usePulse } from '../../../lib/usePulse';
import { useChangelog, type ChangelogItem } from '../../../lib/useChangelog';
import { useCountUp } from '../primitives/useCountUp';
import type { SectionId } from '../types';

/**
 * Today — Direction A opening screen, Black Box v4 register (founder
 * correction 2026-07-18: editorial register replaced by brand canon).
 *
 * Front-page hierarchy kept: statement headline (Schibsted 800, very big),
 * an above-the-fold triage strip of stat lockups over REAL feeds, then the
 * "Needs you" lead queue and a receipts rail (client tile + drift warning
 * box + schedule). The drift alarm is the boxed warning; the drift count is
 * this screen's single red. Every count is live; a blocked feed shows an
 * honest offline state.
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
  tone?: 'ink' | 'muted';
  onClick?: () => void;
}

function Lockup({ value, label, sub, tone = 'ink', onClick }: LockupProps) {
  const offline = value.state === 'offline';
  const loading = value.state === 'loading';
  const numClass = tone === 'muted' ? 'ec-lockup-num--muted' : '';
  // Numeral settle: count-up once on load, respects prefers-reduced-motion
  // (handled inside useCountUp).
  const animated = useCountUp(offline || loading ? 0 : (value.count ?? 0));
  return (
    <button type="button" className="ec-lockup" onClick={onClick}>
      <span className={`ec-lockup-num ${offline || loading ? 'ec-lockup-num--muted' : numClass}`}>
        {offline ? '-' : loading ? '·' : animated}
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

/**
 * "Since you last looked" — the alive strip. One horizontal, mono-register run
 * of what changed since the last visit (max 5). Clicking an item jumps to the
 * owning section. First visit: "baseline set today". Zero changes: muted note.
 * Hairline top rule only — no borders, no prose.
 */
function ChangelogStrip({ items, firstVisit, loading, onNavigate }: {
  items: ChangelogItem[];
  firstVisit: boolean;
  loading: boolean;
  onNavigate?: NavFn;
}) {
  let body: React.ReactNode;
  if (loading && items.length === 0 && !firstVisit) {
    body = <span className="ec-changelog-empty">checking for changes…</span>;
  } else if (firstVisit) {
    body = <span className="ec-changelog-empty">baseline set today</span>;
  } else if (items.length === 0) {
    body = <span className="ec-changelog-empty">no changes since yesterday</span>;
  } else {
    body = items.map((it) => (
      <button
        key={it.id}
        type="button"
        className="ec-changelog-item"
        onClick={() => onNavigate?.(it.section, it.sub)}
        title={`Open ${it.section}`}
      >
        <span className="ec-changelog-what">{it.what}</span>
        <span className="ec-changelog-sep">·</span>
        <span className="ec-changelog-when">{it.when}</span>
      </button>
    ));
  }
  return (
    <div className="ec-changelog">
      <span className="ec-changelog-lbl">Since you last looked</span>
      <div className="ec-changelog-run">{body}</div>
    </div>
  );
}

export function Today({ onNavigate }: { onNavigate?: NavFn }) {
  const feeds = useTodayFeeds();
  const { results: pulse, probedAt } = usePulse();
  const changelog = useChangelog();

  // Drift alarms = live non-dormant sources that have gone quiet or frozen.
  const drift = useMemo(
    () => pulse.filter((r) => (r.status === 'quiet' || r.status === 'frozen')),
    [pulse],
  );

  const go = (s: SectionId, sub?: string) => () => onNavigate?.(s, sub);

  const firstTitle = (f: TriageFeed) => (f.items[0] ? f.items[0].slice(0, 22) + (f.items[0].length > 22 ? '…' : '') : '');

  // Build the "Needs you" lead list from the real pending items. `meta` is
  // provenance — shown on hover only (feedback #4: no caption under every row).
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
      {/* Functional header: "Today" at display scale + the date as quiet meta.
          No narrative headline (feedback #2). */}
      <div className="ec-topline">
        <span className="ec-topline-brand">Today</span>
        <span className="ec-topline-meta">
          {nowLabel()}
          {' · '}
          {probedAt ? `Probed ${new Date(probedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Probing'}
        </span>
      </div>

      <h1 className="ec-hed ec-hed--today">Today</h1>

      {/* Since you last looked — the alive strip (build 1). */}
      <ChangelogStrip
        items={changelog.items}
        firstVisit={changelog.firstVisit}
        loading={changelog.loading}
        onNavigate={onNavigate}
      />

      {/* Above-the-fold triage strip — stat lockups over real feeds */}
      <div className="ec-strip">
        <Lockup value={feeds.postsReview} label={<>Posts in<br />review</>} sub={feeds.postsReviewClient.count > 0 ? `+${feeds.postsReviewClient.count} client in review` : firstTitle(feeds.postsReview)} onClick={go('posts')} />
        <Lockup value={feeds.commentDrafts} label={<>Comment<br />drafts</>} sub={feeds.commentDrafts.items[0] || undefined} onClick={go('warm')} />
        <Lockup value={feeds.warmFollowups} label={<>Warm<br />follow-ups</>} sub={feeds.warmFollowups.items[0] || undefined} onClick={go('warm')} />
        <Lockup value={feeds.workflowsRed} label={<>Workflows<br />red / stuck</>} sub={firstTitle(feeds.workflowsRed)} onClick={go('health')} />
        <Lockup value={feeds.scheduledToday} label={<>Scheduled<br />today</>} tone="muted" sub={firstTitle(feeds.scheduledToday)} onClick={go('posts')} />
        <Lockup
          value={{ state: pulse.length ? 'ok' : 'loading', count: drift.length }}
          label={<>Drift<br />alarms</>}
          tone={drift.length ? 'ink' : 'muted'}
          sub={drift[0]?.entry.label}
          onClick={go('pulse')}
        />
      </div>

      <div className="ec-cols">
        {/* Lead column — Needs you. Row provenance lives in a hover tooltip
            (title), not a caption under every row (feedback #4). */}
        <div className="ec-col-lead">
          <div className="ec-kicker">Needs you</div>
          {feeds.loading ? (
            <p className="ec-note">Reading the pipeline…</p>
          ) : lead.length === 0 ? (
            <p className="ec-note">Queues clear.</p>
          ) : (
            <div className="ec-list">
              {lead.map((it, i) => (
                <div className="ec-item ec-item--hover" key={i} title={it.meta}>
                  <span className="ec-item-idx">{String(i + 1).padStart(2, '0')}</span>
                  <div className="ec-item-body">
                    <div className="ec-item-title">{it.title}</div>
                  </div>
                  <span className={`ec-item-tag ${it.alarm ? 'ec-item-tag--alarm' : ''}`}>{it.tag}</span>
                </div>
              ))}
            </div>
          )}

          <hr className="ec-rule" />

          {/* n8n red — real workflow names */}
          <div className="ec-kicker">
            System · n8n
            <span className="ec-kicker-count">{feeds.workflowsRed.state === 'offline' ? '—' : feeds.workflowsRed.count}</span>
          </div>
          {feeds.workflowsRed.state === 'offline' ? (
            <span className="ec-offline" title={feeds.workflowsRed.error || undefined}>source offline</span>
          ) : (
            <div className="ec-list">
              {feeds.workflowsRed.items.slice(0, 5).map((w, i) => (
                <div className="ec-item ec-item--hover" key={i} title="dashboard_workflow_stats · last_execution_status=error">
                  <span className="ec-item-idx">✕</span>
                  <div className="ec-item-body">
                    <div className="ec-item-title">{w}</div>
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
                <div className="ec-card-headline">Rise DTC</div>
                <span className="ec-offline" style={{ marginTop: '0.5rem' }} title="client_registry returns 0 rows to the dashboard anon key; the rebuild reads it server-side">anon RLS · 0 rows</span>
              </>
            )}
          </div>

          {/* Drift alarm: the boxed warning, played straight. The drift count
              is this composition's single red. */}
          <div className={`ec-box${drift.length ? ' ec-box--tilt' : ''}`}>
            {pulse.length === 0 ? (
              <>
                <div className="ec-box-head">Freshness watch</div>
                <div className="ec-note" style={{ marginTop: '0.5rem' }}>probing sources…</div>
              </>
            ) : drift.length === 0 ? (
              <>
                <div className="ec-box-head">Freshness: 0 feeds drifting</div>
                <div className="ec-data" style={{ marginTop: '0.5rem' }}>{pulse.length} sources probed · all live feeds fresh</div>
              </>
            ) : (
              <>
                <div className="ec-box-head">
                  Warning: <span className="ec-red">{drift.length}</span> feed{drift.length === 1 ? '' : 's'} drifting
                </div>
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
                <div className="ec-data" style={{ marginTop: '0.6rem' }}>{pulse.length} sources probed</div>
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
    </div>
  );
}

export default Today;

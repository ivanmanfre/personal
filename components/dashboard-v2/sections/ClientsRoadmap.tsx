import React from 'react';
import '../editorial-cockpit.css';
import { useRiseDtcHome } from '../../../hooks/useRiseDtcHome';

/**
 * Rise DTC — live client home (Black Box v4 register). READ-ONLY surface.
 *
 * The one real paying client (client_id='risedtc', Mattan). Replaces the old
 * 52-line static roadmap stub. Every count is live; a blocked feed shows an
 * honest gated/empty state (never faked data). No mutations here — approvals
 * happen on the client's own token-gated board, not on Ivan's dashboard.
 *
 * Sources (all client_id='risedtc'): carousel_drafts, lm_drafts_v2,
 * calendar_events. client_registry is anon-RLS gated (0 rows) and shown as a
 * labeled note. Board is magic-link gated at /client/risedtc.
 */

// Engagement month 1 began on the first-payment date (business truth, MEMORY.md
// 2026-07-17). A fixed reference, not live data.
const MONTH1_START = new Date('2026-07-17T00:00:00Z');
const BOARD_SLUG = 'risedtc';

function shortWhen(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function callWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function engagementDay(): number {
  const ms = Date.now() - MONTH1_START.getTime();
  return Math.max(1, Math.floor(ms / 86400000) + 1);
}

export function ClientsRoadmap() {
  const home = useRiseDtcHome();
  const reviewCount =
    home.contentByStatus.find((s) => s.status === 'review')?.count ?? 0;
  const lmReview =
    home.lmByStatus.find((s) => s.status === 'review')?.count ?? 0;

  return (
    <div className="ec">
      <div className="ec-topline">
        <span className="ec-topline-brand">RISE DTC</span>
        <span className="ec-topline-meta">
          Client of record · Mattan · Engagement month 1, day {engagementDay()}
        </span>
      </div>

      <h1 className="ec-hed ec-hed--today">RISE DTC</h1>

      {/* Above-the-fold stat strip — live counts scoped to client_id=risedtc */}
      <div className="ec-strip">
        <StatLockup
          num={home.loading ? '·' : String(home.contentTotal)}
          label={<>Content<br />drafts</>}
        />
        <StatLockup
          num={home.loading ? '·' : String(reviewCount)}
          label={<>In<br />review</>}
        />
        <StatLockup
          num={home.loading ? '·' : String(home.lmTotal)}
          label={<>Lead<br />magnets</>}
        />
        <StatLockup
          num={home.loading ? '·' : lmReview ? String(lmReview) : '0'}
          label={<>LM in<br />review</>}
          muted={!lmReview}
        />
        <StatLockup
          num={home.nextCall ? shortWhen(home.nextCall.startTime) : '—'}
          label={<>Next<br />call</>}
          muted={!home.nextCall}
        />
        <StatLockup num={String(engagementDay())} label={<>Engagement<br />day</>} muted />
      </div>

      <div className="ec-cols">
        {/* Lead column — the content queue */}
        <div className="ec-col-lead">
          <div className="ec-kicker">
            Content queue
            <span className="ec-kicker-count">{home.loading ? '·' : home.contentTotal}</span>
          </div>

          {home.loading ? (
            <p className="ec-note">Reading carousel_drafts…</p>
          ) : home.contentBlocked ? (
            <span className="ec-offline" title="carousel_drafts query errored for the anon key">
              source offline
            </span>
          ) : home.contentTotal === 0 ? (
            <p className="ec-note">No content drafts for RISE DTC yet.</p>
          ) : (
            <>
              {/* status breakdown */}
              <div className="ec-list">
                {home.contentByStatus.map((s) => (
                  <div className="ec-item" key={s.status}>
                    <div className="ec-item-body">
                      <div className="ec-item-title">{s.status}</div>
                    </div>
                    <span className="ec-kicker-count">{s.count}</span>
                  </div>
                ))}
              </div>

              <hr className="ec-rule" />

              {/* recent drafts */}
              <div className="ec-kicker">Recent drafts</div>
              <div className="ec-list">
                {home.contentRecent.map((d, i) => (
                  <div
                    className="ec-item ec-item--hover"
                    key={d.id}
                    title={`carousel_drafts · updated ${shortWhen(d.updatedAt)}`}
                  >
                    <span className="ec-item-idx">{String(i + 1).padStart(2, '0')}</span>
                    <div className="ec-item-body">
                      <div className="ec-item-title">{d.title || '(untitled)'}</div>
                    </div>
                    <span
                      className={`ec-item-tag ${d.status === 'review' ? 'ec-item-tag--alarm' : ''}`}
                    >
                      {d.status}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          <hr className="ec-rule" />

          {/* Lead magnets */}
          <div className="ec-kicker">
            Lead magnets
            <span className="ec-kicker-count">{home.loading ? '·' : home.lmTotal}</span>
          </div>
          {home.loading ? (
            <p className="ec-note">Reading lm_drafts_v2…</p>
          ) : home.lmBlocked ? (
            <span className="ec-offline">source offline</span>
          ) : home.lmTotal === 0 ? (
            <p className="ec-note">No lead magnets for RISE DTC yet.</p>
          ) : (
            <div className="ec-list">
              {home.lmItems.map((lm, i) => (
                <div
                  className="ec-item ec-item--hover"
                  key={lm.id}
                  title={`lm_drafts_v2 · updated ${shortWhen(lm.updatedAt)}`}
                >
                  <span className="ec-item-idx">{String(i + 1).padStart(2, '0')}</span>
                  <div className="ec-item-body">
                    <div className="ec-item-title">{lm.topic}</div>
                    {lm.format ? <div className="ec-item-meta">{lm.format}</div> : null}
                  </div>
                  <span
                    className={`ec-item-tag ${lm.status === 'review' ? 'ec-item-tag--alarm' : ''}`}
                  >
                    {lm.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Rail — next call, board link, registry note */}
        <div className="ec-col-rail">
          {/* Next call */}
          <div className="ec-card">
            <div className="ec-card-lbl">Next call</div>
            {home.loading ? (
              <div className="ec-note">reading calendar_events…</div>
            ) : home.callBlocked ? (
              <span className="ec-offline">source offline</span>
            ) : home.nextCall ? (
              <>
                <div className="ec-card-headline">{callWhen(home.nextCall.startTime)}</div>
                <div className="ec-data" style={{ marginTop: '0.4rem' }}>
                  {home.nextCall.title}
                </div>
                {home.nextCall.meetingUrl ? (
                  <a
                    className="ec-btn"
                    style={{ marginTop: '0.7rem', display: 'inline-block' }}
                    href={home.nextCall.meetingUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open meeting
                  </a>
                ) : null}
              </>
            ) : (
              <div className="ec-note">No upcoming call scheduled.</div>
            )}
          </div>

          {/* Client board — magic-link gated */}
          <div className="ec-card">
            <div className="ec-card-lbl">Client board</div>
            <div className="ec-note" style={{ marginBottom: '0.6rem' }}>
              The client approves drafts on their own board, not here. Magic-link gated.
            </div>
            <a
              className="ec-btn ec-btn--primary"
              style={{ display: 'inline-block' }}
              href={`/client/${BOARD_SLUG}`}
              target="_blank"
              rel="noreferrer"
            >
              Open RISE DTC board
            </a>
            <div className="ec-data" style={{ marginTop: '0.5rem' }}>
              /client/{BOARD_SLUG} · get_client_board(p_slug, p_token)
            </div>
          </div>

          {/* Registry note — honest gated state */}
          <div className="ec-card">
            <div className="ec-card-lbl">Registry</div>
            {home.registryVisible ? (
              <div className="ec-data">client_registry · risedtc row visible</div>
            ) : (
              <span
                className="ec-offline"
                title="client_registry returns 0 rows to the dashboard anon key (rows hold live secrets); read server-side"
              >
                anon RLS · gated
              </span>
            )}
          </div>

          {/* Engagement */}
          <div className="ec-card">
            <div className="ec-card-lbl">Engagement</div>
            <div className="ec-card-headline">Month 1</div>
            <div className="ec-data" style={{ marginTop: '0.4rem' }}>
              Started Jul 17, 2026 · day {engagementDay()}
            </div>
          </div>
        </div>
      </div>

      <div className="ec-footnote">
        Read-only. Sources scoped to client_id=risedtc: carousel_drafts,
        lm_drafts_v2, calendar_events. Approvals live on the token-gated board.
      </div>
    </div>
  );
}

function StatLockup({
  num,
  label,
  muted,
}: {
  num: string;
  label: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div className="ec-lockup" style={{ cursor: 'default' }}>
      <span className={`ec-lockup-num ${muted ? 'ec-lockup-num--muted' : ''}`}>{num}</span>
      <span className="ec-lockup-label">{label}</span>
    </div>
  );
}

export default ClientsRoadmap;

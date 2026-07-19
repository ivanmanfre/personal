import React, { useCallback, useMemo, useState } from 'react';
import { RefreshCw, BookOpen, ChevronDown, ChevronUp, Tag, Check, ExternalLink, Users, Search } from 'lucide-react';
import { useMeetings } from '../../../../hooks/useMeetings';
import { useUpcomingEvents } from '../../../../hooks/useUpcomingEvents';
import { useAutoRefresh } from '../../../../hooks/useAutoRefresh';
import { meetingTypeConfig, MEETING_TYPE_OPTIONS } from '../../../../lib/meetingTypes';
import type { CalendarEvent, MeetingType } from '../../../../types/dashboard';
import '../../editorial-cockpit.css';
import '../../review/worksurface.css';
import './calls/callsurface.css';
import MeetingCard from './calls/MeetingCard';
import CallScript from './calls/CallScript';
import IssueIntake from './calls/IssueIntake';

/*
 * Calls — interiors rebuild (Black Box v4 register, scoped `.ec`).
 *
 * Elevate move: the NEXT UPCOMING CALL is promoted to a working hero at the top
 * (day/time, attendees, meeting-type override, join), with its pre-call
 * playbook + live call script beside it — the way Outreach promoted replies.
 * The transcript feed sits below with search. Every gradient chrome (emerald
 * script viewer, amber playbook) is now a flat bordered box; categorical chips
 * (action / topic / screen) are ink labels; the fit-score badge stays semantic
 * via weight/box, never hue. Every write path is reused verbatim from its hook
 * or the ledger; none is re-implemented here.
 */

const PLAYBOOK_STEPS = [
  { num: '1', text: 'Quantify the pain', detail: '"How long does that take you? How often?" Make them feel the cost before you quote.' },
  { num: '2', text: 'Who else decides?', detail: '"Is anyone else involved in this decision?" Avoid proposals that stall in someone\'s inbox.' },
  { num: '3', text: 'Anchor value before price', detail: 'Recap what they are losing (time, money, opportunities), then give the range.' },
  { num: '4', text: 'Book the next step', detail: '"When would you like to kick this off? Can we book a follow-up for [day]?" Never end with just "I\'ll send a proposal."' },
];

const Playbook: React.FC = () => {
  const [open, setOpen] = useState(false);
  return (
    <div className="cl-disc">
      <button className="cl-disc-head" onClick={() => setOpen(!open)}>
        <span className="cl-disc-title"><BookOpen className="w-3.5 h-3.5" style={{ marginRight: '-0.15rem' }} /> Pre-call playbook</span>
        <span className="cl-disc-chev">{open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</span>
      </button>
      {open && (
        <div className="cl-disc-body">
          <div className="cl-steps">
            {PLAYBOOK_STEPS.map((s) => (
              <div className="cl-step" key={s.num}>
                <span className="cl-step-num">{s.num}</span>
                <div>
                  <div className="cl-step-txt">{s.text}</div>
                  <div className="cl-step-detail">{s.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const MeetingTypeBadge: React.FC<{ event: CalendarEvent; onChange: (t: MeetingType) => void }> = ({ event, onChange }) => {
  const [open, setOpen] = useState(false);
  const cfg = meetingTypeConfig(event.meetingType);
  return (
    <div className="cl-type">
      <button
        className="cl-type-btn"
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        title={`Meeting type: ${cfg.label}. Click to override.`}
      >
        <Tag className="w-2.5 h-2.5" /> {cfg.shortLabel}
      </button>
      {open && (
        <>
          <div className="cl-type-scrim" onClick={() => setOpen(false)} />
          <div className="cl-type-menu">
            {MEETING_TYPE_OPTIONS.map((t) => {
              const active = event.meetingType === t;
              return (
                <button
                  key={t}
                  className={`cl-type-opt ${active ? 'cl-type-opt--on' : ''}`}
                  onClick={(e) => { e.stopPropagation(); onChange(t); setOpen(false); }}
                >
                  {meetingTypeConfig(t).label}
                  {active && <Check className="w-3 h-3" style={{ marginLeft: 'auto' }} />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

interface When { day: string; today: boolean; time: string; end: string; soon: boolean; }
function describeWhen(event: CalendarEvent): When {
  const start = new Date(event.startTime);
  const end = new Date(event.endTime);
  const now = new Date();
  const diffMs = start.getTime() - now.getTime();
  const today = start.toDateString() === now.toDateString();
  const tomorrow = start.toDateString() === new Date(now.getTime() + 86400000).toDateString();
  const time = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const endStr = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const day = today ? 'Today' : tomorrow ? 'Tomorrow' : start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return { day, today, time, end: endStr, soon: diffMs > 0 && diffMs < 3600000 };
}

const CallsRebuilt: React.FC = () => {
  const [search, setSearch] = useState('');
  const { meetings, stats, loading, refresh } = useMeetings();
  const { events, todayEvents, refresh: refreshEvents, setMeetingType } = useUpcomingEvents();
  const combinedRefresh = useCallback(async () => { await refresh(); await refreshEvents(); }, [refresh, refreshEvents]);
  const { lastRefreshed } = useAutoRefresh(combinedRefresh, { realtimeTables: ['transcripts', 'calendar_events'] });

  const filtered = useMemo(() => {
    if (!search.trim()) return meetings;
    const q = search.toLowerCase();
    return meetings.filter((m) =>
      m.title.replace(/\s*\/\s*$/, '').toLowerCase().includes(q) ||
      m.participants.some((p) => p.toLowerCase().includes(q)) ||
      (m.summary && m.summary.toLowerCase().includes(q)),
    );
  }, [meetings, search]);

  const nextCall = events[0] ?? null;
  const nextWhen = nextCall ? describeWhen(nextCall) : null;
  const heroType = (nextCall?.meetingType as MeetingType | undefined) ?? 'discovery_sales';
  const restCalls = events.slice(1, 6);
  const overflow = Math.max(0, events.length - 6);

  const now = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase();
  const refreshedMeta = lastRefreshed ? `Refreshed ${new Date(lastRefreshed).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '';

  return (
    <div className="ec">
      <div className="ec-topline">
        <span className="ec-topline-brand">Calls</span>
        <span className="ec-topline-meta">{now}{refreshedMeta ? ` · ${refreshedMeta}` : ''}</span>
      </div>

      <div className="ws-head">
        <h1 className="ec-hed ec-hed--today" style={{ fontSize: 'clamp(40px,4.4vw,60px)', margin: 0 }}>Calls</h1>
        <div className="ws-tools">
          <button className="ws-tool-icon" onClick={combinedRefresh} title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Tally strip: the five call counts, flat ─────────────────────────── */}
      <div className="ws-tally" style={{ ['--ws-tally-cols' as any]: 5 }}>
        <div className="ws-tally-tile">
          <span className="ws-tally-no">01</span>
          <span className="ws-tally-count">{stats.total}</span>
          <span className="ws-tally-label">Total calls</span>
          <span className="ws-tally-sub">transcribed on record</span>
        </div>
        <div className="ws-tally-tile">
          <span className="ws-tally-no">02</span>
          <span className={`ws-tally-count ${todayEvents.length ? '' : 'ws-tally-count--zero'}`}>{todayEvents.length}</span>
          <span className="ws-tally-label">Today</span>
          <span className="ws-tally-sub">on the calendar</span>
        </div>
        <div className="ws-tally-tile">
          <span className="ws-tally-no">03</span>
          <span className="ws-tally-count">{stats.thisWeek}</span>
          <span className="ws-tally-label">This week</span>
          <span className="ws-tally-sub">last 7 days</span>
        </div>
        <div className="ws-tally-tile">
          <span className="ws-tally-no">04</span>
          <span className={`ws-tally-count ${stats.withActionItems ? '' : 'ws-tally-count--zero'}`}>{stats.withActionItems}</span>
          <span className="ws-tally-label">With actions</span>
          <span className="ws-tally-sub">action items extracted</span>
        </div>
        <div className="ws-tally-tile">
          <span className="ws-tally-no">05</span>
          <span className="ws-tally-count">{stats.avgDurationMinutes}m</span>
          <span className="ws-tally-label">Avg duration</span>
          <span className="ws-tally-sub">mean call length</span>
        </div>
      </div>

      {/* ── NEXT-CALL HERO ──────────────────────────────────────────────────── */}
      {nextCall && nextWhen ? (
        <div className="cl-hero">
          <div className="cl-hero-kicker">Next up</div>
          <div className="cl-hero-lead">
            <div className="cl-hero-when">
              <div className={`cl-hero-day ${nextWhen.today ? 'cl-hero-day--today' : ''}`}>{nextWhen.day}</div>
              <div className="cl-hero-time">{nextWhen.time}</div>
              <div className="cl-hero-span">{nextWhen.time}–{nextWhen.end}</div>
            </div>
            <div className="cl-hero-body">
              <div className="cl-hero-title">{nextCall.title}</div>
              {nextCall.attendees.length > 0 && (
                <div className="cl-hero-attend"><Users className="w-3.5 h-3.5" /> {nextCall.attendees.join(', ')}</div>
              )}
            </div>
            <div className="cl-hero-acts">
              {nextWhen.soon && <span className="cl-soon">Starting soon</span>}
              <MeetingTypeBadge event={nextCall} onChange={(t) => setMeetingType(nextCall.id, t)} />
              {nextCall.meetingUrl && (
                <a className="cl-act cl-act--primary" href={nextCall.meetingUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-3 h-3" /> Join
                </a>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="cl-hero-none">
          <div className="cl-hero-none-h">No calls on the calendar this week</div>
          <div className="cl-hero-none-note">The playbook and live script stay ready below. Upcoming calls surface here as they land in calendar_events.</div>
        </div>
      )}

      {/* ── Working tools: playbook + live script (script tuned to next call) ── */}
      <div className="cl-tools">
        <Playbook />
        <CallScript defaultMeetingType={heroType} />
      </div>

      {/* ── Rest of the week ────────────────────────────────────────────────── */}
      {restCalls.length > 0 && (
        <section className="ws-lane" style={{ marginBottom: '1.8rem' }}>
          <div className="ws-lane-cap">
            <span className="ws-lane-cap-h">Rest of the week</span>
            <span className="ws-lane-cap-hint">calendar_events · next 7 days</span>
          </div>
          <div className="cl-up">
            {restCalls.map((ev) => {
              const w = describeWhen(ev);
              return (
                <div className="cl-up-row" key={ev.id}>
                  <div className="cl-up-when">
                    <span>{w.day}</span>
                    <b>{w.time}</b>
                  </div>
                  <div className="cl-up-body">
                    <div className="cl-up-title">{ev.title}</div>
                    {ev.attendees.length > 0 && <div className="cl-up-attend">{ev.attendees.join(', ')}</div>}
                  </div>
                  <div className="cl-up-acts">
                    <MeetingTypeBadge event={ev} onChange={(t) => setMeetingType(ev.id, t)} />
                    {ev.meetingUrl && (
                      <a className="cl-act cl-act--ghost" href={ev.meetingUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-3 h-3" /> Join
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
            {overflow > 0 && <div className="cl-up-more">+{overflow} more this week</div>}
          </div>
        </section>
      )}

      {/* ── Issue fractional intake (warm referral, post-close) ─────────────── */}
      <div style={{ marginBottom: '1.8rem' }}>
        <IssueIntake />
      </div>

      {/* ── Transcript feed ─────────────────────────────────────────────────── */}
      <section className="ws-lane">
        <div className="ws-lane-cap">
          <span className="ws-lane-cap-h">Call transcripts</span>
          <span className="ws-lane-cap-hint">transcripts · newest first</span>
        </div>

        <div className="cl-search">
          <Search className="w-3.5 h-3.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search transcripts, participants, summaries"
          />
        </div>

        {loading && meetings.length === 0 ? (
          <div className="ws-loading">Reading transcripts</div>
        ) : meetings.length === 0 ? (
          <div className="ws-empty">
            <div className="ws-empty-h">No meetings yet</div>
            <div className="ws-empty-note">Calls appear here after Ivan Listener records and transcribes them. Upcoming calls still surface in the hero above.</div>
          </div>
        ) : (
          <div className="cl-feed">
            {filtered.map((m) => <MeetingCard key={m.id} meeting={m} />)}
            {filtered.length === 0 && search && <p className="cl-no-match">No transcripts match "{search}"</p>}
          </div>
        )}
      </section>

      <div style={{ height: '2rem' }} aria-hidden />
    </div>
  );
};

export default CallsRebuilt;

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence, LayoutGroup, MotionConfig, useReducedMotion, useMotionValue, useTransform, animate } from 'framer-motion';
import { supabase } from '../lib/supabase';
import {
  loadBoardSession,
  saveBoardSession,
  clearBoardSession,
  readMagicLinkFragment,
  stripMagicLinkFragment,
  type BoardSession,
} from '../lib/boardSession';
import { useMetadata } from '../hooks/useMetadata';
import { buildAssessmentEmbedUrl } from '../lib/assessmentEmbed';
import LinkedInPostPreview from './ui/LinkedInPostPreview';
import LiveAssessmentEmbed from './ui/LiveAssessmentEmbed';

/**
 * /client/:slug — the per-client content board (demo mode).
 * Token-gated via the get_client_board RPC; fetches ONLY the board payload
 * (never Ivan's dashboard context — this is a client-facing surface).
 * Light Premium skin + the client's own brand accent/logo/heading font.
 * Content mirrors the Ivan System staged-board pattern: stage groups → rows →
 * detail view with the generation agent trail.
 */

// ---------- types (shape of client_boards.board) ----------
interface BoardBrand {
  accent_hex?: string;
  accent_secondary?: string;
  font_heading?: string;
  font_body?: string;
  is_dark?: boolean;
  header_bg?: string;
  logo_light?: string;
  logo_dark?: string;
  surface_hex?: string;
  /** Short wordmark rendered in the client heading font + an accent period (Step Digital → "step."). */
  wordmark?: string;
}
interface AgentStep { step: string; detail?: string; t?: string; done?: boolean }
/** Friendly phase labels for the trail. Stored step NAMES stay stable — the intro
 *  choreography and any data tooling match on them — the UI translates for the
 *  founder reading it. Unknown names render as-is. */
const STEP_LABELS: Record<string, string> = {
  'Idea curator': 'Topic picked',
  'Voice model': 'Voice matched',
  'Hook agent': 'Opening chosen',
  'Draft agent': 'Written',
  'Copy quality gate': 'Quality check',
  'Image check': 'Image check',
  'Brand image': 'Image made',
  'Carousel renderer': 'Slides made',
  'Assessment builder': 'Assessment built',
  'Scoring engine': 'Scoring set up',
  'Cover render': 'Cover made',
  'Email render': 'Email built',
  Queued: 'On the calendar',
  Published: 'Published',
};
const stepLabel = (name: string) => STEP_LABELS[name] || name;
/** Completed-step sentences for the intro card's pending steps — used both by the
 *  live choreography and by the reload path that lands d1 as an already-finished
 *  review card (so an in-progress detail never shows on a done step). */
const INTRO_DONE_DETAILS: Record<string, string> = {
  'Hook agent': 'Chose the opening line',
  'Draft agent': 'Wrote it, then rewrote it once after a self-review',
  'Copy quality gate': 'Quality check passed, nothing flagged',
  'Image check': 'Image matches the post, ready for you',
};
type Stage = 'planned' | 'drafted' | 'review' | 'scheduled' | 'published';
/** Bench entry for a week slot: a seeded alternate ANGLE (topic-level, never an
 *  instant draft). Attached to queue items as `alt_angles` — the slot IS the queue
 *  item, so the bench travels with it. */
interface AltAngle { id: string; title: string; hook: string; pillar?: string; drafts_by?: string }
/** A ready draft the client can pull into a freed slot (client_board_replacement_pool). */
interface PoolDraft { id: string; title?: string; body?: string }
/** What now occupies a freed slot after the client picks from the pool. */
interface SlotReplacement { draft_id: string; title?: string; hook?: string; body?: string }
interface LeadMagnetEntry {
  id: string;
  title: string;
  format: 'assessment' | 'calculator' | 'worksheet' | 'checklist' | string;
  status: 'live' | 'in_production' | 'planned' | string;
  date_label?: string;
  /** Live tool URL on the client domain (present on live entries). */
  url?: string;
  /** Captured-lead count for this asset, when available. */
  captured?: number;
  cover_url?: string;
  /** Cover variation pair (operator-swappable); cover_url is the one currently running. */
  covers?: string[];
  promise?: string;
  /** Authored promo assets (real deliverables, saved copy — never invented statuses). */
  promo?: {
    email?: { subject: string; body: string };
    announcement?: string;
    dm?: string;
  };
}
/** Idea-bank entry: an upcoming topic the engine holds but has NOT drafted yet. It has
 *  no date and no metrics — it drafts when it reaches its calendar slot. Rendered as the
 *  IDEAS stage at the top of the All content ledger; opens a lightweight preview only. */
interface Idea { id: string; title: string; pillar?: string; hook?: string; status?: 'idea' | string; kind?: string; source_label?: string }
/** Honest, concrete post provenance (carousel_drafts.source_detail, plumbed onto the
 *  queue item by the sync). Replaces the vague "Picked by Ivan" mapping: a call-grounded
 *  post carries the real call title + the verbatim quote; launch/own-post/strategy posts
 *  carry an honest specific label. */
interface SourceDetail {
  kind: 'call' | 'lm_launch' | 'own_posts' | 'strategy' | string;
  label?: string;
  call_title?: string | null;
  quote?: string | null;
  lm_ref?: string | null;
}
interface QueueItem {
  id: string;
  kind: 'post' | 'carousel' | 'lm' | 'newsletter';
  stage: Stage;
  pillar?: string;
  hook?: string;
  body?: string;
  media_url?: string | null;
  title?: string;
  promise?: string;
  cover_url?: string;
  publish_date?: string;
  /** Full scheduled timestamp (carousel_drafts.scheduled_at), when the post has a real
   *  slot. Rendered in Mattan's timezone (America/Los_Angeles) wherever a time shows. */
  scheduled_at?: string;
  /** Honest, concrete provenance for the source chip (see SourceDetail). */
  source_detail?: SourceDetail;
  /** Where the idea came from (ideas pipeline: Hand-picked / call / subreddit / newsjack). */
  source_label?: string;
  /** A feed post whose job is to launch a lead magnet — labelled as such, not "Text post". */
  lm_launch?: boolean;
  /** For a lead-magnet launch post: the LM id (lml-*) it announces, so the LM drawer can show it. */
  lm_ref?: string;
  generating?: boolean;
  agent_trail?: AgentStep[];
  /** Transient: the agent step currently running, shown inline on the row (intro choreography). */
  live_step?: string;
  /** Seeded alternate angles for this slot (the "different idea" bench). */
  alt_angles?: AltAngle[];
  /** Post style label (text, quote_image, selfie, carousel, newsjack) — drives the
   *  style chip so the deck shows the range of formats, not one look. */
  style?: string;
}
interface CalendarItem { date: string; kind: string; pillar?: string; label: string; ref?: string; time?: string }
interface Pillar { key: string; label: string; count: number; pct: number; blurb?: string }
interface NewsletterIssue { id: string; ref?: string; date: string; stage: 'scheduled' | 'planned' | string; title: string; body?: string }
interface NurtureStep { step: string; detail?: string }
interface NewsletterSpec {
  name: string;
  cadence?: string;
  from_domain?: string;
  issues?: NewsletterIssue[];
  nurture?: NurtureStep[];
}
interface PerfIndicator { key: string; label: string; source?: string }
interface PerfPost { url?: string; title?: string; published_at?: string; impressions?: number | null; reactions?: number | null; comments?: number | null; captured_at?: string }
interface PerformanceSpec { note?: string; indicators?: PerfIndicator[]; outreach_indicators?: PerfIndicator[]; posts?: PerfPost[]; posts_updated_at?: string }
/** Outreach program panel (live boards): the ICP bar, the funnel grammar, and the four
 *  staged lanes with their real counts. Rendered on the Leads tab above the pipeline. */
interface OutreachLane { key?: string; name: string; status?: string; arms?: string; detail?: string; count?: number; scanned?: number; fits?: number }
/** A lane is dead (retired / no ratified sequence) when its status says retired or its
 *  name is the retired Network Activation lane. Dead lanes carry no message set, so they
 *  never render on the client-facing Leads view — the data stays, the empty lane hides. */
function isDeadLane(name?: string, status?: string, arms?: string): boolean {
  const hay = `${name || ''} ${status || ''} ${arms || ''}`.toLowerCase();
  return /retired|no ratified sequence|network activation/.test(hay);
}
/** Live monthly send-log usage for the Leads panel. Counts + caps both come from the
 *  server (client_board_outreach_usage RPC); the component never hardcodes a cap. */
interface OutreachUsage {
  inmail_used: number;
  inmail_cap: number;
  inmail_remaining: number;
  dm_sent: number;
  connect_sent: number;
  connect_cap: number;
}
/** One outbound message on a lead's live send log (client_board_outreach_log RPC). */
interface OutreachLogMessage { direction: 'outbound' | 'inbound'; channel: string | null; type: string | null; sent_at: string | null; text: string | null }
/** Per-lead live send log: real sends only (sent_at not null) + reply status. Sourced
 *  from outreach_messages via RPC, never baked board JSON. Empty until a lane sends. */
interface OutreachLogEntry {
  prospect_id: string; name: string | null; company: string | null; lane: string | null;
  reply_count: number; replied: boolean; last_sent_at: string | null; last_reply_at: string | null;
  messages: OutreachLogMessage[];
}
interface OutreachSpec {
  note?: string;
  icp?: { label?: string; bar?: string[]; note?: string };
  funnel?: { step: string; detail?: string }[];
  lanes?: OutreachLane[];
  /** Client-orbit playbook (live boards): seed clients, the three touches, and the
   *  approve-first sample DMs the client blesses on the call before anything sends. */
  orbit_plan?: {
    title?: string; note?: string;
    seeds?: { name: string; status?: string }[];
    touches?: { label: string; text: string }[];
    gift?: { name?: string; url?: string };
    samples?: { label?: string; text: string }[];
  };
  /** Per-channel message sequences (live boards): the actual notes/DMs each lane sends,
   *  cold (connect + DM + InMail) vs warm (engagers, network). Templates carry
   *  {placeholders} filled per prospect; approve-first, nothing sends unapproved. */
  sequences?: {
    title?: string; note?: string;
    channels: {
      key?: string; name: string; badge?: string; note?: string;
      /** Every lane ships off. When false (or absent), the lane carries a NOT ARMED stamp. */
      armed?: boolean;
      /** What has to happen before the lane can arm (e.g. a named-client OK). */
      gate?: string;
      steps: { label: string; when?: string; text: string; flag?: string }[];
    }[];
  };
  /** Real people pulled from the client's orbit scans, honest one-liners + caveats.
   *  Nothing queued or sent — surfaced for the client's yes/no before any lane arms. */
  orbit_finds?: {
    note?: string;
    people: { name: string; role?: string; company?: string; domain?: string; linkedin_url?: string; one_liner?: string; caveat?: string }[];
  };
  /** Named candidate list awaiting the client's bless (live boards). Every item is a REAL
   *  sourced person — no samples here, ever. Groups map to lanes. */
  candidates?: {
    title?: string; note?: string;
    groups: {
      key?: string; name: string; badge?: string; note?: string;
      items: { name: string; role?: string; company?: string; domain?: string; note?: string; linkedin_url?: string }[];
    }[];
  };
  /** Conversation inbox (live boards): warm/cold threads with latest messages. While
   *  chats.mock is true the block renders a clearly-labeled example preview; the live
   *  UniPile sync REPLACES this object once the client's seat connects, which removes
   *  the mock automatically. */
  chats?: {
    mock?: boolean; note?: string;
    threads: {
      lane: string; name: string; company?: string; last_when?: string;
      messages: { from: 'lead' | 'you'; when?: string; text: string }[];
    }[];
  };
}
/** Lead-magnet idea-bank entry (live boards): a concept awaiting the client's greenlight. */
interface LmIdea { id: string; title: string; format?: string; status?: string; note?: string; source_label?: string; cover_url?: string }
/** One row of the client-visible draft history (client_board_draft_history RPC). */
interface HistoryEntry { action: string; at: string; by?: string | null; event?: string | null; note?: string | null; before?: string | null; after?: string | null }
interface EngineUpdate { date: string; note: string }
interface Board {
  company_name: string;
  domain?: string;
  logo_url?: string;
  founder?: { name?: string; headline?: string; first_name?: string; avatar_url?: string };
  brand?: BoardBrand;
  site?: { nav?: string[]; phone?: string; cta?: string };
  queue: QueueItem[];
  ideas?: Idea[];
  lm?: any;
  lead_magnets?: LeadMagnetEntry[];
  /** Real captured leads, if any exist yet. Absent/empty on a fresh preview board — the
   *  Captured leads table then shows a clean empty-state, never a staged sample lead. */
  leads?: { email: string; score?: string; weakest_area?: string; when?: string }[];
  /** Rich engager DM pipeline for the Leads tab (offer: inbound-engine-engager-dm-pipeline).
   *  Distinct from the thin assessment `leads` above. Live boards fill it from the real
   *  pipeline; demo/preview boards fall back to a LABELED sample deck (see LeadsSurface).
   *  A live board with no data shows a clean empty-state, never a staged sample. */
  lead_pipeline?: PipelineLead[];
  outreach?: OutreachSpec;
  lm_ideas?: LmIdea[];
  strategy?: { total: number; period?: string; pillars: Pillar[]; cadence?: { headline: string; detail?: string; note?: string } };
  calendar?: { start: string; weeks: number; items: CalendarItem[] };
  newsletter?: NewsletterSpec;
  performance?: PerformanceSpec;
  engine_updates?: EngineUpdate[];
  /** Voice engine panel: how the engine learns the founder's voice + register + do/avoid
   *  markers + real sample posts (pulled from generated bodies, never invented). */
  voice?: {
    traits?: string[];
    register?: string;
    do?: string[];
    avoid?: string[];
    sources?: { label: string; detail: string }[];
    note?: string;
    samples?: { style?: string; hook?: string; body?: string }[];
  };
  /** Standardized showcase of the post styles the engine ships (text, quote image,
   *  selfie/lifestyle, carousel, reactive newsjack). Rendered on the Voice surface. */
  content_styles?: { key: string; label: string; blurb: string; needs_photo?: boolean }[];
  auto_publish_days?: number;
  /** Visual skin. 'editorial' (default) = the warm-paper editorial look, unchanged.
   *  'blackbox' = the InboundOnSteroids product look. Also togglable via ?skin=blackbox. */
  skin?: 'editorial' | 'blackbox';
}

// ---------- small utils ----------
// V9 "Margin Rail" editorial token system: warm-paper neutrals, ink ramp, hairline
// rules, DM Serif / Source Serif / IBM Plex Mono. The accent is punctuation only —
// it is NEVER a panel background or body text (see the derivation helpers below).
/** CSS-var indirection: every token reads a `--cb-*` var with the editorial literal as
 *  fallback. Editorial sets NONE of these vars (falls back to the literal, byte-for-byte
 *  unchanged); the blackbox skin spreads a var map on the root div so every inline usage
 *  site re-skins automatically without renaming consts or touching usage sites. */
const INK = 'var(--cb-ink, #1A1A1A)';        // text, primary button
const INK_SOFT = 'var(--cb-ink-soft, #4A4A48)';   // body copy
const INK_MUTE = 'var(--cb-ink-mute, #5A5752)';   // labels, meta, eyebrows
/** Back-compat aliases: the whole file styles with DIM (body) / FAINT (meta). Pointing
 *  them at the paper ink ramp moves every existing usage onto the editorial neutrals. */
const DIM = INK_SOFT;
const FAINT = INK_MUTE;
const PAPER = 'var(--cb-paper, #F7F4EF)';       // app background
const PAPER_SUNK = 'var(--cb-paper-sunk, #EFEBE3)';  // side cards, teasers
const PAPER_RAISE = 'var(--cb-paper-raise, #FFFFFF)'; // raised cards, previews
const DESK_BG = 'var(--cb-desk, #EDEAE3)';     // desk behind the whole board
/** Hairlines, not boxes: 26,26,26 alpha so rules composite on paper or white. */
const LINE = 'var(--cb-line, rgba(26,26,26,0.15))';
const LINE_BOLD = 'var(--cb-line-bold, rgba(26,26,26,0.25))'; // table heads / section rules
const DIVIDE = 'var(--cb-divide, rgba(26,26,26,0.12))';    // soft divider inside grouped containers
/** Back-compat: the shell frame is now paper, not a tinted SaaS canvas. */
const FRAME_BG = PAPER;
/** One shadow, reserved for raised paper. Hero cards get a touch more. Blackbox → none. */
const CARD_SHADOW = 'var(--cb-card-shadow, 0 10px 30px rgba(26,26,26,0.10))';
const HERO_SHADOW = 'var(--cb-hero-shadow, 0 14px 40px rgba(26,26,26,0.12))';
/** Single easing token — every quiet transition on the board uses it. */
const EASE = [0.25, 1, 0.5, 1] as const;
/** Interactive-card affordance: paper-shadow lift on hover, no color shift. */
const LIFT = `transition-[box-shadow,transform] duration-150 ease-[cubic-bezier(0.25,1,0.5,1)] hover:-translate-y-px hover:shadow-[0_10px_30px_rgba(26,26,26,0.10)]`;
const SERIF = 'var(--cb-serif, "DM Serif Display", Georgia, serif)';   // display headlines + large numerals
const BODY = 'var(--cb-body, "Source Serif 4", Georgia, serif)';       // body copy, row titles
const MONO = 'var(--cb-mono, "IBM Plex Mono", ui-monospace, SFMono-Regular, monospace)'; // data, eyebrows, nav
const UISANS = '"Instrument Sans", system-ui, sans-serif';               // LinkedIn preview interior only

/** The accent is a variable; every use is a derivation. These are the ONLY legal forms. */
/** Small accent text (<19px) — AA-safe against paper. */
const caText = (a: string) => `color-mix(in oklab, ${a} 75%, #1A1A1A)`;
/** Running / highlight frames. */
const caBorder = (a: string, pct = 40) => `color-mix(in oklab, ${a} ${pct}%, transparent)`;
/** Review-row washes, running-step fills (5–9%). */
const caWash = (a: string, pct = 6) => `color-mix(in oklab, ${a} ${pct}%, transparent)`;

/** Zero em-dash law: board free-text (voice traits, etc.) can carry em dashes from the
 *  source data. Swap them for commas at render so no em dash ever reaches the client. */
function noDash(s?: string): string {
  return (s || '').replace(/\s*—\s*/g, ', ').replace(/—/g, ', ');
}
function cleanHex(hex?: string, fallback = '#4f46e5'): string {
  const h = (hex || '').replace(/[^0-9a-fA-F]/g, '');
  return h.length === 6 ? `#${h}` : fallback;
}
/** White-label label for a live/client board: the client's OWN brand, never the operator
 *  agency name. Reads brand.wordmark → company_name → domain. Live boards render this in
 *  place of the hardcoded "InboundOnSteroids"; preview/demo boards keep the product name. */
function clientBrand(board?: { brand?: BoardBrand; company_name?: string; domain?: string } | null): string {
  return (board?.brand?.wordmark || board?.company_name || board?.domain || 'RISE DTC').trim();
}
function inkOn(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.62 ? '#141210' : '#ffffff';
}
function fmtDay(iso?: string): string {
  if (!iso) return '';
  // Accepts both bare dates ('2026-07-20') and full ISO timestamps
  // ('2026-07-20T19:46:41Z'). Bare dates get local midnight so the day never rolls
  // backward across a UTC parse; timestamps parse as-is. Anything unparseable renders
  // nothing rather than a raw "Invalid Date".
  const d = /[T ]/.test(iso) ? new Date(iso) : new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}
/** Mattan's timezone for every scheduled time on the board. Never browser-local. */
const CLIENT_TZ = 'America/Los_Angeles';
/** A scheduled timestamp as "Tue 21 Jul, 10:00 AM PT" in the client's timezone. Falls
 *  back to a date-only string (from publish_date) when no full timestamp exists yet. */
function fmtSchedLA(scheduledAt?: string, publishDate?: string): string {
  if (scheduledAt) {
    const d = new Date(scheduledAt);
    if (!Number.isNaN(d.getTime())) {
      const day = d.toLocaleDateString('en-GB', { timeZone: CLIENT_TZ, weekday: 'short', day: 'numeric', month: 'short' });
      const time = d.toLocaleTimeString('en-US', { timeZone: CLIENT_TZ, hour: 'numeric', minute: '2-digit' });
      return `${day}, ${time} PT`;
    }
  }
  return fmtDay(publishDate);
}
/** Turn an LA wall-clock date (YYYY-MM-DD) + time (HH:MM) into a real UTC ISO instant.
 *  The client always enters + reads time in America/Los_Angeles; the offset is read from
 *  the zone so it stays correct across DST. */
function laWallToUtcISO(dateStr: string, timeStr: string): string {
  const probe = new Date(`${dateStr}T12:00:00Z`);
  const asLA = new Date(probe.toLocaleString('en-US', { timeZone: CLIENT_TZ }));
  const asUTC = new Date(probe.toLocaleString('en-US', { timeZone: 'UTC' }));
  const offMin = Math.round((asUTC.getTime() - asLA.getTime()) / 60000); // +420 for PDT
  const [hh, mm] = timeStr.split(':').map((n) => parseInt(n, 10));
  const base = new Date(`${dateStr}T00:00:00Z`).getTime();
  return new Date(base + (hh * 60 + mm + offMin) * 60000).toISOString();
}
/** The LA date parts (YYYY-MM-DD) + time (HH:MM) of a UTC instant, for prefilling inputs. */
function laParts(scheduledAt?: string): { date: string; time: string } {
  const d = scheduledAt ? new Date(scheduledAt) : new Date();
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: CLIENT_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: CLIENT_TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  return { date, time };
}
/** Just the LA clock time ("10:00 AM PT") for compact chips. */
function fmtTimeLA(scheduledAt?: string): string {
  if (!scheduledAt) return '';
  const d = new Date(scheduledAt);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.toLocaleTimeString('en-US', { timeZone: CLIENT_TZ, hour: 'numeric', minute: '2-digit' })} PT`;
}
/** Long weekday in LA tz for a full timestamp (e.g. "Tuesday"). */
function weekdayLA(scheduledAt?: string): string {
  if (!scheduledAt) return '';
  const d = new Date(scheduledAt);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { timeZone: CLIENT_TZ, weekday: 'long' });
}
/** True once a post has a real scheduled slot (not sitting undated in the buffer). */
function isScheduled(q: Pick<QueueItem, 'scheduled_at' | 'publish_date'>): boolean {
  return !!(q.scheduled_at || q.publish_date);
}
/** Weekend (Sat/Sun) in the client's timezone — the cadence is weekdays only, so a
 *  weekend day is never a fillable slot. Uses a noon-UTC probe read in LA to avoid the
 *  midnight-boundary date drift. */
function isWeekendDay(iso?: string): boolean {
  if (!iso) return false;
  const wd = new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: CLIENT_TZ, weekday: 'short' });
  return wd === 'Sat' || wd === 'Sun';
}
/** Resolve a lead-magnet launch post to its asset (cover + landing/resource link). Joins
 *  by lm_ref (board id) first, then by the source_detail slug matched against a
 *  lead_magnets url, then derives from the slug on the resources host (RRR has a live
 *  landing but no board.lead_magnets row yet). The cover is rendered 404-safe (onError
 *  hides it) so a missing cover still shows the link. */
function resolveLaunchLm(q: Pick<QueueItem, 'lm_launch' | 'lm_ref' | 'source_detail' | 'title'>, board: Pick<Board, 'lead_magnets'>): { title: string; landing: string; cover?: string } | null {
  const sd = q.source_detail;
  const isLaunch = q.lm_launch || sd?.kind === 'lm_launch';
  if (!isLaunch) return null;
  const lms = board.lead_magnets || [];
  const slug = (sd?.lm_ref || '').trim();
  let lm = q.lm_ref ? lms.find((e) => e.id === q.lm_ref) : undefined;
  if (!lm && slug) lm = lms.find((e) => (e.url || '').includes(slug));
  if (lm && lm.url) return { title: lm.title, landing: lm.url, cover: (lm.covers && lm.covers[0]) || lm.cover_url };
  if (slug && /^[a-z0-9-]+$/.test(slug)) {
    // Client-facing: always the client's own white-label domain, never the agency host.
    const landing = `https://resources.risedtc.com/${slug}/`;
    return { title: sd?.label || q.title || 'Lead magnet', landing, cover: `${landing}assets/cover.jpg` };
  }
  return null;
}
/** The honest source chip for a post. Prefers the concrete source_detail; a call-grounded
 *  post reads "From your sales call · <who>", never a vague "Picked by Ivan". */
function sourceChip(q: Pick<QueueItem, 'source_detail' | 'source_label'>): { label: string; quote?: string | null } | null {
  const sd = q.source_detail;
  if (sd) {
    if (sd.kind === 'call') {
      const who = (sd.call_title || '').replace(/^Intro Call w\/\s*RISE DTC\s*-\s*/i, '').replace(/^ZOOM Meeting\s*-\s*RISE DTC\s*\/\/\s*/i, '').trim();
      return { label: who ? `From your sales call · ${who}` : (sd.label || 'From your sales call'), quote: sd.quote };
    }
    // 'strategy' is an editorial category, NOT a provenance — never render it as a source
    // chip (it would read like "this came from X" next to the real call / own-post chips).
    if (sd.kind === 'strategy') return null;
    return { label: sd.label || '', quote: null };
  }
  if (q.source_label) return { label: srcLabelClient(q.source_label), quote: null };
  return null;
}
/** Render a plain-text email body the way an inbox would: line breaks preserved and any
 *  URL turned into a clickable link. The stored/edited copy stays plain text — this is a
 *  preview-only transform (no HTML is persisted, and no dangerouslySetInnerHTML). */
const EMAIL_URL_SPLIT = /(https?:\/\/[^\s]+)/g;
const isEmailUrl = (s: string) => /^https?:\/\/[^\s]+$/.test(s);
function EmailBodyPreview({ body, accent }: { body: string; accent: string }) {
  const lines = body.split('\n');
  return (
    <>
      {lines.map((line, li) => (
        <React.Fragment key={li}>
          {li > 0 && <br />}
          {line.split(EMAIL_URL_SPLIT).map((part, pi) =>
            isEmailUrl(part)
              ? <a key={pi} href={part} target="_blank" rel="noopener noreferrer" style={{ color: caText(accent), textDecoration: 'underline', textUnderlineOffset: 2, wordBreak: 'break-word' }}>{part}</a>
              : <React.Fragment key={pi}>{part}</React.Fragment>
          )}
        </React.Fragment>
      ))}
    </>
  );
}
/** Hostname of a real recorded URL (no www), or '' when absent/unparseable. Live boards
 *  render only checkable hosts, never a synthesized vanity domain. */
function realHostOf(url?: string): string {
  if (!url) return '';
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}
/** True only when the asset's real host is the CLIENT's own domain — the only case
 *  where "On your domain" is honest. resources.* subdomains of the agency are "Live". */
function onClientDomain(url?: string, domain?: string): boolean {
  if (!url || !domain) return false;
  const host = realHostOf(url);
  const d = domain.replace(/^www\./, '');
  return host === d || host.endsWith('.' + d);
}
function lmPath(title?: string): string {
  return (title || 'lead-magnet').toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim()
    .split(/\s+/).slice(-3).join('-');
}
const KIND_LABEL: Record<string, string> = { post: 'Post', carousel: 'Carousel', lm: 'Lead magnet', newsletter: 'Newsletter', newsjack: 'Reactive slot' };
/** Settle tint after a row moves stage: the client accent at a whisper, not a green flash. */
const FLASH_BG = 'color-mix(in srgb, var(--cb-accent) 7%, white)';

/** The body the opening-choreography draft (d1) lands with — same register as the other
 *  seeded drafts (owner-cost storytelling, concrete and direct, no fabricated results). */
const D1_DRAFT_BODY = `The audit that finds where ad spend leaks before you scale.

Most accounts leak in the same three places: broad match quietly spending on junk queries, retargeting audiences that overlap so you pay twice for the same buyer, and ROAS targets set before your costs went up.

None of it shows in the dashboard. All of it shows in a margin audit.

Scaling multiplies whatever is already in the account, including the leaks. Audit first, then scale.`;

/** Format kicker: refines the raw kind into the client-readable format label. */
function kickerOf(q: Pick<QueueItem, 'kind' | 'media_url' | 'lm_launch'>): string {
  if (q.lm_launch) return 'Lead magnet launch';
  if (q.kind === 'post') return q.media_url ? 'Image post' : 'Text post';
  return KIND_LABEL[q.kind] || q.kind;
}

/** Live boards: pipeline source labels rendered in client vocabulary. Labels not in the
 *  map pass through as-is; internal-only labels map to nothing rather than leak. */
const SOURCE_LABEL_CLIENT: Record<string, string> = {
  // Honest, concrete labels only — never a vague "Picked by Ivan". Call-grounded and
  // launch/own-post posts carry richer provenance via source_detail (see sourceChip).
  'Hand-picked': 'RISE DTC content strategy',
  'From your sales calls': 'From your sales call',
  'Needs your client material': 'Needs a client story from you',
};
function srcLabelClient(label?: string): string {
  if (!label) return '';
  return SOURCE_LABEL_CLIENT[label] ?? label;
}

/** Inline count-up (logic mirrored from dashboard-v2 useCountUp — not imported across
 *  the client/ops context boundary). Respects prefers-reduced-motion. */
function useCountUp(target: number, duration = 1100): string {
  const [v, setV] = useState(0);
  const prevRef = useRef(0);
  useEffect(() => {
    const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { prevRef.current = target; setV(target); return; }
    const from = prevRef.current;
    prevRef.current = target;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      setV(Math.round(from + (1 - Math.pow(1 - p, 3)) * (target - from)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return v.toLocaleString();
}

/** Stat numeral. DM Serif is the board's one signature — reserved for LARGE numerals
 *  only; small counts fall back to sans semibold with tabular figures. */
function CountUpNum({ n, size }: { n: number; size: number }) {
  const v = useCountUp(n);
  const serif = size >= 24;
  return (
    <span
      className="cb-num-serif tabular-nums"
      style={serif
        ? { fontFamily: SERIF, fontStyle: 'italic', fontSize: size, lineHeight: 1.05, color: INK }
        : { fontWeight: 600, fontSize: size, lineHeight: 1.05, color: INK }}
    >
      {v}
    </span>
  );
}

/** Count that rolls vertically when it changes — the badge beat of the approve moment. */
function RollingNumber({ n }: { n: number }) {
  return (
    <span className="relative inline-flex h-[1.2em] items-center overflow-hidden tabular-nums" aria-live="polite">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={n}
          initial={{ y: '0.9em', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '-0.9em', opacity: 0 }}
          transition={{ duration: 0.2, ease: EASE }}
          className="inline-block"
        >
          {n}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** 16:9 row/card thumbnail: real media when it exists; text posts get a mini
 *  typographic tile (opening words of the hook, sans semibold, accent-washed);
 *  other formats get a glyph tile. */
function Thumb({ q, accent, large = false }: { q: QueueItem; accent: string; large?: boolean }) {
  const src = q.media_url || q.cover_url;
  const cls = large ? 'aspect-video w-full rounded-lg' : 'h-10 w-14 rounded-[6px]';
  if (src) {
    return <img src={src} alt="" loading="lazy" className={`${cls} shrink-0 object-cover`} style={{ border: `1px solid ${LINE}`, background: 'rgba(2,49,47,0.04)' }} />;
  }
  if (q.kind === 'post' && (q.hook || q.title)) {
    const words = (q.hook || q.title || '').split(/\s+/).slice(0, large ? 12 : 6).join(' ');
    return (
      <span
        className={`${cls} flex shrink-0 items-center overflow-hidden px-1.5 py-1 text-left`}
        style={{ background: `color-mix(in srgb, ${accent} 7%, white)`, border: `1px solid ${LINE}` }}
        aria-hidden
      >
        <span
          style={{
            fontWeight: 600, fontSize: large ? 13.5 : 8.5, lineHeight: 1.3, letterSpacing: '-0.01em',
            color: `color-mix(in srgb, ${accent} 60%, ${INK})`,
            display: '-webkit-box', WebkitLineClamp: large ? 4 : 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}
        >
          {words}
        </span>
      </span>
    );
  }
  const glyph = (() => {
    switch (q.kind === 'post' && q.media_url ? 'image' : q.kind) {
      case 'carousel':
        return <path d="M4 7h10v10H4zM16 9h4M16 12h4M16 15h4" stroke={accent} strokeWidth="1.6" strokeLinecap="round" fill="none" />;
      case 'lm':
        return <path d="M5 6h14M5 10h14M5 14h8M15.5 13.5l2 2 3.5-3.5" stroke={accent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />;
      case 'newsletter':
        return <path d="M4 7l8 6 8-6M4 7h16v11H4z" stroke={accent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />;
      default:
        return <path d="M5 7h14M5 11h14M5 15h9" stroke={accent} strokeWidth="1.6" strokeLinecap="round" fill="none" />;
    }
  })();
  return (
    <span
      className={`${cls} flex shrink-0 items-center justify-center`}
      style={{ background: `color-mix(in srgb, ${accent} 7%, white)`, border: `1px solid ${LINE}` }}
      aria-hidden
    >
      <svg width={large ? 30 : 18} height={large ? 30 : 18} viewBox="0 0 24 24" style={{ opacity: 0.75 }}>{glyph}</svg>
    </span>
  );
}

// Segment tints: the client's accent mixed toward white at stepped ratios, so the
// bar reads as one brand family, never a rainbow.
const TINT_STEPS = [26, 20, 15, 11, 8];

// ---------- shared bits ----------
function KindChip({ q }: { q: Pick<QueueItem, 'kind' | 'media_url'>; accent?: string }) {
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium"
      style={{ background: 'rgba(2,49,47,0.05)', color: DIM }}
    >
      {kickerOf(q)}
    </span>
  );
}

/** Italic accent "drama" phrase for a display headline — one per headline, full accent
 *  (headlines are >19px so no AA mix needed). */
function Accent({ children }: { children: React.ReactNode }) {
  return <span className="cb-accent-phrase" style={{ fontStyle: 'italic', color: 'var(--cb-accent)' }}>{children}</span>;
}

/** Editorial masthead on every tab: mono eyebrow → DM Serif Display headline (with one
 *  italic accent phrase) → Source Serif sub. The shell's loudest, most consistent mark. */
function SectionHead({ eyebrow, title, sub }: { eyebrow?: string; title: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="mb-7">
      {eyebrow && (
        <div className="mb-2.5 uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.22em', color: INK_MUTE }}>{eyebrow}</div>
      )}
      <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(29px, 3.4vw, 40px)', lineHeight: 1.06, letterSpacing: '-0.02em', color: INK }}>{title}</h2>
      {sub && <p className="mt-3.5 max-w-[62ch]" style={{ fontFamily: BODY, fontSize: 15, lineHeight: 1.62, color: INK_SOFT }}>{sub}</p>}
    </div>
  );
}

/** Card header — Source Serif, the quiet register inside white cards. */
function CardHead({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 15, color: INK }}>{children}</div>;
}

/** Ambient status dot: 6px core + 3px halo ring. `pulse` is reserved for the topbar
 *  "Live preview" only; everything else stays still. Gated on prefers-reduced-motion. */
function StatusDot({ color, pulse = false, size = 6 }: { color: string; pulse?: boolean; size?: number }) {
  return (
    <span className="relative inline-flex shrink-0" style={{ height: size, width: size }}>
      {pulse && (
        <span
          className="absolute inline-flex h-full w-full rounded-full opacity-50 motion-safe:animate-ping motion-reduce:hidden"
          style={{ background: color, animationDuration: '2s' }}
        />
      )}
      <span
        className="relative inline-flex rounded-full"
        style={{ height: size, width: size, background: color, boxShadow: `0 0 0 3px color-mix(in srgb, ${color} 18%, transparent)` }}
      />
    </span>
  );
}

/** The engine heartbeat: the brief's `pulse` (scale 1→.72, opacity 1→.35, 1.6s). One per
 *  surface region, and the only animated accent element. Honors reduced motion. */
function PulseDot({ color, size = 7 }: { color: string; size?: number }) {
  return (
    <span
      className="cb-pulse inline-block shrink-0 rounded-full"
      style={{ height: size, width: size, background: color }}
      aria-hidden
    />
  );
}

/** The true LinkedIn feed preview from the brief: Instrument Sans interior, initials
 *  avatar in the accent, a typographic cover plate (client heading font on accent), and
 *  the Like/Comment/Share row. Cover plate is the ONE place the guest font appears in a
 *  surface — never in shell chrome. `cover`='render' shows the drafting placeholder. */
function FeedPreview({ item, board, accent, fontStack, size = 'lg', cover = 'plate', live = false }: {
  item: QueueItem; board: Board; accent: string; fontStack: string;
  size?: 'lg' | 'sm'; cover?: 'plate' | 'render' | 'none';
  /** Live board: the typographic plate is a preview fabrication — render the real
   *  generated image (media_url) or nothing. */
  live?: boolean;
}) {
  const founder = board.founder;
  const name = founder?.name || board.company_name;
  const wordmark = board.brand?.wordmark || board.company_name.split(/\s+/)[0];
  const av = size === 'lg' ? 44 : 38;
  const bodyPx = size === 'lg' ? 13.5 : 12.5;
  const titlePx = size === 'lg' ? 24 : 18;
  const showCover = !live && cover !== 'none' && (item.kind === 'post' || item.kind === 'carousel' || cover === 'render');
  // Live: the drafting placeholder only renders when an image is really being generated.
  const showRender = cover === 'render' && (!live || (!!item.generating && item.style !== 'text'));
  return (
    <div className="cb-linkedin-preview" style={{ fontFamily: UISANS, border: `1px solid ${LINE}`, borderRadius: 10, padding: size === 'lg' ? '18px 20px' : '15px 17px', background: PAPER_RAISE }}>
      <div className="flex gap-2.5" style={{ marginBottom: 12 }}>
        <span className="flex shrink-0 items-center justify-center rounded-full" style={{ width: av, height: av, background: accent, color: inkOn(accent), fontFamily: fontStack, fontWeight: 700, fontSize: size === 'lg' ? 17 : 14 }} aria-hidden>
          {initialsOf(name)}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-semibold" style={{ fontSize: size === 'lg' ? 13.5 : 12.5, color: '#111' }}>{name}</span>
          <span className="block truncate" style={{ fontSize: size === 'lg' ? 11.5 : 10.5, color: '#666' }}>{founder?.headline || `Founder, ${board.company_name}`} · 1st</span>
          <span className="block truncate" style={{ fontSize: size === 'lg' ? 11 : 10, color: '#999' }}>{live && !isScheduled(item) ? 'Draft · not scheduled yet' : live ? `Scheduled · ${fmtSchedLA(item.scheduled_at, item.publish_date)}` : `Scheduled · ${fmtDay(item.publish_date) || 'this week'}`} · 🌐</span>
        </span>
      </div>
      {item.body && (
        <div style={{ fontSize: bodyPx, lineHeight: 1.55, color: '#111', marginBottom: 12, whiteSpace: 'pre-line' }}>{item.body}</div>
      )}
      {item.media_url ? (
        <img src={item.media_url} alt="" loading="lazy" style={{ width: '100%', borderRadius: 6, border: `1px solid ${LINE}`, display: 'block' }} />
      ) : showRender ? (
        <div className="flex items-center justify-center gap-2.5" style={{ aspectRatio: '1200/500', borderRadius: 6, border: `1px dashed ${caBorder(accent, 45)}` }}>
          <PulseDot color={accent} size={8} />
          <span className="uppercase" style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.14em', color: INK_MUTE }}>cover rendering…</span>
        </div>
      ) : showCover ? (
        <div className="cb-cover-plate flex flex-col justify-end" style={{ background: accent, borderRadius: 6, aspectRatio: '1200/500', padding: size === 'lg' ? '20px 22px' : '15px 17px' }}>
          <div style={{ fontFamily: fontStack, fontWeight: 700, fontSize: titlePx, lineHeight: 1.13, color: '#fff', maxWidth: '20ch' }}>{item.title || item.hook}</div>
          <div style={{ fontFamily: fontStack, fontWeight: 500, fontSize: size === 'lg' ? 12 : 10.5, color: 'rgba(255,255,255,.75)', marginTop: 9 }}>{wordmark}. / field notes</div>
        </div>
      ) : null}
      <div className="flex gap-5" style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #eee', fontSize: size === 'lg' ? 12 : 11, color: '#888' }}>
        <span>👍 Like</span><span>💬 Comment</span><span>↗ Share</span>
      </div>
    </div>
  );
}

// ---------- Content surface: staged list ----------
const STAGE_META: Record<Stage, { label: string; hint: string }> = {
  planned: { label: 'Planned', hint: 'On the calendar. Each one drafts a few days ahead.' },
  drafted: { label: 'Drafted', hint: 'Being written now. They move to your review when ready.' },
  review: { label: 'Your review', hint: 'Approve it, or say what to change.' },
  scheduled: { label: 'Scheduled', hint: 'Approved and queued to publish.' },
  published: { label: 'Published · example', hint: 'How live posts will report here once posting starts.' },
};
const STAGE_ORDER: Stage[] = ['review', 'drafted', 'scheduled', 'published'];

/** All content LIST view = a STAGE-GROUPED pipeline (the operator mental model), so it
 *  reads distinctly from the This week deck. Order top→bottom: Ideas → Your review →
 *  Drafting → Scheduled → Published. Ideas is sourced separately (board.ideas). */
const LIST_STAGE_SECTIONS: { stage: Stage; label: string; blurb: string }[] = [
  { stage: 'review', label: 'Your review', blurb: STAGE_META_review_blurb() },
  { stage: 'drafted', label: 'Drafting', blurb: 'Being written now. They move to your review when ready.' },
  { stage: 'scheduled', label: 'Scheduled', blurb: 'Approved and queued to publish on their dates.' },
  { stage: 'published', label: 'Published', blurb: 'How live posts will report here once posting starts.' },
];
function STAGE_META_review_blurb() { return 'Approve, or say what to change in plain words.'; }
const IDEAS_BLURB = "The engine's upcoming idea bank. Each one drafts when it reaches its slot.";

/** Editorial section header for a ledger stage group: mono-caps eyebrow + accent count,
 *  a one-line Source Serif description. Matches the V9 masthead type system. */
function LedgerSectionHead({ eyebrow, count, blurb, accent }: { eyebrow: string; count: number; blurb: string; accent: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pb-2.5 pt-9 first:pt-0" style={{ borderBottom: `1px solid ${LINE_BOLD}` }}>
      <div className="flex items-baseline gap-2.5">
        <span className="uppercase" style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.22em', color: INK_MUTE }}>{eyebrow}</span>
        <span className="tabular-nums" style={{ fontFamily: MONO, fontSize: 11, color: caText(accent) }}>{String(count).padStart(2, '0')}</span>
      </div>
      {blurb && <span className="max-w-[52ch] sm:text-right" style={{ fontFamily: BODY, fontStyle: 'italic', fontSize: 12.5, lineHeight: 1.5, color: INK_MUTE }}>{blurb}</span>}
    </div>
  );
}

function stageStatus(q: QueueItem, stage: Stage, startIso?: string, live = false): React.ReactNode {
  if (stage === 'planned') {
    const d = q.publish_date ? new Date(q.publish_date + 'T00:00:00') : null;
    let drafts = d ? new Date(d.getTime() - 2 * 86400000).toISOString().slice(0, 10) : '';
    // Nothing drafts before the engine starts.
    if (drafts && startIso && drafts < startIso) drafts = startIso;
    return <span className="text-[12px] tabular-nums" style={{ color: FAINT }}>Drafts {fmtDay(drafts)} · publishes {fmtDay(q.publish_date)}</span>;
  }
  if (stage === 'drafted') {
    return q.generating
      ? <span className="inline-flex items-center gap-2 text-[12px] font-medium" style={{ color: DIM }}><PulseDot color="var(--cb-mint)" /> {q.live_step || 'Generating…'}</span>
      : <span className="text-[12px]" style={{ color: FAINT }}>In production</span>;
  }
  if (stage === 'review') {
    if (live) {
      return q.publish_date
        ? <span className="text-[12px] tabular-nums" style={{ color: DIM }}>Scheduled for {weekAbbr(q.publish_date)} · {fmtDay(q.publish_date)}</span>
        : <span className="text-[12px] tabular-nums" style={{ color: DIM }}>In the buffer · takes the next open slot</span>;
    }
    return <span className="text-[12px] tabular-nums" style={{ color: DIM }}>In your review{q.publish_date ? ` · ${fmtDay(q.publish_date)}` : ''}</span>;
  }
  if (stage === 'scheduled') return <span className="text-[12px] font-medium tabular-nums" style={{ color: DIM }}>Publishes {fmtDay(q.publish_date)}</span>;
  // Preview: example state, not a claim. Live: published rows ARE real, report them straight.
  if (live) return <span className="text-[12px] tabular-nums" style={{ color: FAINT }}>Published{q.publish_date ? ` · ${fmtDay(q.publish_date)}` : ''}</span>;
  return <span className="text-[12px] tabular-nums" style={{ color: FAINT }}>Example · {fmtDay(q.publish_date)}</span>;
}

type ContentView = 'list' | 'board' | 'feed';
const VIEWS: { id: ContentView; label: string }[] = [
  { id: 'list', label: 'List' },
  { id: 'board', label: 'Board' },
  { id: 'feed', label: 'Feed' },
];

/** Days from today to an ISO date; null when unparseable. Used for the honest
 *  "in N days" hint on review rows — omitted entirely when the date has passed. */
function daysUntil(iso?: string): number | null {
  if (!iso) return null;
  const t = new Date(iso + 'T00:00:00').getTime();
  if (Number.isNaN(t)) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((t - today.getTime()) / 86400000);
}

const STAGE_SOFT_META: Record<Stage, string> = {
  planned: 'planned', drafted: 'in production', review: 'awaiting', scheduled: 'queued', published: 'example',
};

/** Short weekday for the ledger "When" column. */
function weekAbbr(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { weekday: 'short' });
}

/** Full weekday for the live "Scheduled for <day>" marks. */
function weekdayLong(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { weekday: 'long' });
}

/** Mono stage mark for a ledger row — honest, and the auto-publish clock is part of it. */
function stageMark(q: QueueItem, stage: Stage, autoDays: number, live = false): { text: string; sub?: string; color: string; pulse?: boolean } {
  if (stage === 'review') {
    // Live boards publish from the buffer — the mark states the slot truth, never a gate.
    if (live) {
      return q.publish_date
        ? { text: `● Scheduled for ${weekAbbr(q.publish_date)}`, sub: 'yours to edit until then', color: caText('var(--cb-accent)') }
        : { text: '● In the buffer', sub: 'takes the next open slot', color: caText('var(--cb-accent)') };
    }
    return { text: '● Your review', sub: 'waiting on you', color: caText('var(--cb-accent)') };
  }
  if (stage === 'scheduled') return { text: '✓ Scheduled', sub: q.publish_date ? `${weekAbbr(q.publish_date)} ${KIND_TIME[q.kind] || ''}`.trim() : undefined, color: caText('var(--cb-accent)') };
  if (stage === 'drafted') return { text: 'Drafting', color: INK_MUTE, pulse: !!q.generating };
  if (stage === 'published') return { text: 'Published', sub: live ? undefined : 'example', color: INK_MUTE };
  return { text: 'Planned', color: INK_MUTE };
}

/** Narrated build sequence for a drafting row: numbered mono index + plain-English serif
 *  sentence. Exactly one running step (accent frame + pulse + italic); future steps fade. */
function BuildSequence({ trail, accent }: { trail: AgentStep[]; accent: string }) {
  const runningIdx = trail.findIndex((s) => !s.done);
  return (
    <div className="flex flex-col">
      <div className="mb-2 uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.2em', color: INK_MUTE }}>Build sequence · running</div>
      {trail.map((s, i) => {
        const running = i === runningIdx;
        const future = !s.done && !running;
        const num = String(i + 1).padStart(2, '0');
        const sentence = s.detail || stepLabel(s.step);
        if (running) {
          return (
            <div key={i} className="flex gap-3 rounded-[6px] p-2" style={{ margin: '4px 0', border: `1px solid ${caBorder(accent, 40)}`, background: caWash(accent, 7) }}>
              <span style={{ fontFamily: MONO, fontSize: 10, color: caText(accent), width: 20, flex: 'none' }}>{num}</span>
              <span className="flex items-baseline gap-2" style={{ fontFamily: BODY, fontStyle: 'italic', fontSize: 13, lineHeight: 1.5, color: INK }}>
                <span style={{ position: 'relative', top: 1 }}><PulseDot color={accent} size={7} /></span>{sentence}…
              </span>
            </div>
          );
        }
        return (
          <div key={i} className="flex gap-3 py-2" style={{ borderBottom: `1px solid ${DIVIDE}`, opacity: future ? 0.45 : 1 }}>
            <span style={{ fontFamily: MONO, fontSize: 10, color: INK_MUTE, width: 20, flex: 'none' }}>{num}</span>
            <span style={{ fontFamily: BODY, fontSize: 13, lineHeight: 1.5, color: INK }}>{sentence}</span>
          </div>
        );
      })}
      <div className="mt-1" style={{ fontFamily: BODY, fontStyle: 'italic', fontSize: 12, color: INK_MUTE }}>It joins your review stack the moment it's ready.</div>
    </div>
  );
}

/** Lightweight preview for an IDEAS-stage row. Ideas are not approvable yet, so this is
 *  deliberately NOT the DetailModal — just the topic, its pillar, and the promise that it
 *  drafts when it reaches its slot. No feed preview, no agent trail, no actions. */
function IdeaPreviewModal({ idea, accent, onClose, live = false, act }: {
  idea: Idea; accent: string; onClose: () => void; live?: boolean;
  /** Board action recorder (same RPC posture as DetailModal). Live boards record the
   *  client's call on the idea; preview keeps buttons as local theater. */
  act?: (action: 'note' | 'edit_copy', ref?: string | null, payload?: Record<string, unknown> | null) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [busy, setBusy] = useState<'draft' | 'pass' | null>(null);
  const [sent, setSent] = useState<'draft' | 'pass' | null>(null);
  const [err, setErr] = useState('');
  // Direct idea editing (live): the idea text opens into a textarea; Save records a real
  // edit_copy action tagged kind:'idea'. Confirmation only after ok:true.
  const [editing, setEditing] = useState(false);
  const [ideaText, setIdeaText] = useState(idea.hook || '');
  const [editBusy, setEditBusy] = useState(false);
  const [editSaved, setEditSaved] = useState(false);
  const [editErr, setEditErr] = useState('');
  const saveIdeaEdit = async () => {
    if (editBusy) return;
    if (live && act) {
      setEditBusy(true); setEditErr('');
      const r = await act('edit_copy', idea.id, { body: ideaText, kind: 'idea', title: idea.title });
      setEditBusy(false);
      if (!r.ok) { setEditErr(r.error || 'Could not save that. Try again.'); return; }
    }
    setEditSaved(true);
    setEditing(false);
  };
  // Same confirmation discipline as approve/edit/request: the confirmation renders only
  // after the RPC lands ok:true. Preview (no act wired) confirms locally, demo theater.
  const send = async (kind: 'draft' | 'pass') => {
    if (busy || sent) return;
    if (live && act) {
      setBusy(kind); setErr('');
      const r = await act('note', idea.id, {
        event: kind === 'draft' ? 'idea_draft_next' : 'idea_pass',
        idea_id: idea.id,
        title: idea.title,
      });
      setBusy(null);
      if (!r.ok) { setErr(r.error || 'Could not send that. Try again.'); return; }
    }
    setSent(kind);
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="relative mx-auto my-0 flex min-h-full w-full max-w-lg flex-col bg-white sm:my-16 sm:min-h-0 sm:rounded-xl" style={{ boxShadow: '0 30px 80px rgba(2,32,32,.32)' }}>
        <div className="flex items-center gap-2.5 px-5 pb-3 pt-5 sm:px-6 sm:pt-6">
          <span className="uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.2em', color: INK_MUTE }}>Idea</span>
          {/* Type chip: what format this idea drafts into. */}
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-medium" style={{ background: 'rgba(2,49,47,0.05)', color: DIM }}>
            {KIND_LABEL[idea.kind || 'post'] || 'Post'}
          </span>
          {idea.pillar && <span className="capitalize" style={{ fontFamily: MONO, fontSize: 11, color: caText(accent) }}>{idea.pillar}</span>}
          <button onClick={onClose} aria-label="Close" className="ml-auto flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-150 hover:bg-[rgba(2,49,47,0.05)]">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" stroke={DIM} strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="px-5 pb-6 sm:px-6">
          <h3 style={{ fontFamily: SERIF, fontSize: 25, lineHeight: 1.14, letterSpacing: '-0.01em', color: INK }}>{idea.title}</h3>
          {idea.source_label && (
            <div className="mt-2 uppercase" style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.14em', color: FAINT }}>{idea.source_label}</div>
          )}
          {live && editing ? (
            <div className="mt-3">
              <textarea
                value={ideaText}
                onChange={(e) => setIdeaText(e.target.value)}
                rows={Math.min(10, Math.max(3, ideaText.split('\n').length + 1))}
                className="w-full rounded-lg p-3 text-[14px] leading-relaxed outline-none"
                style={{ border: `1.5px solid ${accent}`, color: INK, background: 'rgba(2,49,47,0.02)' }}
              />
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <button
                  onClick={saveIdeaEdit}
                  disabled={editBusy}
                  className="inline-flex min-h-[38px] items-center rounded-[6px] px-4 text-[13px] font-semibold"
                  style={{ background: accent, color: inkOn(accent), opacity: editBusy ? 0.6 : 1 }}
                >
                  {editBusy ? 'Saving…' : 'Save edit'}
                </button>
                <button onClick={() => { setEditing(false); setIdeaText(idea.hook || ''); }} className="text-[13px]" style={{ color: INK_MUTE, background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
                {editErr && <span className="text-[12px]" style={{ color: '#c0392b' }}>{editErr}</span>}
              </div>
            </div>
          ) : (
            <>
              {(editSaved ? ideaText : idea.hook) && (
                <p className="mt-3 max-w-[46ch]" style={{ fontFamily: BODY, fontSize: 14, lineHeight: 1.6, color: INK_SOFT }}>{editSaved ? ideaText : idea.hook}</p>
              )}
              {live && (
                <div className="mt-2 flex items-center gap-3">
                  <button
                    onClick={() => { setEditSaved(false); setEditing(true); }}
                    style={{ fontFamily: BODY, fontStyle: 'italic', fontSize: 13, background: 'none', border: 'none', color: INK_MUTE, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}
                  >
                    edit this idea…
                  </button>
                  {editSaved && <span className="text-[12.5px] font-medium" style={{ color: caText(accent) }}>Saved.</span>}
                </div>
              )}
            </>
          )}
          <div className="mt-5 rounded-[10px] p-4" style={{ background: PAPER_SUNK, border: `1px solid ${LINE}` }}>
            <div className="flex items-center gap-2">
              <PulseDot color={accent} size={6} />
              <span className="uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.14em', color: INK_MUTE }}>In the idea bank</span>
            </div>
            {(idea.source_label || idea.pillar || idea.kind) && (
              <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5">
                {idea.source_label && (
                  <span className="flex flex-col">
                    <span className="uppercase" style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.14em', color: FAINT }}>source</span>
                    <span className="text-[12.5px] font-medium" style={{ color: INK }}>{idea.source_label}</span>
                  </span>
                )}
                {idea.pillar && (
                  <span className="flex flex-col">
                    <span className="uppercase" style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.14em', color: FAINT }}>pillar</span>
                    <span className="text-[12.5px] font-medium capitalize" style={{ color: INK }}>{idea.pillar}</span>
                  </span>
                )}
                {idea.kind && (
                  <span className="flex flex-col">
                    <span className="uppercase" style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.14em', color: FAINT }}>format</span>
                    <span className="text-[12.5px] font-medium capitalize" style={{ color: INK }}>{idea.kind}</span>
                  </span>
                )}
              </div>
            )}
            <p className="mt-2" style={{ fontFamily: BODY, fontStyle: 'italic', fontSize: 13.5, lineHeight: 1.6, color: INK_SOFT }}>
              {live
                ? 'It drafts through the month\'s mix and lands in your review. Pass if you don\'t want it written.'
                : <>{idea.pillar ? `One ${idea.pillar} idea in your bank. ` : 'An idea in your bank. '}It drafts when it reaches its slot, then lands in your review.</>}
            </p>
          </div>

          {/* Live: the client acts on the idea, same approve-first grammar as drafts. The
              RPC note row IS the action; confirmation renders only after ok:true. */}
          {live && (
            <div className="mt-4">
              {sent ? (
                <div className="flex items-center gap-2.5">
                  <span className="text-[13.5px] font-medium" style={{ color: caText(accent) }}>Sent.</span>
                  <span className="text-[12.5px]" style={{ fontFamily: BODY, fontStyle: 'italic', color: INK_MUTE }}>
                    Noted. It stays out of the drafting line.
                  </span>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    onClick={() => send('pass')}
                    disabled={!!busy}
                    className="inline-flex min-h-[42px] items-center rounded-[6px] px-4 text-[13.5px] font-medium"
                    style={{ border: `1px solid ${LINE}`, color: DIM, background: '#fff', cursor: busy ? 'default' : 'pointer', opacity: busy && busy !== 'pass' ? 0.55 : 1 }}
                  >
                    {busy === 'pass' ? 'Sending…' : 'Pass on this'}
                  </button>
                  {err && <span className="text-[12px]" style={{ color: '#c0392b' }}>{err}</span>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Voice-note recorder behind the sidebar "record a voice note" button. Mic-only
 *  MediaRecorder; the clip uploads to the public `client-photos` bucket under
 *  <slug>/voicenotes/ (same anon trust posture as the photo pool), then a note action
 *  tells the operator where it landed. Preview boards keep the whole flow as local
 *  theater: same states, no upload, no RPC (mirrors the other preview actions). */
function VoiceNoteModal({ accent, slug, live, act, onClose }: {
  accent: string; slug: string; live: boolean;
  act?: (action: 'note', ref?: string | null, payload?: Record<string, unknown> | null) => Promise<{ ok: boolean; error?: string }>;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<'idle' | 'recording' | 'preview' | 'sending' | 'sent'>('idle');
  const [err, setErr] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [clip, setClip] = useState<{ blob: Blob; url: string; duration: number; mime: string } | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number>(0);
  const startedAtRef = useRef(0);
  const clipUrlRef = useRef('');

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };
  useEffect(() => () => {
    window.clearInterval(timerRef.current);
    try { if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop(); } catch { /* already stopped */ }
    stopTracks();
    if (clipUrlRef.current) URL.revokeObjectURL(clipUrlRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const startRecording = async () => {
    setErr('');
    if (clip) { URL.revokeObjectURL(clip.url); clipUrlRef.current = ''; setClip(null); }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      const name = e instanceof DOMException ? e.name : '';
      setErr(name === 'NotAllowedError' || name === 'PermissionDeniedError'
        ? 'Mic access is blocked. Allow the microphone in your browser and hit record again.'
        : 'Could not reach a microphone on this device.');
      return;
    }
    streamRef.current = stream;
    // Preferred container; older Safari needs the browser default instead.
    const preferred = 'audio/webm;codecs=opus';
    const mime = typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(preferred) ? preferred : '';
    let rec: MediaRecorder;
    try {
      rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    } catch {
      stopTracks();
      setErr('Recording is not supported in this browser.');
      return;
    }
    chunksRef.current = [];
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    rec.onstop = () => {
      const type = rec.mimeType || mime || 'audio/webm';
      const blob = new Blob(chunksRef.current, { type });
      const url = URL.createObjectURL(blob);
      clipUrlRef.current = url;
      const duration = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
      setClip({ blob, url, duration, mime: type });
      stopTracks();
      window.clearInterval(timerRef.current);
      setPhase('preview');
    };
    recRef.current = rec;
    startedAtRef.current = Date.now();
    setElapsed(0);
    rec.start();
    setPhase('recording');
    timerRef.current = window.setInterval(() => setElapsed(Math.round((Date.now() - startedAtRef.current) / 1000)), 500);
  };

  const stopRecording = () => {
    try { recRef.current?.stop(); } catch { /* already stopped */ }
  };

  const sendClip = async () => {
    if (!clip || phase === 'sending') return;
    // Preview board: confirm locally, demo theater (no upload, no RPC).
    if (!live || !act) { setPhase('sent'); return; }
    setPhase('sending'); setErr('');
    const rand = Math.random().toString(36).slice(2, 8);
    const path = `${slug}/voicenotes/vn-${Date.now()}-${rand}.webm`;
    const { error } = await supabase.storage
      .from('client-photos')
      .upload(path, clip.blob, { upsert: false, contentType: clip.mime || 'audio/webm' });
    if (error) { setPhase('preview'); setErr(error.message || 'Upload failed. Try again.'); return; }
    const r = await act('note', null, { event: 'voice_note', path, duration_s: clip.duration });
    if (!r.ok) { setPhase('preview'); setErr(r.error || 'Could not send that. Try again.'); return; }
    setPhase('sent');
  };

  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="relative mx-auto my-0 flex min-h-full w-full max-w-md flex-col bg-white sm:my-24 sm:min-h-0 sm:rounded-xl" style={{ boxShadow: '0 30px 80px rgba(2,32,32,.32)' }}>
        <div className="flex items-center gap-2.5 px-5 pb-3 pt-5 sm:px-6 sm:pt-6">
          <span className="uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.2em', color: INK_MUTE }}>Voice note</span>
          <button onClick={onClose} aria-label="Close" className="ml-auto flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-150 hover:bg-[rgba(2,49,47,0.05)]">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" stroke={DIM} strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="px-5 pb-6 sm:px-6">
          {phase === 'sent' ? (
            <div>
              <h3 style={{ fontFamily: SERIF, fontSize: 24, lineHeight: 1.14, letterSpacing: '-0.01em', color: INK }}>Got it.</h3>
              <p className="mt-2.5 max-w-[42ch]" style={{ fontFamily: BODY, fontStyle: 'italic', fontSize: 13.5, lineHeight: 1.6, color: INK_SOFT }}>
                A rough idea in, a drafted post or lead magnet back.
              </p>
              <button
                onClick={onClose}
                className="mt-5 inline-flex min-h-[42px] items-center rounded-[7px] px-5 uppercase transition-colors duration-150"
                style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.12em', background: INK, color: PAPER, border: 'none', cursor: 'pointer' }}
              >
                Done
              </button>
            </div>
          ) : (
            <div>
              <h3 style={{ fontFamily: SERIF, fontSize: 24, lineHeight: 1.14, letterSpacing: '-0.01em', color: INK }}>Talk it out.</h3>
              <p className="mt-2 max-w-[44ch]" style={{ fontFamily: BODY, fontSize: 13.5, lineHeight: 1.6, color: INK_SOFT }}>
                Hit record and say the rough idea. It comes back as a drafted post or a lead magnet.
              </p>

              {phase === 'idle' && (
                <button
                  onClick={() => { void startRecording(); }}
                  className="mt-5 inline-flex min-h-[42px] items-center gap-2 rounded-[7px] px-5 uppercase transition-colors duration-150"
                  style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.12em', background: INK, color: PAPER, border: 'none', cursor: 'pointer' }}
                >
                  ◉ Record
                </button>
              )}

              {phase === 'recording' && (
                <div className="mt-5 flex flex-wrap items-center gap-4 rounded-[10px] p-4" style={{ background: PAPER_SUNK, border: `1px solid ${LINE}` }}>
                  <span className="flex items-center gap-2.5">
                    <PulseDot color="#c0392b" size={8} />
                    <span className="tabular-nums" style={{ fontFamily: MONO, fontSize: 16, color: INK }}>{mmss(elapsed)}</span>
                    <span className="uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.14em', color: INK_MUTE }}>Recording</span>
                  </span>
                  <button
                    onClick={stopRecording}
                    className="ml-auto inline-flex min-h-[38px] items-center rounded-[6px] px-4 uppercase"
                    style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.12em', background: INK, color: PAPER, border: 'none', cursor: 'pointer' }}
                  >
                    Stop
                  </button>
                </div>
              )}

              {(phase === 'preview' || phase === 'sending') && clip && (
                <div className="mt-5">
                  <div className="rounded-[10px] p-4" style={{ background: PAPER_SUNK, border: `1px solid ${LINE}` }}>
                    <div className="mb-2.5 flex items-baseline gap-2.5">
                      <span className="uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.14em', color: INK_MUTE }}>Your note</span>
                      <span className="tabular-nums" style={{ fontFamily: MONO, fontSize: 11, color: FAINT }}>{mmss(clip.duration)}</span>
                    </div>
                    <audio controls src={clip.url} className="w-full" style={{ height: 40 }} />
                  </div>
                  <div className="mt-3.5 flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => { void sendClip(); }}
                      disabled={phase === 'sending'}
                      className="inline-flex min-h-[42px] items-center rounded-[7px] px-5 uppercase transition-colors duration-150"
                      style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.12em', background: accent, color: inkOn(accent), border: 'none', cursor: phase === 'sending' ? 'default' : 'pointer', opacity: phase === 'sending' ? 0.6 : 1 }}
                    >
                      {phase === 'sending' ? 'Sending…' : 'Send it'}
                    </button>
                    <button
                      onClick={() => { void startRecording(); }}
                      disabled={phase === 'sending'}
                      style={{ fontFamily: BODY, fontStyle: 'italic', fontSize: 13, background: 'none', border: 'none', color: INK_MUTE, cursor: phase === 'sending' ? 'default' : 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}
                    >
                      re-record
                    </button>
                  </div>
                </div>
              )}

              {err && <p className="mt-3 text-[12.5px] leading-relaxed" style={{ color: '#c0392b' }}>{err}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Body preview that never forces long scrolling: clamps to a few lines, expands on tap.
 *  Short posts show in full with no toggle. Used on the live content ledger rows. */
function CollapsibleBody({ text, onOpen }: { text: string; onOpen?: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const lines = text.split('\n').length;
  const longEnough = text.length > 320 || lines > 6;
  return (
    <div style={{ maxWidth: '64ch' }}>
      <div
        onClick={onOpen}
        className={onOpen ? 'cursor-pointer' : undefined}
        style={{
          fontFamily: BODY, fontSize: 13.5, lineHeight: 1.58, color: INK, whiteSpace: 'pre-line',
          ...(longEnough && !expanded
            ? { display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties
            : {}),
        }}
      >
        {text}
      </div>
      {longEnough && (
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
          className="mt-1.5 uppercase"
          style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.12em', color: caText('var(--cb-accent)'), background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}

function ReviewSurface({ board, accent, mint, stageOf, onOpen, onOpenIdea, onApprove, onRemove, flashId, view, setView, skips, leftEmpty = {}, onLeaveEmpty, onRefillDay, onBackToBuffer, onLeaveDayEmpty, onClearDay, onEditPromo, replacements = {}, pool = [], benchFor, onRestore, onPickReplacement, onPickReplacementAngle, foldPhotos, live = false }: {
  board: Board; accent: string; mint: string;
  stageOf: (q: QueueItem) => Stage;
  onOpen: (q: QueueItem, opts?: { changing?: boolean; editing?: boolean; scheduling?: boolean }) => void;
  onOpenIdea: (idea: Idea) => void;
  /** Live board: published rows are real (no "example" framing) and idea copy names the operator. */
  live?: boolean;
  onApprove: (id: string) => void;
  /** Live board: "remove this post" — the client's veto on a buffered draft (recorded). */
  onRemove?: (id: string) => void;
  /** Deliberately-empty slots (persist, no restore nag) + their toggles. */
  leftEmpty?: Record<string, true>;
  onLeaveEmpty?: (id: string) => void;
  onRefillDay?: (id: string) => void;
  /** Unschedule a post (clears its slot, returns it to the buffer bucket). */
  onBackToBuffer?: (id: string) => void;
  /** Take a scheduled post off its day AND hold the day empty (no auto-fill). */
  onLeaveDayEmpty?: (id: string, date?: string) => void;
  /** Clear a scheduled day (unschedule the post; it returns to the ready list). */
  onClearDay?: (id: string, date?: string) => Promise<{ ok: boolean; error?: string }>;
  /** Live board: save an edit to an LM's delivery email / keyword DM (folded LM drawer). */
  onEditPromo?: (lmId: string, field: 'email' | 'dm', value: unknown) => Promise<{ ok: boolean; error?: string }>;
  flashId: string | null;
  view: ContentView;
  setView: (v: ContentView) => void;
  /** Week-home "skip this day" marks: skipped items stay listed but lose their actions. */
  skips: Record<string, true>;
  /** A freed slot the client refilled from the pool (keyed by slot id). */
  replacements?: Record<string, SlotReplacement>;
  /** Ready drafts (board_visible, off the queue) the client can pull into a freed slot. */
  pool?: PoolDraft[];
  /** The slot's own bench angles. */
  benchFor?: (id: string) => AltAngle[];
  /** Open-slot actions: restore the original, pull a pool draft, or take a bench angle. */
  onRestore?: (id: string) => void;
  onPickReplacement?: (id: string, item: PoolDraft) => void;
  onPickReplacementAngle?: (id: string, alt: AltAngle) => void;
  /** Live mode folds the client photo pool in here (no standalone Photos tab). */
  foldPhotos?: React.ReactNode;
}) {
  const autoDays = board.auto_publish_days ?? 3;
  // Live overrides for the published stage: on a real board published rows are reports,
  // not demo examples. Preview keeps the module constants exactly.
  const stageLabelOf = (s: Stage) => (live && s === 'published' ? 'Published' : live && s === 'review' ? 'Up next' : STAGE_META[s].label);
  // Live: eyebrow + count only — the rows carry the story, framing prose stays out.
  const listSections = live
    ? LIST_STAGE_SECTIONS.map((s) => ({ ...s, blurb: '', label: s.stage === 'review' ? 'Up next' : s.label }))
    : LIST_STAGE_SECTIONS;
  const ideasBlurb = live ? 'Ideas waiting in your bank. Ask for the ones you want drafted next, or pass.' : IDEAS_BLURB;
  const reduce = useReducedMotion();
  const fontStack = board.brand?.font_heading ? `"${board.brand.font_heading}", Inter, system-ui, sans-serif` : 'Inter, system-ui, sans-serif';
  const groups = STAGE_ORDER.map((s) => ({ stage: s, items: board.queue.filter((q) => stageOf(q) === s) }));
  const stageDot = (s: Stage) => (s === 'review' ? accent : s === 'published' ? 'var(--cb-mint)' : FAINT);
  // All content LIST view = the pipeline grouped BY STAGE (distinct from the This week
  // deck, which is a day-by-day approval flow). Within a stage, rows sort by date.
  // The engine's idea bank leads at the top: upcoming topics not yet drafted.
  const ideas = board.ideas || [];
  const byDate = (a: QueueItem, b: QueueItem) => (a.publish_date || '9999-99').localeCompare(b.publish_date || '9999-99');
  const firstReviewId = groups.find((g) => g.stage === 'review')?.items.filter((q) => !skips[q.id]).sort(byDate)[0]?.id || null;
  const [openRow, setOpenRow] = useState<string | null>(firstReviewId);
  /** Open-slot: which freed slot currently has its replacement picker expanded. */
  const [pickerRow, setPickerRow] = useState<string | null>(null);
  /** Live pool: a lead-magnet row opens the full asset drawer (cover, live page, promo kit). */
  const [lmDetail, setLmDetail] = useState<LeadMagnetEntry | null>(null);
  const flashStyle = (id: string): React.CSSProperties => ({
    background: flashId === id ? FLASH_BG : undefined,
    transition: 'background-color 700ms ease',
  });

  // The approve moment: check path-draws on the row (~300ms), then the optimistic
  // stage move fires and the row settles into Scheduled. Hovered review rows also
  // take A (approve) and R (request change) from the keyboard.
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const approveTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(approveTimer.current), []);
  const startApprove = (id: string) => {
    if (approvingId) return;
    if (reduce) { setHoverId(null); onApprove(id); return; }
    setApprovingId(id);
    window.clearTimeout(approveTimer.current);
    approveTimer.current = window.setTimeout(() => {
      setApprovingId(null);
      // The row travels to Scheduled out from under the cursor — mouseleave never
      // fires, so clear the hover target or A/R keep aiming at the moved row.
      setHoverId(null);
      onApprove(id);
    }, 420);
  };
  const reviewIds = (groups.find((g) => g.stage === 'review')?.items || []).filter((q) => !skips[q.id]).map((q) => q.id);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (live) return; // live boards have no approve/request-change keys
      if (!hoverId || !reviewIds.includes(hoverId)) return;
      if (e.key === 'a' || e.key === 'A') { e.preventDefault(); startApprove(hoverId); }
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        const item = board.queue.find((q) => q.id === hoverId);
        if (item) onOpen(item, { changing: true });
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoverId, approvingId, reviewIds.join(','), board]);

  // Feed identity + honest counts: count exactly what the feed view renders below, so the
  // header can never contradict the cards (the calendar week window can be sparser than
  // the actual review queue).
  const founder = board.founder;
  const feedItems = board.queue
    .filter((q) => (stageOf(q) === 'review' || stageOf(q) === 'scheduled') && q.body && !skips[q.id])
    .sort((a, b) => (a.publish_date || '').localeCompare(b.publish_date || ''));
  const weekCounts = {
    posts: feedItems.filter((q) => q.kind === 'post' || q.kind === 'carousel').length,
    lms: feedItems.filter((q) => q.kind === 'lm').length,
  };

  // One unfolding ledger row, reused across every stage section in the list view.
  const renderLedgerRow = (q: QueueItem) => {
    const stage = stageOf(q);
    const skipped = stage === 'review' && !!skips[q.id];
    const isOpen = openRow === q.id;
    const mark = stageMark(q, stage, autoDays, live);
    const rowBg = stage === 'review' && !skipped ? caWash(accent, 5) : (flashId === q.id ? FLASH_BG : 'transparent');
    // Honest source chip (live): the concrete source_detail, never a vague "Picked by Ivan".
    const chip = live ? sourceChip(q) : null;
    const provenance = chip ? chip.label
      : stage === 'review' ? q.promise || ''
      : q.generating ? 'reactive: drafting began after the news broke'
      : q.promise || '';
    // Compact live date: the scheduled slot in Mattan's timezone, or the buffer.
    const dateCol = live
      ? (isScheduled(q) ? fmtSchedLA(q.scheduled_at, q.publish_date) : 'not scheduled')
      : (q.publish_date ? `${weekAbbr(q.publish_date)} ${KIND_TIME[q.kind] || ''}`.trim() : 'date at sign-off');
    return (
      <div key={q.id} style={{ borderBottom: `1px solid ${LINE}` }}>
        <div
          role="button" tabIndex={0}
          onClick={() => setOpenRow(isOpen ? null : q.id)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenRow(isOpen ? null : q.id); } }}
          className="cb-ledger-row grid cursor-pointer items-center gap-x-[18px] px-3.5 py-[11px] transition-colors duration-150 hover:brightness-[0.985] sm:grid-cols-[104px_minmax(0,1fr)_104px_150px_22px]"
          style={{ margin: '0 -14px', background: rowBg, opacity: skipped ? 0.6 : 1, transition: 'background-color 700ms ease' }}
        >
          <span style={{ fontFamily: MONO, fontSize: 11, lineHeight: 1.35, color: INK_SOFT }}>{dateCol}</span>
          <span className="flex min-w-0 items-start gap-2.5">
            {/* Attached photo (manual or auto-rotated lifestyle): a small thumbnail on the card. */}
            {q.media_url && (
              <img src={q.media_url} alt="" loading="lazy" className="mt-0.5 shrink-0 rounded-md object-cover" style={{ width: 40, height: 40, border: `1px solid ${LINE}` }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
            )}
            <span className="min-w-0">
              {/* Live: the hook wraps — the reader can tell what the post is about from the row.
                  Preview keeps the single-line ledger look. Compact type for density. */}
              <span className={live ? 'block' : 'block truncate'} style={{ fontFamily: BODY, fontWeight: 600, fontSize: 14, lineHeight: live ? 1.3 : undefined, color: INK }}>{q.hook || q.title}</span>
              {provenance && <span className="block truncate" style={{ fontFamily: BODY, fontStyle: 'italic', fontSize: 11.5, color: INK_MUTE }}>{provenance}</span>}
            </span>
          </span>
          <span className="hidden sm:block" style={{ fontFamily: MONO, fontSize: 11, color: INK_MUTE }}>{kickerOf(q)}</span>
          <span className="hidden sm:block" style={{ fontFamily: MONO, fontSize: 11, color: mark.color }}>
            {mark.text}{mark.pulse && <span className="ml-1.5 inline-block"><PulseDot color={accent} size={6} /></span>}
            {mark.sub && <><br /><span style={{ color: INK_MUTE, fontSize: 10 }}>{mark.sub}</span></>}
          </span>
          <span className="hidden text-right sm:block" style={{ fontFamily: MONO, fontSize: 13, color: INK_MUTE }}>{isOpen ? '▾' : '▸'}</span>
        </div>
        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              initial={reduce ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={reduce ? undefined : { opacity: 0, height: 0 }}
              transition={{ duration: 0.35, ease: EASE }}
              className="overflow-hidden"
              style={{ margin: '0 -14px', background: rowBg }}
            >
              <div className={live && q.body ? 'grid gap-6 px-3.5 pb-6 pt-1.5 lg:grid-cols-[minmax(0,1fr)_240px]' : 'grid gap-6 px-3.5 pb-6 pt-1.5 lg:grid-cols-[430px_1fr]'}>
                {live && q.body ? (
                  /* Live: the copy is the reading surface. Long posts collapse to a 4-line
                     preview (expand on tap) so the ledger never forces a long scroll. */
                  <div style={{ maxWidth: '64ch' }}>
                    <CollapsibleBody text={q.body} onOpen={() => onOpen(q)} />
                    {q.media_url && <img src={q.media_url} alt="" loading="lazy" className="mt-4 rounded-lg" style={{ maxHeight: 200, border: `1px solid ${LINE}` }} />}
                  </div>
                ) : (
                <div style={{ maxWidth: 430 }}>
                  {q.body || stage === 'review' || stage === 'scheduled'
                    ? <FeedPreview item={q.body ? q : { ...q, body: q.body }} board={board} accent={accent} fontStack={fontStack} size="sm" cover={q.generating ? 'render' : 'plate'} live={live} />
                    : q.generating
                    ? <FeedPreview item={q} board={board} accent={accent} fontStack={fontStack} size="sm" cover="render" live={live} />
                    : <FeedPreview item={q} board={board} accent={accent} fontStack={fontStack} size="sm" live={live} />}
                </div>
                )}
                <div className="flex flex-col gap-3 pt-1.5">
                  {stage === 'review' && !skipped && live ? (
                    <>
                      {/* One clean set of choices — no buffer jargon. Edit the words, or clear
                          the day (the post goes back to your ready posts). Time is edited from
                          the post's own view. */}
                      <div className="flex flex-wrap items-center gap-2.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); onOpen(q, { editing: true }); }}
                          className="inline-flex min-h-[40px] items-center rounded-[7px] px-5 text-[14px] font-semibold"
                          style={{ background: INK, color: PAPER, border: 'none', cursor: 'pointer' }}
                        >Edit</button>
                        {isScheduled(q) && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onClearDay?.(q.id, q.publish_date); }}
                            className="inline-flex min-h-[40px] items-center rounded-[7px] px-4 text-[14px] font-medium"
                            style={{ border: `1px solid ${LINE}`, color: DIM, background: '#fff', cursor: 'pointer' }}
                          >Clear this day</button>
                        )}
                      </div>
                      {chip?.quote && (
                        <p className="mt-0.5" style={{ fontFamily: BODY, fontStyle: 'italic', fontSize: 12.5, lineHeight: 1.55, color: INK_MUTE, maxWidth: '52ch' }}>
                          “{chip.quote}”
                        </p>
                      )}
                      <div style={{ fontFamily: BODY, fontStyle: 'italic', fontSize: 12, color: INK_MUTE }}>
                        {isScheduled(q) ? <>Scheduled for {fmtSchedLA(q.scheduled_at, q.publish_date)}. <button onClick={(e) => { e.stopPropagation(); onOpen(q, { scheduling: true }); }} style={{ fontFamily: BODY, fontStyle: 'italic', fontSize: 12, color: caText(accent), background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3, padding: 0 }}>Edit time</button></> : <>Not on the calendar yet. <button onClick={(e) => { e.stopPropagation(); onOpen(q, { scheduling: true }); }} style={{ fontFamily: BODY, fontStyle: 'italic', fontSize: 12, color: caText(accent), background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3, padding: 0 }}>Set date &amp; time</button></>}
                      </div>
                    </>
                  ) : stage === 'review' && !skipped ? (
                    <>
                      <p style={{ fontFamily: BODY, fontSize: 13.5, lineHeight: 1.6, color: INK_SOFT, maxWidth: '40ch' }}>Exactly how it lands in the feed. Approve it, or say what to change in plain words.</p>
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); onApprove(q.id); }}
                          className="uppercase transition-colors duration-150"
                          style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.14em', background: INK, color: PAPER, border: 'none', borderRadius: 7, padding: '12px 20px', cursor: 'pointer' }}
                          onMouseEnter={(ev) => { (ev.currentTarget as HTMLButtonElement).style.background = `color-mix(in oklab, ${accent} 80%, #1A1A1A)`; }}
                          onMouseLeave={(ev) => { (ev.currentTarget as HTMLButtonElement).style.background = INK; }}
                        >Approve ✓</button>
                        <button onClick={(e) => { e.stopPropagation(); onOpen(q, { editing: true }); }} style={{ fontFamily: BODY, fontStyle: 'italic', fontSize: 13, background: 'none', border: 'none', color: INK_MUTE, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}>edit the post…</button>
                        <button onClick={(e) => { e.stopPropagation(); onOpen(q, { changing: true }); }} style={{ fontFamily: BODY, fontStyle: 'italic', fontSize: 13, background: 'none', border: 'none', color: INK_MUTE, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}>request a change…</button>
                      </div>
                      <div style={{ fontFamily: BODY, fontStyle: 'italic', fontSize: 12, color: INK_MUTE }}>Nothing publishes until you approve it.</div>
                    </>
                  ) : stage === 'review' && skipped && live ? (
                    (() => {
                      const repl = replacements[q.id];
                      const bench = benchFor ? benchFor(q.id) : [];
                      const showPicker = pickerRow === q.id;
                      // Deliberately left empty: quiet, persistent, no restore nag. The only
                      // way back is reopening the day on purpose.
                      if (leftEmpty[q.id]) {
                        return (
                          <div className="rounded-lg p-3.5" style={{ background: caWash('#1a1a1a', 3), border: `1px dashed ${LINE}` }}>
                            <div className="uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.14em', color: INK_MUTE }}>this day is left empty</div>
                            <p className="mt-1.5" style={{ fontFamily: BODY, fontSize: 13, lineHeight: 1.6, color: INK_SOFT }}>Nothing publishes here. It stays clear until you reopen the day.</p>
                            <button onClick={(e) => { e.stopPropagation(); onRefillDay?.(q.id); }} className="mt-2" style={{ fontFamily: BODY, fontStyle: 'italic', fontSize: 12.5, color: INK_MUTE, textDecoration: 'underline', textUnderlineOffset: 3, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>reopen this day</button>
                          </div>
                        );
                      }
                      if (repl) {
                        return (
                          <div className="rounded-lg p-3.5" style={{ background: caWash(accent, 5), border: `1px solid ${caBorder(accent, 30)}` }}>
                            <div className="uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.14em', color: caText(accent) }}>now running in this slot</div>
                            <div className="mt-1.5" style={{ fontFamily: BODY, fontWeight: 600, fontSize: 14.5, color: INK }}>{repl.title || 'A ready draft'}</div>
                            {(repl.body || repl.hook) && <p className="mt-0.5" style={{ fontFamily: BODY, fontSize: 13, lineHeight: 1.55, color: INK_SOFT }}>{repl.body || repl.hook}</p>}
                            <button onClick={(e) => { e.stopPropagation(); onRestore?.(q.id); }} className="mt-2.5" style={{ fontFamily: BODY, fontStyle: 'italic', fontSize: 12.5, color: INK_MUTE, textDecoration: 'underline', textUnderlineOffset: 3, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>undo and bring the original back</button>
                          </div>
                        );
                      }
                      return (
                        <div className="rounded-lg p-3.5" style={{ background: caWash('#1a1a1a', 3), border: `1px dashed ${LINE_BOLD}` }}>
                          <div className="uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.14em', color: INK_MUTE }}>your slot · open</div>
                          <p className="mt-1.5" style={{ fontFamily: BODY, fontSize: 13.5, lineHeight: 1.6, color: INK_SOFT }}>Your slot. Post your own, restore this one, or pick a replacement.</p>
                          <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
                            <button onClick={(e) => { e.stopPropagation(); onRestore?.(q.id); }} className="rounded-[6px] px-3 py-2 text-[12.5px] font-semibold" style={{ border: `1px solid ${LINE}`, color: INK, background: '#fff', cursor: 'pointer' }}>Restore this post</button>
                            <button onClick={(e) => { e.stopPropagation(); setPickerRow(showPicker ? null : q.id); }} className="rounded-[6px] px-3 py-2 text-[12.5px] font-semibold" style={{ background: accent, color: inkOn(accent), border: 'none', cursor: 'pointer' }}>{showPicker ? 'Close' : 'Pick a replacement'}</button>
                            <button onClick={(e) => { e.stopPropagation(); onLeaveEmpty?.(q.id); }} className="px-2.5 py-2 text-[12.5px] font-medium" style={{ color: INK_MUTE, background: 'none', border: 'none', textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer' }}>Leave this day empty</button>
                          </div>
                          {showPicker && (
                            <div className="mt-3 flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                              {bench.length === 0 && pool.length === 0 ? (
                                <p style={{ fontFamily: BODY, fontStyle: 'italic', fontSize: 12.5, color: INK_MUTE }}>No other ready drafts to pull in yet. Post your own in this slot, or restore the original.</p>
                              ) : (
                                <>
                                  {bench.length > 0 && <div className="uppercase" style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.14em', color: FAINT }}>from this slot&apos;s bench</div>}
                                  {bench.map((alt) => (
                                    <div key={alt.id} className="flex items-start justify-between gap-3 rounded-lg p-2.5" style={{ border: `1px solid ${LINE}`, background: '#fff' }}>
                                      <span className="min-w-0"><span className="block text-[13px] font-semibold" style={{ color: INK }}>{alt.title}</span><span className="block text-[12px]" style={{ color: DIM }}>{alt.hook}</span></span>
                                      <button onClick={() => { setPickerRow(null); onPickReplacementAngle?.(q.id, alt); }} className="shrink-0 rounded-[6px] px-2.5 py-1.5 text-[12px] font-semibold" style={{ background: accent, color: inkOn(accent), border: 'none', cursor: 'pointer' }}>Use this</button>
                                    </div>
                                  ))}
                                  {pool.length > 0 && <div className="mt-1 uppercase" style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.14em', color: FAINT }}>from your ready drafts</div>}
                                  {pool.map((it) => (
                                    <div key={it.id} className="flex items-start justify-between gap-3 rounded-lg p-2.5" style={{ border: `1px solid ${LINE}`, background: '#fff' }}>
                                      <span className="min-w-0"><span className="block text-[13px] font-semibold" style={{ color: INK }}>{it.title || 'Ready draft'}</span>{it.body && <span className="block truncate text-[12px]" style={{ color: DIM }}>{it.body}</span>}</span>
                                      <button onClick={() => { setPickerRow(null); onPickReplacement?.(q.id, it); }} className="shrink-0 rounded-[6px] px-2.5 py-1.5 text-[12px] font-semibold" style={{ background: accent, color: inkOn(accent), border: 'none', cursor: 'pointer' }}>Use this</button>
                                    </div>
                                  ))}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()
                  ) : q.generating ? (
                    <BuildSequence trail={q.agent_trail || []} accent={accent} />
                  ) : stage === 'scheduled' ? (
                    <div style={{ fontFamily: BODY, fontStyle: 'italic', fontSize: 13.5, lineHeight: 1.6, color: caText(accent) }}>{live ? `Scheduled${q.publish_date ? ` for ${weekdayLong(q.publish_date)}` : ''}. It publishes on its slot.` : 'Signed off. On the schedule.'}</div>
                  ) : q.kind === 'lm' ? (
                    <div style={{ fontFamily: BODY, fontStyle: 'italic', fontSize: 13.5, lineHeight: 1.6, color: INK_MUTE, maxWidth: '38ch' }}>{live ? 'Live: a real assessment your audience can take, not a cover image. Try it in the Lead magnets tab.' : 'Live on your domain: a real assessment your audience can take, not a cover image. Try it in the Lead magnets tab.'}</div>
                  ) : stage === 'published' ? (
                    <div style={{ fontFamily: BODY, fontStyle: 'italic', fontSize: 13.5, lineHeight: 1.6, color: INK_MUTE, maxWidth: '38ch' }}>{live ? 'Nothing published yet. Approved posts report here once they go live.' : 'An example of how your published posts will report here once the engine is live. Nothing has run on your account yet.'}</div>
                  ) : (
                    <div style={{ fontFamily: BODY, fontStyle: 'italic', fontSize: 13.5, lineHeight: 1.6, color: INK_MUTE, maxWidth: '38ch' }}>{skipped ? 'Skipped this week. Nothing publishes in this slot.' : 'In production. It lands in your review the moment it is ready.'}</div>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); onOpen(q); }} className="mt-1 inline-flex w-fit items-center gap-1.5 uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.12em', color: INK_MUTE, background: 'none', border: 'none', cursor: 'pointer' }}>
                    open the post →
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  // One IDEAS-stage row: title + pillar dot + a quiet "queued as an idea" mark. Opens a
  // lightweight preview, never the approve flow.
  const renderIdeaRow = (idea: Idea) => (
    <div key={idea.id} style={{ borderBottom: `1px solid ${LINE}` }}>
      <div
        role="button" tabIndex={0}
        onClick={() => onOpenIdea(idea)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenIdea(idea); } }}
        className="cb-ledger-row grid cursor-pointer items-center gap-x-[18px] px-3.5 py-[15px] transition-colors duration-150 hover:brightness-[0.985] sm:grid-cols-[96px_minmax(0,1fr)_110px_190px_26px]"
        style={{ margin: '0 -14px' }}
      >
        <span style={{ fontFamily: MONO, fontSize: 12, color: INK_MUTE }}>idea</span>
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="h-[6px] w-[6px] shrink-0 rounded-full" style={{ background: caText(accent) }} aria-hidden />
          <span className="min-w-0">
            <span className="block truncate" style={{ fontFamily: BODY, fontWeight: 600, fontSize: 16, color: INK }}>{idea.title}</span>
            {idea.hook && <span className="block truncate" style={{ fontFamily: BODY, fontStyle: 'italic', fontSize: 12.5, color: INK_MUTE }}>{idea.hook}</span>}
          </span>
        </span>
        <span className="hidden capitalize sm:block" style={{ fontFamily: MONO, fontSize: 11, color: INK_MUTE }}>{idea.pillar || 'idea'}</span>
        <span className="hidden sm:block" style={{ fontFamily: MONO, fontSize: 11, color: INK_MUTE }}>queued as an idea</span>
        <span className="hidden text-right sm:block" style={{ fontFamily: MONO, fontSize: 13, color: INK_MUTE }}>→</span>
      </div>
    </div>
  );

  return (
    <div>
      {/* Header stays capped at the list width in every view, so the view switcher
          never jumps when the board view widens the canvas. */}
      <div className="flex max-w-[880px] flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-[240px] flex-1">
          <SectionHead
            eyebrow="All content"
            title={live ? <>Every piece, <Accent>one pool.</Accent></> : <>Every piece, <Accent>in your voice.</Accent></>}
            sub={live ? undefined : `Ideas, drafts and scheduled posts, each moving toward its slot. Nothing goes out until you approve it.`}
          />
        </div>
        <div className="inline-flex shrink-0 overflow-hidden rounded-[8px]" style={{ border: `1px solid ${LINE}` }} role="tablist" aria-label="Content view">
          {VIEWS.map((v, i) => (
            <button
              key={v.id}
              role="tab"
              aria-selected={view === v.id}
              onClick={() => setView(v.id)}
              className="min-h-[34px] px-3.5 uppercase transition-colors duration-150"
              style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.1em', borderLeft: i > 0 ? `1px solid ${LINE}` : 'none', ...(view === v.id ? { background: caWash(accent, 8), color: caText(accent) } : { background: 'transparent', color: INK_MUTE }) }}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {view === 'list' && (() => {
        /* IDEAS — the engine's upcoming idea bank, not yet drafted. Preview/demo only:
           on a live client board the idea queue lives on Ivan's side (Client Ops), so
           the client sees finished posts, never the raw idea bank. Hides when absent. */
        const ideasSection = (!live && ideas.length > 0) ? (
          <section>
            <LedgerSectionHead eyebrow="Ideas" count={ideas.length} blurb={ideasBlurb} accent={accent} />
            {ideas.map(renderIdeaRow)}
          </section>
        ) : null;
        /* Stage groups: Your review → Drafting → Scheduled → Published. Empty stages hide. */
        const stageSections = listSections.map(({ stage, label, blurb }) => {
          const rows = (groups.find((g) => g.stage === stage)?.items || []).slice().sort(byDate);
          if (rows.length === 0) return null;
          // Live "Up next" = ONLY posts with a real scheduled slot. Buffer drafts (no
          // scheduled_at) NEVER appear here — they live in their own clearly-labeled bucket
          // below, so "Up next" is always an honest forward calendar.
          if (live && stage === 'review') {
            const scheduledRows = rows.filter(isScheduled);
            const bufferRows = rows.filter((q) => !isScheduled(q));
            return (
              <React.Fragment key={stage}>
                {scheduledRows.length > 0 && (
                  <section>
                    <LedgerSectionHead eyebrow="Up next" count={scheduledRows.length} blurb="" accent={accent} />
                    {scheduledRows.map(renderLedgerRow)}
                  </section>
                )}
                {bufferRows.length > 0 && (
                  <section>
                    <LedgerSectionHead eyebrow="Ready to schedule" count={bufferRows.length} blurb="Written and waiting. Add one to any open day, or remove it." accent={accent} />
                    {bufferRows.map(renderLedgerRow)}
                  </section>
                )}
              </React.Fragment>
            );
          }
          return (
            <section key={stage}>
              <LedgerSectionHead eyebrow={label} count={rows.length} blurb={blurb} accent={accent} />
              {rows.map(renderLedgerRow)}
            </section>
          );
        });
        /* Lead magnets are no longer a separate All-content section: they live in the dedicated
           Lead magnets tab, and their launch posts flow through the pool as "Lead magnet launch"
           items (per Ivan 2026-07-20). */
        /* Live boards lead with the work that needs the client (Your review first); a wall
           of ideas above the review stack made the drafts look missing. Preview boards keep
           ideas first, since the sales-funnel boards are built around that order. */
        return (
          <div className="max-w-[980px]">
            {live ? <>{stageSections}{ideasSection}</> : <>{ideasSection}{stageSections}</>}
          </div>
        );
      })()}

      {view === 'board' && (
        <LayoutGroup id="cb-board">
          <div className="overflow-x-auto pb-2">
            <div className="flex items-start gap-3" style={{ minWidth: 'max-content' }}>
              {groups.map(({ stage, items }) => (
                <div key={stage} className="w-[248px] shrink-0 rounded-xl p-2" style={{ background: 'rgba(2,49,47,0.03)' }}>
                  <div className="flex items-center gap-2 px-1.5 pb-2 pt-1">
                    <span className="h-[6px] w-[6px] rounded-full" style={{ background: stageDot(stage) }} aria-hidden />
                    <span className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: stage === 'review' ? accent : DIM }}>{stageLabelOf(stage)}</span>
                    <span className="rounded-full bg-white px-1.5 text-[11px] font-semibold tabular-nums" style={{ color: DIM }}>{items.length}</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {items.length === 0 && (
                      <div className="rounded-lg px-3 py-4 text-[12px]" style={{ color: FAINT, border: `1px dashed ${LINE}` }}>Nothing here right now.</div>
                    )}
                    {items.map((q) => (
                      <motion.button
                        layout
                        layoutId={`b-${q.id}`}
                        key={q.id}
                        transition={{ layout: { duration: 0.25, ease: EASE } }}
                        onClick={() => onOpen(q)}
                        className={`flex w-full flex-col gap-2 rounded-lg bg-white p-2.5 text-left ${LIFT}`}
                        style={{ ...flashStyle(q.id) }}
                      >
                        {/* Text posts skip the typographic thumb here — the card already
                            leads with the title, so the tile would say it twice. */}
                        {!(q.kind === 'post' && !q.media_url && !q.cover_url) && <Thumb q={q} accent={accent} large />}
                        <span className="text-[10.5px] font-medium uppercase tracking-[0.08em]" style={{ color: FAINT }}>{kickerOf(q)}</span>
                        <span className="text-[13px] font-medium leading-snug" style={{ color: INK, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {q.hook || q.title}
                        </span>
                        <span>
                          {stage === 'review' && skips[q.id]
                            ? <span className="text-[12px]" style={{ color: FAINT }}>Skipped this week</span>
                            : stageStatus(q, stage, undefined, live)}
                        </span>
                      </motion.button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </LayoutGroup>
      )}

      {view === 'feed' && (
        <div className="max-w-[880px] rounded-xl px-3 py-6 sm:px-6" style={{ background: '#f3f2ef', border: `1px solid ${LINE}` }}>
          <div className="mx-auto mb-5 max-w-[552px]">
            <h3 className="text-[18px] font-semibold tracking-tight" style={{ color: INK }}>{live ? 'Up next on your LinkedIn' : 'Next week on your LinkedIn'}</h3>
            <p className="mt-1 text-[13.5px]" style={{ color: DIM }}>
              {[
                weekCounts.posts > 0 ? `${weekCounts.posts} post${weekCounts.posts === 1 ? '' : 's'}` : '',
                weekCounts.lms > 0 ? `${weekCounts.lms} lead magnet${weekCounts.lms === 1 ? '' : 's'}` : '',
              ].filter(Boolean).join(', ') || 'Your feed'}, drafted from your voice.
            </p>
          </div>
          <div className="flex flex-col">
            {feedItems.map((q) => (
              <div key={q.id} className="cb-linkedin-preview mx-auto w-full max-w-[552px]">
                <div className="mb-1.5 mt-4 px-1 text-[11px] font-semibold uppercase tracking-[0.08em] tabular-nums first:mt-0" style={{ color: FAINT }}>
                  {fmtDay(q.publish_date)}
                </div>
                <LinkedInPostPreview
                  text={q.body || ''}
                  author={founder?.name || board.company_name}
                  headline={founder?.headline || ''}
                  avatarUrl={founder?.avatar_url || ''} /* '' forces initials — the component's default is Ivan's portrait */
                  mediaUrl={q.media_url || undefined}
                  stats={{ reactions: 0, comments: 0 }}
                  timeLabel="Preview" /* future posts: no "1d · Edited" chrome */
                  showFold
                />
              </div>
            ))}
            {feedItems.length === 0 && (
              <div className="mx-auto max-w-[552px] rounded-[12px] bg-white px-4 py-6 text-[13px]" style={{ color: DIM, border: `1px solid ${LINE}` }}>
                Your first drafts land here this week. This view shows them exactly as they'll run on your feed.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Story intake: where the client's REAL material enters the engine. The chip is a
          format explainer, not history — nothing on this card claims past activity.
          Preview-only: on live boards idea intake lives on the operator side. */}
      {!live && (
      <div className="mt-8 max-w-[880px] rounded-xl bg-white p-4 sm:p-5" style={{ border: `1px solid ${LINE}` }}>
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: `color-mix(in srgb, ${accent} 10%, white)` }} aria-hidden>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
              <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v3" />
            </svg>
          </span>
          <div className="min-w-0">
            <CardHead>Your stories</CardHead>
            <p className="mt-1 max-w-[58ch] text-[13.5px] leading-relaxed" style={{ color: DIM }}>
              Once a week, send a voice note about a real client situation. True stories become posts; nothing gets invented.
            </p>
            <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium" style={{ background: 'rgba(2,49,47,0.04)', color: DIM }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
              </svg>
              a 90-second note becomes 1-2 posts
            </span>
          </div>
        </div>
      </div>
      )}

      {/* Live mode: the client photo pool folds in here (no standalone Photos tab). */}
      {foldPhotos && (
        <div className="mt-8 max-w-[880px] rounded-xl bg-white p-4 sm:p-5" style={{ border: `1px solid ${LINE}` }}>
          {foldPhotos}
        </div>
      )}

      {lmDetail && (
        <LmDetailDrawer entry={lmDetail} board={board} accent={accent} mint={mint} fontStack={fontStack} live={live} onClose={() => setLmDetail(null)} onEditPromo={live ? onEditPromo : undefined} />
      )}
    </div>
  );
}

// ---------- Week home: "Your next 7 days" ----------
function weekDayList(startIso: string): string[] {
  const start = new Date(startIso + 'T00:00:00');
  return Array.from({ length: 7 }, (_, i) => new Date(start.getTime() + i * 86400000).toISOString().slice(0, 10));
}
const KIND_SORT: Record<string, number> = { newsletter: 0, post: 1, carousel: 2, lm: 3, newsjack: 4 };
interface WeekSlot { key: string; q?: QueueItem; cal?: CalendarItem }

/** Compact lead-magnet card for a launch post: cover thumbnail + landing/resource links,
 *  so a launch post reads as ready (not "where is the page?"). Cover is 404-safe: it
 *  self-hides on load error, and the links still show. Uses theme tokens, so it re-skins
 *  in blackbox automatically. */
function LmLaunchCard({ lm, accent }: { lm: { title: string; landing: string; resource?: string; cover?: string }; accent: string }) {
  const [coverOk, setCoverOk] = useState(true);
  const linkStyle: React.CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: '0.06em', color: caText(accent), textDecoration: 'underline', textUnderlineOffset: 3 };
  // Only show two links when the landing and resource genuinely differ. When they are the
  // same page (the usual case), show ONE link so it never reads as two identical links.
  const twoLinks = !!lm.resource && lm.resource !== lm.landing;
  return (
    <div className="mt-1 rounded-lg p-2.5" style={{ background: PAPER_SUNK, border: `1px solid ${LINE}` }}>
      <div className="uppercase" style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.14em', color: INK_MUTE, marginBottom: 6 }}>The lead magnet it launches</div>
      <div className="flex items-start gap-2.5">
        {lm.cover && coverOk && (
          <img src={lm.cover} alt="" loading="lazy" onError={() => setCoverOk(false)} className="rounded-md object-cover" style={{ width: 54, height: 54, flexShrink: 0, border: `1px solid ${LINE}` }} />
        )}
        <div className="min-w-0">
          <div className="truncate" style={{ fontFamily: BODY, fontWeight: 600, fontSize: 13, color: INK }}>{lm.title}</div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            {twoLinks ? (
              <>
                <a href={lm.landing} target="_blank" rel="noopener noreferrer" className="uppercase" style={linkStyle}>Landing page →</a>
                <a href={lm.resource} target="_blank" rel="noopener noreferrer" className="uppercase" style={linkStyle}>Resource →</a>
              </>
            ) : (
              <a href={lm.landing} target="_blank" rel="noopener noreferrer" className="uppercase" style={linkStyle}>Open the lead magnet →</a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Inline date + time editor, entered and shown in the client's timezone (LA / PT). Saves
 *  the real UTC instant through onSave (client_board_set_schedule). Used directly on the
 *  week card so the client changes the time without digging into a modal. */
function ScheduleTimeEditor({ scheduledAt, accent, onSave, onCancel }: {
  scheduledAt?: string; accent: string;
  onSave: (iso: string) => Promise<{ ok: boolean; error?: string }>;
  onCancel: () => void;
}) {
  const init = laParts(scheduledAt);
  const [date, setDate] = useState(init.date);
  const [time, setTime] = useState(init.time);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const ink = inkOn(accent);
  const save = async () => {
    if (!date) return;
    setBusy(true); setErr('');
    const r = await onSave(laWallToUtcISO(date, time || '09:00'));
    setBusy(false);
    if (!r.ok) { setErr(r.error === 'bad_date' ? 'Pick a date within the next year.' : (r.error || 'Could not save that. Try again.')); return; }
    onCancel();
  };
  return (
    <div className="rounded-lg p-2.5" style={{ background: PAPER_SUNK, border: `1px solid ${LINE}` }} onClick={(e) => e.stopPropagation()}>
      <div className="uppercase" style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.12em', color: INK_MUTE, marginBottom: 6 }}>Date &amp; time (your time, PT)</div>
      <div className="flex flex-wrap items-center gap-2">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-[6px] px-2.5 py-2 text-[13px]" style={{ border: `1px solid ${LINE}`, color: INK, background: '#fff' }} />
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="rounded-[6px] px-2.5 py-2 text-[13px]" style={{ border: `1px solid ${LINE}`, color: INK, background: '#fff' }} />
        <button onClick={save} disabled={busy || !date} className="inline-flex min-h-[36px] items-center rounded-[6px] px-3.5 text-[13px] font-semibold" style={{ background: accent, color: ink, border: 'none', cursor: 'pointer', opacity: busy || !date ? 0.6 : 1 }}>{busy ? 'Saving…' : 'Save time'}</button>
        <button onClick={onCancel} className="text-[12.5px]" style={{ color: INK_MUTE, background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
      </div>
      {err && <div className="mt-1.5 text-[12px]" style={{ color: '#c0392b' }}>{err}</div>}
    </div>
  );
}

/** Picker to ADD a post to an empty day. Lists the ready (not-yet-scheduled) drafts; the
 *  post most recently cleared from THIS day floats to the top so add-back is obvious. Picking
 *  one schedules it to the day (default morning PT; the time is editable after). */
function AddPostPicker({ ready, restoreFirst, accent, onPick, onCancel }: {
  ready: QueueItem[]; restoreFirst?: string; accent: string;
  onPick: (id: string) => Promise<{ ok: boolean; error?: string }>;
  onCancel: () => void;
}) {
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const ordered = restoreFirst
    ? [...ready.filter((q) => q.id === restoreFirst), ...ready.filter((q) => q.id !== restoreFirst)]
    : ready;
  const pick = async (id: string) => {
    setBusy(id); setErr('');
    const r = await onPick(id);
    setBusy('');
    if (!r.ok) { setErr(r.error || 'Could not add that. Try again.'); return; }
    onCancel();
  };
  return (
    <div className="mt-2 flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
      {ordered.length === 0 ? (
        <p style={{ fontFamily: BODY, fontStyle: 'italic', fontSize: 12.5, color: INK_MUTE }}>No ready posts to add yet. New drafts appear here as they are written.</p>
      ) : ordered.map((q) => {
        const isRestore = q.id === restoreFirst;
        return (
          <div key={q.id} className="flex items-start justify-between gap-3 rounded-lg p-2.5" style={{ border: `1px solid ${LINE}`, background: '#fff' }}>
            <span className="min-w-0">
              {isRestore && <span className="mb-0.5 block uppercase" style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.14em', color: caText(accent) }}>the one you just cleared</span>}
              <span className="block text-[13px] font-semibold" style={{ color: INK }}>{q.hook || q.title}</span>
            </span>
            <button onClick={() => pick(q.id)} disabled={!!busy} className="shrink-0 rounded-[6px] px-2.5 py-1.5 text-[12px] font-semibold" style={{ background: accent, color: inkOn(accent), border: 'none', cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>{busy === q.id ? 'Adding…' : 'Add'}</button>
          </div>
        );
      })}
      {err && <div className="text-[12px]" style={{ color: '#c0392b' }}>{err}</div>}
      <button onClick={onCancel} className="self-start text-[12.5px]" style={{ color: INK_MUTE, background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
    </div>
  );
}

function WeekSurface({ board, accent, mint, stageOf, approvedIds, angleSwaps, skips, benchFor, pool = [], onPickReplacement, onBackToBuffer, onLeaveDayEmpty, onSetSchedule, onClearDay, onScheduleToDay, recentlyCleared = {}, leftEmpty = {}, onLeaveEmpty, onRefillDay, onOpen, onOpenCal, onApprove, onPickAngle, onSkip, onUnskip, onGoContent, flashId, modalOpen, live = false }: {
  board: Board; accent: string; mint: string;
  stageOf: (q: QueueItem) => Stage;
  /** Live board: publishing runs from the buffer — no approve gate. The deck shows every
   *  buffered draft with the client powers (edit / swap / remove), each recorded. */
  live?: boolean;
  /** Ids the CLIENT approved this session (persisted) — distinct from data-scheduled items. */
  approvedIds: Set<string>;
  angleSwaps: Record<string, AltAngle>;
  skips: Record<string, true>;
  benchFor: (id: string) => AltAngle[];
  /** Ready drafts (pool) offered alongside bench angles in the swap list picker. */
  pool?: PoolDraft[];
  onPickReplacement?: (id: string, item: PoolDraft) => void;
  /** Unschedule the focused post (clears its slot, returns it to the buffer bucket). */
  onBackToBuffer?: (id: string) => void;
  /** Take a scheduled post off its day AND hold the day empty (no auto-fill). */
  onLeaveDayEmpty?: (id: string, date?: string) => void;
  /** Client schedule controls: set a post's exact time, clear a day, add a ready post to a day. */
  onSetSchedule?: (id: string, iso: string) => Promise<{ ok: boolean; error?: string }>;
  onClearDay?: (id: string, date?: string) => Promise<{ ok: boolean; error?: string }>;
  onScheduleToDay?: (id: string, date: string) => Promise<{ ok: boolean; error?: string }>;
  /** date (YYYY-MM-DD) → the draft id most recently cleared from that day (offered first on add). */
  recentlyCleared?: Record<string, string>;
  /** Deliberately-empty slots (persist server-side, keyed by draft id OR day date). */
  leftEmpty?: Record<string, true>;
  onLeaveEmpty?: (ref: string) => void;
  onRefillDay?: (ref: string) => void;
  onOpen: (q: QueueItem, opts?: { changing?: boolean; editing?: boolean; scheduling?: boolean }) => void;
  onOpenCal: (it: CalendarItem) => void;
  onApprove: (id: string) => void;
  onPickAngle: (id: string, alt: AltAngle) => void;
  onSkip: (id: string) => void;
  onUnskip: (id: string) => void;
  /** "Behind this week" teaser → the Content ledger. */
  onGoContent: () => void;
  flashId: string | null;
  modalOpen: boolean;
}) {
  const reduce = useReducedMotion();
  const fontStack = board.brand?.font_heading ? `"${board.brand.font_heading}", Inter, system-ui, sans-serif` : 'Inter, system-ui, sans-serif';
  const coarseWeek = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  const onOpenBehind = onGoContent;
  const autoDays = board.auto_publish_days ?? 3;
  const cal = board.calendar;
  const days = cal ? weekDayList(cal.start) : [];
  const daySet = new Set(days);

  // One slot per piece: queue items own their day; calendar entries fill the rest.
  // A calendar entry that names a queue item (ref), or an unlinked entry of a kind the
  // queue already covers that day, collapses into the queue card — one source, no doubles.
  const slotsByDay = useMemo(() => {
    const map = new Map<string, WeekSlot[]>();
    days.forEach((day) => {
      const qItems = board.queue.filter((q) => q.publish_date === day && q.stage !== 'published');
      const calItems = (cal?.items || []).filter((it) => it.date === day);
      const have = new Set(qItems.map((q) => q.id));
      const spare: Record<string, number> = {};
      qItems.forEach((q) => { if (!calItems.some((it) => it.ref === q.id)) spare[q.kind] = (spare[q.kind] || 0) + 1; });
      const slots: WeekSlot[] = qItems.map((q) => ({ key: q.id, q }));
      calItems.forEach((it, i) => {
        if (it.ref) {
          if (have.has(it.ref)) return;
          const linked = board.queue.find((qq) => qq.id === it.ref);
          if (linked) {
            if (linked.stage !== 'published') { slots.push({ key: linked.id, q: linked }); have.add(linked.id); }
            return;
          }
        }
        if (!it.ref && (spare[it.kind] || 0) > 0) { spare[it.kind] -= 1; return; }
        slots.push({ key: `cal-${day}-${it.kind}-${i}`, cal: it });
      });
      slots.sort((a, b) => (KIND_SORT[(a.q ? a.q.kind : a.cal!.kind)] ?? 9) - (KIND_SORT[(b.q ? b.q.kind : b.cal!.kind)] ?? 9));
      map.set(day, slots);
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, cal, days.join(',')]);

  // The flow ledger: total = review-stage pieces this week; handled = approved,
  // re-angled or skipped. d1 joins the count the moment the intro lands it.
  // THIS WEEK holds ONLY scheduled posts, on their day slots — a buffer/unscheduled draft
  // NEVER occupies a week/day slot (it lives in the "In the buffer" bucket below). This is
  // the same rule live and preview: the week grid is a real calendar, never the buffer.
  const weekQ = board.queue.filter((q) => daySet.has(q.publish_date || '') && q.stage !== 'published');
  const actionable = [...weekQ.filter((q) => q.stage === 'review' && isScheduled(q))]
    .sort((a, b) => (a.publish_date || '9999').localeCompare(b.publish_date || '9999'));
  // The buffer bucket (live): review-stage drafts written but with no scheduled slot yet.
  // Rendered as its own clearly-labeled block, never mixed into the week grid.
  const bufferItems = live
    ? board.queue.filter((q) => q.stage === 'review' && !isScheduled(q) && !skips[q.id]).sort((a, b) => (a.hook || '').localeCompare(b.hook || ''))
    : [];
  const handledOf = (q: QueueItem) => approvedIds.has(q.id) || !!angleSwaps[q.id] || !!skips[q.id];
  const total = actionable.length;
  const done = actionable.filter(handledOf).length;
  const pendingIds = actionable.filter((q) => stageOf(q) === 'review' && !skips[q.id]).map((q) => q.id);
  const doneState = total > 0 && pendingIds.length === 0;
  // Review drafts that are NOT on this week's calendar (e.g. undated first-week drafts):
  // the zero-state must never claim "you're set" while these wait in All content.
  const waitingElsewhere = board.queue.filter((q) => stageOf(q) === 'review' && !skips[q.id] && !actionable.some((a) => a.id === q.id)).length;

  // Focus flow: one focused card, j/k or arrows to move, auto-advance after acting.
  const [focusId, setFocusId] = useState<string | null>(null);
  const focusRef = useRef<string | null>(null);
  focusRef.current = focusId;
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  useEffect(() => {
    if (!focusRef.current || !pendingIds.includes(focusRef.current)) setFocusId(pendingIds[0] || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingIds.join(',')]);
  const advanceFrom = (id: string) => {
    const i = pendingIds.indexOf(id);
    const next = pendingIds[i + 1] || pendingIds[i - 1] || null;
    setFocusId(next !== id ? next : null);
  };
  const move = (dir: 1 | -1) => {
    if (!pendingIds.length) return;
    const i = focusRef.current ? pendingIds.indexOf(focusRef.current) : -1;
    const next = pendingIds[Math.min(pendingIds.length - 1, Math.max(0, i + dir))];
    setFocusId(next);
    cardRefs.current[next]?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
  };

  // Approve = sign-off. The card flings out (AnimatePresence exit) and the next enters;
  // the tick fills as it lands. No check overlay — the deck motion IS the confirmation.
  const startApprove = (id: string) => {
    setAngle(null);
    advanceFrom(id);
    onApprove(id);
  };

  // Swap the idea: opens a LIST of the alternatives (this slot's bench angles + ready
  // drafts from the pool) so the client chooses from a list — never a blind cycle.
  const [angle, setAngle] = useState<{ id: string; none?: boolean; list?: boolean } | null>(null);
  const serveAngle = (id: string) => {
    const bench = benchFor(id);
    if (!bench.length && !pool.length) { setAngle({ id, none: true }); return; }
    setAngle({ id, list: true });
  };
  const pickAngle = (id: string, alt: AltAngle) => { setAngle(null); advanceFrom(id); onPickAngle(id, alt); };
  const pickPool = (id: string, item: PoolDraft) => { setAngle(null); advanceFrom(id); onPickReplacement?.(id, item); };

  useEffect(() => {
    if (modalOpen) return;
    const h = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); move(1); return; }
      if (e.key === 'k' || e.key === 'ArrowUp') { e.preventDefault(); move(-1); return; }
      const id = focusRef.current;
      if (!id) return;
      const item = board.queue.find((q) => q.id === id);
      if (!item) return;
      if (!live && (e.key === 'a' || e.key === 'A')) { e.preventDefault(); startApprove(id); }
      if (!live && (e.key === 'r' || e.key === 'R')) { e.preventDefault(); onOpen(item, { changing: true }); }
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); serveAngle(id); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen, pendingIds.join(','), board]);

  const focused = focusId ? board.queue.find((q) => q.id === focusId) : undefined;
  const dayHasPending = (day: string) => actionable.some((q) => q.publish_date === day && pendingIds.includes(q.id));
  const weekdayName = (iso?: string) => (iso ? new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long' }) : '');

  // Live: the day ticks are buttons. A day with a post focuses/opens it; a weekend says so
  // (no weekend posting); an open weekday offers a direct "mark this day empty" so he can
  // hold it to post manually. Empty days offer a reopen. The panel is interactive, not a
  // fading toast.
  const [dayPanel, setDayPanel] = useState<{ day: string; kind: 'weekend' | 'open' | 'empty'; ref?: string } | null>(null);
  // Which focused card currently has its inline time editor open.
  const [timeEditId, setTimeEditId] = useState<string | null>(null);
  // Whether the "Add a post" picker is expanded inside the day panel.
  const [addOpen, setAddOpen] = useState(false);
  // Ready (not-yet-scheduled) posts the client can add to an empty day.
  const readyToAdd = board.queue.filter((q) => stageOf(q) === 'review' && !isScheduled(q) && !skips[q.id]);
  // A day whose scheduled post has been "left empty" (held): reconstructed from the leftEmpty
  // map keyed by the post's id, or a date-level hold (round-2 mark-empty on an open day).
  const heldRefForDay = (day: string): string | null => {
    const heldPost = actionable.find((q) => q.publish_date === day && leftEmpty[q.id]);
    if (heldPost) return heldPost.id;
    if (leftEmpty[day]) return day;
    return null;
  };
  const clickDay = (day: string) => {
    setAddOpen(false);
    // Weekend: never a fillable slot. The cadence is Monday to Friday.
    if (isWeekendDay(day)) { setDayPanel({ day, kind: 'weekend' }); return; }
    // Held-empty day (a post left empty, or an open day marked empty): offer reopen, never
    // open the held post.
    const held = heldRefForDay(day);
    if (held) { setDayPanel({ day, kind: 'empty', ref: held }); return; }
    const pendingHere = actionable.find((q) => q.publish_date === day && pendingIds.includes(q.id));
    if (pendingHere) {
      setDayPanel(null);
      setFocusId(pendingHere.id);
      cardRefs.current[pendingHere.id]?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
      return;
    }
    const slots = slotsByDay.get(day) || [];
    const qSlot = slots.find((s) => s.q);
    if (qSlot?.q) { setDayPanel(null); onOpen(qSlot.q); return; }
    const cSlot = slots.find((s) => s.cal);
    if (cSlot?.cal) { setDayPanel(null); onOpenCal(cSlot.cal); return; }
    setDayPanel({ day, kind: 'open' });
  };
  const upNext = (() => {
    const fi = focusId ? pendingIds.indexOf(focusId) : -1;
    const next = pendingIds.slice(fi + 1).map((id) => board.queue.find((q) => q.id === id)).filter(Boolean) as QueueItem[];
    // "Up next" shows only posts with a real scheduled slot — a buffer item never appears
    // here (it lives in the buffer bucket on All content, not this forward strip).
    return (live ? next.filter(isScheduled) : next).slice(0, 2);
  })();
  const pipelineCount = board.queue.filter((q) => q.stage !== 'published').length;

  // Day-tick row (M T W T F S S): filled accent when that day's piece is handled,
  // white + accent border for the current focused day, transparent otherwise.
  const TICK_LETTER = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const ticks = days.map((d, i) => {
    const dayActionable = actionable.filter((q) => q.publish_date === d);
    const handledDay = dayActionable.length > 0 && dayActionable.every(handledOf);
    const isCurrent = !doneState && focused?.publish_date === d;
    const held = dayActionable.some((q) => leftEmpty[q.id]) || !!leftEmpty[d];
    return { letter: TICK_LETTER[i], day: d, done: handledDay, current: isCurrent, weekend: isWeekendDay(d), held };
  });
  const swapChip = focused && angleSwaps[focused.id];
  const focusedChip = focused && live ? sourceChip(focused) : null;
  const focusedLm = focused && live ? resolveLaunchLm(focused, board) : null;
  const provenance = focused ? (focusedChip?.label || focused.promise || '') : '';
  const curPanel = focused && angle?.id === focused.id ? angle : null;

  const rightRail = (
    <div className="flex flex-col gap-4 pt-1.5">
      <div className="uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.22em', color: INK_MUTE }}>Up next</div>
      {upNext.length === 0 && (
        <div className="text-[13px]" style={{ fontFamily: BODY, fontStyle: 'italic', color: INK_MUTE }}>Nothing else waiting on you this week.</div>
      )}
      {upNext.map((q) => (
        <button key={q.id} onClick={() => setFocusId(q.id)} className="rounded-[10px] px-4 py-3.5 text-left transition-opacity hover:opacity-100" style={{ background: PAPER_RAISE, border: `1px solid ${LINE}`, opacity: 0.85 }}>
          <div className="uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.14em', color: INK_MUTE, marginBottom: 6 }}>{live && isScheduled(q) ? `${fmtSchedLA(q.scheduled_at, q.publish_date)} · ${kickerOf(q)}` : `${weekdayName(q.publish_date)} · ${kickerOf(q)}`}</div>
          <div className="flex items-start gap-2.5">
            {q.media_url && <img src={q.media_url} alt="" loading="lazy" className="mt-0.5 shrink-0 rounded-md object-cover" style={{ width: 38, height: 38, border: `1px solid ${LINE}` }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />}
            <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 14, lineHeight: 1.4, color: INK }}>{q.hook || q.title}</div>
          </div>
        </button>
      ))}
      <div className="pt-2" style={{ borderTop: `1px solid ${LINE}` }}>
        <button onClick={() => onOpenBehind()} className="w-full rounded-[10px] px-4 py-4 text-left transition-colors hover:brightness-[0.98]" style={{ background: PAPER_SUNK, border: `1px solid ${LINE}` }}>
          <div className="uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.14em', color: INK_MUTE, marginBottom: 6 }}>Behind this week</div>
          <div style={{ fontFamily: BODY, fontSize: 14, lineHeight: 1.5, color: INK }}>{pipelineCount} more pieces on the way this month.</div>
          <div className="mt-2 uppercase" style={{ fontFamily: MONO, fontSize: 11, color: caText(accent), letterSpacing: '0.04em' }}>see what's coming →</div>
        </button>
      </div>
    </div>
  );

  return (
    <div>
      <div className="grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0">
          {/* Masthead: mono eyebrow + day headline + day-tick row (or the done headline). */}
          {doneState || total === 0 ? (
            <div className="mb-2">
              <div className="mb-2.5 uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.22em', color: INK_MUTE }}>
                {total === 0 && waitingElsewhere > 0 ? <>Week of {fmtDay(days[0])} · {waitingElsewhere} in review</> : live ? <>Week of {fmtDay(days[0])} · nothing scheduled</> : <>Week of {fmtDay(days[0])} · {total} of {total}</>}
              </div>
              <div className="cb-display" style={{ fontFamily: SERIF, fontSize: 'clamp(30px,3.6vw,44px)', lineHeight: 1.06, letterSpacing: '-0.02em', color: INK }}>
                {total === 0 && waitingElsewhere > 0 ? <>Your first drafts <Accent>are ready.</Accent></> : live ? <>Nothing scheduled <Accent>this week.</Accent></> : <>You're set <Accent>for the week.</Accent></>}
              </div>
            </div>
          ) : (
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <div className="mb-2.5 uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.22em', color: INK_MUTE }}>
                  {live
                    ? <>Week of {fmtDay(days[0])} · {total} scheduled this week</>
                    : <>Week of {fmtDay(days[0])} · piece {Math.min(done + 1, total)} of {total} · {total - done} to go</>}
                </div>
                <div className="cb-display" style={{ fontFamily: SERIF, fontSize: 'clamp(30px,3.6vw,44px)', lineHeight: 1.06, letterSpacing: '-0.02em', color: INK, whiteSpace: 'nowrap' }}>
                  {live && !focused?.publish_date ? 'Up next' : weekdayName(focused?.publish_date)}<span style={{ fontStyle: 'italic', color: accent }}>.</span>
                </div>
              </div>
              <div className="hidden shrink-0 items-center gap-2 sm:flex" aria-hidden={live ? undefined : true}>
                {ticks.map((tk, i) => tk.weekend ? (
                  /* Weekend: non-posting. Dimmed, dashed, not an open slot. Live click just
                     explains the weekday-only cadence. */
                  live ? (
                    <button key={i} onClick={() => clickDay(tk.day)} aria-label={`${weekdayName(tk.day)} — no posts on weekends`} title="No posts on weekends" className="cb-daytick flex items-center justify-center rounded-full" data-state="weekend" style={{
                      width: 28, height: 28, padding: 0, fontFamily: MONO, fontSize: 10,
                      border: `1.5px dashed ${LINE}`, background: 'transparent', color: FAINT,
                      opacity: 0.55, transition: 'all .3s ease', cursor: 'pointer',
                    }}>{tk.letter}</button>
                  ) : (
                    <span key={i} className="cb-daytick flex items-center justify-center rounded-full" data-state="weekend" style={{
                      width: 28, height: 28, fontFamily: MONO, fontSize: 10,
                      border: `1.5px dashed ${LINE}`, background: 'transparent', color: FAINT, opacity: 0.55,
                    }}>{tk.letter}</span>
                  )
                ) : live ? (
                  /* Live: each weekday is a real target — click focuses that day's post, or
                     offers to mark the open day empty. */
                  <button key={i} onClick={() => clickDay(tk.day)} aria-label={`${weekdayName(tk.day)}, ${fmtDay(tk.day)}`} title={weekdayName(tk.day)} className="cb-daytick flex items-center justify-center rounded-full" data-state={tk.held ? 'empty' : tk.done ? 'done' : tk.current ? 'current' : 'idle'} style={{
                    width: 28, height: 28, padding: 0,
                    fontFamily: MONO, fontSize: 10,
                    border: `1.5px ${tk.held ? 'dashed' : 'solid'} ${tk.held ? LINE_BOLD : tk.current ? accent : tk.done ? accent : LINE_BOLD}`,
                    background: tk.held ? 'transparent' : tk.done ? accent : tk.current ? PAPER_RAISE : 'transparent',
                    color: tk.held ? INK_MUTE : tk.done ? '#fff' : tk.current ? caText(accent) : INK_MUTE,
                    transition: 'all .3s ease', cursor: 'pointer',
                  }}>{tk.letter}</button>
                ) : (
                  <span key={i} className="cb-daytick flex items-center justify-center rounded-full" data-state={tk.done ? 'done' : tk.current ? 'current' : 'idle'} style={{
                    width: 28, height: 28,
                    fontFamily: MONO, fontSize: 10,
                    border: `1.5px solid ${tk.current ? accent : tk.done ? accent : LINE_BOLD}`,
                    background: tk.done ? accent : tk.current ? PAPER_RAISE : 'transparent',
                    color: tk.done ? '#fff' : tk.current ? caText(accent) : INK_MUTE,
                    transition: 'all .3s ease',
                  }}>{tk.letter}</span>
                ))}
              </div>
            </div>
          )}

          {/* Done state: the ledger of everything approved this week. */}
          {(doneState || total === 0) ? (
            <motion.div initial={reduce ? false : { opacity: 0, y: 14, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.45, ease: EASE }}>
              <p className="mt-1 max-w-[52ch]" style={{ fontFamily: BODY, fontSize: 16, lineHeight: 1.6, color: INK_SOFT }}>
                {total === 0 && waitingElsewhere > 0
                  ? `${waitingElsewhere} draft${waitingElsewhere === 1 ? ' is' : 's are'} waiting for your look in All content. Approve them and they take their slots on this calendar.`
                  : total === 0
                  ? (live
                    ? 'The buffer is refilling. New drafts land here as the engine writes them, a few days ahead of their slots.'
                    : 'Nothing needs you this week. We keep drafting behind the scenes, and new pieces land here for your review.')
                  : live
                  ? 'Handled. The rest of the buffer keeps publishing on schedule, and new drafts land here as they are written.'
                  : 'Approved in your voice and queued to their slots. Next week is drafting behind the scenes, and nothing goes out until you approve it.'}
              </p>
              {total === 0 && waitingElsewhere > 0 && (
                <button onClick={() => onGoContent()} className="mt-4 uppercase" style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.04em', color: caText(accent), background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  review them →
                </button>
              )}
              <div className="mt-6" style={{ borderTop: `1px solid ${LINE_BOLD}` }}>
                {actionable.map((q) => (
                  <div key={q.id} className="grid items-baseline gap-x-4 py-3" style={{ gridTemplateColumns: '96px 1fr 120px', borderBottom: `1px solid ${DIVIDE}` }}>
                    <span className="uppercase" style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.08em', color: INK_MUTE }}>{weekdayName(q.publish_date).slice(0, 3)} {KIND_TIME[q.kind] || ''}</span>
                    <span style={{ fontFamily: BODY, fontWeight: 600, fontSize: 15, color: INK }}>{q.hook || q.title}</span>
                    <span className="text-right" style={{ fontFamily: MONO, fontSize: 10, color: caText(accent) }}>✓ {kickerOf(q)}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          ) : (
            <>
              {pendingIds.length > 0 && (
                <p className="mb-4 text-[12px] sm:hidden" style={{ fontFamily: MONO, letterSpacing: '0.04em', color: INK_MUTE }}>
                  {live ? 'Swipe left for a different idea · tap to read' : 'Swipe right to approve · left for a different idea · tap to read'}
                </p>
              )}
              {/* Day-click panel (live): weekend = no posting; any weekday with no post shows
                  a clear "Add a post" that opens the picker (the just-cleared post floats to
                  the top). No buffer jargon. */}
              {dayPanel && (
                <div className="mb-3 rounded-lg p-3.5" style={{ background: caWash('#1a1a1a', 3), border: `1px dashed ${LINE_BOLD}` }}>
                  {dayPanel.kind === 'weekend' ? (
                    <p style={{ fontFamily: BODY, fontSize: 13, lineHeight: 1.6, color: INK_SOFT }}>
                      No posts on weekends. Your cadence is Monday to Friday.
                    </p>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p style={{ fontFamily: BODY, fontSize: 13, lineHeight: 1.6, color: INK_SOFT }}>
                          <b style={{ color: INK }}>{weekdayName(dayPanel.day)}</b> has no post yet.
                        </p>
                        {!addOpen && (
                          <button onClick={() => setAddOpen(true)} className="shrink-0 rounded-[6px] px-3.5 py-2 text-[12.5px] font-semibold" style={{ background: accent, color: inkOn(accent), border: 'none', cursor: 'pointer' }}>Add a post</button>
                        )}
                      </div>
                      {addOpen && (
                        <AddPostPicker
                          ready={readyToAdd}
                          restoreFirst={recentlyCleared[dayPanel.day]}
                          accent={accent}
                          onPick={(id) => onScheduleToDay ? onScheduleToDay(id, dayPanel.day) : Promise.resolve({ ok: false })}
                          onCancel={() => { setAddOpen(false); setDayPanel(null); }}
                        />
                      )}
                    </>
                  )}
                </div>
              )}
              {/* The card deck: front card over two rotated ghosts; flings on approve. */}
              <div className="relative cb-hero-deck">
                <div className="pointer-events-none absolute" style={{ inset: '10px -8px -10px 8px', background: PAPER_RAISE, border: `1px solid ${DIVIDE}`, borderRadius: 14, transform: 'rotate(.8deg)' }} aria-hidden />
                <div className="pointer-events-none absolute" style={{ inset: '5px -4px -5px 4px', background: PAPER_RAISE, border: `1px solid ${caBorder('#1a1a1a', 14)}`, borderRadius: 14, transform: 'rotate(-.5deg)' }} aria-hidden />
                {/* swipe hint layers (mobile) */}
                <AnimatePresence mode="popLayout" initial={false}>
                  {focused && (
                    <motion.div
                      key={focused.id}
                      drag={coarseWeek ? 'x' : false}
                      dragSnapToOrigin
                      dragConstraints={{ left: 0, right: 0 }}
                      dragElastic={0.5}
                      onDragEnd={(_, info) => { if (info.offset.x > 90 && !live) startApprove(focused.id); else if (info.offset.x < -90) serveAngle(focused.id); }}
                      initial={reduce ? false : { opacity: 0, x: 28, rotate: 1, scale: 0.98 }}
                      animate={{ opacity: 1, x: 0, rotate: 0, scale: 1, transition: { duration: 0.45, ease: [0.2, 0.8, 0.3, 1] } }}
                      exit={reduce ? { opacity: 0 } : { opacity: 0, x: '130%', rotate: 9, transition: { duration: 0.36, ease: [0.5, 0, 0.9, 0.4] } }}
                      className="relative cb-hero-card"
                      style={{ background: PAPER_RAISE, border: `1px solid ${caBorder('#1a1a1a', 18)}`, borderRadius: 14, padding: live ? '18px 22px' : '22px 26px', boxShadow: HERO_SHADOW, touchAction: coarseWeek ? 'pan-y' : undefined }}
                    >
                      {live ? (
                        /* Live: the post reads at a glance — compact feed frame left, the
                           slot facts and client powers on a quiet rail beside it. */
                        <div className="grid gap-x-7 gap-y-5 lg:grid-cols-[minmax(0,1fr)_218px]">
                          <div className="min-w-0" style={{ maxWidth: 640 }}>
                            {swapChip && (
                              <div className="mb-3 inline-block rounded-full uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.14em', color: caText(accent), background: caWash(accent, 9), border: `1px solid ${caBorder(accent, 35)}`, padding: '5px 12px' }}>
                                ⟲ fresh idea: same slot, still your voice
                              </div>
                            )}
                            <div onClick={() => onOpen(focused)} className="cursor-pointer">
                              <FeedPreview item={focused} board={board} accent={accent} fontStack={fontStack} size="sm" live={live} />
                            </div>
                          </div>
                          <div className="flex flex-col gap-2.5 pt-1">
                            <span className="uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.18em', color: caText(accent) }}>{kickerOf(focused)}</span>
                            <span style={{ fontFamily: MONO, fontSize: 11, lineHeight: 1.5, color: INK_SOFT }}>
                              {isScheduled(focused) ? fmtSchedLA(focused.scheduled_at, focused.publish_date) : 'Not on the calendar yet'}
                            </span>
                            {provenance && <span style={{ fontFamily: BODY, fontStyle: 'italic', fontSize: 13, lineHeight: 1.5, color: INK_MUTE }}>{provenance}</span>}
                            {focusedChip?.quote && <span style={{ fontFamily: BODY, fontStyle: 'italic', fontSize: 12, lineHeight: 1.5, color: INK_MUTE }}>“{focusedChip.quote}”</span>}
                            {focusedLm && <LmLaunchCard lm={focusedLm} accent={accent} />}
                            {/* Exactly three choices: Edit (copy, time + photo live inside),
                                Swap (a different post for this slot), Clear day (post goes back
                                to your ready posts, nothing is deleted). */}
                            <div className="mt-1 flex flex-wrap items-center gap-2.5" style={{ borderTop: `1px solid ${LINE}`, paddingTop: 14 }}>
                              <button
                                onClick={(e) => { e.stopPropagation(); onOpen(focused, { editing: true }); }}
                                className="inline-flex min-h-[40px] items-center rounded-[7px] px-5 text-[14px] font-semibold"
                                style={{ background: INK, color: PAPER, border: 'none', cursor: 'pointer' }}
                              >Edit</button>
                              <button
                                onClick={(e) => { e.stopPropagation(); serveAngle(focused.id); }}
                                className="inline-flex min-h-[40px] items-center rounded-[7px] px-4 text-[14px] font-medium"
                                style={{ border: `1px solid ${LINE}`, color: INK, background: '#fff', cursor: 'pointer' }}
                              >Swap</button>
                              {isScheduled(focused) && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); onClearDay?.(focused.id, focused.publish_date); }}
                                  className="inline-flex min-h-[40px] items-center rounded-[7px] px-4 text-[14px] font-medium"
                                  style={{ border: `1px solid ${LINE}`, color: DIM, background: '#fff', cursor: 'pointer' }}
                                >Clear day</button>
                              )}
                            </div>
                            <span className="mt-auto pt-3" style={{ fontFamily: BODY, fontStyle: 'italic', fontSize: 12.5, lineHeight: 1.5, color: INK_MUTE }}>Edit changes the words, time, or photo. Clear day sends the post back to your ready posts.</span>
                          </div>
                        </div>
                      ) : (
                      <>
                      <div className="mb-3.5 flex items-baseline justify-between gap-3">
                        <span className="uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.18em', color: caText(accent) }}>
                          {kickerOf(focused)} · {live
                            ? (focused.publish_date ? `Scheduled for ${weekdayName(focused.publish_date)}` : 'in the buffer · takes the next open slot')
                            : `goes out ${weekdayName(focused.publish_date)}`}
                        </span>
                        <span style={{ fontFamily: BODY, fontStyle: 'italic', fontSize: 13, color: INK_MUTE }}>{provenance}</span>
                      </div>
                      {swapChip && (
                        <div className="mb-3 inline-block rounded-full uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.14em', color: caText(accent), background: caWash(accent, 9), border: `1px solid ${caBorder(accent, 35)}`, padding: '5px 12px' }}>
                          ⟲ fresh idea: same slot, still your voice
                        </div>
                      )}
                      <div onClick={() => onOpen(focused)} className="cursor-pointer">
                        <FeedPreview item={focused} board={board} accent={accent} fontStack={fontStack} size="lg" live={live} />
                      </div>
                      <div className="mt-4.5 flex flex-wrap items-center gap-3" style={{ marginTop: 18 }}>
                        {!live && (
                          <button
                            onClick={(e) => { e.stopPropagation(); (e.currentTarget as HTMLButtonElement).blur(); startApprove(focused.id); }}
                            className="uppercase transition-colors duration-150"
                            style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '0.14em', background: INK, color: PAPER, border: 'none', borderRadius: 8, padding: '14px 28px', cursor: 'pointer' }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = `color-mix(in oklab, ${accent} 80%, #1A1A1A)`; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = INK; }}
                          >Approve ✓</button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); serveAngle(focused.id); }}
                          className="uppercase transition-colors duration-150"
                          style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.12em', background: 'none', color: INK, border: `1px solid ${LINE_BOLD}`, borderRadius: 8, padding: '13px 18px', cursor: 'pointer' }}
                        >⟲ swap the idea</button>
                        <button
                          onClick={(e) => { e.stopPropagation(); live ? onOpen(focused, { editing: true }) : onOpen(focused, { changing: true }); }}
                          style={{ fontFamily: BODY, fontStyle: 'italic', fontSize: 14, background: 'none', border: 'none', color: INK_MUTE, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}
                        >edit a line…</button>
                        {live && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onOpen(focused, { scheduling: true }); }}
                            title="Change this post's date and time"
                            style={{ fontFamily: BODY, fontStyle: 'italic', fontSize: 14, background: 'none', border: 'none', color: INK_MUTE, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}
                          >edit the time…</button>
                        )}
                        {live && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onSkip(focused.id); }}
                            style={{ fontFamily: BODY, fontStyle: 'italic', fontSize: 14, background: 'none', border: 'none', color: INK_MUTE, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}
                          >remove this post…</button>
                        )}
                        {!live && <span className="ml-auto hidden sm:inline" style={{ fontFamily: BODY, fontStyle: 'italic', fontSize: 12.5, color: INK_MUTE }}>nothing publishes until you approve it</span>}
                        {live && <span className="ml-auto hidden sm:inline" style={{ fontFamily: BODY, fontStyle: 'italic', fontSize: 12.5, color: INK_MUTE }}>yours to change until it publishes</span>}
                      </div>
                      </>
                      )}
                      {/* Different-idea panel: a seeded alternate ANGLE, never an instant draft. */}
                      <AnimatePresence initial={false}>
                        {curPanel && (
                          <motion.div
                            initial={reduce ? false : { opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={reduce ? undefined : { opacity: 0, height: 0 }}
                            transition={{ duration: 0.2, ease: EASE }}
                            className="overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {curPanel.none ? (
                              <div className="mt-4 rounded-lg p-3.5" style={{ background: caWash('#1a1a1a', 3), border: `1px dashed ${LINE}` }}>
                                <p style={{ fontFamily: BODY, fontSize: 13, lineHeight: 1.6, color: INK_SOFT }}>
                                  {live ? 'No alternate angle is queued for this slot. Edit the post directly, or remove it.' : 'No alternate angle is queued for this slot. Request a change and it gets adjusted.'}
                                </p>
                                <div className="mt-2.5 flex gap-2">
                                  {live
                                    ? <button onClick={() => { setAngle(null); onOpen(focused, { editing: true }); }} className="rounded-[6px] px-3 py-2 text-[12.5px] font-semibold" style={{ border: `1px solid ${LINE}`, color: INK, background: '#fff' }}>Edit the post</button>
                                    : <button onClick={() => { setAngle(null); onOpen(focused, { changing: true }); }} className="rounded-[6px] px-3 py-2 text-[12.5px] font-semibold" style={{ border: `1px solid ${LINE}`, color: INK, background: '#fff' }}>Request a change</button>}
                                  <button onClick={() => setAngle(null)} className="px-3 py-2 text-[12.5px]" style={{ color: INK_MUTE }}>Close</button>
                                </div>
                              </div>
                            ) : curPanel.list ? (
                              /* List picker: every alternative for this slot (bench angles +
                                 ready drafts) shown at once — the client chooses from a list,
                                 never a blind cycle. */
                              <div className="mt-4 rounded-lg p-3.5" style={{ background: caWash(accent, 4), border: `1px dashed ${caBorder(accent, 30)}` }}>
                                <div className="flex items-center justify-between">
                                  <div className="uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.14em', color: INK_MUTE }}>Pick a different idea for this slot</div>
                                  <button onClick={() => setAngle(null)} className="text-[12px] font-medium" style={{ color: INK_MUTE, background: 'none', border: 'none', cursor: 'pointer' }}>Keep current</button>
                                </div>
                                <div className="mt-2.5 flex flex-col gap-2">
                                  {benchFor(focused.id).map((alt) => (
                                    <div key={alt.id} className="flex items-start justify-between gap-3 rounded-lg p-2.5" style={{ border: `1px solid ${LINE}`, background: '#fff' }}>
                                      <span className="min-w-0">
                                        <span className="block text-[13px] font-semibold" style={{ color: INK }}>{alt.title}</span>
                                        <span className="block text-[12px]" style={{ color: DIM }}>{alt.hook}</span>
                                        {alt.drafts_by && <span className="block text-[11px] tabular-nums" style={{ color: FAINT }}>Drafts {fmtDay(alt.drafts_by)} if you pick it</span>}
                                      </span>
                                      <button onClick={() => pickAngle(focused.id, alt)} className="shrink-0 rounded-[6px] px-2.5 py-1.5 text-[12px] font-semibold" style={{ background: accent, color: inkOn(accent), border: 'none', cursor: 'pointer' }}>Use this</button>
                                    </div>
                                  ))}
                                  {pool.length > 0 && <div className="mt-1 uppercase" style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.14em', color: FAINT }}>from your ready drafts</div>}
                                  {pool.map((it) => (
                                    <div key={it.id} className="flex items-start justify-between gap-3 rounded-lg p-2.5" style={{ border: `1px solid ${LINE}`, background: '#fff' }}>
                                      <span className="min-w-0">
                                        <span className="block text-[13px] font-semibold" style={{ color: INK }}>{it.title || 'Ready draft'}</span>
                                        {it.body && <span className="block truncate text-[12px]" style={{ color: DIM }}>{it.body}</span>}
                                      </span>
                                      <button onClick={() => pickPool(focused.id, it)} className="shrink-0 rounded-[6px] px-2.5 py-1.5 text-[12px] font-semibold" style={{ background: accent, color: inkOn(accent), border: 'none', cursor: 'pointer' }}>Use this</button>
                                    </div>
                                  ))}
                                  {benchFor(focused.id).length === 0 && pool.length === 0 && (
                                    <p style={{ fontFamily: BODY, fontStyle: 'italic', fontSize: 12.5, color: INK_MUTE }}>No other ready ideas to pull in yet. Edit this post, or remove it.</p>
                                  )}
                                </div>
                              </div>
                            ) : null}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          )}

          {/* In the buffer: written drafts with no scheduled slot. Clearly separated from
              the week grid — a buffer post never sits on a day. Each opens for scheduling. */}
          {live && bufferItems.length > 0 && (
            <div className="mt-8">
              <div className="flex items-baseline gap-2.5">
                <div className="uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.22em', color: INK_MUTE }}>Ready to add</div>
                <span className="rounded-full px-1.5 text-[11px] font-semibold tabular-nums" style={{ background: PAPER_SUNK, color: INK_MUTE }}>{bufferItems.length}</span>
              </div>
              <p className="mt-1.5 text-[13px]" style={{ fontFamily: BODY, fontStyle: 'italic', color: INK_MUTE }}>Written and waiting. Not on the calendar yet. Open a day above and Add a post to place one.</p>
              <div className="mt-3 flex flex-col gap-2">
                {bufferItems.map((q) => (
                  <button key={q.id} onClick={() => onOpen(q)} className={`rounded-[10px] px-4 py-3 text-left ${LIFT}`} style={{ background: PAPER_RAISE, border: `1px dashed ${LINE_BOLD}` }}>
                    <div className="uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.14em', color: INK_MUTE, marginBottom: 4 }}>{kickerOf(q)} · ready to add</div>
                    <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 14, lineHeight: 1.35, color: INK }}>{q.hook || q.title}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        {rightRail}
      </div>
    </div>
  );
}

// ---------- Detail view (modal): preview + edit + agent trail ----------
function AgentTrail({ steps, accent }: { steps: AgentStep[]; accent: string }) {
  // The trail draws itself on open: connector spine grows, steps settle in with a
  // ~120ms stagger, timestamps fade last. Motion demonstrates "agents ran in order".
  const reduce = useReducedMotion();
  const stepVariants = reduce
    ? undefined
    : {
        hidden: { opacity: 0, y: 8 },
        show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE } },
      };
  return (
    <div>
      <div className="mb-3 text-[13px] font-semibold" style={{ color: INK }}>How this was made</div>
      <motion.div
        className="flex flex-col"
        initial={reduce ? false : 'hidden'}
        animate="show"
        variants={reduce ? undefined : { show: { transition: { staggerChildren: 0.12, delayChildren: 0.12 } } }}
      >
        {steps.map((s, i) => (
          <motion.div key={i} className="relative flex gap-3 pb-4 last:pb-0" variants={stepVariants}>
            {i < steps.length - 1 && (
              <motion.span
                className="absolute bottom-0 left-[7px] top-5 w-px"
                style={{ background: LINE, transformOrigin: 'top' }}
                aria-hidden
                variants={reduce ? undefined : { hidden: { scaleY: 0 }, show: { scaleY: 1, transition: { duration: 0.3, ease: EASE } } }}
              />
            )}
            <span className="relative z-10 mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
              {s.done === false && !s.t
                ? <span className="h-3 w-3 rounded-full" style={{ border: `1.5px solid ${LINE}`, background: '#fff' }} aria-hidden />
                : s.done === false
                ? <PulseDot color={accent} />
                : (
                  <motion.span
                    className="flex h-4 w-4 items-center justify-center rounded-full"
                    style={{ background: `color-mix(in srgb, ${accent} 16%, white)` }}
                    variants={reduce ? undefined : { hidden: { scale: 0.4 }, show: { scale: 1, transition: { duration: 0.25, ease: EASE } } }}
                  >
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path d="M5 13l4 4 10-10" stroke={accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </motion.span>
                )}
            </span>
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-[13px] font-semibold" style={{ color: INK }}>{stepLabel(s.step)}</span>
                {s.t && (
                  <motion.span
                    className="text-[11px]"
                    style={{ color: FAINT }}
                    variants={reduce ? undefined : { hidden: { opacity: 0 }, show: { opacity: 1, transition: { delay: 0.22, duration: 0.3 } } }}
                  >
                    {s.t}
                  </motion.span>
                )}
              </div>
              {s.detail && <div className="text-[12px] leading-snug" style={{ color: DIM }}>{s.detail}</div>}
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

function DetailModal({ item, board, accent, stage, onClose, onApprove, onRemove, onHideBuffer, initialChanging = false, initialEditing = false, initialSchedOpen = false, isLive, act, editDraft, setMedia, setSchedule, slug, fetchHistory }: {
  item: QueueItem; board: Board; accent: string; stage: Stage;
  onClose: () => void; onApprove: (id: string) => void; initialChanging?: boolean; initialEditing?: boolean; initialSchedOpen?: boolean;
  /** Live board: "remove this post" veto (recorded). */
  onRemove?: (id: string) => void;
  /** Live board: remove an unscheduled buffer post — reversible hide (board_visible=false). */
  onHideBuffer?: (id: string) => Promise<{ ok: boolean; error?: string }>;
  /** Live board: draft history from the insert-only actions audit. */
  fetchHistory?: (ref: string) => Promise<HistoryEntry[]>;
  isLive: boolean;
  act: (action: 'edit_copy' | 'request_changes', ref?: string | null, payload?: Record<string, unknown> | null) => Promise<{ ok: boolean; error?: string }>;
  editDraft?: (draftId: string, newBody: string) => Promise<{ ok: boolean; error?: string }>;
  /** Live board: attach/replace/clear a lifestyle photo on this post. */
  setMedia?: (draftId: string, url: string) => Promise<{ ok: boolean; error?: string }>;
  /** Live board: change this post's date/time (writes carousel_drafts.scheduled_at). */
  setSchedule?: (draftId: string, scheduledAt: string | null) => Promise<{ ok: boolean; error?: string }>;
  slug?: string;
}) {
  const reduce = useReducedMotion();
  const [editing, setEditing] = useState(initialEditing);
  const [body, setBody] = useState(item.body || '');
  // Photo attach (live): the chosen lifestyle image for this post, plus the pool picker.
  const [mediaUrl, setMediaUrlState] = useState(item.media_url || '');
  const [poolOpen, setPoolOpen] = useState(false);
  const [pool, setPool] = useState<PhotoItem[]>([]);
  const [poolLoading, setPoolLoading] = useState(false);
  const [mediaBusy, setMediaBusy] = useState('');
  const [mediaErr, setMediaErr] = useState('');
  // Remove-from-buffer (live): busy + error state for the reversible hide.
  const [hideBusy, setHideBusy] = useState(false);
  const [hideErr, setHideErr] = useState('');
  const loadPool = async () => {
    if (!slug) return;
    setPoolLoading(true);
    const { data, error } = await supabase.storage
      .from('client-photos')
      .list(slug, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });
    if (!error && data) {
      setPool(data.filter((f) => f.id !== null && !/^\./.test(f.name)).map((f) => ({
        name: f.name,
        url: supabase.storage.from('client-photos').getPublicUrl(`${slug}/${f.name}`).data.publicUrl,
        createdAt: f.created_at || f.updated_at || '',
      })));
    }
    setPoolLoading(false);
  };
  const chooseMedia = async (url: string) => {
    if (!setMedia || mediaBusy) return;
    setMediaErr(''); setMediaBusy(url || 'clear');
    const r = await setMedia(item.id, url);
    setMediaBusy('');
    if (!r.ok) { setMediaErr(r.error || 'Could not attach that. Try again.'); return; }
    item.media_url = url || null;
    setMediaUrlState(url);
    setPoolOpen(false);
  };
  const [changing, setChanging] = useState(initialChanging);
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);
  const [editSaved, setEditSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const ctaInk = inkOn(accent);
  const canAct = stage === 'review';

  // Reschedule (live): the client picks a new date + LA time; setSchedule writes
  // carousel_drafts.scheduled_at server-side. The date/time inputs are entered as LA wall
  // time, then converted to a real UTC instant so the stored slot matches what he saw.
  // Direct "Edit time" entry point: cards can open the modal straight into the scheduler
  // (initialSchedOpen), prefilled from the post's current LA slot.
  const schedPrefill = (src?: string): { d: string; t: string } => {
    if (!src) return { d: '', t: '09:00' };
    const dd = new Date(src);
    if (Number.isNaN(dd.getTime())) return { d: '', t: '09:00' };
    const d = new Intl.DateTimeFormat('en-CA', { timeZone: CLIENT_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(dd);
    const t = new Intl.DateTimeFormat('en-GB', { timeZone: CLIENT_TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(dd);
    return { d, t };
  };
  const [schedOpen, setSchedOpen] = useState(initialSchedOpen);
  const [schedDate, setSchedDate] = useState(initialSchedOpen ? schedPrefill(item.scheduled_at).d : '');
  const [schedTime, setSchedTime] = useState(initialSchedOpen ? schedPrefill(item.scheduled_at).t : '09:00');
  const [schedBusy, setSchedBusy] = useState(false);
  const [schedErr, setSchedErr] = useState('');
  const [schedLabel, setSchedLabel] = useState<string | null>(null);
  // Build a UTC ISO instant from LA wall-clock date+time. July is PDT (UTC-7); the offset
  // is read from the zone so it stays correct across DST.
  const laOffsetMinutes = (dateStr: string): number => {
    const probe = new Date(`${dateStr}T12:00:00Z`);
    const asLA = new Date(probe.toLocaleString('en-US', { timeZone: CLIENT_TZ }));
    const asUTC = new Date(probe.toLocaleString('en-US', { timeZone: 'UTC' }));
    return Math.round((asUTC.getTime() - asLA.getTime()) / 60000); // +420 for PDT
  };
  const applySchedule = async () => {
    if (!setSchedule || !schedDate) return;
    setSchedBusy(true); setSchedErr('');
    const off = laOffsetMinutes(schedDate);
    const [hh, mm] = schedTime.split(':').map((n) => parseInt(n, 10));
    const base = new Date(`${schedDate}T00:00:00Z`).getTime();
    const utcMs = base + (hh * 60 + mm + off) * 60000;
    const iso = new Date(utcMs).toISOString();
    const r = await setSchedule(item.id, iso);
    setSchedBusy(false);
    if (!r.ok) { setSchedErr(r.error === 'bad_date' ? 'Pick a date within the next year.' : (r.error || 'Could not save that. Try again.')); return; }
    item.scheduled_at = iso;
    item.publish_date = iso.slice(0, 10);
    setSchedLabel(fmtSchedLA(iso));
    setSchedOpen(false);
  };
  const clearSchedule = async () => {
    if (!setSchedule) return;
    setSchedBusy(true); setSchedErr('');
    const r = await setSchedule(item.id, null);
    setSchedBusy(false);
    if (!r.ok) { setSchedErr(r.error || 'Could not clear that. Try again.'); return; }
    item.scheduled_at = undefined;
    item.publish_date = undefined;
    setSchedLabel('moved to the buffer');
    setSchedOpen(false);
  };

  // History (live): every edit / swap / remove this draft has seen, latest first.
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  useEffect(() => {
    if (!isLive || !fetchHistory) return;
    let gone = false;
    fetchHistory(item.id).then((items) => { if (!gone) setHistory(items); });
    return () => { gone = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);
  const historyLabel = (h: HistoryEntry): string => {
    if (h.action === 'edit_copy') return 'Copy edited';
    if (h.action === 'approve') return 'Approved';
    if (h.action === 'request_changes') return 'Change requested';
    if (h.action === 'note') {
      switch (h.event) {
        case 'angle_swap': return 'Idea swapped';
        case 'angle_swap_undone': return 'Swap undone';
        case 'post_removed': return 'Post removed';
        case 'post_restored': return 'Post restored';
        case 'undo_approve': return 'Approve walked back';
        default: return 'Note sent';
      }
    }
    return h.action.replace(/_/g, ' ');
  };
  const historyWhen = (iso: string): string => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ', ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  // Client-appropriate provenance (replaces the internal agent trail): a human status and a
  // plain "what happens next" line. No agent steps, scores, prompts, model names, or auto-publish.
  const statusLabel = stage === 'review' ? (isLive ? (isScheduled(item) ? `Scheduled for ${fmtSchedLA(item.scheduled_at, item.publish_date)}` : 'Not scheduled yet') : 'In your review')
    : stage === 'scheduled' ? (isLive ? 'Scheduled' : 'Approved')
    : stage === 'drafted' ? 'Being written'
    : stage === 'published' ? (isLive ? 'Published' : 'Example') : 'Planned';
  // Honest source chip for the modal (call quote included).
  const detailChip = isLive ? sourceChip(item) : null;
  const nextLine = stage === 'review' ? (isLive
      ? 'It publishes on its slot. Edit it, swap the idea, or remove it any time before then. Every change is logged for your operator.'
      : 'Approve it, edit it, or request a change. Approved posts publish on their dates.')
    : stage === 'scheduled' ? (isLive ? 'Scheduled. It publishes on its date.' : 'Approved. It publishes on its date.')
    : stage === 'drafted' ? 'Being written now. It lands in your review shortly.'
    : stage === 'published' ? (isLive ? 'Published. Its numbers report on the Performance tab.' : 'An example of how published posts will report here once posting starts.')
    : 'It drafts a few days before its date, then lands in your review.';

  // Edit + request-changes: live boards record the real action and only confirm after ok:true.
  const saveEdit = async () => {
    if (isLive) {
      setBusy(true); setErr('');
      // Prefer the applying RPC: the edit lands on the draft + board immediately, with a
      // before/after row in the operator's edit log. Fallback keeps the log-only path.
      const r = editDraft ? await editDraft(item.id, body) : await act('edit_copy', item.id, { body });
      setBusy(false);
      if (!r.ok) { setErr(r.error || 'Could not save that. Try again.'); return; }
      item.body = body;
    }
    setEditSaved(true);
    setEditing(false);
  };
  const sendChange = async () => {
    if (isLive) {
      setBusy(true); setErr('');
      const r = await act('request_changes', item.id, { note });
      setBusy(false);
      if (!r.ok) { setErr(r.error || 'Could not send that. Try again.'); return; }
    }
    setSent(true); setChanging(false);
  };

  // Escape steps out one level at a time: edit / request-change mode first, then the modal.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      if (editing) { setEditing(false); return; }
      if (changing) { setChanging(false); return; }
      onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [editing, changing, onClose]);

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <motion.div className="fixed inset-0 bg-black/40" onClick={onClose} aria-hidden initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
      {/* Right-anchored sheet (Studio grammar): slides in from the right; scrim, Esc and X
          all close it, and the list behind stays mounted. Internal scroll pins the footer. */}
      <motion.div
        className="fixed inset-y-0 right-0 flex w-full max-w-xl flex-col bg-white"
        style={{ boxShadow: '-24px 0 80px rgba(2,32,32,.28)' }}
        initial={reduce ? false : { x: '100%' }}
        animate={{ x: 0 }}
        exit={reduce ? undefined : { x: '100%' }}
        transition={{ type: 'tween', duration: 0.3, ease: EASE }}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center gap-2.5 px-5 pb-4 pt-5 sm:px-6 sm:pt-6" style={{ borderBottom: `1px solid ${DIVIDE}` }}>
          <KindChip q={item} accent={accent} />
          <span className="uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.14em', color: caText(accent) }}>{statusLabel}</span>
          <span className="ml-auto">{stageStatus(item, stage, board.calendar?.start, isLive)}</span>
          <button onClick={onClose} aria-label="Close" className="ml-2 flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-150 hover:bg-[rgba(2,49,47,0.05)]">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" stroke={DIM} strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-5 sm:px-6 sm:pb-6">
        <div className="flex flex-col gap-6">
          {/* Content preview / edit */}
          <div className="min-w-0">
            {item.kind === 'newsletter' && item.body ? (
              /* Newsletter issues read as email, not as a LinkedIn post. */
              <div className="overflow-hidden rounded-xl" style={{ border: `1px solid ${LINE}` }}>
                <div className="flex items-center gap-2.5 px-4 py-3" style={{ borderBottom: `1px solid ${DIVIDE}`, background: 'rgba(2,49,47,0.02)' }}>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold" style={{ background: accent, color: inkOn(accent) }} aria-hidden>
                    {(board.founder?.name || board.company_name).split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold" style={{ color: INK }}>
                      {board.founder?.name || board.company_name}{board.newsletter?.name ? ` · ${board.newsletter.name}` : ''}
                    </span>
                    <span className="block text-[11.5px]" style={{ color: FAINT }}>to your subscribers</span>
                  </span>
                  <span className="ml-auto shrink-0 text-[11.5px] tabular-nums" style={{ color: FAINT }}>{fmtDay(item.publish_date)}</span>
                </div>
                <div className="px-4 py-4 sm:px-5">
                  <div className="text-[16px] font-semibold leading-snug" style={{ color: INK }}>{item.hook || item.title}</div>
                  <div className="mt-3 max-w-[62ch]">
                    {(item.body || '').split(/\n\n+/).map((p, i) => (
                      <p key={i} className="mt-3 whitespace-pre-line text-[14px] leading-relaxed first:mt-0" style={{ color: '#2b3736' }}>{p}</p>
                    ))}
                  </div>
                </div>
              </div>
            ) : item.kind === 'lm' ? (
              <div className="rounded-xl p-4" style={{ border: `1px solid ${LINE}` }}>
                <div className="flex flex-col gap-4 sm:flex-row">
                  {item.cover_url && <img src={item.cover_url} alt="" className="w-full rounded-lg object-cover sm:w-44" style={{ border: `1px solid ${LINE}` }} />}
                  <div className="min-w-0">
                    <div className="text-[16px] font-semibold" style={{ color: INK }}>{item.title}</div>
                    <p className="mt-1 text-[14px] leading-relaxed" style={{ color: DIM }}>{item.promise}</p>
                    <p className="mt-2 text-[13px]" style={{ color: FAINT }}>{isLive ? 'Live interactive assessment. Try it in the Lead magnets tab.' : 'Interactive assessment on your domain. Try it live in the Lead magnet tab.'}</p>
                  </div>
                </div>
              </div>
            ) : editing ? (
              <div>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={Math.min(18, Math.max(8, body.split('\n').length + 2))}
                  className="w-full rounded-lg p-4 text-[14px] leading-relaxed outline-none"
                  style={{ border: `1.5px solid ${accent}`, color: INK, background: 'rgba(2,49,47,0.02)' }}
                />
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <button
                    onClick={saveEdit}
                    disabled={busy}
                    className="inline-flex min-h-[40px] items-center rounded-[6px] px-4 text-[13px] font-semibold"
                    style={{ background: accent, color: ctaInk, opacity: busy ? 0.6 : 1 }}
                  >
                    {busy ? 'Saving…' : 'Save edit'}
                  </button>
                  <span className="text-[12px]" style={{ color: FAINT }}>Every edit is saved to the draft.</span>
                  <span className="ml-auto text-[12px] tabular-nums" style={{ color: body.length > 210 ? '#b45309' : FAINT }}>
                    {body.length} chars{body.length > 210 ? ' · past the LinkedIn fold' : ''}
                  </span>
                </div>
                {err && <div className="mt-2 text-[12px]" style={{ color: '#c0392b' }}>{err}</div>}

                {/* Photo attach (live): pick a lifestyle picture for this post, or remove it. */}
                {isLive && setMedia && (
                  <div className="mt-4 border-t pt-4" style={{ borderColor: DIVIDE }}>
                    <div className="flex flex-wrap items-center gap-3">
                      {mediaUrl ? (
                        <>
                          <img src={mediaUrl} alt="" className="h-12 w-12 rounded-md object-cover" style={{ border: `1px solid ${LINE}` }} />
                          <button
                            onClick={() => { if (!poolOpen) { setPoolOpen(true); if (pool.length === 0) void loadPool(); } else setPoolOpen(false); }}
                            className="inline-flex min-h-[38px] items-center rounded-[6px] px-3.5 text-[13px] font-semibold"
                            style={{ border: `1px solid ${LINE}`, color: INK, background: '#fff' }}
                          >
                            Change photo
                          </button>
                          <button
                            onClick={() => void chooseMedia('')}
                            disabled={!!mediaBusy}
                            className="inline-flex min-h-[38px] items-center rounded-[6px] px-3 text-[13px] font-medium"
                            style={{ color: DIM, background: 'none', border: 'none', textDecoration: 'underline', textUnderlineOffset: 3, opacity: mediaBusy ? 0.6 : 1 }}
                          >
                            {mediaBusy === 'clear' ? 'Removing…' : 'Remove photo'}
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => { if (!poolOpen) { setPoolOpen(true); if (pool.length === 0) void loadPool(); } else setPoolOpen(false); }}
                          className="inline-flex min-h-[38px] items-center gap-2 rounded-[6px] px-3.5 text-[13px] font-semibold"
                          style={{ border: `1px solid ${LINE}`, color: INK, background: '#fff' }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
                          </svg>
                          Add a photo
                        </button>
                      )}
                      <span className="text-[12px]" style={{ color: FAINT }}>From your lifestyle library.</span>
                    </div>
                    {mediaErr && <div className="mt-2 text-[12px]" style={{ color: '#c0392b' }}>{mediaErr}</div>}
                    {poolOpen && (
                      <div className="mt-3 rounded-lg p-3" style={{ border: `1px solid ${LINE}`, background: PAPER_SUNK }}>
                        {poolLoading ? (
                          <div className="py-6 text-center text-[12.5px]" style={{ color: FAINT }}>Loading your photos…</div>
                        ) : pool.length === 0 ? (
                          <div className="py-6 text-center text-[12.5px]" style={{ color: FAINT }}>No photos yet. Add some in the Photos section below.</div>
                        ) : (
                          <div className="grid max-h-64 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-5">
                            {pool.map((p) => {
                              const chosen = p.url === mediaUrl;
                              return (
                                <button
                                  key={p.name}
                                  onClick={() => void chooseMedia(p.url)}
                                  disabled={!!mediaBusy}
                                  className="relative aspect-square overflow-hidden rounded-md"
                                  style={{ border: chosen ? `2px solid ${accent}` : `1px solid ${LINE}`, cursor: mediaBusy ? 'default' : 'pointer' }}
                                  aria-label="Use this photo"
                                >
                                  <img src={p.url} alt="" loading="lazy" className="h-full w-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0'; }} />
                                  {mediaBusy === p.url && <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-white" style={{ background: 'rgba(19,18,16,0.55)' }}>…</span>}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="cb-linkedin-preview">
                {item.body ? (
                  <LinkedInPostPreview
                    text={body || item.body || ''}
                    author={board.founder?.name || board.company_name}
                    headline={board.founder?.headline || ''}
                    avatarUrl={board.founder?.avatar_url || ''} /* '' forces initials — the component's default is Ivan's portrait */
                    mediaUrl={mediaUrl || item.media_url || undefined}
                    stats={{ reactions: 0, comments: 0 }}
                    timeLabel="Preview" /* future/example posts: no "1d · Edited" chrome */
                    showFold={false}
                  />
                ) : (
                  <div className="rounded-xl p-5 text-[14px]" style={{ border: `1px dashed ${LINE}`, color: DIM }}>
                    <div className="text-[15px] font-semibold not-italic" style={{ color: INK }}>{item.hook}</div>
                    <p className="mt-2 leading-relaxed">
                      {stage === 'planned'
                        ? 'Planned topic. It drafts two days before the publish date, then lands in your review.'
                        : item.generating
                        ? 'The draft is being written right now. It lands here in a few minutes.'
                        : 'Draft in production.'}
                    </p>
                  </div>
                )}
                {canAct && item.body && (
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => { setEditSaved(false); setEditing(true); }}
                      className="inline-flex min-h-[40px] items-center rounded-[6px] px-4 text-[13px] font-semibold"
                      style={{ border: `1px solid ${LINE}`, color: INK, background: '#fff' }}
                    >
                      Edit copy
                    </button>
                    {editSaved && <span className="text-[13px] font-medium" style={{ color: caText(accent) }}>Saved. Your edit is live on the draft.</span>}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Provenance (client-appropriate): status, its date, and what happens next.
              No agent steps, scores, prompts, or model names. */}
          <div className="rounded-xl p-4 sm:p-5" style={{ background: PAPER_SUNK, border: `1px solid ${LINE}` }}>
            <div className="uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.18em', color: INK_MUTE }}>What happens next</div>
            <div className="mt-3 grid grid-cols-2 gap-4">
              <div>
                <div className="uppercase" style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.12em', color: FAINT }}>Status</div>
                <div className="mt-1" style={{ fontFamily: BODY, fontWeight: 600, fontSize: 13.5, color: INK }}>{statusLabel}</div>
              </div>
              {(item.scheduled_at || item.publish_date) && (
                <div>
                  <div className="uppercase" style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.12em', color: FAINT }}>{stage === 'scheduled' || stage === 'published' ? 'Date' : 'Scheduled for'}</div>
                  <div className="mt-1 tabular-nums" style={{ fontFamily: BODY, fontWeight: 600, fontSize: 13.5, color: INK }}>{isLive ? fmtSchedLA(item.scheduled_at, item.publish_date) : fmtDay(item.publish_date)}</div>
                </div>
              )}
              {(detailChip?.label || (isLive && item.source_label && item.source_detail?.kind !== 'strategy')) && (
                <div className="col-span-2">
                  <div className="uppercase" style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.12em', color: FAINT }}>Source</div>
                  <div className="mt-1" style={{ fontFamily: BODY, fontWeight: 600, fontSize: 13.5, color: INK }}>{detailChip?.label || srcLabelClient(item.source_label!)}</div>
                  {detailChip?.quote && <p className="mt-1" style={{ fontFamily: BODY, fontStyle: 'italic', fontSize: 12.5, lineHeight: 1.55, color: INK_SOFT }}>“{detailChip.quote}”</p>}
                </div>
              )}
            </div>
            {/* Reschedule (live): change this post's date/time, shown + entered in LA time. */}
            {isLive && canAct && setSchedule && (
              <div className="mt-3.5 pt-3.5" style={{ borderTop: `1px solid ${DIVIDE}` }}>
                {!schedOpen ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => {
                        const src = item.scheduled_at;
                        if (src) {
                          const d = new Date(src);
                          const parts = new Intl.DateTimeFormat('en-CA', { timeZone: CLIENT_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
                          const t = new Intl.DateTimeFormat('en-GB', { timeZone: CLIENT_TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
                          setSchedDate(parts); setSchedTime(t);
                        }
                        setSchedErr(''); setSchedOpen(true);
                      }}
                      className="inline-flex min-h-[38px] items-center rounded-[6px] px-3.5 text-[13px] font-semibold"
                      style={{ border: `1px solid ${LINE}`, color: INK, background: '#fff' }}
                    >Change date &amp; time</button>
                    {schedLabel && <span className="text-[12.5px] font-medium" style={{ color: caText(accent) }}>Now {schedLabel}.</span>}
                  </div>
                ) : (
                  <div>
                    <div className="uppercase" style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.12em', color: FAINT }}>New date &amp; time (LA / PT)</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2.5">
                      <input type="date" value={schedDate} onChange={(e) => setSchedDate(e.target.value)} className="rounded-[6px] px-2.5 py-2 text-[13px]" style={{ border: `1px solid ${LINE}`, color: INK, background: '#fff' }} />
                      <input type="time" value={schedTime} onChange={(e) => setSchedTime(e.target.value)} className="rounded-[6px] px-2.5 py-2 text-[13px]" style={{ border: `1px solid ${LINE}`, color: INK, background: '#fff' }} />
                      <button onClick={applySchedule} disabled={schedBusy || !schedDate} className="inline-flex min-h-[38px] items-center rounded-[6px] px-4 text-[13px] font-semibold" style={{ background: accent, color: ctaInk, opacity: schedBusy || !schedDate ? 0.6 : 1 }}>{schedBusy ? 'Saving…' : 'Save time'}</button>
                      <button onClick={clearSchedule} disabled={schedBusy} className="text-[12.5px] font-medium" style={{ color: INK_MUTE, background: 'none', border: 'none', textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer' }}>Clear this day</button>
                      <button onClick={() => setSchedOpen(false)} className="text-[12.5px]" style={{ color: INK_MUTE, background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
                    </div>
                    {schedErr && <div className="mt-2 text-[12px]" style={{ color: '#c0392b' }}>{schedErr}</div>}
                  </div>
                )}
              </div>
            )}
            <p className="mt-3.5 pt-3.5" style={{ borderTop: `1px solid ${DIVIDE}`, fontFamily: BODY, fontSize: 13, lineHeight: 1.6, color: INK_SOFT }}>{nextLine}</p>
          </div>

          {/* History (live): the draft's audit trail, quiet. Every client action lands here. */}
          {isLive && history && history.length > 0 && (
            <div className="rounded-xl p-4 sm:p-5" style={{ border: `1px solid ${LINE}` }}>
              <div className="uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.18em', color: INK_MUTE }}>History</div>
              <div className="mt-2.5 flex flex-col">
                {history.map((h, i) => (
                  <div key={i} className="flex items-baseline gap-3 py-2" style={{ borderTop: i > 0 ? `1px solid ${DIVIDE}` : 'none' }}>
                    <span className="shrink-0 tabular-nums" style={{ fontFamily: MONO, fontSize: 10.5, color: FAINT }}>{historyWhen(h.at)}</span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-semibold" style={{ color: INK }}>{historyLabel(h)}{h.by ? <span style={{ fontWeight: 400, color: DIM }}> · {h.by}</span> : null}</span>
                      {h.note && <span className="block truncate text-[12.5px]" style={{ color: DIM }}>“{h.note}”</span>}
                      {h.action === 'edit_copy' && h.after && <span className="block truncate text-[12.5px]" style={{ color: DIM }}>now: “{h.after}”</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        </div>

        {/* Sticky action footer. Live: the client powers (edit / remove) — publishing is
            not gated, so there is no approve. Preview keeps the approve flow. */}
        {canAct && isLive && (
          <div className="sticky bottom-0 shrink-0 border-t bg-white px-5 py-3.5 sm:px-6" style={{ borderColor: LINE }}>
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => { setEditSaved(false); setEditing(true); }}
                className="inline-flex min-h-[44px] items-center rounded-[7px] px-6 text-[14px] font-semibold"
                style={{ background: INK, color: PAPER }}
              >
                Edit
              </button>
              {isScheduled(item) && (
                <button
                  onClick={async () => { if (setSchedule) { await setSchedule(item.id, null); } item.scheduled_at = undefined; item.publish_date = undefined; onClose(); }}
                  className="inline-flex min-h-[44px] items-center rounded-[7px] px-5 text-[14px] font-medium"
                  style={{ border: `1px solid ${LINE}`, color: DIM, background: '#fff' }}
                >
                  Clear day
                </button>
              )}
              {!isScheduled(item) && onHideBuffer && (
                <button
                  onClick={async () => { setHideBusy(true); const r = await onHideBuffer(item.id); if (r.ok) { onClose(); } else { setHideBusy(false); setHideErr(r.error || 'Could not remove that. Try again.'); } }}
                  disabled={hideBusy}
                  className="inline-flex min-h-[44px] items-center rounded-[7px] px-5 text-[14px] font-medium"
                  style={{ border: `1px solid ${LINE}`, color: DIM, background: '#fff', opacity: hideBusy ? 0.6 : 1 }}
                >
                  {hideBusy ? 'Removing…' : 'Remove'}
                </button>
              )}
              {hideErr && <span className="text-[12px]" style={{ color: '#c0392b' }}>{hideErr}</span>}
              <span className="ml-auto hidden text-[12px] sm:inline" style={{ fontFamily: BODY, fontStyle: 'italic', color: INK_MUTE }}>
                {isScheduled(item) ? `Publishes ${fmtSchedLA(item.scheduled_at, item.publish_date)} unless you change it. Change date & time above to move it, or Clear day.` : 'Add it to a day with Change date & time above, or Remove it from the board.'}
              </span>
            </div>
          </div>
        )}
        {/* Preview: approve stays visible while the body scrolls. */}
        {canAct && !isLive && (
          <div className="sticky bottom-0 shrink-0 border-t bg-white px-5 py-3.5 sm:px-6" style={{ borderColor: LINE }}>
            <div className="flex flex-wrap items-center gap-2.5">
              <motion.button
                onClick={() => { onApprove(item.id); onClose(); }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.15, ease: EASE }}
                className="inline-flex min-h-[44px] items-center rounded-[7px] px-6 uppercase transition-colors duration-150"
                style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '0.14em', background: INK, color: PAPER }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = `color-mix(in oklab, ${accent} 80%, #1A1A1A)`; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = INK; }}
              >
                Approve ✓
              </motion.button>
              <button
                onClick={() => setChanging(!changing)}
                className="inline-flex min-h-[44px] items-center rounded-[6px] px-4 text-[14px] font-medium"
                style={{ border: `1px solid ${LINE}`, color: DIM, background: '#fff' }}
              >
                Request changes
              </button>
              {sent && <span className="text-[13px] font-medium" style={{ color: caText(accent) }}>Sent.</span>}
            </div>
            {changing && !sent && (
              <div className="mt-3">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Tell us what to change, in plain words."
                  rows={3}
                  className="w-full rounded-lg p-3 text-[14px] outline-none"
                  style={{ border: `1px solid ${LINE}`, color: INK, background: 'rgba(2,49,47,0.02)' }}
                />
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <button
                    onClick={sendChange}
                    disabled={busy || !note.trim()}
                    className="inline-flex min-h-[44px] items-center rounded-[6px] px-4 text-[14px] font-semibold"
                    style={{ border: `1px solid ${LINE}`, color: INK, background: '#fff', opacity: busy || !note.trim() ? 0.55 : 1 }}
                  >
                    {busy ? 'Sending…' : 'Send it'}
                  </button>
                  {err && <span className="text-[12px]" style={{ color: '#c0392b' }}>{err}</span>}
                </div>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}

// ---------- Calendar surface ----------
const KIND_TIME: Record<string, string> = { post: '09:00', carousel: '09:00', newsletter: '08:00', lm: '12:00' };

function CalendarSurface({ board, accent, mint, onOpen, scheduledIds, live = false }: {
  board: Board; accent: string; mint: string; onOpen: (it: CalendarItem) => void;
  /** Queue ids currently in Scheduled (approved) — their linked chips get a check mark. */
  scheduledIds: Set<string>;
  /** Live board: dates come from the buffer, not from a sign-off. */
  live?: boolean;
}) {
  const cal = board.calendar;
  if (!cal) return null;
  const start = new Date(cal.start + 'T00:00:00');
  // One source for titles: a chip linked to a queue item always shows that item's hook.
  const labelOf = (it: CalendarItem): string => {
    const linked = it.ref ? board.queue.find((q) => q.id === it.ref) : null;
    return linked?.hook || linked?.title || it.label;
  };
  const byDate = new Map<string, CalendarItem[]>();
  cal.items.forEach((it) => {
    const arr = byDate.get(it.date) || [];
    arr.push(it);
    byDate.set(it.date, arr);
  });
  // Live truth: a buffer draft the operator scheduled carries a real date even when no
  // committed calendar item links to it. Render it on its day so the calendar never
  // contradicts the queue ("0 posts" while a post sits scheduled for Friday).
  const linkedRefs = new Set(cal.items.map((it) => it.ref).filter(Boolean));
  // Live boards schedule from the buffer: a post carries a real publish_date while its stage
  // stays 'review' (it never flips to 'scheduled' until it publishes). So on a live board ANY
  // queue item with a date belongs on the calendar — filtering by stage==='scheduled' left the
  // whole month empty. Preview boards keep the exact prior behavior (only 'scheduled' renders).
  const queueItems: CalendarItem[] = board.queue
    .filter((q) => q.publish_date && !linkedRefs.has(q.id) && (live ? q.stage !== 'published' : q.stage === 'scheduled'))
    .map((q) => ({
      date: q.publish_date!,
      kind: q.kind === 'carousel' ? 'carousel' : q.kind === 'lm' ? 'lm' : 'post',
      label: q.hook || q.title || 'Scheduled post',
      ref: q.id,
      time: q.scheduled_at ? fmtTimeLA(q.scheduled_at) : undefined,
    }));
  queueItems.forEach((it) => {
    const arr = byDate.get(it.date) || [];
    arr.push(it);
    byDate.set(it.date, arr);
  });
  const totals = { post: 0, carousel: 0, lm: 0, newsletter: 0 };
  [...cal.items, ...queueItems].forEach((it) => { if (it.kind in totals) (totals as any)[it.kind] += 1; });

  // Washed 8-15% tints plus a 3px full-tone rail on the left: chips carry the color
  // system so the grid itself can stay quiet.
  const chipStyle = (kind: string): React.CSSProperties => {
    switch (kind) {
      case 'post': return { background: `color-mix(in srgb, ${accent} 8%, white)`, color: INK, borderLeft: `3px solid color-mix(in srgb, ${accent} 45%, white)` };
      case 'carousel': return { background: `color-mix(in srgb, ${accent} 15%, white)`, color: INK, borderLeft: `3px solid ${accent}` };
      case 'lm': return { background: `color-mix(in srgb, ${mint} 15%, white)`, color: INK, borderLeft: `3px solid ${mint}` };
      case 'newsletter': return { background: 'rgba(2,49,47,0.04)', color: DIM, borderLeft: `3px solid ${FAINT}` };
      case 'newsjack': return { background: '#fff', color: FAINT, border: `1px dashed ${LINE}` };
      default: return { background: 'rgba(2,49,47,0.04)', color: DIM };
    }
  };
  const swatch = (bg: React.CSSProperties, label: string) => (
    <span key={label} className="inline-flex items-center gap-1.5 text-[12px]" style={{ color: DIM }}>
      <span className="h-2.5 w-2.5 rounded-sm" style={{ ...bg, border: bg.border || `1px solid ${LINE}` }} />
      {label}
    </span>
  );

  // Span the grid from cal.start through the END of the last scheduled item's month, so a
  // plan that runs into next month renders whole (cal.weeks is only the seeded minimum).
  const lastIso = [...cal.items, ...queueItems].reduce((m, it) => (it.date > m ? it.date : m), cal.start);
  const lastD = new Date(lastIso + 'T00:00:00');
  const endOfSpan = new Date(lastD.getFullYear(), lastD.getMonth() + 1, 0);
  const spanDays = Math.max(1, Math.round((endOfSpan.getTime() - start.getTime()) / 86400000) + 1);
  const weekCount = Math.max(cal.weeks || 1, Math.ceil(spanDays / 7));
  const weeks: Date[][] = [];
  for (let w = 0; w < weekCount; w++) {
    const row: Date[] = [];
    for (let d = 0; d < 7; d++) row.push(new Date(start.getTime() + (w * 7 + d) * 86400000));
    weeks.push(row);
  }
  // Header label covers the whole span ("July · August 2026" across a month boundary).
  const monthLabel = (() => {
    const a = start.toLocaleDateString('en-GB', { month: 'long' });
    const b = endOfSpan.toLocaleDateString('en-GB', { month: 'long' });
    const yr = endOfSpan.getFullYear();
    return a === b ? `${a} ${yr}` : `${a} · ${b} ${yr}`;
  })();
  const num = (n: number) => <CountUpNum n={n} size={26} />;
  /** Approved mark on a linked chip — the calendar's visible reaction to an approve. */
  const approvedMark = (it: CalendarItem) =>
    it.ref && scheduledIds.has(it.ref) ? (
      <span className="flex h-3 w-3 shrink-0 items-center justify-center rounded-full" style={{ background: accent }} title="Approved" aria-label="Approved">
        <svg width="7" height="7" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M5 13l4 4 10-10" stroke={inkOn(accent)} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    ) : null;
  // Mobile agenda: the 7-col grid clips at phone widths, so under 640px the month
  // renders as a day-grouped list that keeps the same tone rails.
  const agendaDays = Array.from(byDate.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div>
      <SectionHead eyebrow="The month ahead" title={<>A month, <Accent>topic by topic.</Accent></>} sub="Committed dates only. Every item here is real and sits on the day it publishes." />
      <div className="mb-5 flex flex-wrap gap-3">
        {[
          [totals.post + totals.carousel, totals.post + totals.carousel === 1 ? 'post' : 'posts'],
          [totals.lm, totals.lm === 1 ? 'lead magnet' : 'lead magnets'],
          [totals.newsletter, totals.newsletter === 1 ? 'newsletter' : 'newsletters'],
        ].map(([n, label]) => (
          <div key={label as string} className="flex items-baseline gap-2 rounded-xl bg-white px-4 py-3" style={{ border: `1px solid ${LINE}` }}>
            {num(n as number)}
            <span className="text-[13px] font-medium" style={{ color: DIM }}>{label}</span>
          </div>
        ))}
      </div>
      {totals.post + totals.carousel + totals.lm + totals.newsletter === 0 && (
        <p className="-mt-1 mb-5 text-[13px]" style={{ color: DIM }}>{live ? 'Posts take their dates here as the buffer schedules them.' : 'Approved drafts take their dates here right after your sign-off.'}</p>
      )}

      {/* Mobile: agenda list grouped by day (the grid clips at Mon-Wed under 640px). */}
      <div className="rounded-xl bg-white p-3 sm:hidden" style={{ border: `1px solid ${LINE}` }}>
        <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 px-1">
          <span className="text-[15px] font-semibold" style={{ color: INK }}>{monthLabel}</span>
          <span className="rounded-full px-2.5 py-1 text-[11px] font-medium tabular-nums" style={{ border: `1px solid ${LINE}`, background: '#fff', color: DIM }}>
            Posting starts {fmtDay(cal.start)}
          </span>
        </div>
        {agendaDays.map(([iso, dayItems]) => (
          <div key={iso}>
            <div className="mb-1 mt-3 px-1 text-[11px] font-semibold uppercase tracking-[0.08em] tabular-nums" style={{ color: FAINT }}>{fmtDay(iso)}</div>
            <div className="flex flex-col gap-1">
              {dayItems.map((it, i) => {
                const time = it.time || KIND_TIME[it.kind];
                if (it.kind === 'newsjack' || it.kind === 'call' || it.kind === 'review') {
                  return <div key={i} className="rounded-[6px] px-2.5 py-2 text-[12px] font-medium" style={chipStyle(it.kind)}>{labelOf(it)}</div>;
                }
                return (
                  <button
                    key={i}
                    onClick={() => onOpen(it)}
                    className="cb-cal-chip flex w-full items-center gap-2 rounded-[6px] px-2.5 py-2 text-left text-[12px] font-medium"
                    style={chipStyle(it.kind)}
                  >
                    {time && <span className="shrink-0 tabular-nums opacity-60">{time}</span>}
                    <span className="min-w-0 flex-1 truncate">{labelOf(it)}</span>
                    {approvedMark(it)}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-xl bg-white p-4 sm:block" style={{ border: `1px solid ${LINE}` }}>
        <div className="min-w-[820px]">
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1">
            <span className="text-[15px] font-semibold" style={{ color: INK }}>{monthLabel}</span>
            <span className="rounded-full px-2.5 py-1 text-[11px] font-medium tabular-nums" style={{ border: `1px solid ${LINE}`, background: '#fff', color: DIM }}>
              Posting starts {fmtDay(cal.start)}
            </span>
            {/* Count only content kinds: onboarding call/review tasks share the calendar but are not pieces. */}
            {(() => {
              const n = cal.items.filter((it) => ['post', 'carousel', 'lm', 'newsletter'].includes(it.kind)).length;
              if (n === 0) return null;
              return <span className="text-[12px] tabular-nums" style={{ color: FAINT }}>{n} content piece{n === 1 ? '' : 's'} scheduled</span>;
            })()}
            <span className="ml-auto hidden items-center gap-4 md:inline-flex">
              {swatch(chipStyle('post'), 'Post')}
              {swatch(chipStyle('carousel'), 'Carousel')}
              {swatch(chipStyle('lm'), 'Lead magnet')}
              {swatch(chipStyle('newsletter'), 'Newsletter')}
              {swatch(chipStyle('call'), 'Key date')}
            </span>
          </div>
          <div className="grid grid-cols-7 border-b pb-1.5" style={{ borderColor: DIVIDE }}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <div key={d} className="px-2 text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: FAINT }}>{d}</div>
            ))}
          </div>
          {weeks.map((row, wi) => (
            <div key={wi} className="cb-cal-row grid grid-cols-7" style={{ animationDelay: `${Math.min(wi * 55, 330)}ms` }}>
              {row.map((d, di) => {
                const iso = d.toISOString().slice(0, 10);
                const items = byDate.get(iso) || [];
                const visible = items.slice(0, 3);
                const weekend = d.getDay() === 0 || d.getDay() === 6;
                return (
                  <div key={iso} className="cb-cal-cell min-h-[112px] bg-white p-1.5" style={{ borderTop: wi > 0 ? `1px solid ${DIVIDE}` : 'none', borderLeft: di > 0 ? `1px solid ${DIVIDE}` : 'none' }}>
                    {/* Month turns are marked in the cell itself: the 1st renders "1 Aug" in
                        quiet mono ink, so the two-month span reads without extra rows. */}
                    <div className="px-0.5 pb-1 text-[12px] font-medium tabular-nums" style={d.getDate() === 1 ? { fontFamily: MONO, fontSize: 11, color: INK } : { color: weekend ? '#c2cccb' : FAINT }}>
                      {d.getDate() === 1 ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : d.getDate()}
                    </div>
                    <div className="flex flex-col gap-1">
                      {visible.map((it, i) => {
                        const time = it.time || KIND_TIME[it.kind];
                        const tip = `${time ? time + ' · ' : ''}${KIND_LABEL[it.kind] || it.kind} · ${labelOf(it)}`;
                        if (it.kind === 'newsjack' || it.kind === 'call' || it.kind === 'review') {
                          return <div key={i} title={tip} className="truncate rounded-[4px] px-1.5 py-1 text-[10.5px] font-medium" style={chipStyle(it.kind)}>{labelOf(it)}</div>;
                        }
                        return (
                          <button
                            key={i}
                            title={tip}
                            onClick={() => onOpen(it)}
                            className="cb-cal-chip flex w-full items-center gap-1 truncate rounded-[4px] px-1.5 py-1 text-left text-[10.5px] font-medium"
                            style={chipStyle(it.kind)}
                          >
                            {time && <span className="shrink-0 tabular-nums opacity-60">{time}</span>}
                            <span className="min-w-0 flex-1 truncate">{labelOf(it)}</span>
                            {approvedMark(it)}
                          </button>
                        );
                      })}
                      {items.length > visible.length && (
                        <div className="px-1 text-[10.5px] font-medium" style={{ color: FAINT }}>+{items.length - visible.length} more</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <p className="mt-3 text-[13px]" style={{ color: FAINT }}>Open slots stay open on purpose: when news breaks in your niche, a reactive post takes the slot same-day.</p>
    </div>
  );
}

// ---------- Lead magnet surface ----------
const LM_FORMAT_LABEL: Record<string, string> = {
  assessment: 'Assessment', calculator: 'Calculator', worksheet: 'Worksheet', checklist: 'Checklist',
  benchmark: 'Benchmark', report_card: 'Report card', diagnostic: 'Diagnostic',
};

/** Typographic mockup cover for a library entry: brand tones + the title as the art.
 *  Honest by construction — status chips only, no capture counts, no fake leads. */
function LmLibraryCard({ entry, accent, mint, brand, fontStack, i, onOpen, boardLive = false, clientDomain }: {
  entry: LeadMagnetEntry; accent: string; mint: string; brand?: BoardBrand; fontStack: string; i: number;
  onOpen?: (e: LeadMagnetEntry) => void; clientDomain?: string;
  /** Live BOARD (not entry status): drop the vanity "On your domain" framing. */
  boardLive?: boolean;
}) {
  const live = entry.status === 'live';
  const heroBg = live ? (brand?.header_bg || INK) : `color-mix(in srgb, ${accent} ${[9, 6, 12, 7, 5][i % 5]}%, white)`;
  // BUG FIX: live cards previously hardcoded a WHITE title. When the client's header_bg is
  // light (Rise DTC = #ffffff) the title rendered white-on-white = invisible. Derive the ink
  // from the actual hero color so it's readable on either a light or dark client brand bar.
  const liveHeroHex = cleanHex(brand?.header_bg, '#131210');
  const liveInk = inkOn(liveHeroHex);
  const titleColor = live ? liveInk : `color-mix(in srgb, ${accent} 72%, ${INK})`;
  const liveChip = liveInk === '#ffffff'
    ? { background: 'rgba(255,255,255,0.12)', color: '#ffffff' }
    : { background: 'rgba(19,18,16,0.06)', color: caText(accent) };
  const statusChip = live
    ? { label: boardLive ? (onClientDomain(entry.url, clientDomain) ? 'On your domain' : 'Live') : 'Live', bg: `color-mix(in srgb, ${mint} 16%, white)`, color: INK, dot: mint }
    : entry.status === 'built'
    ? { label: 'Built', bg: `color-mix(in srgb, ${accent} 9%, white)`, color: INK, dot: null }
    : entry.status === 'in_production'
    ? { label: 'In production', bg: `color-mix(in srgb, ${accent} 9%, white)`, color: INK, dot: null }
    : { label: 'Planned', bg: 'rgba(2,49,47,0.05)', color: DIM, dot: null };
  return (
    <div
      className={`cb-lm-card overflow-hidden rounded-xl bg-white ${LIFT} ${onOpen ? 'cursor-pointer' : ''}`}
      style={{ border: `1px solid ${LINE}` }}
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      aria-label={onOpen ? `Open ${entry.title}` : undefined}
      onClick={onOpen ? () => onOpen(entry) : undefined}
      onKeyDown={onOpen ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(entry); } } : undefined}
    >
      {entry.cover_url ? (
        <img src={entry.cover_url} alt="" loading="lazy" className="aspect-[16/10] w-full object-cover" style={{ display: 'block', objectPosition: 'top' }} />
      ) : (
      <div className="flex aspect-[16/10] flex-col justify-between p-4" style={{ background: heroBg }}>
        <span
          className="inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em]"
          style={live ? liveChip : { background: 'rgba(255,255,255,0.75)', color: DIM }}
        >
          {LM_FORMAT_LABEL[entry.format] || entry.format}
        </span>
        <span className="text-[17px] font-semibold leading-snug" style={{ fontFamily: fontStack, color: titleColor }}>
          {entry.title}
        </span>
      </div>
      )}
      <div className="flex items-center gap-2 px-3.5 py-2.5">
        <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: statusChip.bg, color: statusChip.color }}>
          {statusChip.dot && <StatusDot color={statusChip.dot} size={5} />}
          {statusChip.label}
        </span>
        <span className="ml-auto text-[11.5px] tabular-nums" style={{ color: FAINT }}>
          {live ? (boardLive ? 'announces on your feed at its slot' : 'On your domain') : entry.date_label || ''}
        </span>
      </div>
    </div>
  );
}

/** Lead-magnet detail drawer (same right-anchored grammar as the post drawer). Client depth
 *  only: title, format, status, cover/live link, captured-leads count, date. No internals. */
function LmDetailDrawer({ entry, board, accent, mint, fontStack, live = false, onClose, onEditPromo }: {
  entry: LeadMagnetEntry; board: Board; accent: string; mint: string; fontStack: string; live?: boolean; onClose: () => void;
  /** Live board: save an edit to this LM's delivery email / keyword DM. */
  onEditPromo?: (lmId: string, field: 'email' | 'dm', value: unknown) => Promise<{ ok: boolean; error?: string }>;
}) {
  const reduce = useReducedMotion();
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  const isLiveLm = entry.status === 'live';
  const liveHeaderHex = cleanHex(board.brand?.header_bg, '#131210');
  const heroBg = isLiveLm ? (board.brand?.header_bg || INK) : `color-mix(in srgb, ${accent} 9%, white)`;
  const onHero = isLiveLm ? inkOn(liveHeaderHex) : `color-mix(in srgb, ${accent} 72%, ${INK})`;
  // Live board: "Live" is reserved for announced-on-the-feed. Up-on-the-domain is the
  // honest state until the launch post runs.
  const statusLabel = isLiveLm ? (live && onClientDomain(entry.url, board.domain) ? 'On your domain' : 'Live') : entry.status === 'built' ? 'Built' : 'Concept';
  const url = entry.url;
  // A distinct direct-resource URL, if the data carries one (else landing == resource).
  const resourceUrl = (entry as unknown as { resource_url?: string }).resource_url;
  // The keyword that triggers the DM delivery (a sibling agent sets this on the LM).
  const gateKeyword = (entry as unknown as { gate_keyword?: string }).gate_keyword;
  // Inline promo editing state (live): edit the delivery email + keyword DM in place.
  const [editing, setEditing] = useState<null | 'email' | 'dm'>(null);
  const [dmDraft, setDmDraft] = useState(entry.promo?.dm || '');
  const [subjDraft, setSubjDraft] = useState(entry.promo?.email?.subject || '');
  const [bodyDraft, setBodyDraft] = useState(entry.promo?.email?.body || '');
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoErr, setPromoErr] = useState('');
  const saveDm = async () => {
    if (!onEditPromo) return;
    setPromoBusy(true); setPromoErr('');
    const r = await onEditPromo(entry.id, 'dm', dmDraft);
    setPromoBusy(false);
    if (!r.ok) { setPromoErr(r.error || 'Could not save that. Try again.'); return; }
    if (entry.promo) entry.promo.dm = dmDraft; else (entry as LeadMagnetEntry).promo = { dm: dmDraft };
    setEditing(null);
  };
  const saveEmail = async () => {
    if (!onEditPromo) return;
    setPromoBusy(true); setPromoErr('');
    const r = await onEditPromo(entry.id, 'email', { subject: subjDraft, body: bodyDraft });
    setPromoBusy(false);
    if (!r.ok) { setPromoErr(r.error || 'Could not save that. Try again.'); return; }
    if (entry.promo) entry.promo.email = { subject: subjDraft, body: bodyDraft }; else (entry as LeadMagnetEntry).promo = { email: { subject: subjDraft, body: bodyDraft } };
    setEditing(null);
  };
  // The real launch post for this LM, when one is queued (lm_ref points back at this asset).
  const launchPost = live ? (board.queue || []).find((q) => q.lm_ref === entry.id) : undefined;
  // Cover lightbox: the drawer cover is a comfortable size, click opens it full.
  const [zoom, setZoom] = useState(false);
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <motion.div className="fixed inset-0 bg-black/40" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose} aria-hidden />
      <motion.div
        className="fixed inset-y-0 right-0 flex w-full flex-col bg-white"
        style={{ maxWidth: 'min(760px, 95vw)', boxShadow: '-24px 0 80px rgba(2,32,32,.28)' }}
        initial={reduce ? false : { x: '100%' }}
        animate={reduce ? {} : { x: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 36 }}
      >
        <div className="flex shrink-0 items-start gap-3 px-5 pb-4 pt-5 sm:px-7 sm:pt-6" style={{ borderBottom: `1px solid ${LINE}` }}>
          <button onClick={onClose} aria-label="Close" className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors duration-150 hover:bg-[rgba(2,49,47,0.05)]">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" stroke={DIM} strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <div className="mb-1 uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.16em', color: INK_MUTE }}>{LM_FORMAT_LABEL[entry.format] || entry.format}</div>
            <h2 className="truncate" style={{ fontFamily: SERIF, fontSize: 21, lineHeight: 1.2, letterSpacing: '-0.01em', color: INK }}>{entry.title}</h2>
          </div>
          <span className="hidden shrink-0 items-center gap-2 rounded-full px-3 py-1 sm:inline-flex" style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.06em', color: isLiveLm ? INK : INK_MUTE, border: `1px solid ${isLiveLm ? caBorder(mint, 45) : LINE}`, background: isLiveLm ? `color-mix(in srgb, ${mint} 12%, white)` : 'transparent' }}>
            {isLiveLm && <StatusDot color={mint} size={5} />}{statusLabel}
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-7">
          {/* Cover: real cover image when present, else a typographic plate in the brand tones.
              A comfortable, full-width size; click to open it full-screen. */}
          {entry.cover_url ? (
            <button type="button" onClick={() => setZoom(true)} title="Click to view full size" className="block w-full cursor-zoom-in overflow-hidden rounded-xl p-0" style={{ border: `1px solid ${LINE}`, background: 'none', lineHeight: 0 }}>
              <img src={entry.cover_url} alt={entry.title} className="w-full object-contain" style={{ maxHeight: 440, display: 'block' }} />
            </button>
          ) : (
            <div className="flex aspect-[16/9] flex-col justify-between rounded-xl p-6" style={{ background: heroBg, border: `1px solid ${LINE}` }}>
              <span className="w-fit uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.14em', color: onHero, opacity: 0.85 }}>{LM_FORMAT_LABEL[entry.format] || entry.format}</span>
              <span style={{ fontFamily: fontStack, fontWeight: 700, fontSize: 26, lineHeight: 1.12, color: onHero }}>{entry.title}</span>
            </div>
          )}

          <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl sm:grid-cols-3" style={{ background: LINE, border: `1px solid ${LINE}` }}>
            <div className="bg-white px-4 py-3.5">
              <div className="uppercase" style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.14em', color: INK_MUTE }}>Status</div>
              <div className="mt-1 text-[14px] font-semibold" style={{ color: INK }}>{statusLabel}</div>
            </div>
            {typeof entry.captured === 'number' && (
              <div className="bg-white px-4 py-3.5">
                <div className="uppercase" style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.14em', color: INK_MUTE }}>Captured</div>
                <div className="mt-1 text-[14px] font-semibold tabular-nums" style={{ color: INK }}>{entry.captured}</div>
              </div>
            )}
            {(entry.date_label || isLiveLm) && (
              <div className="bg-white px-4 py-3.5">
                <div className="uppercase" style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.14em', color: INK_MUTE }}>{isLiveLm ? 'Where' : 'On the calendar'}</div>
                {/* Live board: the real host it is served from (checkable), never a vanity domain. */}
                <div className="mt-1 truncate text-[14px] font-semibold" style={{ color: INK }}>{isLiveLm ? (live ? realHostOf(entry.url) || 'Live' : 'On your domain') : entry.date_label}</div>
              </div>
            )}
          </div>

          <p className="mt-6" style={{ fontFamily: BODY, fontStyle: 'italic', fontSize: 13.5, lineHeight: 1.6, color: INK_MUTE }}>
            {isLiveLm
              ? (live
                ? (onClientDomain(entry.url, board.domain) ? 'Up on your domain with capture on. It announces on your feed when its launch slot comes up.' : 'Live with capture on. It announces on your feed when its launch slot comes up.')
                : 'Live on your domain. It scores or grades a real problem your buyers have, then captures their email into your leads.')
              : entry.status === 'built'
              ? 'Built and working. It goes up on your domain when its launch slot comes up.'
              : (live ? 'In build. It goes up on your domain when ready.' : 'On the calendar. It ships live on your domain when its slot comes up.')}
          </p>

          {/* Just the links — the landing page and the direct resource. No full embed inside
              the card. Landing and resource are the same page for these assets, so show one
              link (dedup); a distinct resource url would render as a second link. */}
          {isLiveLm && url && (
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2">
              {resourceUrl && resourceUrl !== url ? (
                <>
                  <a href={url} target="_blank" rel="noreferrer" className="uppercase" style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.06em', color: caText(accent), textDecoration: 'underline', textUnderlineOffset: 3 }}>Landing page →</a>
                  <a href={resourceUrl} target="_blank" rel="noreferrer" className="uppercase" style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.06em', color: caText(accent), textDecoration: 'underline', textUnderlineOffset: 3 }}>Resource →</a>
                </>
              ) : (
                <a href={url} target="_blank" rel="noreferrer" className="uppercase" style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.06em', color: caText(accent), textDecoration: 'underline', textUnderlineOffset: 3 }}>Landing page &amp; resource →</a>
              )}
            </div>
          )}

          {/* The promo kit: real copy only, nothing invented. Authored templates render as the
              artifact they are (a DM as chat, an email as mail, the announcement as a post) with
              an honest status line — never an "already sending" claim. */}
          {live && isLiveLm && (
            <div className="mt-6">
              <div className="mb-2 uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.18em', color: INK_MUTE }}>The promo kit</div>

              {/* Touch 1 — the single delivery DM we auto-send after someone comments the LM's
                  keyword. No outreach sequence renders here; the client-engager lane owns that. */}
              {(entry.promo?.dm || onEditPromo) && (
                    <div className="rounded-lg p-3.5" style={{ background: PAPER_SUNK, border: `1px solid ${LINE}` }}>
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="text-[11px] font-medium uppercase tracking-[0.08em]" style={{ color: FAINT }}>{gateKeyword ? `DM sent after they comment “${gateKeyword}”` : 'DM sent after they comment your keyword'}</div>
                        {onEditPromo && editing !== 'dm' && (
                          <button onClick={() => { setDmDraft(entry.promo?.dm || ''); setPromoErr(''); setEditing('dm'); }} className="uppercase" style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.08em', color: caText(accent), background: 'none', border: 'none', cursor: 'pointer' }}>Edit</button>
                        )}
                      </div>
                      {editing === 'dm' ? (
                        <div>
                          <textarea value={dmDraft} onChange={(e) => setDmDraft(e.target.value)} rows={5} className="w-full rounded-lg p-3 text-[13px] outline-none" style={{ border: `1px solid ${accent}`, color: INK, background: '#fff' }} />
                          <div className="mt-2 flex items-center gap-2.5">
                            <button onClick={saveDm} disabled={promoBusy} className="rounded-[6px] px-3.5 py-2 text-[12.5px] font-semibold" style={{ background: accent, color: inkOn(accent), border: 'none', cursor: 'pointer', opacity: promoBusy ? 0.6 : 1 }}>{promoBusy ? 'Saving…' : 'Save DM'}</button>
                            <button onClick={() => setEditing(null)} className="text-[12.5px]" style={{ color: INK_MUTE, background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
                          </div>
                          {promoErr && <div className="mt-1.5 text-[12px]" style={{ color: '#c0392b' }}>{promoErr}</div>}
                        </div>
                      ) : entry.promo?.dm ? (
                        <div className="rounded-[14px] rounded-bl-[4px] px-3.5 py-2.5" style={{ background: '#fff', border: `1px solid ${DIVIDE}`, maxWidth: '34ch' }}>
                          <p className="whitespace-pre-line text-[13px] leading-relaxed" style={{ fontFamily: BODY, color: INK }}>{entry.promo.dm}</p>
                        </div>
                      ) : (
                        <p className="text-[12.5px]" style={{ fontFamily: BODY, fontStyle: 'italic', color: INK_MUTE }}>No DM yet. Add the note we send when someone comments your keyword.</p>
                      )}
                    </div>
                  )}

              {/* Touch 2 — the delivery email, sent after they open the landing page. Editable in place. */}
              {(entry.promo?.email || onEditPromo) && (
                <div className="mt-4 overflow-hidden rounded-xl" style={{ border: `1px solid ${LINE}` }}>
                  {editing === 'email' ? (
                    <div className="p-4">
                      <div className="uppercase" style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.14em', color: INK_MUTE }}>Delivery email · subject</div>
                      <input value={subjDraft} onChange={(e) => setSubjDraft(e.target.value)} className="mt-1 w-full rounded-lg p-2.5 text-[14px] font-semibold outline-none" style={{ border: `1px solid ${LINE}`, color: INK, background: '#fff' }} />
                      <div className="mt-3 uppercase" style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.14em', color: INK_MUTE }}>Body</div>
                      <textarea value={bodyDraft} onChange={(e) => setBodyDraft(e.target.value)} rows={8} className="mt-1 w-full rounded-lg p-3 text-[13.5px] outline-none" style={{ border: `1px solid ${accent}`, color: INK, background: '#fff' }} />
                      <div className="mt-2 flex items-center gap-2.5">
                        <button onClick={saveEmail} disabled={promoBusy} className="rounded-[6px] px-3.5 py-2 text-[12.5px] font-semibold" style={{ background: accent, color: inkOn(accent), border: 'none', cursor: 'pointer', opacity: promoBusy ? 0.6 : 1 }}>{promoBusy ? 'Saving…' : 'Save email'}</button>
                        <button onClick={() => setEditing(null)} className="text-[12.5px]" style={{ color: INK_MUTE, background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
                      </div>
                      {promoErr && <div className="mt-1.5 text-[12px]" style={{ color: '#c0392b' }}>{promoErr}</div>}
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-2 px-4 py-2.5" style={{ borderBottom: `1px solid ${DIVIDE}`, background: 'rgba(2,49,47,0.02)' }}>
                        <div className="min-w-0">
                          <span className="uppercase" style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.14em', color: INK_MUTE }}>Delivery email · subject</span>
                          <div className="mt-0.5 text-[14px] font-semibold" style={{ fontFamily: BODY, color: INK }}>{entry.promo?.email?.subject || 'No subject yet'}</div>
                        </div>
                        {onEditPromo && (
                          <button onClick={() => { setSubjDraft(entry.promo?.email?.subject || ''); setBodyDraft(entry.promo?.email?.body || ''); setPromoErr(''); setEditing('email'); }} className="shrink-0 uppercase" style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.08em', color: caText(accent), background: 'none', border: 'none', cursor: 'pointer' }}>Edit</button>
                        )}
                      </div>
                      {entry.promo?.email?.body
                        ? <p className="px-4 py-4 text-[13.5px]" style={{ fontFamily: BODY, lineHeight: 1.6, color: INK_SOFT }}><EmailBodyPreview body={entry.promo.email.body} accent={accent} /></p>
                        : <p className="px-4 py-4 text-[12.5px]" style={{ fontFamily: BODY, fontStyle: 'italic', color: INK_MUTE }}>No delivery email yet. Edit to write the email that sends your lead magnet.</p>}
                      <div className="px-4 pb-3" style={{ fontFamily: BODY, fontStyle: 'italic', fontSize: 12, color: INK_MUTE }}>
                        Sent after they open your landing page. Saved as your delivery template — edit it any time.
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* The launch post: the REAL post in the buffer when one is queued for this LM,
                  otherwise the authored announcement template. */}
              {launchPost ? (
                <div className="mt-4 overflow-hidden rounded-xl" style={{ border: `1px solid ${LINE}` }}>
                  <div className="flex items-center justify-between gap-2 px-4 py-2.5" style={{ borderBottom: `1px solid ${DIVIDE}`, background: 'rgba(2,49,47,0.02)' }}>
                    <span className="uppercase" style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.14em', color: INK_MUTE }}>The launch post</span>
                    <span className="uppercase" style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.1em', color: caText(accent) }}>on the calendar</span>
                  </div>
                  {entry.cover_url && <img src={entry.cover_url} alt="" loading="lazy" className="w-full object-cover" style={{ maxHeight: 200, display: 'block', borderBottom: `1px solid ${DIVIDE}` }} />}
                  <p className="whitespace-pre-line px-4 py-4 text-[13.5px]" style={{ fontFamily: BODY, lineHeight: 1.6, color: INK_SOFT }}>{launchPost.body || launchPost.hook}</p>
                  <div className="px-4 pb-3" style={{ fontFamily: BODY, fontStyle: 'italic', fontSize: 12, color: INK_MUTE }}>
                    The post that launches this on your feed. It publishes on its scheduled day, with the cover as its image.
                  </div>
                </div>
              ) : entry.promo?.announcement ? (
                <div className="mt-4 overflow-hidden rounded-xl" style={{ border: `1px solid ${LINE}` }}>
                  <div className="px-4 py-2.5" style={{ borderBottom: `1px solid ${DIVIDE}`, background: 'rgba(2,49,47,0.02)' }}>
                    <span className="uppercase" style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.14em', color: INK_MUTE }}>Feed announcement</span>
                  </div>
                  <p className="whitespace-pre-line px-4 py-4 text-[13.5px]" style={{ fontFamily: BODY, lineHeight: 1.6, color: INK_SOFT }}>{entry.promo.announcement}</p>
                  <div className="px-4 pb-3" style={{ fontFamily: BODY, fontStyle: 'italic', fontSize: 12, color: INK_MUTE }}>
                    Written and ready. It queues into the buffer when its launch slot is picked.
                  </div>
                </div>
              ) : null}

              {!entry.promo?.email && !entry.promo?.announcement && !launchPost && !entry.promo?.dm && (
                <p className="text-[12.5px]" style={{ fontFamily: BODY, fontStyle: 'italic', color: INK_MUTE }}>
                  The feed announcement and outreach touches draft into your buffer when its launch slot is scheduled. They land here as they exist.
                </p>
              )}
            </div>
          )}
        </div>

        {isLiveLm && url && (
          <div className="sticky bottom-0 shrink-0 border-t bg-white px-5 py-3.5 sm:px-7" style={{ borderColor: LINE }}>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-[7px] px-6 text-[13.5px] font-semibold"
              style={{ background: accent, color: inkOn(accent) }}
            >
              View live ↗
            </a>
          </div>
        )}
      </motion.div>

      {/* Cover lightbox: the full image, click anywhere to close. */}
      {zoom && entry.cover_url && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-6"
          initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }}
          onClick={() => setZoom(false)} role="dialog" aria-modal="true"
          style={{ cursor: 'zoom-out' }}
        >
          <img src={entry.cover_url} alt={entry.title} style={{ maxWidth: '95vw', maxHeight: '92vh', objectFit: 'contain', borderRadius: 8 }} />
        </motion.div>
      )}
    </div>
  );
}

// ---------- Voice surface ----------
const VOICE_STYLE_LABEL: Record<string, string> = {
  text: 'Text post', quote_image: 'Quote image', selfie: 'Selfie', carousel: 'Carousel', newsjack: 'Newsjack',
};

/** The "voice engine" panel: how the engine learns the founder's voice, the register it
 *  models, the do/avoid guardrails, and REAL sample posts drafted in that voice. Reads
 *  like the other surfaces (SectionHead + white cards + mono eyebrows, accent as
 *  punctuation, sharp square markers). Falls back cleanly if a field is absent. */
function VoiceSurface({ board, accent, fontStack }: { board: Board; accent: string; fontStack: string }) {
  const v = board.voice || {};
  const sources = v.sources || [];
  const dos = v.do || [];
  const avoid = v.avoid || [];
  const samples = (v.samples || []).filter((s) => s.body).slice(0, 3);
  const founder = board.founder?.name || board.company_name;
  const initials = initialsOf(founder);
  const styles = board.content_styles || [];
  const sq = (color: string) => (
    <span className="mt-[6px] inline-block shrink-0" style={{ width: 6, height: 6, background: color }} aria-hidden />
  );
  return (
    <div>
      <SectionHead
        eyebrow="Learned, not guessed"
        title={<>Your voice, <Accent>modeled.</Accent></>}
        sub="The engine learns how you actually talk before it writes a word, then holds every draft to it. Here is where it learns from, the register it keeps, and what it will never let the copy do."
      />

      {/* How we learn it */}
      <div className="mb-8 rounded-xl bg-white p-5 sm:p-6" style={{ border: `1px solid ${LINE}` }}>
        <CardHead>How the engine learns your voice</CardHead>
        <div className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
          {sources.map((s, i) => (
            <div key={i} className="flex gap-3">
              {sq(accent)}
              <div>
                <div className="uppercase" style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.14em', color: INK }}>{s.label}</div>
                <div className="mt-1" style={{ fontFamily: BODY, fontSize: 13.5, lineHeight: 1.55, color: INK_SOFT }}>{s.detail}</div>
              </div>
            </div>
          ))}
        </div>
        {v.note && (
          <p className="mt-5 pt-4" style={{ borderTop: `1px solid ${LINE}`, fontFamily: BODY, fontStyle: 'italic', fontSize: 13.5, color: INK_MUTE }}>{v.note}</p>
        )}
      </div>

      {/* Register — pulled statement */}
      {v.register && (
        <div className="mb-8 rounded-xl bg-white p-5 sm:p-6" style={{ border: `1px solid ${LINE}`, borderLeft: `3px solid ${accent}` }}>
          <div className="mb-2 uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.2em', color: INK_MUTE }}>The register</div>
          <p style={{ fontFamily: SERIF, fontSize: 'clamp(19px, 2.2vw, 25px)', lineHeight: 1.32, letterSpacing: '-0.01em', color: INK }}>{v.register}</p>
        </div>
      )}

      {/* Keeps / Never */}
      {(dos.length > 0 || avoid.length > 0) && (
        <div className="mb-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-white p-5" style={{ border: `1px solid ${LINE}` }}>
            <div className="mb-3 uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.18em', color: INK }}>What it keeps</div>
            <ul className="flex flex-col gap-2.5">
              {dos.map((d, i) => (
                <li key={i} className="flex gap-2.5">{sq(accent)}<span style={{ fontFamily: BODY, fontSize: 13.5, lineHeight: 1.5, color: INK_SOFT }}>{d}</span></li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl bg-white p-5" style={{ border: `1px solid ${LINE}` }}>
            <div className="mb-3 uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.18em', color: INK_MUTE }}>What it never does</div>
            <ul className="flex flex-col gap-2.5">
              {avoid.map((a, i) => (
                <li key={i} className="flex gap-2.5">{sq('rgba(26,26,26,0.25)')}<span style={{ fontFamily: BODY, fontSize: 13.5, lineHeight: 1.5, color: INK_MUTE }}>{a}</span></li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Sample posts in the modeled voice */}
      {samples.length > 0 && (
        <div className="mb-8">
          <div className="mb-1 flex items-baseline gap-2.5"><CardHead>The voice, in a post</CardHead></div>
          <div className="mt-3 grid gap-4 lg:grid-cols-3">
            {samples.map((s, i) => (
              <div key={i} className="flex flex-col rounded-xl bg-white p-4" style={{ border: `1px solid ${LINE}` }}>
                <div className="mb-2.5 flex items-center gap-2.5">
                  <span className="flex shrink-0 items-center justify-center" style={{ width: 30, height: 30, background: accent, color: '#fff', fontFamily: fontStack, fontWeight: 700, fontSize: 12 }} aria-hidden>{initials}</span>
                  <div className="leading-tight">
                    <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 13, color: INK }}>{founder}</div>
                    <div className="uppercase" style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.12em', color: FAINT }}>{VOICE_STYLE_LABEL[s.style || 'text'] || 'Post'}</div>
                  </div>
                </div>
                <p style={{ fontFamily: BODY, fontSize: 13, lineHeight: 1.6, color: INK_SOFT, whiteSpace: 'pre-line' }}>{(s.body || '').slice(0, 320)}{(s.body || '').length > 320 ? '…' : ''}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* The formats the engine ships (standardized showcase) */}
      {styles.length > 0 && (
        <div className="rounded-xl bg-white p-5 sm:p-6" style={{ border: `1px solid ${LINE}` }}>
          <div className="mb-1"><CardHead>The formats your feed runs on</CardHead></div>
          <p className="mb-4 max-w-[62ch] text-[13px]" style={{ color: DIM }}>The same voice, shipped in the mix that performs: written takes, branded quote images, your real photos, carousels, and same-day reactions.</p>
          <div className="grid gap-x-8 gap-y-3.5 sm:grid-cols-2">
            {styles.map((st) => (
              <div key={st.key} className="flex gap-3">
                {sq(accent)}
                <div>
                  <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 13.5, color: INK }}>
                    {st.label}
                    {st.needs_photo && <span className="ml-2 uppercase" style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: '0.1em', color: FAINT }}>from your lifestyle library</span>}
                  </div>
                  <div className="mt-0.5" style={{ fontFamily: BODY, fontSize: 12.5, lineHeight: 1.5, color: INK_SOFT }}>{st.blurb}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LeadMagnetSurface({ board, accent, mint, fontStack, live = false, onEditPromo }: {
  board: Board; accent: string; mint: string; fontStack: string; live?: boolean;
  onEditPromo?: (lmId: string, field: 'email' | 'dm', value: unknown) => Promise<{ ok: boolean; error?: string }>;
}) {
  const lm = board.lm;
  const [lmDetail, setLmDetail] = useState<LeadMagnetEntry | null>(null);
  // Default src (scan_embed) keeps the engine's embed mode: Ivan's chrome/greeting
  // stripped + the client's accent/fonts applied. bname/blogo/cta/ctaurl rebrand the
  // engine's identity + end-screen CTA to the CLIENT (not Ivan's Calendly).
  const src = useMemo(() => {
    const domain = (board.domain || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
    const ctaurl = (board.site as any)?.cta_url || (domain ? `https://${domain}/` : undefined);
    return buildAssessmentEmbedUrl(lm, {
      bname: board.company_name,
      blogo: board.brand?.logo_light || board.logo_url || undefined,
      cta: board.site?.cta,
      ctaurl,
    });
  }, [lm, board]);
  // Address-bar chrome. Preview keeps the vanity-domain theater (their domain + a slugified
  // path). LIVE shows the REAL hosted URL only: a paying client can type it in, so nothing
  // fabricated may render. No real URL on record = no address bar (the embed hides it).
  const embedChrome = (() => {
    if (!live) return { domain: board.domain, urlPath: lmPath(lm?.title) };
    const real = (lm as any)?.url as string | undefined;
    if (!real) return { domain: undefined, urlPath: undefined };
    try {
      const u = new URL(real);
      return { domain: u.hostname.replace(/^www\./, ''), urlPath: u.pathname.replace(/^\/+|\/+$/g, '') || undefined };
    } catch { return { domain: undefined, urlPath: undefined }; }
  })();
  // Shared blocks, composed in a different order per mode: LIVE reads as a production tool
  // (library first, then the idea bank, then the live tool itself); preview keeps the
  // demo-funnel order (embed first) byte-for-byte.
  const liveN = (board.lead_magnets || []).filter((e) => e.status === 'live').length;
  const buildN = (board.lead_magnets || []).length - liveN;
  const embedBlock = src ? (
    <LiveAssessmentEmbed
      src={src}
      title={lm?.title}
      domain={embedChrome.domain}
      urlPath={embedChrome.urlPath}
      logoUrl={board.brand?.logo_dark || board.logo_url}
      accentHex={accent}
      companyName={board.company_name}
      navLinks={board.site?.nav}
      headerBg={board.brand?.header_bg}
      ctaText={board.site?.cta}
      phone={board.site?.phone}
      height={980}
    />
  ) : (
    <div className="rounded-xl bg-white p-8" style={{ border: `1px solid ${LINE}` }}>
      <p className="text-[14px]" style={{ color: DIM }}>Your first lead magnet is in production. It lands here for review this week.</p>
    </div>
  );
  const libraryGrid = (board.lead_magnets || []).length > 0 ? (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {(board.lead_magnets || []).map((entry, i) => (
        <LmLibraryCard key={entry.id} entry={entry} accent={accent} mint={mint} brand={board.brand} fontStack={fontStack} i={i} onOpen={setLmDetail} boardLive={live} clientDomain={board.domain} />
      ))}
    </div>
  ) : null;

  const capturedBlock = (
    <div className="mt-6 rounded-xl bg-white p-4 sm:p-5" style={{ border: `1px solid ${LINE}` }}>
      <div className="mb-3"><CardHead>Captured leads</CardHead></div>
      {(board.leads && board.leads.length > 0) ? (
        <>
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr style={{ color: FAINT }}>
                <th className="pb-2 pr-3 font-medium">Email</th>
                <th className="pb-2 pr-3 font-medium">Score</th>
                <th className="pb-2 font-medium">Weakest area</th>
                <th className="hidden pb-2 pl-3 font-medium sm:table-cell">When</th>
              </tr>
            </thead>
            <tbody style={{ color: INK }}>
              {board.leads.map((lead, i) => (
                <tr key={i} style={{ borderTop: `1px solid ${DIVIDE}` }}>
                  <td className="py-2.5 pr-3"><span className="break-all">{lead.email}</span></td>
                  <td className="whitespace-nowrap py-2.5 pr-3 tabular-nums">{lead.score || ''}</td>
                  <td className="py-2.5">{lead.weakest_area || ''}</td>
                  <td className="hidden py-2.5 pl-3 sm:table-cell">{lead.when || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-[13px]" style={{ color: DIM }}>Yours to keep, exportable anytime.</p>
        </>
      ) : (
        <div className="rounded-lg px-4 py-6 text-center" style={{ background: PAPER_SUNK, border: `1px dashed ${LINE}` }}>
          <p className="mx-auto max-w-[46ch] text-[13px] leading-relaxed" style={{ color: DIM }}>
            Leads land here the moment someone completes your assessment. Yours to keep, exportable anytime.
          </p>
        </div>
      )}
    </div>
  );
  const drawer = lmDetail ? (
    <LmDetailDrawer entry={lmDetail} board={board} accent={accent} mint={mint} fontStack={fontStack} live={live} onClose={() => setLmDetail(null)} onEditPromo={live ? onEditPromo : undefined} />
  ) : null;

  if (live) {
    // Production surface: the library only. Ideas live on the operator side, resources
    // open at their real URLs (no embed), and leads report on the Leads tab.
    return (
      <div>
        <SectionHead eyebrow="Live assessments" title={<>Lead magnets.</>} />
        {libraryGrid && (
          <div>
            <div className="mb-1 flex items-baseline gap-2.5">
              <CardHead>Library</CardHead>
            </div>
            <p className="mb-3 max-w-[64ch] text-[13px] leading-relaxed" style={{ color: DIM }}>
              {liveN} live and capturing, {buildN} in build.
            </p>
            {libraryGrid}
          </div>
        )}
        {drawer}
      </div>
    );
  }

  return (
    <div>
      <SectionHead
        eyebrow="Live on your domain"
        title={<>Lead magnets, <Accent>working for you.</Accent></>}
        sub="The live one first, exactly what your leads see. It scores them, then captures their email. New capture assets ship on the calendar below it."
      />
      {embedBlock}

      {/* Library: the live one plus what's coming. Statuses are honest; mockup covers
          are typographic, never screenshots of things that don't exist yet. */}
      {libraryGrid && (
        <div className="mt-8">
          <div className="mb-1 flex items-baseline gap-2.5">
            <CardHead>Your lead magnet library</CardHead>
            <span className="text-[12px] tabular-nums" style={{ color: FAINT }}>
              {[liveN > 0 ? `${liveN} live` : '', buildN > 0 ? `${buildN} in build` : ''].filter(Boolean).join(' · ')}
            </span>
          </div>
          <p className="mb-3 max-w-[64ch] text-[13px] leading-relaxed" style={{ color: DIM }}>
            Each one scores or grades a real problem your buyers have, captures the email, and feeds the leads table below.
          </p>
          {libraryGrid}
        </div>
      )}

      {capturedBlock}
      {drawer}
    </div>
  );
}

// ---------- Strategy surface ----------
/** One-line job per pillar, used when the board data carries no blurb. */
const PILLAR_JOBS: Record<string, string> = {
  demand: 'Shows buyers what the problem is costing them right now.',
  authority: 'Proves you understand the mechanics better than anyone else they follow.',
  teardown: 'Walks through real numbers so the lesson sticks.',
  proof: 'Client results, told straight.',
  personal: 'The founder behind the work. Keeps the feed human.',
};

function StrategySurface({ board, accent, mint, isLive, act }: {
  board: Board; accent: string; mint: string;
  isLive: boolean;
  act: (action: 'shift_request', ref?: string | null, payload?: Record<string, unknown> | null) => Promise<{ ok: boolean; error?: string }>;
}) {
  const strat = board.strategy;
  const [open, setOpen] = useState<string | null>(null);
  const [shiftOpen, setShiftOpen] = useState(false);
  const [shiftSent, setShiftSent] = useState(false);
  const [shiftBusy, setShiftBusy] = useState(false);
  const [shiftErr, setShiftErr] = useState('');
  const [note, setNote] = useState('');
  const sendShift = async () => {
    if (isLive) {
      setShiftBusy(true); setShiftErr('');
      const r = await act('shift_request', null, { note });
      setShiftBusy(false);
      if (!r.ok) { setShiftErr(r.error || 'Could not send that. Try again.'); return; }
    }
    setShiftSent(true); setShiftOpen(false);
  };
  if (!strat) return null;

  const openPillar = strat.pillars.find((p) => p.key === open);
  const queueOf = (key: string) => board.queue.filter((q) => q.pillar === key && (q.stage === 'review' || q.stage === 'drafted'));
  const scheduledOf = (key: string) => (board.calendar?.items || []).filter((it) => it.pillar === key).length;

  return (
    <div>
      <SectionHead eyebrow="This month's mix" title={<>One plan, <Accent>divided on purpose.</Accent></>} sub="Reviewed monthly. Request a shift anytime." />

      <div className="rounded-xl bg-white p-4 sm:p-6" style={{ border: `1px solid ${LINE}` }}>
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <CardHead>Your content this month</CardHead>
          <div className="flex items-baseline gap-2">
            <CountUpNum n={strat.total} size={34} />
            <span className="text-[13px] font-medium" style={{ color: DIM }}>posts</span>
          </div>
        </div>

        <div className="flex w-full flex-wrap overflow-hidden rounded-lg sm:flex-nowrap" style={{ border: `1px solid ${LINE}` }}>
          {strat.pillars.map((p, i) => (
            <button
              key={p.key}
              onClick={() => setOpen(open === p.key ? null : p.key)}
              className="relative flex min-h-[86px] min-w-[96px] flex-col items-start justify-center gap-0.5 px-2 py-3 text-left transition-opacity sm:min-w-[58px]"
              style={{
                flexGrow: p.pct,
                flexBasis: 0,
                background: `color-mix(in srgb, ${accent} ${TINT_STEPS[i % TINT_STEPS.length]}%, white)`,
                borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.9)' : 'none',
                opacity: open && open !== p.key ? 0.55 : 1,
              }}
            >
              <span className="w-full truncate text-[12px] font-semibold" style={{ color: INK }}>{p.label}</span>
              <CountUpNum n={p.count} size={24} />
              <span className="text-[11px] font-medium" style={{ color: DIM }}>{p.pct}%</span>
            </button>
          ))}
        </div>

        {openPillar && (
          <div className="mt-5 rounded-lg p-4" style={{ background: 'rgba(2,49,47,0.02)', border: `1px solid ${LINE}` }}>
            <div className="text-[14px] font-semibold" style={{ color: INK }}>{openPillar.label}</div>
            {openPillar.blurb && <p className="mt-1 text-[13px] leading-relaxed" style={{ color: DIM }}>{openPillar.blurb}</p>}
            <div className="mt-3 flex flex-col gap-3">
              {queueOf(openPillar.key).map((q) => (
                <div key={q.id} className="rounded-lg bg-white p-3" style={{ border: `1px solid ${LINE}` }}>
                  <div className="text-[13px] font-medium leading-snug" style={{ color: INK }}>{q.hook || q.title}</div>
                  <div className="mt-1 text-[12px]" style={{ color: FAINT }}>{STAGE_META[q.stage].label} · publishes {fmtDay(q.publish_date)}</div>
                </div>
              ))}
            </div>
            {scheduledOf(openPillar.key) > 0 && (
              <p className="mt-3 text-[12px]" style={{ color: FAINT }}>
                + {scheduledOf(openPillar.key)} more {openPillar.label.toLowerCase()} slots scheduled in {strat.period || 'this month'}
              </p>
            )}
          </div>
        )}

        {board.calendar && (() => {
          const t = { post: 0, carousel: 0, lm: 0, newsletter: 0 };
          board.calendar.items.forEach((it) => { if (it.kind in t) (t as any)[it.kind] += 1; });
          const formats = [
            { label: 'Text posts', n: t.post, bg: `color-mix(in srgb, ${accent} 9%, white)` },
            { label: 'Carousels', n: t.carousel, bg: `color-mix(in srgb, ${accent} 17%, white)` },
            { label: 'Lead magnets', n: t.lm, bg: `color-mix(in srgb, ${mint} 15%, white)` },
            { label: 'Newsletters', n: t.newsletter, bg: 'rgba(2,49,47,0.04)' },
          ].filter((f) => f.n > 0);
          // Zero-fabrication: the calendar is often a near-term seed, not the whole month.
          // Only show a format SPLIT when it actually covers the plan total — otherwise it
          // contradicts the headline count (e.g. "1 Text post" under a 24-post month).
          const covered = t.post + t.carousel + t.lm + t.newsletter;
          if (!covered || covered < (strat.total || 0)) return null;
          return (
            <div className="mt-6">
              <div className="mb-2"><CardHead>Formats this month</CardHead></div>
              <div className="flex w-full overflow-hidden rounded-lg" style={{ border: `1px solid ${LINE}` }}>
                {formats.map((f, i) => (
                  <div
                    key={f.label}
                    className="flex min-h-[56px] flex-col items-start justify-center gap-0 px-2 py-2"
                    style={{ flexGrow: f.n, flexBasis: 0, minWidth: 62, background: f.bg, borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.9)' : 'none' }}
                  >
                    <CountUpNum n={f.n} size={18} />
                    <span className="w-full truncate text-[11px] font-semibold" style={{ color: INK }}>{f.label}</span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[12px] leading-relaxed" style={{ color: FAINT }}>
                The format each topic ships in is picked per topic: teardown math wants a carousel, a capture play wants a lead magnet.
              </p>
            </div>
          );
        })()}

      </div>

      {/* Posting cadence: the rhythm commitment, data-driven per client (strategy.cadence). */}
      {strat.cadence && (
        <div className="mt-6 rounded-xl bg-white p-4 sm:p-6" style={{ border: `1px solid ${LINE}` }}>
          <CardHead>Posting cadence</CardHead>
          <div className="mt-2" style={{ fontFamily: SERIF, fontSize: 'clamp(18px, 2vw, 22px)', lineHeight: 1.25, color: INK }}>{strat.cadence.headline}</div>
          {strat.cadence.detail && <p className="mt-2 text-[14px] leading-relaxed" style={{ color: DIM }}>{strat.cadence.detail}</p>}
          {strat.cadence.note && <p className="mt-2.5 text-[13px]" style={{ color: FAINT }}>{strat.cadence.note}</p>}
        </div>
      )}

      {/* Per-pillar breakdown: what each slice of the bar is doing, with a real example. */}
      <div className="mt-6 overflow-hidden rounded-xl bg-white" style={{ border: `1px solid ${LINE}` }}>
        <div className="px-4 pb-1 pt-4 text-[13px] font-semibold sm:px-6" style={{ color: INK }}>What each pillar does</div>
        {strat.pillars.map((p, i) => {
          const example = board.queue.find((q) => q.pillar === p.key && (q.hook || q.title))
            || null;
          const calExample = !example ? (board.calendar?.items || []).find((it) => it.pillar === p.key) : null;
          const exampleTitle = example ? (example.hook || example.title) : calExample?.label;
          return (
            <div key={p.key} className="grid grid-cols-[minmax(96px,130px)_1fr] gap-x-4 px-4 py-3.5 sm:grid-cols-[150px_1fr_44px] sm:px-6" style={{ borderTop: `1px solid ${DIVIDE}` }}>
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-[3px]" style={{ background: `color-mix(in srgb, ${accent} ${TINT_STEPS[i % TINT_STEPS.length] + 34}%, white)` }} aria-hidden />
                <span className="text-[13.5px] font-semibold" style={{ color: INK }}>{p.label}</span>
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] leading-relaxed" style={{ color: DIM }}>{p.blurb || PILLAR_JOBS[p.key] || 'Part of the monthly mix.'}</span>
                {exampleTitle && (
                  <span className="mt-0.5 block truncate text-[12px]" style={{ color: FAINT }}>e.g. “{exampleTitle}”</span>
                )}
              </span>
              <span className="hidden text-right text-[13px] font-semibold tabular-nums sm:block" style={{ color: DIM }}>{p.pct}%</span>
            </div>
          );
        })}
      </div>

      {/* Voice model: what the drafts are trained on. Sources named, no post counts claimed.
          Preview-only: hidden in live mode so the client board doesn't expose the model panel. */}
      {!isLive && (() => {
        const domain = (board.domain || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
        const traits: string[] = (board as any).voice?.traits || ['Plain spoken', 'Numbers on the page', 'No hype'];
        return (
          <div className="mt-6 rounded-xl bg-white p-4 sm:p-6" style={{ border: `1px solid ${LINE}` }}>
            <div className="mb-1"><CardHead>Voice model</CardHead></div>
            <p className="text-[13.5px] leading-relaxed" style={{ color: DIM }}>
              Every draft is written from a model of how you already sound, then checked against it before it reaches your review.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {traits.map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium" style={{ background: `color-mix(in srgb, ${accent} 7%, white)`, color: INK }}>
                  <span className="h-[5px] w-[5px] rounded-full" style={{ background: accent, opacity: 0.55 }} aria-hidden />
                  {noDash(t)}
                </span>
              ))}
            </div>
            <p className="mt-3 text-[12px]" style={{ color: FAINT }}>
              Sources: {domain ? `${domain} + your LinkedIn posts` : 'your site copy + your LinkedIn posts'}
            </p>
          </div>
        );
      })()}

      {/* Recent shifts: the request loop lives here — client asks, operator decides. */}
      <div className="mt-6 rounded-xl bg-white p-4 sm:p-6" style={{ border: `1px solid ${LINE}` }}>
        <div className="mb-3"><CardHead>Recent shifts</CardHead></div>
        {shiftSent ? (
          <p className="text-[13.5px] font-medium" style={{ color: caText(accent) }}>Sent. It gets an answer before the next batch drafts.</p>
        ) : (
          <p className="text-[13.5px] leading-relaxed" style={{ color: DIM }}>No shifts requested yet. The mix is reviewed monthly.</p>
        )}
        {!shiftSent && (
          <div className="mt-4">
            {!shiftOpen ? (
              <button
                onClick={() => setShiftOpen(true)}
                className="inline-flex min-h-[44px] items-center rounded-[6px] px-4 text-[14px] font-semibold"
                style={{ border: `1px solid ${LINE}`, color: INK, background: '#fff' }}
              >
                Request a shift
              </button>
            ) : (
              <div>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder='e.g. "More proof posts this month, we just landed two big results."'
                  rows={3}
                  className="w-full rounded-lg p-3 text-[14px] outline-none"
                  style={{ border: `1px solid ${LINE}`, color: INK, background: 'rgba(2,49,47,0.02)' }}
                />
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <button
                    onClick={sendShift}
                    disabled={shiftBusy || !note.trim()}
                    className="inline-flex min-h-[44px] items-center rounded-[6px] px-4 text-[14px] font-semibold"
                    style={{ border: `1px solid ${LINE}`, color: INK, background: '#fff', opacity: shiftBusy || !note.trim() ? 0.55 : 1 }}
                  >
                    {shiftBusy ? 'Sending…' : 'Send'}
                  </button>
                  {shiftErr && <span className="text-[12px]" style={{ color: '#c0392b' }}>{shiftErr}</span>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Operator note: why this mix, signed. */}
      <div className="mt-6 rounded-xl bg-white p-4 sm:p-6" style={{ border: `1px solid ${LINE}` }}>
        <div className="mb-3 flex items-center gap-2.5">
          <span className="cb-operator-on flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold" style={{ background: INK, color: '#fff' }} aria-hidden>ON</span>
          <CardHead>Why this mix</CardHead>
        </div>
        <p className="text-[14px] leading-relaxed" style={{ color: DIM }}>
          {board.company_name}'s first month is weighted toward demand. Your buyers move when they see what the problem is costing them, so the feed leads with that. Authority ramps as the audience warms, and proof takes a bigger share of the mix as client results come in.{isLive ? '' : ' We review the weights together every month.'}
        </p>
        <p className="mt-3 text-[13px] font-medium" style={{ color: INK }}>{isLive ? clientBrand(board) : 'InboundOnSteroids'}</p>
      </div>

      {/* Your plan: the preview-only deliverables card (a live production tool never shows
          pricing or a pause control). Counts come from the plan total + real board arrays,
          so nothing disagrees with the headline. */}
      {!isLive && (() => {
        const liveLms = (board.lead_magnets || []).filter((e) => e.status === 'live').length;
        const nlIssues = (board.newsletter?.issues || []).length;
        const ships: string[] = [
          `${strat.total} LinkedIn posts, drafted for your approval`,
          ...(liveLms > 0 ? [`${liveLms} lead magnet${liveLms === 1 ? '' : 's'}, live on your domain`] : []),
          ...(nlIssues > 0 ? [`${nlIssues} newsletter issue${nlIssues === 1 ? '' : 's'}`] : []),
          'Captured leads pipeline, exportable anytime',
          'Monthly performance report from your operator',
        ];
        return (
          <div className="mt-6 rounded-xl bg-white p-4 sm:p-6" style={{ border: `1px solid ${LINE}` }}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <CardHead>Your plan</CardHead>
                <p className="mt-0.5 text-[13px]" style={{ color: DIM }}>Operator plan · month to month</p>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              {ships.map((s) => (
                <div key={s} className="flex items-center gap-2.5 text-[13.5px]" style={{ color: INK }}>
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full" style={{ background: `color-mix(in srgb, ${accent} 16%, white)` }} aria-hidden>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
                      <path d="M5 13l4 4 10-10" stroke={accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  {s}
                </div>
              ))}
            </div>
            <p className="mt-4 text-[13px] leading-relaxed" style={{ color: DIM }}>
              Month to month. Pause anytime. Your content, your leads, yours to keep.
            </p>
            {/* The kill switch, visible on purpose. Inert in preview. */}
            <div className="mt-4 flex items-center justify-between gap-3 rounded-lg p-3.5" style={{ border: `1px solid ${LINE}`, background: 'rgba(2,49,47,0.02)' }}>
              <div className="min-w-0">
                <div className="text-[13px] font-semibold" style={{ color: INK }}>Pause engine</div>
                <div className="mt-0.5 text-[12px] leading-snug" style={{ color: DIM }}>Stops drafting and publishing. Nothing ships while paused.</div>
              </div>
              <div className="flex shrink-0 items-center gap-2.5">
                <span className="hidden text-[11px] sm:inline" style={{ color: FAINT }}>Available when live</span>
                <span
                  role="switch"
                  aria-checked={false}
                  aria-disabled
                  title="Available when the engine is live"
                  className="relative inline-flex h-5 w-9 cursor-default items-center rounded-full"
                  style={{ background: 'rgba(2,49,47,0.12)' }}
                >
                  <span className="absolute left-0.5 h-4 w-4 rounded-full bg-white" style={{ boxShadow: '0 1px 2px rgba(2,32,32,0.18)' }} />
                </span>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ---------- Newsletter surface ----------
function NewsletterSurface({ board, accent, fontStack, onOpenIssue, live = false }: {
  board: Board; accent: string; fontStack: string;
  onOpenIssue: (it: NewsletterIssue) => void;
  /** Live board: the nurture steps are the plan, not running behavior. Frame them as such. */
  live?: boolean;
}) {
  const nl = board.newsletter;
  const [issueOpen, setIssueOpen] = useState(false);
  const reduce = useReducedMotion();
  if (!nl) return null;
  const issues = nl.issues || [];
  const nurture = nl.nurture || [];

  const issueStatus = (it: NewsletterIssue) =>
    stageStatus({ id: it.id, kind: 'newsletter', stage: it.stage === 'scheduled' ? 'scheduled' : 'planned', publish_date: it.date }, it.stage === 'scheduled' ? 'scheduled' : 'planned', board.calendar?.start);

  return (
    <div>
      {live ? (
        /* Production panel, not a pitch: the masthead is the name + the real cadence/status. */
        <SectionHead
          eyebrow="Newsletter"
          title={<>{nl.name}.</>}
          sub={[nl.cadence, nl.status ? `Status: ${nl.status}.` : ''].filter(Boolean).join(' \u00b7 ')}
        />
      ) : (
        <SectionHead
          eyebrow="Weekly to your list"
          title={<>Your newsletter, <Accent>in your voice.</Accent></>}
          sub={'One issue a week, written in your voice. Every lead your assessments capture gets it.'}
        />
      )}

      {/* Hero: memo identity next to an inbox preview of the next issue. */}
      {(() => {
        const founderName = board.founder?.name || board.company_name;
        const initials = founderName.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
        const first = issues[0];
        const linked = first?.ref ? board.queue.find((q) => q.id === first.ref) : null;
        const fullBody = first?.body || '';
        const snippet = fullBody || linked?.body || 'Your first draft lands here the Sunday before it sends, ready for your review.';
        return (
          <div className="grid gap-5 rounded-xl bg-white p-5 sm:p-6 lg:grid-cols-[minmax(220px,1fr)_1.25fr] lg:items-center" style={{ border: `1px solid ${LINE}` }}>
            <div>
              <div className="text-[24px] font-semibold leading-tight tracking-tight" style={{ fontFamily: fontStack, color: INK }}>{nl.name}</div>
              <div className="mt-2.5 flex flex-col gap-1.5 text-[13px]" style={{ color: DIM }}>
                {nl.cadence && <span>{nl.cadence}</span>}
                {nl.from_domain && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-[5px] w-[5px] rounded-full" style={{ background: accent, opacity: 0.55 }} aria-hidden />
                    {live ? <>Will send from {nl.from_domain}, set up in week two.</> : <>Sends from {nl.from_domain}</>}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-[5px] w-[5px] rounded-full" style={{ background: accent, opacity: 0.55 }} aria-hidden />
                  {live ? 'Drafted ahead, shared here before each send' : 'Drafted in your voice, ready for your review'}
                </span>
              </div>
            </div>
            <div className="overflow-hidden rounded-xl bg-white" style={{ border: `1px solid ${LINE}` }}>
              <div className="flex items-center gap-1.5 px-4 py-2.5" style={{ borderBottom: `1px solid ${DIVIDE}`, background: 'rgba(2,49,47,0.02)' }}>
                {[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 rounded-full" style={{ background: 'rgba(2,49,47,0.10)' }} aria-hidden />)}
                <span className="ml-2 text-[11px] font-medium" style={{ color: FAINT }}>Inbox · next issue</span>
              </div>
              <div className="p-4 sm:p-5">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold" style={{ background: accent, color: inkOn(accent) }} aria-hidden>{initials}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold" style={{ color: INK }}>{founderName} · {nl.name}</span>
                    <span className="block text-[11.5px]" style={{ color: FAINT }}>to your subscribers</span>
                  </span>
                  {first && <span className="ml-auto shrink-0 text-[11.5px] tabular-nums" style={{ color: FAINT }}>{fmtDay(first.date)}</span>}
                </div>
                <div className="mt-3 text-[15px] font-semibold leading-snug" style={{ fontFamily: fontStack, color: INK }}>{first?.title || 'Your first issue'}</div>
                {!issueOpen && (
                  <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: DIM, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {snippet}
                  </p>
                )}
                {/* Issue 1 carries a full readable draft — expandable in place. */}
                <AnimatePresence initial={false}>
                  {issueOpen && fullBody && (
                    <motion.div
                      initial={reduce ? false : { opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={reduce ? undefined : { opacity: 0, height: 0 }}
                      transition={{ duration: 0.25, ease: EASE }}
                      className="overflow-hidden"
                    >
                      <div className="mt-2 max-w-[62ch] border-t pt-3" style={{ borderColor: DIVIDE }}>
                        {fullBody.split(/\n\n+/).map((p, i) => (
                          <p key={i} className="mt-3 whitespace-pre-line text-[13.5px] leading-relaxed first:mt-0" style={{ color: '#2b3736' }}>{p}</p>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                {fullBody && (
                  <button
                    onClick={() => setIssueOpen((o) => !o)}
                    className="mt-2.5 inline-flex min-h-[32px] items-center gap-1.5 rounded-[6px] px-2.5 text-[12.5px] font-semibold transition-colors duration-150 hover:bg-[rgba(2,49,47,0.04)]"
                    style={{ color: accent }}
                    aria-expanded={issueOpen}
                  >
                    {issueOpen ? 'Show less' : 'Read the full issue'}
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden style={{ transform: issueOpen ? 'rotate(180deg)' : 'none', transition: 'transform 150ms ease' }}>
                      <path d="M6 9l6 6 6-6" stroke={accent} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Issues */}
      <div className="mb-2 mt-6 px-1 text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: FAINT }}>Upcoming issues</div>
      <div className="overflow-hidden rounded-xl bg-white" style={{ border: `1px solid ${LINE}` }}>
        {issues.map((it, i) => (
          <button
            key={it.id}
            onClick={() => onOpenIssue(it)}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--cb-accent)_2.5%,white)]"
            style={{ borderTop: i > 0 ? `1px solid ${DIVIDE}` : 'none', minHeight: 54 }}
          >
            <Thumb q={{ id: it.id, kind: 'newsletter', stage: 'planned' }} accent={accent} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-medium" style={{ color: INK }}>{it.title}</span>
              <span className="mt-0.5 block text-[10.5px] font-medium uppercase tracking-[0.08em]" style={{ color: FAINT }}>Newsletter</span>
            </span>
            <span className="hidden shrink-0 text-right sm:block">{issueStatus(it)}</span>
          </button>
        ))}
      </div>

      {/* Nurture flow */}
      {nurture.length > 0 && (
        <div className="mt-6 rounded-xl bg-white p-4 sm:p-6" style={{ border: `1px solid ${LINE}` }}>
          <div className={live ? 'mb-1' : 'mb-4'}><CardHead>Inbound leads flow</CardHead></div>
          {/* Live: the step details are written in present tense but the sequence arms with
              the first issue. One short lead-in frames everything below as the plan. */}
          {live && (
            <p className="mb-4 text-[13px]" style={{ fontFamily: BODY, fontStyle: 'italic', color: INK_MUTE }}>The plan, from your first issue on:</p>
          )}
          <div className="flex flex-col sm:flex-row">
            {nurture.map((s, i) => {
              const last = i === nurture.length - 1;
              return (
                <div key={i} className="relative flex gap-3 pb-6 last:pb-0 sm:flex-1 sm:flex-col sm:gap-2.5 sm:pb-0 sm:pr-4 sm:last:pr-0">
                  {i < nurture.length - 1 && (
                    <>
                      <span className="absolute bottom-0 left-[9px] top-6 w-px sm:hidden" style={{ background: LINE }} aria-hidden />
                      <span className="absolute hidden h-px sm:block" style={{ background: LINE, top: 10, left: 28, right: 8 }} aria-hidden />
                    </>
                  )}
                  <span
                    className="relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                    style={last ? { background: accent } : { background: `color-mix(in srgb, ${accent} 16%, white)` }}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path d="M5 13l4 4 10-10" stroke={last ? inkOn(accent) : accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold leading-snug" style={{ color: last ? accent : INK }}>{s.step}</div>
                    {s.detail && <div className="mt-0.5 text-[12px] leading-snug" style={{ color: DIM }}>{s.detail}</div>}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-5 text-[13px]" style={{ color: FAINT }}>
            {live
              ? 'Leads captured by your assessments will feed this list. Yours to keep, exportable anytime.'
              : 'Leads captured by your assessments feed this list automatically. Yours to keep, exportable anytime.'}
          </p>
        </div>
      )}
    </div>
  );
}

// ---------- Performance surface ----------
/** Dashed placeholder sparkline paths — clearly not data, just the shape of the chart to come. */
const PLACEHOLDER_SPARKS = [
  'M0 34 C 20 31, 34 25, 52 27 S 92 33, 112 27 S 152 15, 170 19 S 192 13, 200 11',
  'M0 30 C 18 33, 36 27, 54 29 S 90 21, 112 24 S 150 18, 168 14 S 190 14, 200 12',
  'M0 36 C 22 32, 38 30, 56 31 S 94 25, 114 27 S 148 17, 168 20 S 192 10, 200 12',
  'M0 32 C 20 34, 36 28, 54 26 S 92 30, 112 24 S 150 20, 170 15 S 192 15, 200 10',
];

/** Honest expectation line per indicator — when the number typically starts moving. */
function expectationFor(ind: PerfIndicator): string {
  const l = `${ind.key} ${ind.label}`.toLowerCase();
  if (l.includes('view')) return 'Profile views usually move within the first week of posting.';
  if (l.includes('dm')) return 'First inbound DMs typically follow once posting is consistent.';
  if (l.includes('opt') || l.includes('magnet')) return 'Opt-ins start as soon as your first lead magnet goes live.';
  if (l.includes('call')) return 'Booked calls follow opt-ins as outreach ramps.';
  return 'Tracking starts the day delivery goes live.';
}

// ---------- Leads (engager DM pipeline) ----------
type PipelineStep = { key: string; label: string; done: boolean; current?: boolean };
/** One message in a lead's thread. `from:'lead'` = something they wrote (comment / reply);
 *  `from:'engine'` = a message the pipeline sent (resource DM, follow-up). */
type ThreadMsg = { from: 'lead' | 'engine'; label: string; when?: string; text: string };
type PipelineLead = {
  name: string; role?: string; company?: string; icp: number;
  /** Real profile URL — names on live boards link out, never bare. */
  linkedin_url?: string;
  track: 'handraiser' | 'reactor';
  source: 'comment' | 'optin' | 'like';
  steps: PipelineStep[];
  in_newsletter?: boolean;
  last_touch?: string;
  /** Prospect-record fields (all optional, back-compat). Rendered by LeadDetailModal
   *  as a realistic record: who they are, why the engine flagged them, the signal that
   *  triggered capture, and the queued next warm touch. */
  headline?: string;   // one-line title/tagline, e.g. "Scaling Bloome past $2M in DTC skincare"
  location?: string;   // e.g. "Austin, TX"
  signal?: string;     // what triggered capture (post topic + the commenter's own words)
  why_fit?: string[];  // 1-3 grounded ICP reasons the engine surfaced (real Wins-Builder findings)
  next_action?: { label: string; when: string; text?: string }; // queued next warm touch; omit once they replied
  /** The actual conversation — powers the click-a-lead reveal. */
  thread?: ThreadMsg[];
};

/** Build a step trail from ordered labels + the index the lead has reached. Steps before
 *  the reached index are done; the reached step is current (filled + ring). */
function mkSteps(labels: string[], reached: number): PipelineStep[] {
  return labels.map((label, i) => ({
    key: `${i}-${label}`.toLowerCase().replace(/\s+/g, '-'),
    label,
    done: i < reached,
    current: i === reached,
  }));
}
const HR_STEPS = (first: string) => [first, 'resource sent', 'follow-up', 'replied'];
const RE_STEPS = ['ICP match', 'connect sent', 'connected', 'DM sent', 'follow-up', 'replied'];

/** LABELED example deck — only ever rendered on a demo/preview board, behind the
 *  "example data" chip. A live board renders board.lead_pipeline or a clean empty-state. */
const SAMPLE_LEAD_PIPELINE: PipelineLead[] = [
  { name: 'Marcus Webb', role: 'Founder', company: 'Northbeam Studio', icp: 9, track: 'handraiser', source: 'comment', in_newsletter: true,
    headline: 'Building Northbeam Studio, a boutique brand practice', location: 'Denver, CO',
    signal: 'Commented on your post on where client hand-offs quietly lose hours',
    why_fit: ['Team past ten people, delivery still routes through the founder', 'Hand-off gaps between strategy and production eating margin'],
    steps: mkSteps(HR_STEPS('commented'), 3), thread: [
    { from: 'lead', label: 'commented on your post', when: 'day 0', text: 'This is exactly the problem we keep hitting. Can you send it over?' },
    { from: 'engine', label: 'resource DM', when: 'day 0', text: 'Hey Marcus, here’s the teardown you asked for: [link]. The section on hand-off gaps is the part most teams miss. Happy to walk you through how it maps to Northbeam if useful.' },
    { from: 'engine', label: 'follow-up', when: 'day 2', text: 'Did the framework land? Curious whether the scoring section matched what you’re seeing on your side.' },
    { from: 'lead', label: 'replied', when: 'day 3', text: 'It did, the scoring part especially. We should talk. What does working together look like?' },
  ] },
  { name: 'Dana Okafor', role: 'Head of Ops', company: 'Litmus Legal', icp: 8, track: 'handraiser', source: 'optin', in_newsletter: true,
    headline: 'Head of ops at Litmus Legal, mid-size firm', location: 'Chicago, IL',
    signal: 'Opted into the operations capacity assessment',
    why_fit: ['Ops team stretched, intake and scheduling still manual', 'Growth outpacing the process they built two years ago'],
    next_action: { label: 'follow-up', when: 'day 4', text: 'Dana, did the assessment flag anything on intake? That is usually the first place hours leak once a firm scales. Happy to walk through the weakest-area section on a quick call.' },
    steps: mkSteps(HR_STEPS('opted in'), 2), thread: [
    { from: 'lead', label: 'opted in', when: 'day 0', text: 'Downloaded the assessment.' },
    { from: 'engine', label: 'resource DM', when: 'day 0', text: 'Hi Dana, sent the assessment to your inbox. Question 4 is the one that trips up most ops leads. Let me know what it flagged for you.' },
    { from: 'engine', label: 'follow-up', when: 'day 2', text: 'Any surprises in the results? Happy to unpack the weakest-area section with you.' },
  ] },
  { name: 'Priya Nair', role: 'Managing Partner', company: 'Cedar & Vale', icp: 8, track: 'handraiser', source: 'comment', in_newsletter: true,
    headline: 'Managing partner at Cedar & Vale', location: 'Boston, MA',
    signal: 'Commented on your post on partner-level workflow bottlenecks',
    why_fit: ['Partners still doing work an associate could own', 'Utilization high, senior time is the real constraint'],
    next_action: { label: 'follow-up', when: 'day 5', text: 'Priya, did the partner-workflow piece land? The section on delegating review work is where most firms your size recover senior hours. Glad to compare notes on how Cedar & Vale is structured now.' },
    steps: mkSteps(HR_STEPS('commented'), 2), thread: [
    { from: 'lead', label: 'commented on your post', when: 'day 0', text: 'Would love a copy of this.' },
    { from: 'engine', label: 'resource DM', when: 'day 0', text: 'Here you go, Priya: [link]. The part on partner-level workflows is written for firms like Cedar & Vale.' },
    { from: 'engine', label: 'follow-up', when: 'day 3', text: 'Did it spark anything? Glad to compare notes on how partners are handling this.' },
  ] },
  { name: 'Tom Reilly', role: 'Founder', company: 'Reilly Advisory', icp: 7, track: 'handraiser', source: 'optin', in_newsletter: true,
    headline: 'Founder of Reilly Advisory', location: 'Austin, TX',
    signal: 'Opted into the ROI planning guide',
    why_fit: ['Solo founder scaling into a small team', 'Pricing set before recent cost increases'],
    next_action: { label: 'follow-up', when: 'day 3', text: 'Tom, did the ROI math in the second half hold up against your numbers? If pricing has not moved since costs went up, that is usually the fastest thing to fix. Happy to look at it with you.' },
    steps: mkSteps(HR_STEPS('opted in'), 1), thread: [
    { from: 'lead', label: 'opted in', when: 'day 0', text: 'Downloaded the guide.' },
    { from: 'engine', label: 'resource DM', when: 'day 0', text: 'Hi Tom, the guide’s in your inbox. Start with the second half, that’s where the ROI math is. Shout if anything’s unclear.' },
  ] },
  { name: 'Grace Lin', role: 'Ops Lead', company: 'Vantage Group', icp: 8, track: 'handraiser', source: 'comment',
    headline: 'Ops lead at Vantage Group', location: 'Seattle, WA',
    signal: 'Commented asking for the workflow teardown',
    why_fit: ['Running ops for a growing team', 'Process built for launch, never re-tuned since'],
    next_action: { label: 'resource DM', when: 'day 0', text: 'Grace, sending the teardown now. The middle section on scheduling hand-offs is the part most ops leads bookmark. Curious which stage is costing you the most time right now.' },
    steps: mkSteps(HR_STEPS('commented'), 0), thread: [
    { from: 'lead', label: 'commented on your post', when: 'just now', text: 'Sounds useful, send it my way?' },
  ] },
  { name: 'Elena Vasquez', role: 'VP Marketing', company: 'Summit Partners', icp: 9, track: 'reactor', source: 'like',
    headline: 'VP marketing at Summit Partners', location: 'New York, NY',
    signal: 'Liked your post on attribution across a multi-channel funnel',
    why_fit: ['Marketing team scaling spend across channels', 'Attribution still fuzzy past first touch'],
    steps: mkSteps(RE_STEPS, 5), thread: [
    { from: 'engine', label: 'connection note', when: 'day 0', text: 'Hi Elena, saw you following the thread on attribution. Sending a connect, I think what we’re building is right up Summit’s alley.' },
    { from: 'engine', label: 'DM', when: 'day 1', text: 'Thanks for connecting. Put together a short teardown on the exact problem you were reacting to, want me to send it?' },
    { from: 'lead', label: 'replied', when: 'day 2', text: 'Yes please. And if you have time this week, I’d take a call.' },
  ] },
  { name: 'Sarah Chen', role: 'Head of Growth', company: 'Fathom Consulting', icp: 9, track: 'reactor', source: 'like',
    headline: 'Head of growth at Fathom Consulting', location: 'San Francisco, CA',
    signal: 'Liked your post on building a repeatable growth system',
    why_fit: ['Growth relying on a handful of manual plays', 'No system yet to make the wins repeat'],
    next_action: { label: 'follow-up', when: 'day 5', text: 'Sarah, did the breakdown fit how Fathom runs growth? The second half maps to your stack pretty directly. Want me to tailor it and send the full version?' },
    steps: mkSteps(RE_STEPS, 4), thread: [
    { from: 'engine', label: 'connection note', when: 'day 0', text: 'Hi Sarah, noticed you engaging with the growth-systems posts. Connecting, I think there’s overlap with what Fathom’s working on.' },
    { from: 'engine', label: 'DM', when: 'day 1', text: 'Thanks for the connect. Made a quick breakdown of the workflow you reacted to, sending it over: [link].' },
    { from: 'engine', label: 'follow-up', when: 'day 3', text: 'Did the breakdown help? Happy to tailor the second half to Fathom’s stack.' },
  ] },
  { name: 'Nina Alvarez', role: 'Director', company: 'BrightPath Agency', icp: 8, track: 'reactor', source: 'like',
    headline: 'Director at BrightPath Agency', location: 'Atlanta, GA',
    signal: 'Liked your post on agency delivery bottlenecks',
    why_fit: ['Agency scaling accounts faster than the delivery team', 'Founder still sits in every project'],
    next_action: { label: 'follow-up', when: 'day 4', text: 'Nina, following up on the write-up. The pattern with agencies your size is that delivery capacity caps growth before demand does. I mapped how it plays out for teams like BrightPath. Want it?' },
    steps: mkSteps(RE_STEPS, 3), thread: [
    { from: 'engine', label: 'connection note', when: 'day 0', text: 'Hi Nina, saw you reacting to the agency-ops thread. Sending a connect.' },
    { from: 'engine', label: 'DM', when: 'day 1', text: 'Thanks for connecting. The thing you reacted to, I wrote up how it plays out for agencies like BrightPath. Want it?' },
  ] },
  { name: 'Devon Clarke', role: 'Principal', company: 'Clarke & Co', icp: 7, track: 'reactor', source: 'like',
    headline: 'Principal at Clarke & Co', location: 'Toronto, ON',
    signal: 'Liked your post on where senior hours actually go',
    why_fit: ['Small firm, principal time is the bottleneck', 'Junior team underused on billable work'],
    next_action: { label: 'DM', when: 'day 2', text: 'Devon, thanks for the connect. The thing you reacted to, I wrote up how it applies to firms that run the way Clarke & Co does. Happy to send it over if useful.' },
    steps: mkSteps(RE_STEPS, 2), thread: [
    { from: 'engine', label: 'connection note', when: 'day 0', text: 'Hi Devon, noticed you following the thread. Connecting, I think there’s a fit with how Clarke & Co runs.' },
  ] },
  { name: 'Raj Patel', role: 'Founder', company: 'Meridian Ops', icp: 7, track: 'reactor', source: 'like',
    headline: 'Founder of Meridian Ops', location: 'Phoenix, AZ',
    signal: 'Liked your post on the operations capacity ceiling',
    why_fit: ['Founder-led ops shop at an early scaling stage'],
    next_action: { label: 'connection note', when: 'day 0', text: 'Raj, saw you react to the capacity post. Meridian looks like it is at the stage where process starts to matter. Sending a connect.' },
    steps: mkSteps(RE_STEPS, 0) },
];

const stepFilled = (s: PipelineStep) => s.done;
const isReplied = (s: PipelineStep) => /replied/i.test(s.label) && stepFilled(s);

/** One person's journey as an ordered trail of sharp-square markers + mono labels.
 *  Shared by the row and the detail modal. */
function StepTrail({ steps, accent }: { steps: PipelineStep[]; accent: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {steps.map((s) => {
        const filled = stepFilled(s);
        return (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span
              style={{
                width: 7, height: 7,
                background: filled ? caText(accent) : 'transparent',
                border: filled ? 'none' : `1px solid ${LINE_BOLD}`,
                boxShadow: s.current ? `0 0 0 3px ${caWash(accent, 22)}` : undefined,
              }}
            />
            <span className="uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em', color: s.current ? caText(accent) : s.done ? INK_SOFT : FAINT }}>{s.label}</span>
          </span>
        );
      })}
    </div>
  );
}

/** A clickable lead row. Opens the detail modal with the full message thread. */
function LeadRow({ lead, accent, onOpen, live = false }: { lead: PipelineLead; accent: string; onOpen: (l: PipelineLead) => void; live?: boolean }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(lead)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(lead); } }}
      aria-label={`Open ${lead.name}`}
      className="group -mx-3 block w-full cursor-pointer rounded-lg px-3 py-4 text-left transition-colors duration-150 hover:bg-[rgba(26,26,26,0.03)]"
      style={{ borderTop: `1px solid ${DIVIDE}` }}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {lead.linkedin_url ? (
          <a
            href={lead.linkedin_url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="underline-offset-2 hover:underline"
            style={{ fontFamily: SERIF, fontSize: 17, color: INK }}
          >{lead.name} <span aria-hidden style={{ fontSize: 12, color: FAINT }}>↗</span></a>
        ) : (
          <span style={{ fontFamily: SERIF, fontSize: 17, color: INK }}>{lead.name}</span>
        )}
        <span style={{ fontFamily: BODY, fontSize: 13, color: DIM }}>{[lead.role, lead.company].filter(Boolean).join(' · ')}</span>
        <span className="ml-auto flex items-center gap-2.5">
          {lead.in_newsletter && (
            <span className="inline-flex items-center gap-1.5 uppercase" style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.12em', color: INK_MUTE }}>
              <span style={{ width: 6, height: 6, background: caText(accent) }} />newsletter
            </span>
          )}
          <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.04em', color: caText(accent), border: `1px solid ${caBorder(accent, 40)}`, background: caWash(accent, 6), padding: '2px 6px' }}>{live ? 'Fit' : 'ICP'} {lead.icp}</span>
          {/* Affordance: chevron nudges right on hover so rows read as openable. */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={FAINT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden>
            <path d="M9 6l6 6-6 6" />
          </svg>
        </span>
      </div>
      {(() => {
        // Signal preview: shows the warm context at a glance so the list reads as more
        // than names. Falls back to the first thread line when no signal is set.
        const preview = lead.signal || lead.thread?.[0]?.text;
        return preview ? (
          <div className="mt-1.5 truncate" style={{ fontFamily: BODY, fontSize: 12.5, lineHeight: 1.5, color: FAINT }}>{preview}</div>
        ) : null;
      })()}
      <div className="mt-2.5">
        <StepTrail steps={lead.steps} accent={accent} />
      </div>
    </div>
  );
}

/** Renders a sequence message, styling {curly-brace} fields as unmistakable fill-at-send
 *  chips so nothing on the board reads as a finished, ready-to-fire message. */
function SeqText({ text, accent }: { text: string; accent: string }) {
  const parts = text.split(/(\{[^}]+\})/g);
  return (
    <p className="whitespace-pre-line text-[13px] leading-relaxed" style={{ fontFamily: BODY, color: INK_SOFT }}>
      {parts.map((p, i) =>
        /^\{[^}]+\}$/.test(p) ? (
          <span key={i} className="mx-[1px] rounded px-1 py-[1px]" style={{ fontFamily: MONO, fontSize: 11, color: caText(accent), background: caWash(accent, 8), border: `1px solid ${caBorder(accent, 30)}` }}>{p.slice(1, -1)}</span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </p>
  );
}

/** Numbered section head for the live Leads tab: the outreach program reads as six
 *  numbered chapters instead of a scatter of card titles (mirrors the dashboard nav
 *  hierarchy chunking). */
function LeadsBlockHead({ n, label, sub }: { n: string; label: string; sub?: React.ReactNode }) {
  return (
    <div className="mb-3 mt-9 flex flex-wrap items-baseline gap-x-2.5 gap-y-1 border-b pb-2" style={{ borderColor: LINE_BOLD }}>
      <span className="tabular-nums" style={{ fontFamily: MONO, fontSize: 11, color: INK_MUTE }}>{n}</span>
      <span className="uppercase" style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.16em', color: INK }}>{label}</span>
      {sub && <span style={{ fontFamily: BODY, fontStyle: 'italic', fontSize: 12.5, color: INK_MUTE }}>{sub}</span>}
    </div>
  );
}

function LeadsSurface({ board, accent, preview, onOpen, live = false, usage = null, log = null }: { board: Board; accent: string; preview: boolean; onOpen: (l: PipelineLead) => void; live?: boolean; usage?: OutreachUsage | null; log?: OutreachLogEntry[] | null }) {
  const real = board.lead_pipeline && board.lead_pipeline.length > 0 ? board.lead_pipeline : null;
  const usingSample = !real && preview;
  const leads: PipelineLead[] = real ?? (usingSample ? SAMPLE_LEAD_PIPELINE : []);

  const captured = leads.length;
  const contacted = leads.filter((l) => l.steps.some((s, i) => i > 0 && stepFilled(s))).length;
  const replied = leads.filter((l) => l.steps.some(isReplied)).length;
  const onNewsletter = leads.filter((l) => l.in_newsletter).length;

  const handRaisers = leads.filter((l) => l.track === 'handraiser');
  const reactors = leads.filter((l) => l.track === 'reactor');

  const tiles = [
    { n: captured, l: 'captured' },
    { n: contacted, l: 'contacted' },
    { n: replied, l: 'replied' },
    { n: onNewsletter, l: 'on newsletter' },
  ];

  return (
    <div className="pb-16">
      <div className="mb-7">
        <div className="mb-2.5 flex items-center gap-2.5">
          <span className="uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.22em', color: INK_MUTE }}>capture → pipeline</span>
          {usingSample && (
            <span className="uppercase" style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.14em', color: caText(accent), border: `1px solid ${caBorder(accent, 40)}`, background: caWash(accent, 6), padding: '2px 6px' }}>example data</span>
          )}
        </div>
        <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(29px, 3.4vw, 40px)', lineHeight: 1.06, letterSpacing: '-0.02em', color: INK }}>Leads</h2>
        <p className="mt-3.5 max-w-[62ch]" style={{ fontFamily: BODY, fontSize: 15, lineHeight: 1.62, color: INK_SOFT }}>
          {usingSample
            ? 'Everyone your content pulled in, and where each person sits in the pipeline. These are example leads. Real named people land here the moment your engine goes live.'
            : 'Everyone your content pulled in, and where each person sits in the pipeline. Yours to keep, exportable anytime.'}
        </p>
      </div>

      {/* Outreach program lives on its own first-class Outreach tab now (OutreachSurface).
          This surface renders the captured-leads pipeline only. */}

      {leads.length === 0 ? (
        <div className="rounded-xl px-4 py-10 text-center" style={{ background: PAPER_SUNK, border: `1px dashed ${LINE}` }}>
          <p className="mx-auto max-w-[54ch] text-[13px] leading-relaxed" style={{ color: DIM }}>
            {live
              ? 'Everyone matched to your buyer profile who engages your content lands here. Once your outreach goes live: hand-raisers get the resource and a follow-up; high-fit engagers get a connection request and a DM. Yours to keep.'
              : 'Every ICP-matched person who engages your content lands here. Hand-raisers get the resource and a follow-up; high-fit reactors get a connection request and a DM. Yours to keep.'}
          </p>
        </div>
      ) : (
        <>
          {/* Hairline-gap grid: 1px cell gaps over a line-colored bg read as clean dividers
           *  in both the 4-col desktop row and the 2-col mobile wrap — no per-cell borders. */}
          <div className="mb-9 grid grid-cols-2 gap-px overflow-hidden rounded-xl sm:grid-cols-4" style={{ background: LINE, border: `1px solid ${LINE}` }}>
            {tiles.map((m) => (
              <div key={m.l} className="bg-white px-5 py-4">
                <div style={{ fontFamily: SERIF, fontSize: 30, lineHeight: 1, color: INK }}>{m.n}</div>
                <div className="mt-1.5 uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.16em', color: INK_MUTE }}>{m.l}</div>
              </div>
            ))}
          </div>

          {handRaisers.length > 0 && (
            <section className="mb-9">
              <div className="mb-1 flex items-baseline gap-2.5 border-b pb-2" style={{ borderColor: LINE_BOLD }}>
                <span className="uppercase" style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.16em', color: INK }}>hand-raisers</span>
                <span className="tabular-nums" style={{ fontFamily: MONO, fontSize: 11, color: caText(accent) }}>{handRaisers.length}</span>
                <span style={{ fontFamily: BODY, fontSize: 12.5, color: FAINT }}>commented or opted in, they asked for it</span>
              </div>
              {handRaisers.map((l) => <LeadRow key={l.name} lead={l} accent={accent} onOpen={onOpen} live={live} />)}
            </section>
          )}

          {reactors.length > 0 && (
            <section>
              <div className="mb-1 flex items-baseline gap-2.5 border-b pb-2" style={{ borderColor: LINE_BOLD }}>
                <span className="uppercase" style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.16em', color: INK }}>{live ? 'High-fit engagers' : 'ICP reactors'}</span>
                <span className="tabular-nums" style={{ fontFamily: MONO, fontSize: 11, color: caText(accent) }}>{reactors.length}</span>
                <span style={{ fontFamily: BODY, fontSize: 12.5, color: FAINT }}>{live ? 'engaged your post, pending your review' : 'engaged your post, we reached out'}</span>
              </div>
              {reactors.map((l) => <LeadRow key={l.name} lead={l} accent={accent} onOpen={onOpen} live={live} />)}
            </section>
          )}
        </>
      )}
    </div>
  );
}

/** Plain send-status pill. Green "Live" when messages are actually going out, grey
 *  "Sending paused" when nothing is moving. No jargon — a client word for the state. */
function SendStatusPill({ live, accent }: { live: boolean; accent: string }) {
  return live ? (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 uppercase" style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.12em', color: inkOn(accent), background: caText(accent) }}>
      <span className="h-[6px] w-[6px] rounded-full" style={{ background: inkOn(accent) }} aria-hidden />
      Live
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 uppercase" style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.12em', color: '#5c5c5c', background: '#ececea', border: '1px solid #dcdcd8' }}>
      <span className="h-[6px] w-[6px] rounded-full" style={{ background: '#9a9a96' }} aria-hidden />
      Sending paused
    </span>
  );
}

/** Outreach surface (live boards): the send program on its own first-class tab — this
 *  month's allowance, the bar, the sources, the message sequences, the first list, the
 *  inbox, the client-engager play, orbit finds, and the live send log. Reads usage + the
 *  per-lead send log from live RPCs; nothing here is baked pipeline JSON. */
function OutreachSurface({ board, accent, usage = null, log = null }: { board: Board; accent: string; usage?: OutreachUsage | null; log?: OutreachLogEntry[] | null }) {
  const o = board.outreach;
  if (!o) {
    return (
      <div className="pb-16">
        <div className="rounded-xl px-4 py-10 text-center" style={{ background: PAPER_SUNK, border: `1px dashed ${LINE}` }}>
          <p className="mx-auto max-w-[54ch] text-[13px] leading-relaxed" style={{ color: DIM }}>Your outreach program lands here once it is set up.</p>
        </div>
      </div>
    );
  }
  // Hide any retired / no-ratified-sequence source (e.g. the dead Network Activation
  // path) from the client view. Same filter on the message sequences so a dead source
  // never surfaces a message-less shell.
  const lanes = (o.lanes || []).filter((ln) => !isDeadLane(ln.name, ln.status, ln.arms));
  const seqChannels = (o.sequences?.channels || []).filter((ch) => !isDeadLane(ch.name));
  // Plain send state: green "Live" the moment real sends show up (usage counts or a send
  // log entry), grey "Sending paused" until then. Honest — nothing sends until go-live.
  const sendingLive = (log != null && log.length > 0) || (usage != null && (usage.connect_sent > 0 || usage.dm_sent > 0 || usage.inmail_used > 0));

  return (
    <div className="pb-16">
      <div className="mb-7">
        <div className="mb-2.5 flex flex-wrap items-center gap-2.5">
          <span className="uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.22em', color: INK_MUTE }}>who we reach, and how</span>
          <SendStatusPill live={sendingLive} accent={accent} />
        </div>
        <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(29px, 3.4vw, 40px)', lineHeight: 1.06, letterSpacing: '-0.02em', color: INK }}>Outreach</h2>
        <p className="mt-3.5 max-w-[62ch]" style={{ fontFamily: BODY, fontSize: 15, lineHeight: 1.62, color: INK_SOFT }}>
          {o.note || 'Who your engine reaches out to on your behalf, the exact messages it sends, and every send once it goes out. Nothing sends until your written go.'}
        </p>
      </div>

      <section className="mb-10">
        {/* This month's send allowance — real counts from the send log, caps from
            config. Honest zero until the engine sends; never a fabricated figure. */}
        {usage && (
          <div className="mb-8">
            <LeadsBlockHead n="00" label="this month" sub="your RISE DTC send allowance" />
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { big: `${usage.inmail_remaining}`, unit: 'left', lbl: 'InMails remaining this month', sub: `${usage.inmail_used} sent of ${usage.inmail_cap}`, hot: usage.inmail_remaining <= 5 },
                { big: `${usage.connect_sent}`, unit: `of ${usage.connect_cap}`, lbl: 'Connection requests', sub: `${usage.connect_cap - usage.connect_sent} left this month`, hot: false },
                { big: `${usage.dm_sent}`, unit: 'sent', lbl: 'DMs sent this month', sub: usage.dm_sent === 0 ? 'none sent yet' : 'follow-ups to accepts', hot: false },
              ].map((t) => (
                <div key={t.lbl} className="rounded-xl bg-white p-4" style={{ border: `1px solid ${LINE}` }}>
                  <div className="flex items-baseline gap-1.5">
                    <span className="tabular-nums" style={{ fontFamily: SERIF, fontSize: 34, lineHeight: 1, color: t.hot ? caText(accent) : INK }}>{t.big}</span>
                    <span className="uppercase" style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.12em', color: INK_MUTE }}>{t.unit}</span>
                  </div>
                  <div className="mt-2 text-[12.5px] font-semibold leading-snug" style={{ color: INK }}>{t.lbl}</div>
                  <div className="mt-1 text-[11.5px]" style={{ fontFamily: BODY, color: DIM }}>{t.sub}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 01 — The bar: who qualifies. */}
        {o.icp && (<>
          <LeadsBlockHead n="01" label="the bar" sub={o.icp.label} />
          <div className="rounded-xl bg-white p-4 sm:p-5" style={{ border: `1px solid ${LINE}` }}>
            {(o.icp.bar || []).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {(o.icp.bar || []).map((b) => (
                  <span key={b} className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-medium" style={{ border: `1px solid ${LINE}`, background: caWash(accent, 5), color: INK }}>
                    <span className="h-[5px] w-[5px] shrink-0" style={{ background: caText(accent) }} aria-hidden />
                    {b}
                  </span>
                ))}
              </div>
            )}
            {o.icp.note && <p className="mt-3 text-[12.5px]" style={{ fontFamily: BODY, fontStyle: 'italic', color: INK_MUTE }}>{o.icp.note}</p>}
          </div>
        </>)}

        {/* 02 — The sources people come from. Counts are real or absent. Send state lives
            in the header pill, so no per-source status stamp here. */}
        {lanes.length > 0 && (<>
          <LeadsBlockHead n="02" label="the sources" />
          <div className="grid gap-3 sm:grid-cols-2">
            {lanes.map((ln) => (
              <div key={ln.key || ln.name} className="rounded-xl bg-white p-4" style={{ border: `1px solid ${LINE}` }}>
                <div className="text-[13.5px] font-semibold leading-snug" style={{ color: INK }}>{ln.name}</div>
                {(typeof ln.count === 'number' || typeof ln.scanned === 'number') && (
                  <div className="mt-2.5 flex items-baseline gap-4">
                    {typeof ln.count === 'number' && (
                      <span className="flex items-baseline gap-1.5">
                        <span className="tabular-nums" style={{ fontFamily: SERIF, fontSize: 26, lineHeight: 1, color: INK }}>{ln.count}</span>
                        <span className="uppercase" style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.12em', color: INK_MUTE }}>counted</span>
                      </span>
                    )}
                    {typeof ln.scanned === 'number' && (
                      <span className="flex items-baseline gap-1.5">
                        <span className="tabular-nums" style={{ fontFamily: SERIF, fontSize: 26, lineHeight: 1, color: INK }}>{ln.scanned}</span>
                        <span className="uppercase" style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.12em', color: INK_MUTE }}>reviewed</span>
                      </span>
                    )}
                    {typeof ln.fits === 'number' && (
                      <span className="flex items-baseline gap-1.5">
                        <span className="tabular-nums" style={{ fontFamily: SERIF, fontSize: 26, lineHeight: 1, color: caText(accent) }}>{ln.fits}</span>
                        <span className="uppercase" style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.12em', color: INK_MUTE }}>fits</span>
                      </span>
                    )}
                  </div>
                )}
                {ln.detail && <p className="mt-2 text-[12.5px] leading-relaxed" style={{ color: DIM }}>{ln.detail}</p>}
              </div>
            ))}
          </div>
        </>)}

        {/* 03 — Per-channel sequences: the actual messages each source sends, cold vs warm. */}
        {o.sequences && seqChannels.length > 0 && (<>
          <LeadsBlockHead n="03" label="the sequences" sub="message by message" />
          <div className="rounded-xl bg-white p-4 sm:p-5" style={{ border: `1px solid ${LINE}` }}>
            {o.sequences.note && <p className="text-[12.5px]" style={{ fontFamily: BODY, fontStyle: 'italic', color: INK_MUTE }}>{o.sequences.note}</p>}
            <div className="mt-4 space-y-2.5">
              {seqChannels.map((ch) => (
                <details key={ch.key || ch.name} className="group rounded-lg" style={{ background: PAPER_SUNK, border: `1px solid ${LINE}` }}>
                  <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-2.5 gap-y-1 rounded-lg p-4 transition-colors duration-150 hover:bg-[rgba(2,49,47,0.03)] [&::-webkit-details-marker]:hidden">
                    <span className="text-[13px] font-semibold" style={{ color: INK }}>{ch.name}</span>
                    {ch.badge && <span className="uppercase" style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.12em', color: INK_MUTE }}>{ch.badge}</span>}
                    <span className="ml-auto shrink-0" style={{ fontFamily: MONO, fontSize: 10, color: FAINT }}>{ch.steps.length} {ch.steps.length === 1 ? 'message' : 'messages'} <span className="inline-block transition-transform duration-150 group-open:rotate-90">→</span></span>
                  </summary>
                  <div className="px-4 pb-4">
                  <div className="mb-2 uppercase" style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.1em', color: FAINT }}>Nothing sends until your written go.</div>
                  {ch.gate && (
                    <p className="mb-2 rounded px-2.5 py-1.5 text-[12px] leading-snug" style={{ color: '#8a6d1a', background: '#faf5e6', border: '1px solid #eadfb4' }}>{ch.gate}</p>
                  )}
                  {ch.note && <p className="text-[12px] leading-snug" style={{ color: DIM }}>{ch.note}</p>}
                  <div className="mt-3 space-y-3">
                    {ch.steps.map((st, i) => (
                      <div key={i} className="rounded-lg bg-white p-3.5" style={{ border: `1px solid ${LINE}` }}>
                        <div className="mb-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span className="text-[11px] font-medium uppercase tracking-[0.08em]" style={{ color: FAINT }}>{st.label}</span>
                          {st.when && <span style={{ fontFamily: MONO, fontSize: 9, color: FAINT }}>{st.when}</span>}
                        </div>
                        <SeqText text={st.text} accent={accent} />
                        {st.flag && (
                          <div className="mt-2 flex items-start gap-1.5 rounded px-2 py-1.5" style={{ background: '#faf5e6', border: '1px solid #eadfb4' }}>
                            <span aria-hidden style={{ color: '#8a6d1a', fontSize: 11, lineHeight: 1.4 }}>⚑</span>
                            <span className="text-[11.5px] leading-snug" style={{ color: '#8a6d1a' }}>{st.flag}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  </div>
                </details>
              ))}
            </div>
          </div>
        </>)}

        {/* 04 — Named candidate list: real sourced people. */}
        {o.candidates && (o.candidates.groups || []).length > 0 && (<>
          <LeadsBlockHead n="04" label="the first list" sub="name by name" />
          <div className="rounded-xl bg-white p-4 sm:p-5" style={{ border: `1px solid ${LINE}` }}>
            {o.candidates.note && <p className="text-[12.5px]" style={{ fontFamily: BODY, fontStyle: 'italic', color: INK_MUTE }}>{o.candidates.note}</p>}
            <div className="mt-4 space-y-2.5">
              {o.candidates.groups.map((g, gi) => (
                <details key={g.key || g.name} open={gi === 0} className="group rounded-lg" style={{ border: `1px solid ${LINE}` }}>
                  <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-2.5 gap-y-1 rounded-lg p-3.5 transition-colors duration-150 hover:bg-[rgba(2,49,47,0.03)] [&::-webkit-details-marker]:hidden">
                    <span className="text-[13px] font-semibold" style={{ color: INK }}>{g.name}</span>
                    {g.badge && <span className="uppercase" style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.12em', color: INK_MUTE }}>{g.badge}</span>}
                    <span className="ml-auto shrink-0" style={{ fontFamily: MONO, fontSize: 10, color: FAINT }}>{g.items.length} names <span className="inline-block transition-transform duration-150 group-open:rotate-90">→</span></span>
                  </summary>
                  <div className="px-3.5 pb-3.5">
                  {g.note && <p className="text-[12px] leading-snug" style={{ color: DIM }}>{g.note}</p>}
                  <div className="mt-1">
                    {g.items.map((it) => (
                      <div key={it.name + (it.company || '')} className="-mx-2 flex flex-col gap-x-3 gap-y-0.5 rounded-md border-t px-2 py-2 transition-colors duration-150 hover:bg-[rgba(2,49,47,0.03)] sm:flex-row sm:items-baseline" style={{ borderColor: DIVIDE }}>
                        {it.linkedin_url ? (
                          <a
                            href={it.linkedin_url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="shrink-0 text-[13px] font-semibold underline-offset-2 hover:underline sm:w-44"
                            style={{ color: INK }}
                          >{it.name} <span aria-hidden style={{ color: FAINT }}>↗</span></a>
                        ) : (
                          <span className="shrink-0 text-[13px] font-semibold sm:w-44" style={{ color: INK }}>{it.name}</span>
                        )}
                        <span className="min-w-0 flex-1 text-[12.5px] leading-snug" style={{ color: DIM }}>
                          {[it.role, it.company].filter(Boolean).join(' · ')}
                          {it.domain && <> · <span style={{ fontFamily: MONO, fontSize: 11 }}>{it.domain}</span></>}
                        </span>
                        {it.note && <span className="shrink-0 text-[11px]" style={{ fontFamily: MONO, color: FAINT }}>{it.note}</span>}
                      </div>
                    ))}
                  </div>
                  </div>
                </details>
              ))}
            </div>
          </div>
        </>)}

        {/* 05 — Conversation inbox: real threads once the seat connects. */}
        {o.chats && (o.chats.threads || []).length > 0 && (<>
          <LeadsBlockHead
            n="05"
            label="the inbox"
            sub={o.chats.mock ? (
              <span className="inline-flex items-center px-2 py-0.5 uppercase not-italic" style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.12em', color: '#8a6d1a', border: '1px solid #d9c17a', background: '#faf5e6' }}>example · goes live when LinkedIn connects</span>
            ) : undefined}
          />
          <div className="rounded-xl bg-white p-4 sm:p-5" style={{ border: `1px solid ${LINE}` }}>
            <div className="grid gap-3 lg:grid-cols-2">
              {o.chats.threads.map((th, i) => (
                <div key={i} className="rounded-lg p-3.5" style={{ background: PAPER_SUNK, border: `1px solid ${LINE}`, opacity: o.chats!.mock ? 0.85 : 1 }}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                    <span className="text-[13px] font-semibold" style={{ color: INK }}>
                      {th.name}{th.company ? <span style={{ color: DIM, fontWeight: 400 }}> · {th.company}</span> : null}
                    </span>
                    <span className="flex items-baseline gap-2">
                      <span className="uppercase" style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.12em', color: INK_MUTE, border: `1px solid ${LINE}`, padding: '1px 6px' }}>{th.lane}</span>
                      {th.last_when && <span style={{ fontFamily: MONO, fontSize: 9, color: FAINT }}>{th.last_when}</span>}
                    </span>
                  </div>
                  <div className="mt-2.5 space-y-2">
                    {th.messages.map((m, j) => (
                      <div key={j} className={m.from === 'you' ? 'flex justify-end' : 'flex'}>
                        <div className="max-w-[85%] rounded-lg px-3 py-2" style={{ background: m.from === 'you' ? caWash(accent, 8) : '#fff', border: `1px solid ${LINE}` }}>
                          <p className="whitespace-pre-line text-[12.5px] leading-relaxed" style={{ fontFamily: BODY, color: INK_SOFT }}>{m.text}</p>
                          {m.when && <div className="mt-1 text-right" style={{ fontFamily: MONO, fontSize: 8.5, color: FAINT }}>{m.when}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>)}

        {/* 06 — Client orbit: brand, your contact, and where the scan stands. */}
        {o.orbit_plan && (() => {
          const op = o.orbit_plan!;
          return (<>
            <LeadsBlockHead n="06" label="client engager" sub="warm intros through brands you already serve" />
            <div className="rounded-xl bg-white p-4 sm:p-5" style={{ border: `1px solid ${LINE}` }}>
              {op.note && <p className="text-[12.5px]" style={{ fontFamily: BODY, fontStyle: 'italic', color: INK_MUTE }}>{op.note}</p>}
              {(op.seeds || []).length > 0 && (
                <div className="mt-4">
                  <div className="mb-1.5 uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.18em', color: INK_MUTE }}>the brands you serve</div>
                  {(op.seeds || []).map((s) => {
                    const [brand, person] = s.name.split(/\s*·\s*/);
                    return (
                      <div key={s.name} className="grid gap-x-4 gap-y-0.5 border-t py-2.5 sm:grid-cols-[220px_1fr]" style={{ borderColor: DIVIDE }}>
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-semibold" style={{ color: INK }}>{brand}</span>
                          {person && <span className="block truncate text-[12px]" style={{ color: DIM }}>{person} · your contact there</span>}
                        </span>
                        {s.status && <span className="text-[12.5px] leading-relaxed" style={{ color: DIM }}>{s.status}</span>}
                      </div>
                    );
                  })}
                </div>
              )}
              {(op.touches || []).length > 0 && (
                <div className="mt-4">
                  <div className="mb-1.5 uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.18em', color: INK_MUTE }}>the three touches</div>
                  {(op.touches || []).map((t) => (
                    <div key={t.label} className="flex gap-3 border-t py-2" style={{ borderColor: DIVIDE }}>
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center bg-white" style={{ border: `1px solid ${LINE_BOLD}` }}>
                        <span style={{ fontFamily: MONO, fontSize: 9, color: INK_MUTE }}>{t.label}</span>
                      </span>
                      <span className="text-[12.5px] leading-relaxed" style={{ color: DIM }}>{t.text}</span>
                    </div>
                  ))}
                </div>
              )}
              {(op.samples || []).length > 0 && (
                <div className="mt-4">
                  <div className="mb-2 uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.18em', color: INK_MUTE }}>sample messages, in your voice</div>
                  <div className="grid gap-3 lg:grid-cols-2">
                    {(op.samples || []).map((sm, i) => (
                      <div key={i} className="rounded-lg p-3.5" style={{ background: PAPER_SUNK, border: `1px solid ${LINE}` }}>
                        {sm.label && <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em]" style={{ color: FAINT }}>{sm.label}</div>}
                        <p className="whitespace-pre-line text-[13px] leading-relaxed" style={{ fontFamily: BODY, color: INK_SOFT }}>{sm.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>);
        })()}

        {/* 07 — Orbit finds: real people pulled from the client's orbit scans. */}
        {o.orbit_finds && (o.orbit_finds.people || []).length > 0 && (<>
          <LeadsBlockHead n="07" label="orbit finds" sub="pending your review" />
          <div className="rounded-xl bg-white p-4 sm:p-5" style={{ border: `1px solid ${LINE}` }}>
            {o.orbit_finds.note && <p className="text-[12.5px]" style={{ fontFamily: BODY, fontStyle: 'italic', color: INK_MUTE }}>{o.orbit_finds.note}</p>}
            <div className="mt-3">
              {o.orbit_finds.people.map((p) => (
                <div key={p.name + (p.company || '')} className="grid gap-x-4 gap-y-1 border-t py-3 sm:grid-cols-[210px_1fr]" style={{ borderColor: DIVIDE }}>
                  <span className="min-w-0">
                    {p.linkedin_url ? (
                      <a href={p.linkedin_url} target="_blank" rel="noreferrer" className="block truncate text-[13px] font-semibold underline-offset-2 hover:underline" style={{ color: INK }}>{p.name} <span aria-hidden style={{ color: FAINT }}>↗</span></a>
                    ) : (
                      <span className="block truncate text-[13px] font-semibold" style={{ color: INK }}>{p.name}</span>
                    )}
                    <span className="block truncate text-[12px]" style={{ color: DIM }}>
                      {[p.role, p.company].filter(Boolean).join(' · ')}
                      {p.domain && <> · <span style={{ fontFamily: MONO, fontSize: 11 }}>{p.domain}</span></>}
                    </span>
                  </span>
                  <span className="min-w-0">
                    {p.one_liner && <span className="block text-[12.5px] leading-snug" style={{ color: INK_SOFT }}>{p.one_liner}</span>}
                    {p.caveat && (
                      <span className="mt-1 inline-flex items-start gap-1.5 text-[11.5px] leading-snug" style={{ color: '#8a6d1a' }}>
                        <span aria-hidden>⚑</span>{p.caveat}
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 uppercase" style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.12em', color: FAINT }}>Nothing queued or sent. Pulled for your review only.</p>
          </div>
        </>)}

        {/* 08 — Send log: the real per-lead outbound trail + reply status, read live from
            outreach_messages (never baked JSON). Honest empty until sends go live. */}
        <LeadsBlockHead n="08" label="send log" sub="every message actually sent, from the live record" />
        <div className="rounded-xl bg-white p-4 sm:p-5" style={{ border: `1px solid ${LINE}` }}>
          {(!log || log.length === 0) ? (
            <p className="text-[12.5px] leading-relaxed" style={{ fontFamily: BODY, color: INK_MUTE }}>
              Nothing sent yet. Every DM and InMail the engine sends on your behalf lands here the moment sends go live, with the date it went out and whether they replied. This reads the live send record, not a sample.
            </p>
          ) : (
            <div className="space-y-2.5">
              {log.map((entry) => {
                const sent = (entry.messages || []).filter((m) => m.direction === 'outbound');
                return (
                  <details key={entry.prospect_id} className="group rounded-lg" style={{ background: PAPER_SUNK, border: `1px solid ${LINE}` }}>
                    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-2.5 gap-y-1 rounded-lg p-3.5 transition-colors duration-150 hover:bg-[rgba(2,49,47,0.03)] [&::-webkit-details-marker]:hidden">
                      <span className="text-[13px] font-semibold" style={{ color: INK }}>{entry.name || '(unnamed)'}</span>
                      {entry.company && <span className="text-[12px]" style={{ color: DIM }}>{entry.company}</span>}
                      {entry.lane && <span className="uppercase" style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.12em', color: INK_MUTE, border: `1px solid ${LINE}`, padding: '1px 6px' }}>{entry.lane}</span>}
                      {entry.replied && <span className="uppercase" style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.12em', color: inkOn(accent), background: caText(accent), padding: '2px 6px' }}>replied</span>}
                      <span className="ml-auto shrink-0" style={{ fontFamily: MONO, fontSize: 10, color: FAINT }}>{sent.length} sent <span className="inline-block transition-transform duration-150 group-open:rotate-90">→</span></span>
                    </summary>
                    <div className="space-y-2 px-3.5 pb-3.5">
                      {sent.map((m, i) => (
                        <div key={i} className="rounded-lg bg-white p-3" style={{ border: `1px solid ${LINE}` }}>
                          <div className="mb-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                            <span className="uppercase" style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.1em', color: caText(accent) }}>→ sent</span>
                            <span style={{ fontFamily: MONO, fontSize: 9.5, color: FAINT }}>{[m.type, m.channel].filter(Boolean).join(' · ')}{m.sent_at ? ` · ${fmtSchedLA(m.sent_at)}` : ''}</span>
                          </div>
                          {m.text && <p className="whitespace-pre-line text-[12.5px] leading-relaxed" style={{ fontFamily: BODY, color: INK_SOFT }}>{m.text}</p>}
                        </div>
                      ))}
                      {entry.replied && (
                        <div className="text-[11.5px]" style={{ fontFamily: MONO, color: caText(accent) }}>
                          Replied{entry.last_reply_at ? ` · ${fmtSchedLA(entry.last_reply_at)}` : ''}
                        </div>
                      )}
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

/** Click-a-lead reveal: the person's journey + the actual message thread the pipeline
 *  ran. Engine-sent messages carry the accent rule; the lead's own words stay neutral. */
function LeadDetailModal({ lead, accent, onClose, live = false }: { lead: PipelineLead; accent: string; onClose: () => void; live?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  const first = (lead.name.split(/\s+/)[0]) || lead.name;
  const trackLabel = lead.track === 'handraiser' ? 'hand-raiser' : (live ? 'high-fit engager' : 'ICP reactor');
  const thread = lead.thread || [];
  const hasReplied = lead.steps.some(isReplied);
  const whyFit = lead.why_fit || [];
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="relative mx-auto my-0 flex min-h-full w-full max-w-lg flex-col bg-white sm:my-16 sm:min-h-0 sm:rounded-xl" style={{ boxShadow: '0 30px 80px rgba(2,32,32,.32)' }}>
        <div className="flex items-center gap-2.5 px-5 pb-3 pt-5 sm:px-6 sm:pt-6">
          <span className="uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.2em', color: INK_MUTE }}>Lead</span>
          <span style={{ fontFamily: MONO, fontSize: 11, color: caText(accent) }}>{trackLabel}</span>
          <button onClick={onClose} aria-label="Close" className="ml-auto flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-150 hover:bg-[rgba(2,49,47,0.05)]">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" stroke={DIM} strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="px-5 pb-6 sm:px-6">
          {/* Profile header: avatar (accent-filled, sharp in blackbox / rounded in editorial
           *  via the skin auto-reset) + name + headline + location, reads as a real record. */}
          <div className="flex items-start gap-3.5">
            <span
              className="flex shrink-0 items-center justify-center rounded-lg"
              style={{ width: 46, height: 46, background: accent, color: inkOn(accent), fontFamily: MONO, fontWeight: 700, fontSize: 15, letterSpacing: '0.02em' }}
              aria-hidden
            >
              {initialsOf(lead.name)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 style={{ fontFamily: SERIF, fontSize: 25, lineHeight: 1.14, letterSpacing: '-0.01em', color: INK }}>
                  {lead.linkedin_url
                    ? <a href={lead.linkedin_url} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">{lead.name} <span aria-hidden style={{ fontSize: 13, color: FAINT }}>↗</span></a>
                    : lead.name}
                </h3>
                <span style={{ fontFamily: BODY, fontSize: 13.5, color: DIM }}>{[lead.role, lead.company].filter(Boolean).join(' · ')}</span>
              </div>
              {lead.headline && (
                <p className="mt-1" style={{ fontFamily: BODY, fontSize: 14, lineHeight: 1.5, color: DIM }}>{lead.headline}</p>
              )}
              {lead.location && (
                <div className="mt-1.5 uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em', color: FAINT }}>{lead.location}</div>
              )}
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2.5">
            <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.04em', color: caText(accent), border: `1px solid ${caBorder(accent, 40)}`, background: caWash(accent, 6), padding: '2px 6px' }}>{live ? 'Fit' : 'ICP'} {lead.icp}</span>
            {lead.in_newsletter && (
              <span className="inline-flex items-center gap-1.5 uppercase" style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.12em', color: INK_MUTE }}>
                <span style={{ width: 6, height: 6, background: caText(accent) }} />newsletter
              </span>
            )}
          </div>

          {/* Why the engine flagged them: the grounded ICP findings, sharp-square accent ticks. */}
          {whyFit.length > 0 && (
            <div className="mt-6">
              <div className="mb-2.5 uppercase" style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.16em', color: INK_MUTE }}>why they're here</div>
              <ul className="flex flex-col gap-2">
                {whyFit.map((w, i) => (
                  <li key={i} className="flex gap-2.5">
                    <span className="mt-[7px] shrink-0" style={{ width: 6, height: 6, background: caText(accent) }} aria-hidden />
                    <span style={{ fontFamily: BODY, fontSize: 13.5, lineHeight: 1.55, color: INK_SOFT }}>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Signal: the one line that triggered capture. */}
          {lead.signal && (
            <div className="mt-6">
              <div className="mb-1.5 uppercase" style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.16em', color: INK_MUTE }}>signal</div>
              <p style={{ fontFamily: BODY, fontSize: 13.5, lineHeight: 1.55, color: INK_SOFT }}>{lead.signal}</p>
            </div>
          )}

          <div className="mt-6">
            <StepTrail steps={lead.steps} accent={accent} />
          </div>

          <div className="mt-6 border-t pt-5" style={{ borderColor: DIVIDE }}>
            {thread.length > 0 ? (
              <>
                <div className="mb-4 uppercase" style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.16em', color: INK_MUTE }}>the conversation</div>
                <div className="flex flex-col gap-4">
                  {thread.map((m, i) => {
                    const isEngine = m.from === 'engine';
                    return (
                      <div key={i} className="relative pl-4">
                        <span className="absolute bottom-1 left-0 top-1" style={{ width: 2, background: isEngine ? caText(accent) : LINE_BOLD }} aria-hidden />
                        <div className="flex items-center gap-1.5">
                          {isEngine && <span style={{ width: 6, height: 6, background: caText(accent) }} aria-hidden />}
                          <span className="uppercase" style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.13em', color: isEngine ? caText(accent) : INK_MUTE }}>
                            {isEngine ? `sent · ${m.label}` : `${first} · ${m.label}`}{m.when ? ` · ${m.when}` : ''}
                          </span>
                        </div>
                        <p className="mt-1.5" style={{ fontFamily: BODY, fontSize: 14, lineHeight: 1.6, color: INK_SOFT }}>{m.text}</p>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-5 text-[12px] leading-relaxed" style={{ fontFamily: BODY, color: FAINT }}>
                  Every message marked <span style={{ color: caText(accent) }}>sent</span> went out as part of the cadence. When someone replies, the thread pauses here for you.
                </p>
              </>
            ) : (
              <div className="rounded-[10px] p-4" style={{ background: PAPER_SUNK, border: `1px solid ${LINE}` }}>
                <p style={{ fontFamily: BODY, fontSize: 13.5, lineHeight: 1.6, color: INK_SOFT }}>
                  {first} just entered the queue. The conversation shows up here once outreach starts.
                </p>
              </div>
            )}
          </div>

          {/* Next: either the drafted upcoming touch (ghost/pending engine message, dashed
           *  rule + reduced emphasis so it reads as not-yet-sent) or, once they replied, a
           *  quiet hand-raiser cue. Reinforces "the engine keeps working each lead." */}
          {hasReplied ? (
            <div className="mt-6 flex items-center gap-2.5 rounded-[10px] px-4 py-3" style={{ background: caWash(accent, 7), border: `1px solid ${caBorder(accent, 35)}` }}>
              <span className="shrink-0" style={{ width: 7, height: 7, background: caText(accent) }} aria-hidden />
              <span style={{ fontFamily: BODY, fontSize: 13.5, lineHeight: 1.5, color: INK_SOFT }}>
                <span className="uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.12em', color: caText(accent) }}>hand-raiser</span>
                {' '}ready for you. {first} replied, so the cadence pauses here for your call.
              </span>
            </div>
          ) : lead.next_action ? (
            <div className="mt-6">
              <div className="mb-2 flex items-center gap-2">
                <span className="uppercase" style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.16em', color: INK_MUTE }}>next · queued</span>
                <span className="uppercase" style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.1em', color: FAINT }}>{lead.next_action.label} · {lead.next_action.when}</span>
              </div>
              <div className="relative pl-4" style={{ opacity: 0.82 }}>
                <span className="absolute bottom-1 left-0 top-1" style={{ width: 2, borderLeft: `2px dashed ${caBorder(accent, 55)}` }} aria-hidden />
                {lead.next_action.text ? (
                  <p style={{ fontFamily: BODY, fontStyle: 'italic', fontSize: 14, lineHeight: 1.6, color: INK_SOFT }}>{lead.next_action.text}</p>
                ) : (
                  <p style={{ fontFamily: BODY, fontSize: 13.5, lineHeight: 1.6, color: DIM }}>Drafted and waiting on the cadence.</p>
                )}
                <div className="mt-1.5 uppercase" style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.13em', color: FAINT }}>awaiting the cadence · not sent yet</div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PerformanceSurface({ board, accent, live = false }: { board: Board; accent: string; live?: boolean }) {
  const perf = board.performance;
  const updates = board.engine_updates || [];
  const indicators = perf?.indicators || [];
  const outreachInds = perf?.outreach_indicators || [];
  const posts = (perf?.posts || []).slice(0, 20);
  const fmtNum = (n?: number | null) => (n === null || n === undefined ? '—' : n.toLocaleString());
  // Shared ghost card: awaiting-first-data treatment, identical for both groups. The
  // content group keeps its per-indicator expectation line; outreach carries one group note.
  const ghostCard = (ind: PerfIndicator, i: number, expectation?: string) => (
    <div key={ind.key} className="rounded-xl bg-white p-4 sm:p-5" style={{ boxShadow: CARD_SHADOW }}>
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-[13.5px] font-semibold leading-snug" style={{ color: INK }}>{ind.label}</div>
        {ind.source && <div className="shrink-0 text-[11px]" style={{ color: FAINT }}>from {ind.source}</div>}
      </div>
      {/* Ghost placeholder rule: shows a value WILL live here, unmistakably not data. */}
      <div className="mt-4 mb-1 select-none" style={{ width: 26, height: 3, background: '#e2e8f0' }} aria-hidden />
      <div className="mt-2 uppercase" style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.14em', color: '#c9d3d1' }} aria-hidden>awaiting first data</div>
      <svg viewBox="0 0 200 44" className="mt-3 h-11 w-full" preserveAspectRatio="none" aria-hidden>
        <path
          d={PLACEHOLDER_SPARKS[i % PLACEHOLDER_SPARKS.length]}
          fill="none" stroke="#c9d3d1" strokeWidth="1.6" strokeDasharray="3.5 5" strokeLinecap="round"
        />
        <line x1="0" y1="43" x2="200" y2="43" stroke="rgba(2,49,47,0.06)" strokeWidth="1.5" />
      </svg>
      {expectation && <p className="mt-2 text-[12.5px] leading-relaxed" style={{ color: DIM }}>{expectation}</p>}
    </div>
  );
  return (
    <div>
      <SectionHead
        eyebrow="What we track"
        title={<>The numbers, <Accent>told straight.</Accent></>}
        sub={perf?.note || 'The leading indicators your retainer is measured on. No invented charts: real series appear the day the engine goes live.'}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {indicators.map((ind, i) => ghostCard(ind, i, expectationFor(ind)))}
      </div>

      {/* Outreach indicators (live boards): same awaiting-first-data treatment, tied to
          the staged lanes on the Leads tab. */}
      {live && outreachInds.length > 0 && (
        <div className="mt-8">
          <div className="mb-1 flex items-baseline gap-3">
            <CardHead>Outreach</CardHead>
            <span style={{ fontFamily: BODY, fontStyle: 'italic', fontSize: 12.5, color: INK_MUTE }}>Counts start the day your lanes arm.</span>
          </div>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {outreachInds.map((ind, i) => ghostCard(ind, i + 1))}
          </div>
        </div>
      )}

      {/* Per-post performance: real numbers per published post, refreshed daily. Zero-state
          until the first post goes live (the board row carries no performance.posts yet). */}
      <div className="mt-8">
        <div className="mb-1 flex items-baseline gap-3">
          <CardHead>Per-post performance</CardHead>
          {posts.length > 0 && perf?.posts_updated_at && (
            <span className="text-[11px] tabular-nums" style={{ color: FAINT }}>updated {fmtDay(perf.posts_updated_at)}</span>
          )}
        </div>
        {posts.length === 0 ? (
          <div className="mt-2 rounded-xl bg-white p-4 sm:p-5" style={{ boxShadow: CARD_SHADOW }}>
            <p className="text-[13.5px] leading-relaxed" style={{ color: DIM }}>
              Per-post numbers land here after each post goes live on your feed. Impressions, reactions and comments per post, refreshed daily.
            </p>
            <div className="mt-3 text-[10px] uppercase tracking-[0.1em]" style={{ fontFamily: MONO, color: FAINT }}>No data yet</div>
          </div>
        ) : (
          <div className="mt-2 rounded-xl bg-white p-4 sm:p-5" style={{ boxShadow: CARD_SHADOW }}>
            {/* Column labels: three mono metric heads, aligned right over the numerals. */}
            <div className="hidden sm:flex items-baseline gap-3 pb-2" style={{ borderBottom: `1px solid ${DIVIDE}` }}>
              <span className="min-w-0 flex-1" />
              <span className="w-16 shrink-0 text-right uppercase" style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.12em', color: FAINT }}>Impr.</span>
              <span className="w-14 shrink-0 text-right uppercase" style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.12em', color: FAINT }}>React.</span>
              <span className="w-14 shrink-0 text-right uppercase" style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.12em', color: FAINT }}>Comm.</span>
            </div>
            <div className="flex flex-col">
              {posts.map((p, i) => {
                const inner = (
                  <>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] leading-snug" style={{ fontFamily: BODY, color: INK }}>{p.title || 'Untitled post'}</span>
                      {p.published_at && <span className="block text-[11px] tabular-nums" style={{ color: FAINT }}>{fmtDay(p.published_at)}</span>}
                    </span>
                    <span className="w-16 shrink-0 text-right cb-num-serif tabular-nums" style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 17, color: INK }}>{fmtNum(p.impressions)}</span>
                    <span className="w-14 shrink-0 text-right cb-num-serif tabular-nums" style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 17, color: INK }}>{fmtNum(p.reactions)}</span>
                    <span className="w-14 shrink-0 text-right cb-num-serif tabular-nums" style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 17, color: INK }}>{fmtNum(p.comments)}</span>
                  </>
                );
                const rowClass = 'flex items-baseline gap-3 py-2.5';
                const rowStyle = { borderTop: i > 0 ? `1px solid ${DIVIDE}` : 'none' } as React.CSSProperties;
                return p.url ? (
                  <a key={i} href={p.url} target="_blank" rel="noopener noreferrer" className={rowClass} style={rowStyle}>{inner}</a>
                ) : (
                  <div key={i} className={rowClass} style={rowStyle}>{inner}</div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {updates.length > 0 && (
        <div className="mt-6 rounded-xl bg-white p-4 sm:p-5" style={{ border: `1px solid ${LINE}` }}>
          <div className="mb-1"><CardHead>Delivery updates</CardHead></div>
          <p className="mb-3 text-[13px]" style={{ color: DIM }}>Improvements ship to your account automatically as we build.</p>
          <div className="flex flex-col">
            {updates.map((u, i) => (
              <div key={i} className="flex items-baseline gap-3 py-2.5" style={{ borderTop: i > 0 ? `1px solid ${DIVIDE}` : 'none' }}>
                <span className="w-24 shrink-0 text-[12px] tabular-nums" style={{ color: FAINT }}>{fmtDay(u.date)}</span>
                <span className="text-[13.5px] leading-snug" style={{ color: INK }}>{u.note}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Client photo pool — the one surface the client writes TO. Uploads land in the public
 *  `client-photos` bucket under the board slug; the engine pulls from here for real-face
 *  post images. Same anon trust posture as the post-stills library: the upload runs with
 *  the anon client from inside the token-gated page (bucket has anon insert+select). */
type PhotoItem = { name: string; url: string; createdAt: string };
type PhotoUpload = { key: string; name: string; status: 'uploading' | 'done' | 'error'; error?: string };

function PhotosSurface({ board: _board, accent, slug, compact = false, onDeletePhoto }: { board: Board; accent: string; slug: string; compact?: boolean; onDeletePhoto?: (name: string) => Promise<{ ok: boolean; error?: string }> }) {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploads, setUploads] = useState<PhotoUpload[]>([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const clearTimer = useRef<number>(0);
  // Delete: first tap arms a per-tile confirm; second tap removes (edge fn), then drop locally.
  const [pendingDel, setPendingDel] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [delErr, setDelErr] = useState('');
  const removePhoto = async (name: string) => {
    if (!onDeletePhoto || deleting) return;
    setDelErr(''); setDeleting(name);
    const r = await onDeletePhoto(name);
    setDeleting(null); setPendingDel(null);
    if (!r.ok) { setDelErr(r.error || 'Could not delete that. Try again.'); return; }
    setPhotos((prev) => prev.filter((p) => p.name !== name));
  };

  const loadPhotos = async () => {
    if (!slug) { setLoading(false); return; }
    const { data, error } = await supabase.storage
      .from('client-photos')
      .list(slug, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });
    if (!error && data) {
      setPhotos(
        data
          .filter((f) => f.id !== null && !/^\./.test(f.name))
          .map((f) => ({
            name: f.name,
            url: supabase.storage.from('client-photos').getPublicUrl(`${slug}/${f.name}`).data.publicUrl,
            createdAt: f.created_at || f.updated_at || '',
          })),
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    loadPhotos();
    return () => window.clearTimeout(clearTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !slug) return;
    window.clearTimeout(clearTimer.current);
    setBusy(true);
    setUploads(files.map((f, i) => ({ key: `${Date.now()}-${i}`, name: f.name, status: 'uploading' as const })));
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const safe = (file.name || 'photo').replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').toLowerCase();
      const path = `${slug}/${Date.now()}-${i}-${safe}`;
      const { error } = await supabase.storage
        .from('client-photos')
        .upload(path, file, { upsert: false, contentType: file.type || undefined });
      setUploads((prev) => prev.map((u, idx) => (idx === i ? { ...u, status: error ? 'error' : 'done', error: error?.message } : u)));
    }
    setBusy(false);
    if (inputRef.current) inputRef.current.value = '';
    await loadPhotos();
    // Clear the per-file chips after a beat once everything settled.
    clearTimer.current = window.setTimeout(() => setUploads([]), 5000);
  };

  const count = photos.length;

  return (
    <div>
      {compact ? (
        <div className="mb-4">
          <div className="uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.22em', color: INK_MUTE }}>Lifestyle pictures library</div>
          <div className="mt-2" style={{ fontFamily: SERIF, fontSize: 'clamp(20px, 2.4vw, 26px)', lineHeight: 1.1, letterSpacing: '-0.01em', color: INK }}>Photos we pull from</div>
          <p className="mt-2 max-w-[58ch]" style={{ fontFamily: BODY, fontSize: 13.5, lineHeight: 1.6, color: INK_SOFT }}>
            Candid shots of you doing real things. Real faces pull harder than stock, so these feed your post images.
          </p>
        </div>
      ) : (
        <SectionHead
          eyebrow="Lifestyle pictures library"
          title="Photos"
          sub="Candid shots of you doing real things, plus a few founder, family and friends photos. Real faces pull harder than stock. These feed your post images."
        />
      )}

      {/* Upload control + counter */}
      <div className="mb-7 rounded-xl bg-white p-5 sm:p-6" style={{ border: `1px solid ${LINE}` }}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div style={{ fontFamily: SERIF, fontSize: 22, lineHeight: 1.1, letterSpacing: '-0.01em', color: INK }}>
              {count} {count === 1 ? 'photo' : 'photos'} uploaded
            </div>
            <div className="mt-1.5 text-[12.5px]" style={{ color: FAINT }}>20 to 30 is the sweet spot.</div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-[13.5px] font-semibold"
              style={{ background: accent, color: inkOn(accent), fontFamily: BODY, opacity: busy ? 0.6 : 1, cursor: busy ? 'default' : 'pointer' }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 5v14M5 12h14" />
              </svg>
              {busy ? 'Uploading…' : 'Upload photos'}
            </button>
            <span className="text-[11px]" style={{ color: FAINT }}>JPG or PNG, any number at once.</span>
          </div>
        </div>
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={onPick} />

        {/* Per-file progress chips */}
        {uploads.length > 0 && (
          <div className="mt-4 flex flex-col gap-1.5 border-t pt-4" style={{ borderColor: DIVIDE }}>
            {uploads.map((u) => (
              <div key={u.key} className="flex items-center gap-2.5 text-[12.5px]">
                <span
                  className="inline-block shrink-0"
                  style={{ width: 7, height: 7, borderRadius: 999, background: u.status === 'done' ? accent : u.status === 'error' ? '#c0392b' : 'rgba(19,18,16,0.25)' }}
                  aria-hidden
                />
                <span className="truncate" style={{ color: INK_SOFT, maxWidth: '32ch' }}>{u.name}</span>
                <span style={{ color: u.status === 'error' ? '#c0392b' : FAINT }}>
                  {u.status === 'uploading' ? 'uploading…' : u.status === 'done' ? 'added' : (u.error || 'failed')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Grid of already-uploaded photos */}
      {loading ? (
        <div className="py-10 text-center text-[13px]" style={{ color: FAINT }}>Loading your photos…</div>
      ) : count === 0 ? (
        <div
          className="flex flex-col items-center justify-center rounded-xl px-6 py-12 text-center"
          style={{ border: `1px dashed ${LINE_BOLD}`, background: PAPER_SUNK }}
        >
          <div style={{ fontFamily: BODY, fontSize: 14, color: INK_SOFT }}>No photos yet.</div>
          <div className="mt-1.5 max-w-[42ch] text-[12.5px]" style={{ color: FAINT }}>
            Drop in 20 to 30 real shots and your face starts showing up in the feed.
          </div>
        </div>
      ) : (
        <>
        {delErr && <div className="mb-3 text-[12.5px]" style={{ color: '#c0392b' }}>{delErr}</div>}
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-5">
          {photos.map((p) => (
            <div
              key={p.name}
              className="group relative block aspect-square overflow-hidden rounded-lg"
              style={{ border: `1px solid ${LINE}`, background: PAPER_SUNK }}
            >
              <a href={p.url} target="_blank" rel="noreferrer" className="block h-full w-full">
                <img
                  src={p.url}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                  style={{ display: 'block' }}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0'; }}
                />
              </a>
              {onDeletePhoto && pendingDel !== p.name && (
                <button
                  type="button"
                  aria-label="Remove photo"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDelErr(''); setPendingDel(p.name); }}
                  className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                  style={{ background: 'rgba(19,18,16,0.72)', color: '#fff', backdropFilter: 'blur(2px)' }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
                    <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
                  </svg>
                </button>
              )}
              {onDeletePhoto && pendingDel === p.name && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-2 text-center" style={{ background: 'rgba(19,18,16,0.82)' }}>
                  <span className="text-[11.5px] font-semibold text-white">Remove this photo?</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); void removePhoto(p.name); }}
                      disabled={deleting === p.name}
                      className="rounded-[5px] px-2.5 py-1 text-[11px] font-semibold"
                      style={{ background: '#c0392b', color: '#fff', opacity: deleting === p.name ? 0.6 : 1 }}
                    >
                      {deleting === p.name ? 'Removing…' : 'Remove'}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPendingDel(null); }}
                      className="rounded-[5px] px-2.5 py-1 text-[11px] font-medium"
                      style={{ background: 'rgba(255,255,255,0.16)', color: '#fff' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        </>
      )}
    </div>
  );
}

// ---------- page ----------
// One vocabulary on every viewport: mobile shows the same words, sized down, never renamed.
const TABS = [
  { id: 'week', label: 'This week', group: 'Content' },
  { id: 'review', label: 'All content', group: 'Content' },
  { id: 'calendar', label: 'Calendar', group: 'Content' },
  { id: 'lm', label: 'Lead magnets', group: 'Content' },
  { id: 'newsletter', label: 'Newsletter', group: 'Content' },
  { id: 'voice', label: 'Voice', group: 'Content' },
  { id: 'photos', label: 'Photos', group: 'Content' },
  { id: 'outreach', label: 'Outreach', group: 'Outreach' },
  { id: 'leads', label: 'Leads', group: 'Leads' },
  { id: 'performance', label: 'Performance', group: 'Reports' },
  { id: 'strategy', label: 'Strategy', group: 'Reports' },
  { id: 'team', label: 'Team', group: 'Settings' },
] as const;
type TabId = (typeof TABS)[number]['id'];
const NAV_GROUPS = ['Content', 'Outreach', 'Leads', 'Reports', 'Settings'] as const;

/** 16px stroke icons for the nav (feather register, 1.8 stroke). */
const NAV_ICON_PATHS: Record<TabId, React.ReactNode> = {
  week: (
    <>
      <path d="M10 6.5h10.5M10 12h10.5M10 17.5h10.5" />
      <path d="m3.5 5.75 1.25 1.25 2.25-2.5M3.5 11.25 4.75 12.5 7 10M3.5 16.75 4.75 18 7 15.5" />
    </>
  ),
  review: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M15 13H9M15 17H9" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3.5 11h17" />
    </>
  ),
  lm: <path d="M13 2 4.5 13.5H11l-1.5 8.5L18 10.5h-6.5L13 2z" />,
  newsletter: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </>
  ),
  voice: <path d="M4 10v4M8 7.5v9M12 4v16M16 7.5v9M20 10v4" />,
  photos: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <circle cx="9" cy="10.5" r="1.6" />
      <path d="m4.5 17 4.5-4.5 3 3 3-3.5 5 5" />
    </>
  ),
  outreach: (
    <>
      <path d="M21 4 11 14" />
      <path d="M21 4 15 20l-4-6-6-4 16-6z" />
    </>
  ),
  leads: <path d="M3.5 5.5h17l-6.5 7.7v5.6l-4 2v-7.6z" />,
  performance: <path d="M18 20V10M12 20V4M6 20v-6" />,
  strategy: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <path d="m15.8 8.2-2 5.6-5.6 2 2-5.6 5.6-2z" />
    </>
  ),
  team: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3.5 20v-1.5a5.5 5.5 0 0 1 11 0V20" />
      <path d="M16 5.2a3.5 3.5 0 0 1 0 5.7M17.5 13.5a5.5 5.5 0 0 1 3 5V20" />
    </>
  ),
};

function NavIcon({ id, size = 16 }: { id: TabId; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
      {NAV_ICON_PATHS[id]}
    </svg>
  );
}

/** Two-letter initials off a display name. */
function initialsOf(name?: string): string {
  return (name || '').split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '·';
}

/** Layout-shaped loading skeleton: sidebar + topbar + rows, one 1.4s sheen sweep.
 *  Unmounts (killing the animation) the moment board data lands. */
function BoardSkeleton() {
  const sheen: React.CSSProperties = {
    borderRadius: 6,
    background: 'linear-gradient(90deg, rgba(2,49,47,0.05) 25%, rgba(2,49,47,0.10) 50%, rgba(2,49,47,0.05) 75%)',
    backgroundSize: '200% 100%',
    animation: 'cb-sheen 1.4s linear infinite',
  };
  const bar = (w: number | string, h = 12): React.CSSProperties => ({ ...sheen, width: w, height: h });
  return (
    <div className="min-h-screen" style={{ background: FRAME_BG }} aria-busy="true" aria-label="Loading your board">
      <style>{`@keyframes cb-sheen { from { background-position: 200% 0; } to { background-position: -200% 0; } }
@media (prefers-reduced-motion: reduce) { .cb-skel [style*="cb-sheen"] { animation: none !important; } }`}</style>
      <div className="cb-skel">
        <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col lg:flex">
          <div className="px-5 pb-5 pt-5">
            <div style={bar(120, 26)} />
            <div className="mt-3" style={bar(88, 9)} />
          </div>
          <div className="flex flex-col gap-2.5 px-6 pt-2">
            {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} style={bar(i % 2 ? 132 : 112, 13)} />)}
          </div>
        </aside>
        <div className="lg:ml-60 lg:py-2 lg:pr-2">
          <div className="min-h-screen bg-white lg:min-h-[calc(100vh-16px)] lg:rounded-xl" style={{ boxShadow: CARD_SHADOW }}>
            <div className="flex h-14 items-center gap-3 px-4 sm:px-8" style={{ borderBottom: `1px solid ${DIVIDE}` }}>
              <div style={bar(110, 12)} />
              <div className="ml-auto" style={{ ...bar(84, 22), borderRadius: 999 }} />
            </div>
            <div className="max-w-[880px] px-4 pt-8 sm:px-6 lg:px-8">
              <div style={bar(200, 20)} />
              <div className="mt-3" style={bar('62%', 12)} />
              <div className="mt-8 overflow-hidden rounded-xl" style={{ border: `1px solid ${LINE}` }}>
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: i > 0 ? `1px solid ${DIVIDE}` : 'none', minHeight: 56 }}>
                    <div style={{ ...bar(56, 40), borderRadius: 6 }} />
                    <div className="flex-1">
                      <div style={bar(i % 2 ? '52%' : '64%', 12)} />
                      <div className="mt-2" style={bar(64, 8)} />
                    </div>
                    <div className="hidden sm:block" style={bar(90, 12)} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Magic-link sign-in screen (shown only when there is NO ?k= token and no valid
 *  stored session). Matches the blackbox board grammar: Schibsted Grotesk, ink on
 *  paper, hairline rules, uppercase mono-weight labels, one ink-filled action.
 *  No client accent is known pre-board, so the screen is operator-branded
 *  (InboundOnSteroids). Tokens travel only in RPC / edge-fn bodies. */
function BoardSignIn({ slug, onAuthed }: { slug: string; onAuthed: (s: BoardSession) => void }) {
  const [phase, setPhase] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const codeValid = code.replace(/\D/g, '').length === 6;

  // White-label the pre-auth screen: resolve the client's OWN brand by slug (public,
  // non-sensitive) so a live board never prints the operator agency name. Falls back
  // to the product name for demo/unknown boards.
  const [brandLabel, setBrandLabel] = useState('InboundOnSteroids');
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.rpc('client_board_public_brand', { p_slug: slug });
        const b = data as { ok?: boolean; mode?: string; wordmark?: string; company_name?: string } | null;
        if (!cancelled && b?.ok && b.mode === 'live') {
          const label = (b.wordmark || b.company_name || '').trim();
          if (label) setBrandLabel(label);
        }
      } catch { /* keep product-name fallback */ }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  // Load Schibsted Grotesk for the pre-board screen (the skin's font map only
  // spreads once the board renders).
  useEffect(() => {
    const id = 'client-board-blackbox-font';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id; link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400;500;700;800;900&display=swap';
    document.head.appendChild(link);
  }, []);

  const GK = '"Schibsted Grotesk", system-ui, sans-serif';
  const INKC = '#131210', PAPERC = '#ffffff', MUTE = '#6b675e', SOFT = '#3a3833', HAIR = 'rgba(19,18,16,0.16)', RED = '#C8361B';

  const requestLink = async () => {
    if (!emailValid || busy) return;
    setBusy(true); setErr('');
    try {
      // Fire the mint+send. The edge fn ALWAYS returns ok (no enumeration oracle),
      // so we advance to the code screen regardless of allow-list outcome.
      await supabase.functions.invoke('board-magic-link', { body: { slug, email: email.trim().toLowerCase() } });
    } catch { /* uniform outcome — still advance */ }
    setBusy(false);
    setPhase('code');
  };

  const submitCode = async () => {
    const c = code.replace(/\D/g, '');
    if (c.length !== 6 || busy) return;
    setBusy(true); setErr('');
    try {
      const { data, error } = await supabase.rpc('redeem_board_login', { p_slug: slug, p_secret: c, p_kind: 'code' });
      const res = (data as any) || null;
      if (!error && res?.ok && res.session_token) {
        onAuthed({ token: res.session_token, email: res.email, expires_at: res.expires_at });
        return;
      }
      setErr('That code did not match. Check the latest email, or request a new link.');
    } catch {
      setErr('Something went wrong. Try again.');
    }
    setBusy(false);
  };

  const inputStyle: React.CSSProperties = { fontFamily: GK, color: INKC, background: PAPERC, border: `1px solid ${HAIR}`, outline: 'none' };
  const btnStyle = (enabled: boolean): React.CSSProperties => ({
    fontFamily: GK, fontWeight: 700, fontSize: 12, letterSpacing: '0.14em',
    background: INKC, color: PAPERC, border: 'none', padding: '13px 20px',
    cursor: enabled ? 'pointer' : 'default', opacity: enabled ? 1 : 0.5,
  });

  return (
    <div className="flex min-h-screen items-center justify-center px-6" style={{ background: PAPERC, color: INKC, fontFamily: GK }}>
      <div className="w-full max-w-[380px]">
        <div className="uppercase" style={{ fontFamily: GK, fontWeight: 700, fontSize: 10, letterSpacing: '0.22em', color: MUTE }}>Content board</div>
        <h1 className="mt-4" style={{ fontFamily: GK, fontWeight: 800, fontSize: 27, lineHeight: 1.12, letterSpacing: '-0.03em', color: INKC }}>
          {phase === 'email' ? 'Sign in to your board' : 'Check your email'}
        </h1>

        {phase === 'email' ? (
          <>
            <p className="mt-3" style={{ fontFamily: GK, fontSize: 14.5, lineHeight: 1.6, color: SOFT }}>
              Enter the email your operator has on file. We'll send a one-tap link and a backup code.
            </p>
            <form onSubmit={(e) => { e.preventDefault(); void requestLink(); }} className="mt-6">
              <input
                type="email" inputMode="email" autoComplete="email" autoFocus
                value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com"
                className="w-full px-3.5 py-3" style={{ ...inputStyle, fontSize: 15 }}
              />
              <button type="submit" disabled={!emailValid || busy} className="mt-3 w-full uppercase" style={btnStyle(emailValid && !busy)}>
                {busy ? 'Sending…' : 'Send my link'}
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="mt-3" style={{ fontFamily: GK, fontSize: 14.5, lineHeight: 1.6, color: SOFT }}>
              We sent a sign-in link and a 6-digit code to <span style={{ color: INKC, fontWeight: 600 }}>{email.trim().toLowerCase()}</span>. Tap the link, or enter the code below. Both expire in 15 minutes.
            </p>
            <form onSubmit={(e) => { e.preventDefault(); void submitCode(); }} className="mt-6">
              <input
                type="text" inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={6}
                value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000"
                className="w-full px-3.5 py-3 tabular-nums" style={{ ...inputStyle, fontSize: 22, letterSpacing: '0.4em' }}
              />
              <button type="submit" disabled={!codeValid || busy} className="mt-3 w-full uppercase" style={btnStyle(codeValid && !busy)}>
                {busy ? 'Checking…' : 'Open my board'}
              </button>
            </form>
            <button
              onClick={() => { setPhase('email'); setCode(''); setErr(''); }}
              className="mt-3.5" style={{ fontFamily: GK, fontSize: 12.5, color: MUTE, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}
            >
              Use a different email
            </button>
          </>
        )}

        {err && <p className="mt-3" style={{ fontFamily: GK, fontSize: 12.5, lineHeight: 1.5, color: RED }}>{err}</p>}
        <div className="mt-9 uppercase" style={{ fontFamily: GK, fontWeight: 700, fontSize: 9.5, letterSpacing: '0.2em', color: '#a5a29a' }}>{brandLabel}</div>
      </div>
    </div>
  );
}

/** Team tab (live boards only) — self-serve invites. An invite APPENDS an email to
 *  the board's allow-list (invite_board_member RPC, session-authed) and fires the
 *  normal sign-in email at the invitee. There is never a shareable join-link:
 *  forwarding an invite email grants nothing to anyone but the named address.
 *  Members can invite; removals are operator-only (a teammate can't eject the
 *  founder). Token-only (?k=) visitors see a sign-in nudge instead — the invite
 *  RPC needs an email session to know WHO invited. */
function TeamSurface({ slug, accent, session }: { slug: string; accent: string; session: BoardSession | null }) {
  const [team, setTeam] = useState<string[] | null>(null);
  const [me, setMe] = useState('');
  const [teamState, setTeamState] = useState<'loading' | 'ready' | 'noauth' | 'unavailable'>(session ? 'loading' : 'noauth');
  const [inviteEmail, setInviteEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  // Token-only visitors: a compact "email me a sign-in link" form (same edge fn,
  // same no-oracle posture — the response never reveals allow-list membership).
  const [selfEmail, setSelfEmail] = useState('');
  const [selfSent, setSelfSent] = useState(false);
  const emailOk = (s: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.trim());

  useEffect(() => {
    if (!session) { setTeamState('noauth'); return; }
    let dead = false;
    (async () => {
      const { data, error } = await supabase.rpc('get_board_team', { p_slug: slug, p_session: session.token });
      if (dead) return;
      const res = (data as any) || null;
      if (!error && res?.ok && Array.isArray(res.allowed_emails)) {
        setTeam(res.allowed_emails); setMe(String(res.me || '')); setTeamState('ready');
      } else if (res?.error === 'not_authenticated') {
        setTeamState('noauth');
      } else {
        setTeamState('unavailable');
      }
    })();
    return () => { dead = true; };
  }, [slug, session]);

  const invite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!emailOk(email) || busy || !session) return;
    setBusy(true); setNotice(null);
    try {
      const { data, error } = await supabase.rpc('invite_board_member', { p_slug: slug, p_session: session.token, p_email: email });
      const res = (data as any) || null;
      if (!error && res?.ok) {
        if (Array.isArray(res.allowed_emails)) setTeam(res.allowed_emails);
        if (res.already_member) {
          setNotice({ kind: 'ok', text: `${email} is already on the team.` });
        } else {
          // The allow-list write is the security; the email is the courtesy.
          try { await supabase.functions.invoke('board-magic-link', { body: { slug, email } }); } catch { /* best-effort */ }
          setNotice({ kind: 'ok', text: `${email} is in. They just got a sign-in email — no passwords, no setup.` });
          setInviteEmail('');
        }
      } else if (res?.error === 'list_full') {
        setNotice({ kind: 'err', text: 'The team list is full (10 seats). Ask your operator to make room.' });
      } else if (res?.error === 'not_authenticated') {
        setTeamState('noauth');
      } else {
        setNotice({ kind: 'err', text: 'That invite did not go through. Try again in a moment.' });
      }
    } catch {
      setNotice({ kind: 'err', text: 'That invite did not go through. Try again in a moment.' });
    }
    setBusy(false);
  };

  const sendSelfLink = async () => {
    if (!emailOk(selfEmail) || busy) return;
    setBusy(true);
    try { await supabase.functions.invoke('board-magic-link', { body: { slug, email: selfEmail.trim().toLowerCase() } }); } catch { /* uniform */ }
    setBusy(false); setSelfSent(true);
  };

  return (
    <div>
      <div className="uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.2em', color: INK_MUTE }}>Settings</div>
      <h2 className="mt-2" style={{ fontFamily: SERIF, fontSize: 26, lineHeight: 1.15, color: INK }}>Team access</h2>
      <p className="mt-2 max-w-[520px] text-[14.5px] leading-relaxed" style={{ fontFamily: BODY, color: DIM }}>
        Every teammate signs in to the board with their own email. No passwords, no shared links.
      </p>

      {teamState === 'noauth' && (
        <div className="mt-7 max-w-[520px] bg-white p-6" style={{ border: `1px solid ${LINE}` }}>
          <div className="text-[15px] font-semibold" style={{ fontFamily: BODY, color: INK }}>Sign in to manage your team</div>
          {selfSent ? (
            <p className="mt-2 text-[13.5px] leading-relaxed" style={{ fontFamily: BODY, color: DIM }}>
              If <span style={{ color: INK, fontWeight: 600 }}>{selfEmail.trim().toLowerCase()}</span> is on the team list, a sign-in link is on its way. Open it and come back to this tab.
            </p>
          ) : (
            <>
              <p className="mt-2 text-[13.5px] leading-relaxed" style={{ fontFamily: BODY, color: DIM }}>
                Inviting teammates needs an email sign-in, so every invite is on the record. Enter your email and we'll send you a one-tap link.
              </p>
              <form onSubmit={(e) => { e.preventDefault(); void sendSelfLink(); }} className="mt-4 flex flex-col gap-2.5 sm:flex-row">
                <input
                  type="email" inputMode="email" autoComplete="email"
                  value={selfEmail} onChange={(e) => setSelfEmail(e.target.value)} placeholder="you@company.com"
                  className="min-w-0 flex-1 px-3.5 py-2.5 text-[14px]"
                  style={{ fontFamily: BODY, color: INK, background: 'white', border: `1px solid ${LINE}`, outline: 'none' }}
                />
                <button type="submit" disabled={!emailOk(selfEmail) || busy} className="shrink-0 px-5 py-2.5 uppercase"
                  style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.12em', background: INK, color: PAPER, border: 'none', cursor: emailOk(selfEmail) && !busy ? 'pointer' : 'default', opacity: emailOk(selfEmail) && !busy ? 1 : 0.5 }}>
                  {busy ? 'Sending…' : 'Email me a link'}
                </button>
              </form>
            </>
          )}
        </div>
      )}

      {teamState === 'loading' && (
        <div className="mt-7 max-w-[520px] bg-white px-5 py-6 text-[13.5px]" style={{ border: `1px solid ${LINE}`, fontFamily: BODY, color: FAINT }}>Loading your team…</div>
      )}

      {teamState === 'unavailable' && (
        <div className="mt-7 max-w-[520px] bg-white px-5 py-6 text-[13.5px]" style={{ border: `1px solid ${LINE}`, fontFamily: BODY, color: DIM }}>
          Team management isn't switched on for this board yet. Ask your operator.
        </div>
      )}

      {teamState === 'ready' && (
        <>
          <div className="mt-7 max-w-[520px] overflow-hidden bg-white" style={{ border: `1px solid ${LINE}` }}>
            <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid ${DIVIDE}` }}>
              <span className="uppercase" style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.16em', color: INK_MUTE }}>Who has access</span>
              <span className="tabular-nums" style={{ fontFamily: MONO, fontSize: 10.5, color: INK_MUTE }}>{team?.length ?? 0}/10</span>
            </div>
            {(team || []).map((email, i) => (
              <div key={email} className="flex min-h-[46px] items-center gap-3 px-5" style={{ borderTop: i > 0 ? `1px solid ${DIVIDE}` : 'none' }}>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold" style={{ background: caWash(accent, 16), color: caText(accent) }} aria-hidden>
                  {email.slice(0, 2).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13.5px]" style={{ fontFamily: BODY, color: INK }}>{email}</span>
                {email === me && (
                  <span className="uppercase" style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.14em', color: INK_MUTE }}>you</span>
                )}
              </div>
            ))}
          </div>

          <div className="mt-5 max-w-[520px] bg-white p-5" style={{ border: `1px solid ${LINE}` }}>
            <div className="uppercase" style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.16em', color: INK_MUTE }}>Invite a teammate</div>
            <form onSubmit={(e) => { e.preventDefault(); void invite(); }} className="mt-3 flex flex-col gap-2.5 sm:flex-row">
              <input
                type="email" inputMode="email"
                value={inviteEmail} onChange={(e) => { setInviteEmail(e.target.value); setNotice(null); }} placeholder="teammate@company.com"
                className="min-w-0 flex-1 px-3.5 py-2.5 text-[14px]"
                style={{ fontFamily: BODY, color: INK, background: 'white', border: `1px solid ${LINE}`, outline: 'none' }}
              />
              <button type="submit" disabled={!emailOk(inviteEmail) || busy} className="shrink-0 px-5 py-2.5 uppercase"
                style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.12em', background: INK, color: PAPER, border: 'none', cursor: emailOk(inviteEmail) && !busy ? 'pointer' : 'default', opacity: emailOk(inviteEmail) && !busy ? 1 : 0.5 }}>
                {busy ? 'Inviting…' : 'Invite'}
              </button>
            </form>
            {notice && (
              <p className="mt-2.5 text-[13px] leading-relaxed" style={{ fontFamily: BODY, color: notice.kind === 'ok' ? caText(accent) : '#C8361B' }}>{notice.text}</p>
            )}
            <p className="mt-3 text-[12px] leading-relaxed" style={{ fontFamily: BODY, color: FAINT }}>
              They'll get a sign-in email right away and can always sign in later with their own address. Need to remove someone? Ask your operator — removals are operator-only.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

export default function ClientBoardPage() {
  const { slug } = useParams<{ slug: string }>();
  const [params] = useSearchParams();
  const token = params.get('k') || '';
  // ?intro=1 force-replays the opening choreography (clears the played flag before the fetch).
  const forceIntro = params.get('intro') === '1';
  const introKey = `cb-intro-${slug || ''}`;
  const approvalsKey = `cb-approvals-${slug || ''}`;
  const [board, setBoard] = useState<Board | null>(null);
  const [mode, setMode] = useState<string>('demo');
  const [state, setState] = useState<'loading' | 'ready' | 'invalid' | 'generating' | 'failed' | 'signin'>('loading');
  // Magic-link session (additive path). The ?k= token flow above is unchanged and
  // takes precedence whenever a ?k= is present. Session auth only engages when
  // there is NO ?k= token: a #ml= link fragment redeems into a session, or a
  // previously-stored session loads the board. Read synchronously so act() and the
  // fetch effect see it on the very first render.
  const [session, setSession] = useState<BoardSession | null>(() => loadBoardSession(slug));
  const sessionRef = useRef<BoardSession | null>(session);
  sessionRef.current = session;
  // Company name for the pre-render states (generating / failed): the placeholder row
  // carries it before the full board jsonb exists, so the building screen can name it.
  const [pendingCompany, setPendingCompany] = useState<string>('');
  const [tab, setTab] = useState<TabId>('week');
  const [detail, setDetail] = useState<QueueItem | null>(null);
  const [detailChanging, setDetailChanging] = useState(false);
  const [detailEditing, setDetailEditing] = useState(false);
  const [detailScheduling, setDetailScheduling] = useState(false);
  // Ideas are not approvable yet — they open a lightweight preview, kept separate from the
  // full DetailModal approve flow.
  const [ideaPreview, setIdeaPreview] = useState<Idea | null>(null);
  const [leadDetail, setLeadDetail] = useState<PipelineLead | null>(null);
  // Sidebar voice-note recorder. Live boards record + upload for real; preview theater.
  const [voiceOpen, setVoiceOpen] = useState(false);
  // Demo interaction state survives a reload: approvals persist per-slug.
  const [stageOverride, setStageOverride] = useState<Record<string, Stage>>(() => {
    try {
      const raw = localStorage.getItem(`cb-approvals-${slug || ''}`);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  });
  useEffect(() => {
    try { localStorage.setItem(approvalsKey, JSON.stringify(stageOverride)); } catch { /* private mode */ }
  }, [stageOverride, approvalsKey]);
  // Week-home decisions persist the same way: chosen alternate angles + skipped days.
  const anglesKey = `cb-angles-${slug || ''}`;
  const skipsKey = `cb-skips-${slug || ''}`;
  const [angleSwaps, setAngleSwaps] = useState<Record<string, AltAngle>>(() => {
    try { const raw = localStorage.getItem(`cb-angles-${slug || ''}`); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
  });
  useEffect(() => {
    try { localStorage.setItem(anglesKey, JSON.stringify(angleSwaps)); } catch { /* private mode */ }
  }, [angleSwaps, anglesKey]);
  const [weekSkips, setWeekSkips] = useState<Record<string, true>>(() => {
    try { const raw = localStorage.getItem(`cb-skips-${slug || ''}`); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
  });
  useEffect(() => {
    try { localStorage.setItem(skipsKey, JSON.stringify(weekSkips)); } catch { /* private mode */ }
  }, [weekSkips, skipsKey]);
  // A freed slot the client filled from the pool. Keyed by the removed slot's id → the
  // chosen replacement. Persisted client-side AND reconstructed from the action log on
  // load (client_board_slot_state), so a replacement survives a hard refresh.
  const replKey = `cb-repl-${slug || ''}`;
  const [slotReplacements, setSlotReplacements] = useState<Record<string, SlotReplacement>>(() => {
    try { const raw = localStorage.getItem(`cb-repl-${slug || ''}`); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
  });
  useEffect(() => {
    try { localStorage.setItem(replKey, JSON.stringify(slotReplacements)); } catch { /* private mode */ }
  }, [slotReplacements, replKey]);
  // "Leave this day empty": a deliberate, first-class clear that PERSISTS across reloads
  // (server-side via the day_left_empty action) and never nags to restore. Distinct from
  // weekSkips (remove-with-nag): a left-empty slot renders quiet, no restore prompt unless
  // the client reopens it. localStorage is only a first-paint hint; slot_state is truth.
  const emptyKey = `cb-empty-${slug || ''}`;
  const [leftEmpty, setLeftEmpty] = useState<Record<string, true>>(() => {
    try { const raw = localStorage.getItem(`cb-empty-${slug || ''}`); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
  });
  useEffect(() => {
    try { localStorage.setItem(emptyKey, JSON.stringify(leftEmpty)); } catch { /* private mode */ }
  }, [leftEmpty, emptyKey]);
  // The pool of ready drafts (board_visible, not already on the queue) the client can pull
  // into a freed slot. Fetched once per live load; the bench angles come from the slot itself.
  const [replacementPool, setReplacementPool] = useState<PoolDraft[]>([]);
  const [flashId, setFlashId] = useState<string | null>(null);
  // Content view lives up here so the page can widen the container for the kanban.
  const [contentView, setContentViewState] = useState<ContentView>(() => {
    try {
      const v = localStorage.getItem('client-board-view');
      return v === 'board' || v === 'feed' ? v : 'list';
    } catch { return 'list'; }
  });
  const setContentView = (v: ContentView) => {
    setContentViewState(v);
    try { localStorage.setItem('client-board-view', v); } catch { /* private mode */ }
  };
  const reduceMotion = useReducedMotion();
  const introRan = useRef(false);
  // Live-mode flag readable from callbacks defined above the mode derivation (kept in sync
  // during render below). Live boards route actions through the real client_board_action RPC.
  const isLiveRef = useRef(false);
  const flashTimer = useRef<number>(0);
  const introTimers = useRef<number[]>([]);
  // Undo window after an action: toast with Z / click to restore the row.
  const [undo, setUndo] = useState<{ id: string; kind: 'approve' | 'angle' | 'skip' } | null>(null);
  const undoTimer = useRef<number>(0);
  useEffect(() => () => { introTimers.current.forEach((t) => window.clearTimeout(t)); window.clearTimeout(flashTimer.current); window.clearTimeout(undoTimer.current); }, []);

  const flash = (id: string) => {
    setFlashId(id);
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlashId(null), 1500);
  };

  // Optimistic actions + undo window. Defined above the early returns so the
  // Z-key effect keeps a stable hook order across loading states.
  const armUndo = (id: string, kind: 'approve' | 'angle' | 'skip') => {
    setUndo({ id, kind });
    window.clearTimeout(undoTimer.current);
    undoTimer.current = window.setTimeout(() => setUndo(null), 6000);
  };
  // Real, token-gated board action. Same anon-key RPC posture as get_client_board.
  // Returns {ok:true} or {ok:false,error}. Never throws to the caller.
  // Routing: a ?k= token uses client_board_action (v1, byte-identical); a
  // magic-link session uses client_board_action_v2 (session-authenticated, with
  // the expires_at guard v1 misses). The session token only travels in the RPC
  // body — never a query param, log, or title.
  const act = async (
    action: 'approve' | 'edit_copy' | 'request_changes' | 'shift_request' | 'note',
    ref?: string | null,
    payload?: Record<string, unknown> | null,
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!slug) return { ok: false, error: 'missing slug' };
    try {
      if (token) {
        const { data, error } = await supabase.rpc('client_board_action', {
          p_slug: slug, p_token: token, p_action: action, p_ref: ref ?? null, p_payload: payload ?? null,
        });
        if (error) return { ok: false, error: error.message };
        return (data as any) ?? { ok: true };
      }
      const sess = sessionRef.current;
      if (!sess?.token) return { ok: false, error: 'missing session' };
      const { data, error } = await supabase.rpc('client_board_action_v2', {
        p_slug: slug, p_session: sess.token, p_action: action, p_ref: ref ?? null, p_payload: payload ?? null,
      });
      if (error) return { ok: false, error: error.message };
      return (data as any) ?? { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  };

  // Lifestyle photo pool (live): the client's uploaded photos, fetched once. Used to
  // auto-rotate a photo onto eligible solo text posts (display-only, deterministic). Empty
  // pool → nothing assigned (graceful). Preview boards skip this.
  const [photoPool, setPhotoPool] = useState<string[]>([]);
  useEffect(() => {
    if (state !== 'ready' || !slug) return;
    if (mode === 'demo' || mode === 'preview') return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.storage.from('client-photos').list(slug, { limit: 200, sortBy: { column: 'name', order: 'asc' } });
        if (cancelled || error || !data) return;
        const urls = data.filter((f) => f.id !== null && !/^\./.test(f.name))
          .map((f) => supabase.storage.from('client-photos').getPublicUrl(`${slug}/${f.name}`).data.publicUrl);
        setPhotoPool(urls);
      } catch { /* no pool → text-only, as today */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, mode, slug]);

  // Real slot data (live): carousel_drafts.scheduled_at is the schedule authority — the
  // board jsonb never carries publish dates for buffered drafts. Fetched once per load;
  // merged into the queue below. Unscheduled drafts keep the honest buffer fallback.
  const [schedule, setSchedule] = useState<Record<string, { status: string; scheduled_at: string | null }>>({});
  useEffect(() => {
    if (state !== 'ready' || !slug) return;
    if (mode === 'demo' || mode === 'preview') return;
    let cancelled = false;
    (async () => {
      try {
        let resp: { data: unknown; error: { message: string } | null };
        if (token) {
          resp = await supabase.rpc('client_board_schedule', { p_slug: slug, p_token: token });
        } else {
          const sess = sessionRef.current;
          if (!sess?.token) return;
          resp = await supabase.rpc('client_board_schedule_v2', { p_slug: slug, p_session: sess.token });
        }
        if (cancelled || resp.error) return;
        const out = resp.data as { ok?: boolean; items?: { id: string; status: string; scheduled_at: string | null }[] } | null;
        if (!out?.ok || !Array.isArray(out.items)) return;
        const map: Record<string, { status: string; scheduled_at: string | null }> = {};
        out.items.forEach((it) => { map[it.id] = { status: it.status, scheduled_at: it.scheduled_at }; });
        setSchedule(map);
      } catch { /* schedule is progressive enhancement — the buffer fallback stays honest */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, mode, slug, token]);

  // Outreach usage (live): the real send-log counts for the month, gated by the same
  // token/session posture as the schedule read. Caps come from integration_config
  // server-side (never hardcoded here); counts are computed live from outreach_messages
  // + outreach_engagement_log. Honest zero until the engine actually sends.
  const [outreachUsage, setOutreachUsage] = useState<OutreachUsage | null>(null);
  useEffect(() => {
    if (state !== 'ready' || !slug) return;
    if (mode === 'demo' || mode === 'preview') return;
    let cancelled = false;
    (async () => {
      try {
        let resp: { data: unknown; error: { message: string } | null };
        if (token) {
          resp = await supabase.rpc('client_board_outreach_usage', { p_slug: slug, p_token: token });
        } else {
          const sess = sessionRef.current;
          if (!sess?.token) return;
          resp = await supabase.rpc('client_board_outreach_usage_v2', { p_slug: slug, p_session: sess.token });
        }
        if (cancelled || resp.error) return;
        const out = resp.data as { ok?: boolean; usage?: OutreachUsage | null } | null;
        if (!out?.ok || !out.usage) return;
        setOutreachUsage(out.usage);
      } catch { /* usage strip is progressive enhancement — absent = simply not shown */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, mode, slug, token]);

  // Live send log (live): the real per-lead outbound trail + reply status, from
  // outreach_messages via RPC (never baked board JSON). Honest empty until a lane sends.
  // Same token/session posture as the usage read.
  const [outreachLog, setOutreachLog] = useState<OutreachLogEntry[] | null>(null);
  useEffect(() => {
    if (state !== 'ready' || !slug) return;
    if (mode === 'demo' || mode === 'preview') return;
    let cancelled = false;
    (async () => {
      try {
        let resp: { data: unknown; error: { message: string } | null };
        if (token) {
          resp = await supabase.rpc('client_board_outreach_log', { p_slug: slug, p_token: token });
        } else {
          const sess = sessionRef.current;
          if (!sess?.token) return;
          resp = await supabase.rpc('client_board_outreach_log_v2', { p_slug: slug, p_session: sess.token });
        }
        if (cancelled || resp.error) return;
        const out = resp.data as { ok?: boolean; log?: OutreachLogEntry[] | null } | null;
        if (!out?.ok || !Array.isArray(out.log)) return;
        setOutreachLog(out.log);
      } catch { /* send log is progressive enhancement — absent = simply not shown */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, mode, slug, token]);

  // Slot state (live): a removed slot — and any replacement pulled into it — is
  // reconstructed from the insert-only action log so it SURVIVES a hard refresh (and
  // shows the same on any device). This is the server truth; localStorage is only a
  // first-paint hint. Same token/session posture as the schedule read.
  useEffect(() => {
    if (state !== 'ready' || !slug) return;
    if (mode === 'demo' || mode === 'preview') return;
    let cancelled = false;
    (async () => {
      try {
        let sResp: { data: unknown; error: { message: string } | null };
        let pResp: { data: unknown; error: { message: string } | null };
        if (token) {
          sResp = await supabase.rpc('client_board_slot_state', { p_slug: slug, p_token: token });
          pResp = await supabase.rpc('client_board_replacement_pool', { p_slug: slug, p_token: token });
        } else {
          const sess = sessionRef.current;
          if (!sess?.token) return;
          sResp = await supabase.rpc('client_board_slot_state_v2', { p_slug: slug, p_session: sess.token });
          pResp = await supabase.rpc('client_board_replacement_pool_v2', { p_slug: slug, p_session: sess.token });
        }
        if (cancelled) return;
        if (!sResp.error) {
          const out = sResp.data as { ok?: boolean; removed?: string[]; replacements?: { ref: string; draft_id: string; title?: string; hook?: string }[]; left_empty?: string[] } | null;
          if (out?.ok) {
            const removed: Record<string, true> = {};
            (out.removed || []).forEach((id) => { removed[id] = true; });
            setWeekSkips(removed);
            const repl: Record<string, SlotReplacement> = {};
            (out.replacements || []).forEach((r) => { if (r.ref) repl[r.ref] = { draft_id: r.draft_id, title: r.title, hook: r.hook }; });
            setSlotReplacements(repl);
            const empty: Record<string, true> = {};
            (out.left_empty || []).forEach((id) => { empty[id] = true; });
            setLeftEmpty(empty);
          }
        }
        if (!pResp.error) {
          const out = pResp.data as { ok?: boolean; items?: PoolDraft[] } | null;
          if (out?.ok && Array.isArray(out.items)) setReplacementPool(out.items);
        }
      } catch { /* progressive enhancement — the localStorage hint keeps the slot honest */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, mode, slug, token]);

  // History log (live): reads the insert-only client_board_actions audit for one draft.
  const fetchHistory = async (ref: string): Promise<HistoryEntry[]> => {
    if (!slug) return [];
    try {
      let resp: { data: unknown; error: { message: string } | null };
      if (token) {
        resp = await supabase.rpc('client_board_draft_history', { p_slug: slug, p_token: token, p_ref: ref });
      } else {
        const sess = sessionRef.current;
        if (!sess?.token) return [];
        resp = await supabase.rpc('client_board_draft_history_v2', { p_slug: slug, p_session: sess.token, p_ref: ref });
      }
      if (resp.error) return [];
      const out = resp.data as { ok?: boolean; items?: HistoryEntry[] } | null;
      return out?.ok && Array.isArray(out.items) ? out.items : [];
    } catch { return []; }
  };

  // Direct draft editing (live): applies the new copy server-side (draft + board queue in
  // one RPC) and logs a before/after action row for the operator. Local queue state
  // updates so the edit survives navigation without a refetch.
  const editDraft = async (draftId: string, newBody: string): Promise<{ ok: boolean; error?: string }> => {
    if (!slug) return { ok: false, error: 'missing slug' };
    try {
      let resp: { data: unknown; error: { message: string } | null };
      if (token) {
        resp = await supabase.rpc('client_board_edit_draft', { p_slug: slug, p_token: token, p_draft_id: draftId, p_body: newBody });
      } else {
        const sess = sessionRef.current;
        if (!sess?.token) return { ok: false, error: 'missing session' };
        resp = await supabase.rpc('client_board_edit_draft_v2', { p_slug: slug, p_session: sess.token, p_draft_id: draftId, p_body: newBody });
      }
      if (resp.error) return { ok: false, error: resp.error.message };
      const out = (resp.data as { ok: boolean; error?: string }) ?? { ok: true };
      if (out.ok) {
        setBoard((b) => b ? { ...b, queue: b.queue.map((q) => q.id === draftId ? { ...q, body: newBody } : q) } : b);
      }
      return out;
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  };

  // Edit an LM's delivery email or keyword DM (live). Writes board.lead_magnets[i].promo via
  // the gated client_board_edit_lm_promo RPC + logs an edit_lm_promo action; updates local
  // board state so the edit shows at once. Same token/session routing as editDraft.
  const editLmPromo = async (lmId: string, field: 'email' | 'dm', value: unknown): Promise<{ ok: boolean; error?: string }> => {
    if (!slug) return { ok: false, error: 'missing slug' };
    try {
      let resp: { data: unknown; error: { message: string } | null };
      if (token) {
        resp = await supabase.rpc('client_board_edit_lm_promo', { p_slug: slug, p_token: token, p_lm_id: lmId, p_field: field, p_value: value });
      } else {
        const sess = sessionRef.current;
        if (!sess?.token) return { ok: false, error: 'missing session' };
        resp = await supabase.rpc('client_board_edit_lm_promo_v2', { p_slug: slug, p_session: sess.token, p_lm_id: lmId, p_field: field, p_value: value });
      }
      if (resp.error) return { ok: false, error: resp.error.message };
      const out = (resp.data as { ok: boolean; error?: string }) ?? { ok: true };
      if (out.ok) {
        setBoard((b) => b ? { ...b, lead_magnets: (b.lead_magnets || []).map((e) => e.id === lmId ? { ...e, promo: { ...(e.promo || {}), [field]: value } } : e) } : b);
      }
      return out;
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  };

  // Attach / replace / clear a post's image with a chosen lifestyle photo (live).
  // Sets carousel_drafts.image_urls + the board queue item's media_url in one RPC,
  // and logs a set_media action for the operator. Same token/session routing as editDraft.
  // Passing '' clears the image. Local queue state updates so it survives navigation.
  const setMedia = async (draftId: string, url: string): Promise<{ ok: boolean; error?: string }> => {
    if (!slug) return { ok: false, error: 'missing slug' };
    try {
      let resp: { data: unknown; error: { message: string } | null };
      if (token) {
        resp = await supabase.rpc('client_board_set_media', { p_slug: slug, p_token: token, p_draft_id: draftId, p_media_url: url });
      } else {
        const sess = sessionRef.current;
        if (!sess?.token) return { ok: false, error: 'missing session' };
        resp = await supabase.rpc('client_board_set_media_v2', { p_slug: slug, p_session: sess.token, p_draft_id: draftId, p_media_url: url });
      }
      if (resp.error) return { ok: false, error: resp.error.message };
      const out = (resp.data as { ok: boolean; error?: string }) ?? { ok: true };
      if (out.ok) {
        setBoard((b) => b ? { ...b, queue: b.queue.map((q) => q.id === draftId ? { ...q, media_url: url || null } : q) } : b);
      }
      return out;
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  };

  // Change a post's date/time from the board (live). Writes carousel_drafts.scheduled_at +
  // logs a set_schedule action + refreshes the board queue publish_date, via the
  // SECURITY DEFINER RPC (same token/session posture as editDraft). Passing null clears the
  // slot (back to the buffer). Updates the local schedule map so the change shows at once.
  const setScheduleRPC = async (draftId: string, scheduledAt: string | null): Promise<{ ok: boolean; error?: string }> => {
    if (!slug) return { ok: false, error: 'missing slug' };
    try {
      let resp: { data: unknown; error: { message: string } | null };
      if (token) {
        resp = await supabase.rpc('client_board_set_schedule', { p_slug: slug, p_token: token, p_draft_id: draftId, p_scheduled_at: scheduledAt });
      } else {
        const sess = sessionRef.current;
        if (!sess?.token) return { ok: false, error: 'missing session' };
        resp = await supabase.rpc('client_board_set_schedule_v2', { p_slug: slug, p_session: sess.token, p_draft_id: draftId, p_scheduled_at: scheduledAt });
      }
      if (resp.error) return { ok: false, error: resp.error.message };
      const out = (resp.data as { ok: boolean; error?: string }) ?? { ok: true };
      if (out.ok) {
        setSchedule((m) => ({ ...m, [draftId]: { status: m[draftId]?.status || 'review', scheduled_at: scheduledAt } }));
      }
      return out;
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  };

  // Remove a buffer (unscheduled) post from the board (live). Sets carousel_drafts
  // .board_visible=false through the SECURITY DEFINER RPC (a reversible hide, never a hard
  // delete) + drops it from the board queue jsonb so it stays gone on reload. Optimistically
  // pulls the card from the local queue so it vanishes at once; on failure it restores.
  const hideDraftRPC = async (draftId: string): Promise<{ ok: boolean; error?: string }> => {
    if (!slug) return { ok: false, error: 'missing slug' };
    try {
      let resp: { data: unknown; error: { message: string } | null };
      if (token) {
        resp = await supabase.rpc('client_board_hide_draft', { p_slug: slug, p_token: token, p_draft_id: draftId });
      } else {
        const sess = sessionRef.current;
        if (!sess?.token) return { ok: false, error: 'missing session' };
        resp = await supabase.rpc('client_board_hide_draft_v2', { p_slug: slug, p_session: sess.token, p_draft_id: draftId });
      }
      if (resp.error) return { ok: false, error: resp.error.message };
      return (resp.data as { ok: boolean; error?: string }) ?? { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  };
  // "Remove" on a buffer post: hide it from the board (reversible), optimistically pull it
  // from the local queue, then reconcile with the server. If the hide fails, put it back.
  const removeBufferPost = async (id: string): Promise<{ ok: boolean; error?: string }> => {
    const snapshot = board?.queue.find((q) => q.id === id) || null;
    setBoard((b) => b ? { ...b, queue: b.queue.filter((q) => q.id !== id) } : b);
    const r = await hideDraftRPC(id);
    if (!r.ok && snapshot) {
      setBoard((b) => b && !b.queue.some((q) => q.id === id) ? { ...b, queue: [...b.queue, snapshot] } : b);
    }
    return r;
  };

  // Remove one photo from the client's lifestyle library (live). storage.objects has a
  // protect_delete() trigger, so the delete runs in the client-photo-delete edge fn under
  // the service role, gated by the same token/session as every other board write.
  const deletePhoto = async (name: string): Promise<{ ok: boolean; error?: string }> => {
    if (!slug) return { ok: false, error: 'missing slug' };
    const sessTok = sessionRef.current?.token;
    if (!token && !sessTok) return { ok: false, error: 'missing session' };
    try {
      const auth = token ? { token } : { session: sessTok };
      const { data, error } = await supabase.functions.invoke('client-photo-delete', { body: { slug, name, ...auth } });
      if (error) return { ok: false, error: error.message };
      const out = data as { ok?: boolean; error?: string } | null;
      return out?.ok ? { ok: true } : { ok: false, error: out?.error || 'Could not delete that. Try again.' };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  };
  const approve = (id: string) => {
    setStageOverride((s) => ({ ...s, [id]: 'scheduled' }));
    flash(id);
    armUndo(id, 'approve');
    // Live boards record the approve for the operator (the RPC insert IS the action;
    // it never flips carousel_drafts.status, so client drafts stay out of Ivan's scheduler).
    if (isLiveRef.current) { void act('approve', id); }
  };
  const pickAngle = (id: string, alt: AltAngle) => {
    setAngleSwaps((s) => ({ ...s, [id]: alt }));
    flash(id);
    armUndo(id, 'angle');
    // Live: the swap is a real client action — record it for the operator's log.
    if (isLiveRef.current) { void act('note', id, { event: 'angle_swap', alt_id: alt.id, title: alt.title, hook: alt.hook }); }
  };
  const skipDay = (id: string) => {
    setWeekSkips((s) => ({ ...s, [id]: true as const }));
    armUndo(id, 'skip');
    // Live: "remove this post" — recorded, and undo records the restore below.
    if (isLiveRef.current) { void act('note', id, { event: 'post_removed' }); }
  };
  const unskipDay = (id: string) => {
    setWeekSkips((s) => { const { [id]: _drop, ...rest } = s; return rest; });
  };
  // "Put back in the buffer": unschedule the post (clears carousel_drafts.scheduled_at via
  // the schedule RPC + logs a set_schedule row). The day becomes an open slot; the post
  // rejoins the buffer bucket. Distinct from Remove (which vetoes the post off the queue).
  const backToBuffer = async (id: string): Promise<{ ok: boolean; error?: string }> => {
    const r = await setScheduleRPC(id, null);
    if (r.ok) flash(id);
    return r;
  };
  // date (YYYY-MM-DD) → the draft most recently cleared from that day, so "Add a post" can
  // offer to put it straight back at the top of the list.
  const [recentlyCleared, setRecentlyCleared] = useState<Record<string, string>>({});
  // "Clear this day" (client): take the post off its day and open the day up. The post is
  // not lost — it returns to the ready list (unscheduled) and can be added to any day again.
  // Writes carousel_drafts.scheduled_at=null through the same client_board_set_schedule RPC
  // the client uses to edit a time (this is a client-triggered runtime action, never a batch
  // rewrite of the operator's schedule).
  const clearDay = async (id: string, date?: string): Promise<{ ok: boolean; error?: string }> => {
    const d = (date || '').slice(0, 10);
    const r = await setScheduleRPC(id, null);
    if (r.ok) { if (d) setRecentlyCleared((s) => ({ ...s, [d]: id })); flash(id); }
    return r;
  };
  // "Add a post" (client): schedule a ready post onto a chosen day. Defaults to a morning
  // slot in the client's timezone; the exact time is editable right after on the card.
  const scheduleToDay = async (id: string, date: string): Promise<{ ok: boolean; error?: string }> => {
    const d = date.slice(0, 10);
    const r = await setScheduleRPC(id, laWallToUtcISO(d, '09:00'));
    if (r.ok) { setRecentlyCleared((s) => { const { [d]: _drop, ...rest } = s; return rest; }); flash(id); }
    return r;
  };
  // "Leave this day empty": deliberate + persistent, no restore nag. Records day_left_empty
  // so it survives reload on any device (slot_state reconstructs it). Distinct from skipDay.
  const leaveEmpty = (id: string) => {
    setLeftEmpty((s) => ({ ...s, [id]: true as const }));
    if (isLiveRef.current) { void act('note', id, { event: 'day_left_empty' }); }
  };
  // Reopen a deliberately-empty day (the only path back — never an automatic prompt). Clears
  // BOTH the empty-hold and any removal for this ref, so a held post's day returns to auto.
  const refillDay = (id: string) => {
    setLeftEmpty((s) => { const { [id]: _drop, ...rest } = s; return rest; });
    setWeekSkips((s) => { const { [id]: _drop, ...rest } = s; return rest; });
    if (isLiveRef.current) {
      void act('note', id, { event: 'day_refilled' });
      void act('note', id, { event: 'post_restored' });
    }
  };
  // "Leave this day empty" from a SCHEDULED card: take the post off the day AND hold the day
  // empty so nothing auto-fills it (a human can post there manually). Distinct from "Back to
  // buffer", which unschedules the post and leaves the day free to auto-fill. This holds the
  // day purely through the insert-only action log (post_removed + day_left_empty, keyed by
  // the draft id) — it NEVER writes carousel_drafts.scheduled_at, so the operator's manual
  // schedule is untouched. Reopening the day restores auto. Survives reload (slot_state).
  const leaveDayEmpty = (id: string, _date?: string) => {
    setWeekSkips((s) => ({ ...s, [id]: true as const }));
    setLeftEmpty((s) => ({ ...s, [id]: true as const }));
    flash(id);
    if (isLiveRef.current) {
      void act('note', id, { event: 'post_removed' });
      void act('note', id, { event: 'day_left_empty' });
    }
  };
  // Open-slot: restore the original post. Clears the removal and any replacement, and
  // records both so the log stays the source of truth across refreshes.
  const restoreSlot = (id: string) => {
    const wasReplaced = !!slotReplacements[id];
    setWeekSkips((s) => { const { [id]: _drop, ...rest } = s; return rest; });
    setSlotReplacements((s) => { const { [id]: _drop, ...rest } = s; return rest; });
    if (isLiveRef.current) {
      void act('note', id, { event: 'post_restored' });
      if (wasReplaced) void act('note', id, { event: 'slot_replace_undone' });
    }
  };
  // Open-slot: pull a ready draft from the pool into the freed slot. The slot stays flagged
  // removed (the original is vetoed) and now carries the replacement. Logged angle_swap-style.
  const pickReplacement = (id: string, item: PoolDraft) => {
    setSlotReplacements((s) => ({ ...s, [id]: { draft_id: item.id, title: item.title, body: item.body } }));
    flash(id);
    if (isLiveRef.current) { void act('note', id, { event: 'slot_replaced', draft_id: item.id, title: item.title ?? null, hook: (item.body || '').slice(0, 120) }); }
  };
  // Open-slot: fill the freed slot with one of the slot's own bench angles. This restores
  // the slot and applies the angle swap (the existing same-slot swap path).
  const pickReplacementAngle = (id: string, alt: AltAngle) => {
    setWeekSkips((s) => { const { [id]: _drop, ...rest } = s; return rest; });
    setSlotReplacements((s) => { const { [id]: _drop, ...rest } = s; return rest; });
    setAngleSwaps((s) => ({ ...s, [id]: alt }));
    flash(id);
    if (isLiveRef.current) {
      void act('note', id, { event: 'post_restored' });
      void act('note', id, { event: 'angle_swap', alt_id: alt.id, title: alt.title, hook: alt.hook });
    }
  };
  const undoApprove = () => {
    window.clearTimeout(undoTimer.current);
    setUndo((u) => {
      if (u) {
        // Live: tell the operator the client walked back an approve (truthful, uses the
        // note action — the earlier approve row is not deleted, it is superseded by this).
        if (u.kind === 'approve' && isLiveRef.current) { void act('note', u.id, { event: 'undo_approve' }); }
        if (u.kind === 'skip' && isLiveRef.current) { void act('note', u.id, { event: 'post_restored' }); }
        if (u.kind === 'angle' && isLiveRef.current) { void act('note', u.id, { event: 'angle_swap_undone' }); }
        if (u.kind === 'approve') setStageOverride((s) => { const { [u.id]: _drop, ...rest } = s; return rest; });
        else if (u.kind === 'angle') setAngleSwaps((s) => { const { [u.id]: _drop, ...rest } = s; return rest; });
        else setWeekSkips((s) => { const { [u.id]: _drop, ...rest } = s; return rest; });
        flash(u.id);
      }
      return null;
    });
  };
  // Z restores the last approve while the toast is up.
  useEffect(() => {
    if (!undo) return;
    const h = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (e.key === 'z' || e.key === 'Z') { e.preventDefault(); undoApprove(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undo]);

  // E1 — opening choreography (once per browser): the "Generating…" draft finishes its
  // remaining agent steps live, then travels up into "Your review". Local state theater
  // with honest verbs — the same steps the engine actually runs, no fabricated metrics.
  useEffect(() => {
    // The intro now targets the week HOME (the finishing card lands in its day slot);
    // it also runs from All content so ?intro=1 replays work from either surface.
    if (state !== 'ready' || !board || (tab !== 'week' && tab !== 'review') || introRan.current || reduceMotion) return;
    try { if (localStorage.getItem(introKey)) return; } catch { return; }
    const d1 = board.queue.find((q) => q.id === 'd1' && q.generating);
    if (!d1) return;
    introRan.current = true;

    const patch = (fn: (q: QueueItem) => QueueItem) =>
      setBoard((prev) => prev ? { ...prev, queue: prev.queue.map((q) => (q.id === 'd1' ? fn({ ...q }) : q)) } : prev);
    // Steps that arrive already-done keep their stored detail + timestamp — the
    // choreography only finishes what the data left pending.
    const completeStep = (name: string, detail: string, next?: AgentStep) => (q: QueueItem): QueueItem => {
      let trail = (q.agent_trail || []).map((s) =>
        s.step === name ? (s.done ? { ...s, done: true } : { ...s, done: true, t: 'just now', detail }) : s);
      if (next && !trail.some((s) => s.step === next.step)) trail = [...trail, next];
      return { ...q, agent_trail: trail };
    };

    // Timers live in a ref cleared only on unmount: the patches below change `board`,
    // which re-fires this effect — a dep-tied cleanup would kill the choreography mid-run.
    // Step names mirror the stored trails exactly (client vocabulary, no internal tool names).
    const at = (ms: number, fn: () => void) => introTimers.current.push(window.setTimeout(fn, ms));
    at(1300, () => patch((q) => completeStep('Hook agent', INTRO_DONE_DETAILS['Hook agent'], { step: 'Draft agent', detail: 'writing the first draft…', done: false, t: 'now' })({ ...q, live_step: 'Opening chosen' })));
    at(2900, () => patch((q) => completeStep('Draft agent', INTRO_DONE_DETAILS['Draft agent'], { step: 'Copy quality gate', detail: 'reading it back…', done: false, t: 'now' })({ ...q, live_step: 'Written · rewrote once after a self-review' })));
    at(4300, () => patch((q) => completeStep('Copy quality gate', INTRO_DONE_DETAILS['Copy quality gate'], { step: 'Image check', detail: 'checking the image…', done: false, t: 'now' })({ ...q, live_step: 'Quality check passed, nothing flagged' })));
    at(5500, () => patch((q) => completeStep('Image check', INTRO_DONE_DETAILS['Image check'])({ ...q, live_step: 'Ready for your review' })));
    at(6700, () => {
      patch((q) => ({
        ...q,
        stage: 'review',
        generating: false,
        live_step: undefined,
        body: q.body || D1_DRAFT_BODY,
      }));
      flash('d1');
      try { localStorage.setItem(introKey, '1'); } catch { /* private mode */ }
    });
  }, [state, board, tab, reduceMotion]);

  useEffect(() => {
    let cancelled = false;

    // Shared: turn a get_client_board / get_client_board_by_session response into
    // board state. Returns true if it produced a renderable / pre-render state,
    // false if the payload was empty (caller decides the fallback).
    const applyBoardData = (data: any): boolean => {
      if (!data) return false;
      const rowMode = data.mode || 'demo';
      // The board-generator service reserves the row in 'generating' before the full
      // jsonb exists, then flips it to 'preview' (done) or 'failed'. In those pre-render
      // states the board is a minimal placeholder — show a dedicated screen instead of
      // trying to render an empty board (which would read as the invalid-link error).
      if (rowMode === 'generating' || rowMode === 'failed') {
        setPendingCompany((data.board?.company_name as string) || '');
        setState(rowMode);
        return true;
      }
      let b = data.board as Board;
      // Once the intro has played (or motion is reduced and it never will), the choreography
      // card must land as a normal completed review card — never a stuck "Generating…" row.
      const introPlayed = (() => {
        try { return !!localStorage.getItem(introKey); } catch { return true; }
      })();
      if (introPlayed || reduceMotion) {
        b = {
          ...b,
          queue: b.queue.map((q) => q.id === 'd1' && q.generating
            ? { ...q, stage: 'review' as Stage, generating: false, body: q.body || D1_DRAFT_BODY, agent_trail: (q.agent_trail || []).map((s) => (s.done ? s : { ...s, done: true, detail: INTRO_DONE_DETAILS[s.step] ?? s.detail })) }
            : q),
        };
        if (!introPlayed) { try { localStorage.setItem(introKey, '1'); } catch { /* private mode */ } }
      }
      if (b.logo_url) { const img = new Image(); img.src = b.logo_url; }
      setBoard(b);
      setMode(data.mode || 'demo');
      setState('ready');
      return true;
    };

    // Load a board using a magic-link session token. On failure clears the stored
    // session and returns false so the caller can drop to the sign-in screen.
    const loadBySession = async (sessSlug: string, sessionToken: string): Promise<boolean> => {
      const { data, error } = await supabase.rpc('get_client_board_by_session', { p_slug: sessSlug, p_session: sessionToken });
      if (cancelled) return true; // unmounted — treat as handled
      if (error || !data) { clearBoardSession(sessSlug); setSession(null); return false; }
      return applyBoardData(data);
    };

    (async () => {
      if (!slug) { setState('invalid'); return; }
      if (forceIntro) {
        // Replay support: drop the played flag (and any stale approval/angle/skip of the
        // intro card) BEFORE the board mounts, so the choreography runs again from the top.
        try { localStorage.removeItem(introKey); } catch { /* private mode */ }
        setStageOverride((s) => { const { d1: _drop, ...rest } = s; return rest; });
        setAngleSwaps((s) => { const { d1: _drop, ...rest } = s; return rest; });
        setWeekSkips((s) => { const { d1: _drop, ...rest } = s; return rest; });
      }

      // (a) ?k= token present → existing RPC path, BYTE-IDENTICAL. Session code
      // never runs while a ?k= is in the URL.
      if (token) {
        const { data, error } = await supabase.rpc('get_client_board', { p_slug: slug, p_token: token });
        if (cancelled) return;
        if (error || !data || !applyBoardData(data)) { setState('invalid'); return; }
        return;
      }

      // (b) #ml=<token> fragment → redeem into a session, strip the fragment, load.
      const ml = readMagicLinkFragment();
      if (ml) {
        const { data, error } = await supabase.rpc('redeem_board_login', { p_slug: slug, p_secret: ml, p_kind: 'link' });
        stripMagicLinkFragment();
        if (cancelled) return;
        const res = (data as any) || null;
        if (!error && res?.ok && res.session_token) {
          const sess: BoardSession = { token: res.session_token, email: res.email, expires_at: res.expires_at };
          saveBoardSession(slug, sess);
          setSession(sess);
          if (await loadBySession(slug, sess.token)) return;
        }
        // redeem failed (expired / already used) → fall through to stored session / sign-in.
      }

      // (c) stored session → load by session; on failure fall to sign-in.
      const stored = sessionRef.current ?? loadBoardSession(slug);
      if (stored?.token) {
        if (await loadBySession(slug, stored.token)) return;
      }

      // (d) no ?k=, no valid session → the sign-in screen.
      if (!cancelled) setState('signin');
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, token]);

  // While the board is still generating, poll the row every 15s. When it flips to a
  // renderable mode, reload once so the full loader (intro choreography included) runs
  // cleanly; if it fails, drop to the failed screen.
  useEffect(() => {
    if (state !== 'generating' || !slug || !token) return;
    let stopped = false;
    const id = setInterval(async () => {
      const { data, error } = await supabase.rpc('get_client_board', { p_slug: slug, p_token: token });
      if (stopped || error || !data) return;
      const m = (data as any).mode || 'demo';
      if (m === 'failed') { setPendingCompany(((data as any).board?.company_name as string) || pendingCompany); setState('failed'); }
      else if (m !== 'generating') { window.location.reload(); }
    }, 15000);
    return () => { stopped = true; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, slug, token]);

  // Load the client's heading font so the board carries their type, not ours.
  const headingFont = board?.brand?.font_heading;
  useEffect(() => {
    if (!headingFont) return;
    const id = 'client-board-font';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(headingFont).replace(/%20/g, '+')}:wght@400;500;600;700&display=swap`;
    document.head.appendChild(link);
  }, [headingFont]);

  // Instrument Sans stands in for LinkedIn's system UI font inside the feed previews.
  // Scoped to this route; DM Serif / Source Serif / IBM Plex Mono ship in the global kit.
  useEffect(() => {
    const id = 'client-board-ui-font';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600&display=swap';
    document.head.appendChild(link);
  }, []);

  const accent = cleanHex(board?.brand?.accent_hex);
  const mint = cleanHex(board?.brand?.accent_secondary || board?.brand?.accent_hex);
  // Visual skin. An explicit ?skin= param wins in BOTH directions (so a blackbox-default
  // board can be forced back to editorial for review); else a board.skin / brand.skin
  // field; else blackbox (site default — override per-client with skin:'editorial').
  const skinParam = params.get('skin');
  const skin: 'editorial' | 'blackbox' =
    skinParam === 'blackbox' ? 'blackbox'
    : skinParam === 'editorial' ? 'editorial'
    : (board as any)?.skin === 'editorial' || (board?.brand as any)?.skin === 'editorial' ? 'editorial'
    : 'blackbox';
  // Blackbox loads Schibsted Grotesk (display/labels/body) + Source Serif 4 italic (clinical
  // asides only). Courier Prime is NOT loaded; it is dispensed-label-artifact only, never UI.
  useEffect(() => {
    if (skin !== 'blackbox') return;
    const id = 'client-board-blackbox-font';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400;500;700;800;900&family=Source+Serif+4:ital,opsz,wght@1,8..60,400;1,8..60,600&display=swap';
    document.head.appendChild(link);
  }, [skin]);
  // The blackbox var map: paper white, ink black, grotesk everywhere, no shadows. Editorial
  // sets NONE of these (falls back to the literals in the token block), so it is untouched.
  const SKIN_VARS: Record<string, string> = skin === 'blackbox' ? {
    '--cb-ink': '#131210', '--cb-paper': '#FFFFFF', '--cb-paper-raise': '#FFFFFF',
    '--cb-paper-sunk': '#F5F3EF', '--cb-desk': '#FFFFFF',
    '--cb-ink-soft': '#3A3833', '--cb-ink-mute': '#6B675E',
    '--cb-line': 'rgba(19,18,16,0.16)', '--cb-line-bold': 'rgba(19,18,16,0.28)', '--cb-divide': 'rgba(19,18,16,0.09)',
    '--cb-serif': '"Schibsted Grotesk", system-ui, sans-serif',
    '--cb-body': '"Schibsted Grotesk", system-ui, sans-serif',
    '--cb-mono': '"Schibsted Grotesk", system-ui, sans-serif',
    '--cb-clinical': '"Source Serif 4", Georgia, serif',
    '--cb-card-shadow': 'none', '--cb-hero-shadow': 'none', '--cb-lift': 'none',
  } : {};
  // Integrity rule: a still-generating card is never approvable — it renders in Drafted
  // regardless of its stored stage, and never counts toward the review badge. An item
  // whose angle was swapped goes back to Drafted too: picking a different idea queues a
  // fresh draft, it never fakes an instant one.
  const stageOf = (q: QueueItem): Stage => (q.generating ? 'drafted' : angleSwaps[q.id] ? 'drafted' : stageOverride[q.id] ?? q.stage);
  // Display resolution for swapped slots: the chosen angle replaces topic + pillar and
  // clears the stale body/media; the trail restarts honestly from "new angle locked".
  const resolveItem = (q: QueueItem): QueueItem => {
    const a = angleSwaps[q.id];
    if (!a) return q;
    return {
      ...q,
      hook: a.hook,
      title: a.title,
      pillar: a.pillar || q.pillar,
      body: undefined,
      media_url: null,
      cover_url: undefined,
      agent_trail: [
        { step: 'New angle locked', detail: 'you picked a different idea for this slot', done: true, t: 'just now' },
        { step: 'Voice model', detail: a.drafts_by ? `writing starts ${fmtDay(a.drafts_by)}` : 'up next', done: false },
        { step: 'Hook agent', done: false },
        { step: 'Draft agent', done: false },
        { step: 'Copy quality gate', done: false },
        { step: 'Image check', detail: 'then it lands back in your review', done: false },
      ],
    };
  };
  // Schedule overlay: a draft the operator scheduled carries its real date (and moves to
  // the Scheduled stage). Applied before angle-swap resolution so swaps stay honest.
  const withSchedule = (q: QueueItem): QueueItem => {
    const s = schedule[q.id];
    if (!s) return q;
    // Explicitly unscheduled (client put it back in the buffer): strip the slot so it
    // drops off the week grid + up-next and rejoins the buffer bucket. The board jsonb may
    // still carry a stale publish_date; this overlay is the live truth.
    if (!s.scheduled_at) {
      const { publish_date: _pd, scheduled_at: _sa, ...rest } = q;
      return rest as QueueItem;
    }
    // Always carry the full scheduled_at (so every surface can render the time in the
    // client's timezone) and refresh publish_date from it. Only a draft the operator moved
    // to the 'scheduled' status flips stage; a review-stage buffer draft with a slot keeps
    // its stage (it is scheduled-for-display, still yours to change).
    const flip = s.status === 'scheduled' && q.stage !== 'published';
    return { ...q, scheduled_at: s.scheduled_at, publish_date: s.scheduled_at.slice(0, 10), ...(flip ? { stage: 'scheduled' as Stage } : {}) };
  };
  // Auto lifestyle photos (live, display-only, NO write): rotate the client's photo pool
  // onto ~60% of eligible solo TEXT posts, deterministically by draft id so it is stable
  // across reloads (never random per render). Eligible = a plain post that is NOT a lead
  // magnet launch and NOT a carousel and has NO image already (a manual attach always wins).
  // Empty pool → nothing assigned. Round-robin over the pool (ordered by name) so the same
  // photo never lands back-to-back. Computed from the RAW queue; keyed by draft id.
  const autoPhoto = useMemo(() => {
    const map: Record<string, string> = {};
    if (!board || photoPool.length === 0) return map;
    const hashStr = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
    const eligible = board.queue
      .filter((q) => q.kind === 'post' && !q.lm_launch && q.source_detail?.kind !== 'lm_launch' && !q.media_url)
      .slice()
      .sort((a, b) => a.id.localeCompare(b.id));
    let ri = 0;
    for (const q of eligible) {
      if (hashStr(q.id) % 100 < 60) { map[q.id] = photoPool[ri % photoPool.length]; ri++; }
    }
    return map;
  }, [board, photoPool]);
  const viewBoard = useMemo(
    () => (board ? { ...board, queue: board.queue.map((q) => resolveItem(withSchedule(q))).map((q) => (!q.media_url && autoPhoto[q.id]) ? { ...q, media_url: autoPhoto[q.id] } : q) } : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [board, angleSwaps, schedule, autoPhoto],
  );
  // Deep-link: /client/:slug?token=...&post=<draft-id> (or #post-<id>) opens that post's
  // detail. The week-1 brief links each scheduled post this way. Harmless on any board:
  // an unknown id simply no-ops. Runs once the board is ready and clears the param so a
  // manual close does not re-open it. Only opens a real queue item that has a body.
  const deepLinkedRef = useRef(false);
  useEffect(() => {
    if (state !== 'ready' || !viewBoard || deepLinkedRef.current) return;
    let postId = params.get('post') || '';
    if (!postId && typeof window !== 'undefined') {
      const m = /(?:^|#)post-([0-9a-fA-F-]{6,})/.exec(window.location.hash || '');
      if (m) postId = m[1];
    }
    if (!postId) return;
    const hit = viewBoard.queue.find((q) => q.id === postId || q.id.slice(0, postId.length) === postId);
    deepLinkedRef.current = true;
    if (hit) setDetail(hit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, viewBoard]);
  // The bench for a slot: its seeded alternates; once an angle is picked, the ORIGINAL
  // topic joins the bench (the rejected angle is benched, never lost).
  const benchFor = (id: string): AltAngle[] => {
    const raw = board?.queue.find((q) => q.id === id);
    if (!raw) return [];
    const chosen = angleSwaps[id];
    const pool = raw.alt_angles || [];
    if (!chosen) return pool;
    return [
      ...pool.filter((a) => a.id !== chosen.id),
      { id: `${id}-original`, title: 'The original angle', hook: raw.hook || raw.title || '', pillar: raw.pillar, drafts_by: chosen.drafts_by },
    ];
  };
  // 'demo' (legacy) and 'preview' (current) mean the same thing — the board is a
  // built-ahead preview, not a live account. Reads both so a data migration can't break it.
  const isPreview = mode === 'demo' || mode === 'preview';
  // Live mode = the production tool (not a built-ahead demo). Drives copy stripping, tab
  // removal (Voice + standalone Photos), real RPC actions, and the pricing/pause hide.
  const isLive = !isPreview;
  isLiveRef.current = isLive;

  // Per-board share metadata (mirrors ScanReportPage). Sets the title + a NEUTRAL OG about
  // a content preview built for this company — never Ivan's agency pitch — and an OG image
  // that is the board's own brand asset (or a house fallback), never ivan-portrait.jpg.
  // This kills the portrait unfurl for JS-rendering scrapers even on boards not yet
  // prerendered, and bakes correctly into the static HTML that scripts/prerender.mjs emits.
  // useMetadata is a hook, so it runs every render; the values simply update once the board
  // loads. noindex keeps these private prospect demos out of search.
  const ogCompany = board?.company_name || pendingCompany || 'Your brand';
  const ogImage = board?.brand?.logo_light || board?.logo_url || board?.brand?.logo_dark || 'https://ivanmanfredi.com/og-scorecard.png';
  useMetadata({
    // LIVE boards are a production tool, not a pitch. Preview keeps the exact legacy
    // strings: the mirror prerender matches the literal '· content preview' title.
    title: isLive ? `${ogCompany} · content board` : `${ogCompany} · content preview`,
    description: isLive
      ? 'Your content board: drafts in review, calendar, lead magnets, leads, and performance.'
      : `A month of content built for ${ogCompany} to preview: LinkedIn posts, carousels, and a live lead magnet, themed to your brand and ready to approve.`,
    canonical: slug ? `https://ivanmanfredi.com/client/${slug}` : undefined,
    ogImage,
    noindex: true,
  });

  // Favicon only: swap the tab icon to the client's mark. Title + OG are owned by
  // useMetadata above; this just makes the browser tab read as the client's board.
  useEffect(() => {
    if (state !== 'ready' || !board) return;
    const link = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
    const prevHref = link?.getAttribute('href') || '';
    const prevType = link?.getAttribute('type') || '';
    const fav = board.logo_url || board.brand?.logo_light;
    if (link && fav) { link.href = fav; link.removeAttribute('type'); }
    return () => {
      if (link && prevHref) { link.setAttribute('href', prevHref); if (prevType) link.setAttribute('type', prevType); }
    };
  }, [state, board]);

  // Calendar chip click: linked items open the real draft; planned slots open a
  // pipeline preview of what the engine will do for that topic.
  const openCalendarItem = (it: CalendarItem) => {
    const linked = it.ref ? viewBoard?.queue.find((q) => q.id === it.ref) : null;
    if (linked) { setDetail(linked); return; }
    const d = new Date(it.date + 'T00:00:00');
    const rawDraft = new Date(d.getTime() - 2 * 86400000).toISOString().slice(0, 10);
    const engineStart = board?.calendar?.start || '';
    const draftDay = engineStart && rawDraft < engineStart ? engineStart : rawDraft;
    setDetail({
      id: `cal-${it.date}-${it.kind}`,
      kind: (it.kind === 'newsjack' ? 'post' : it.kind) as QueueItem['kind'],
      stage: 'planned',
      pillar: it.pillar,
      hook: it.label,
      publish_date: it.date,
      agent_trail: [
        { step: 'Queued', detail: 'this date is locked in for the topic above', done: true },
        { step: 'Voice model', detail: `writing starts ${fmtDay(draftDay)}`, done: false },
        { step: 'Hook agent', done: false },
        { step: 'Draft agent', done: false },
        { step: 'Copy quality gate', done: false },
        { step: it.kind === 'lm' ? 'Assessment builder' : 'Brand image', done: false },
        { step: 'Image check', detail: 'then it lands in your review', done: false },
      ],
    });
  };

  // Newsletter issue click: the linked issue opens the real queue item; planned issues
  // open the planned-slot pipeline preview with a nurture-appropriate trail.
  const openNewsletterIssue = (it: NewsletterIssue) => {
    const linked = it.ref ? viewBoard?.queue.find((q) => q.id === it.ref) : null;
    // Issue bodies live on the issue record (newsletter.issues[n].body); the queue item
    // is the schedule entry. Inject so the modal reads the full email.
    if (linked) { setDetail(it.body && !linked.body ? { ...linked, body: it.body } : linked); return; }
    const d = new Date(it.date + 'T00:00:00');
    const rawDraft = new Date(d.getTime() - 2 * 86400000).toISOString().slice(0, 10);
    const engineStart = board?.calendar?.start || '';
    const draftDay = engineStart && rawDraft < engineStart ? engineStart : rawDraft;
    const fromDomain = board?.newsletter?.from_domain;
    setDetail({
      id: `nl-${it.id}`,
      kind: 'newsletter',
      stage: 'planned',
      hook: it.title,
      publish_date: it.date,
      agent_trail: [
        { step: 'Queued', detail: 'this send date is locked in', done: true },
        { step: 'Voice model', detail: `writing starts ${fmtDay(draftDay)}`, done: false },
        { step: 'Draft agent', detail: "pulls the week's numbers and stories", done: false },
        { step: 'Copy quality gate', done: false },
        { step: 'Email render', detail: fromDomain ? `sends from ${fromDomain}` : undefined, done: false },
        { step: 'Image check', detail: 'then it lands in your review', done: false },
      ],
    });
  };

  if (state === 'loading') {
    return <BoardSkeleton />;
  }
  if (state === 'generating') {
    const who = pendingCompany ? `${pendingCompany}'s` : 'your';
    return (
      <div className="flex min-h-screen items-center justify-center px-6" style={{ background: PAPER, color: INK }}>
        <style>{`@keyframes cb-build { 0%,100% { opacity:.3 } 50% { opacity:1 } } @media (prefers-reduced-motion: reduce){ .cb-build-dot{ animation:none !important } }`}</style>
        <div className="w-full max-w-md text-center">
          <div className="uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.22em', color: INK_MUTE }}>Content desk</div>
          <h1 className="mt-4" style={{ fontFamily: SERIF, fontSize: 30, lineHeight: 1.15, color: INK }}>
            We're building {who} board<span style={{ color: '#2A8F65' }}>.</span>
          </h1>
          <p className="mx-auto mt-3 max-w-sm" style={{ fontFamily: BODY, fontSize: 15, color: DIM }}>
            The engine is reading your brand, drafting a month of posts, and theming your lead magnet. This takes a few minutes. The page turns itself on the moment it's ready, so you can leave it open.
          </p>
          <div className="mt-7 flex items-center justify-center gap-1.5" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span key={i} className="cb-build-dot" style={{ width: 7, height: 7, borderRadius: 99, background: '#2A8F65', display: 'inline-block', animation: 'cb-build 1.4s ease-in-out infinite', animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
          <div className="mt-3 uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.18em', color: INK_MUTE }}>Checking again every few seconds</div>
        </div>
      </div>
    );
  }
  if (state === 'failed') {
    return (
      <div className="flex min-h-screen items-center justify-center px-6" style={{ background: PAPER, color: INK }}>
        <div className="w-full max-w-md text-center">
          <div className="uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.22em', color: INK_MUTE }}>Content desk</div>
          <h1 className="mt-4" style={{ fontFamily: SERIF, fontSize: 28, lineHeight: 1.15, color: INK }}>
            This board didn't finish building<span style={{ color: '#2A8F65' }}>.</span>
          </h1>
          <p className="mx-auto mt-3 max-w-sm" style={{ fontFamily: BODY, fontSize: 15, color: DIM }}>
            Something interrupted the run. Nothing is wrong on your end. Ask your operator to kick it off again, they'll have a fresh link for you in a few minutes.
          </p>
        </div>
      </div>
    );
  }
  if (state === 'signin') {
    return (
      <BoardSignIn
        slug={slug || ''}
        onAuthed={(sess) => {
          if (slug) saveBoardSession(slug, sess);
          setSession(sess);
          // Reload so the stored-session load path (c) renders the board cleanly
          // (full remount, same as the generating→ready reload).
          window.location.reload();
        }}
      />
    );
  }
  if (state === 'invalid' || !board || !viewBoard) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6" style={{ background: FRAME_BG }}>
        <div className="max-w-sm rounded-xl bg-white p-8 text-center" style={{ border: `1px solid ${LINE}`, boxShadow: CARD_SHADOW }}>
          <div className="text-[16px] font-semibold" style={{ color: INK }}>This preview link isn't valid or has expired.</div>
          <p className="mt-2 text-[14px]" style={{ color: DIM }}>Ask your operator for a fresh link.</p>
        </div>
      </div>
    );
  }

  const fontStack = headingFont ? `"${headingFont}", Inter, system-ui, sans-serif` : 'Inter, system-ui, sans-serif';
  const openDetail = (q: QueueItem, opts?: { changing?: boolean; editing?: boolean; scheduling?: boolean }) => { setDetail(q); setDetailChanging(!!opts?.changing); setDetailEditing(!!opts?.editing); setDetailScheduling(!!opts?.scheduling); };
  const scheduledIds = new Set(viewBoard.queue.filter((q) => stageOf(q) === 'scheduled').map((q) => q.id));
  const approvedIds = new Set(Object.keys(stageOverride).filter((id) => stageOverride[id] === 'scheduled'));
  const surfaces: Record<TabId, React.ReactNode> = {
    week: (
      <WeekSurface
        board={viewBoard}
        accent={accent}
        mint={mint}
        stageOf={stageOf}
        approvedIds={approvedIds}
        angleSwaps={angleSwaps}
        skips={weekSkips}
        benchFor={benchFor}
        pool={replacementPool}
        onPickReplacement={pickReplacement}
        onBackToBuffer={backToBuffer}
        onLeaveDayEmpty={leaveDayEmpty}
        onSetSchedule={setScheduleRPC}
        onClearDay={clearDay}
        onScheduleToDay={scheduleToDay}
        recentlyCleared={recentlyCleared}
        leftEmpty={leftEmpty}
        onLeaveEmpty={leaveEmpty}
        onRefillDay={refillDay}
        onOpen={openDetail}
        onOpenCal={openCalendarItem}
        onApprove={approve}
        onPickAngle={pickAngle}
        onSkip={skipDay}
        onUnskip={unskipDay}
        onGoContent={() => goTab('review')}
        flashId={flashId}
        modalOpen={!!detail}
        live={isLive}
      />
    ),
    review: <ReviewSurface board={viewBoard} accent={accent} mint={mint} stageOf={stageOf} onOpen={openDetail} onOpenIdea={setIdeaPreview} onApprove={approve} onRemove={skipDay} leftEmpty={leftEmpty} onLeaveEmpty={leaveEmpty} onRefillDay={refillDay} onBackToBuffer={backToBuffer} onLeaveDayEmpty={leaveDayEmpty} onClearDay={clearDay} onEditPromo={editLmPromo} flashId={flashId} view={contentView} setView={setContentView} skips={weekSkips} replacements={slotReplacements} pool={replacementPool} benchFor={benchFor} onRestore={restoreSlot} onPickReplacement={pickReplacement} onPickReplacementAngle={pickReplacementAngle} live={isLive} foldPhotos={isLive ? <PhotosSurface board={viewBoard} accent={accent} slug={slug || ''} compact onDeletePhoto={deletePhoto} /> : null} />,
    calendar: <CalendarSurface board={viewBoard} accent={accent} mint={mint} onOpen={openCalendarItem} scheduledIds={scheduledIds} live={isLive} />,
    lm: <LeadMagnetSurface board={viewBoard} accent={accent} mint={mint} fontStack={fontStack} live={isLive} onEditPromo={editLmPromo} />,
    newsletter: <NewsletterSurface board={viewBoard} accent={accent} fontStack={fontStack} onOpenIssue={openNewsletterIssue} live={isLive} />,
    voice: <VoiceSurface board={viewBoard} accent={accent} fontStack={fontStack} />,
    photos: <PhotosSurface board={viewBoard} accent={accent} slug={slug || ''} />,
    outreach: <OutreachSurface board={viewBoard} accent={accent} usage={outreachUsage} log={outreachLog} />,
    leads: <LeadsSurface board={viewBoard} accent={accent} preview={isPreview} onOpen={setLeadDetail} live={isLive} usage={outreachUsage} log={outreachLog} />,
    performance: <PerformanceSurface board={viewBoard} accent={accent} live={isLive} />,
    strategy: <StrategySurface board={viewBoard} accent={accent} mint={mint} isLive={isLive} act={act} />,
    team: <TeamSurface slug={slug || ''} accent={accent} session={session} />,
  };

  const logo = (h: number) => (
    board.logo_url
      ? <img src={board.logo_url} alt={board.company_name} style={{ height: h, width: 'auto', maxWidth: 150, objectFit: 'contain', display: 'block' }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
      : <span className="text-[14px] font-semibold" style={{ fontFamily: fontStack, color: INK }}>{board.company_name}</span>
  );

  // Badge = pieces actually awaiting an action: generating, swapped and skipped excluded.
  const reviewCount = viewBoard.queue.filter((q) => stageOf(q) === 'review' && !weekSkips[q.id]).length;
  const scheduledCount = viewBoard.queue.filter((q) => stageOf(q) === 'review' && !weekSkips[q.id] && isScheduled(q)).length;
  const bufferCount = reviewCount - scheduledCount;
  const founderName = board.founder?.name || board.company_name;
  const goTab = (id: TabId) => { setTab(id); window.scrollTo({ top: 0 }); };
  // Live mode = production tool: drop the Voice tab and the standalone Photos tab (photos
  // fold into the content surface). Team (self-serve invites) is live-only — preview
  // boards are demo funnels with no allow-list to manage.
  // Outreach is a first-class tab, but it only carries a live send program — preview
  // demo boards and boards with no outreach package don't show it.
  const outreachAvailable = isLive && !!viewBoard.outreach;
  const visibleTabs = (isLive
    ? TABS.filter((t) => t.id !== 'voice' && t.id !== 'photos')
    : TABS.filter((t) => t.id !== 'team')
  ).filter((t) => t.id !== 'outreach' || outreachAvailable);
  const activeTab: TabId = isLive
    ? (tab === 'voice' || tab === 'photos' || (tab === 'outreach' && !outreachAvailable) ? 'week' : tab)
    : (tab === 'team' || tab === 'outreach' ? 'week' : tab);

  return (
    <MotionConfig reducedMotion="user">
    <style>{`
@keyframes cb-pulse { 0%,100% { opacity:1; transform:scale(1) } 50% { opacity:.35; transform:scale(.72) } }
.cb-pulse { animation: cb-pulse 1.6s ease-in-out infinite; }
@keyframes cb-rowgrow { 0% { opacity:0; transform:translateY(-10px) scaleY(.92) } 100% { opacity:1; transform:translateY(0) scaleY(1) } }
@media (prefers-reduced-motion: reduce) { .cb-pulse { animation: none !important } }

/* ============ BLACK BOX skin composition overrides (scoped) ============ */
/* Tailwind rounded and shadow utilities plus inline radii are compiled, so CSS vars
   cannot neutralize them. These scoped rules enforce Black Box structure without editing
   hundreds of class strings: sharp corners everywhere, planes not cards, no shadows. */
[data-skin="blackbox"] * { border-radius: 0 !important; }
/* Planes, not cards: kill every drop shadow on chrome (compiled Tailwind shadow-* and
   inline shadows both). The LinkedIn preview card is re-granted a subtle platform shadow. */
[data-skin="blackbox"] * { box-shadow: none !important; }
[data-skin="blackbox"] .cb-linkedin-preview { box-shadow: 0 1px 2px rgba(19,18,16,0.06) !important; }
/* Black Box labels + eyebrows: uppercase 700 grotesk. */
[data-skin="blackbox"] .uppercase { font-weight: 700 !important; }
/* Schibsted carries no italic face: the browser fauxes an oblique on numerals and accent
   phrases. Blackbox renders them upright (weight carries the emphasis); editorial keeps
   its true DM Serif italics. */
[data-skin="blackbox"] .cb-num-serif { font-style: normal !important; font-weight: 800; }
[data-skin="blackbox"] .cb-accent-phrase { font-style: normal !important; }
/* Display headings: Schibsted Grotesk 800, tight tracking. */
[data-skin="blackbox"] h1, [data-skin="blackbox"] h2, [data-skin="blackbox"] h3,
[data-skin="blackbox"] .cb-display { font-weight: 800 !important; letter-spacing: -0.035em; }
/* Platform-artifact exception: the LinkedIn post preview keeps its own look: round
   author avatar, rounded reaction badges, platform card corner. Everything ELSE squares. */
[data-skin="blackbox"] .cb-linkedin-preview { border-radius: 10px !important; }
[data-skin="blackbox"] .cb-linkedin-preview .rounded-full { border-radius: 9999px !important; }
/* THE BOX: the single This Week hero card is the house component: heavy printed rule,
   hairline offset outside it, one subtle human tilt. Printed, never floating. */
[data-skin="blackbox"] .cb-hero-deck { transform: rotate(-0.35deg); }
/* The tilt is a desktop-poster flourish; on narrow screens the near-full-width tall card
   would bleed a few px past the viewport, so it sits square (no horizontal overflow). */
@media (max-width: 640px) { [data-skin="blackbox"] .cb-hero-deck { transform: none; } }
[data-skin="blackbox"] .cb-hero-card {
  border: 4px solid var(--cb-ink) !important;
  outline: 1px solid var(--cb-ink);
  outline-offset: 3px;
  box-shadow: none !important;
}
/* Statement plate: the post "image"/quote cover renders paper-on-ink with one accent
   rule, never a flat accent fill plane (which would break the once-per-composition law). */
[data-skin="blackbox"] .cb-cover-plate {
  background: var(--cb-ink) !important;
  border-radius: 0 !important;
  position: relative;
}
[data-skin="blackbox"] .cb-cover-plate::before {
  content: ""; position: absolute; top: 18px; left: 20px;
  width: 44px; height: 4px; background: var(--cb-accent);
}
/* The ON operator mark is fixed anatomy per canon v4.2: always weight 900, always Signal
   red. It does NOT consume the composition's accent budget (the client accent stays gold).
   Paper ground + ink box rule keeps red legible at this small tile size (canon light default). */
[data-skin="blackbox"] .cb-operator-on {
  background: var(--cb-paper) !important;
  color: #C8361B !important;
  font-weight: 900 !important;
  border: 1px solid var(--cb-ink);
}
/* Active day marker: ink-filled with a Signal-accent underbar, so the current day reads at a
   glance instead of a thin outline. Sharp corners (the universal reset already squares it). */
[data-skin="blackbox"] .cb-daytick[data-state="current"] {
  background: var(--cb-ink) !important;
  color: var(--cb-paper) !important;
  border-color: var(--cb-ink) !important;
  position: relative;
}
[data-skin="blackbox"] .cb-daytick[data-state="current"]::after {
  content: ""; position: absolute; left: -1px; right: -1px; bottom: -4px;
  height: 3px; background: var(--cb-accent);
}

/* ============ Polish: calendar (C2) ============ */
/* Chips nudge right and deepen on hover — travel, not scale (planes, not cards). */
.cb-cal-chip { transition: transform .16s cubic-bezier(.25,1,.5,1), filter .16s ease; }
.cb-cal-chip:hover { transform: translateX(2px); filter: brightness(.96); }
/* Day cells take a whisper of ink on hover so the grid answers the cursor. */
.cb-cal-cell { transition: background-color .16s ease; }
.cb-cal-cell:hover { background: rgba(19,18,16,0.025); }
/* Week rows print top-down on mount. */
@keyframes cb-cal-row-in { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
.cb-cal-row { animation: cb-cal-row-in .38s cubic-bezier(.25,1,.5,1) both; }
@media (prefers-reduced-motion: reduce) {
  .cb-cal-chip, .cb-cal-cell { transition: none }
  .cb-cal-chip:hover { transform: none }
  .cb-cal-row { animation: none }
}

/* ============ Polish: ledger rows ============ */
/* Hover draws the house accent rule down the row's left edge — the BB accent-rule
   grammar answering the cursor. No shadows, no lift. */
.cb-ledger-row { position: relative; }
.cb-ledger-row::before {
  content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
  background: var(--cb-accent); transform: scaleY(0); transform-origin: 50% 50%;
  transition: transform .18s cubic-bezier(.25,1,.5,1);
}
.cb-ledger-row:hover::before, .cb-ledger-row:focus-visible::before { transform: scaleY(1); }
@media (prefers-reduced-motion: reduce) { .cb-ledger-row::before { transition: none } }

/* ============ Polish: LM library cards ============ */
/* Hover sharpens the frame and lifts 2px — a printed plate picked up, not a floating card. */
.cb-lm-card { transition: transform .18s cubic-bezier(.25,1,.5,1), border-color .16s ease; }
.cb-lm-card:hover, .cb-lm-card:focus-visible { transform: translateY(-2px); border-color: var(--cb-line-bold, rgba(2,49,47,0.3)) !important; }
@media (prefers-reduced-motion: reduce) { .cb-lm-card { transition: none } .cb-lm-card:hover { transform: none } }
`}</style>
    <div className="min-h-screen" data-skin={skin} style={{ background: PAPER, color: INK, fontFamily: BODY, ['--cb-accent' as any]: accent, ['--cb-mint' as any]: mint, ...SKIN_VARS }}>
      {/* The margin rail — 216px, hairline right border, never a gray panel. Wordmark in
          the client heading font + accent period; "This week" the one serif nav item, the
          rest mono caps; record button the rail's only ink-filled element. */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[216px] flex-col lg:flex" style={{ borderRight: `1px solid ${LINE}`, background: PAPER }}>
        <div className="px-6 pb-5 pt-6" style={{ borderBottom: `1px solid ${LINE}` }}>
          {board.brand?.wordmark ? (
            <span style={{ fontFamily: fontStack, fontWeight: 700, fontSize: 22, letterSpacing: '-0.02em', color: INK }}>
              {board.brand.wordmark}<span style={{ color: accent }}>.</span>
            </span>
          ) : logo(28)}
          <div className="mt-1.5 uppercase" style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.22em', color: INK_MUTE }}>content desk</div>
        </div>
        <nav className="flex flex-col gap-5 px-0 py-5" aria-label="Board sections">
          {NAV_GROUPS.filter((g) => visibleTabs.some((t) => t.group === g)).map((g) => (
            <div key={g}>
              <div className="mb-1 px-6 uppercase" style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.2em', color: INK_MUTE, opacity: 0.75 }}>{g}</div>
              <div className="flex flex-col">
                {visibleTabs.filter((t) => t.group === g).map((t) => {
                  const active = activeTab === t.id;
                  const isHero = t.id === 'week';
                  return (
                    <button
                      key={t.id}
                      onClick={() => goTab(t.id)}
                      className="relative flex min-h-[40px] w-full items-center justify-between gap-2 px-6 text-left transition-colors duration-150 hover:bg-[rgba(26,26,26,0.04)]"
                      style={{ borderLeft: `3px solid ${active ? accent : 'transparent'}`, background: active ? caWash(accent, 6) : 'transparent' }}
                    >
                      <span
                        style={isHero
                          ? { fontFamily: SERIF, fontSize: 17, color: INK }
                          : { fontFamily: MONO, fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: active ? INK : INK_MUTE }}
                      >
                        {t.label}
                      </span>
                      {isHero && reviewCount > 0 && (
                        <span className="rounded-full px-2 py-0.5 leading-none tabular-nums" style={{ fontFamily: MONO, fontSize: 10, background: caText(accent), color: PAPER }}><RollingNumber n={reviewCount} /></span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-4 px-6 pb-6 pt-5" style={{ borderTop: `1px solid ${LINE}` }}>
          {/* Idea intake is preview theater only — on live boards ideas queue on the operator side. */}
          {!isLive && (
          <div>
            <div className="mb-2 uppercase" style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.2em', color: INK_MUTE }}>Drop an idea</div>
            <button
              onClick={() => setVoiceOpen(true)}
              className="w-full rounded-md py-2.5 uppercase transition-colors duration-150 hover:opacity-90"
              style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.12em', background: INK, color: PAPER, border: 'none' }}
            >
              ◉ record a voice note
            </button>
            <div className="mt-1.5 text-[10.5px] leading-snug" style={{ fontFamily: BODY, color: INK_MUTE }}>A rough idea in, a drafted post or lead magnet back.</div>
          </div>
          )}
          <div className="flex items-center gap-2 uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.12em', color: INK }}>
            <PulseDot color={accent} size={7} /> {isLive ? (scheduledCount > 0 ? `${scheduledCount} scheduled${bufferCount > 0 ? ` · ${bufferCount} in buffer` : ''}` : bufferCount > 0 ? `${bufferCount} in buffer` : 'live') : 'engine running'}
          </div>
          {isPreview && (
            <div className="flex items-center gap-2 text-[11.5px] leading-snug" style={{ fontFamily: BODY, color: INK_MUTE }}>
              <StatusDot color={mint} size={5} />
              Preview built for {board.company_name}
            </div>
          )}
          <div className="flex items-center gap-2.5 pt-1.5" style={{ borderTop: `1px solid ${LINE}` }}>
            <span className="mt-2.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold" style={{ background: accent, color: inkOn(accent) }} aria-hidden>{initialsOf(founderName)}</span>
            <span className="mt-2.5 min-w-0">
              <span className="block truncate text-[12.5px] font-semibold" style={{ color: INK }}>{founderName}</span>
              <span className="block truncate text-[10.5px]" style={{ fontFamily: MONO, color: INK_MUTE }}>{isLive ? (board.domain || clientBrand(board)) : 'Run by InboundOnSteroids'}</span>
            </span>
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-20 flex items-center gap-2.5 border-b bg-white/85 px-4 py-3 backdrop-blur-md lg:hidden" style={{ borderColor: LINE }}>
        {logo(22)}
        {isPreview && (
          <span className="ml-auto inline-flex items-center gap-2 rounded-full bg-white px-2.5 py-1 text-[11px] font-medium" title="Your first month, built ahead" style={{ border: `1px solid ${LINE}`, color: DIM }}>
            <StatusDot color={mint} size={5} />
            Preview
          </span>
        )}
      </header>

      {/* Main is paper, not a floating white canvas — cards are the only white surfaces.
          A hairline top rule carries the tab name + live-preview mark (mono, quiet). */}
      <div className="lg:ml-[216px]" style={{ background: PAPER }}>
        <div className="sticky top-0 z-10 hidden h-12 items-center gap-2.5 px-8 backdrop-blur lg:flex" style={{ borderBottom: `1px solid ${LINE}`, background: 'rgba(247,244,239,0.86)' }}>
          <span className="uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.18em', color: INK_MUTE }}>{TABS.find((t) => t.id === activeTab)?.label}</span>
          <span
            className="ml-auto inline-flex items-center gap-2 uppercase"
            title={isPreview ? 'Your first month, built ahead' : undefined}
            style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.12em', color: INK_MUTE }}
          >
            <PulseDot color={mint} size={6} />
            {isPreview ? 'Preview · built ahead' : 'Live'}
          </span>
          <span className="ml-4 inline-flex items-center gap-2" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em', color: INK_MUTE }}>
            <span className="cb-operator-on flex h-5 w-5 items-center justify-center rounded-full text-[8.5px] font-bold" style={{ background: INK, color: PAPER, fontFamily: BODY }} aria-hidden>ON</span>
            {isLive ? `OPERATED BY ${clientBrand(board).toUpperCase()}` : 'OPERATED BY INBOUNDONSTEROIDS'}
          </span>
        </div>

        <main className="px-4 pb-[calc(env(safe-area-inset-bottom)+88px)] pt-6 sm:px-6 lg:px-10 lg:pb-16 lg:pt-9">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.2, ease: EASE }}
            >
              {/* Week + Content get the wider two-column editorial layout; others cap tighter. */}
              <div className={`w-full ${activeTab === 'week' ? 'max-w-[1140px]' : activeTab === 'calendar' || activeTab === 'review' ? 'max-w-5xl' : 'max-w-[880px]'}`}>{surfaces[activeTab]}</div>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Mobile bottom tabs */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-white/85 px-1 pt-1 backdrop-blur-md lg:hidden" style={{ borderColor: LINE, paddingBottom: 'max(6px, env(safe-area-inset-bottom))' }}>
        <nav className="grid w-full grid-cols-5" aria-label="Board sections">
          {visibleTabs.map((t) => {
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => goTab(t.id)}
                className="flex min-h-[50px] flex-col items-center justify-center gap-1 rounded-lg px-0.5"
                style={{ color: active ? accent : FAINT }}
              >
                <span className="relative">
                  <NavIcon id={t.id} size={18} />
                  {t.id === 'week' && reviewCount > 0 && (
                    <span className="absolute -right-1.5 -top-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full px-0.5 text-[8.5px] font-bold leading-none tabular-nums" style={{ background: accent, color: inkOn(accent) }}><RollingNumber n={reviewCount} /></span>
                  )}
                </span>
                <span className={`max-w-full truncate text-[9px] leading-tight ${active ? 'font-bold' : 'font-semibold'}`}>{t.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Undo toast: the quiet second half of the approve moment. */}
      <AnimatePresence>
        {undo && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2, ease: EASE }}
            className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+76px)] z-30 flex justify-center px-4 lg:bottom-6"
          >
            <div className="pointer-events-auto flex items-center gap-2 rounded-lg py-1.5 pl-4 pr-1.5 text-[13px] font-medium text-white" style={{ background: INK, boxShadow: '0 8px 24px rgba(2,32,32,0.28)' }}>
              {undo.kind === 'approve' ? 'Post approved' : undo.kind === 'angle' ? 'New angle locked' : isLive ? 'Post removed' : 'Day skipped'}
              <button
                onClick={undoApprove}
                className="ml-1 inline-flex min-h-[32px] items-center gap-1.5 rounded-[6px] px-2.5 text-[12.5px] font-semibold text-white transition-colors duration-150 hover:bg-white/10"
              >
                Undo
                <kbd className="inline-flex h-[16px] min-w-[16px] items-center justify-center rounded-[4px] px-1 text-[10px] leading-none" style={{ fontFamily: MONO, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)' }}>Z</kbd>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {detail && (
        <DetailModal
          item={detail}
          board={board}
          accent={accent}
          stage={stageOf(detail)}
          initialChanging={detailChanging}
          initialEditing={detailEditing}
          initialSchedOpen={detailScheduling}
          onClose={() => { setDetail(null); setDetailChanging(false); setDetailEditing(false); setDetailScheduling(false); }}
          onApprove={approve}
          onRemove={skipDay}
          onHideBuffer={isLive ? removeBufferPost : undefined}
          isLive={isLive}
          act={act}
          editDraft={editDraft}
          setMedia={isLive ? setMedia : undefined}
          setSchedule={isLive ? setScheduleRPC : undefined}
          slug={slug || ''}
          fetchHistory={fetchHistory}
        />
      )}
      {ideaPreview && (
        <IdeaPreviewModal idea={ideaPreview} accent={accent} onClose={() => setIdeaPreview(null)} live={isLive} act={act} />
      )}
      {leadDetail && (
        <LeadDetailModal lead={leadDetail} accent={accent} onClose={() => setLeadDetail(null)} live={isLive} />
      )}
      {voiceOpen && (
        <VoiceNoteModal accent={accent} slug={slug || ''} live={isLive} act={act} onClose={() => setVoiceOpen(false)} />
      )}
    </div>
    </MotionConfig>
  );
}

import type { Raw } from './api';
import { themeFor, type Theme } from './theme';
import { plainSource, plainLane, plainLmStatus, plainActor } from './copy';
import { buildContent, type Content } from './content';

export type PostStatus = 'needs_ok' | 'approved' | 'buffer' | 'scheduled' | 'live' | 'archived';

export type Post = {
  id: string;
  title: string;
  hook: string;
  body: string;
  image?: string;
  images: string[];
  kind: string;
  /** Raw post style (text, single_image, image, carousel, video): decides whether the picture can be swapped. */
  style: string;
  format: string;
  angle?: string;
  status: PostStatus;
  scheduledAt?: string;
  publishedAt?: string;
  url?: string;
  source?: string;
  topic?: string;
  funnel?: string;
  approvedAt?: string;
  approvedBy?: string | null;
  archivedAt?: string;
  lmKeyword?: string;
  lmTitle?: string;
  trail: { step: string; detail?: string; done: boolean }[];
  perf?: { impressions: number; reactions: number; comments: number; reposts: number; reached?: number };
};

export type Person = {
  name: string;
  company?: string;
  when: string;
  kind: 'booked' | 'replied' | 'reached';
  intent?: string | null;
};

export type Window = { label: string; short: string; toggle: string; start: string; end: string; kind: 'period' | 'month' | 'week' };

export type Step = { label: string; value: number };

export type Activity = {
  id: string; at: string; by: string; action: string; title?: string; ref?: string;
  before?: unknown; after?: unknown; note?: string | null; text?: string | null;
};

export type Comment = {
  id: string; ref: string; at: string; by: string; byEmail?: string; text: string; parent: string | null;
  mentions: string[]; resolvedAt?: string | null; resolvedBy?: string | null; local?: boolean;
  /** A note left on one line of the post: the line as it read, kept at the top of the comment. */
  quote?: string;
};

/** Someone a comment can tag. `label` is exactly what the server matches after the @. */
export type Mentionable = { email: string; label: string; display: string };

/** Line notes are stored as ordinary comments that start with the quoted line. */
export const NOTE_RE = /^> (.+)\n\n([\s\S]+)$/;
export function noteText(quote: string, text: string) {
  return `> ${quote.replace(/\s+/g, ' ').trim().slice(0, 240)}\n\n${text}`;
}

export type Model = {
  slug: string;
  theme: Theme;
  company: string;
  wordmark: string;
  founder: { name: string; first: string; headline: string; avatar?: string };
  logo?: string;
  reviewMode: boolean;
  posts: Post[];
  window: Window;
  hasOutreach: boolean;
  results: {
    booked: Person[];
    bookedCount: number;
    replied: Person[];
    repliedCount: number;
    repliedNote?: string;
    positive: Person[];
    positiveNote?: string;
    reached: number | null;
    reachedPeople: Person[];
    reachedByWeek: { start: string; end: string | null; invites: number; accepted: number; replies: number; booked: number }[];
    reachedLabel: string;
  };
  funnel: { label: string; steps: Step[] } | null;
  funnelAll: { label: string; steps: Step[] } | null;
  weekly: { week: string; replied: number; booked: number }[];
  people: Person[];
  leadMagnets: { id: string; title: string; status: string; statusRaw: string; url?: string; cover?: string; optins?: number | null; visitors?: number | null; format?: string }[];
  activity: Activity[];
  lanes: { lane: string; name: string; reached: number; accepted: number; replied: number; booked: number }[];
  lanesNote: string;
  perfNote?: string;
  content: Content;
  /** True when a timestamp falls inside the board's window (same rule for outreach and content). */
  inWindow: (iso?: string | null) => boolean;
  comments: Comment[];
  /** Labels a comment can @mention (board members), longest first for highlighting. */
  team: string[];
  mentionables: Mentionable[];
  /** Plain name for an email: the member's name from the team list, else a readable fallback. */
  nameOf: (email?: string | null) => string;
  me: string | null;
  role: string;
  /** Everyone on the team list, as the server keeps it. */
  members: { email: string; name: string; role: 'admin' | 'approver' | 'viewer'; owner: boolean }[];
  teamCap: number;
};

const NOISE = new Set(['day_left_empty', 'day_refilled', 'slot_replace_undone', 'angle_swap_undone', 'slot_replaced', 'invite', 'shift_request']);

/** Board labels (source, topic, format notes, resource titles) never show a long dash. Post copy is left as written. */
const nd = (v?: string | null) => (v ? v.replace(/\s*[\u2014\u2013]\s*/g, ', ').replace(/,\s*,/g, ',') : v || undefined);

const n = (v: unknown) => (v == null || v === '' ? 0 : Number(v) || 0);

export function dayKey(iso: string | Date, tz: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}

export function addDays(key: string, d: number) {
  const dt = new Date(key + 'T12:00:00Z');
  dt.setUTCDate(dt.getUTCDate() + d);
  return dt.toISOString().slice(0, 10);
}

export function weekOf(now: Date, tz: string) {
  const today = dayKey(now, tz);
  const dow = new Date(today + 'T12:00:00Z').getUTCDay(); // 0 sun
  const monday = addDays(today, -((dow + 6) % 7));
  return { monday, sunday: addDays(monday, 6), today, days: Array.from({ length: 7 }, (_, i) => addDays(monday, i)) };
}

export const fmtDay = (key: string) =>
  new Date(key + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).replace('Sept', 'Sep');

export const fmtWeekday = (key: string, style: 'short' | 'long' = 'short') =>
  new Date(key + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: style, timeZone: 'UTC' });

export function fmtWhen(iso: string, tz: string) {
  const d = new Date(iso);
  const day = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: tz }).replace('Sept', 'Sep');
  const time = d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', timeZone: tz });
  return { day, time };
}

export function ago(iso: string) {
  const h = (Date.now() - new Date(iso).getTime()) / 36e5;
  if (h < 0) return 'soon';
  if (h < 1) return 'just now';
  if (h < 23.5) return `${Math.round(h)}h ago`;
  const d = Math.max(1, Math.round(h / 24));
  if (d === 1) return 'yesterday';
  if (d < 21) return `${d} days ago`;
  return `${Math.round(d / 7)} weeks ago`;
}

const FORMAT: Record<string, string> = {
  text: 'Text post', single_image: 'Single image', carousel: 'Carousel', video: 'Video', image: 'Image post',
};

const POSITIVE = new Set(['positive', 'soft_yes', 'booking']);

const baseUrl = (u?: string | null) => (u || '').split('?')[0].replace(/\/$/, '');
const activityId = (u?: string | null) => (u || '').match(/activity[-:](\d{10,})/)?.[1];

export function buildModel(slug: string, raw: Raw, now = new Date()): Model {
  const b = raw.board || {};
  const theme = themeFor(slug, b);
  const sched = raw.schedule;
  const approved = new Set(raw.slot?.approved || []);
  const removed = new Set(raw.slot?.removed || []);
  const meta = raw.slot?.approved_meta || {};
  const reviewMode = !!b.review_mode;
  const perfPosts: any[] = b.performance?.posts || [];

  const findPerf = (q: any) => {
    const aid = activityId(q.post_url) || activityId(q.social_id);
    return perfPosts.find(p => (aid && activityId(p.url) === aid))
      || perfPosts.find(p => q.post_url && baseUrl(p.url) === baseUrl(q.post_url))
      || perfPosts.find(p => p.title && q.title && p.title === q.title);
  };

  const posts: Post[] = (b.queue || []).filter((q: any) => !removed.has(q.id)).map((q0: any): Post => {
    // carousel_drafts.scheduled_at is the schedule authority; the queue copy is not rewritten on a move.
    const q = sched && q0.id in sched && !(q0.stage === 'published' || q0.published_at) ? { ...q0, scheduled_at: sched[q0.id] } : q0;
    // slot_state.approved also keeps ids of posts that already went out; status is decided by the post first.
    const isApproved = approved.has(q.id);
    let status: PostStatus;
    if (q.archived_at) status = 'archived';
    else if (q.stage === 'published' || q.published_at) status = 'live';
    else if (reviewMode && !isApproved) status = 'needs_ok';
    else if (q.scheduled_at || q.stage === 'scheduled') status = 'scheduled';
    else if (reviewMode) status = 'approved';
    else status = 'buffer';
    const title = q.title || q.hook || '';
    const pm = status === 'live' ? findPerf(q) : undefined;
    const images: string[] = [q.image, q.media_url, ...(q.image_urls || [])].filter((u: any, i: number, a: any[]) => typeof u === 'string' && u && a.indexOf(u) === i);
    const angle = (q.creative_style || '').replace(/^Repurposed · /, '');
    return {
      id: q.id, title, hook: q.hook || title, body: q.post_body || q.body || '',
      image: images[0], images,
      kind: q.kind, style: q.style || '', format: q.style === 'text' && images.length ? 'Post with photo' : FORMAT[q.style] || (q.kind === 'carousel' ? 'Carousel' : 'Post'),
      angle: angle && angle !== FORMAT[q.style] ? nd(angle) : undefined,
      status, scheduledAt: q.scheduled_at || undefined, publishedAt: q.published_at || (status === 'live' ? q.scheduled_at : undefined) || undefined,
      url: q.post_url || undefined, source: nd(plainSource(q.source_label)), topic: nd(q.topic_label),
      funnel: q.funnel_stage || undefined,
      approvedAt: meta[q.id]?.at, approvedBy: meta[q.id]?.by,
      archivedAt: q.archived_at || undefined,
      lmKeyword: q.lm_gate?.keyword, lmTitle: nd(q.lm_gate?.title),
      // The drafter stamps "Written from your discovery call" on every post; keep it only when the source really is a call.
      trail: (q.agent_trail || []).filter((t: any) => t && t.step).map((t: any) => ({
        step: nd(t.step) || '',
        detail: /discovery call/i.test(t.detail || '') && !/call|meet/i.test(q.source_label || '') ? undefined : nd(t.detail),
        done: !!t.done,
      })),
      perf: pm ? { impressions: n(pm.impressions), reactions: n(pm.reactions), comments: n(pm.comments), reposts: n(pm.reposts), reached: pm.network?.members_reached } : undefined,
    };
  });

  const ot = b.outreach_truth || null;
  const hasOutreach = !!ot && !!(ot.month || (ot.leads || []).length || (ot.booked || []).length || (ot.replied_7d || []).length);
  const wk = weekOf(now, theme.tz);
  // One window for every outreach and content number on the board.
  //  1. The board has its own billing period start (theme.periodStart): count from that day.
  //  2. Else the server's report month (outreach_truth.month.window_start).
  //  3. Else this week, Monday to Sunday in the client's zone.
  // The server cuts its report slices (month.by_week) at 00:00 UTC, so 1 and 2 compare UTC days.
  let window: Window;
  let inWin: (iso?: string | null) => boolean;
  const P = theme.periodStart;
  if (P) {
    window = { label: `Since ${fmtDay(P)}`, short: `since ${fmtDay(P)}`, toggle: `Since ${fmtDay(P)}`, start: P, end: wk.today, kind: 'period' };
    inWin = iso => !!iso && iso.slice(0, 10) >= P;
  } else if (ot?.month?.window_start) {
    const start = ot.month.window_start;
    window = { label: `This month · since ${fmtDay(start)}`, short: `since ${fmtDay(start)}`, toggle: 'This month', start, end: wk.today, kind: 'month' };
    inWin = iso => !!iso && iso.slice(0, 10) >= start;
  } else {
    window = { label: `This week · ${fmtDay(wk.monday)} to ${fmtDay(wk.sunday)}`, short: 'this week', toggle: 'This week', start: wk.monday, end: wk.sunday, kind: 'week' };
    inWin = iso => !!iso && dayKey(iso, theme.tz) >= window.start;
  }
  const winStart = window.start;

  const bookedAll: Person[] = ((ot?.booked) || []).map((p: any) => ({ name: clean(p.name), company: p.company || undefined, when: p.booked_at, kind: 'booked' as const, intent: 'booked' }))
    .filter((p: Person) => p.name && p.when)
    .sort((a: Person, b: Person) => b.when.localeCompare(a.when));
  const bookedNames = new Set(bookedAll.map(p => p.name));
  const replied: Person[] = ((ot?.replied_7d) || []).map((p: any) => ({ name: clean(p.name), company: p.company || undefined, when: p.last_reply_at, kind: 'replied' as const, intent: p.reply_intent }))
    .filter((p: Person) => p.name && p.when)
    .sort((a: Person, b: Person) => b.when.localeCompare(a.when));

  const booked = bookedAll.filter(p => inWin(p.when));
  const repliedWin = replied.filter(p => inWin(p.when)).map(p => (bookedNames.has(p.name) ? { ...p, intent: 'booked' } : p));
  const positive = repliedWin.filter(p => POSITIVE.has(p.intent || '') || p.intent === 'booked');
  for (const p of booked) if (!positive.some(x => x.name === p.name)) positive.push(p);
  positive.sort((a, b) => b.when.localeCompare(a.when));
  // Reply names come from a rolling 7-day list. Only say so when the window reaches further back than that.
  const namesCover7d = winStart < addDays(dayKey(now, 'UTC'), -6);

  // Counts: the server's report slices that start inside the window. A slice that starts before the
  // window cannot be split, so it is left out rather than half-counted.
  type Slice = Model['results']['reachedByWeek'][number];
  const allSlices: Slice[] = ((ot?.month?.by_week) || []).map((w: any) => ({ start: w.start, end: w.end, invites: n(w.invites), accepted: n(w.accepted), replies: n(w.replies), booked: n(w.booked) }));
  let counts: { invites: number; accepted: number; replies: number; booked: number } | null = null;
  let slices: Slice[] = [];
  if (ot?.month) {
    if (P) {
      slices = allSlices.filter(w => w.start >= P);
      if (slices.length) counts = slices.reduce((a, w) => ({ invites: a.invites + w.invites, accepted: a.accepted + w.accepted, replies: a.replies + w.replies, booked: a.booked + w.booked }), { invites: 0, accepted: 0, replies: 0, booked: 0 });
      else if (ot.month.window_start >= P) counts = { invites: n(ot.month.invites), accepted: n(ot.month.accepted), replies: n(ot.month.replies), booked: n(ot.month.booked) };
    } else {
      slices = allSlices;
      counts = { invites: n(ot.month.invites), accepted: n(ot.month.accepted), replies: n(ot.month.replies), booked: n(ot.month.booked) };
    }
  }

  const leads: any[] = ot?.leads || [];
  let reached: number | null = null;
  let reachedLabel = 'reached';
  let reachedPeople: Person[] = [];
  let bookedCount = booked.length;
  let repliedCount = repliedWin.length;
  let repliedNote: string | undefined;
  if (counts) {
    reached = counts.invites; reachedLabel = 'invited';
    bookedCount = counts.booked;
    repliedCount = counts.replies;
    if (repliedCount > repliedWin.length && namesCover7d) repliedNote = `${repliedCount} people replied ${window.short}. Names below cover the last 7 days.`;
  } else if (leads.length) {
    const w = leads.filter(l => inWin(l.connection_sent_at));
    reached = w.length;
    reachedPeople = w.map(l => ({ name: clean(l.name), company: l.company || undefined, when: l.connection_sent_at, kind: 'reached' as const, intent: l.stage === 'connection_sent' ? 'invited' : 'connected' }))
      .filter(p => p.name).sort((a, b) => b.when.localeCompare(a.when));
  }
  const reachedByWeek = slices;

  let funnel: Model['funnel'] = null;
  if (counts) {
    funnel = { label: window.label, steps: [
      { label: 'Invited', value: counts.invites }, { label: 'Connected', value: counts.accepted },
      { label: 'Replied', value: counts.replies }, { label: 'Booked a call', value: counts.booked }] };
  } else if (leads.length) {
    const w = leads.filter(l => inWin(l.connection_sent_at));
    funnel = { label: window.label, steps: [
      // Activity in the window only. A "connected" step would count this week's invites while replies
      // come from older invites, so the bars read upside down on a Monday.
      { label: 'Reached', value: w.length },
      { label: 'Replied', value: repliedWin.length },
      { label: 'Booked a call', value: booked.length }] };
  }
  const funnelAll: Model['funnelAll'] = ot?.funnel ? { label: 'All time', steps: [
    { label: 'Reached', value: n(ot.funnel.contacted) }, { label: 'Connected', value: n(ot.funnel.accepted) },
    { label: 'Replied', value: n(ot.funnel.replied_people) }, { label: 'Booked a call', value: n(ot.funnel.booked) }] } : null;

  const weekly = ((ot?.replied_weekly) || []).slice(-10).map((r: any) => ({
    week: r.week_monday,
    replied: n(r.people),
    booked: bookedAll.filter(p => { const k = dayKey(p.when, theme.tz); return k >= r.week_monday && k <= addDays(r.week_monday, 6); }).length,
  }));

  // Where people came from. ARCH ships per-lane totals; RISE only ships the qualification gates per lane,
  // so for RISE we can show how many were actually contacted per lane and nothing else.
  let lanes: Model['lanes'] = [];
  let lanesNote = 'All time';
  if ((ot?.lanes || []).length) {
    const rows = (ot.lanes as any[]).map(l => ({ lane: l.lane, name: plainLane(l.lane), reached: n(l.invited), accepted: n(l.accepted), replied: n(l.replied), booked: n(l.booked) }))
      .filter(l => l.reached > 0);
    const merged = new Map<string, Model['lanes'][number]>();
    for (const r of rows) {
      const m = merged.get(r.name);
      if (m) { m.reached += r.reached; m.accepted += r.accepted; m.replied += r.replied; m.booked += r.booked; }
      else merged.set(r.name, { ...r });
    }
    lanes = [...merged.values()].sort((a, b) => b.reached - a.reached);
    const top = lanes.slice(0, 6);
    const rest = lanes.slice(6);
    if (rest.length) {
      const o = rest.reduce((acc, r) => ({ ...acc, reached: acc.reached + r.reached, accepted: acc.accepted + r.accepted, replied: acc.replied + r.replied, booked: acc.booked + r.booked }), { lane: 'other', name: 'Everything else', reached: 0, accepted: 0, replied: 0, booked: 0 });
      lanes = [...top, o];
    }
  } else if ((ot?.funnel_gates?.lanes || []).length) {
    lanes = (ot.funnel_gates.lanes as any[]).map(l => {
      const st: any[] = l.stages || [];
      const sent = st.find(s => s.stage === 'sent');
      const acc = st.find(s => s.stage === 'accepted');
      return { lane: l.lane, name: plainLane(l.lane), reached: n(sent?.entered ?? acc?.entered), accepted: n(acc?.entered), replied: -1, booked: -1 };
    }).filter(l => l.reached > 0).sort((a, b) => b.reached - a.reached);
    lanesNote = 'All time · people contacted';
  }

  // Names. The team list carries each member's own name ("Jonathan Kiekbusch", never "John" from
  // john@...); anything else falls back to a readable name, and operator addresses read as Ivan.
  const founderFirst = b.founder?.first_name || '';
  const members = raw.members || [];
  const byEmail = new Map(members.map(x => [String(x.email).toLowerCase(), x]));
  const nameOf = (by?: string | null) => {
    const e = String(by || '').trim().toLowerCase();
    if (!e) return 'Someone on your team';
    if (/ivanmanfredi/.test(e)) return 'Ivan';
    const nm = byEmail.get(e)?.name;
    if (nm && String(nm).trim()) return String(nm).trim();
    return plainActor(by, founderFirst);
  };
  const comments: Comment[] = (raw.comments || []).filter(c => c && c.id && c.ref && c.text).map(c => {
    const nm = String(c.text).match(NOTE_RE);
    return {
      id: c.id, ref: c.ref, at: c.at, by: nameOf(c.by), byEmail: c.by || undefined, text: nm ? nm[2] : c.text, quote: nm ? nm[1] : undefined,
      parent: c.parent || null, mentions: (c.mentions || []).map(x => x.label).filter(Boolean),
      resolvedAt: c.resolved_at || null, resolvedBy: c.resolved_by ? nameOf(c.resolved_by) : null,
    };
  });
  // Who can be tagged: the board's members, labelled exactly as board_comment_add_v2 matches them
  // (name, or email when there is no name; a name two people share gets the email in brackets).
  const labelCount = new Map<string, number>();
  for (const x of members) { const l = (x.name || '').trim() || x.email; labelCount.set(l, (labelCount.get(l) || 0) + 1); }
  const mentionables: Mentionable[] = members.filter(x => x.email).map(x => {
    const email = String(x.email).toLowerCase();
    const base = (x.name || '').trim() || email;
    const label = (labelCount.get(base) || 0) > 1 ? `${base} (${email})` : base;
    return { email, label, display: /ivanmanfredi/.test(email) ? 'Ivan' : (x.name || '').trim() || email };
  });
  const team = [...new Set([...mentionables.map(x => x.label), ...comments.flatMap(c => c.mentions)])].sort((a, z) => z.length - a.length);

  // People: everyone who booked or replied, newest first, one row per person (booked wins).
  // With a billing period, the list starts on its first day like every other number.
  const seen = new Map<string, Person>();
  for (const p of P ? booked : bookedAll) seen.set(p.name, p);
  for (const p of P ? replied.filter(x => inWin(x.when)) : replied) {
    const prev = seen.get(p.name);
    if (!prev) seen.set(p.name, p);
    else if (prev.kind === 'booked' && !prev.company && p.company) prev.company = p.company;
  }
  const people = [...seen.values()].sort((a, b) => b.when.localeCompare(a.when));

  return {
    slug, theme, company: b.company_name || theme.name,
    wordmark: b.brand?.wordmark || b.company_name || theme.name,
    founder: { name: b.founder?.name || '', first: b.founder?.first_name || '', headline: b.founder?.headline || '', avatar: b.founder?.avatar_url },
    logo: b.brand?.logo_dark || b.logo_url,
    reviewMode, posts, window, hasOutreach,
    results: { booked, bookedCount, replied: repliedWin, repliedCount, repliedNote, positive, positiveNote: namesCover7d && counts ? 'Counted from replies in the last 7 days.' : undefined, reached, reachedPeople, reachedByWeek, reachedLabel },
    funnel, funnelAll, weekly,
    people,
    leadMagnets: (b.lead_magnets || []).map((l: any) => ({
      id: l.id || l.title, title: nd(l.title) || '', status: plainLmStatus(l.status), statusRaw: l.status || '', url: l.url,
      cover: l.cover_url || (l.covers || [])[0], optins: l.optins ?? null, visitors: l.visitors ?? null, format: l.format,
    })),
    activity: (raw.activity || [])
      // Notes carry their own event: read those as what they are, and leave out bookkeeping rows.
      .map((a: any) => (a.action === 'note' && a.event ? { ...a, action: a.event } : a))
      .filter((a: any) => !NOISE.has(a.action))
      // An edit that only changed spacing is not a change anyone needs to read.
      .filter((a: any) => !(a.action === 'edit_copy' && typeof a.before === 'string' && typeof a.after === 'string' && a.before.trim() === a.after.trim()))
      .map((a: any) => ({ id: a.id, at: a.at, by: /board link/i.test(String(a.by || '')) ? 'Your team' : nameOf(a.by), action: a.action, title: a.title, ref: a.ref, before: a.before, after: a.after, note: a.note, text: a.text })),
    lanes, lanesNote,
    perfNote: b.performance?.note,
    content: buildContent(raw, posts, theme.tz),
    inWindow: inWin,
    comments, team, mentionables, nameOf, me: raw.me || null, role: raw.role || 'approver',
    members: members.filter(x => x.email).map(x => ({
      email: String(x.email).toLowerCase(), name: String(x.name || '').trim(),
      role: (x.role === 'admin' || x.role === 'viewer' ? x.role : 'approver') as 'admin' | 'approver' | 'viewer', owner: !!x.owner,
    })),
    teamCap: raw.teamCap || 25,
  };
}

// LinkedIn display names carry emoji badges ("Elizaveta Savenkova 🔜 Gamescom", "🐝 Patricia Michelena").
// Drop leading emoji, then cut at the first emoji that follows the name.
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2190}-\u{2BFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/u;
const LEAD = /^(?:[\u{1F000}-\u{1FAFF}\u{2190}-\u{2BFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]|\s)+/u;
export function clean(name: string) {
  let s = (name || '').trim().replace(LEAD, '');
  const i = s.search(EMOJI);
  if (i > 0) s = s.slice(0, i);
  return s.replace(/\s*[|(].*$/, '').trim();
}

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase();
}

/** How far `tz` is ahead of UTC at instant `t`, in ms. */
function tzOffset(t: number, tz: string) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(t)).map(x => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - t;
}

/** A wall-clock day and time in the client's zone ("2026-10-30", "09:00", "America/Los_Angeles") as a UTC ISO string. */
export function wallToUtc(day: string, hm: string, tz: string) {
  const [y, mo, d] = day.split('-').map(Number);
  const [h, mi] = hm.split(':').map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  let t = wall;
  for (let i = 0; i < 3; i++) t = wall - tzOffset(t, tz);
  return new Date(t).toISOString();
}

/** "HH:MM" of an instant in the client's zone. */
export function wallTime(iso: string, tz: string) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
}

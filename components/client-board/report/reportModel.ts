/**
 * reportModel — the report period behind the board's Home and Results (stage 1, 2026-09-28).
 *
 * Pure functions only: periods, and every figure the two surfaces print for a period.
 * The rules come from the v3 DATA-MAP files (RISE: report months on the 17th, PT days;
 * ARCH: Mon-Sun weeks and calendar months, Zagreb days). The raw rows come from the
 * `client_board_report` RPC (supabase/migrations/20260928_client_board_report.sql); when that
 * RPC is absent the model falls back to what the board payload already carries (calls booked
 * from `outreach_truth.booked`, posts out from the queue, per-post engagement from the
 * audience payload) and every other figure is left out rather than guessed.
 */

/* ────────────────────────── payload ────────────────────────── */

export type ReportPerson = {
  n?: string | null; c?: string | null;
  out?: string | null; conn?: string | null;
  /** Reply timestamps. RISE carries the first reply only, ARCH every reply. */
  w?: string[] | null;
  /** Interested-reply timestamps (same shape rule as `w`). */
  y?: string[] | null;
  bk?: string | null;
  /** Pipeline (stage 2). RISE: line (owner | marketing), how we found them, store type. */
  l?: string | null; v?: string | null; cat?: string | null;
  /** Latest classified reply. */
  li?: string | null;
  /** Latest reply time. */
  lr?: string | null;
  /** ARCH: company vertical, source kind, lane, source (raw keys, mapped on the page). */
  gv?: string | null; sk?: string | null; ln?: string | null; src?: string | null;
};
export type CameVia = 'asked' | 'viewed' | 'engaged' | 'hand' | 'messaged';
export type ReportCame = { name?: string | null; company?: string | null; title?: string | null; via: CameVia; at: string };
export type ReportEngaged = { p: string; k: string; at: string; fit: boolean; checked: boolean; new: boolean };
export type ReportPost = { p: string; at: string; title?: string | null };
export type ReportPayload = {
  client: 'risedtc' | 'arch';
  start_date: string;
  people: ReportPerson[];
  came: ReportCame[];
  engaged: ReportEngaged[];
  posts: ReportPost[];
  assists: { p: string; at: string }[];
  updated_at?: string;
};

/** The slice of the board payload the fallback path reads. Structural, so the page's
 *  Board type satisfies it without an import cycle. */
export type ReportBoardSlice = {
  queue: Array<{ id?: string; stage?: string; title?: string | null; hook?: string | null; post_body?: string | null; body?: string | null; published_at?: string | null; publish_date?: string | null; social_id?: string | null; post_url?: string | null }>;
  outreach_truth?: { booked?: Array<{ name?: string | null; company?: string | null; booked_at?: string | null }> } | null;
  performance?: { posts?: Array<{ title?: string; url?: string; published_at?: string }> } | null;
};
export type ReportAudienceSlice = {
  posts: Array<{
    post_social_id: string; published_at: string;
    engagers: { people: number | null; positive: number | null; coverage: string | null };
    assisted_outcomes?: number | null;
  }>;
} | null | undefined;

/* ────────────────────────── config ────────────────────────── */

export type ReportConfig = {
  slug: string;
  kind: 'month17' | 'weekly';
  /** First day that counts (YYYY-MM-DD, the client's zone). */
  start: string;
  tz: string;
  /** Who "came to you": singular / plural nouns. */
  who: [string, string];
  /** The per-post engagement noun, e.g. "brand owners" / "people who fit your buyer". */
  fit: [string, string];
  /** The outreach count that sits beside wrote back. */
  reach: 'connections' | 'reached';
  yesLabel: [string, string];
  wroteLabel: [string, string];
  /** Results per-post ledger: heading and how it is ranked. */
  postsTitle: string;
  postsRank: string;
  /** Column heading for the per-post count. */
  fitColumn: string;
  /** The week page opens on the outreach results plate (calls booked this month, who
   *  wrote back, replies week by week) with the period figures folded under it. */
  homeResults?: boolean;
};

export const REPORT_CONFIGS: Record<string, ReportConfig> = {
  'risedtc-com': {
    slug: 'risedtc-com', kind: 'month17', start: '2026-07-21', tz: 'America/Los_Angeles',
    who: ['brand owner', 'brand owners'],
    fit: ['brand owner', 'brand owners'],
    reach: 'connections',
    yesLabel: ['founder said yes', 'founders said yes'],
    wroteLabel: ['person wrote back for the first time', 'people wrote back for the first time'],
    postsTitle: 'Your posts, by the brand owners they reached',
    postsRank: 'most brand owners first',
    fitColumn: 'Brand owners',
    homeResults: true,
  },
  'arch-agency': {
    slug: 'arch-agency', kind: 'weekly', start: '2026-08-31', tz: 'Europe/Zagreb',
    who: ['game and app team', 'game and app teams'],
    fit: ['person who fits your buyer', 'people who fit your buyer'],
    reach: 'reached',
    yesLabel: ['person said yes or asked for details', 'people said yes or asked for details'],
    wroteLabel: ['person wrote back', 'people wrote back'],
    postsTitle: 'Your posts, by who they brought',
    postsRank: 'most people who fit your buyer first',
    fitColumn: 'Fit your buyer',
  },
};

export function reportConfigFor(slug?: string | null): ReportConfig | null {
  return (slug && REPORT_CONFIGS[slug]) || null;
}

/* ────────────────────────── dates ────────────────────────── */

const fmtCache = new Map<string, Intl.DateTimeFormat>();
/** YYYY-MM-DD of an instant in a zone. Bare dates pass through unchanged. */
export function dayKey(ts: string | null | undefined, tz: string): string | null {
  if (!ts) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(ts)) return ts;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  let f = fmtCache.get(tz);
  if (!f) { f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }); fmtCache.set(tz, f); }
  return f.format(d);
}
const parts = (k: string) => k.split('-').map((x) => parseInt(x, 10)) as [number, number, number];
const mk = (y: number, m: number, d: number) => {
  const t = new Date(Date.UTC(y, m - 1, d, 12));
  return t.toISOString().slice(0, 10);
};
export const addDays = (k: string, n: number) => { const [y, m, d] = parts(k); return mk(y, m, d + n); };
const addMonths = (k: string, n: number) => { const [y, m, d] = parts(k); return mk(y, m + n, d); };
const weekday = (k: string) => { const [y, m, d] = parts(k); return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay(); };
const mondayOf = (k: string) => addDays(k, -((weekday(k) + 6) % 7));
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** "17 Sept" — the board's own short month style. */
export function dm(k: string): string { const [, m, d] = parts(k); return `${d} ${MONTHS[m - 1]}`; }
export function monthShort(k: string): string { return MONTHS[parts(k)[1] - 1]; }

/* ────────────────────────── periods ────────────────────────── */

export type Period = {
  key: string;
  kind: 'week' | 'month' | 'all';
  /** Inclusive first day and EXCLUSIVE end day, client zone. */
  start: string;
  end: string;
  /** Picker label. */
  label: string;
  /** Eyebrow label. */
  eyebrow: string;
  /** How the headline names it: "since 17 Sept", "this week", "between 17 Aug and 17 Sept". */
  phrase: string;
  current: boolean;
  /** For weeks: the month the zero rule falls back to. */
  month?: Period;
};

export function reportPeriods(cfg: ReportConfig, today: string): Period[] {
  const out: Period[] = [];
  const start = cfg.start;
  const all: Period = {
    key: 'all', kind: 'all', start, end: addDays(today, 1),
    label: `Since the start (${dm(start)})`, eyebrow: `Since the start · ${dm(start)}`,
    phrase: `since ${dm(start)}`, current: true,
  };
  if (cfg.kind === 'month17') {
    const [ty, tm, td] = parts(today);
    let s = td >= 17 ? mk(ty, tm, 17) : mk(ty, tm - 1, 17);
    let e = addMonths(s, 1);
    let first = true;
    while (e > start) {
      const ps = s < start ? start : s;
      out.push(first
        ? { key: `m:${ps}`, kind: 'month', start: ps, end: e, label: `This month (${dm(ps)} to ${dm(e)})`, eyebrow: `This month · ${dm(ps)} to ${dm(e)}`, phrase: `since ${dm(ps)}`, current: true }
        : { key: `m:${ps}`, kind: 'month', start: ps, end: e, label: `${dm(ps)} to ${dm(e)}`, eyebrow: `Report month · ${dm(ps)} to ${dm(e)}`, phrase: `between ${dm(ps)} and ${dm(e)}`, current: false });
      first = false;
      if (s <= start) break;
      e = s; s = addMonths(s, -1);
    }
    out.push(all);
    return out;
  }
  // weekly: Mon-Sun weeks from the start, then calendar months from the first full month
  // (the first month reaches back to the start day: ARCH's September opens on Mon 31 Aug).
  const [sy, sm, sd] = parts(start);
  let mStart = sd === 1 ? start : mk(sy, sm + 1, 1);
  const monthsAsc: Period[] = [];
  while (mStart <= today) {
    const [y, m] = parts(mStart);
    const next = mk(y, m + 1, 1);
    const from = monthsAsc.length === 0 ? start : mStart;
    const cur = today < next;
    monthsAsc.push({
      key: `mo:${mStart}`, kind: 'month', start: from, end: cur ? addDays(today, 1) : next,
      label: cur ? `This month (${MONTHS_LONG[m - 1]})` : MONTHS_LONG[m - 1],
      eyebrow: cur ? `This month · ${MONTHS_LONG[m - 1]}` : MONTHS_LONG[m - 1],
      phrase: cur ? `since ${dm(from)}` : `in ${MONTHS_LONG[m - 1]}`, current: cur,
    });
    mStart = next;
  }
  const months = monthsAsc.slice().reverse();
  const monthFor = (k: string) => monthsAsc.find((p) => k >= p.start && k < p.end);
  let w = mondayOf(today);
  const weeks: Period[] = [];
  let i = 0;
  while (addDays(w, 7) > start) {
    const ws = w < start ? start : w;
    const we = addDays(w, 7);
    const last = addDays(we, -1);
    const current = i === 0;
    const span = `${dm(ws).split(' ')[0]}${monthShort(ws) === monthShort(last) ? '' : ` ${monthShort(ws)}`} to ${dm(last)}`;
    const lastCounted = current ? today : last;
    weeks.push({
      key: `w:${ws}`, kind: 'week', start: ws, end: current ? addDays(today, 1) : we,
      label: current ? `This week (${span})` : i === 1 ? `Last week (${span})` : `Week of ${dm(ws)}`,
      eyebrow: current ? `This week · ${span}` : `Week of ${dm(ws)} · ${span}`,
      phrase: current ? 'this week' : i === 1 ? 'last week' : `in the week of ${dm(ws)}`,
      current, month: monthFor(lastCounted) || undefined,
    });
    i++;
    if (w <= start) break;
    w = addDays(w, -7);
  }
  return [...weeks, ...months, all];
}

/** The period a board opens on: the current report month (RISE) or the current week (ARCH). */
export function defaultPeriod(periods: Period[]): Period { return periods[0]; }

/* ────────────────────────── figures ────────────────────────── */

export type CameGroup = { via: CameVia; n: number };
export type PostRow = {
  key: string; at: string; day: string; title: string; own: boolean;
  /** Distinct people who fit, distinct engagers, of them new to the client. */
  fit: number | null; engaged: number | null; fitNew: number | null;
  collected: boolean; calls: number;
};
export type Figures = {
  calls: { n: number; names: string[] };
  came: { n: number; groups: CameGroup[]; people: ReportCame[] } | null;
  wrote: number | null;
  yes: number | null;
  reach: number | null;
  postsOut: number;
  fitEngaged: { n: number; of: number } | null;
  callsAfterPost: number | null;
  posts: PostRow[];
};

/** What a post says first on the feed: the hook, else the first line of the body. The
 *  queue's own title is a working name and never reaches a client surface. */
export function openingLine(q?: { hook?: string | null; post_body?: string | null; body?: string | null } | null): string {
  if (!q) return '';
  const pick = (t?: string | null) => (t || '').replace(/^\[[^\]]*\]\s*/, '').split(/\r?\n/).map((x) => x.trim()).find(Boolean) || '';
  return pick(q.hook) || pick(q.post_body) || pick(q.body);
}

const nameKey = (n?: string | null, c?: string | null) => `${(n || '').trim().toLowerCase()}|${(c || '').trim().toLowerCase()}`;
const activityId = (s?: string | null) => (s ? (s.match(/(\d{15,})/) || [])[1] || null : null);

export function computeFigures(
  cfg: ReportConfig, p: Period, report: ReportPayload | null,
  board: ReportBoardSlice, audience?: ReportAudienceSlice,
): Figures {
  const inP = (ts?: string | null) => { const k = dayKey(ts, cfg.tz); return !!k && k >= p.start && k < p.end; };
  const afterStart = (ts?: string | null) => { const k = dayKey(ts, cfg.tz); return !!k && k >= cfg.start; };

  /* calls booked, with names */
  let calls: { n: number; names: string[]; at: string[] };
  if (report) {
    const b = report.people.filter((x) => inP(x.bk)).sort((a, z) => String(z.bk).localeCompare(String(a.bk)));
    calls = { n: b.length, names: b.map((x) => (x.n || '').trim()).filter(Boolean), at: b.map((x) => x.bk as string) };
  } else {
    const seen = new Set<string>();
    const b = (board.outreach_truth?.booked || []).filter((x) => inP(x.booked_at) && afterStart(x.booked_at))
      .filter((x) => { const k = nameKey(x.name, x.company); if (seen.has(k)) return false; seen.add(k); return true; })
      .sort((a, z) => String(z.booked_at).localeCompare(String(a.booked_at)));
    calls = { n: b.length, names: b.map((x) => (x.name || '').trim()).filter(Boolean), at: [] };
  }

  const any = (arr?: string[] | null) => (arr || []).some((t) => inP(t));
  const wrote = report ? report.people.filter((x) => any(x.w)).length : null;
  const yes = report ? report.people.filter((x) => any(x.y)).length : null;
  const reach = report ? report.people.filter((x) => inP(cfg.reach === 'connections' ? x.conn : x.out)).length : null;

  let came: Figures['came'] = null;
  if (report) {
    const people = report.came.filter((c) => inP(c.at)).sort((a, z) => z.at.localeCompare(a.at));
    const order: CameVia[] = ['asked', 'messaged', 'viewed', 'engaged', 'hand'];
    const groups = order.map((via) => ({ via, n: people.filter((x) => x.via === via).length })).filter((g) => g.n > 0);
    came = { n: people.length, groups, people };
  }

  /* posts in the period: the queue's published posts, plus any post on the feed the
     metrics carry that the queue does not (the client's own posts). */
  const pub = board.queue.filter((q) => q.stage === 'published');
  const qByAct = new Map<string, (typeof pub)[number]>();
  const qByDay = new Map<string, (typeof pub)[number]>();
  pub.forEach((q) => {
    const a = activityId(q.social_id) || activityId(q.post_url);
    if (a) qByAct.set(a, q);
    const d = dayKey(q.published_at || q.publish_date, cfg.tz);
    if (d && !qByDay.has(d)) qByDay.set(d, q);
  });
  const postsOut = pub.filter((q) => inP(q.published_at || q.publish_date)).length;

  type Src = { key: string; at: string; title?: string | null };
  const srcs = new Map<string, Src>();
  (report?.posts || []).forEach((x) => srcs.set(x.p, { key: x.p, at: x.at, title: x.title }));
  (audience?.posts || []).forEach((x) => { if (!srcs.has(x.post_social_id)) srcs.set(x.post_social_id, { key: x.post_social_id, at: x.published_at }); });
  const audByKey = new Map((audience?.posts || []).map((x) => [x.post_social_id, x] as const));
  const perfByAct = new Map<string, { title?: string }>();
  (board.performance?.posts || []).forEach((x) => { const a = activityId(x.url); if (a) perfByAct.set(a, x); });

  const engByPost = new Map<string, ReportEngaged[]>();
  (report?.engaged || []).forEach((e) => { const l = engByPost.get(e.p) || []; l.push(e); engByPost.set(e.p, l); });
  const assistsByPost = new Map<string, number>();
  (report?.assists || []).forEach((a) => assistsByPost.set(a.p, (assistsByPost.get(a.p) || 0) + 1));

  const clean = (t?: string | null) => (t || '').replace(/^\[[^\]]*\]\s*/, '').replace(/\s+/g, ' ').trim();
  const posts: PostRow[] = [];
  const usedQueue = new Set<unknown>();
  srcs.forEach((s) => {
    if (!inP(s.at) || !afterStart(s.at)) return;
    const day = dayKey(s.at, cfg.tz) as string;
    const act = activityId(s.key);
    const q = (act && qByAct.get(act)) || qByDay.get(day);
    if (q && usedQueue.has(q)) return; // one row per published post (reposted ids resolve to the same day)
    if (q) usedQueue.add(q);
    const aud = audByKey.get(s.key);
    const rows = engByPost.get(s.key);
    let fit: number | null = null; let engaged: number | null = null; let fitNew: number | null = null;
    if (rows) {
      fit = new Set(rows.filter((r) => r.fit).map((r) => r.k)).size;
      engaged = new Set(rows.map((r) => r.k)).size;
      fitNew = new Set(rows.filter((r) => r.fit && r.new).map((r) => r.k)).size;
    } else if (aud && aud.engagers.coverage === 'collected') {
      fit = aud.engagers.positive ?? null; engaged = aud.engagers.people ?? null;
    }
    const collected = !!rows || aud?.engagers.coverage === 'collected';
    // What the post says on the feed first (the performance sync, then the queue's hook,
    // then the metrics row, which is cut at a fixed length); the queue title last, since it
    // can carry a working name.
    // The opening line only: the queue's hook / first body line, else the metrics row (the
    // feed's own first ~80 characters, cut back to a whole word).
    const metricTitle = clean(s.title);
    const cut = metricTitle.length >= 75 ? `${metricTitle.slice(0, metricTitle.lastIndexOf(' ')).replace(/[\s,.:;-]+$/, '')}\u2026` : metricTitle;
    const title = clean(openingLine(q)) || cut || 'Post';
    posts.push({
      key: s.key, at: s.at, day, title, own: !q,
      fit, engaged, fitNew, collected,
      calls: report ? (assistsByPost.get(s.key) || 0) : (aud?.assisted_outcomes || 0),
    });
  });
  // A queue post that went out before its metrics row synced is still out: list it with no
  // engagement read yet, so the list names the same posts `postsOut` counts.
  pub.forEach((q) => {
    const at = q.published_at || q.publish_date;
    if (usedQueue.has(q) || !inP(at) || !afterStart(at)) return;
    usedQueue.add(q);
    posts.push({
      key: q.id || q.social_id || `q:${at}`, at: at as string, day: dayKey(at, cfg.tz) as string,
      title: clean(openingLine(q)) || 'Post', own: false,
      fit: null, engaged: null, fitNew: null, collected: false, calls: 0,
    });
  });
  posts.sort((a, z) => (z.fit ?? -1) - (a.fit ?? -1) || z.at.localeCompare(a.at));

  let fitEngaged: Figures['fitEngaged'] = null;
  if (report) {
    const keys = new Set(posts.map((x) => x.key));
    const rows = report.engaged.filter((e) => keys.has(e.p));
    const checked = rows.filter((e) => e.checked);
    if (checked.length > 0) {
      fitEngaged = { n: new Set(rows.filter((e) => e.fit).map((e) => e.k)).size, of: new Set(rows.map((e) => e.k)).size };
    }
  }
  const callsAfterPost = report ? new Set(report.assists.filter((a) => inP(a.at)).map((a) => `${a.p}|${a.at}`)).size : null;

  return { calls: { n: calls.n, names: calls.names }, came, wrote, yes, reach, postsOut, fitEngaged, callsAfterPost, posts };
}

/* ────────────────────────── the zero rule ────────────────────────── */

/**
 * A figure that is 0 only because the window is short never prints as a 0. For a week, it
 * falls back to the month figure ("this month" / "in September") with the week's 0 as a
 * quiet second line; if the month is 0 too, or the period is a month or longer, it is
 * hidden. Calls booked are the one figure that always shows.
 */
export type Shown = { value: number; scope: string | null; weekZero: boolean } | null;
export function shown(value: number | null | undefined, monthValue: number | null | undefined, p: Period): Shown {
  if (value == null) return null;
  if (value > 0) return { value, scope: null, weekZero: false };
  if (p.kind === 'week' && p.month && monthValue != null && monthValue > 0) {
    return { value: monthValue, scope: p.month.phrase, weekZero: true };
  }
  return null;
}

/* ────────────────────────── chart series ────────────────────────── */

export type SeriesKey = 'calls' | 'wrote' | 'came';
export type SeriesPoint = { key: string; label: string; value: number; current: boolean };

/** Calls booked (or wrote back, or came to you) per report month; a board with fewer than
 *  three months behind it draws week by week instead, so the chart is never one bar. */
export function series(cfg: ReportConfig, periods: Period[], report: ReportPayload | null, board: ReportBoardSlice, which: SeriesKey): { unit: 'month' | 'week'; points: SeriesPoint[] } {
  const months = periods.filter((p) => p.kind === 'month').slice().reverse();
  const useWeeks = months.length < 3;
  const buckets = useWeeks ? periods.filter((p) => p.kind === 'week').slice().reverse() : months;
  const points = buckets.map((p) => {
    const f = computeFigures(cfg, p, report, board, null);
    const value = which === 'calls' ? f.calls.n : which === 'wrote' ? (f.wrote ?? 0) : (f.came?.n ?? 0);
    const label = p.kind === 'week' ? dm(p.start) : cfg.kind === 'month17' ? dm(p.start) : monthShort(p.start === cfg.start ? addDays(p.start, 1) : p.start);
    return { key: p.key, label, value, current: p.current };
  });
  return { unit: useWeeks ? 'week' : 'month', points };
}

/** Rows for the Results slice table: 7-day slices of a month, report months of "since the
 *  start", weeks of an ARCH month. A single week has no table. */
export function slices(cfg: ReportConfig, p: Period, periods: Period[], today: string): Period[] {
  if (p.kind === 'week') return [];
  const rowLabel = (x: Period): Period => ({
    ...x,
    label: x.kind === 'week'
      ? (x.current ? 'This week' : `Week of ${dm(x.start)}`)
      : cfg.kind === 'month17' ? (x.current ? `${dm(x.start)} to today` : `${dm(x.start)} to ${dm(x.end)}`) : x.label.replace(/^This month \((.*)\)$/, '$1'),
  });
  if (p.kind === 'all') {
    const months = periods.filter((x) => x.kind === 'month').slice().reverse();
    if (cfg.kind === 'month17' || months.length >= 3) return months.map(rowLabel);
    return periods.filter((x) => x.kind === 'week').slice().reverse().map(rowLabel);
  }
  if (cfg.kind === 'weekly') {
    return periods.filter((x) => x.kind === 'week' && x.start >= p.start && x.start < p.end).slice().reverse().map(rowLabel);
  }
  const out: Period[] = [];
  let s = p.start;
  while (s < p.end && s <= today) {
    const e0 = addDays(s, 7);
    const e = e0 > p.end ? p.end : e0;
    const cur = today >= s && today < e;
    const endShown = cur ? today : addDays(e, -1);
    out.push({
      key: `s:${s}`, kind: 'week', start: s, end: cur ? addDays(today, 1) : e,
      label: cur ? `${dm(s)} to today` : `${dm(s)} to ${dm(endShown)}`, eyebrow: '', phrase: '', current: cur,
    });
    s = e;
  }
  return out;
}

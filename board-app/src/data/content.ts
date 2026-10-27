// Content numbers: one row per published post, joined from every read source the live board has.
//  - board.performance.posts: LinkedIn numbers per post (impressions, reactions, viewers, demographics).
//  - client_board_report: who engaged per post (`engaged`, judged fit or not) and calls after a post (`assists`).
//  - client_board_funnel_signals (RISE): named profile viewers and buyer messages, trailing 30 days and 48h per post.
//  - client_board_audience: which engagers we already knew, and median reactions by month.
// Nothing here is estimated; a post without numbers says so.
import type { Raw } from './api';
import type { Post } from './model';
import { dayKey } from './model';

export type Share = { label: string; pct: number };
export type Demo = { job_title: Share[]; seniority: Share[]; company_size: Share[]; industry: Share[]; location: Share[] };

export type ContentPost = {
  key: string;
  postId?: string;
  title: string;
  at: string;
  url?: string;
  image?: string;
  hook: string;
  measured: boolean;
  impressions: number;
  reactions: number;
  comments: number;
  reposts: number;
  profileViews: number;
  followers: number;
  reached?: number;
  inPct?: number;
  outPct?: number;
  demo?: Demo;
  /** RISE: store owners among the people who engaged. ARCH: people judged to fit the buyer, of those checked. */
  icp?: { n: number; of: number };
  icpKeys?: string[];
  checkedKeys?: string[];
  inboundDms?: number;
  /** RISE signals, first 48 hours after the post (latest five posts only). */
  named48?: number;
  lookedUp48?: number;
  buyerDms48?: number;
  ledToCall: number;
};

export type Came = { name: string; role?: string; company?: string; via: string; at: string };

export type Content = {
  posts: ContentPost[];
  /** How the ICP column is counted on this board, or null when nothing is judged. */
  icp: null | { mode: 'owners' | 'fit'; label: string; short: string };
  firstAt?: string;
  updatedAt?: string;
  came: Came[];
  months: { month: string; posts: number; impressions: number; medianReactions?: number }[];
  known?: { known: number; total: number };
  signals?: {
    from: string; to: string; named: number; named7d: number; written: number; other: number; organic: number;
    trackingFrom?: string; engaged: number; engagedOrganic: number; buyerPosts: number; buyerDms: number;
  };
  notMeasured: string[];
  measuring: boolean;
};

const n = (v: unknown) => (v == null || v === '' ? 0 : Number(v) || 0);
const aid = (u?: string | null) => (u || '').match(/activity[-:](\d{10,})/)?.[1];

const VIA: Record<string, string> = {
  asked: 'Asked to connect', viewed: 'Looked at your profile', engaged: 'Engaged with a post',
  hand: 'Asked to hear more', messaged: 'Messaged you first',
};

// The stored job-title lists also carry places ("Greater Istanbul", "Brabantine City Row"), so a label
// only counts as a job title when it names a role.
const PLACE = /metropolitan|\b(area|region)(,|$)|\bcounty$|^greater /i;
const ROLE = /found|manag|officer|director|owner|chief|head|special|editor|influencer|lead|consult|market|design|engineer|president|partner|analyst|execut|coordinat|strateg|creator|\bvp\b|vice|produc|recruit|sales|account|develop|assistant|associate|intern|student|\bc[a-z]o\b|advis|writer|publish|buyer|merchand|operat|growth|commerce|agent|ambassador|artist|photograph|teach|professor|scien|research|owner|entrepreneur|investor|campaign|social media|video|content|brand|communication|public relations|\bpr\b|media|copy|pilot|instruct|nurse|doctor|physician|lawyer|attorney|architect|coach|trainer|chef|driver|technician/i;

const shares = (v: any): Share[] => (Array.isArray(v) ? v : [])
  .filter((x: any) => x && x.label && x.pct != null)
  .map((x: any) => ({ label: String(x.label), pct: n(x.pct) }));

export function buildContent(raw: Raw, posts: Post[], tz: string): Content {
  const b = raw.board || {};
  const perf: any[] = b.performance?.posts || [];
  const report = raw.report || null;
  const sig = raw.signals || null;
  const aud = raw.audience || null;
  const icpMode: 'owners' | 'fit' | null = perf.some(p => p.engagers != null)
    ? 'owners'
    : (report?.engaged || []).some((e: any) => e.checked) ? 'fit' : null;

  // Report engagers per post, as distinct people.
  const fit = new Map<string, Set<string>>();
  const checked = new Map<string, Set<string>>();
  for (const e of report?.engaged || []) {
    const id = aid(e.p); if (!id) continue;
    if (e.checked) { if (!checked.has(id)) checked.set(id, new Set()); checked.get(id)!.add(e.k); }
    if (e.fit) { if (!fit.has(id)) fit.set(id, new Set()); fit.get(id)!.add(e.k); }
  }
  const assists = new Map<string, number>();
  for (const a of report?.assists || []) { const id = aid(a.p); if (id) assists.set(id, (assists.get(id) || 0) + 1); }
  const sigPost = new Map<string, any>();
  for (const p of sig?.posts || []) { const id = aid(p.social_id); if (id) sigPost.set(id, p); }

  const queueByAid = new Map<string, Post>();
  for (const p of posts) { const id = aid(p.url); if (id) queueByAid.set(id, p); }
  // Titles on the metrics side sometimes carry a "[RISE DTC]" style prefix; compare the words only.
  const norm = (t?: string) => (t || '').toLowerCase().replace(/^\s*\[[^\]]*\]\s*/, '').replace(/^(carousel|video):\s*/, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const queueByTitle = new Map(posts.filter(p => p.status === 'live').map(p => [norm(p.title), p]));
  const byTitle = (t?: string) => {
    const k = norm(t);
    if (!k) return undefined;
    if (queueByTitle.has(k)) return queueByTitle.get(k);
    if (k.length < 24) return undefined;
    for (const [qk, q] of queueByTitle) if (qk.length >= 24 && (qk.startsWith(k.slice(0, 24)) || k.startsWith(qk.slice(0, 24)))) return q;
    return undefined;
  };

  // LinkedIn sometimes files a place under job titles; drop any job title that is also a reported location.
  const places = new Set<string>(perf.flatMap(p => shares(p.demographics?.location).map(x => x.label.toLowerCase())));
  const rows: ContentPost[] = [];
  const used = new Set<string>();
  for (const pm of perf) {
    const id = aid(pm.url);
    const at = pm.published_at;
    if (!at) continue;
    let q = id ? queueByAid.get(id) : undefined;
    if (!q) { const t = byTitle(pm.title); if (t && !used.has(t.id) && !aid(t.url)) q = t; }
    if (q) used.add(q.id);
    const measured = pm.impressions != null;
    const demo: Demo | undefined = pm.demographics ? {
      job_title: shares(pm.demographics.job_title).filter(x => ROLE.test(x.label) && !PLACE.test(x.label) && !places.has(x.label.toLowerCase())),
      seniority: shares(pm.demographics.seniority), company_size: shares(pm.demographics.company_size),
      industry: shares(pm.demographics.industry), location: shares(pm.demographics.location),
    } : undefined;
    let icp: ContentPost['icp'];
    if (icpMode === 'owners' && pm.engagers != null) icp = { n: n(pm.owners), of: n(pm.engagers) };
    if (icpMode === 'fit' && id && checked.has(id)) icp = { n: fit.get(id)?.size || 0, of: checked.get(id)!.size };
    const sp = id ? sigPost.get(id) : undefined;
    rows.push({
      key: id || pm.url || pm.title, postId: q?.id, title: q?.title || pm.title || 'Post', at, url: pm.url || q?.url,
      image: q?.image, hook: q?.hook || pm.title || '', measured,
      impressions: n(pm.impressions), reactions: n(pm.reactions), comments: n(pm.comments), reposts: n(pm.reposts),
      profileViews: n(pm.profile_views), followers: n(pm.followers_gained),
      reached: pm.network?.members_reached ?? undefined, inPct: pm.network?.in_pct ?? undefined, outPct: pm.network?.out_pct ?? undefined,
      demo, icp, icpKeys: id && fit.has(id) ? [...fit.get(id)!] : undefined, checkedKeys: id && checked.has(id) ? [...checked.get(id)!] : undefined,
      inboundDms: pm.inbound_dms ?? undefined,
      named48: sp?.named_views_48h, lookedUp48: sp?.organic_icp_views_48h, buyerDms48: sp?.buyer_dms_48h,
      ledToCall: id ? assists.get(id) || 0 : 0,
    });
  }
  // Published on the board but no LinkedIn numbers yet.
  for (const p of posts) {
    if (p.status !== 'live' || used.has(p.id)) continue;
    const at = p.publishedAt || p.scheduledAt;
    if (!at) continue;
    const id = aid(p.url);
    rows.push({
      key: id || p.id, postId: p.id, title: p.title, at, url: p.url, image: p.image, hook: p.hook, measured: false,
      impressions: 0, reactions: 0, comments: 0, reposts: 0, profileViews: 0, followers: 0, ledToCall: id ? assists.get(id) || 0 : 0,
    });
  }
  rows.sort((a, b) => b.at.localeCompare(a.at));

  const measuredRows = rows.filter(r => r.measured);
  // The full range starts at the oldest post shown, measured or not, so the label covers every row.
  const firstAt = rows[rows.length - 1]?.at;

  // Month by month, in the client's zone. Median reactions at 7 days old come from the audience review.
  const byMonth = new Map<string, { posts: number; impressions: number }>();
  for (const r of measuredRows) {
    const k = dayKey(r.at, tz).slice(0, 7);
    const m = byMonth.get(k) || { posts: 0, impressions: 0 };
    m.posts += 1; m.impressions += r.impressions; byMonth.set(k, m);
  }
  const med = new Map<string, number>();
  for (const x of aud?.monthly_median || []) if (n(x.target_age_days) === 7 && x.median_reactions != null) med.set(String(x.month).slice(0, 7), n(x.median_reactions));
  const months = [...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([month, v]) => ({ month, ...v, medianReactions: med.get(month) }));

  const people: any[] = aud?.people || [];
  const known = people.length ? { known: people.filter(p => String(p.relationship?.state || '').startsWith('existing_prospect_stage:')).length, total: people.length } : undefined;

  let signals: Content['signals'];
  if (sig?.profile_views) {
    const to = (sig.computed_at || new Date().toISOString()).slice(0, 10);
    const d = new Date(to + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - (n(sig.profile_views.window_days) || 30) + 1);
    signals = {
      from: d.toISOString().slice(0, 10), to,
      named: n(sig.profile_views.named), named7d: n(sig.profile_views.named_7d), written: n(sig.profile_views.engine),
      other: n(sig.profile_views.other), organic: n(sig.profile_views.organic_icp), trackingFrom: sig.tracking_started_on || undefined,
      engaged: n(sig.engagers?.new), engagedOrganic: n(sig.engagers?.organic_icp),
      buyerPosts: n(sig.posts_buyers_30d), buyerDms: n(sig.buyer_dms_30d),
    };
  }

  const came: Came[] = (report?.came || []).filter((c: any) => c && c.name && c.at).map((c: any) => ({
    name: String(c.name).trim(), role: c.title ? String(c.title).split('|')[0].trim() : undefined,
    company: c.company || undefined, via: VIA[c.via] || 'Came to you', at: c.at,
  })).sort((a: Came, b: Came) => b.at.localeCompare(a.at));

  // Indicators the board tracks but has never measured (no capture date) are named, never shown as zero.
  const notMeasured = ((b.performance?.indicators || []) as any[])
    .filter(i => !i.captured_at && !(i.key === 'inbound_dms' && perf.some(p => p.inbound_dms != null)) && !(i.key === 'profile_views' && perf.length))
    .map(i => (i.key === 'optins' ? 'free resource sign-ups' : i.key === 'inbound_dms' ? 'messages you receive' : i.key === 'booked_calls' ? 'calls booked from your calendar' : i.key === 'profile_views' ? 'profile views' : String(i.label || '').toLowerCase()))
    .filter(Boolean);

  return {
    posts: rows,
    icp: icpMode === 'owners' ? { mode: 'owners', label: 'Store owners', short: 'store owners' }
      : icpMode === 'fit' ? { mode: 'fit', label: 'Fit your buyer', short: 'people who fit your buyer' } : null,
    firstAt, updatedAt: b.performance?.posts_updated_at || undefined, came, months, known, signals, notMeasured,
    measuring: perf.length > 0,
  };
}

/* Totals over a set of rows. People are never added up across posts: the ICP figure is distinct people
   (fit) or a share of engagements (owners), never a sum of heads. */
export function contentTotals(rows: ContentPost[], mode: 'owners' | 'fit' | null) {
  const m = rows.filter(r => r.measured);
  const sum = (k: keyof ContentPost) => m.reduce((a, r) => a + (Number(r[k]) || 0), 0);
  const impressions = sum('impressions');
  const reactions = sum('reactions');
  const comments = sum('comments');
  let icp: { n: number; of: number } | null = null;
  if (mode === 'owners') {
    const w = m.filter(r => r.icp);
    if (w.length) icp = { n: w.reduce((a, r) => a + r.icp!.n, 0), of: w.reduce((a, r) => a + r.icp!.of, 0) };
  } else if (mode === 'fit') {
    const f = new Set<string>(); const c = new Set<string>();
    for (const r of m) { (r.icpKeys || []).forEach(k => f.add(k)); (r.checkedKeys || []).forEach(k => c.add(k)); }
    if (c.size) icp = { n: f.size, of: c.size };
  }
  const best = m.reduce<ContentPost | null>((a, r) => (!a || r.impressions > a.impressions ? r : a), null);
  const others = m.filter(r => r !== best);
  const avgOthers = others.length ? others.reduce((a, r) => a + r.impressions, 0) / others.length : 0;
  const dmsRows = m.filter(r => r.inboundDms != null);
  return {
    published: rows.length, measured: m.length, impressions, reactions, comments,
    reposts: sum('reposts'), profileViews: sum('profileViews'), followers: sum('followers'),
    rate: impressions ? ((reactions + comments) / impressions) * 100 : null,
    perPost: m.length ? Math.round(impressions / m.length) : 0,
    icp, best, bestX: best && avgOthers ? best.impressions / avgOthers : null,
    inboundDms: dmsRows.length ? dmsRows.reduce((a, r) => a + (r.inboundDms || 0), 0) : null,
    ledToCall: rows.reduce((a, r) => a + r.ledToCall, 0),
  };
}

/* Who saw the posts: each share is weighted by the members a post reached, over posts that carry both. */
export function whoSaw(rows: ContentPost[]) {
  const withReach = rows.filter(r => r.measured && r.demo && (r.reached || 0) > 0);
  const total = withReach.reduce((a, r) => a + (r.reached || 0), 0);
  const dim = (k: keyof Demo) => {
    const acc = new Map<string, number>();
    for (const r of withReach) for (const s of r.demo![k]) acc.set(s.label, (acc.get(s.label) || 0) + (s.pct / 100) * (r.reached || 0));
    return [...acc.entries()].map(([label, v]) => ({ label, pct: total ? (v / total) * 100 : 0 }))
      .filter(x => x.pct >= 1).sort((a, b) => b.pct - a.pct).slice(0, 5);
  };
  const net = rows.filter(r => r.measured && r.outPct != null);
  const w = net.reduce((a, r) => a + (r.impressions || 1), 0);
  const outPct = net.length ? net.reduce((a, r) => a + (r.outPct || 0) * (r.impressions || 1), 0) / w : null;
  return {
    posts: withReach.length, seniority: dim('seniority'), job_title: dim('job_title'), company_size: dim('company_size'),
    industry: dim('industry'), location: dim('location'), outPct, netPosts: net.length,
  };
}

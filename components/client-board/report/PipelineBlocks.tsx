/**
 * PipelineBlocks — the Pipeline tab on the report boards (RISE, ARCH), stage 2 of the
 * board rebuild (Ivan 2026-09-28: the old board's look, the v3 mock's data).
 *
 * What it replaces on those boards: the send-window line, the "N of 5 send days" headline,
 * the counted-at-UTC stamps, week-against-week, the send allowance, the bar, the live lanes
 * and the up-next send queue. All of that described the machine, not the result.
 *
 * What it draws, top to bottom, in desk-kit vocabulary only:
 *   headline (calls booked, then who is interested right now) and three figures;
 *   "Who we reach, and what came of it": one ledger per line (RISE store owners and marketing
 *   leads; ARCH game studios, app companies, consumer brands), rows = how we found them;
 *   the calls chart; interested right now, calls booked, and the rest who wrote back in the
 *   last 30 days, each person's real messages (emails included) one tap away.
 * Counts only, never rates (Ivan 2026-09-27). Definitions: the v3 DATA-MAP files.
 */
import React from 'react';
import {
  Eyebrow, DeskH2, Footnote, Card, Chip, Pill, Ledger, LedgerRow, LedgerCell, Drill,
} from '../desk-kit';
import { dayKey, dm, type ReportPerson } from './reportModel';
import { ReportFigures, CallsChart, PICKER_CSS, type ReportCtx } from './ReportBlocks';
import { useNight, useQuiet } from '../perf-kit/night';

/** NIGHT MOCKUP (local only, 2026-09-29): the Pipeline tab in the ARCH report's look, lazy so
 *  none of it ships in the desk's chunk. */
const PipelineNight = React.lazy(() => import('../perf-kit/pipeline-night'));

export type ReplySourceRenderer = (prospectId: string, open: boolean) => React.ReactNode;

export type LogMessage = { direction: 'outbound' | 'inbound'; channel: string | null; type: string | null; sent_at: string | null; text: string | null };
export type LogEntry = { prospect_id: string; name: string | null; company: string | null; last_reply_at: string | null; messages: LogMessage[] };
export type BookedExtra = { name?: string | null; company?: string | null; booked_at?: string | null; brief_url?: string | null; scan_url?: string | null };

const MUTE = 'var(--cb-ink-mute)';
export const fmt = (v: number | null) => (v === null ? '·' : v.toLocaleString('en-US'));
/** Desktop: the ledger. Phone: each row stacks, label then its numbers on one line
 *  (a six-column table left the label ~70px wide at 390). */
const PIPE_CSS = `
.cb-pipe-stack { display: none; }
@media (max-width: 640px) { .cb-pipe-tbl { display: none; } .cb-pipe-stack { display: block; } }
`;
const DAY_MS = 86400000;
export const norm = (s?: string | null) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();

/* ─────────────────────────── who is who ─────────────────────────── */

const ARCH_YES = new Set(['positive', 'soft_yes', 'info_ask', 'booking', 'price_ask']);
/** ARCH threads the client never sees (hostile, vendors pitching, a sent DM naming a market
 *  ARCH does not sell into). By prospect id prefix, ARCH DATA-MAP "conversation cards". */
const ARCH_HIDDEN = ['15479bc5', '51c6c091', 'be25f6dc', '4f769ffb', 'dffec463', 'de1cd6ad', 'f30ade2e', 'aab68de8', '46841963', '45bab93a'];

export const isArch = (ctx: ReportCtx) => ctx.payload?.client === 'arch';
/** Interested right now: not booked, the latest classified reply says yes (ARCH: or asks),
 *  and that reply is from the last 14 days. An old yes that went quiet is not "right now"
 *  (30 days read 39 for RISE, most of them long cold; 14 reads 23 on 28 Sep). */
export function interestedNow(ctx: ReportCtx, p: ReportPerson): boolean {
  if (p.bk) return false;
  const yes = isArch(ctx) ? ARCH_YES.has(p.li || '') : p.li === 'positive';
  return yes && !!p.lr && Date.parse(p.lr) >= Date.now() - 14 * DAY_MS;
}
export const wrote = (p: ReportPerson) => (p.w || []).length > 0;

export type Line = { key: string; title: string; sub: string };
type Via = { key: string; label: string };

const RISE_LINES: Line[] = [
  { key: 'owner', title: 'Store owners', sub: 'DTC brand founders, co-founders and CEOs' },
  { key: 'marketing', title: 'Marketing leads', sub: 'CMOs, heads of growth and marketing' },
];
const RISE_VIA: Record<string, string> = {
  engaged: 'People who engaged with posts in your space',
  search: 'Founders found in a search of DTC brands',
  expansion: 'More people at brands you’re already talking to',
  orbit: 'People from your clients’ networks',
  asked: 'People who asked to connect with you',
  viewed: 'People who viewed your profile',
  fcmo: 'Fractional CMOs who run marketing for DTC brands',
  network: 'People already in your network',
  other: 'Other people you reached',
};
const RISE_CAT: Record<string, string> = {
  fnb: 'food and drink', food_cpg: 'food and drink', food_beverage: 'food and drink',
  wellness: 'health and wellness', beauty_skincare: 'beauty and skincare', beauty_wellness: 'beauty and skincare',
  apparel: 'apparel', apparel_kids: 'apparel', home_cpg: 'home goods', sporting_outdoor: 'sports and outdoor',
  pet: 'pet', jewelry_accessories: 'jewelry and accessories', toys_kids: 'kids and toys', electronics: 'electronics',
  furniture_heavy: 'furniture', digital_services: 'digital services', eyewear: 'eyewear', other: 'other stores',
};

const ARCH_LINES: Line[] = [
  { key: 'games', title: 'Game studios', sub: 'PC, console and mobile games' },
  { key: 'apps', title: 'App companies', sub: 'fintech, health, software, travel and other apps' },
  { key: 'consumer', title: 'Consumer brands', sub: 'brands selling physical products' },
  { key: 'unsorted', title: 'Not sorted by company type yet', sub: 'we have not placed these companies yet' },
];

/** ARCH company group + the sub label "conversations came from" uses (archCopyVertical order). */
export function archGroup(p: ReportPerson): { line: string; sub: string } {
  const v = norm(p.gv);
  if (v === 'pc') return { line: 'games', sub: 'PC and console games' };
  if (['games', 'mobile_games', 'gaming'].includes(v)) return { line: 'games', sub: 'games' };
  if (['apps_fintech', 'fintech'].includes(v)) return { line: 'apps', sub: 'fintech apps' };
  if (v === 'apps_health') return { line: 'apps', sub: 'health apps' };
  if (['apps_saas', 'consumer_saas', 'productivity_saas', 'consumer_privacy_saas'].includes(v)) return { line: 'apps', sub: 'consumer software apps' };
  if (['apps_travel', 'travel'].includes(v)) return { line: 'apps', sub: 'travel apps' };
  if (v === 'apps_subscription') return { line: 'apps', sub: 'subscription apps' };
  if (v === 'apps_crypto') return { line: 'apps', sub: 'crypto apps' };
  if (['d2c', 'apps_d2c', 'd2c_subscription', 'd2c_ecom'].includes(v)) return { line: 'consumer', sub: 'consumer brands' };
  if (v === 'apps' || v.startsWith('apps_') || v === 'edtech') return { line: 'apps', sub: 'apps' };
  const ln = norm(p.ln);
  if (ln.includes('fintech')) return { line: 'apps', sub: 'fintech apps' };
  if (ln.includes('csaas') || ln.includes('saas')) return { line: 'apps', sub: 'consumer software apps' };
  if (ln.includes('apps')) return { line: 'apps', sub: 'apps' };
  if (ln.includes('games') || ln.includes('gaming')) return { line: 'games', sub: 'games' };
  return { line: 'unsorted', sub: 'not sorted by company type yet' };
}

function archVia(p: ReportPerson): string {
  const sk = norm(p.sk); const ln = norm(p.ln); const src = norm(p.src);
  const bySk: Record<string, string> = {
    competitor_post_engager: 'Engaged with posts by voices in your space',
    own_post_engager: 'Engaged with your own posts',
    pilot_anchor_post_engager: 'Engaged with posts by fintech and app voices',
    company_expansion: 'More people at companies already on your list',
    hiring_signal: 'Teams hiring for growth or creator roles',
    apollo_right_title: 'Found by job title', cold_title_search: 'Found by job title',
    new_in_role: 'People new in their role',
    client_sourced_sponsor: 'Companies already paying creators', youtube_sponsor_mining: 'Companies already paying creators',
    soft_launch: 'Games in soft launch',
    profile_view_warm: 'People who viewed your profile',
    israel_trip: 'Contacts for your October trip to Israel',
    funding_signal: 'Companies that just raised money',
    hand_raise: 'People who raised a hand on your posts',
  };
  if (bySk[sk]) return bySk[sk];
  const byLn: Record<string, string> = {
    orbit_pilot_fintech: bySk.pilot_anchor_post_engager, orbit_pilot_csaas: bySk.pilot_anchor_post_engager,
    cold_games: 'Found by job title', cold_apps: 'Found by job title',
    sponsor_team: bySk.client_sourced_sponsor, sponsor_mined: bySk.client_sourced_sponsor,
    profile_view: bySk.profile_view_warm, israel_trip: bySk.israel_trip, new_in_role: bySk.new_in_role,
    hiring_signal: bySk.hiring_signal, soft_launch: bySk.soft_launch, funding_signal: bySk.funding_signal,
    hand_raise: bySk.hand_raise, company_expansion: bySk.company_expansion,
  };
  if (byLn[ln]) return byLn[ln];
  if (src.startsWith('engager-harvest')) return bySk.competitor_post_engager;
  if (src.startsWith('employee-sweep')) return bySk.company_expansion;
  return 'Other people you reached';
}

export function lineOf(ctx: ReportCtx, p: ReportPerson): string {
  if (isArch(ctx)) return archGroup(p).line;
  // A fractional CMO's headline often says "Founder" (of their own practice): still a marketing lead.
  return p.v === 'fcmo' ? 'marketing' : (p.l || 'owner');
}
export function viaOf(ctx: ReportCtx, p: ReportPerson): Via {
  if (isArch(ctx)) { const l = archVia(p); return { key: l, label: l }; }
  const k = p.v || 'other';
  return { key: k, label: RISE_VIA[k] || RISE_VIA.other };
}

/* ─────────────────────────── counting ─────────────────────────── */

export type Row = { label: string; reached: number; connected: number | null; wrote: number; interested: number; booked: number };
export function tally(ctx: ReportCtx, ps: ReportPerson[], label: string, noConnections = false): Row {
  return {
    label,
    reached: ps.length,
    connected: noConnections ? null : ps.filter((p) => !!p.conn).length,
    wrote: ps.filter(wrote).length,
    // RISE: said yes at any point; ARCH: latest reply says yes or asks (its DATA-MAP rule)
    interested: ps.filter((p) => (isArch(ctx) ? interestedNow(ctx, p) : (p.y || []).length > 0)).length,
    booked: ps.filter((p) => !!p.bk).length,
  };
}

/** One ledger per line: everyone in the line, then one row per way we found them. */
export function linesData(ctx: ReportCtx): Array<{ ln: Line; inLine: ReportPerson[]; all: Row; rows: Row[] }> {
  const people = ctx.payload?.people || [];
  const lines = isArch(ctx) ? ARCH_LINES : RISE_LINES;
  return lines.map((ln) => {
    const inLine = people.filter((p) => lineOf(ctx, p) === ln.key);
    const byVia = new Map<string, { label: string; ps: ReportPerson[] }>();
    for (const p of inLine) {
      const v = viaOf(ctx, p);
      if (!byVia.has(v.key)) byVia.set(v.key, { label: v.label, ps: [] });
      byVia.get(v.key)!.ps.push(p);
    }
    const rows = [...byVia.entries()]
      .map(([k, g]) => tally(ctx, g.ps, g.label, !isArch(ctx) && k === 'asked'))
      .sort((a, b) => b.reached - a.reached);
    return { ln, inLine, all: tally(ctx, inLine, `All ${ln.title.toLowerCase()}`), rows };
  }).filter((x) => x.inLine.length > 0);
}

/** NIGHT v3 (2026-09-29): the ONE funnel Outreach and Performance both draw, in one set of
 *  words (reached, connected, replied, said yes, booked a call). It is the "All" rows of the
 *  ledger above added up, so both tabs print the same five numbers. ARCH's fourth stage is its
 *  own "interested now" rule, so it keeps that name. Empty when the board has no people. */
export type FunnelStage = { key: 'reached' | 'connected' | 'replied' | 'yes' | 'booked'; label: string; v: number };
export function funnelStages(ctx: ReportCtx): FunnelStage[] {
  const lines = linesData(ctx);
  if (!lines.length) return [];
  const sum = (k: 'reached' | 'connected' | 'wrote' | 'interested' | 'booked') => lines.reduce((t, l) => t + (l.all[k] ?? 0), 0);
  return [
    { key: 'reached', label: 'Reached', v: sum('reached') },
    { key: 'connected', label: 'Connected', v: sum('connected') },
    { key: 'replied', label: 'Replied', v: sum('wrote') },
    { key: 'yes', label: isArch(ctx) ? 'Interested now' : 'Said yes', v: sum('interested') },
    { key: 'booked', label: 'Booked a call', v: sum('booked') },
  ];
}

function LinesLedger({ ctx }: { ctx: ReportCtx }) {
  const people = ctx.payload?.people || [];
  const interestedLabel = isArch(ctx) ? 'Interested now' : 'Interested';
  return (
    <div style={{ marginTop: 36 }}>
      <Eyebrow tone="ink">Who we reach, and what came of it</Eyebrow>
      <Footnote style={{ marginTop: 6, maxWidth: '78ch' }}>
        {isArch(ctx)
          ? <>Grouped by the kind of company, then by how we found each person. Everyone is counted once, since {dm(ctx.cfg.start)}.</>
          : <>Two groups of people, and where we found them, since {dm(ctx.cfg.start)}. Interested means they said yes to a scan or a chat.</>}
      </Footnote>
      {linesData(ctx).map(({ ln, inLine, all, rows }) => {
        const cells = (r: Row) => [r.reached, r.connected, r.wrote, r.interested, r.booked];
        const heads = ['reached', 'connected', 'wrote back', interestedLabel.toLowerCase(), 'calls booked'];
        return (
          <div key={ln.key} style={{ marginTop: 26 }}>
            <div style={{ fontFamily: 'var(--cb-serif)', fontWeight: 700, fontSize: 18, color: 'var(--cb-ink)' }}>{ln.title}</div>
            <Footnote style={{ marginTop: 2 }}>{ln.sub}</Footnote>
            <Ledger
              className="cb-report-tbl cb-pipe-tbl"
              style={{ marginTop: 10 }}
              columns={[{ label: 'How we found them' }, ...['Reached', 'Connected', 'Wrote back', interestedLabel, 'Calls booked'].map((l) => ({ label: l, align: 'right' as const, width: '1%' }))]}
            >
              <LedgerRow tone="group">
                <LedgerCell valign="middle"><span style={{ fontSize: 14.5, fontWeight: 800 }}>{all.label}</span></LedgerCell>
                {cells(all).map((v, i) => <LedgerCell key={i} num align="right" valign="middle">{fmt(v)}</LedgerCell>)}
              </LedgerRow>
              {rows.map((r) => (
                <LedgerRow key={r.label}>
                  <LedgerCell valign="middle"><span style={{ fontSize: 14, fontWeight: 600, color: 'var(--cb-ink-soft)' }}>{r.label}</span></LedgerCell>
                  {cells(r).map((v, i) => (
                    <LedgerCell key={i} num align="right" valign="middle" style={v ? { fontWeight: 600 } : { color: MUTE, fontWeight: 500 }}>
                      {fmt(v)}
                    </LedgerCell>
                  ))}
                </LedgerRow>
              ))}
            </Ledger>
            <div className="cb-pipe-stack" style={{ marginTop: 8 }}>
              {[all, ...rows].map((r, ri) => (
                <div key={r.label} style={{ padding: '10px 0', borderTop: `1px solid ${ri === 1 ? 'var(--cb-line-bold)' : 'var(--cb-line)'}` }}>
                  <div style={{ fontSize: 14, fontWeight: ri === 0 ? 800 : 600, color: ri === 0 ? 'var(--cb-ink)' : 'var(--cb-ink-soft)' }}>{r.label}</div>
                  <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: '2px 12px', fontSize: 13, color: MUTE }}>
                    {cells(r).map((v, i) => (
                      <span key={i}><b style={{ color: 'var(--cb-ink)', fontWeight: 800 }}>{fmt(v)}</b> {v === 1 && i === 4 ? 'call booked' : heads[i]}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {!isArch(ctx) && ln.key === 'owner' && <StoreKinds ps={inLine} />}
          </div>
        );
      })}
      {isArch(ctx) && <ArchCameFrom ps={people} />}
      {!isArch(ctx) && people.some((p) => (p.v || '') === 'asked') && (
        <Footnote style={{ marginTop: 10 }}>A dot: people who asked to connect were already connected when we met them.</Footnote>
      )}
    </div>
  );
}

function ChipRow({ items }: { items: ChipItem[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
      {items.map((c) => (
        <Chip key={c.key} style={{ fontSize: 12.5, padding: '4px 11px' }}>
          <b style={{ marginRight: 5 }}>{c.n}</b>{c.label}
          {c.booked ? <span style={{ marginLeft: 7, color: 'var(--cb-mint)', fontWeight: 800 }}>{c.booked} booked a call</span> : null}
        </Chip>
      ))}
    </div>
  );
}

export type ChipItem = { key: string; n: number; label: string; booked?: number };
export function storeKindItems(ps: ReportPerson[]): ChipItem[] {
  const m = new Map<string, { n: number; booked: number }>();
  for (const p of ps.filter(wrote)) {
    const label = RISE_CAT[norm(p.cat)] || (p.cat ? 'other stores' : 'not sorted yet');
    const e = m.get(label) || { n: 0, booked: 0 };
    e.n += 1; if (p.bk) e.booked += 1;
    m.set(label, e);
  }
  return [...m.entries()]
    .sort((a, b) => (a[0] === 'not sorted yet' ? 1 : b[0] === 'not sorted yet' ? -1 : b[1].n - a[1].n))
    .map(([label, e]) => ({ key: label, n: e.n, label, booked: e.booked }));
}

function StoreKinds({ ps }: { ps: ReportPerson[] }) {
  const items = storeKindItems(ps);
  if (!items.length) return null;
  return (
    <div style={{ marginTop: 16 }}>
      <Eyebrow>What kinds of stores wrote back</Eyebrow>
      <ChipRow items={items} />
    </div>
  );
}

export function archCameFromItems(ps: ReportPerson[]): ChipItem[] {
  const m = new Map<string, number>();
  for (const p of ps.filter(wrote)) { const s = archGroup(p).sub; m.set(s, (m.get(s) || 0) + 1); }
  return [...m.entries()]
    .sort((a, b) => (a[0].startsWith('not sorted') ? 1 : b[0].startsWith('not sorted') ? -1 : b[1] - a[1]))
    .map(([label, n]) => ({ key: label, n, label }));
}

function ArchCameFrom({ ps }: { ps: ReportPerson[] }) {
  const items = archCameFromItems(ps);
  if (!items.length) return null;
  return (
    <div style={{ marginTop: 20 }}>
      <Eyebrow>Conversations came from</Eyebrow>
      <ChipRow items={items} />
    </div>
  );
}

/* ─────────────────────────── the people lists ─────────────────────────── */

/** Our own bookkeeping notes stored as message text, e.g. "(blank invite - no note by design)". */
const INTERNAL_NOTE = /^\s*\((blank invite|no note|internal|system)[^)]*\)\s*$/i;
/** "Alexander reacted 👏" is a reaction, not something they wrote. */
export const REACTION = /^\s*[\p{L}.'’-]+(?: [\p{L}.'’-]+)* reacted\b/iu;
export const shownText = (m: LogMessage) => {
  const t = (m.text || '').trim();
  if (!t || INTERNAL_NOTE.test(t)) return '';
  return t;
};

export function intentChip(ctx: ReportCtx, li?: string | null): string | null {
  const v = norm(li);
  if (!v) return null;
  if (v === 'negative') return 'Not now';
  if (v === 'price_ask') return 'Asked about price';
  if (v === 'info_ask') return 'Asked for details';
  if (v === 'booking') return 'Asked for a time';
  if (v === 'positive' || v === 'soft_yes') return isArch(ctx) ? 'Said yes' : 'Interested';
  return null;
}

function Thread({ ctx, entry, renderReplySource }: { ctx: ReportCtx; entry: LogEntry; renderReplySource?: ReplySourceRenderer }) {
  const msgs = (entry.messages || []).filter((m) => shownText(m)).slice().sort((a, b) => ((a.sent_at || '') < (b.sent_at || '') ? -1 : 1));
  if (!msgs.length) return <>{renderReplySource?.(entry.prospect_id, true)}<Footnote style={{ marginTop: 0 }}>No messages to show yet.</Footnote></>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {renderReplySource?.(entry.prospect_id, true)}
      {msgs.map((m, i) => {
        const mine = m.direction === 'outbound';
        const email = /email/i.test(`${m.channel || ''} ${m.type || ''}`);
        const k = dayKey(m.sent_at, ctx.cfg.tz);
        return (
          <div key={i} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: 'min(560px, 92%)', borderRadius: 12, padding: '9px 12px', background: mine ? 'var(--cb-paper-sunk)' : 'var(--cb-paper)', border: '1px solid var(--cb-line)' }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: MUTE }}>
              {mine ? 'You' : (entry.name || 'Them').split(' ')[0]}{email ? ' · email' : ''}{k ? ` · ${dm(k)}` : ''}
            </div>
            <div style={{ marginTop: 4, fontSize: 14, lineHeight: 1.5, color: 'var(--cb-ink)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{REACTION.test(shownText(m)) ? `Reacted ${shownText(m).replace(REACTION, '').trim()}` : shownText(m)}</div>
          </div>
        );
      })}
    </div>
  );
}

export type Card_ = { p: ReportPerson; entry: LogEntry | null; last: string | null; extra?: BookedExtra };

export function lastInboundText(entry: LogEntry | null): string {
  // The latest thing they WROTE; a bare reaction is skipped when there is real text before it.
  const ins = (entry?.messages || []).filter((m) => m.direction === 'inbound' && shownText(m));
  ins.sort((a, b) => ((a.sent_at || '') < (b.sent_at || '') ? -1 : 1));
  const written = ins.filter((m) => !REACTION.test(shownText(m)));
  const t = shownText(written[written.length - 1] || ins[ins.length - 1] || { direction: 'inbound', channel: null, type: null, sent_at: null, text: '' }).replace(/\s+/g, ' ').trim();
  if (REACTION.test(t)) return '';
  return t.length > 150 ? `${t.slice(0, 147).trimEnd()}…` : t;
}

function PersonRows({ ctx, rows, accent, booked, hideYes, renderReplySource }: { ctx: ReportCtx; rows: Card_[]; accent: string; booked?: boolean; hideYes?: boolean; renderReplySource?: ReplySourceRenderer }) {
  const [openSources, setOpenSources] = React.useState<Record<string, boolean>>({});
  return (
    <div>
      {rows.map(({ p, entry, last, extra }, i) => {
        const k = dayKey(booked ? p.bk : last, ctx.cfg.tz);
        const quote = lastInboundText(entry);
        const chip = booked || hideYes && ['positive', 'soft_yes'].includes(norm(p.li)) ? null : intentChip(ctx, p.li);
        return (
          <div key={`${p.n}-${i}`} style={{ borderTop: i ? '1px solid var(--cb-line)' : undefined, padding: '12px 0 4px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--cb-ink)' }}>{p.n || 'Name not shown'}</span>
              {p.c && <span style={{ fontSize: 13, color: 'var(--cb-ink-soft)' }}>{p.c}</span>}
              {chip && <Chip style={{ fontSize: 11.5, padding: '2px 9px' }}>{chip}</Chip>}
              <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                {extra?.scan_url && <a href={extra.scan_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--cb-ink)', border: '1px solid var(--cb-line-bold)', borderRadius: 999, padding: '4px 11px', textDecoration: 'none' }}>Their scan</a>}
                {extra?.brief_url && <a href={extra.brief_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#fff', background: accent, borderRadius: 999, padding: '4px 11px', textDecoration: 'none' }}>Pre-call brief</a>}
                {k && <span style={{ fontSize: 12.5, fontWeight: 700, color: MUTE, whiteSpace: 'nowrap' }}>{booked ? `booked ${dm(k)}` : dm(k)}</span>}
              </span>
            </div>
            {quote && <div style={{ marginTop: 4, fontSize: 13.5, lineHeight: 1.45, color: 'var(--cb-ink-soft)' }}>“{quote}”</div>}
            {entry && (entry.messages || []).length > 0 && (
              <Drill label="the messages" ruled={false} summaryStyle={{ padding: '4px 0 6px' }} onToggle={(event) => { const open = event.currentTarget.open; setOpenSources((old) => ({ ...old, [entry.prospect_id]: open })); }}>
                <Thread ctx={ctx} entry={entry} renderReplySource={openSources[entry.prospect_id] ? renderReplySource : undefined} />
              </Drill>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ListSection({ id, title, note, count, children, open = true }: { id?: string; title: string; note?: string; count: number; children: React.ReactNode; open?: boolean }) {
  return (
    <Card style={{ marginTop: 14, padding: '6px 24px 10px' }}>
      <div id={id} />
      <details open={open}>
        <summary style={{ listStyle: 'none', cursor: 'pointer', display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', padding: '12px 0 6px' }}>
          <Eyebrow tone="ink" style={{ margin: 0 }}>{title}</Eyebrow>
          <span style={{ fontFamily: 'var(--cb-serif)', fontWeight: 700, fontSize: 16, color: 'var(--cb-ink)' }}>{count}</span>
          {note && <span style={{ fontSize: 12.5, fontWeight: 600, color: MUTE }}>{note}</span>}
          <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: MUTE }}>open / close</span>
        </summary>
        {children}
      </details>
    </Card>
  );
}

/* ─────────────────────────── the tab ─────────────────────────── */

/** The accent strip above the Pipeline tab: who is interested right now, newest first. */
export function pipelineStripText(ctx: ReportCtx): string {
  const ps = (ctx.payload?.people || []).filter((p) => interestedNow(ctx, p))
    .sort((a, b) => ((a.lr || '') < (b.lr || '') ? 1 : -1));
  if (!ps.length) {
    const n = (ctx.payload?.people || []).filter((p) => !!p.bk).length;
    return n ? `${n} ${n === 1 ? 'call' : 'calls'} booked since ${dm(ctx.cfg.start)}.` : 'Your conversations, with the real messages.';
  }
  const who = isArch(ctx) ? (ps.length === 1 ? 'person is' : 'people are') : (ps.length === 1 ? 'founder is' : 'founders are');
  const newest = ps[0];
  return `${ps.length} ${who} interested right now. Newest: ${newest.n}${newest.c ? `, ${newest.c}` : ''}.`;
}

/** Everything the Pipeline tab counts and lists, shared by the desk and the night view. */
export function pipelineData(ctx: ReportCtx, log?: LogEntry[] | null, booked: BookedExtra[] = []) {
  const people = ctx.payload?.people || [];
  const arch = isArch(ctx);

  // Threads by name (+ company when both carry one). ARCH hides its hand-listed threads.
  const entries = (log || []).filter((e) => !(arch && ARCH_HIDDEN.some((h) => (e.prospect_id || '').startsWith(h))));
  const hiddenNames = new Set((log || []).filter((e) => !entries.includes(e)).map((e) => norm(e.name)));
  const byName = new Map<string, LogEntry>();
  for (const e of entries) {
    const k = norm(e.name);
    const prev = byName.get(k);
    if (!prev || (e.last_reply_at || '') > (prev.last_reply_at || '')) byName.set(k, e);
  }
  const visible = people.filter((p) => !hiddenNames.has(norm(p.n)));
  const card = (p: ReportPerson): Card_ => {
    const entry = byName.get(norm(p.n)) || null;
    const ws = p.w || [];
    const last = entry?.last_reply_at || ws[ws.length - 1] || null;
    const extra = booked.find((b) => norm(b.name) === norm(p.n));
    return { p, entry, last, extra };
  };

  const bookedRows = visible.filter((p) => !!p.bk).map(card).sort((a, b) => ((a.p.bk || '') < (b.p.bk || '') ? 1 : -1));
  const interested = visible.filter((p) => interestedNow(ctx, p)).map(card).sort((a, b) => ((a.last || '') < (b.last || '') ? 1 : -1));
  const since = Date.now() - 30 * DAY_MS;
  const inSet = new Set([...bookedRows, ...interested].map((c) => c.p));
  const recent = visible.filter((p) => wrote(p) && !inSet.has(p)).map(card)
    .filter((c) => c.last && Date.parse(c.last) >= since)
    .sort((a, b) => ((a.last || '') < (b.last || '') ? 1 : -1));

  const nBooked = people.filter((p) => !!p.bk).length;
  const nInterested = people.filter((p) => interestedNow(ctx, p)).length;
  const nWrote = people.filter(wrote).length;
  const bookedNames = bookedRows.slice(0, 3).map((c) => c.p.n).filter(Boolean) as string[];
  return { people, bookedRows, interested, recent, nBooked, nInterested, nWrote, bookedNames };
}

export function ReportPipeline({ ctx, accent, log, booked = [], queue, queueCount, renderReplySource }: {
  ctx: ReportCtx;
  accent: string;
  log?: LogEntry[] | null;
  booked?: BookedExtra[];
  /** ARCH: the live review page (Queue), rendered by the surface. */
  queue?: React.ReactNode;
  queueCount?: number | null;
  renderReplySource?: ReplySourceRenderer;
}) {
  const [view, setView] = React.useState<'conv' | 'queue'>('conv');
  const arch = isArch(ctx);
  const { bookedRows, interested, recent, nBooked, nInterested, nWrote, bookedNames } = pipelineData(ctx, log, booked);
  const who = arch ? (nInterested === 1 ? 'person is' : 'people are') : (nInterested === 1 ? 'founder is' : 'founders are');
  const night = useNight();
  const quiet = useQuiet();
  // NIGHT MOCKUP (local only): the same model, drawn in the ARCH report's look. QUIET holds
  // the space on the light ground (no dark block flashes in while the chunk loads).
  if (night) {
    return (
      <React.Suspense fallback={<div aria-busy="true" style={{ minHeight: 900, background: quiet ? 'transparent' : '#111', borderRadius: '26px 8px 8px 8px' }} />}>
        <PipelineNight renderReplySource={renderReplySource} ctx={ctx} accent={accent} log={log} booked={booked} queue={queue} queueCount={queueCount} />
      </React.Suspense>
    );
  }

  const figs = [
    { key: 'calls', strong: true, value: nBooked, caption: `${nBooked === 1 ? 'call' : 'calls'} booked since ${dm(ctx.cfg.start)}` },
    { key: 'interested', strong: true, value: nInterested, caption: arch ? 'interested right now: their latest reply, in the last two weeks, says yes or asks for details' : 'interested right now: said yes in the last two weeks, not booked yet' },
    { key: 'wrote', value: nWrote, caption: `${nWrote === 1 ? 'person' : 'people'} wrote back since ${dm(ctx.cfg.start)}` },
  ].filter((f) => f.key !== 'interested' || f.value > 0);

  return (
    <div data-report="pipeline">
      <style>{PICKER_CSS + PIPE_CSS}</style>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <Eyebrow>Outreach</Eyebrow>
        {queue && (
          <div role="tablist" style={{ display: 'flex', gap: 6 }}>
            <Pill active={view === 'conv'} onClick={() => setView('conv')}>Conversations</Pill>
            <Pill active={view === 'queue'} onClick={() => setView('queue')}>Queue{queueCount ? ` ${queueCount}` : ''}</Pill>
          </div>
        )}
      </div>

      {view === 'queue' && queue ? queue : (
        <>
          <DeskH2 style={{ maxWidth: '40ch', textWrap: 'balance' } as React.CSSProperties}>
            {nBooked > 0 ? <><b>{nBooked} {nBooked === 1 ? 'call' : 'calls'} booked</b> so far{bookedNames.length && arch ? `, with ${bookedNames.join(', ').replace(/, ([^,]*)$/, ' and $1')}` : ''}.</> : <>Your booked calls land here.</>}
            {nInterested > 0 ? <> {nInterested} more {who} interested right now.</> : null}
          </DeskH2>
          <ReportFigures figs={figs} />

          <LinesLedger ctx={ctx} />
          <CallsChart ctx={ctx} />
          <ListSection id="cb-pipe-interested" title="Interested right now" count={interested.length} note={arch ? 'their latest reply, in the last two weeks, says yes or asks for details' : 'said yes to a scan or a chat in the last two weeks, not booked yet'} open={interested.length > 0}>
            {interested.length ? <PersonRows renderReplySource={renderReplySource} ctx={ctx} rows={interested} accent={accent} hideYes /> : <Footnote>Nobody right now.</Footnote>}
          </ListSection>
          <ListSection title="Calls booked" count={bookedRows.length} note="most recent first" open={bookedRows.length > 0}>
            {bookedRows.length ? <PersonRows renderReplySource={renderReplySource} ctx={ctx} rows={bookedRows} accent={accent} booked /> : <Footnote>Booked calls land here with the pre-call brief.</Footnote>}
          </ListSection>
          <ListSection title="Wrote back" count={recent.length} note="everyone else who replied in the last 30 days" open={false}>
            {recent.length ? <PersonRows renderReplySource={renderReplySource} ctx={ctx} rows={recent} accent={accent} /> : <Footnote>Nobody else in the last 30 days.</Footnote>}
          </ListSection>

        </>
      )}
    </div>
  );
}

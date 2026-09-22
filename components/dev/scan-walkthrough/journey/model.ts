/// <reference types="vite/client" />
import type { ContentSystem } from '../../../../lib/scanTypes';
import original from './samples.json';

export type JourneySamples = NonNullable<ContentSystem['sample_output']>;
export type JourneyPillars = NonNullable<ContentSystem['pillars']>;
export type JourneyAudience = NonNullable<ContentSystem['audience']>;
export interface JourneyFixture {
  slug: string; domain: string;
  /** The scan's own read of the prospect: hero table cells and the counted audience audit. */
  pillars?: JourneyPillars;
  audience?: JourneyAudience;
  thesis?: string;
  founder: { name: string; firstName: string; company: string; headline: string; avatarUrl?: string };
  buyer: { role: string; project: string };
  samples: JourneySamples;
  /** The scan's lead-magnet cover (local copy for Andrew, remote for loaded scans). */
  lm_cover_local: string;
  post_labels?: string[];
  post_notes?: Record<string, string>;
  source: { kind: 'original-scan' | 'preview-draft'; url: string; capturedOn: string };
}
export const fixture = original as JourneyFixture;

export interface JourneyReceipt { key: string; label: string; value: number; prefix?: string; suffix?: string; decimals?: number; cap: string; mark?: boolean }
export interface JourneyHook {
  /** The counted gift when the audit produced one; the page leads with it. */
  count?: { prefix: string; value: number; rest: string };
  headline: string; lede: string; warning: string; warningBody?: string;
  figureLabel?: string; figureSub?: string; receipts: JourneyReceipt[]; gapLine?: string; caveat?: string;
  named: { name: string; headline: string }[];
}
const LEGACY_BUYER = 'a decision maker at a consumer brand: founder, CMO, or head of growth';
/** Mirrors the public report's fold: the same counted numbers, the same floors, the same words. */
export function deriveHook(aud: JourneyAudience | undefined, thesis: string | undefined, who: string): JourneyHook {
  const clean = (t?: string) => (t || '').replace(/\s*—\s*/g, ', ').replace(/\s+/g, ' ').trim();
  const named = (aud?.named ?? []).filter(n => (n?.name || '').trim()).slice(0, 3).map(n => ({ name: clean(n.name), headline: clean(n.headline) }));
  const netCount = aud?.network_icp_count ?? null, netSample = aud?.network_sample ?? null, netTotal = aud?.network_total ?? null;
  const engIcp = aud?.engager_icp_count ?? 0, engagers = aud?.engagers ?? 0, posts = aud?.posts ?? 0;
  const netDensity = aud?.network_icp_density ?? (netCount !== null && netSample ? Math.round((netCount / netSample) * 1000) / 10 : null);
  const netOk = netCount !== null && netSample !== null && netSample >= 30 && netCount >= 3 && (netDensity ?? 0) >= 2;
  const buyerWords = clean(aud?.buyer_definition || '') || LEGACY_BUYER;
  const est = netOk && netTotal && netTotal > (netSample as number) && (netSample as number) * 10 >= netTotal
    ? (() => { const x = ((netCount as number) / (netSample as number)) * netTotal; return x >= 100 ? Math.round(x / 10) * 10 : Math.round(x / 5) * 5; })()
    : null;
  const mode: 'network' | 'engager' | null = netOk ? 'network' : (engIcp >= 1 && named.length > 0 ? 'engager' : null);
  const fallbackLede = 'The attention is real. The mechanism that keeps it is the part that was never built.';
  if (!aud || !mode) return { headline: thesis ? clean(thesis) : fallbackLede, lede: thesis ? fallbackLede : 'Your samples are below: the posts, the lead magnet, the newsletter and the messages, all under your name.', warning: 'What runs today, and what we’d run.', receipts: [], named: [] };
  const gapLine = engagers > 0
    ? `Your last ${posts} posts drew ${engagers} ${engagers === 1 ? 'person' : 'people'}. ${engIcp === 0 ? 'Not one of them was a buyer.' : `${engIcp} ${engIcp === 1 ? 'was a buyer' : 'were buyers'}. The rest were not.`}`
    : `Your last ${posts} posts drew no reactions or comments we could read. The buyers above never hear from you.`;
  if (mode === 'network') {
    const figure = est ?? (netCount as number);
    return {
      count: { prefix: est ? '~' : '', value: figure, rest: `buyers already sit in your network, ${who}.` },
      headline: `${est ? '~' : ''}${figure} buyers already sit in your network, ${who}.`,
      lede: thesis ? clean(thesis) : 'This page shows the machine that works them.',
      warning: 'Warning · a room of buyers, no mechanism',
      warningBody: netDensity !== null ? `${est ? '~' : ''}${figure} buyers sit in your network. That is ${netDensity}% of it. Today, nothing you run reaches them.` : 'They are already connected to you. Today, nothing you run reaches them.',
      figureLabel: 'Buyers already connected to you',
      figureSub: est
        ? `We read ${netSample} of your ${(netTotal as number).toLocaleString('en-US')} connections and counted ${netCount} buyers, name by name. Averaged over the full list that lands near ${est}. A buyer here means ${buyerWords}.`
        : `Counted one by one in the ${netSample} connections we read, each verified from their own headline. A buyer here means ${buyerWords}.`,
      receipts: ([
        netSample != null ? { key: 'read', label: 'Connections read', value: netSample, cap: netTotal ? `of ${netTotal.toLocaleString('en-US')}, one headline at a time` : 'one headline at a time' } : null,
        netCount != null ? { key: 'buyers', label: 'Buyers verified', value: netCount, cap: 'named one at a time from their own headline' } : null,
        netDensity != null ? { key: 'density', label: 'Buyer density', value: netDensity, suffix: '%', decimals: 1, mark: true, cap: 'a typical room reads 1 to 2%' } : null,
      ] as (JourneyReceipt | null)[]).filter((r): r is JourneyReceipt => !!r),
      gapLine,
      caveat: est
        ? `Counted from what we actually read: ${netSample} of your connections and the reactions and comments on your last ${posts} posts, one headline at a time. The ~${est} averages that count over your full ${(netTotal as number).toLocaleString('en-US')}; every name above is verified.`
        : `Counted from what we actually read: ${[netSample ? `${netSample} of your connections` : '', posts ? `the reactions and comments on your last ${posts} posts` : ''].filter(Boolean).join(' and ')}, classified one headline at a time. No estimates on this page.`,
      named,
    };
  }
  return {
    count: { prefix: '', value: engIcp, rest: `${engIcp === 1 ? 'buyer is' : 'buyers are'} already in your comments, ${who}.` },
    headline: `${engIcp} ${engIcp === 1 ? 'buyer is' : 'buyers are'} already in your comments, ${who}.`,
    lede: thesis ? clean(thesis) : 'This page shows the machine that works them.',
    warning: 'Warning · buyers in your comments, no follow-up',
    warningBody: 'They already show up in your comments. Today, nothing you run follows up.',
    figureLabel: 'Buyers already in your comments',
    figureSub: `Counted among the ${engagers} people who engaged your last ${posts} posts, each verified from their own headline. A buyer here means ${buyerWords}.`,
    receipts: [
      { key: 'buyers', label: 'Buyers in your comments', value: engIcp, mark: true, cap: 'decision makers, named from their own headline' },
      { key: 'reached', label: 'People reached', value: engagers, cap: `across your last ${posts} posts` },
      { key: 'posts', label: 'Posts read', value: posts, cap: 'reactions and comments, one at a time' },
    ],
    gapLine,
    caveat: `Counted from what we actually read: ${[netSample ? `${netSample} of your connections` : '', posts ? `the reactions and comments on your last ${posts} posts` : ''].filter(Boolean).join(' and ')}, classified one headline at a time. No estimates on this page.`,
    named,
  };
}
/** The public report's scrubbers, verbatim: approval language never reaches the prospect, nor builder jargon. */
export const scrubApproval = (t?: string) => (t || '')
  .replace(/,?\s*(?:sent|dispatched|queued|prepared|drafted|written)?\s*for (?:your|her|his|their|the)?\s*(?:approval|review|sign[- ]?off)\b[^.!?]*/gi, '')
  .replace(/\bready to approve\b/gi, 'ready')
  .replace(/\byour only job is to approve\b/gi, 'we run it')
  .replace(/\byou (?:review and |just )?approve\b/gi, 'we handle it')
  .replace(/\bdrafted\b/gi, 'written')
  .replace(/\s{2,}/g, ' ')
  .replace(/\s+([.,;:])/g, '$1')
  .replace(/,(?=\s*[.,;:])/g, '')
  .trim()
  .replace(/[,;:]\s*$/, '')
  .replace(/([^.!?…])$/, '$1.');
const scrubJargon = (t: string) => t.replace(/\b(?:the|this|his|her|their)\s+corpus\b/gi, m => (/^[A-Z]/.test(m) ? 'Your public posts' : 'your public posts')).replace(/\bYour public posts shows\b/g, 'Your public posts show');
const DANGLING_TAIL = /\b(?:gets?|is|are|be|and|or|waiting|waits?|ready|drafts?|arrives?|ships?)\.$/i;
const scrubOrFallback = (raw: string, fallback: string) => {
  const out = scrubApproval(raw);
  const cut = out.replace(/\.$/, '') !== raw.trim().replace(/\.$/, '');
  return cut && (DANGLING_TAIL.test(out) || out.split(/\s+/).length < 6) ? fallback : out;
};
const PROJECTED_FALLBACK: Record<keyof JourneyPillars, string> = {
  content: 'A week of posts under your name.',
  inbound: 'A gated asset in your brand names every reader. A newsletter and a follow-up sequence keep them.',
  outbound: 'Everyone who engages a post gets a warm message that references it. Around 15 a week, capped.',
};
/** The three pillar rows of the fold table, scrubbed like the public report, with the chapter each one jumps to. */
export function pillarRows(p: JourneyPillars | undefined) {
  const rows: { key: keyof JourneyPillars; name: string; anchor: string }[] = [{ key: 'content', name: 'Content', anchor: 'content' }, { key: 'inbound', name: 'Inbound', anchor: 'inbound' }, { key: 'outbound', name: 'Warm outbound', anchor: 'outreach' }];
  return rows.map(r => {
    const found = (p?.[r.key]?.found || '').trim(), projected = (p?.[r.key]?.projected || '').trim();
    return { ...r, found: found ? scrubJargon(scrubApproval(found)) : '', projected: scrubJargon(scrubOrFallback(projected || PROJECTED_FALLBACK[r.key], PROJECTED_FALLBACK[r.key])) };
  }).filter(r => r.found);
}
/** Public asset path that works at '/' in the app and at './' in the standalone preview build. */
/** Rendered carousel slides per scan (brand-asset renderer output, saved with the preview). */
export const slideImages: Record<string, string[]> = { 'luiza-vass-8c': [1,2,3,4,5,6].map(n => `scan-preview/slides/luiza-vass-8c/${n}.png`), 'andrew-hayes-94': [1,2,3,4,5,6].map(n => `scan-preview/slides/andrew-hayes-94/${n}.png`) };
export function slideImagesFor(f: JourneyFixture) { return (slideImages[f.slug] || []).map(asset); }
export function asset(p: string) { return `${import.meta.env.BASE_URL}${p.replace(/^\//, '')}`; }
export interface JourneyState { subscribed: boolean }

export type JourneyAction = { type: 'subscription'; value: boolean };
export const initialJourneyState: JourneyState = { subscribed: false };
export function journeyReducer(state: JourneyState, action: JourneyAction): JourneyState {
  switch (action.type) {
    case 'subscription': return { ...state, subscribed: action.value };
  }
}
export const newsletterDraft = {
  issue: 'No. 1',
  subject: 'Before the brand enters the story',
  preview: 'One exercise for your next post. Two minutes.',
  intro: 'Hi Alex. One thing this week, from the checklist you pulled.',
  section: { h: 'Start with the person.', body: 'Open your last draft. Underline the first sentence that names a person and says what they were doing. If you can only underline your company name, start again with a customer’s day.\n\nAsk them: “What were you feeling when it happened?” Keep their words in front of you as you write.' },
  cta: 'Reply with your first three lines. I’ll tell you where I got curious.',
};
/** One issue = one idea. Loaded scans carry a full newsletter; the preview shows its first section. */
export function newsletterFor(f: JourneyFixture) {
  const n = f.samples.newsletter as { subject?: string; preview?: string; cta?: string; sections?: { h: string; body: string }[] } | undefined;
  if (n?.sections?.length) return { issue: 'No. 1', subject: n.subject || n.sections[0].h, preview: n.preview || '', intro: `Hi Alex. One thing this week, from ${f.founder.firstName}.`, section: n.sections[0], cta: n.cta || '', fromScan: true, more: n.sections.length - 1 };
  return { ...newsletterDraft, fromScan: false, more: 0 };
}

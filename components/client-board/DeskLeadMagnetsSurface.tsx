import React, { useState } from 'react';
import {
  Eyebrow, DeskH2, Plate, PlateMute, Num, Chip, Cols, SectionRule, Blank, StatBlank,
  Stat, StatStrip, Card, Footnote, Drill, Thumb,
} from './desk-kit';
import { LmDetailDrawer } from '../ClientBoardPage';
import type { Board, LeadMagnetEntry } from '../ClientBoardPage';

/** Local copy of ClientBoardPage's format-label map (not exported by the original —
 *  duplicating a 6-line lookup table is cheaper than widening the shared-symbol surface). */
const LM_FORMAT_LABEL: Record<string, string> = {
  assessment: 'Assessment', calculator: 'Calculator', worksheet: 'Worksheet', checklist: 'Checklist',
  benchmark: 'Benchmark', report_card: 'Report card', diagnostic: 'Diagnostic',
};

/** Build-stage label for a not-yet-live entry. Derived from the real `status` field only. */
const BUILD_STATUS_LABEL: Record<string, string> = { in_production: 'In production', planned: 'Planned', built: 'Built', idea: 'Drawn up' };

/** Local structural copy of ClientBoardPage's (unexported) `LmIdea` shape — same reasoning
 *  as LM_FORMAT_LABEL above: mirroring six fields is cheaper than exporting a new type out
 *  of the 7000-line original. This is the `board.lm_ideas` entry — the pipeline of
 *  not-yet-built lead magnets, distinct from `board.lead_magnets` (the live shelf). */
type LmIdeaLite = {
  id: string; title: string; format?: string; status?: string; note?: string;
  source_label?: string; cover_url?: string;
};

/** Structural extras from the staged corrected `board.lead_magnets` proposal
 *  (phase1-evidence-1d §6). Field names there are canonical: `status` widens to
 *  'live' | 'live_unannounced' | 'drafted', plus `posted_to_linkedin`, `posted_date`,
 *  `posted_note`, `page_live`, `optins`, `linkedin_activity`, `date_label`. All optional:
 *  today's 3-entry array carries none of them and must render exactly as before. */
type ShelfEntry = LeadMagnetEntry & {
  posted_to_linkedin?: boolean;
  posted_date?: string;
  posted_note?: string;
  page_live?: boolean;
  optins?: number;
  linkedin_activity?: string;
};

/** Opt-in count for an entry: staged shape uses `optins`, the frozen shape used
 *  `captured`. Absent on both -> undefined (renders the blank, never 0). */
const optinsOf = (e: ShelfEntry): number | undefined =>
  typeof e.optins === 'number' ? e.optins : (typeof e.captured === 'number' ? e.captured : undefined);

/** "23 Jul" from a bare date or ISO timestamp; unparseable -> '' (same parse-safety
 *  rationale as ClientBoardPage's fmtDay, which isn't the right shape here: it prefixes
 *  the weekday and the announce mark wants "announced DD Mon"). */
function fmtAnnouncedDay(iso?: string): string {
  if (!iso) return '';
  const d = /[T ]/.test(iso) ? new Date(iso) : new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** Feed-announce state for a shelf tile, derived ONLY from fields the data actually
 *  carries. Status grammar ratified 07-20: a page is not "launched" until the feed post
 *  runs. Unknown/absent fields -> null -> today's rendering, no invented marks. */
function announceMark(e: ShelfEntry): string | null {
  if (e.posted_to_linkedin === true && e.posted_date) {
    const day = fmtAnnouncedDay(e.posted_date);
    return day ? `announced ${day}` : null;
  }
  if (e.posted_to_linkedin === false || e.status === 'live_unannounced') {
    return 'page live, not announced on the feed yet';
  }
  return null;
}

/**
 * Desk skin for the lead-magnet library. Frag: frag-lm.html. Original: `LeadMagnetSurface`
 * in ClientBoardPage.tsx (the `live` branch: library only, no embed, no leads table — that
 * content lives on the Leads tab elsewhere on the live board).
 *
 * Block order: computed headline -> live shelf (plate) -> "Drawn up next" mockup tiles ->
 * nurture rail (newsletter, if any) -> stat footer. Every number is read off
 * `board.lead_magnets` (the live shelf) / `board.lm_ideas` (the drawn-up-next pipeline) /
 * `board.newsletter`; nothing is invented.
 */
export default function DeskLeadMagnetsSurface({ board, accent, mint, fontStack, live = false, desk = true, onEditPromo }: {
  desk?: boolean;
  board: Board; accent: string; mint: string; fontStack: string; live?: boolean;
  onEditPromo?: (lmId: string, field: 'email' | 'dm', value: unknown) => Promise<{ ok: boolean; error?: string }>;
}) {
  // Drawer state kept local, exactly like the original: opening a shelf card sets it,
  // closing clears it. Nothing about the drawer's own wiring changes.
  const [lmDetail, setLmDetail] = useState<LeadMagnetEntry | null>(null);

  const entries: ShelfEntry[] = board.lead_magnets || [];
  // Shelf = pages that are live on the client's domain, announced or not. A
  // 'live_unannounced' page IS live on the site; it just carries the not-announced mark.
  // A 'drafted' entry never shelves as live — it joins the pipeline section below.
  const liveEntries = entries.filter((e) => e.status === 'live' || e.status === 'live_unannounced');
  const liveN = liveEntries.length;
  const draftedEntries = entries.filter((e) => e.status === 'drafted');

  // The build pipeline lives in `board.lm_ideas`, NOT in non-'live' `lead_magnets` entries —
  // on a real board every lead_magnets row is already live; ideas-in-progress are a
  // separate list. Reading the wrong field here is exactly how "0 drawn up next" renders
  // while three real ideas exist.
  // Dedupe against the shelf: an idea that has already shipped as a live lead magnet
  // must never ALSO list as pipeline (round-2 critic: a false three replaced round-1's
  // false zero). Match on normalized title.
  const norm = (t?: string | null) => (t || '').trim().toLowerCase().replace(/^(the|a|an)\s+/, '');
  const liveTitles = new Set((board.lead_magnets || []).map((e) => norm(e.title)));
  const ideas: LmIdeaLite[] = (((board.lm_ideas as LmIdeaLite[] | undefined) || [])).filter((i) => !liveTitles.has(norm(i.title)));
  const ideasN = ideas.length;
  // Pipeline = lm_ideas (not yet built) + 'drafted' lead_magnets entries (page drafted,
  // not live). Today's array has no drafted entries, so pipelineN === ideasN as before.
  const pipelineN = ideasN + draftedEntries.length;

  const anyCaptured = entries.some((e) => typeof optinsOf(e) === 'number');
  const totalCaptured = entries.reduce((sum, e) => sum + (optinsOf(e) ?? 0), 0);

  const nl = board.newsletter;
  const nurtureSteps = nl?.nurture || [];

  const openEntry = (entry: LeadMagnetEntry) => setLmDetail(entry);

  return (
    <div data-surface="lm">
      <Eyebrow>Lead magnets</Eyebrow>
      <DeskH2>
        {liveN} lead {liveN === 1 ? 'magnet is' : 'magnets are'} <b>live on your site</b>
        {pipelineN > 0 ? <>, {pipelineN} more drawn up.</> : '.'}
      </DeskH2>

      <Plate style={{ marginTop: 18 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18 }}>
          <div style={{ flex: '0 0 auto' }}>
            <Num size="hero" tone="accent">{liveN}</Num>
            <PlateMute as="div" style={{ fontSize: 12.5, fontWeight: 700, marginTop: 6, lineHeight: 1.35 }}>
              live right now
            </PlateMute>
          </div>
          {/* Decorative direction arrow, not a data encoding on its own numbers — carries
              data-viz so the panel always has a drawn element even when the newsletter
              rail (the other data-viz source) is absent. */}
          <div data-viz="" style={{ flex: '1 1 0', minWidth: 0, display: 'flex', alignItems: 'center', gap: 5, marginBottom: 16 }}>
            <span style={{ flex: 1, borderTop: '1px dashed rgba(255,255,255,.45)' }} />
            <span style={{ width: 0, height: 0, borderTop: '9px solid var(--cb-accent)', borderLeft: '6px solid transparent', borderRight: '6px solid transparent' }} />
          </div>
        </div>

        {liveEntries.length > 0 ? (
          <Cols n={3} min={240} gap={16} style={{ marginTop: 22 }}>
            {liveEntries.map((entry) => (
              <div
                key={entry.id}
                role="button"
                tabIndex={0}
                aria-label={`Open ${entry.title}`}
                onClick={() => openEntry(entry)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEntry(entry); } }}
                style={{
                  flex: '1 1 260px', display: 'flex', flexDirection: 'column', cursor: 'pointer',
                  background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.14)',
                  borderRadius: 20, padding: '15px 15px 8px',
                }}
              >
                {entry.cover_url ? (
                  <Thumb
                    src={entry.cover_url}
                    alt={`Cover: ${entry.title}`}
                    size="lg"
                    style={{ width: '100%', maxWidth: '100%', minWidth: 0, height: 'auto', aspectRatio: '1.12 / 1', objectFit: 'contain', background: 'var(--cb-paper-sunk)', borderRadius: 14 }}
                  />
                ) : (
                  <Blank on="plate" style={{ width: '100%', maxWidth: '100%', height: 170, borderRadius: 14 }} />
                )}
                <div style={{ fontFamily: 'var(--cb-serif)', fontWeight: 600, fontSize: 15.5, color: 'var(--cb-plate-ink)', marginTop: 12, lineHeight: 1.3 }}>
                  {entry.title}
                </div>
                {/* The promise prose stays OFF the shelf tile \u2014 the full pitch lives in the
                    DETAILS drill below. A fixed min-height on this row (not the promise
                    clamp) is what keeps opt-ins/url/DETAILS lined up across tiles even when
                    one tile's chip pair wraps to two lines and a sibling's doesn't. */}
                <div style={{ marginTop: 11, minHeight: 62, display: 'flex', alignItems: 'flex-start', alignContent: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
                  <Chip tone="plate">{LM_FORMAT_LABEL[entry.format] || entry.format}</Chip>
                  <Chip tone="accent">live on your domain</Chip>
                </div>
                {/* Feed-announce state, ONLY when the data carries it (staged shape).
                    Today's frozen entries have no posted fields -> no mark, tile
                    renders exactly as before. */}
                {announceMark(entry) && (
                  <PlateMute as="div" style={{ fontSize: 12, fontWeight: 700, marginTop: 8, lineHeight: 1.4 }}>
                    {announceMark(entry)}
                  </PlateMute>
                )}
                <div style={{ marginTop: 10 }}>
                  {typeof optinsOf(entry) === 'number' ? (
                    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 5 }}>
                      <Num size="row" inline tone="plate">{optinsOf(entry)}</Num>
                      <PlateMute style={{ fontSize: 12 }}>opt-ins</PlateMute>
                    </span>
                  ) : (
                    <StatBlank on="plate" caption="opt-ins: not shown here yet" style={{ maxWidth: 150 }} />
                  )}
                </div>
                {entry.url && (
                  <a
                    href={entry.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    style={{ display: 'block', marginTop: 10, fontSize: 12, fontWeight: 700, color: 'var(--cb-plate-ink)', textDecoration: 'underline', overflowWrap: 'anywhere' }}
                  >
                    {entry.url.replace(/^https?:\/\//, '')}
                  </a>
                )}
                {/* marginTop:'auto' has to sit on THIS div — the actual flex child of the
                    card's column — not on the Drill nested inside it, or the auto margin
                    has no flex context to push against and the footer stops tracking the
                    card's bottom edge. */}
                <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 'auto' }}>
                  <Drill label="Details" on="plate" style={{ borderTop: '1px solid rgba(255,255,255,.16)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '5px 12px', fontSize: 12.5, lineHeight: 1.45 }}>
                      <span style={{ color: 'var(--cb-plate-mute)', fontWeight: 700 }}>Format</span>
                      <span style={{ color: 'var(--cb-plate-ink)' }}>{LM_FORMAT_LABEL[entry.format] || entry.format}</span>
                      {entry.promise && (
                        <>
                          <span style={{ color: 'var(--cb-plate-mute)', fontWeight: 700 }}>Inside</span>
                          <span style={{ color: 'var(--cb-plate-ink)' }}>{entry.promise}</span>
                        </>
                      )}
                      {entry.url && (
                        <>
                          <span style={{ color: 'var(--cb-plate-mute)', fontWeight: 700 }}>Lives at</span>
                          <span style={{ color: 'var(--cb-plate-ink)', wordBreak: 'break-word' }}>{entry.url}</span>
                        </>
                      )}
                    </div>
                  </Drill>
                </div>
              </div>
            ))}
          </Cols>
        ) : (
          <Blank on="plate" style={{ marginTop: 22, width: '100%' }}>No lead magnets live yet</Blank>
        )}
      </Plate>

      {pipelineN > 0 && (
        <div style={{ marginTop: 20 }}>
          <SectionRule
            label="Drawn up next"
            count={pipelineN}
            blurb={pipelineN === 1 ? 'lead magnet in the pipeline' : 'lead magnets in the pipeline'}
          />
          <Cols n={2} min={220} gap={16} style={{ marginTop: 16 }}>
            {/* 'drafted' lead_magnets entries render in the pipeline treatment — a drafted
                page is never a live shelf item. */}
            {draftedEntries.map((entry) => (
              <Blank
                key={entry.id}
                style={{
                  flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-start',
                  textAlign: 'left', minHeight: 150, padding: '14px 14px 16px',
                }}
              >
                <div style={{ fontFamily: 'var(--cb-serif)', fontWeight: 600, fontSize: 15.5, color: 'var(--cb-ink)', lineHeight: 1.3 }}>
                  {entry.title}
                </div>
                <div style={{ marginTop: 11, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {entry.format && <Chip>{LM_FORMAT_LABEL[entry.format] || entry.format}</Chip>}
                  <Chip>Page drafted</Chip>
                </div>
              </Blank>
            ))}
            {ideas.map((idea) => (
              <Blank
                key={idea.id}
                style={{
                  flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-start',
                  textAlign: 'left', minHeight: 150, padding: '14px 14px 16px',
                }}
              >
                <div style={{ fontFamily: 'var(--cb-serif)', fontWeight: 600, fontSize: 15.5, color: 'var(--cb-ink)', lineHeight: 1.3 }}>
                  {idea.title}
                </div>
                <div style={{ marginTop: 11, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Chip>{BUILD_STATUS_LABEL[idea.status || ''] || 'Drawn up'}</Chip>
                </div>
              </Blank>
            ))}
          </Cols>
        </div>
      )}

      {/* The full nurture sequence lives on the Newsletter tab — one pointer here,
          never a second copy of the rail (duplication reads as filler). */}
      {nl && (
        <Card style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
            <Eyebrow tone="ink">{nl.name}</Eyebrow>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--cb-ink-mute)' }}>
              Every opt-in enters the {nurtureSteps.length || ''}-step sequence on the Newsletter tab.
            </span>
            {nl.cadence && <Chip>{nl.cadence}</Chip>}
          </div>
        </Card>
      )}

      <StatStrip>
        <Stat value={liveN} caption="tools live" />
        <Stat value={pipelineN} caption="drawn up next" />
        {anyCaptured ? (
          <Stat value={totalCaptured} caption="opt-ins captured" />
        ) : (
          <StatBlank caption="opt-ins: not shown here yet" />
        )}
      </StatStrip>

      {lmDetail && (
        <LmDetailDrawer
          entry={lmDetail}
          board={board}
          accent={accent}
          mint={mint}
          fontStack={fontStack}
          live={live}
          onClose={() => setLmDetail(null)}
          onEditPromo={live ? onEditPromo : undefined}
        />
      )}
    </div>
  );
}

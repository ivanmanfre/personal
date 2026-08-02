import React from 'react';
import {
  Eyebrow, DeskH2, Footnote, Plate, PlateMute, PlateRule, Card, Num, Chip,
  SectionRule, Stat, StatStrip, StatBlank, Blank,
} from './desk-kit';
import type { Board } from '../ClientBoardPage';

/** Cuts a step detail at the last clause boundary (sentence end or comma) at or before
 *  ~`max` characters — never mid-word, never a dangling half-clause. Falls back to the
 *  last whole word when the sentence carries no punctuation inside the window. Replaces
 *  the old hard 52-char slice, which cut straight through the middle of a clause. */
function clauseTruncate(detail?: string, max = 64): string | undefined {
  if (!detail) return detail;
  if (detail.length <= max) return detail;
  const window = detail.slice(0, max + 1);
  let boundary = -1;
  for (let i = window.length - 1; i >= 0; i--) {
    if (window[i] === '.' || window[i] === '!' || window[i] === '?' || window[i] === ',') { boundary = i; break; }
  }
  if (boundary >= 0) {
    const head = detail.slice(0, boundary + 1).replace(/,$/, '').trim();
    return detail.length > boundary + 1 ? `${head}…` : head;
  }
  const sp = detail.lastIndexOf(' ', max);
  const head = sp > 0 ? detail.slice(0, sp) : detail.slice(0, max);
  return `${head.trim()}…`;
}

/** Desk skin: the Newsletter tab as one dark plate + an honest issues ledger.
 *  Same props as NewsletterSurface; presentation only. The board JSON's `status`
 *  field is operator vocabulary and is deliberately never rendered here — the
 *  cadence line carries the client-register version of the same fact. */
export default function DeskNewsletterSurface({ board, accent: _accent, fontStack: _fontStack, onOpenIssue, live: _live = false }: {
  board: Board;
  accent: string;
  fontStack: string;
  onOpenIssue?: (issue: unknown) => void;
  live?: boolean;
}) {
  const nl = board.newsletter;
  if (!nl) return null;
  const issues = nl.issues || [];
  const steps = nl.nurture || [];

  return (
    <div data-surface="newsletter">
      <Eyebrow>Newsletter</Eyebrow>
      <DeskH2>
        {issues.length > 0
          ? <>{nl.name} has <b>{issues.length} {issues.length === 1 ? 'issue' : 'issues'} out</b>.</>
          : <>{nl.name} is <b>drafted and ready</b>, first issue when sending opens.</>}
      </DeskH2>

      <Plate style={{ marginTop: 18 }} data-viz>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <Num size="hero" tone="accent">{steps.length}</Num>
          <PlateMute style={{ fontSize: 13, fontWeight: 700 }}>steps from an opt-in to a call ask</PlateMute>
        </div>
        {steps.length > 0 && (
          <div data-viz style={{ marginTop: 16, display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(min(150px, 100%), 1fr))`, gap: 10 }}>
            {steps.map((st, i) => (
              <div key={i} style={{ borderLeft: i === 0 ? '3px solid var(--cb-accent)' : '3px solid var(--cb-plate-line)', paddingLeft: 12, paddingBottom: 26, minHeight: 148 }}>
                <Num size="row" tone={i === 0 ? 'accent' : 'plate'}>{i + 1}</Num>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--cb-plate-ink)', marginTop: 6, lineHeight: 1.3 }}>{st.step}</div>
                <PlateMute as="div" style={{ fontSize: 11.5, marginTop: 4, lineHeight: 1.4 }}>{clauseTruncate(st.detail)}</PlateMute>
              </div>
            ))}
          </div>
        )}
        <PlateRule style={{ marginTop: 16 }} />
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <PlateMute style={{ fontSize: 12.5, fontWeight: 700 }}>Sends from {nl.from_domain || '—'}</PlateMute>
          {nl.cadence && <Chip tone="plate">{nl.cadence}</Chip>}
        </div>
      </Plate>

      <SectionRule label="Issues" count={issues.length || undefined} style={{ marginTop: 28 }} />
      {issues.length === 0 ? (
        <Card style={{ marginTop: 12 }}>
          <Blank style={{ height: 190 }}>no issues out yet</Blank>
        </Card>
      ) : (
        <Card style={{ marginTop: 12, padding: '4px 26px' }}>
          {issues.map((iss: any, i: number) => (
            <button
              key={i}
              onClick={() => onOpenIssue && onOpenIssue(iss)}
              style={{ display: 'flex', width: '100%', alignItems: 'baseline', gap: 12, padding: '13px 0', borderTop: i ? '1px solid var(--cb-line)' : 'none', background: 'none', border: 'none', textAlign: 'left', cursor: onOpenIssue ? 'pointer' : 'default' }}
            >
              <span style={{ flex: 'none', width: 64, fontSize: 12.5, fontWeight: 800, color: 'var(--cb-ink-mute)' }}>{iss.date || iss.sent_at || ''}</span>
              <span style={{ flex: '1 1 160px', minWidth: 0, fontSize: 14, fontWeight: 600, color: 'var(--cb-ink)' }}>{iss.subject || iss.title || 'Issue'}</span>
            </button>
          ))}
        </Card>
      )}

      <StatStrip style={{ marginTop: 22 }}>
        <Stat value={steps.length} caption="steps in the sequence" />
        <Stat value={issues.length} caption="issues out" />
        <StatBlank caption="subscribers: not tracked yet" />
      </StatStrip>
      <Footnote>Issue history lands here as each one sends.</Footnote>
    </div>
  );
}

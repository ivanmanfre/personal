import React, { useMemo, useState } from 'react';
import { HeadRow } from '../primitives';
import { useKyleStealBox, type StealCard } from '../../../hooks/useKyleStealBox';

/**
 * Steal Box — tactics worth stealing, mined from Kyle Hunt's agency-coaching calls.
 * Reads the PII-safe `kyle_steal_box` view (Kyle-the-coach's own tactics only;
 * prospect names/quotes never reach the browser). Outreach angles (which need
 * prospect identity) deliberately live in a private channel, not here.
 */

function fmtCallDate(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
}

function prettyCallType(t: string | null): string {
  if (!t) return '';
  return t.replace(/_/g, ' ');
}

const Loading = () => (
  <div style={{ padding: '2rem 0', color: 'var(--d-paper-dim)', fontSize: 13 }}>Loading steal box…</div>
);

function Empty({ hint }: { hint?: string }) {
  return (
    <div className="dv-card" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
      <div style={{ fontSize: 22, marginBottom: 8 }}>🛠️</div>
      <h3 style={{ fontSize: 15, marginBottom: 6 }}>No steal tactics yet</h3>
      <p style={{ fontSize: 13, color: 'var(--d-paper-dim)', margin: 0 }}>
        {hint || 'Tactics surface here as the Kyle-call extractor finds them.'}
      </p>
    </div>
  );
}

function StealTile({ card }: { card: StealCard }) {
  return (
    <div className="dv-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div
        className="dv-card-lbl"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}
      >
        <span style={{ letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: 11, color: 'var(--d-good)' }}>
          Kyle · steal
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--d-paper-dim)' }}>
          {typeof card.signal_score === 'number' && (
            <span title="Source-call signal strength (1–5)">signal {card.signal_score}/5</span>
          )}
          {card.call_date && <span>{fmtCallDate(card.call_date)}</span>}
        </span>
      </div>

      {(card.call_type || card.summary) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {card.call_type && (
            <span
              style={{
                alignSelf: 'flex-start',
                fontSize: 10.5,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                padding: '2px 7px',
                borderRadius: 999,
                background: 'var(--d-ink-2)',
                color: 'var(--d-paper-dim)',
                border: '1px solid var(--d-rule-strong, rgba(255,255,255,0.12))',
              }}
            >
              {prettyCallType(card.call_type)}
            </span>
          )}
          {card.summary && (
            <p style={{ fontSize: 12.5, lineHeight: 1.5, margin: 0, color: 'var(--d-paper-dim)' }}>
              {card.summary}
            </p>
          )}
        </div>
      )}

      <h3 style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.4, margin: 0, color: 'var(--d-paper)' }}>
        {card.tactic}
      </h3>

      {card.how_ivan_applies && (
        <p style={{ fontSize: 13, lineHeight: 1.5, margin: 0, color: 'var(--d-paper-dim)' }}>
          <span style={{ color: 'var(--d-good)', fontWeight: 600 }}>→ </span>
          {card.how_ivan_applies}
        </p>
      )}

      {card.evidence_quote && (
        <blockquote
          style={{
            margin: 0,
            paddingLeft: 12,
            borderLeft: '2px solid var(--d-good)',
            fontSize: 12.5,
            fontStyle: 'italic',
            lineHeight: 1.5,
            color: 'var(--d-paper-dim)',
          }}
        >
          "{card.evidence_quote}"
        </blockquote>
      )}

      {card.clickup_url && (
        <a
          href={card.clickup_url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 11.5, color: 'var(--d-good)', textDecoration: 'none', alignSelf: 'flex-start' }}
        >
          source call ↗
        </a>
      )}
    </div>
  );
}

export function StealBox() {
  const { cards, loading, error, refresh } = useKyleStealBox();
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return cards;
    return cards.filter(
      (c) =>
        c.tactic.toLowerCase().includes(term) ||
        (c.how_ivan_applies || '').toLowerCase().includes(term) ||
        (c.evidence_quote || '').toLowerCase().includes(term),
    );
  }, [cards, q]);

  const viewMissing = error && /kyle_steal_box|relation|does not exist|schema cache/i.test(error);

  return (
    <>
      <HeadRow
        title="Steal"
        meta={<>{cards.length} tactic{cards.length === 1 ? '' : 's'} from Kyle's calls</>}
      />

      {!loading && !error && cards.length > 0 && (
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter tactics…"
          style={{
            width: '100%',
            maxWidth: 320,
            margin: '0 0 1.25rem',
            padding: '8px 12px',
            background: 'var(--d-ink-2)',
            border: '1px solid var(--d-rule-strong, rgba(255,255,255,0.12))',
            borderRadius: 'var(--d-r-sm, 8px)',
            color: 'var(--d-paper)',
            fontSize: 13,
            outline: 'none',
          }}
        />
      )}

      {loading ? (
        <Loading />
      ) : viewMissing ? (
        <Empty hint="Run migrations/kyle_steal_box_view.sql in Supabase to provision the safe view." />
      ) : error ? (
        <div className="dv-card" style={{ color: 'var(--d-bad)', fontSize: 13 }}>
          Couldn't load steal box: {error}{' '}
          <button onClick={refresh} style={{ marginLeft: 8, color: 'var(--d-good)', background: 'none', border: 'none', cursor: 'pointer' }}>
            retry
          </button>
        </div>
      ) : cards.length === 0 ? (
        <Empty />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '1rem',
            alignItems: 'start',
          }}
        >
          {filtered.map((c) => (
            <StealTile key={c.key} card={c} />
          ))}
        </div>
      )}
    </>
  );
}

import React, { useMemo } from 'react';
import { HeadRow, SectionLabel } from '../primitives';
import { usePulse, type PulseStatus, type PulseResult } from '../../../lib/usePulse';
import type { PulseSection } from '../../../lib/pulseRegistry';

/**
 * System Pulse — the anti-rot freshness instrument (Phase 4 born-dead prototype).
 *
 * Measures freshness instead of asserting it: every row's status is computed
 * live by usePulse from the real last-write timestamp of the source table.
 * The three Phase-2 rot mechanisms become permanent on-screen instrumentation —
 * silent feed death (frozen), RLS blindness (no-access), and dormant archives
 * (dormant since <ts>) can no longer hide.
 */

const SECTION_ORDER: PulseSection[] = [
  'Today',
  'Content',
  'Pipeline',
  'Clients',
  'System',
  'Archive',
];

interface StatusMeta {
  label: string;
  color: string;
  bg: string;
}

const STATUS_META: Record<PulseStatus, StatusMeta> = {
  fresh:       { label: 'fresh',     color: 'var(--d-good)',        bg: 'var(--d-good-bg)' },
  quiet:       { label: 'quiet',     color: 'var(--d-warn)',        bg: 'var(--d-warn-bg)' },
  frozen:      { label: 'frozen',    color: 'var(--d-bad-txt)',     bg: 'var(--d-bad-bg)' },
  empty:       { label: 'empty',     color: 'var(--d-paper-dimmer)', bg: 'rgba(255,255,255,0.05)' },
  'no-access': { label: 'no-access', color: 'var(--d-accent)',      bg: 'var(--d-accent-bg)' },
  dormant:     { label: 'dormant',   color: 'var(--d-paper-dimmer)', bg: 'rgba(255,255,255,0.04)' },
};

function StatusChip({ status }: { status: PulseStatus }) {
  const m = STATUS_META[status];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
        fontSize: 10.5,
        fontWeight: 600,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        padding: '0.22rem 0.5rem',
        borderRadius: 'var(--d-r-sm)',
        color: m.color,
        background: m.bg,
        border: '1px solid currentColor',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
      {m.label}
    </span>
  );
}

/** ageMs → "3h" / "2d" / "5wk" / "4mo". */
function fmtAge(ageMs: number | null): string {
  if (ageMs === null) return '—';
  const min = ageMs / 60000;
  if (min < 60) return `${Math.max(0, Math.round(min))}m`;
  const h = min / 60;
  if (h < 48) return `${Math.round(h)}h`;
  const d = h / 24;
  if (d < 14) return `${Math.round(d)}d`;
  const wk = d / 7;
  if (wk < 9) return `${Math.round(wk)}wk`;
  return `${Math.round(d / 30)}mo`;
}

function fmtTs(ts: string | null): string {
  if (!ts) return '—';
  const dt = new Date(ts);
  if (isNaN(dt.getTime())) return '—';
  return dt.toISOString().slice(0, 16).replace('T', ' ') + 'Z';
}

function fmtProbed(probedAt: number | null): string {
  if (!probedAt) return '…';
  const d = new Date(probedAt);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function PulseRow({ r }: { r: PulseResult }) {
  const { entry } = r;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '1rem',
        padding: '0.7rem 0',
        borderBottom: '1px solid var(--d-rule)',
        flexWrap: 'wrap',
      }}
    >
      {/* label + note */}
      <div style={{ flex: '1 1 240px', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--d-paper)' }}>{entry.label}</span>
          {r.drifted && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.03em',
                color: 'var(--d-good)',
                background: 'var(--d-good-bg)',
                border: '1px solid var(--d-good)',
                borderRadius: 'var(--d-r-sm)',
                padding: '0.1rem 0.4rem',
              }}
            >
              updated {r.ts ? new Date(r.ts).toISOString().slice(0, 10) : ''}
            </span>
          )}
        </div>
        {entry.note && (
          <div style={{ fontSize: 12, color: 'var(--d-paper-dimmer)', lineHeight: 1.45, marginTop: 2 }}>
            {entry.note}
          </div>
        )}
      </div>

      {/* source table */}
      <div className="dv-mono" style={{ flex: '0 1 210px', minWidth: 0, fontSize: 12, color: 'var(--d-paper-dim)', paddingTop: 2, overflowWrap: 'anywhere' }}>
        {entry.table}
        <span style={{ color: 'var(--d-paper-dimmer)' }}>.{entry.tsColumn}</span>
      </div>

      {/* last-write ts + age */}
      <div style={{ flex: '0 0 auto', textAlign: 'right', paddingTop: 2, minWidth: 132 }}>
        <div className="dv-mono" style={{ fontSize: 12, color: 'var(--d-paper-dim)' }}>{fmtTs(r.ts)}</div>
        <div style={{ fontSize: 11, color: 'var(--d-paper-dimmer)' }}>
          {entry.cadence === 'dormant' ? 'since' : 'age'} {fmtAge(r.ageMs)}
        </div>
      </div>

      {/* status chip */}
      <div style={{ flex: '0 0 auto', paddingTop: 1 }}>
        <StatusChip status={r.status} />
      </div>
    </div>
  );
}

interface SummaryItem {
  key: PulseStatus;
  label: string;
}

const SUMMARY_ITEMS: SummaryItem[] = [
  { key: 'fresh', label: 'fresh' },
  { key: 'quiet', label: 'quiet' },
  { key: 'frozen', label: 'frozen' },
  { key: 'dormant', label: 'dormant' },
  { key: 'empty', label: 'empty' },
  { key: 'no-access', label: 'no-access' },
];

export function SystemPulse() {
  const { results, loading, probedAt, refresh } = usePulse();

  const counts = useMemo(() => {
    const c: Record<PulseStatus, number> = {
      fresh: 0, quiet: 0, frozen: 0, empty: 0, 'no-access': 0, dormant: 0,
    };
    for (const r of results) c[r.status] += 1;
    return c;
  }, [results]);

  const bySection = useMemo(() => {
    const m = new Map<PulseSection, PulseResult[]>();
    for (const r of results) {
      const arr = m.get(r.entry.section) ?? [];
      arr.push(r);
      m.set(r.entry.section, arr);
    }
    return m;
  }, [results]);

  return (
    <>
      <HeadRow
        title={<>System <em>Pulse</em></>}
        meta={<>Freshness instrument · {results.length || '…'} sources<br />probed {fmtProbed(probedAt)}</>}
        live
      />

      {/* summary strip */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.6rem',
          alignItems: 'center',
          marginBottom: 'var(--sp-5)',
        }}
      >
        {SUMMARY_ITEMS.map((s) => {
          const m = STATUS_META[s.key];
          return (
            <div
              key={s.key}
              style={{
                display: 'inline-flex',
                alignItems: 'baseline',
                gap: '0.45rem',
                padding: '0.5rem 0.85rem',
                borderRadius: 'var(--d-r-sm)',
                border: '1px solid var(--d-rule-strong)',
                background: m.bg,
              }}
            >
              <span className="dv-tnum" style={{ fontSize: 20, fontWeight: 700, color: m.color, fontVariantNumeric: 'tabular-nums' }}>
                {counts[s.key]}
              </span>
              <span style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--d-paper-dim)' }}>
                {s.label}
              </span>
            </div>
          );
        })}
        <button
          onClick={refresh}
          className="dv-mono"
          style={{
            marginLeft: 'auto',
            fontSize: 11,
            color: 'var(--d-paper-dim)',
            background: 'transparent',
            border: '1px solid var(--d-rule-strong)',
            borderRadius: 'var(--d-r-sm)',
            padding: '0.45rem 0.7rem',
            cursor: 'pointer',
          }}
        >
          re-probe ↻
        </button>
      </div>

      {loading && results.length === 0 ? (
        <div style={{ padding: '2rem 0', color: 'var(--d-paper-dim)', fontSize: 13 }}>Probing sources…</div>
      ) : (
        SECTION_ORDER.map((section) => {
          const rows = bySection.get(section);
          if (!rows || rows.length === 0) return null;
          const frozen = rows.filter((r) => r.status === 'frozen').length;
          return (
            <div key={section} style={{ marginBottom: 'var(--sp-5)' }}>
              <SectionLabel
                label={section}
                count={rows.length}
                alert={frozen > 0}
                hint={frozen > 0 ? `${frozen} frozen` : undefined}
              />
              <div>
                {rows.map((r) => (
                  <PulseRow key={r.entry.id} r={r} />
                ))}
              </div>
            </div>
          );
        })
      )}

      <div style={{ marginTop: 'var(--sp-4)', fontSize: 11.5, color: 'var(--d-paper-dimmer)', lineHeight: 1.6 }}>
        Status is computed live from each source's last-write timestamp — never stored.{' '}
        <span style={{ color: 'var(--d-accent)' }}>no-access</span> means the anon client's RLS denies the read (shown honestly, not hidden).{' '}
        Windows: realtime ≤24h · daily ≤36h · weekly ≤10d · event ≤30d · quiet = up to 3× · frozen = beyond.
      </div>
    </>
  );
}

export default SystemPulse;

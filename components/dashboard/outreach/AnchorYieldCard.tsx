import React from 'react';
import { Anchor } from 'lucide-react';
import { useAnchorYield } from '../../../hooks/useAnchorYield';

// ── Anchor yield card ────────────────────────────────────────────────────────
// One row per harvest anchor: how many prospects their orbit produced, how ICP-
// dense it is (pass %), and how the sendable ones convert (sent → accepts). This
// is the prune/keep dashboard for the bi-weekly harvester roster — the anchors
// at the top earn their slot, the dead ones at the bottom are prune candidates.

const fmtAgo = (iso: string | null): string => {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  const d = Math.floor(ms / 86_400_000);
  if (d >= 1) return `${d}d ago`;
  const h = Math.floor(ms / 3_600_000);
  if (h >= 1) return `${h}h ago`;
  return 'just now';
};

const num = (v: number) => (v === 0 ? <span style={{ color: 'var(--ds-faint, #94a3b8)' }}>0</span> : v);

export const AnchorYieldCard: React.FC = () => {
  const { rows, totals, lastRunAt, loading } = useAnchorYield();

  const card: React.CSSProperties = {
    background: 'var(--ds-card, #fff)',
    border: '1px solid var(--ds-line, #e9e9ee)',
    boxShadow: 'var(--ds-shadow-card, 0 1px 2px rgba(15,23,42,.04),0 10px 26px -18px rgba(15,23,42,.18))',
  };

  if (loading) {
    return (
      <div className="rounded-xl p-3.5" style={card}>
        <div className="h-4 w-40 rounded animate-pulse" style={{ background: 'var(--ds-bg, #f1f2f5)' }} />
      </div>
    );
  }
  if (rows.length === 0) return null;

  const totalPass = totals.scored > 0 ? Math.round((totals.sendable / totals.scored) * 1000) / 10 : null;

  return (
    <div className="rounded-xl p-3.5" style={card}>
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <Anchor className="w-3.5 h-3.5" style={{ color: '#4f46e5' }} />
        <span className="text-[11px] uppercase tracking-wider font-medium" style={{ color: 'var(--ds-dim, #475569)' }}>
          Anchor yield
        </span>
        <span className="text-[10px]" style={{ color: 'var(--ds-faint, #64748b)' }}>
          {totals.harvested.toLocaleString()} sourced · {totals.sendable} sendable{totalPass != null ? ` (${totalPass}%)` : ''} · last harvest {fmtAgo(lastRunAt)}
        </span>
      </div>

      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--ds-faint, #64748b)', borderBottom: '1px solid var(--ds-line, #e9e9ee)' }}>
              <th className="text-left px-2 py-1.5 font-medium">Anchor</th>
              <th className="text-right px-2 py-1.5 font-medium">Sourced</th>
              <th className="text-right px-2 py-1.5 font-medium">Pending</th>
              <th className="text-right px-2 py-1.5 font-medium">Sendable</th>
              <th className="text-right px-2 py-1.5 font-medium">Pass %</th>
              <th className="text-right px-2 py-1.5 font-medium">Sent</th>
              <th className="text-right px-2 py-1.5 font-medium">Accepts</th>
              <th className="text-right px-2 py-1.5 font-medium">Replies</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              // Pass-rate colour: dense (≥15%) good, thin (<8%) muted-warn, else neutral.
              const passColor = r.passRatePct == null ? 'var(--ds-faint, #94a3b8)'
                : r.passRatePct >= 15 ? '#047857'
                : r.passRatePct < 8 ? '#b45309'
                : 'var(--ds-ink, #0f172a)';
              return (
                <tr key={r.anchor} style={{ borderBottom: '1px solid var(--ds-line, #f1f2f5)' }}>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                        title={r.active ? 'Active in roster' : r.inRoster ? 'In roster, inactive' : 'Not in roster (legacy source)'}
                        style={{ background: r.active ? '#10b981' : r.inRoster ? '#cbd5e1' : '#e5b8f0' }}
                      />
                      <span className="truncate max-w-[150px]" style={{ color: 'var(--ds-ink, #0f172a)', fontWeight: 500 }} title={r.anchor}>
                        {r.anchor}
                      </span>
                      {r.reactionsEnabled && (
                        <span className="text-[8px] px-1 py-0 rounded" title="Reactors harvested, not just commenters" style={{ background: 'rgba(79,70,229,.08)', color: '#4f46e5' }}>
                          +react
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: 'var(--ds-ink, #0f172a)' }}>{r.harvested.toLocaleString()}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: r.pending > 0 ? '#b45309' : 'var(--ds-faint, #94a3b8)' }}>{num(r.pending)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-semibold" style={{ color: 'var(--ds-ink, #0f172a)' }}>{num(r.sendable)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-semibold" style={{ color: passColor }}>
                    {r.passRatePct == null ? '—' : `${r.passRatePct}%`}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: 'var(--ds-dim, #475569)' }}>{num(r.sent)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: 'var(--ds-dim, #475569)' }}>
                    {r.accepted === 0 ? num(0) : `${r.accepted}${r.acceptRatePct != null ? ` (${r.acceptRatePct}%)` : ''}`}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: r.replied > 0 ? '#047857' : 'var(--ds-faint, #94a3b8)' }}>{num(r.replied)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[9px] mt-2 px-1 leading-relaxed" style={{ color: 'var(--ds-faint, #94a3b8)' }}>
        Pass % = sendable (ICP ≥ 7) of scored · Pending = awaiting the re-score drainer · Accept % shown once an anchor has ≥ 5 invites sent.
        <span className="inline-flex items-center gap-1 ml-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: '#10b981' }} /> active
          <span className="inline-block w-1.5 h-1.5 rounded-full ml-1.5" style={{ background: '#cbd5e1' }} /> inactive
        </span>
      </p>
    </div>
  );
};

export default AnchorYieldCard;

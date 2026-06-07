import React from 'react';
import { KpiTile, KpiRow } from '../dashboard-v2/primitives';

type Props = {
  counts: Record<string, number>;
  workflows: { total: number; errors: number };
  memoryFiles: number;
};

// Capability-mix bar: segments sized by share of total, tinted by intensity.
const MIX = [
  { key: 'panel', label: 'Panels', alpha: 0.30 },
  { key: 'command', label: 'Commands', alpha: 0.46 },
  { key: 'skill', label: 'Skills', alpha: 0.66 },
  { key: 'integration', label: 'Integrations', alpha: 0.86 },
  { key: 'edge_fn', label: 'Edge fns', alpha: 1 },
];

const CapabilityHero: React.FC<Props> = ({ counts, workflows, memoryFiles }) => {
  const segs = MIX.filter((m) => (counts[m.key] || 0) > 0);
  return (
    <div style={{ marginBottom: '0.5rem' }}>
      <KpiRow>
        <KpiTile label="Skills" value={String(counts.skill || 0)} />
        <KpiTile label="Commands" value={String(counts.command || 0)} />
        <KpiTile
          label="n8n Workflows"
          value={String(workflows.total)}
          delta={workflows.errors ? `${workflows.errors} errors · 24h` : 'all healthy'}
          severity={workflows.errors ? 'bad' : 'good'}
          deltaKind={workflows.errors ? 'down' : 'flat'}
        />
        <KpiTile label="Integrations" value={String(counts.integration || 0)} />
        <KpiTile label="Memory files" value={String(memoryFiles)} />
      </KpiRow>

      <div className="dv-card-lbl" style={{ marginTop: '1.4rem', marginBottom: '0.1rem' }}>
        Capability mix
      </div>
      <div className="dv-aios-bar" role="img" aria-label="Capability mix by type">
        {segs.map((m) => {
          const n = counts[m.key] || 0;
          return (
            <div
              key={m.key}
              className="dv-aios-seg"
              style={{ flexGrow: n, flexBasis: 0, background: `rgba(42, 143, 101, ${(m.alpha * 0.22).toFixed(3)})` }}
              title={`${n} ${m.label.toLowerCase()}`}
            >
              <span className="dv-aios-seg-num">{n}</span>
              <span className="dv-aios-seg-lbl">{m.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CapabilityHero;

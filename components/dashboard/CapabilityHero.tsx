import React from 'react';
import { KpiTile, KpiRow } from '../dashboard-v2/primitives';

type Props = {
  counts: Record<string, number>;
  workflows: { total: number; errors: number };
  memoryFiles: number;
};

const CLUSTERS = [
  { key: 'skill', label: 'Skills' },
  { key: 'command', label: 'Commands' },
  { key: 'integration', label: 'Integrations' },
  { key: 'panel', label: 'Panels' },
];

const CapabilityHero: React.FC<Props> = ({ counts, workflows, memoryFiles }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 8 }}>
    <KpiRow>
      <KpiTile label="Skills" value={String(counts.skill || 0)} />
      <KpiTile
        label="Workflows"
        value={String(workflows.total)}
        delta={workflows.errors ? `${workflows.errors} errors 24h` : 'healthy'}
        severity={workflows.errors ? 'bad' : 'good'}
        deltaKind={workflows.errors ? 'down' : 'flat'}
      />
      <KpiTile label="Commands" value={String(counts.command || 0)} />
      <KpiTile label="Integrations" value={String(counts.integration || 0)} />
      <KpiTile label="Memory files" value={String(memoryFiles)} />
    </KpiRow>

    {/* Cluster band: capability domains sized by count */}
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      {CLUSTERS.map((c) => {
        const n = counts[c.key] || 0;
        return (
          <div
            key={c.key}
            style={{
              flex: `1 1 ${80 + Math.min(n, 60) * 2}px`,
              border: '1px solid var(--d-rule, #2a2a2a)',
              borderRadius: 'var(--d-r-md, 10px)',
              padding: '14px 16px',
              background: 'var(--d-surface, #141414)',
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 700 }}>{n}</div>
            <div style={{ fontSize: 12, color: 'var(--d-paper-dim, #888)' }}>{c.label}</div>
          </div>
        );
      })}
    </div>
  </div>
);

export default CapabilityHero;

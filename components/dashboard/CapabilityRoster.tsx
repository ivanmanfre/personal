import React, { useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import type { Capability } from '../../hooks/useAiosOverview';

// Deep-link each kind to its existing detail panel (section + optional sub-tab).
const LINKS: Record<string, { href: string; label: string } | undefined> = {
  skill: { href: '?section=ops&sub=skills', label: 'Skill Drafts' },
  panel: undefined,
  integration: undefined,
  edge_fn: undefined,
  command: undefined,
};

const KIND_TITLE: Record<string, string> = {
  skill: 'Skills',
  command: 'Commands',
  integration: 'Integrations',
  edge_fn: 'Edge Functions',
  panel: 'Dashboard Panels',
};
const KIND_ORDER = ['skill', 'command', 'integration', 'edge_fn', 'panel'];

const CapabilityRoster: React.FC<{ byKind: Record<string, Capability[]> }> = ({ byKind }) => {
  const [open, setOpen] = useState<Record<string, boolean>>({ skill: true });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {KIND_ORDER.filter((k) => byKind[k]?.length).map((kind) => {
        const items = byKind[kind];
        const link = LINKS[kind];
        const isOpen = open[kind] ?? false;
        return (
          <div key={kind} style={{ border: '1px solid var(--d-rule,#2a2a2a)', borderRadius: 'var(--d-r-md,10px)' }}>
            <button
              onClick={() => setOpen((o) => ({ ...o, [kind]: !isOpen }))}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                padding: '12px 14px', background: 'transparent', border: 0,
                color: 'inherit', cursor: 'pointer', font: 'inherit', textAlign: 'left',
              }}
            >
              {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <span style={{ fontWeight: 600 }}>{KIND_TITLE[kind] || kind}</span>
              <span style={{ color: 'var(--d-paper-dim,#888)', fontSize: 12 }}>({items.length})</span>
              {link && (
                <a
                  href={link.href}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    marginLeft: 'auto', fontSize: 12, display: 'flex',
                    alignItems: 'center', gap: 4, color: 'var(--d-accent,#1F6B4B)',
                  }}
                >
                  {link.label} <ExternalLink size={12} />
                </a>
              )}
            </button>
            {isOpen && (
              <div style={{ padding: '0 14px 12px 38px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {items.map((c) => (
                  <div key={`${c.kind}:${c.slug}`} style={{ display: 'flex', gap: 10 }}>
                    <span
                      title={c.invoke_count > 0 ? `used ${c.invoke_count}×` : 'no recorded use'}
                      style={{
                        width: 8, height: 8, borderRadius: 8, marginTop: 6, flex: '0 0 auto',
                        background: c.invoke_count > 0 ? 'var(--d-accent,#1F6B4B)' : 'var(--d-rule,#555)',
                      }}
                    />
                    <div>
                      <div style={{ fontWeight: 500 }}>{c.name}</div>
                      {c.description && (
                        <div style={{ fontSize: 12, color: 'var(--d-paper-dim,#888)' }}>{c.description}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default CapabilityRoster;

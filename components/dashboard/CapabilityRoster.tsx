import React, { useState } from 'react';
import { ChevronDown, ChevronRight, ArrowUpRight } from 'lucide-react';
import type { Capability } from '../../hooks/useAiosOverview';

// Deep-link each kind to its existing detail panel (section + optional sub-tab).
const LINKS: Record<string, { href: string; label: string } | undefined> = {
  skill: { href: '?section=ops&sub=skills', label: 'Skill Drafts' },
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
  // Skills + integrations open by default (the most "what can I do" groups).
  const [open, setOpen] = useState<Record<string, boolean>>({ skill: true, integration: true });

  return (
    <div>
      {KIND_ORDER.filter((k) => byKind[k]?.length).map((kind) => {
        const items = byKind[kind];
        const link = LINKS[kind];
        const isOpen = open[kind] ?? false;
        return (
          <section className="dv-aios-group" key={kind}>
            <button
              className="dv-aios-group-head"
              onClick={() => setOpen((o) => ({ ...o, [kind]: !isOpen }))}
              aria-expanded={isOpen}
            >
              <span className="dv-aios-group-chev">
                {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
              </span>
              <span className="dv-aios-group-title">{KIND_TITLE[kind] || kind}</span>
              <span className="dv-aios-group-count">{items.length}</span>
              {link && (
                <a
                  className="dv-aios-group-link"
                  href={link.href}
                  onClick={(e) => e.stopPropagation()}
                >
                  {link.label} <ArrowUpRight size={12} />
                </a>
              )}
            </button>

            {isOpen && (
              <div className="dv-aios-grid">
                {items.map((c) => (
                  <div className="dv-aios-item" key={`${c.kind}:${c.slug}`}>
                    <span
                      className={`dv-aios-item-dot${c.invoke_count > 0 ? ' dv-aios-item-dot--used' : ''}`}
                      title={c.invoke_count > 0 ? `used ${c.invoke_count}×` : 'no recorded use'}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div className="dv-aios-item-name">{c.name}</div>
                      {c.description && <div className="dv-aios-item-desc">{c.description}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
};

export default CapabilityRoster;

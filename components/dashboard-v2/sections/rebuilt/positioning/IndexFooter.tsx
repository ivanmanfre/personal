import React, { useState } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';
import { navigateToSection } from './shared';
import { externalLinks, sourceOfTruthDocs } from '../../../../../lib/strategyConfig';

const REPO_ROOT = '/Users/ivanmanfredi/Desktop/Ivan - Content System';
function localPath(url: string): string {
  if (url.startsWith('/docs/')) return `${REPO_ROOT}${url}`;
  if (url.startsWith('memory/')) return `${REPO_ROOT}/${url}`;
  return url;
}

// Cross-references: things this record intentionally does not cover.
const REFS: { tab: string; label: string; description: string }[] = [
  { tab: 'workflows', label: 'Workflows', description: 'n8n status, schedules, errors, feature flags' },
  { tab: 'content', label: 'Content', description: 'Post generation pipeline, drafts, scheduled posts' },
  { tab: 'audience', label: 'Audience', description: 'Engagement analytics, top posts, growth' },
  { tab: 'outreach', label: 'Outreach', description: 'Per-prospect actions, draft review, sending' },
  { tab: 'clients', label: 'Clients', description: 'Active engagements, billing, project status' },
];

/**
 * Index footer — the record's compact back-matter. Cross-references (nav
 * buttons, ledger element 15) and the source-of-truth register (copy-path +
 * external links, ledger SoT extras) fold together as one three-column index
 * under a heavy top rule, the way a document closes with its references.
 */
export const IndexFooter: React.FC = () => {
  const [copied, setCopied] = useState<string | null>(null);
  const copyPath = async (path: string) => {
    try {
      await navigator.clipboard.writeText(path);
      setCopied(path);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard may be blocked; no-op */
    }
  };

  return (
    <footer className="pos-index">
      <div>
        <h4 className="pos-index-h">Cross-references</h4>
        <p className="pos-index-note">For what this record intentionally does not cover.</p>
        {REFS.map((r) => (
          <button type="button" key={r.tab} className="pos-xref" onClick={() => navigateToSection(r.tab)}>
            <span className="pos-xref-t">{r.label} &rarr;</span>
            <span className="pos-xref-d">{r.description}</span>
          </button>
        ))}
      </div>

      <div>
        <h4 className="pos-index-h">Specs &amp; memory</h4>
        {sourceOfTruthDocs.map((d) => {
          const path = localPath(d.url);
          const justCopied = copied === path;
          return (
            <div className="pos-sot-row" key={d.url}>
              <div style={{ minWidth: 0 }}>
                <span className="pos-sot-t" title={d.label}>{d.label}</span>
                <code className="pos-sot-code" title={path}>{path}</code>
              </div>
              <button type="button" className="pos-iconbtn" onClick={() => copyPath(path)} title="Copy local path">
                {justCopied ? <Check size={13} /> : <Copy size={13} />}
              </button>
            </div>
          );
        })}
      </div>

      <div>
        <h4 className="pos-index-h">Live sites &amp; tools</h4>
        {externalLinks.map((l) => (
          <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="pos-link">
            <span className="pos-link-t">{l.label}</span>
            <ExternalLink size={12} style={{ color: 'var(--ec-mutedc)', flex: '0 0 auto' }} />
          </a>
        ))}
      </div>
    </footer>
  );
};

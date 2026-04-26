import React from 'react';
import { BookOpen, ExternalLink as ExtLink, FileText, Copy, Check } from 'lucide-react';
import PanelCard from '../shared/PanelCard';
import { externalLinks, sourceOfTruthDocs } from '../../../lib/strategyConfig';

const REPO_ROOT = '/Users/ivanmanfredi/Desktop/Ivan - Content System';

function localPath(url: string): string {
  // Spec / memory entries are local files — show the absolute path to the repo
  if (url.startsWith('/docs/')) return `${REPO_ROOT}${url}`;
  if (url.startsWith('memory/')) return `${REPO_ROOT}/${url}`;
  return url;
}

export const SourceOfTruthSection: React.FC = () => {
  const [copiedUrl, setCopiedUrl] = React.useState<string | null>(null);

  const copyPath = async (path: string) => {
    try {
      await navigator.clipboard.writeText(path);
      setCopiedUrl(path);
      setTimeout(() => setCopiedUrl(null), 1500);
    } catch {
      // clipboard may be blocked; silently no-op
    }
  };

  return (
    <PanelCard title="Source of Truth" accent="zinc">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center gap-1.5 mb-2 text-[11px] text-zinc-500 uppercase tracking-wider font-medium">
            <FileText className="w-3 h-3" />
            Specs &amp; Memory (local files)
          </div>
          <div className="space-y-2">
            {sourceOfTruthDocs.map(d => {
              const path = localPath(d.url);
              const justCopied = copiedUrl === path;
              return (
                <div key={d.url} className="text-xs">
                  <div className="flex items-center justify-between gap-2 group">
                    <span className="text-zinc-300 truncate" title={d.label}>{d.label}</span>
                    <button
                      onClick={() => copyPath(path)}
                      className="text-zinc-600 hover:text-cyan-400 transition-colors shrink-0"
                      title="Copy local path"
                    >
                      {justCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                  <code className="text-[10px] text-zinc-600 font-mono block truncate" title={path}>{path}</code>
                </div>
              );
            })}
          </div>
        </div>
        <div>
          <div className="flex items-center gap-1.5 mb-2 text-[11px] text-zinc-500 uppercase tracking-wider font-medium">
            <BookOpen className="w-3 h-3" />
            Live Sites &amp; Tools
          </div>
          <div className="space-y-1">
            {externalLinks.map(l => (
              <a
                key={l.url}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between text-xs text-zinc-300 hover:text-cyan-400 transition-colors group"
              >
                <span className="truncate">{l.label}</span>
                <ExtLink className="w-3 h-3 text-zinc-600 group-hover:text-cyan-400 shrink-0" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </PanelCard>
  );
};

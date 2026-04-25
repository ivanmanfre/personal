import React from 'react';
import { BookOpen, ExternalLink as ExtLink, FileText } from 'lucide-react';
import PanelCard from '../shared/PanelCard';
import { externalLinks, sourceOfTruthDocs } from '../../../lib/strategyConfig';

export const SourceOfTruthSection: React.FC = () => {
  return (
    <PanelCard title="Source of Truth" accent="zinc">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center gap-1.5 mb-2 text-[11px] text-zinc-500 uppercase tracking-wider font-medium">
            <FileText className="w-3 h-3" />
            Specs & Memory
          </div>
          <div className="space-y-1">
            {sourceOfTruthDocs.map(d => (
              <a
                key={d.url}
                href={d.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between text-xs text-zinc-300 hover:text-cyan-400 transition-colors group"
              >
                <span className="truncate">{d.label}</span>
                <ExtLink className="w-3 h-3 text-zinc-600 group-hover:text-cyan-400 shrink-0" />
              </a>
            ))}
          </div>
        </div>
        <div>
          <div className="flex items-center gap-1.5 mb-2 text-[11px] text-zinc-500 uppercase tracking-wider font-medium">
            <BookOpen className="w-3 h-3" />
            Live Sites & Tools
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

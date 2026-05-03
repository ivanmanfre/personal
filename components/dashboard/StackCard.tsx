import React, { useState } from 'react';
import { Layers, X, Server, Terminal, Box } from 'lucide-react';
import PanelCard from './shared/PanelCard';
import StatusDot from './shared/StatusDot';
import { useStackStatus, type StackStatusRow } from '../../hooks/useStackStatus';
import { timeAgo } from './shared/utils';

const CATEGORY_LABEL: Record<string, string> = {
  runtime: 'Runtimes',
  cli: 'CLI Tools',
  container: 'Containers',
  service: 'Services',
};

const CATEGORY_ICON: Record<string, React.ReactNode> = {
  runtime: <Server className="w-3.5 h-3.5" />,
  cli: <Terminal className="w-3.5 h-3.5" />,
  container: <Box className="w-3.5 h-3.5" />,
  service: <Layers className="w-3.5 h-3.5" />,
};

const CATEGORY_ORDER = ['runtime', 'cli', 'container', 'service'];

function statusToDot(s: string): 'healthy' | 'warning' | 'error' | 'inactive' {
  if (s === 'ok') return 'healthy';
  if (s === 'minor_lag') return 'warning';
  if (s === 'major_lag' || s === 'error') return 'error';
  return 'inactive';
}

const StackCard: React.FC = () => {
  const { grouped, summary, lastSync, loading } = useStackStatus();
  const [active, setActive] = useState<StackStatusRow | null>(null);

  const cats = CATEGORY_ORDER.filter((c) => grouped[c]?.length).concat(
    Object.keys(grouped).filter((c) => !CATEGORY_ORDER.includes(c))
  );

  return (
    <>
      <PanelCard
        title="Stack"
        icon={<Layers className="w-3.5 h-3.5" />}
        badge={summary.total || undefined}
        accent="cyan"
        headerRight={
          <div className="flex items-center gap-3 text-[10px] text-zinc-500">
            {summary.err > 0 && (
              <span className="flex items-center gap-1"><StatusDot status="error" /> {summary.err} err</span>
            )}
            {summary.lag > 0 && (
              <span className="flex items-center gap-1"><StatusDot status="warning" /> {summary.lag} lag</span>
            )}
            {lastSync && (
              <span className="text-zinc-600">synced {timeAgo(lastSync)}</span>
            )}
          </div>
        }
      >
        {loading && summary.total === 0 ? (
          <div className="p-6 text-center text-xs text-zinc-500">Loading stack status…</div>
        ) : summary.total === 0 ? (
          <div className="p-6 text-center text-xs text-zinc-500">No stack data yet — sync runs hourly</div>
        ) : (
          <div className="p-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {cats.map((cat) => (
              <div key={cat} className="space-y-1.5">
                <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  {CATEGORY_ICON[cat] || CATEGORY_ICON.service}
                  <span>{CATEGORY_LABEL[cat] || cat}</span>
                  <span className="text-zinc-700">{grouped[cat].length}</span>
                </div>
                <ul className="space-y-1">
                  {grouped[cat].map((r) => (
                    <li key={r.tool}>
                      <button
                        onClick={() => setActive(r)}
                        className="w-full text-left px-2 py-1.5 rounded-md hover:bg-zinc-800/50 transition-colors flex items-center justify-between gap-2 group"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <StatusDot status={statusToDot(r.status)} />
                          <span className="text-xs font-medium text-zinc-300 truncate group-hover:text-white">
                            {r.displayName}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                          {r.version || r.latestVersion || '—'}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </PanelCard>

      {active && <StackDetailModal row={active} onClose={() => setActive(null)} />}
    </>
  );
};

const StackDetailModal: React.FC<{ row: StackStatusRow; onClose: () => void }> = ({ row, onClose }) => {
  const meta = row.metadata || {};
  const skills = Array.isArray(meta.skills) ? meta.skills : null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <StatusDot status={statusToDot(row.status)} pulse size="md" />
            <div>
              <h3 className="text-base font-bold text-white">{row.displayName}</h3>
              <p className="text-[11px] text-zinc-500 uppercase tracking-wide">{row.category}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white p-1 rounded-md hover:bg-zinc-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 overflow-y-auto dashboard-scroll space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Version</div>
              <div className="font-mono text-zinc-200 mt-0.5">{row.version || '—'}</div>
            </div>
            <div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Latest</div>
              <div className="font-mono text-zinc-200 mt-0.5">{row.latestVersion || '—'}</div>
            </div>
            <div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Status</div>
              <div className="text-zinc-200 mt-0.5">{row.status}</div>
            </div>
            <div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Last Checked</div>
              <div className="text-zinc-200 mt-0.5">{timeAgo(row.lastChecked)}</div>
            </div>
          </div>

          {skills && (
            <div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">
                Skills ({skills.length})
              </div>
              <ul className="space-y-1.5 text-xs">
                {skills.map((s: any) => (
                  <li key={s.id} className="px-3 py-2 rounded-md bg-zinc-800/50 border border-zinc-800">
                    <div className="font-mono text-cyan-400">{s.id}</div>
                    {s.description && (
                      <div className="text-zinc-400 mt-1 leading-relaxed">{s.description}</div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {Object.keys(meta).filter((k) => k !== 'skills').length > 0 && (
            <div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Metadata</div>
              <pre className="text-[11px] font-mono text-zinc-300 bg-zinc-950 border border-zinc-800 rounded-md p-3 overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(
                  Object.fromEntries(Object.entries(meta).filter(([k]) => k !== 'skills')),
                  null, 2
                )}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StackCard;

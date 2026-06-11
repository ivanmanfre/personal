import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Radio, Briefcase, Flame, Plus } from 'lucide-react';
import PanelCard from '../../shared/PanelCard';
import EmptyState from '../../shared/EmptyState';
import { timeAgo } from '../../shared/utils';
import type { HarvestSource, HiringRoleOffer, DomainScreenBands, OutreachProspect } from '../../../../types/dashboard';
import { feedRollup } from '../feedHelpers';

interface Props {
  harvestSources: HarvestSource[];
  hiringMap: HiringRoleOffer[];
  bands: DomainScreenBands;
  recentHotDomains: { domain: string; intentScore: number | null; screenedAt: string | null }[];
  prospects: OutreachProspect[];
  hotDomains: Set<string>;
  onSetStatus: (id: string, status: string) => void;
  onAddSource: (name: string, linkedinUrl: string, sourceTier: string) => Promise<void> | void;
}

const tierBadge: Record<string, string> = {
  competitor: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  icp_authority: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
};

const statusBadge: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  paused: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  dropped: 'bg-zinc-500/15 text-zinc-500 border-zinc-600/25',
};

export const SourcesTab: React.FC<Props> = ({
  harvestSources, hiringMap, bands, recentHotDomains, prospects, hotDomains,
  onSetStatus, onAddSource,
}) => {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [tier, setTier] = useState('icp_authority');
  const [adding, setAdding] = useState(false);

  // Harvest feed's downstream conversion (whole feed — per-source attribution
  // isn't tracked on prospects, so we show the aggregate as context).
  const harvestRollup = useMemo(() => feedRollup(prospects, hotDomains).find((r) => r.feed === 'harvest'), [prospects, hotDomains]);

  const totalEngagers = harvestSources.reduce((a, s) => a + s.engagersInserted, 0);
  const maxYield = Math.max(...harvestSources.map((s) => s.engagersInserted), 1);

  const submit = async () => {
    if (!name.trim()) return;
    setAdding(true);
    try {
      await onAddSource(name, url, tier);
      setName(''); setUrl('');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Harvest sources — yield + prune control center */}
      <PanelCard
        title="Harvest Sources"
        accent="blue"
        icon={<Radio className="w-4 h-4" />}
        headerRight={
          <span className="text-[10px] text-zinc-500">
            {harvestSources.filter((s) => s.status === 'active').length} active · {totalEngagers} engagers harvested
          </span>
        }
      >
        {/* Add source */}
        <div className="px-4 py-3 border-b border-zinc-800/40 bg-zinc-800/10">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
              placeholder="Source name (e.g. Jane Founder)"
              className="flex-1 min-w-[160px] px-2.5 py-1.5 rounded-lg text-xs bg-zinc-900/70 border border-zinc-700/40 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/40"
            />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
              placeholder="linkedin.com/in/… (optional)"
              className="flex-1 min-w-[180px] px-2.5 py-1.5 rounded-lg text-xs bg-zinc-900/70 border border-zinc-700/40 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/40 font-mono"
            />
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value)}
              className="px-2 py-1.5 rounded-lg text-xs bg-zinc-900/70 border border-zinc-700/40 text-zinc-300 cursor-pointer"
            >
              <option value="icp_authority">ICP authority</option>
              <option value="competitor">Competitor</option>
            </select>
            <button
              onClick={submit}
              disabled={!name.trim() || adding}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-blue-500/15 text-blue-400 border border-blue-500/25 hover:bg-blue-500/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus className="w-3 h-3" /> Add source
            </button>
          </div>
          {harvestRollup && (
            <p className="text-[10px] text-zinc-600 mt-2">
              Harvest feed downstream: {harvestRollup.total} prospects · {harvestRollup.connectionSent} invited · accept {harvestRollup.connectionSent >= 8 ? `${harvestRollup.acceptRate}%` : '—'} · reply {harvestRollup.dmSent >= 8 ? `${harvestRollup.replyRate}%` : '—'} (per-source attribution not tracked; shown as feed aggregate)
            </p>
          )}
        </div>

        {harvestSources.length === 0 ? (
          <div className="px-4 py-6">
            <EmptyState title="No harvest sources" description="Add a competitor or ICP-authority profile above — the harvester pulls their post engagers into the warm feed." icon={<Radio className="w-9 h-9" />} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800/40 bg-zinc-800/10">
                  <th className="px-4 py-2.5 text-[10px] text-zinc-500 font-bold uppercase tracking-[0.1em] text-left">Source</th>
                  <th className="px-3 py-2.5 text-[10px] text-zinc-500 font-bold uppercase tracking-[0.1em] text-left">Yield</th>
                  <th className="px-3 py-2.5 text-[10px] text-zinc-500 font-bold uppercase tracking-[0.1em] text-center">Posts</th>
                  <th className="px-3 py-2.5 text-[10px] text-zinc-500 font-bold uppercase tracking-[0.1em] text-center">Last run</th>
                  <th className="px-4 py-2.5 text-[10px] text-zinc-500 font-bold uppercase tracking-[0.1em] text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {harvestSources.map((s) => {
                  const yieldPct = Math.max((s.engagersInserted / maxYield) * 100, s.engagersInserted > 0 ? 6 : 0);
                  return (
                    <tr key={s.id} className={`hover:bg-zinc-800/20 transition-colors ${s.status !== 'active' ? 'opacity-55' : ''}`}>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-200 font-medium truncate max-w-[180px]">{s.name}</span>
                          {s.sourceTier && (
                            <span className={`px-1.5 py-0.5 rounded text-[9px] border ${tierBadge[s.sourceTier] || 'bg-zinc-700/30 text-zinc-400 border-zinc-600/30'}`}>
                              {s.sourceTier.replace('_', ' ')}
                            </span>
                          )}
                          {s.linkedinUrl && (
                            <a href={s.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400/60 hover:text-blue-400 shrink-0" title="LinkedIn">
                              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2 bg-zinc-800/60 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${yieldPct}%` }}
                              transition={{ type: 'spring', stiffness: 220, damping: 28 }}
                              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400"
                            />
                          </div>
                          <span className="text-xs text-zinc-300 font-mono tabular-nums">{s.engagersInserted}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center text-xs text-zinc-500 tabular-nums">{s.postsSeen}</td>
                      <td className="px-3 py-2.5 text-center text-[10px] text-zinc-500">{s.lastHarvestedAt ? timeAgo(s.lastHarvestedAt) : 'never'}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] border ${statusBadge[s.status] || statusBadge.dropped}`}>{s.status}</span>
                          {s.status === 'active' ? (
                            <>
                              <button onClick={() => onSetStatus(s.id, 'paused')} className="text-[10px] text-amber-400/80 hover:text-amber-400">pause</button>
                              <button onClick={() => onSetStatus(s.id, 'dropped')} className="text-[10px] text-red-400/80 hover:text-red-400">drop</button>
                            </>
                          ) : (
                            <button onClick={() => onSetStatus(s.id, 'active')} className="text-[10px] text-emerald-400/80 hover:text-emerald-400">resume</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </PanelCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Hiring role → offer map */}
        <PanelCard
          title="Hiring Role → Offer Map"
          accent="amber"
          icon={<Briefcase className="w-4 h-4" />}
          headerRight={<span className="text-[10px] text-zinc-500">{hiringMap.filter((h) => h.active).length} active rules</span>}
        >
          {hiringMap.length === 0 ? (
            <div className="px-4 py-6"><EmptyState title="No role mappings" description="The hiring-signal feed maps open roles to the offer that displaces them." icon={<Briefcase className="w-9 h-9" />} /></div>
          ) : (
            <div className="divide-y divide-zinc-800/40 max-h-[420px] overflow-y-auto dashboard-scroll">
              {hiringMap.map((h) => (
                <div key={h.id} className={`px-4 py-2.5 ${!h.active ? 'opacity-50' : ''}`}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-amber-300/90 font-mono">{h.rolePattern}</span>
                    <span className="text-zinc-600 text-[10px]">→</span>
                    <span className="text-xs text-zinc-300">{h.matchedOffer || '—'}</span>
                    {!h.active && <span className="px-1.5 py-0.5 rounded text-[9px] bg-zinc-700/30 text-zinc-500">inactive</span>}
                  </div>
                  {h.interceptTemplate && (
                    <p className="text-[10px] text-zinc-500 mt-1 italic truncate" title={h.interceptTemplate}>{h.interceptTemplate}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </PanelCard>

        {/* Intent-screen band distribution */}
        <PanelCard
          title="Intent Screen"
          accent="emerald"
          icon={<Flame className="w-4 h-4" />}
          headerRight={<span className="text-[10px] text-zinc-500">{bands.total} domains screened</span>}
        >
          <div className="px-4 py-3.5 space-y-3">
            {([
              { band: 'hot', label: 'Hot', n: bands.hot, bar: 'from-emerald-500 to-emerald-600', text: 'text-emerald-400' },
              { band: 'warm', label: 'Warm', n: bands.warm, bar: 'from-amber-500 to-amber-600', text: 'text-amber-400' },
              { band: 'cold', label: 'Cold', n: bands.cold, bar: 'from-zinc-500 to-zinc-600', text: 'text-zinc-400' },
            ]).map((row) => {
              const pct = bands.total > 0 ? (row.n / bands.total) * 100 : 0;
              return (
                <div key={row.band} className="flex items-center gap-3">
                  <span className="text-[11px] text-zinc-400 w-12 shrink-0">{row.label}</span>
                  <div className="flex-1 h-5 bg-zinc-800/40 rounded-md overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ type: 'spring', stiffness: 220, damping: 28 }}
                      className={`h-full rounded-md bg-gradient-to-t ${row.bar} opacity-85`}
                      style={{ minWidth: row.n > 0 ? 4 : 0 }}
                    />
                  </div>
                  <span className={`text-xs font-bold w-10 text-right tabular-nums ${row.text}`}>{row.n}</span>
                </div>
              );
            })}
          </div>
          {recentHotDomains.length > 0 && (
            <div className="px-4 pb-3.5">
              <p className="text-[10px] uppercase tracking-wider text-zinc-600 font-semibold mb-2">Recent hot domains</p>
              <div className="flex flex-wrap gap-1.5">
                {recentHotDomains.map((d) => (
                  <span key={d.domain} className="px-2 py-0.5 rounded-md text-[10px] bg-emerald-500/10 text-emerald-400/90 border border-emerald-500/15" title={d.screenedAt ? `screened ${timeAgo(d.screenedAt)}` : ''}>
                    {d.domain}{d.intentScore != null ? <span className="text-emerald-400/50"> · {d.intentScore}</span> : null}
                  </span>
                ))}
              </div>
            </div>
          )}
          <p className="text-[10px] text-zinc-600 px-4 pb-3.5">Hot domains bump matching prospects&apos; ICP score &amp; trigger confidence, surfacing them as the warmest feed.</p>
        </PanelCard>
      </div>
    </div>
  );
};

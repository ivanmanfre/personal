import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Lock, ShieldQuestion, Package, Repeat } from 'lucide-react';
import PanelCard from '../shared/PanelCard';
import {
  positioningLock,
  positioningObjections,
  toolStackReplaced,
  toolStackTotalLabel,
  positioningLoopBreak,
} from '../../../lib/strategyConfig';

export const PositioningOfferSection: React.FC = () => {
  return (
    <PanelCard title="Positioning & Offer" accent="emerald" headerRight={<span className="text-[10px] font-mono text-zinc-600">locked 2026-07-03</span>}>
      <div className="p-4 space-y-3">
        <p className="text-[11px] text-zinc-500">
          The ratified $2k position, the objection answers, and the DIY-cost math — a live reference for sales calls.
        </p>

        <SubCard title="The Lock" icon={<Lock className="w-3 h-3" />}>
          <div className="space-y-2">
            {positioningLock.map(item => (
              <div key={item.label} className="bg-zinc-800/30 border border-zinc-700/30 rounded-xl px-3 py-2">
                <span className="text-[9.5px] font-bold text-emerald-400 uppercase tracking-[0.11em] block mb-1">{item.label}</span>
                <p className="text-[12.5px] text-zinc-300 leading-snug">{item.value}</p>
              </div>
            ))}
          </div>
        </SubCard>

        <SubCard title="Objections → answers" icon={<ShieldQuestion className="w-3 h-3" />}>
          <div className="space-y-2">
            {positioningObjections.map(o => (
              <div key={o.objection} className="grid grid-cols-1 sm:grid-cols-[0.9fr_1.25fr] gap-px bg-zinc-700/30 border border-zinc-700/30 rounded-xl overflow-hidden">
                <div className="bg-zinc-900/70 px-3 py-2">
                  <span className="text-[8.5px] font-bold text-red-400 uppercase tracking-[0.13em] block mb-0.5">Objection</span>
                  <p className="text-[12px] italic text-zinc-300 leading-snug">&ldquo;{o.objection}&rdquo;</p>
                </div>
                <div className="bg-zinc-900/70 px-3 py-2">
                  <span className="text-[8.5px] font-bold text-emerald-400 uppercase tracking-[0.13em] block mb-0.5">
                    Answer{o.isNew && <span className="text-emerald-300"> · new</span>}
                  </span>
                  <p className="text-[12px] text-zinc-400 leading-snug">{o.answer}</p>
                </div>
              </div>
            ))}
          </div>
        </SubCard>

        <SubCard title="What $2k replaces" icon={<Package className="w-3 h-3" />}>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[12.5px]">
              <thead>
                <tr>
                  <th className="text-left text-[9px] font-bold text-zinc-500 uppercase tracking-[0.1em] px-2.5 pb-2 border-b border-zinc-700/40">Tool</th>
                  <th className="text-left text-[9px] font-bold text-zinc-500 uppercase tracking-[0.1em] px-2.5 pb-2 border-b border-zinc-700/40 hidden sm:table-cell">Job</th>
                  <th className="text-right text-[9px] font-bold text-zinc-500 uppercase tracking-[0.1em] px-2.5 pb-2 border-b border-zinc-700/40">$/mo</th>
                </tr>
              </thead>
              <tbody>
                {toolStackReplaced.map(t => (
                  <tr key={t.tool}>
                    <td className="px-2.5 py-1.5 text-zinc-300 border-b border-zinc-800/50">{t.tool}</td>
                    <td className="px-2.5 py-1.5 text-zinc-500 text-[12px] border-b border-zinc-800/50 hidden sm:table-cell">{t.job}</td>
                    <td className="px-2.5 py-1.5 text-right font-mono tabular-nums text-zinc-300 border-b border-zinc-800/50">{t.cost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-3 mt-2.5 px-3 py-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <span className="text-[12.5px] text-zinc-300">Tools only, <b className="text-emerald-300">and you still run them yourself</b></span>
            <span className="font-mono font-bold text-[15px] text-zinc-100 whitespace-nowrap">{toolStackTotalLabel}</span>
          </div>
          <p className="text-[12px] text-zinc-500 mt-2 px-0.5">
            $2k covers every tool above <b className="text-zinc-300">plus</b> the operator running them. One line, zero vendor invoices, zero API keys.
          </p>
        </SubCard>

        <SubCard title="The loop & the break" icon={<Repeat className="w-3 h-3" />}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {positioningLoopBreak.map(item => (
              <div key={item.kind} className="bg-zinc-800/30 border border-zinc-700/30 rounded-xl px-3 py-2.5">
                <span className={`text-[9.5px] font-bold uppercase tracking-[0.11em] block mb-1.5 ${item.kind === 'loop' ? 'text-red-400' : 'text-emerald-400'}`}>{item.label}</span>
                <p className="text-[12.5px] text-zinc-400 leading-snug">{item.body}</p>
              </div>
            ))}
          </div>
        </SubCard>
      </div>
    </PanelCard>
  );
};

// ─── Sub-Card wrapper (matches ContentStrategySection pattern) ───

const SubCard: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="bg-zinc-900/40 border border-zinc-800/40 rounded-xl">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full px-3 py-2 flex items-center gap-2 hover:bg-zinc-800/30 transition-colors rounded-t-xl"
      >
        {collapsed ? <ChevronRight className="w-3 h-3 text-zinc-500 shrink-0" /> : <ChevronDown className="w-3 h-3 text-zinc-500 shrink-0" />}
        <span className="text-zinc-500">{icon}</span>
        <h3 className="text-[11px] font-bold text-zinc-300 uppercase tracking-[0.1em]">{title}</h3>
      </button>
      {!collapsed && <div className="px-3 pb-3 pt-1">{children}</div>}
    </div>
  );
};

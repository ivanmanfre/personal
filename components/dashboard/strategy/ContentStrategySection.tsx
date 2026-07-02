import React, { useState, useMemo } from 'react';
import {
  CalendarDays,
  Video,
  Target,
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink as ExtLink,
  ChevronDown,
  ChevronRight,
  Mic,
  FileText,
} from 'lucide-react';
import PanelCard from '../shared/PanelCard';
import {
  contentStrategyThisWeek,
  preconditionEpisodes,
  pillarMixTargets,
  auditGates,
  openDecisions,
  contentStrategyLinks,
  contentPlanTotals,
  type AuditGate,
  type ThisWeekItem,
  type PrecondictionEpisode,
  type OpenDecision,
} from '../../../lib/strategyConfig';
import { useContentLibrary, type CarouselDraft } from '../../../hooks/useContentLibrary';

const REPO_ROOT = '/Users/ivanmanfredi/Desktop/personal-site';
const PLAN_EPOCH = new Date('2026-05-03T00:00:00Z');
const CURRENT_EPISODE = 1; // TODO wire from clickup/Linkedin Posts list once series-tag column live

function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

function localPath(url: string): string {
  if (url.startsWith('/')) return `${REPO_ROOT}${url}`;
  return url;
}

const PILLAR_ORDER = ['Translator', 'Methodology', 'Teardown', 'Case Study', 'Personal'];
const PILLAR_WINDOW_DAYS = 30;

function normalizePillar(raw: unknown): string {
  if (typeof raw !== 'string') return 'Other';
  const k = raw.trim().toLowerCase().replace(/[_-]+/g, ' ');
  return PILLAR_ORDER.find(p => p.toLowerCase() === k) ?? 'Other';
}

// Drift band: how far actual sits from its target, symmetric so both
// over- and under-weight pillars flag (per the drift-visible requirement).
function mixStatus(actual: number, target: number): 'ok' | 'warn' | 'off' {
  if (!target) return 'ok';
  const rel = Math.abs(actual - target) / target;
  return rel <= 0.25 ? 'ok' : rel <= 0.5 ? 'warn' : 'off';
}

const STATUS_RULE: Record<'ok' | 'warn' | 'off', string> = {
  ok: 'border-emerald-500/60',
  warn: 'border-amber-500/60',
  off: 'border-red-500/60',
};
const STATUS_TEXT: Record<'ok' | 'warn' | 'off', string> = {
  ok: 'text-emerald-400',
  warn: 'text-amber-400',
  off: 'text-red-400',
};

export const ContentStrategySection: React.FC = () => {
  return (
    <PanelCard title="Content Strategy" accent="cyan">
      <div className="p-4 space-y-4">
        <p className="text-[11px] text-zinc-500">
          90-day plan from 2026-05 audit synthesis (C10 + V1). Day 0 = 2026-05-03. Day 90 = 2026-08-07.
        </p>
        <ThisWeekCard />
        <NinetyDayPlanCard />
        <AuditGatesCard />
        <OpenDecisionsCard />
        <QuickLinksCard />
      </div>
    </PanelCard>
  );
};

// ─── Card 1: This Week's Plan ───

const ThisWeekCard: React.FC = () => {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const toggle = (day: string) => setChecked(s => ({ ...s, [day]: !s[day] }));

  return (
    <SubCard title="This Week" icon={<CalendarDays className="w-3.5 h-3.5" />}>
      <div className="space-y-2">
        {contentStrategyThisWeek.map((item: ThisWeekItem) => (
          <ShipRow
            key={item.day}
            item={item}
            checked={!!checked[item.day]}
            onToggle={() => toggle(item.day)}
          />
        ))}
        <div className="pt-1 mt-2 border-t border-zinc-800/50 space-y-1.5">
          <CommitmentRow
            checked={!!checked['record-ep1']}
            onToggle={() => toggle('record-ep1')}
            label="Record Episode 1 (Friday deadline)"
            sub='"Twelve minutes. To read one form. That\u2019s the bug."'
            iconColor="text-amber-400"
          />
          <CommitmentRow
            checked={!!checked['icp-comments']}
            onToggle={() => toggle('icp-comments')}
            label="10-15 ICP comments / day via Comment Drafter"
            sub={'WF6 9q4bhlIBQCiCxQpq \u00b7 Day 14 audit gate measures \u226570/wk landed'}
            iconColor="text-blue-400"
          />
        </div>
      </div>
    </SubCard>
  );
};

const ShipRow: React.FC<{ item: ThisWeekItem; checked: boolean; onToggle: () => void }> = ({ item, checked, onToggle }) => (
  <button
    onClick={onToggle}
    className="w-full flex items-start gap-2.5 text-left hover:bg-zinc-800/30 rounded-lg px-2 py-1.5 transition-colors"
  >
    <div className={`mt-0.5 w-3.5 h-3.5 rounded border ${checked ? 'bg-emerald-500/30 border-emerald-500/60' : 'border-zinc-600 bg-zinc-800'} shrink-0 flex items-center justify-center`}>
      {checked && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
    </div>
    <span className="text-[10px] font-mono text-zinc-500 w-7 shrink-0 mt-0.5">{item.day}</span>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <span className={`text-sm font-medium ${checked ? 'text-zinc-500 line-through' : 'text-zinc-200'}`}>{item.format}</span>
        {item.isAnchor && <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/25">anchor</span>}
      </div>
      <p className="text-[11px] text-zinc-500 mt-0.5">{item.description}</p>
    </div>
  </button>
);

const CommitmentRow: React.FC<{ checked: boolean; onToggle: () => void; label: string; sub: string; iconColor: string }> = ({ checked, onToggle, label, sub, iconColor }) => (
  <button
    onClick={onToggle}
    className="w-full flex items-start gap-2.5 text-left hover:bg-zinc-800/30 rounded-lg px-2 py-1.5 transition-colors"
  >
    <div className={`mt-0.5 w-3.5 h-3.5 rounded border ${checked ? 'bg-emerald-500/30 border-emerald-500/60' : 'border-zinc-600 bg-zinc-800'} shrink-0 flex items-center justify-center`}>
      {checked && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
    </div>
    <Mic className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${iconColor}`} />
    <div className="flex-1 min-w-0">
      <p className={`text-sm font-medium ${checked ? 'text-zinc-500 line-through' : 'text-zinc-200'}`}>{label}</p>
      <p className="text-[11px] text-zinc-500 mt-0.5 italic">{sub}</p>
    </div>
  </button>
);

// ─── Card 2: 90-Day Plan State ───

const NinetyDayPlanCard: React.FC = () => {
  const shippedCount: number | null = null; // TODO wire from own_posts joined to plan epoch
  const { drafts, loading } = useContentLibrary();
  const [openPillar, setOpenPillar] = useState<string | null>(null);

  const mix = useMemo(() => {
    const since = Date.now() - PILLAR_WINDOW_DAYS * 86400000;
    const published = drafts.filter(
      d => d.status === 'published' && d.updatedAt && new Date(d.updatedAt).getTime() >= since,
    );
    const groups: Record<string, CarouselDraft[]> = {};
    for (const d of published) {
      const p = normalizePillar(d.taxonomy?.pillar);
      (groups[p] ||= []).push(d);
    }
    const total = published.length;
    const rows = [...PILLAR_ORDER, 'Other']
      .map(pillar => {
        const posts = groups[pillar] || [];
        return { pillar, count: posts.length, pct: total ? Math.round((posts.length / total) * 100) : 0, posts };
      })
      .filter(r => r.pillar !== 'Other' || r.count > 0);
    return { rows, total };
  }, [drafts]);

  const targetOf = (pillar: string) => pillarMixTargets.find(p => p.pillar === pillar)?.targetPct ?? 0;

  return (
    <SubCard title="90-Day Plan State" icon={<Target className="w-3.5 h-3.5" />}>
      <div className="space-y-3">
        {/* Calendar progress */}
        <div className="flex items-center gap-3 text-xs">
          <div className="font-mono">
            <span className="text-zinc-200 font-semibold">
              {shippedCount ?? '?'}
            </span>
            <span className="text-zinc-500"> / {contentPlanTotals.totalSlots} shipped</span>
          </div>
          <span className="text-zinc-600">{'\u00b7'}</span>
          <span className="text-[11px] text-zinc-500">
            {contentPlanTotals.weeks} weeks {'\u00d7'} {contentPlanTotals.slotsPerWeek} slots
          </span>
          {shippedCount === null && (
            <span className="text-[10px] text-amber-400/80 ml-auto">awaiting telemetry</span>
          )}
        </div>

        {/* Pillar mix \u2014 battery + actual vs target */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium mb-1.5">
            Pillar mix {'\u2014'} last {PILLAR_WINDOW_DAYS} days
            <span className="text-zinc-600 normal-case tracking-normal"> {'\u00b7'} {mix.total} published</span>
          </p>
          {loading ? (
            <p className="text-[11px] text-zinc-600">loading{'\u2026'}</p>
          ) : mix.total === 0 ? (
            <p className="text-[11px] text-zinc-600">No published posts in the last {PILLAR_WINDOW_DAYS} days.</p>
          ) : (
            <>
              <PillarBattery rows={mix.rows} openPillar={openPillar} onToggle={setOpenPillar} targetOf={targetOf} />
              {openPillar && (
                <PillarPile pillar={openPillar} posts={mix.rows.find(r => r.pillar === openPillar)?.posts || []} />
              )}
              <div className="space-y-1.5 mt-3">
                {pillarMixTargets.map(p => (
                  <PillarBar
                    key={p.pillar}
                    pillar={p.pillar}
                    target={p.targetPct}
                    actual={mix.rows.find(r => r.pillar === p.pillar)?.pct ?? 0}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Series progress */}
        <div className="bg-zinc-800/30 border border-zinc-700/30 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <Video className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-sm font-medium text-zinc-200">The Precondition Cut</span>
            <span className="text-[10px] text-zinc-500">{'\u2014'} Episode {CURRENT_EPISODE} of 13</span>
          </div>
          <div className="space-y-1.5">
            {preconditionEpisodes.map(ep => (
              <EpisodeRow key={ep.number} ep={ep} isCurrent={ep.number === CURRENT_EPISODE} />
            ))}
          </div>
        </div>
      </div>
    </SubCard>
  );
};

const PillarBar: React.FC<{ pillar: string; target: number; actual: number | null }> = ({ pillar, target, actual }) => {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-24 text-zinc-400 shrink-0">{pillar}</span>
      <div className="flex-1 relative h-2 bg-zinc-800 rounded overflow-hidden">
        {/* Target marker */}
        <div className="absolute top-0 bottom-0 w-px bg-zinc-500" style={{ left: `${target}%` }} title={`Target ${target}%`} />
        {/* Actual fill (if measured) */}
        {actual !== null && (
          <div
            className={`h-full ${actual >= target ? 'bg-emerald-500/40' : actual >= target * 0.7 ? 'bg-amber-500/40' : 'bg-red-500/40'}`}
            style={{ width: `${Math.min(actual, 100)}%` }}
          />
        )}
      </div>
      <span className="font-mono text-[11px] text-zinc-500 w-20 text-right shrink-0">
        {actual !== null ? `${actual}%` : '\u2014'} / {target}%
      </span>
    </div>
  );
};

// Composition "battery": one stacked bar, segments sized by share of published
// posts. Uniform fill (calm), drift signalled by a colored bottom rule + the %.
// Click a segment to expand its post pile.
const PillarBattery: React.FC<{
  rows: { pillar: string; count: number; pct: number }[];
  openPillar: string | null;
  onToggle: (p: string | null) => void;
  targetOf: (p: string) => number;
}> = ({ rows, openPillar, onToggle, targetOf }) => (
  <div>
    <div className="flex w-full h-9 gap-0.5">
      {rows.map(r => {
        const st = mixStatus(r.pct, targetOf(r.pillar));
        const isOpen = openPillar === r.pillar;
        return (
          <button
            key={r.pillar}
            onClick={() => onToggle(isOpen ? null : r.pillar)}
            title={`${r.pillar}: ${r.count} posts · ${r.pct}% (target ${targetOf(r.pillar)}%)`}
            className={`relative h-full bg-zinc-700/70 hover:bg-zinc-600/70 border-b-2 ${STATUS_RULE[st]} ${isOpen ? 'ring-1 ring-zinc-400' : ''} focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-300 transition-colors flex items-center justify-center`}
            style={{ flexBasis: `${r.pct}%`, minWidth: '2.25rem', flexGrow: 0, flexShrink: 1 }}
          >
            <span className="font-mono text-[11px] text-zinc-200">{r.count}</span>
          </button>
        );
      })}
    </div>
    <div className="flex w-full gap-0.5 mt-1">
      {rows.map(r => {
        const st = mixStatus(r.pct, targetOf(r.pillar));
        return (
          <div
            key={r.pillar}
            className="min-w-0 overflow-hidden"
            style={{ flexBasis: `${r.pct}%`, minWidth: '2.25rem', flexGrow: 0, flexShrink: 1 }}
          >
            <p className="text-[9px] text-zinc-400 truncate leading-tight">{r.pillar}</p>
            <p className={`text-[10px] font-mono leading-tight ${STATUS_TEXT[st]}`}>{r.pct}%</p>
          </div>
        );
      })}
    </div>
  </div>
);

const PillarPile: React.FC<{ pillar: string; posts: CarouselDraft[] }> = ({ pillar, posts }) => (
  <div className="mt-2 bg-zinc-900/40 border border-zinc-800/40 rounded-lg p-2.5">
    <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium mb-1.5">{pillar} {'—'} {posts.length} posts</p>
    {posts.length === 0 ? (
      <p className="text-[11px] text-zinc-600">none in window</p>
    ) : (
      <div className="space-y-1">
        {posts.slice(0, 30).map(p => (
          <div key={p.id} className="flex items-baseline gap-2 text-[11px]">
            <span className="font-mono text-zinc-600 shrink-0">{p.updatedAt?.slice(0, 10)}</span>
            <span className="text-zinc-300 truncate" title={p.title}>{p.title}</span>
          </div>
        ))}
        {posts.length > 30 && <p className="text-[10px] text-zinc-600 mt-1">+{posts.length - 30} more</p>}
      </div>
    )}
  </div>
);

const EpisodeRow: React.FC<{ ep: PrecondictionEpisode; isCurrent: boolean }> = ({ ep, isCurrent }) => (
  <div className={`flex items-start gap-2.5 px-2 py-1 rounded ${isCurrent ? 'bg-purple-500/10 border border-purple-500/25' : ''}`}>
    <span className={`text-[10px] font-mono w-7 shrink-0 mt-0.5 ${isCurrent ? 'text-purple-300' : 'text-zinc-500'}`}>Ep {ep.number}</span>
    <div className="flex-1 min-w-0">
      <p className="text-[11px] text-zinc-200 italic leading-tight">"{ep.hook}"</p>
      <p className="text-[10px] text-zinc-500 mt-0.5">
        <span className="text-zinc-400">{ep.title}</span>
        <span className="text-zinc-600"> {'\u00b7'} </span>
        <span>Format {ep.format} {'\u2014'} {ep.formatLabel}</span>
      </p>
    </div>
  </div>
);

// ─── Card 3: Audit Gates ───

const AuditGatesCard: React.FC = () => {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const today = new Date();

  return (
    <SubCard title="Audit Gates" icon={<AlertCircle className="w-3.5 h-3.5" />}>
      <div className="space-y-2">
        {auditGates.map(g => (
          <GateRow
            key={g.id}
            gate={g}
            today={today}
            checked={!!checked[g.id]}
            onToggle={() => setChecked(s => ({ ...s, [g.id]: !s[g.id] }))}
          />
        ))}
      </div>
    </SubCard>
  );
};

const GateRow: React.FC<{ gate: AuditGate; today: Date; checked: boolean; onToggle: () => void }> = ({ gate, today, checked, onToggle }) => {
  const gateDate = new Date(gate.date + 'T00:00:00Z');
  const daysOut = daysBetween(today, gateDate);
  const isPast = daysOut < 0;
  const isSoon = daysOut >= 0 && daysOut <= 7;

  const dateColor = isPast ? 'text-zinc-600' : isSoon ? 'text-amber-400' : 'text-zinc-400';
  const countdown = isPast ? `${Math.abs(daysOut)}d ago` : daysOut === 0 ? 'today' : `in ${daysOut}d`;

  return (
    <div className={`bg-zinc-800/30 border ${isSoon ? 'border-amber-500/30' : 'border-zinc-700/30'} rounded-xl px-3 py-2.5`}>
      <div className="flex items-center gap-3">
        <button
          onClick={onToggle}
          className={`w-4 h-4 rounded border ${checked ? 'bg-emerald-500/30 border-emerald-500/60' : 'border-zinc-600 bg-zinc-800'} shrink-0 flex items-center justify-center`}
          title="Mark gate as evaluated"
        >
          {checked && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
        </button>
        <span className="text-[10px] font-mono text-zinc-500 w-12 shrink-0">Day {gate.day}</span>
        <span className="text-sm font-medium text-zinc-200 flex-1 min-w-0 truncate">{gate.label}</span>
        <span className={`text-[10px] font-mono ${dateColor} shrink-0`}>{gate.date}</span>
        <span className={`text-[10px] font-mono shrink-0 ${isSoon ? 'text-amber-400' : 'text-zinc-500'}`}>
          <Clock className="w-2.5 h-2.5 inline mr-0.5 -mt-0.5" />
          {countdown}
        </span>
      </div>
      <p className="text-[11px] text-zinc-500 mt-1 ml-[36px]">{gate.description}</p>
    </div>
  );
};

// ─── Card 4: Open Decisions ───

const OpenDecisionsCard: React.FC = () => {
  return (
    <SubCard title="Open Decisions" icon={<ChevronRight className="w-3.5 h-3.5" />}>
      <div className="space-y-2">
        {openDecisions.map(d => <DecisionRow key={d.id} decision={d} />)}
      </div>
    </SubCard>
  );
};

const DecisionRow: React.FC<{ decision: OpenDecision }> = ({ decision }) => {
  const statusColor: Record<OpenDecision['status'], string> = {
    'open': 'bg-amber-500/15 text-amber-400 border-amber-500/25',
    'in-progress': 'bg-blue-500/15 text-blue-400 border-blue-500/25',
    'resolved': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  };
  return (
    <div className="bg-zinc-800/30 border border-zinc-700/30 rounded-xl px-3 py-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-sm font-medium text-zinc-200">{decision.title}</span>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-mono text-zinc-500">{decision.date}</span>
          <span className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${statusColor[decision.status]}`}>{decision.status}</span>
        </div>
      </div>
      <p className="text-[11px] text-zinc-500 mt-1">{decision.detail}</p>
    </div>
  );
};

// ─── Card 5: Quick Links ───

const QuickLinksCard: React.FC = () => {
  return (
    <SubCard title="Quick Links" icon={<FileText className="w-3.5 h-3.5" />}>
      <div className="space-y-1">
        {contentStrategyLinks.map(l => {
          const path = l.kind === 'local' ? localPath(l.url) : l.url;
          if (l.kind === 'web') {
            return (
              <a
                key={l.url}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between text-xs text-zinc-300 hover:text-cyan-400 transition-colors group py-1"
              >
                <span className="truncate">{l.label}</span>
                <ExtLink className="w-3 h-3 text-zinc-600 group-hover:text-cyan-400 shrink-0" />
              </a>
            );
          }
          return (
            <div key={l.url} className="text-xs py-1">
              <div className="text-zinc-300 truncate" title={l.label}>{l.label}</div>
              <code className="text-[10px] text-zinc-600 font-mono block truncate" title={path}>{path}</code>
            </div>
          );
        })}
      </div>
    </SubCard>
  );
};

// ─── Sub-Card wrapper ───

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

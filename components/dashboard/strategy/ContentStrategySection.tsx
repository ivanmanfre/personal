import React, { useState, useMemo } from 'react';
import {
  Target,
  CalendarClock,
  FileText,
  ExternalLink as ExtLink,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import PanelCard from '../shared/PanelCard';
import { pillarMixTargets, contentStrategyLinks } from '../../../lib/strategyConfig';
import { useContentLibrary, type CarouselDraft } from '../../../hooks/useContentLibrary';

const REPO_ROOT = '/Users/ivanmanfredi/Desktop/personal-site';
const PILLAR_ORDER = ['Translator', 'Methodology', 'Teardown', 'Case Study', 'Personal'];
const PILLAR_WINDOW_DAYS = 30;

function localPath(url: string): string {
  if (url.startsWith('/')) return `${REPO_ROOT}${url}`;
  return url;
}

function normalizePillar(raw: unknown): string {
  if (typeof raw !== 'string') return 'Other';
  const k = raw.trim().toLowerCase().replace(/[_-]+/g, ' ');
  return PILLAR_ORDER.find(p => p.toLowerCase() === k) ?? 'Other';
}

// Drift band: how far actual sits from its target, symmetric so both
// over- and under-weight pillars flag.
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

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  );
}

export const ContentStrategySection: React.FC = () => {
  const { drafts, loading } = useContentLibrary();
  return (
    <PanelCard title="Content Strategy" accent="emerald">
      <div className="p-4 space-y-4">
        <p className="text-[11px] text-zinc-500">
          1-2 posts a day, no fixed calendar. The strategy is the pillar mix below, held over a rolling {PILLAR_WINDOW_DAYS}-day window.
        </p>
        <PillarMixCard drafts={drafts} loading={loading} />
        <ScheduledCard drafts={drafts} loading={loading} />
        <QuickLinksCard />
      </div>
    </PanelCard>
  );
};

// ─── Pillar Mix (the strategy) ───

const PillarMixCard: React.FC<{ drafts: CarouselDraft[]; loading: boolean }> = ({ drafts, loading }) => {
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
    <SubCard title="Pillar Mix" icon={<Target className="w-3.5 h-3.5" />}>
      <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium mb-1.5">
        Last {PILLAR_WINDOW_DAYS} days
        <span className="text-zinc-600 normal-case tracking-normal"> · {mix.total} published</span>
      </p>
      {loading ? (
        <p className="text-[11px] text-zinc-600">loading…</p>
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
    </SubCard>
  );
};

const PillarBar: React.FC<{ pillar: string; target: number; actual: number }> = ({ pillar, target, actual }) => (
  <div className="flex items-center gap-2 text-xs">
    <span className="w-24 text-zinc-400 shrink-0">{pillar}</span>
    <div className="flex-1 relative h-2 bg-zinc-800 rounded overflow-hidden">
      <div className="absolute top-0 bottom-0 w-px bg-zinc-500" style={{ left: `${target}%` }} title={`Target ${target}%`} />
      <div
        className={`h-full ${STATUS_RULE[mixStatus(actual, target)].replace('border', 'bg').replace('/60', '/40')}`}
        style={{ width: `${Math.min(actual, 100)}%` }}
      />
    </div>
    <span className="font-mono text-[11px] text-zinc-500 w-20 text-right shrink-0">
      {actual}% / {target}%
    </span>
  </div>
);

// Composition "battery": one stacked bar, segments sized by share of published
// posts. Uniform fill (calm), drift signalled by a colored bottom rule + %.
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
    <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium mb-1.5">{pillar} — {posts.length} posts</p>
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

// ─── Scheduled Next (replaces the retired fixed weekly plan) ───

const ScheduledCard: React.FC<{ drafts: CarouselDraft[]; loading: boolean }> = ({ drafts, loading }) => {
  const upcoming = useMemo(() => {
    const now = Date.now();
    return drafts
      .filter(d => d.status === 'scheduled' && d.scheduledAt && new Date(d.scheduledAt).getTime() >= now)
      .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime())
      .slice(0, 7);
  }, [drafts]);

  return (
    <SubCard title="Scheduled Next" icon={<CalendarClock className="w-3.5 h-3.5" />}>
      {loading ? (
        <p className="text-[11px] text-zinc-600">loading…</p>
      ) : upcoming.length === 0 ? (
        <p className="text-[11px] text-zinc-600">Nothing scheduled ahead.</p>
      ) : (
        <div className="space-y-1">
          {upcoming.map(d => (
            <div key={d.id} className="flex items-baseline gap-2 text-[11px]">
              <span className="font-mono text-zinc-500 shrink-0 w-24">{fmtWhen(d.scheduledAt!)}</span>
              <span className="text-zinc-300 truncate" title={d.title}>{d.title}</span>
              {d.taxonomy?.pillar && (
                <span className="text-[9px] text-zinc-600 shrink-0 ml-auto">{normalizePillar(d.taxonomy.pillar)}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </SubCard>
  );
};

// ─── Quick Links ───

const QuickLinksCard: React.FC = () => (
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
              className="flex items-center justify-between text-xs text-zinc-300 hover:text-emerald-400 transition-colors group py-1"
            >
              <span className="truncate">{l.label}</span>
              <ExtLink className="w-3 h-3 text-zinc-600 group-hover:text-emerald-400 shrink-0" />
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

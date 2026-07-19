import React, { useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { SubCard } from './shared';
import { pillarMixTargets, contentStrategyLinks } from '../../../../../lib/strategyConfig';
import { useContentLibrary, type CarouselDraft } from '../../../../../hooks/useContentLibrary';

const REPO_ROOT = '/Users/ivanmanfredi/Desktop/personal-site';
const PILLAR_ORDER = ['Translator', 'Methodology', 'Teardown', 'Case Study', 'Personal'];
const PILLAR_WINDOW_DAYS = 30;

// The proven ink tonal ramp (the reference pattern the pillar-bar fix shipped).
// Ordered light -> heavier so adjacent pillars stay distinguishable without hue.
const PILLAR_TONE_RAMP = ['#E6E3DD', '#D8D4CC', '#CAC5BB', '#BCB6AA', '#AEA79A', '#EDEBE7'];
const pillarTone = (i: number) => PILLAR_TONE_RAMP[i % PILLAR_TONE_RAMP.length];

function localPath(url: string): string {
  return url.startsWith('/') ? `${REPO_ROOT}${url}` : url;
}
function normalizePillar(raw: unknown): string {
  if (typeof raw !== 'string') return 'Other';
  const k = raw.trim().toLowerCase().replace(/[_-]+/g, ' ');
  return PILLAR_ORDER.find((p) => p.toLowerCase() === k) ?? 'Other';
}
// Drift band: symmetric distance of actual from target. ok / warn / off.
function mixStatus(actual: number, target: number): 'ok' | 'warn' | 'off' {
  if (!target) return 'ok';
  const rel = Math.abs(actual - target) / target;
  return rel <= 0.25 ? 'ok' : rel <= 0.5 ? 'warn' : 'off';
}
function fmtWhen(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  );
}

/**
 * Content Strategy / Pillar Mix — keeps the shipped ink tonal ramp battery and
 * the drift rules (ok = hairline ink, warn = muted, off = red). This is the
 * reference pattern named in the ledger; only the chrome moves to the BB
 * register. Survives: segment -> post pile expand, 3 sub-toggles, quick links.
 */
export const PillarMix: React.FC = () => {
  const { drafts, loading } = useContentLibrary();
  return (
    <section className="pos-sec">
      <div className="pos-sec-head">
        <h2 className="pos-sec-title">Content Strategy</h2>
        <span className="pos-sec-meta">1-2 posts a day</span>
      </div>
      <p className="pos-sec-note">
        No fixed calendar. The strategy is the pillar mix, held over a rolling {PILLAR_WINDOW_DAYS}-day window.
      </p>
      <SubCard title="Pillar Mix"><PillarMixBody drafts={drafts} loading={loading} /></SubCard>
      <SubCard title="Scheduled Next"><ScheduledBody drafts={drafts} loading={loading} /></SubCard>
      <SubCard title="Quick Links" defaultOpen={false}><QuickLinks /></SubCard>
    </section>
  );
};

const PillarMixBody: React.FC<{ drafts: CarouselDraft[]; loading: boolean }> = ({ drafts, loading }) => {
  const [openPillar, setOpenPillar] = useState<string | null>(null);

  const mix = useMemo(() => {
    const since = Date.now() - PILLAR_WINDOW_DAYS * 86400000;
    const published = drafts.filter(
      (d) => d.status === 'published' && d.updatedAt && new Date(d.updatedAt).getTime() >= since,
    );
    const groups: Record<string, CarouselDraft[]> = {};
    for (const d of published) {
      const p = normalizePillar(d.taxonomy?.pillar);
      (groups[p] ||= []).push(d);
    }
    const total = published.length;
    const rows = [...PILLAR_ORDER, 'Other']
      .map((pillar) => {
        const posts = groups[pillar] || [];
        return { pillar, count: posts.length, pct: total ? Math.round((posts.length / total) * 100) : 0, posts };
      })
      .filter((r) => r.pillar !== 'Other' || r.count > 0);
    return { rows, total };
  }, [drafts]);

  const targetOf = (pillar: string) => pillarMixTargets.find((p) => p.pillar === pillar)?.targetPct ?? 0;

  if (loading) return <p className="ec-note">loading...</p>;
  if (mix.total === 0) return <p className="ec-note">No published posts in the last {PILLAR_WINDOW_DAYS} days.</p>;

  const openRow = mix.rows.find((r) => r.pillar === openPillar);

  return (
    <>
      <p className="pos-pillar-meta">
        Last {PILLAR_WINDOW_DAYS} days <span>· {mix.total} published</span>
      </p>
      <div className="pos-battery">
        {mix.rows.map((r, i) => {
          const st = mixStatus(r.pct, targetOf(r.pillar));
          const isOpen = openPillar === r.pillar;
          return (
            <button
              type="button"
              key={r.pillar}
              className={`pos-batt-seg ${st === 'warn' ? 'pos-batt-seg--warn' : st === 'off' ? 'pos-batt-seg--off' : ''} ${isOpen ? 'pos-batt-seg--open' : ''}`}
              style={{ flexBasis: `${r.pct}%`, flexGrow: 0, flexShrink: 1, backgroundColor: pillarTone(i) }}
              onClick={() => setOpenPillar(isOpen ? null : r.pillar)}
              title={`${r.pillar}: ${r.count} posts · ${r.pct}% (target ${targetOf(r.pillar)}%)`}
            >
              <span className="pos-batt-n">{r.count}</span>
            </button>
          );
        })}
      </div>
      <div className="pos-batt-labels">
        {mix.rows.map((r) => {
          const st = mixStatus(r.pct, targetOf(r.pillar));
          return (
            <div className="pos-batt-lcell" key={r.pillar} style={{ flexBasis: `${r.pct}%`, flexGrow: 0, flexShrink: 1 }}>
              <p className="pos-batt-lname">{r.pillar}</p>
              <p className={`pos-batt-lpct pos-batt-lpct--${st}`}>{r.pct}%</p>
            </div>
          );
        })}
      </div>

      {openRow && (
        <div className="pos-pile">
          <p className="pos-pile-lbl">{openRow.pillar} — {openRow.posts.length} posts</p>
          {openRow.posts.length === 0 ? (
            <p className="ec-note">none in window</p>
          ) : (
            <>
              {openRow.posts.slice(0, 30).map((p) => (
                <div className="pos-pile-row" key={p.id}>
                  <span className="pos-pile-date">{p.updatedAt?.slice(0, 10)}</span>
                  <span className="pos-pile-title" title={p.title}>{p.title}</span>
                </div>
              ))}
              {openRow.posts.length > 30 && <p className="ec-data" style={{ marginTop: '0.3rem' }}>+{openRow.posts.length - 30} more</p>}
            </>
          )}
        </div>
      )}

      <div className="pos-bars">
        {pillarMixTargets.map((p) => {
          const actual = mix.rows.find((r) => r.pillar === p.pillar)?.pct ?? 0;
          const st = mixStatus(actual, p.targetPct);
          return (
            <div className="pos-bar-row" key={p.pillar}>
              <span className="pos-bar-name">{p.pillar}</span>
              <span className="pos-bar-track">
                <span className="pos-bar-target" style={{ left: `${p.targetPct}%` }} title={`Target ${p.targetPct}%`} />
                <span className={`pos-bar-fill pos-bar-fill--${st}`} style={{ width: `${Math.min(actual, 100)}%` }} />
              </span>
              <span className="pos-bar-num">{actual}% / {p.targetPct}%</span>
            </div>
          );
        })}
      </div>
    </>
  );
};

const ScheduledBody: React.FC<{ drafts: CarouselDraft[]; loading: boolean }> = ({ drafts, loading }) => {
  const upcoming = useMemo(() => {
    const now = Date.now();
    return drafts
      .filter((d) => d.status === 'scheduled' && d.scheduledAt && new Date(d.scheduledAt).getTime() >= now)
      .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime())
      .slice(0, 7);
  }, [drafts]);

  if (loading) return <p className="ec-note">loading...</p>;
  if (upcoming.length === 0) return <p className="ec-note">Nothing scheduled ahead.</p>;
  return (
    <div>
      {upcoming.map((d) => (
        <div className="pos-sched-row" key={d.id}>
          <span className="pos-sched-when">{fmtWhen(d.scheduledAt!)}</span>
          <span className="pos-sched-title" title={d.title}>{d.title}</span>
          {d.taxonomy?.pillar && <span className="pos-sched-pillar">{normalizePillar(d.taxonomy.pillar)}</span>}
        </div>
      ))}
    </div>
  );
};

const QuickLinks: React.FC = () => (
  <div className="pos-linklist">
    {contentStrategyLinks.map((l) => {
      if (l.kind === 'web') {
        return (
          <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="pos-link">
            <span className="pos-link-t">{l.label}</span>
            <ExternalLink size={12} style={{ color: 'var(--ec-mutedc)', flex: '0 0 auto' }} />
          </a>
        );
      }
      const path = localPath(l.url);
      return (
        <div key={l.url} className="pos-link" style={{ cursor: 'default', display: 'block' }}>
          <span className="pos-link-t">{l.label}</span>
          <code className="pos-link-code" title={path}>{path}</code>
        </div>
      );
    })}
  </div>
);

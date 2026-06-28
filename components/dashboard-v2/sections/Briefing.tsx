import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useWorkflowStats } from '../../../hooks/useWorkflowStats';
import { useContentPipeline } from '../../../hooks/useContentPipeline';
import { useOutreachPipeline } from '../../../hooks/useOutreachPipeline';
import { useClientMonitoring } from '../../../hooks/useClientMonitoring';
import { useLeads } from '../../../hooks/useLeads';
import { supabase } from '../../../lib/supabase';
import { dashboardAction } from '../../../lib/dashboardActions';
import {
  Pulse, PulseCell, SectionLabel, ActionGrid,
  RowList, ClientRow, Marginalia,
} from '../primitives';
import { Sparkline } from '../primitives/Sparkline';
import { AreaChart } from '../primitives/AreaChart';
import { useCountUp } from '../primitives/useCountUp';
import type { Severity, SectionId } from '../types';

/**
 * Briefing — the v2 front page. Light Premium + Data-Viz skin.
 * Composes existing hooks: zero new data sources. All writes documented in
 * INVENTORY.md still flow through the original components when drilled-into.
 */

const prefersReducedMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Safely extract a human-readable message from a value that may be a raw
 * JSON string (e.g. `{"severity":"high","action":"escalate","summary":"…"}`).
 * Returns the `summary` field when found, otherwise returns the raw string.
 */
function safeMessage(value: string | null | undefined, fallback = ''): string {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed.summary === 'string') return parsed.summary;
      if (typeof parsed.message === 'string') return parsed.message;
      if (typeof parsed.error === 'string') return parsed.error;
    } catch { /* not JSON, fall through */ }
  }
  return trimmed;
}

/** Humanize a post format DB value → display label. */
function formatLabel(value: string | null | undefined): string {
  if (!value) return 'Text';
  switch (value.toLowerCase()) {
    case 'text': return 'Text';
    case 'single_image': return 'Single image';
    case 'carousel': return 'Carousel';
    case 'video': return 'Video';
    default: return value;
  }
}

/** Word-boundary–safe truncation: never cuts mid-word. */
function truncateWords(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const cut = text.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > maxChars * 0.6 ? cut.slice(0, lastSpace) : cut) + '…';
}

/** Map post format to inline pill colours */
function formatPillStyle(value: string | null | undefined): React.CSSProperties {
  switch ((value || '').toLowerCase()) {
    case 'carousel': return { color: 'var(--ds-violet)', background: '#f5f3ff' };
    case 'video': return { color: 'var(--ds-warn)', background: '#fffbeb' };
    case 'single_image': return { color: 'var(--ds-info)', background: '#eff6ff' };
    default: return { color: 'var(--ds-ok)', background: '#ecfdf5' };
  }
}

/** Status dot colour by post status */
function statusDotColor(status: string): string {
  switch (status) {
    case 'failed': return 'var(--ds-warn)';
    case 'posting': return 'var(--ds-info)';
    case 'pending': return 'var(--ds-ok)';
    default: return 'var(--ds-faint)';
  }
}

/** Bar component for by-format breakdown */
function FormatBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '11px 0', fontSize: '12.5px' }}>
      <span style={{ width: '72px', color: 'var(--ds-dim)', fontSize: '12px' }}>{label}</span>
      <span style={{ flex: 1, height: '8px', background: 'var(--ds-bg)', borderRadius: '5px', overflow: 'hidden' }}>
        <span
          style={{
            display: 'block',
            height: '100%',
            width: `${pct}%`,
            borderRadius: '5px',
            background: color,
            ...(prefersReducedMotion ? {} : { transition: 'width 1.2s cubic-bezier(.3,.8,.3,1) .4s' }),
          }}
        />
      </span>
      <span style={{ width: '30px', textAlign: 'right', color: 'var(--ds-faint)', fontSize: '12px', fontVariantNumeric: 'tabular-nums' }}>{count}</span>
    </div>
  );
}

export function Briefing({ onNavigate }: { onNavigate?: (s: SectionId, sub?: string) => void }) {
  const userTz = useMemo(() => {
    if (typeof Intl !== 'undefined') return Intl.DateTimeFormat().resolvedOptions().timeZone;
    return 'UTC';
  }, []);

  const { workflows, stats: wfStats, loading: wfLoading } = useWorkflowStats();
  const { posts, loading: postsLoading, refresh: refreshPosts } = useContentPipeline(userTz);
  const { stats: orStats, loading: orLoading } = useOutreachPipeline(userTz);
  const { clients, errors, getClientHealth, loading: clLoading, refresh: refreshClients } = useClientMonitoring();
  const { leads, loading: leadsLoading } = useLeads();

  // Track manually-dismissed action items so they disappear immediately
  // (don't wait for the data refresh to remove them).
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // Derived: pulse cells (workflows / posting / leadMagnets / agent)
  const pulse = useMemo(() => {
    const wfSev: Severity =
      wfStats.health === 'critical' ? 'bad' :
      wfStats.health === 'degraded' ? 'warn' : 'good';
    const failed = posts.filter(p => p.status === 'failed').length;
    const stuck = posts.filter(p => p.status === 'posting').length;
    const postingSev: Severity = failed > 0 ? 'bad' : stuck > 0 ? 'warn' : 'good';
    // Lead magnets: heuristic — if there's no LM workflow running successfully in last 7d, mark amber
    // (Real signal would query lead_magnets table. Stub for now.)
    const lmSev: Severity = 'warn';
    // Agent: count unresolved client errors as a proxy for "stuck things"
    const stuckCount = errors.filter(e => !e.isResolved).length;
    const agentSev: Severity = stuckCount > 5 ? 'warn' : 'good';
    return {
      wf: { sev: wfSev, meta: `${wfStats.active} ✓ · ${wfStats.totalErrors24h} err` },
      posting: { sev: postingSev, meta: failed > 0 ? `${failed} fail · ${stuck} stuck` : stuck > 0 ? `${stuck} stuck` : 'on schedule' },
      lm: { sev: lmSev, meta: 'check workflow' },
      agent: { sev: agentSev, meta: `${stuckCount} stuck` },
    };
  }, [wfStats, posts, errors]);

  // Action handlers — actually do the thing, then refresh + show toast
  const retryFailedPost = async (postId: string) => {
    try {
      await dashboardAction('scheduled_posts', postId, 'status', 'pending');
      // Bump scheduled_at to 5 min from now so the publisher picks it up
      const newTime = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      await dashboardAction('scheduled_posts', postId, 'scheduled_at', newTime);
      toast.success('Queued for retry in 5 min');
      await refreshPosts();
    } catch (err) {
      toast.error('Retry failed: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const clearStuckPost = async (postId: string) => {
    try {
      await dashboardAction('scheduled_posts', postId, 'status', 'failed');
      toast.success('Status cleared (now retryable)');
      await refreshPosts();
    } catch (err) {
      toast.error('Clear failed: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const dismissPost = async (postId: string) => {
    setDismissed(prev => new Set(prev).add(`post:${postId}`));
    try {
      await dashboardAction('scheduled_posts', postId, 'status', 'cancelled');
      await refreshPosts();
    } catch (err) {
      toast.error('Dismiss failed: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const resolveError = async (errorId: string) => {
    setDismissed(prev => new Set(prev).add(`err:${errorId}`));
    try {
      await dashboardAction('client_workflow_errors', errorId, 'is_resolved', 'true');
      await refreshClients();
    } catch (err) {
      toast.error('Resolve failed: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  // Action Required: only items needing attention from the LAST 14 DAYS.
  // Anything older is either stale or already in the noise — surface in
  // detail panels, don't clutter the front page.
  const FRESHNESS_DAYS = 14;
  const freshnessCutoff = Date.now() - FRESHNESS_DAYS * 24 * 60 * 60 * 1000;

  type ActionItem = {
    key: string;
    verb: string;
    when: string;
    head: React.ReactNode;
    body: string;
    warn?: boolean;
    primary: { label: string; onClick: () => void };
    secondary?: { label: string; onClick: () => void };
  };

  const actions: ActionItem[] = useMemo(() => {
    const items: ActionItem[] = [];

    // Failed posts — fresh only
    posts
      .filter(p => p.status === 'failed')
      .filter(p => new Date(p.scheduledAt).getTime() > freshnessCutoff)
      .filter(p => !dismissed.has(`post:${p.id}`))
      .slice(0, 1)
      .forEach(p => items.push({
        key: `post-fail:${p.id}`,
        verb: 'Replay',
        when: new Date(p.scheduledAt).toLocaleDateString(),
        head: <>Post failed: <em>"{truncateWords(p.postText, 40)}"</em></>,
        body: safeMessage(p.errorMessage, 'Publish failed.').slice(0, 140),
        primary: { label: 'Retry in 5min →', onClick: () => retryFailedPost(p.id) },
        secondary: { label: 'Dismiss', onClick: () => dismissPost(p.id) },
      }));

    // Stuck "posting" — fresh only (same 14d window)
    posts
      .filter(p => p.status === 'posting')
      .filter(p => new Date(p.createdAt).getTime() > freshnessCutoff)
      .filter(p => !dismissed.has(`post:${p.id}`))
      .slice(0, 1)
      .forEach(p => {
        const stuckDays = Math.floor((Date.now() - new Date(p.createdAt).getTime()) / (1000 * 60 * 60 * 24));
        items.push({
          key: `post-stuck:${p.id}`,
          verb: 'Reset',
          when: `Stuck ${stuckDays}d`,
          head: <>Post locked in <em>"posting"</em></>,
          body: 'Status never cleared. Reset to retryable, or dismiss.',
          primary: { label: 'Clear status →', onClick: () => clearStuckPost(p.id) },
          secondary: { label: 'Dismiss', onClick: () => dismissPost(p.id) },
        });
      });

    // High-severity client errors — fresh only, unresolved
    errors
      .filter(e => !e.isResolved && e.severity === 'high')
      .filter(e => e.createdAt && new Date(e.createdAt).getTime() > freshnessCutoff)
      .filter(e => !dismissed.has(`err:${e.id}`))
      .slice(0, 1)
      .forEach(e => items.push({
        key: `err:${e.id}`,
        verb: 'Fix',
        when: e.createdAt ? new Date(e.createdAt).toLocaleDateString() : 'recent',
        head: <>{e.workflowName}: <em>{safeMessage(e.errorMessage, 'error').slice(0, 50)}</em></>,
        body: safeMessage(e.aiAnalysis, 'High-severity error needs attention.').slice(0, 140),
        warn: true,
        primary: { label: 'Open log →', onClick: () => onNavigate?.('clients') },
        secondary: { label: 'Mark resolved', onClick: () => resolveError(e.id) },
      }));

    return items.slice(0, 3);
  }, [posts, errors, onNavigate, dismissed, freshnessCutoff]);

  // Upcoming posts for content panel
  const upcoming = useMemo(() => {
    return posts
      .filter(p => p.status === 'pending')
      .slice(0, 3);
  }, [posts]);

  const queueDepth = posts.filter(p => p.status === 'pending').length;
  const nextPost = upcoming[0];
  const nextPostDate = nextPost ? new Date(nextPost.scheduledAt) : null;

  // Outreach summary
  const needDmCount = orStats.connected; // connected but not yet messaged
  const totalProspects = orStats.totalProspects;

  // Clients: top 3 unhealthy
  const unhealthyClients = useMemo(() => {
    return clients
      .map(c => ({ ...c, health: getClientHealth(c), errCount: errors.filter(e => e.clientId === c.id && !e.isResolved).length }))
      .filter(c => c.health !== 'healthy')
      .sort((a, b) => (b.errCount - a.errCount))
      .slice(0, 3);
  }, [clients, errors, getClientHealth]);

  const healthChip: { label: string; severity: Severity } =
    wfStats.health === 'critical' ? { label: 'Action needed', severity: 'bad' } :
    wfStats.health === 'degraded' ? { label: 'Needs attention', severity: 'warn' } :
    { label: 'All systems go', severity: 'good' };

  const isLoading = wfLoading || postsLoading || orLoading || clLoading || leadsLoading;
  const todayStr = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  const nowStr = new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });

  // Derived: open error count
  const openErrors = errors.filter(e => !e.isResolved).length;

  // By-format breakdown from all posts
  const formatCounts = useMemo(() => {
    const all = posts;
    const total = all.length;
    const text = all.filter(p => (p.postFormat || 'text').toLowerCase() === 'text').length;
    const singleImage = all.filter(p => (p.postFormat || '').toLowerCase() === 'single_image').length;
    const carousel = all.filter(p => (p.postFormat || '').toLowerCase() === 'carousel').length;
    const video = all.filter(p => (p.postFormat || '').toLowerCase() === 'video').length;
    return { total, text, singleImage, carousel, video };
  }, [posts]);

  // KPI sparkline series: wfStats.active as flat series (TODO real series)
  const wfSparkPoints = [wfStats.active, wfStats.active, wfStats.active, wfStats.active, wfStats.active, wfStats.active, wfStats.active]; // TODO real series
  // Prospects spark: flat for now (TODO real series)
  const prospectSparkPoints = [totalProspects, totalProspects, totalProspects, totalProspects, totalProspects, totalProspects, totalProspects]; // TODO real series

  // Health score as percentage for ring (active/total workflows, clamped 0-100)
  const totalWorkflows = (wfStats.active || 0) + (wfStats.totalErrors24h || 0);
  const healthScore = totalWorkflows > 0
    ? Math.round(((wfStats.active || 0) / totalWorkflows) * 100)
    : (wfStats.health === 'healthy' ? 100 : wfStats.health === 'degraded' ? 60 : 20);

  // Area chart: 14-day post output (derived from pending + posted approximation)
  // TODO: real series from a time-bucketed query. Stub a flat series based on queue.
  const areaPoints = useMemo(() => {
    // TODO real series — flat placeholder until time-bucketed query is wired
    const base = Math.max(queueDepth, 1);
    return Array(14).fill(base) as number[];
  }, [queueDepth]);

  // Count-up display values for KPI numbers
  const displayQueue = useCountUp(queueDepth);
  const displayNeedDm = useCountUp(needDmCount);
  const displayLeads = useCountUp(leads.length);
  const displayOpenErrors = useCountUp(openErrors);
  const displayTotalProspects = useCountUp(totalProspects);
  const displayHealthScore = useCountUp(healthScore);

  const kpiCardStyle: React.CSSProperties = {
    background: 'var(--ds-card)',
    border: '1px solid var(--ds-line)',
    borderRadius: 'var(--ds-radius)',
    boxShadow: 'var(--ds-shadow-card)',
    padding: '16px 17px 14px',
    position: 'relative',
    cursor: 'pointer',
    transition: 'transform .16s, box-shadow .16s',
  };

  return (
    <>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div data-tour="briefing">
        {/* Light Premium header: title + live pill + datetime + health chip */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginBottom: '22px',
          }}
        >
          <div>
            <h1
              style={{
                fontSize: '24px',
                fontWeight: 700,
                letterSpacing: '-.02em',
                color: 'var(--ds-ink)',
              }}
            >
              The Morning <em>Dispatch</em>
            </h1>
            <div
              style={{
                color: 'var(--ds-dim)',
                fontSize: '13px',
                marginTop: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {/* Live pill */}
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--ds-ok)',
                  background: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  padding: '3px 9px',
                  borderRadius: '20px',
                }}
              >
                <span
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background: 'var(--ds-ok)',
                    display: 'inline-block',
                    animation: prefersReducedMotion ? 'none' : 'ds-pulse 2s ease-in-out infinite',
                  }}
                />
                Live
              </span>
              {todayStr} · {nowStr} {userTz}
            </div>
          </div>
          {/* Health chip as a right-aligned badge */}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: 600,
              padding: '5px 12px',
              borderRadius: '20px',
              border: '1px solid',
              color: healthChip.severity === 'bad' ? 'var(--ds-warn)' : healthChip.severity === 'warn' ? 'var(--ds-warn)' : 'var(--ds-ok)',
              background: healthChip.severity === 'bad' ? '#fffbeb' : healthChip.severity === 'warn' ? '#fffbeb' : '#ecfdf5',
              borderColor: healthChip.severity === 'bad' ? '#fcd34d' : healthChip.severity === 'warn' ? '#fcd34d' : '#a7f3d0',
            }}
          >
            {healthChip.label}
          </span>
        </div>

        {/* Pulse strip — keep unchanged (4 click handlers) */}
        <Pulse>
          <PulseCell name="Workflows" meta={pulse.wf.meta} severity={pulse.wf.sev} onClick={() => onNavigate?.('ops', 'workflows')} />
          <PulseCell name="Posting" meta={pulse.posting.meta} severity={pulse.posting.sev} onClick={() => onNavigate?.('content', 'pipeline')} />
          <PulseCell name="Lead Magnets" meta={pulse.lm.meta} severity={pulse.lm.sev} onClick={() => onNavigate?.('content', 'leadmagnets')} />
          <PulseCell name="Agent" meta={pulse.agent.meta} severity={pulse.agent.sev} onClick={() => onNavigate?.('agent')} />
        </Pulse>
      </div>

      {/* ── Action Required ─────────────────────────────────────────────────── */}
      {actions.length > 0 ? (
        <>
          <SectionLabel label="Action Required" alert count={actions.length} hint="Last 14 days only" />
          <ActionGrid>
            {actions.map(a => (
              <div
                key={a.key}
                style={{
                  background: a.warn ? '#fffbeb' : 'var(--ds-card)',
                  border: `1px solid ${a.warn ? '#fcd34d' : 'var(--ds-line)'}`,
                  borderRadius: 'var(--ds-radius)',
                  boxShadow: 'var(--ds-shadow-card)',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '.07em',
                      color: a.warn ? 'var(--ds-warn)' : 'var(--ds-accent)',
                    }}
                  >
                    {a.verb}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--ds-faint)' }}>{a.when}</span>
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ds-ink)', lineHeight: 1.4 }}>{a.head}</div>
                <div style={{ fontSize: '12px', color: 'var(--ds-dim)', lineHeight: 1.5 }}>{a.body}</div>
                <div style={{ marginTop: 'auto', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', paddingTop: '4px' }}>
                  <button
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      padding: '6px 14px',
                      borderRadius: '8px',
                      border: 'none',
                      cursor: 'pointer',
                      background: 'var(--ds-accent)',
                      color: '#fff',
                    }}
                    onClick={a.primary.onClick}
                  >
                    {a.primary.label}
                  </button>
                  {a.secondary && (
                    <button
                      style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        padding: '6px 14px',
                        borderRadius: '8px',
                        border: '1px solid var(--ds-line)',
                        cursor: 'pointer',
                        background: 'transparent',
                        color: 'var(--ds-dim)',
                      }}
                      onClick={a.secondary.onClick}
                    >
                      {a.secondary.label}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </ActionGrid>
        </>
      ) : !isLoading ? (
        <Marginalia>All clear. No urgent items in the last 14 days.</Marginalia>
      ) : null}

      {/* ── KPI Row — 4 cards with sparklines + ring ────────────────────────── */}
      <SectionLabel label="At a glance" />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '14px',
          marginBottom: '14px',
        }}
      >
        {/* Card 1: Workflows active — sparkline */}
        <div
          style={kpiCardStyle}
          onClick={() => onNavigate?.('content', 'pipeline')}
          role="button"
          tabIndex={0}
        >
          <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--ds-faint)', fontWeight: 600 }}>
            Posts in queue
          </div>
          <div style={{ fontSize: '30px', fontWeight: 700, letterSpacing: '-.02em', marginTop: '8px', lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: 'var(--ds-ink)' }}>
            {displayQueue}
          </div>
          <div style={{ fontSize: '12px', fontWeight: 600, marginTop: '7px', color: 'var(--ds-faint)' }}>
            {nextPostDate ? `Next ${nextPostDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : 'no upcoming'}
          </div>
          <div style={{ position: 'absolute', right: '14px', bottom: '14px', width: '74px', height: '30px' }}>
            <Sparkline points={wfSparkPoints} stroke="var(--ds-ok)" />{/* TODO real series */}
          </div>
        </div>

        {/* Card 2: Need DM — sparkline */}
        <div
          style={kpiCardStyle}
          onClick={() => onNavigate?.('reach', 'outreach')}
          role="button"
          tabIndex={0}
        >
          <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--ds-faint)', fontWeight: 600 }}>
            Need DM
          </div>
          <div style={{
            fontSize: '30px', fontWeight: 700, letterSpacing: '-.02em', marginTop: '8px', lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
            color: needDmCount > 0 ? 'var(--ds-warn)' : 'var(--ds-ink)',
          }}>
            {displayNeedDm}
          </div>
          <div style={{ fontSize: '12px', fontWeight: 600, marginTop: '7px', color: 'var(--ds-faint)' }}>
            connected, not messaged
          </div>
          <div style={{ position: 'absolute', right: '14px', bottom: '14px', width: '74px', height: '30px' }}>
            <Sparkline points={prospectSparkPoints} stroke="var(--ds-info)" />{/* TODO real series */}
          </div>
        </div>

        {/* Card 3: Leads 7d — sparkline */}
        <div
          style={kpiCardStyle}
          onClick={() => onNavigate?.('reach', 'leads')}
          role="button"
          tabIndex={0}
        >
          <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--ds-faint)', fontWeight: 600 }}>
            Leads · 7d
          </div>
          <div style={{
            fontSize: '30px', fontWeight: 700, letterSpacing: '-.02em', marginTop: '8px', lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
            color: leads.length === 0 ? 'var(--ds-warn)' : 'var(--ds-ok)',
          }}>
            {displayLeads}
          </div>
          <div style={{ fontSize: '12px', fontWeight: 600, marginTop: '7px', color: leads.length === 0 ? 'var(--ds-warn)' : 'var(--ds-faint)' }}>
            {leads.length === 0 ? 'pipeline silent' : 'captured'}
          </div>
        </div>

        {/* Card 4: Health score — Ring */}
        <div
          style={kpiCardStyle}
          onClick={() => onNavigate?.('clients')}
          role="button"
          tabIndex={0}
        >
          <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--ds-faint)', fontWeight: 600 }}>
            Pipeline health
          </div>
          <div style={{
            fontSize: '30px', fontWeight: 700, letterSpacing: '-.02em', marginTop: '8px', lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
            color: openErrors > 0 ? 'var(--ds-warn)' : 'var(--ds-ok)',
          }}>
            {openErrors > 0 ? displayOpenErrors : displayHealthScore + '%'}
          </div>
          <div style={{ fontSize: '12px', fontWeight: 600, marginTop: '7px', color: 'var(--ds-faint)' }}>
            {openErrors > 0 ? `open error${openErrors !== 1 ? 's' : ''} · ${unhealthyClients.length} client${unhealthyClients.length !== 1 ? 's' : ''}` : 'across ' + unhealthyClients.length + ' clients'}
          </div>
          {/* Ring positioned center-right */}
          <div style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)' }}>
            <svg width={60} height={60} aria-hidden>
              <circle cx={30} cy={30} r={26} fill="none" stroke="var(--ds-line)" strokeWidth={7} />
              <circle
                cx={30} cy={30} r={26}
                fill="none"
                stroke={openErrors > 0 ? 'var(--ds-warn)' : 'var(--ds-ok)'}
                strokeWidth={7}
                strokeLinecap="round"
                transform="rotate(-90 30 30)"
                style={{
                  strokeDasharray: 163,
                  strokeDashoffset: 163 - (healthScore / 100) * 163,
                  ...(prefersReducedMotion ? {} : { transition: 'stroke-dashoffset 1.4s cubic-bezier(.3,.8,.3,1) .3s' }),
                }}
              />
            </svg>
          </div>
        </div>
      </div>

      {/* ── Mid charts: Area + By-format bars ──────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.7fr 1fr',
          gap: '14px',
          marginBottom: '14px',
        }}
      >
        {/* Area chart — 14-day output */}
        <div
          style={{
            background: 'var(--ds-card)',
            border: '1px solid var(--ds-line)',
            borderRadius: 'var(--ds-radius)',
            boxShadow: 'var(--ds-shadow-card)',
            padding: '18px 20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ds-ink)' }}>Output over 14 days</div>
            <div style={{ fontSize: '12px', color: 'var(--ds-ok)', fontWeight: 600 }}>
              {queueDepth > 0 ? `${queueDepth} pending` : 'queue empty'}
            </div>
          </div>
          <AreaChart points={areaPoints} stroke="var(--ds-accent)" fillId="briefing-area-fill" height={120} />
          <div style={{ display: 'flex', gap: '14px', marginTop: '8px', fontSize: '12px', color: 'var(--ds-dim)' }}>
            <span><i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', marginRight: 5, background: 'var(--ds-accent)' }} />Pending</span>
            <span><i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', marginRight: 5, background: '#a5b4fc' }} />Drafted</span>
            <span><i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', marginRight: 5, background: 'var(--ds-line)' }} />Scheduled</span>
          </div>
        </div>

        {/* By-format bars */}
        <div
          style={{
            background: 'var(--ds-card)',
            border: '1px solid var(--ds-line)',
            borderRadius: 'var(--ds-radius)',
            boxShadow: 'var(--ds-shadow-card)',
            padding: '18px 20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ds-ink)' }}>By format</div>
            <div style={{ fontSize: '12px', color: 'var(--ds-faint)', fontWeight: 500 }}>{formatCounts.total} total</div>
          </div>
          <div style={{ marginTop: '10px' }}>
            <FormatBar label="Text" count={formatCounts.text} total={formatCounts.total} color="var(--ds-accent)" />
            <FormatBar label="Single image" count={formatCounts.singleImage} total={formatCounts.total} color="var(--ds-info)" />
            <FormatBar label="Carousel" count={formatCounts.carousel} total={formatCounts.total} color="var(--ds-violet)" />
            <FormatBar label="Video" count={formatCounts.video} total={formatCounts.total} color="var(--ds-warn)" />
          </div>
        </div>
      </div>

      {/* ── Bottom grid: Upcoming posts + Clients / Outreach ────────────────── */}
      <div
        style={{
          background: 'var(--ds-card)',
          border: '1px solid var(--ds-line)',
          borderRadius: 'var(--ds-radius)',
          boxShadow: 'var(--ds-shadow-card)',
          marginBottom: '14px',
        }}
      >
        {/* Pipeline list header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 6px' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ds-ink)' }}>Upcoming posts</div>
          <div style={{ fontSize: '12px', color: 'var(--ds-faint)' }}>{queueDepth} pending</div>
        </div>

        {upcoming.length > 0 ? (
          upcoming.map(p => (
            <div
              key={p.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '13px 20px',
                borderTop: '1px solid var(--ds-line)',
                cursor: 'pointer',
                transition: 'background .12s',
              }}
              onClick={() => onNavigate?.('content', 'pipeline')}
              role="button"
              tabIndex={0}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--ds-bg)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {/* Status dot */}
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: statusDotColor(p.status),
                  flexShrink: 0,
                }}
              />
              {/* Post text */}
              <div style={{ flex: 1, fontSize: '13.5px', color: 'var(--ds-ink)', fontWeight: 500, lineHeight: 1.4 }}>
                {truncateWords(p.postText, 80)}
              </div>
              {/* Format pill — inline at 12px (avoids Pill primitive's 11.5px inline style) */}
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  fontSize: '12px',
                  fontWeight: 600,
                  padding: '3px 10px',
                  borderRadius: '20px',
                  fontVariantNumeric: 'tabular-nums',
                  ...formatPillStyle(p.postFormat),
                }}
              >
                {formatLabel(p.postFormat)}
              </span>
              {/* Date */}
              <span style={{ fontSize: '12px', color: 'var(--ds-faint)', minWidth: '52px', textAlign: 'right' }}>
                {new Date(p.scheduledAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </span>
            </div>
          ))
        ) : (
          <div style={{ padding: '0 20px 16px' }}>
            <Marginalia variant="warn">Queue is empty. Generate next batch.</Marginalia>
          </div>
        )}
      </div>

      {/* ── Clients + Outreach side by side ─────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '14px' }}>
        {/* Clients card */}
        <div
          style={{
            background: 'var(--ds-card)',
            border: '1px solid var(--ds-line)',
            borderRadius: 'var(--ds-radius)',
            boxShadow: 'var(--ds-shadow-card)',
            padding: '18px 20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ds-ink)' }}>Clients</div>
            <div style={{ fontSize: '12px', color: 'var(--ds-faint)' }}>{clients.length} total</div>
          </div>
          {unhealthyClients.length > 0 ? (
            <RowList>
              {unhealthyClients.map(c => (
                <ClientRow
                  key={c.id}
                  name={c.clientName || 'Unnamed'}
                  status={c.errCount > 0 ? `${c.errCount} error${c.errCount !== 1 ? 's' : ''}` : c.health}
                  severity={c.health === 'error' ? 'bad' : c.health === 'warning' ? 'warn' : 'good'}
                  action="Open →"
                  onClick={() => onNavigate?.('clients')}
                />
              ))}
            </RowList>
          ) : !isLoading ? (
            <Marginalia>All clients healthy.</Marginalia>
          ) : null}
        </div>

        {/* Outreach card */}
        <div
          style={{
            background: 'var(--ds-card)',
            border: '1px solid var(--ds-line)',
            borderRadius: 'var(--ds-radius)',
            boxShadow: 'var(--ds-shadow-card)',
            padding: '18px 20px',
            cursor: 'pointer',
            transition: 'transform .16s, box-shadow .16s',
          }}
          onClick={() => onNavigate?.('reach', 'outreach')}
          role="button"
          tabIndex={0}
        >
          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ds-ink)' }}>Outreach</div>
          </div>
          {/* Total prospects — count-up number */}
          <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--ds-faint)', fontWeight: 600 }}>
            Total prospects
          </div>
          <div style={{ fontSize: '30px', fontWeight: 700, letterSpacing: '-.02em', marginTop: '8px', lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: 'var(--ds-ink)' }}>
            {displayTotalProspects}
          </div>
          <div style={{ fontSize: '12px', fontWeight: 600, marginTop: '7px', color: 'var(--ds-faint)' }}>
            {orStats.activeCampaigns} active campaign{orStats.activeCampaigns !== 1 ? 's' : ''}
          </div>
        </div>
      </div>
    </>
  );
}

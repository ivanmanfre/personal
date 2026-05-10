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
  HeadRow, Pulse, PulseCell, SectionLabel, ActionGrid, ActionCard,
  KpiRow, KpiTile, RowList, Row, ClientRow, Marginalia,
} from '../primitives';
import type { Severity, SectionId } from '../types';

/**
 * Briefing — the v2 front page.
 * Composes existing hooks: zero new data sources. All writes documented in
 * INVENTORY.md still flow through the original components when drilled-into.
 */
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
        head: <>Post failed: <em>"{p.postText.slice(0, 40)}…"</em></>,
        body: (p.errorMessage || 'Publish failed.').slice(0, 140),
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
        head: <>{e.workflowName}: <em>{(e.errorMessage || 'error').slice(0, 50)}</em></>,
        body: (e.aiAnalysis || 'High-severity error needs attention.').slice(0, 140),
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
    wfStats.health === 'critical' ? { label: 'System Red', severity: 'bad' } :
    wfStats.health === 'degraded' ? { label: 'System Yellow', severity: 'warn' } :
    { label: 'System Green', severity: 'good' };

  const isLoading = wfLoading || postsLoading || orLoading || clLoading || leadsLoading;
  const todayStr = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  const nowStr = new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <>
      <HeadRow
        title={<>The Morning <em>Dispatch</em></>}
        chip={healthChip}
        meta={<>{todayStr}<br />{nowStr} {Intl.DateTimeFormat().resolvedOptions().timeZone}</>}
        live
      />

      <Pulse>
        <PulseCell name="Workflows" meta={pulse.wf.meta} severity={pulse.wf.sev} onClick={() => onNavigate?.('ops', 'workflows')} />
        <PulseCell name="Posting" meta={pulse.posting.meta} severity={pulse.posting.sev} onClick={() => onNavigate?.('content', 'pipeline')} />
        <PulseCell name="Lead Magnets" meta={pulse.lm.meta} severity={pulse.lm.sev} onClick={() => onNavigate?.('content', 'leadmagnets')} />
        <PulseCell name="Agent" meta={pulse.agent.meta} severity={pulse.agent.sev} onClick={() => onNavigate?.('agent')} />
      </Pulse>

      {actions.length > 0 ? (
        <>
          <SectionLabel label="Action Required" alert count={actions.length} hint="Last 14 days only" />
          <ActionGrid>
            {actions.map(a => (
              <div key={a.key} className={`dv-action-card ${a.warn ? 'dv-action-card--warn' : ''}`}>
                <div className="dv-action-card-verb-row">
                  <span className="dv-action-card-verb">{a.verb}</span>
                  <span className="dv-action-card-when">{a.when}</span>
                </div>
                <div className="dv-action-card-head">{a.head}</div>
                <div className="dv-action-card-body">{a.body}</div>
                <div style={{ marginTop: 'auto', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button className="dv-btn dv-btn--good" onClick={a.primary.onClick}>{a.primary.label}</button>
                  {a.secondary && (
                    <button className="dv-btn dv-btn--dim" onClick={a.secondary.onClick}>{a.secondary.label}</button>
                  )}
                </div>
              </div>
            ))}
          </ActionGrid>
        </>
      ) : !isLoading ? (
        <Marginalia>All clear. No urgent items in the last 14 days.</Marginalia>
      ) : null}

      <SectionLabel label="At a glance" />
      <KpiRow>
        <KpiTile
          label="Posts in queue"
          value={queueDepth}
          delta={nextPostDate ? `Next ${nextPostDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : 'no upcoming'}
          onClick={() => onNavigate?.('content', 'pipeline')}
        />
        <KpiTile
          label="Need DM"
          value={needDmCount}
          severity={needDmCount > 0 ? 'warn' : 'neutral'}
          delta="connected, not messaged"
          onClick={() => onNavigate?.('reach', 'outreach')}
        />
        <KpiTile
          label="Leads · 7d"
          value={leads.length}
          severity={leads.length === 0 ? 'bad' : 'good'}
          delta={leads.length === 0 ? 'pipeline silent' : 'captured'}
          onClick={() => onNavigate?.('reach', 'leads')}
        />
        <KpiTile
          label="Open errors"
          value={errors.filter(e => !e.isResolved).length}
          severity={errors.filter(e => !e.isResolved).length > 0 ? 'bad' : 'good'}
          delta={`across ${unhealthyClients.length} clients`}
          onClick={() => onNavigate?.('clients')}
        />
      </KpiRow>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2.5rem' }}>
        <article>
          <SectionLabel label="Upcoming posts" hint={`${queueDepth} pending`} />
          {upcoming.length > 0 ? (
            <RowList>
              {upcoming.map(p => (
                <Row
                  key={p.id}
                  date={new Date(p.scheduledAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  name={p.postText.slice(0, 80)}
                  tag={p.postFormat || 'Text'}
                  onClick={() => onNavigate?.('content', 'pipeline')}
                />
              ))}
            </RowList>
          ) : (
            <Marginalia variant="warn">Queue is empty. Generate next batch.</Marginalia>
          )}
        </article>

        <aside>
          <SectionLabel label="Clients" hint={`${clients.length} total`} />
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

          <div style={{ marginTop: '1.5rem' }}>
            <SectionLabel label="Outreach" />
            <KpiTile
              label="Total prospects"
              value={totalProspects}
              delta={`${orStats.activeCampaigns} active campaigns`}
              onClick={() => onNavigate?.('reach', 'outreach')}
            />
          </div>
        </aside>
      </div>
    </>
  );
}

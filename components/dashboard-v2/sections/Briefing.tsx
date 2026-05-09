import React, { useMemo } from 'react';
import { useWorkflowStats } from '../../../hooks/useWorkflowStats';
import { useContentPipeline } from '../../../hooks/useContentPipeline';
import { useOutreachPipeline } from '../../../hooks/useOutreachPipeline';
import { useClientMonitoring } from '../../../hooks/useClientMonitoring';
import { useLeads } from '../../../hooks/useLeads';
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
  const { posts, loading: postsLoading } = useContentPipeline(userTz);
  const { stats: orStats, loading: orLoading } = useOutreachPipeline(userTz);
  const { clients, errors, getClientHealth, loading: clLoading } = useClientMonitoring();
  const { leads, loading: leadsLoading } = useLeads();

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

  // Action Required: top 3 highest-severity unresolved across content + workflows + clients
  const actions = useMemo(() => {
    const items: Array<{ verb: string; when: string; head: React.ReactNode; body: string; warn?: boolean; cta?: string; onClick?: () => void }> = [];

    // Failed posts
    const failedPosts = posts.filter(p => p.status === 'failed').slice(0, 1);
    failedPosts.forEach(p => items.push({
      verb: 'Replay',
      when: new Date(p.scheduledAt).toLocaleDateString(),
      head: <>Post failed: <em>"{p.postText.slice(0, 30)}…"</em></>,
      body: p.errorMessage || 'Publish failed.',
      cta: 'Retry now →',
      onClick: () => onNavigate?.('content', 'pipeline'),
    }));

    // Stuck posts
    const stuckPosts = posts.filter(p => p.status === 'posting').slice(0, 1);
    stuckPosts.forEach(p => {
      const stuckDays = Math.floor((Date.now() - new Date(p.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      items.push({
        verb: 'Reset',
        when: `Stuck ${stuckDays}d`,
        head: <>Post locked in <em>"posting"</em></>,
        body: 'Status never cleared. Manual reset required.',
        cta: 'Clear status →',
        onClick: () => onNavigate?.('content', 'pipeline'),
      });
    });

    // High-severity client errors
    const highSev = errors.filter(e => !e.isResolved && e.severity === 'high').slice(0, 1);
    highSev.forEach(e => items.push({
      verb: 'Fix',
      when: 'Today',
      head: <>{e.workflowName}: <em>{e.errorMessage?.slice(0, 40) || 'error'}</em></>,
      body: e.aiAnalysis?.slice(0, 80) || 'High-severity error needs attention.',
      warn: true,
      cta: 'Open log →',
      onClick: () => onNavigate?.('clients'),
    }));

    return items.slice(0, 3);
  }, [posts, errors, onNavigate]);

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
          <SectionLabel label="Action Required" alert count={actions.length} />
          <ActionGrid>
            {actions.map((a, i) => (
              <ActionCard
                key={i}
                verb={a.verb}
                when={a.when}
                head={a.head}
                body={a.body}
                warn={a.warn}
                cta={a.cta ? { label: a.cta, onClick: a.onClick } : undefined}
              />
            ))}
          </ActionGrid>
        </>
      ) : !isLoading ? (
        <Marginalia>All clear. No urgent items.</Marginalia>
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

import React, { useState, lazy, Suspense } from 'react';
import { HeadRow, SubTabs, SubTab } from '../primitives';

/**
 * Phase 3 — Reach & Pipeline.
 * Wraps OutreachPanel (1604 lines), LeadsPanel, CompetitorIntelPanel,
 * UpworkPanel, MeetingsPanel, AgentReadyPanel. All write paths preserved.
 */

const OutreachPanel = lazy(() => import('../../dashboard/OutreachPanel'));
const LeadsPanel = lazy(() => import('../../dashboard/LeadsPanel'));
const CompetitorIntelPanel = lazy(() => import('../../dashboard/CompetitorIntelPanel'));
const UpworkPanel = lazy(() => import('../../dashboard/UpworkPanel'));
const MeetingsPanel = lazy(() => import('../../dashboard/MeetingsPanel'));
const AgentReadyPanel = lazy(() => import('../../dashboard/AgentReadyPanel'));

type SubKey = 'outreach' | 'leads' | 'competitors' | 'upwork' | 'meetings' | 'agentready';

const SUB_LABELS: Record<SubKey, string> = {
  outreach: 'Outreach',
  leads: 'Leads',
  competitors: 'Competitors',
  upwork: 'Upwork',
  meetings: 'Meetings',
  agentready: 'Agent-Ready',
};

const SUB_ORDER: SubKey[] = ['outreach', 'leads', 'competitors', 'upwork', 'meetings', 'agentready'];

function getInitialSub(): SubKey {
  if (typeof window === 'undefined') return 'outreach';
  const params = new URLSearchParams(window.location.search);
  const s = params.get('sub') as SubKey | null;
  if (s && SUB_ORDER.includes(s)) return s;
  return 'outreach';
}

function syncSubToUrl(sub: SubKey) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (url.searchParams.get('sub') !== sub) {
    url.searchParams.set('sub', sub);
    window.history.replaceState(null, '', url.toString());
  }
}

const Loading = () => (
  <div style={{ padding: '2rem 0', color: 'var(--d-paper-dim)', fontSize: 13 }}>Loading panel…</div>
);

export function ReachPipeline() {
  const [sub, setSub] = useState<SubKey>(getInitialSub);
  const handleSub = (s: string) => { setSub(s as SubKey); syncSubToUrl(s as SubKey); };

  const renderSub = () => {
    switch (sub) {
      case 'outreach':    return <OutreachPanel />;
      case 'leads':       return <LeadsPanel />;
      case 'competitors': return <CompetitorIntelPanel />;
      case 'upwork':      return <UpworkPanel />;
      case 'meetings':    return <MeetingsPanel />;
      case 'agentready':  return <AgentReadyPanel />;
    }
  };

  return (
    <>
      <HeadRow
        title={<>Reach <em>&amp; Pipeline</em></>}
        meta={<>Outreach · Leads · Competitors<br />Upwork · Meetings · Agent-Ready</>}
      />
      <SubTabs>
        {SUB_ORDER.map(key => (
          <SubTab key={key} id={key} active={sub} onChange={handleSub}>
            {SUB_LABELS[key]}
          </SubTab>
        ))}
      </SubTabs>
      <Suspense fallback={<Loading />}>{renderSub()}</Suspense>
    </>
  );
}

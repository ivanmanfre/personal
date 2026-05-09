import React, { useState, lazy, Suspense } from 'react';
import { HeadRow, SubTabs, SubTab } from '../primitives';

/**
 * Phase 4 — Operations.
 * Wraps WorkflowsPanel, CodePanel (logs), UsagePanel, AutoResearchPanel, TasksPanel.
 */

const WorkflowsPanel = lazy(() => import('../../dashboard/WorkflowsPanel'));
const CodePanel = lazy(() => import('../../dashboard/CodePanel'));
const UsagePanel = lazy(() => import('../../dashboard/UsagePanel'));
const AutoResearchPanel = lazy(() => import('../../dashboard/AutoResearchPanel'));
const TasksPanel = lazy(() => import('../../dashboard/TasksPanel'));

type SubKey = 'workflows' | 'logs' | 'usage' | 'research' | 'tasks';

const SUB_LABELS: Record<SubKey, string> = {
  workflows: 'Workflows',
  logs: 'Execution Logs',
  usage: 'Usage',
  research: 'Auto Research',
  tasks: 'Tasks',
};

const SUB_ORDER: SubKey[] = ['workflows', 'logs', 'usage', 'research', 'tasks'];

function getInitialSub(): SubKey {
  if (typeof window === 'undefined') return 'workflows';
  const params = new URLSearchParams(window.location.search);
  const s = params.get('sub') as SubKey | null;
  if (s && SUB_ORDER.includes(s)) return s;
  return 'workflows';
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

export function Operations() {
  const [sub, setSub] = useState<SubKey>(getInitialSub);
  const handleSub = (s: string) => { setSub(s as SubKey); syncSubToUrl(s as SubKey); };

  const renderSub = () => {
    switch (sub) {
      case 'workflows': return <WorkflowsPanel />;
      case 'logs':      return <CodePanel />;
      case 'usage':     return <UsagePanel />;
      case 'research':  return <AutoResearchPanel />;
      case 'tasks':     return <TasksPanel />;
    }
  };

  return (
    <>
      <HeadRow
        title="Operations"
        meta={<>Workflows · Logs · Usage<br />Auto Research · Tasks</>}
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

import React, { useState, lazy, Suspense } from 'react';
import { HeadRow, SubTabs, SubTab } from '../primitives';

/**
 * Phase 4 — Operations.
 * Wraps WorkflowsPanel, CodePanel (logs), UsagePanel, AutoResearchPanel, TasksPanel.
 * Plus Tools sub-tab (EditTokenPanel etc).
 */

const WorkflowsPanel = lazy(() => import('../../dashboard/WorkflowsPanel'));
const CodePanel = lazy(() => import('../../dashboard/CodePanel'));
const UsagePanel = lazy(() => import('../../dashboard/UsagePanel'));
const AutoResearchPanel = lazy(() => import('../../dashboard/AutoResearchPanel'));
const TasksPanel = lazy(() => import('../../dashboard/TasksPanel'));
const EditTokenPanel = lazy(() => import('../../dashboard/EditTokenPanel'));

type SubKey = 'workflows' | 'logs' | 'usage' | 'research' | 'tasks' | 'tools';

const SUB_LABELS: Record<SubKey, string> = {
  workflows: 'Workflows',
  logs: 'Claude Code',
  usage: 'Usage',
  research: 'Auto Research',
  tasks: 'Tasks',
  tools: 'Tools',
};

const SUB_ORDER: SubKey[] = ['workflows', 'logs', 'usage', 'research', 'tasks', 'tools'];

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

function ToolsSub() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '12px 0' }}>
      <EditTokenPanel />
    </div>
  );
}

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
      case 'tools':     return <ToolsSub />;
    }
  };

  return (
    <>
      <HeadRow
        title="Operations"
        meta={<>Workflows · Logs · Usage<br />Auto Research · Tasks · Tools</>}
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

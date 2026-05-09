import React, { useState, lazy, Suspense } from 'react';
import { HeadRow, SubTabs, SubTab } from '../primitives';

/**
 * Phase 6 — Knowledge.
 * Wraps BrainPanel (claude_memory) + PromptsPanel (ClickUp v3 docs).
 */

const BrainPanel = lazy(() => import('../../dashboard/BrainPanel'));
const PromptsPanel = lazy(() => import('../../dashboard/PromptsPanel'));

type SubKey = 'brain' | 'prompts';
const SUB_LABELS: Record<SubKey, string> = { brain: 'Brain', prompts: 'Prompt Pages' };
const SUB_ORDER: SubKey[] = ['brain', 'prompts'];

function getInitialSub(): SubKey {
  if (typeof window === 'undefined') return 'brain';
  const params = new URLSearchParams(window.location.search);
  const s = params.get('sub') as SubKey | null;
  if (s && SUB_ORDER.includes(s)) return s;
  return 'brain';
}

function syncSubToUrl(sub: SubKey) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (url.searchParams.get('sub') !== sub) {
    url.searchParams.set('sub', sub);
    window.history.replaceState(null, '', url.toString());
  }
}

const Loading = () => <div style={{ padding: '2rem 0', color: 'var(--d-paper-dim)', fontSize: 13 }}>Loading…</div>;

export function Knowledge() {
  const [sub, setSub] = useState<SubKey>(getInitialSub);
  const handleSub = (s: string) => { setSub(s as SubKey); syncSubToUrl(s as SubKey); };
  return (
    <>
      <HeadRow title="Knowledge" meta={<>Brain · Prompt Pages</>} />
      <SubTabs>
        {SUB_ORDER.map(key => (
          <SubTab key={key} id={key} active={sub} onChange={handleSub}>
            {SUB_LABELS[key]}
          </SubTab>
        ))}
      </SubTabs>
      <Suspense fallback={<Loading />}>
        {sub === 'brain' ? <BrainPanel /> : <PromptsPanel />}
      </Suspense>
    </>
  );
}

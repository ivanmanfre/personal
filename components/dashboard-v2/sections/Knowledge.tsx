import React, { lazy, Suspense } from 'react';
import { HeadRow } from '../primitives';

/**
 * Phase 6 — Knowledge.
 * Wraps BrainPanel (claude_memory).
 *
 * Note: PromptsPanel exists on Ivan's working tree as untracked work
 * but isn't in the repo yet. When committed, add a sub-tab back here
 * (see comment block below).
 */

const BrainPanel = lazy(() => import('../../dashboard/BrainPanel'));
// const PromptsPanel = lazy(() => import('../../dashboard/PromptsPanel'));

const Loading = () => <div style={{ padding: '2rem 0', color: 'var(--d-paper-dim)', fontSize: 13 }}>Loading…</div>;

export function Knowledge() {
  return (
    <>
      <HeadRow title="Knowledge" meta={<>Brain · claude_memory</>} />
      <Suspense fallback={<Loading />}>
        <BrainPanel />
      </Suspense>
    </>
  );
}

/* TO RE-ADD PROMPTS SUB-TAB once PromptsPanel + usePromptPages are committed:

import { useState } from 'react';
import { SubTabs, SubTab } from '../primitives';

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
*/

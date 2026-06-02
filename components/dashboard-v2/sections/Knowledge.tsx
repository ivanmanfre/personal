import React, { lazy, Suspense, useState } from 'react';
import { HeadRow, SubTabs, SubTab } from '../primitives';

/**
 * Phase 6 — Knowledge.
 * Sub-tabs:
 *   - Brain: claude_memory (cross-conversation memory graph)
 *   - Prompts: ClickUp Prompts Library editor (writes back to ClickUp pages
 *     via the clickup-pages edge function; n8n prompt-sync workflow then
 *     pushes ClickUp → Supabase.content_prompts for the agents to consume).
 */

const BrainPanel = lazy(() => import('../../dashboard/BrainPanel'));
const PromptsPanel = lazy(() => import('../../dashboard/PromptsPanel'));

const Loading = () => <div style={{ padding: '2rem 0', color: 'var(--d-paper-dim)', fontSize: 13 }}>Loading…</div>;

type SubKey = 'brain' | 'prompts';
const SUB_LABELS: Record<SubKey, string> = { brain: 'Brain', prompts: 'Prompts' };
const SUB_ORDER: SubKey[] = ['prompts', 'brain'];

function getInitialSub(): SubKey {
  if (typeof window === 'undefined') return 'prompts';
  const params = new URLSearchParams(window.location.search);
  const s = params.get('sub') as SubKey | null;
  if (s && SUB_ORDER.includes(s)) return s;
  return 'prompts';
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
      <HeadRow title="Knowledge" meta={<>Prompts · Brain</>} />
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

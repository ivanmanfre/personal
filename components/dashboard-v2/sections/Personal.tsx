import React, { useState, lazy, Suspense } from 'react';
import { HeadRow, SubTabs, SubTab } from '../primitives';

/**
 * Phase 6 — Personal.
 * Wraps HealthPanel + SettingsPanel.
 */

const HealthPanel = lazy(() => import('../../dashboard/HealthPanel'));
const SettingsPanel = lazy(() => import('../../dashboard/SettingsPanel'));

type SubKey = 'health' | 'settings';
const SUB_ORDER: SubKey[] = ['health', 'settings'];
const SUB_LABELS: Record<SubKey, string> = { health: 'Health', settings: 'Settings' };

function getInitialSub(): SubKey {
  if (typeof window === 'undefined') return 'health';
  const params = new URLSearchParams(window.location.search);
  const s = params.get('sub') as SubKey | null;
  if (s && SUB_ORDER.includes(s)) return s;
  return 'health';
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

export function Personal() {
  const [sub, setSub] = useState<SubKey>(getInitialSub);
  const handleSub = (s: string) => { setSub(s as SubKey); syncSubToUrl(s as SubKey); };
  return (
    <>
      <HeadRow title="Personal" meta={<>Health · Settings<br />Private</>} />
      <SubTabs>
        {SUB_ORDER.map(key => (
          <SubTab key={key} id={key} active={sub} onChange={handleSub}>
            {SUB_LABELS[key]}
          </SubTab>
        ))}
      </SubTabs>
      <Suspense fallback={<Loading />}>
        {sub === 'health' ? <HealthPanel /> : <SettingsPanel />}
      </Suspense>
    </>
  );
}

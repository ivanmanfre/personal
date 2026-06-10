import React, { lazy, Suspense, useState } from 'react';
import { HeadRow, SubTabs, SubTab } from '../primitives';
import { StealBox } from './StealBox';

const LmIdeasPanel = lazy(() => import('../../dashboard/LmIdeasPanel'));

/**
 * Ideas — hub for mined/curated idea sources. Two lanes:
 *  - Content: curator-scored content angles (incl. call-derived: kyle_call, ivan_call)
 *  - Steal:   operator/sales tactics to apply, mined from Kyle's coaching calls
 * Content angles are the things you post; Steal tactics are things you apply to how
 * you run/sell. Both surface here so the Ideas section covers content AND operations.
 * URL contract: ?section=ideas&sub=content|steal (clones ContentStudio's pattern).
 */

type SubKey = 'content' | 'steal';
const SUB_LABELS: Record<SubKey, string> = { content: 'Content', steal: 'Steal' };
const SUB_ORDER: SubKey[] = ['content', 'steal'];

function getInitialSub(): SubKey {
  if (typeof window === 'undefined') return 'content';
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('sub');
  if (raw && SUB_ORDER.includes(raw as SubKey)) return raw as SubKey;
  return 'content';
}

function syncSubToUrl(sub: SubKey) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (url.searchParams.get('sub') !== sub) {
    url.searchParams.set('sub', sub);
    window.history.replaceState(null, '', url.toString());
  }
}

const PanelFallback = () => (
  <div style={{ padding: '2rem 0', color: 'var(--d-paper-dim)', fontSize: 13 }}>Loading ideas…</div>
);

export function Ideas() {
  const [sub, setSub] = useState<SubKey>(getInitialSub);

  const handleSub = (s: string) => {
    setSub(s as SubKey);
    syncSubToUrl(s as SubKey);
  };

  const renderSub = () => {
    switch (sub) {
      case 'content':
        return (
          <Suspense fallback={<PanelFallback />}>
            <LmIdeasPanel contentType="post" />
          </Suspense>
        );
      case 'steal':
        return <StealBox />;
    }
  };

  return (
    <>
      <HeadRow title="Ideas" />
      <SubTabs>
        {SUB_ORDER.map((key) => (
          <SubTab key={key} id={key} active={sub} onChange={handleSub}>
            {SUB_LABELS[key]}
          </SubTab>
        ))}
      </SubTabs>
      {renderSub()}
    </>
  );
}

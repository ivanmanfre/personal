import React, { useState } from 'react';
import { HeadRow, SubTabs, SubTab } from '../primitives';
import { StealBox } from './StealBox';

/**
 * Ideas — hub for mined/curated idea sources. v1 ships one sub-tab (Steal:
 * Kyle-call tactics). The sub-tab bar exists so future sources (e.g. Kyle
 * content-angles) drop in as new tabs without restructuring.
 * URL contract: ?section=ideas&sub=steal (clones ContentStudio's pattern).
 */

type SubKey = 'steal';
const SUB_LABELS: Record<SubKey, string> = { steal: 'Steal' };
const SUB_ORDER: SubKey[] = ['steal'];

function getInitialSub(): SubKey {
  if (typeof window === 'undefined') return 'steal';
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('sub');
  if (raw && SUB_ORDER.includes(raw as SubKey)) return raw as SubKey;
  return 'steal';
}

function syncSubToUrl(sub: SubKey) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (url.searchParams.get('sub') !== sub) {
    url.searchParams.set('sub', sub);
    window.history.replaceState(null, '', url.toString());
  }
}

export function Ideas() {
  const [sub, setSub] = useState<SubKey>(getInitialSub);

  const handleSub = (s: string) => {
    setSub(s as SubKey);
    syncSubToUrl(s as SubKey);
  };

  const renderSub = () => {
    switch (sub) {
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

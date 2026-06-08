import React, { lazy, Suspense } from 'react';
import { HeadRow, ErrBanner } from '../primitives';
import { useAiosOverview } from '../../../hooks/useAiosOverview';

const CapabilityHero = lazy(() => import('../../dashboard/CapabilityHero'));
const CapabilityRoster = lazy(() => import('../../dashboard/CapabilityRoster'));

const Loading = () => (
  <div style={{ padding: '2rem 0', color: 'var(--d-paper-dim)', fontSize: 13 }}>Loading…</div>
);

export function SystemOverview() {
  const o = useAiosOverview();
  const total = Object.values(o.counts).reduce((s, n) => s + n, 0);
  return (
    <>
      <HeadRow title={<>My <em>AIOS</em></>} meta={<>Capabilities · live overview</>} live />
      {o.error && <ErrBanner title="Roster unavailable." body={o.error} />}
      {o.loading ? (
        <Loading />
      ) : total === 0 && !o.error ? (
        <div style={{ padding: '2rem 0', color: 'var(--d-paper-dim)', fontSize: 13 }}>
          No capabilities synced yet. Run <code>node scripts/sync-aios-capabilities.mjs</code> to populate.
        </div>
      ) : (
        <Suspense fallback={<Loading />}>
          <CapabilityHero counts={o.counts} workflows={o.workflows} memoryFiles={o.memoryFiles} />
          <CapabilityRoster byKind={o.byKind} />
        </Suspense>
      )}
    </>
  );
}

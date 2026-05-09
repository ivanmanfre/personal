import React, { lazy, Suspense } from 'react';
import { HeadRow } from '../primitives';

/**
 * Phase 5 — Clients.
 * Wraps ClientsPanel which handles all 6 client_instances + per-client
 * workflow/error/infrastructure tabs + auto-fix toggle + state machine.
 */

const ClientsPanel = lazy(() => import('../../dashboard/ClientsPanel'));

const Loading = () => (
  <div style={{ padding: '2rem 0', color: 'var(--d-paper-dim)', fontSize: 13 }}>Loading clients…</div>
);

export function Clients() {
  return (
    <>
      <HeadRow
        title="Clients"
        meta={<>6 client_instances<br />Auto-fix engineer pipeline</>}
      />
      <Suspense fallback={<Loading />}>
        <ClientsPanel />
      </Suspense>
    </>
  );
}

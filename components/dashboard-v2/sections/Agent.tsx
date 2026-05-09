import React, { lazy, Suspense } from 'react';
import { HeadRow } from '../primitives';

/**
 * Phase 6 — Agent.
 * Wraps AgentPanel (n8nClaw chat + alerts + memory).
 */

const AgentPanel = lazy(() => import('../../dashboard/AgentPanel'));

const Loading = () => <div style={{ padding: '2rem 0', color: 'var(--d-paper-dim)', fontSize: 13 }}>Loading agent…</div>;

export function Agent() {
  return (
    <>
      <HeadRow title="Agent" meta={<>n8nClaw — WhatsApp<br />Conversation · alerts · memory</>} />
      <Suspense fallback={<Loading />}>
        <AgentPanel />
      </Suspense>
    </>
  );
}

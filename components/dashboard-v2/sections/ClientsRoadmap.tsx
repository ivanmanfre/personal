import React from 'react';
import '../editorial-cockpit.css';

/**
 * Clients — honest roadmap stub (Direction A register).
 *
 * The build-now tournament scope is Today + Warm Pipeline + embedded Posts +
 * System Pulse. The Clients rebuild is roadmap (per 03-ia-decision.md): these
 * cards name exactly what lands here after the vote — no faked data.
 */

const CARDS: { idx: string; title: string; body: string; tag: string }[] = [
  {
    idx: '01',
    title: 'Rise DTC ops view',
    body: 'Rebuilt from client_registry + client_boards: board link, delivery state, and a client_ledger spend tile. Kills every legacy client_instances read (the wrong pre-pivot table).',
    tag: 'roadmap · registry-driven',
  },
  {
    idx: '02',
    title: 'Client-draft approvals',
    body: "Separate from Ivan's own Posts board: client_id rows are excluded from the Studio approve queue so a client draft can never auto-post to Ivan's feed.",
    tag: 'roadmap · guardrail',
  },
  {
    idx: '03',
    title: 'Prospect demo boards',
    body: 'The bootstrap-client-board demos (client_boards preview rows) listed as demos, not clients: token-gated live URLs at ivanmanfredi.com/client/<slug>.',
    tag: 'roadmap · demos',
  },
];

export function ClientsRoadmap() {
  return (
    <div className="ec">
      <div className="ec-dateline">Section 03 · Clients</div>
      <h1 className="ec-hed">The client desk, rebuilt from the real registry.</h1>
      <p className="ec-dek">
        This section is roadmap for the tournament build. When it lands it reads client_registry and
        client_boards directly. Here is exactly what ships, named honestly rather than mocked.
      </p>
      <div className="ec-roadmap">
        {CARDS.map((c) => (
          <div className="ec-roadmap-card" key={c.idx}>
            <div className="ec-roadmap-idx">{c.idx}</div>
            <div className="ec-roadmap-title">{c.title}</div>
            <div className="ec-roadmap-body">{c.body}</div>
            <span className="ec-roadmap-tag">{c.tag}</span>
          </div>
        ))}
      </div>
      <p className="ec-footnote">
        Per 03-ia-decision.md, Clients (rebuilt). Build-now scope is Today + Warm Pipeline + embedded
        Posts board + System Pulse; this rebuild is in the post-vote apply plan.
      </p>
    </div>
  );
}

export default ClientsRoadmap;

// components/dev/ScanLabPage.tsx
// DEV-ONLY tournament harness for the Rise DTC Growth Scan redesign (elevation goal-run
// 2026-07-20). Renders a design candidate against a fixed fixture, no network, so
// playwright can screenshot rich / thin / blocked states deterministically.
//   /dev/scan-lab?candidate=current&fixture=rodial
// Candidates register in CANDIDATES below; fixtures are static JSON (v1 run evidence).
import React from 'react';
import { DtcGrowthReport } from '../DtcGrowthReport';
import type { ReportJson, Scan } from '../../lib/scanTypes';
import rodial from './scanlab/rodial-com.json';
import apple from './scanlab/apple-com.json';
import gopure from './scanlab/gopure-com.json';
import truly from './scanlab/truly-office-branzio.json';
// audit v3 (2026-08-07): the REAL panthervision v3 row — buckets, google ads evidence,
// brand-wide meta sweep, competitor strip, homepage+PDP screenshots.
import pantherV3 from './scanlab/panther-v3.json';
// Data-loss state: same row with EVERY v3 evidence arm stripped (google/meta_sweep/
// competitors/screenshots gone, buckets kept) — the page must stay coherent, deal shape
// intact, zero empty shells. This is the fixture that proves the fallback contract.
import pantherV3Degraded from './scanlab/panther-v3-degraded.json';

const FIXTURES: Record<string, any> = { rodial, apple, gopure, truly, 'panther-v3': pantherV3, 'panther-v3-degraded': pantherV3Degraded };

import { CandidateEditorial } from './scanlab/CandidateEditorial';
import { CandidateDossier } from './scanlab/CandidateDossier';
import { CandidateCinematic } from './scanlab/CandidateCinematic';
import { CandidateLedger } from './scanlab/CandidateLedger';

// Candidate components must accept the exact DtcGrowthReport props contract.
const CANDIDATES: Record<string, React.ComponentType<{ report: ReportJson; scan: Scan; companyName: string }>> = {
  current: DtcGrowthReport,
  editorial: CandidateEditorial,
  dossier: CandidateDossier,
  cinematic: CandidateCinematic,
  ledger: CandidateLedger,
};

export default function ScanLabPage() {
  const params = new URLSearchParams(window.location.search);
  const candKey = params.get('candidate') || 'current';
  const fixKey = params.get('fixture') || 'rodial';
  const fixture = FIXTURES[fixKey];
  const Candidate = CANDIDATES[candKey];
  if (!fixture || !Candidate) {
    return (
      <div style={{ padding: 40, fontFamily: 'monospace' }}>
        scan-lab: unknown candidate "{candKey}" or fixture "{fixKey}".
        candidates: {Object.keys(CANDIDATES).join(', ')} · fixtures: {Object.keys(FIXTURES).join(', ')}
      </div>
    );
  }
  const report = { matched_offer: 'dtc_growth', dtc: fixture.dtc } as unknown as ReportJson;
  const scan = { company_slug: `lab-${fixKey}`, domain: fixKey, status: 'complete' } as unknown as Scan;
  return <Candidate report={report} scan={scan} companyName={fixture.company_name} />;
}

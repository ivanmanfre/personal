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

const FIXTURES: Record<string, any> = { rodial, apple, gopure };

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

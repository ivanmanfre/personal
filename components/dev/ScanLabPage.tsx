// components/dev/ScanLabPage.tsx
// DEV-ONLY tournament harness for the Rise DTC Growth Scan redesign (elevation goal-run
// 2026-07-20). Renders a design candidate against a fixed fixture, no network, so
// playwright can screenshot rich / thin / blocked states deterministically.
//   /dev/scan-lab?candidate=current&fixture=rosamel
// Candidates register in CANDIDATES below; fixtures are static JSON (v1 run evidence).
import React from 'react';
import { DtcGrowthReport } from '../DtcGrowthReport';
import type { ReportJson, Scan } from '../../lib/scanTypes';
import rosamel from './scanlab/rosamel-example.json';
import yananailsStory from './scanlab/yananails-story.json';
import lunanailsStandard from './scanlab/lunanails-standard.json';
import orchardly from './scanlab/orchardly-example.json';
import puremeadow from './scanlab/puremeadow-example.json';
import plainly from './scanlab/plainly-office-vantzio.json';
// audit v3 (2026-08-07): an invented v3 row (identity replaced) — buckets, google ads evidence,
// brand-wide meta sweep, competitor strip, homepage+PDP screenshots.
import lynxlightV3 from './scanlab/lynxlight-v3.json';
// Data-loss state: same row with EVERY v3 evidence arm stripped (google/meta_sweep/
// competitors/screenshots gone, buckets kept) — the page must stay coherent, deal shape
// intact, zero empty shells. This is the fixture that proves the fallback contract.
import lynxlightV3Degraded from './scanlab/lynxlight-v3-degraded.json';

const FIXTURES: Record<string, any> = { 'lunanails-standard': lunanailsStandard, yananails: yananailsStory, rosamel, orchardly, puremeadow, plainly, 'lynxlight-v3': lynxlightV3, 'lynxlight-v3-degraded': lynxlightV3Degraded };

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

// V2 scan page (2026-11-17): six invented scans with a hero object (rich, norwegian, own-only, zero-own, thin, few-buyers), /dev/scan-lab?story=rich[&view=team][&hero=0].
// Dev builds only: the glob sits behind import.meta.env.DEV so the JSON never reaches the production bundle.
const STORY_FIXTURES: Record<string, () => Promise<unknown>> = import.meta.env.DEV ? import.meta.glob('./scanlab/v2-*.json', { import: 'default' }) : {};
const StoryLab = React.lazy(() => import('./scanlab/StoryLab'));

export default function ScanLabPage() {
  const params = new URLSearchParams(window.location.search);
  const story = params.get('story');
  if (story) {
    const load = STORY_FIXTURES[`./scanlab/v2-${story}.json`];
    if (!load) return <div style={{ padding: 40, fontFamily: 'monospace' }}>scan-lab: unknown story "{story}" (dev builds only).</div>;
    return <React.Suspense fallback={null}><StoryLab load={load} view={params.get('view') === 'team' ? 'team' : 'main'} hero={params.get('hero') !== '0'} /></React.Suspense>;
  }
  const candKey = params.get('candidate') || 'current';
  const fixKey = params.get('fixture') || 'rosamel';
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
  const scan = { company_slug: `lab-${fixKey}`, domain: fixture.domain || fixKey, status: 'complete' } as unknown as Scan;
  return <Candidate report={report} scan={scan} companyName={fixture.company_name} />;
}

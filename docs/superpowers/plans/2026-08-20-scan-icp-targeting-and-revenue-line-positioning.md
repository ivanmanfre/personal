# Scan ICP/Targeting Block + Revenue-Line Positioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an ICP + targeting block to the scan's existing Chapter 03 (Warm outbound) so a prospect sees who they would be targeting, and move Ivan's public identity from "LinkedIn inbound" to "LinkedIn as a revenue line" across every surface that carries it.

**Architecture:** Chapter 03 (`cs-ch-outbound`) already exists in `ScanReportPage.tsx` and already renders named people from the prospect's own comments via `EngagerOutreachMockup`. This plan adds a sibling block ABOVE that exhibit which states the inferred ICP, where the target pool comes from, a few sample leads, and how the lane is governed. All data comes from the existing report payload plus one new optional `icp_targeting` field. Derivation and the fail-closed gate live in a pure module (`lib/icpTargeting.ts`) so they are unit-testable without rendering; the component is presentational only.

**Tech Stack:** React 19 + TypeScript, Vite, Tailwind, vitest + @testing-library/react. `npm test` runs `vitest run`.

**Spec:** This document. Design was settled in conversation on 2026-08-20; the constraints below are the spec's load-bearing content.

## Global Constraints

- **Live repo.** `personal-site` is on `main` and deploys to production. Branch before the first edit. Never `git push` without Ivan's explicit say-so.
- **Claim boundary.** Render a number only when the check that produces it actually ran. Absence of data renders as silence, never as a finding. This is the rule that was violated in the B.me scan ("ai wrong info is it"), where `has_subscription` came from a source that could never express presence.
- **Liveness wording.** The liveness check is described as how the lane runs ("every profile gets a liveness check before it enters the send queue"). Never report a liveness *result* for sample profiles, because no check is run at scan time.
- **Fail closed.** Below the minimum evidence threshold the block does not render at all. Chapter 03 already does this (`{(engager || winRowCount('outbound') > 0) && ...}`) and the new block must match.
- **No new Apify spend.** Live account `brave_lark` is at **$211.60 of a $400 ceiling**, rising roughly $15/day, which reaches the ceiling around 2026-09-02 with zero new load. Every value in this block derives from data already in the report payload.
- **Copy rules.** Zero em dashes. No corrective contrast in any variant. No banned filler words. Canonical source is Supabase `content_prompts` slug `forbidden-language` v18.
- **Measured acceptance figures (computed 2026-08-20, both tenants):** warm **29.8%** (332 accepted / 1,113 invites), cold **10.0%** (101 / 1,005). Ivan tenant: warm 181/611, cold 88/867. RISE tenant: warm 151/502, cold 13/138. Round to "about 30%" and "about 10%" in prospect copy. Never restore 27%/14% or 32.8%/7.5%.
- **Occurrence assertions.** Copy strings exist in more places than any single grep suggests. Every string mutation asserts an expected occurrence count and aborts on mismatch.

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/scanTypes.ts` | Add optional `icp_targeting` to the `contentSystem` payload type. Type only, no logic. |
| `lib/icpTargeting.ts` (new) | Pure derivation: the fail-closed gate, sample-lead selection, and pool-source labelling. No React. |
| `lib/icpTargeting.test.ts` (new) | Unit tests for the gate and derivation. |
| `components/ui/IcpTargetingBlock.tsx` (new) | Presentational block. Receives already-derived data, renders nothing on its own decisions. |
| `components/ui/IcpTargetingBlock.test.tsx` (new) | Render tests, including the no-render case. |
| `components/ScanReportPage.tsx` | Wire the block into `cs-ch-outbound` (~line 3519). Correct the operator line (line 3600). |
| `lib/contentSystemContent.ts` | Correct the stale `GOVERNANCE` acceptance numbers. Currently imported by nothing, so this is landmine removal rather than a live fix. |
| `index.html` | Title, `og:title`, `twitter:title` (3 occurrences, lines 9/14/22). |

---

### Task 1: ICP targeting types and fail-closed gate

**Files:**
- Modify: `lib/scanTypes.ts` (append to the `contentSystem` object type, beside `engager_outreach`)
- Create: `lib/icpTargeting.ts`
- Test: `lib/icpTargeting.test.ts`

**Model:** `sonnet`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `IcpTargeting`, `SampleLead`, `PoolSource`, `deriveIcpTargeting(cs, audience): DerivedIcpTargeting | null`, `MIN_SAMPLE_LEADS = 3`.

- [ ] **Step 1: Write the failing test**

```typescript
// lib/icpTargeting.test.ts
import { describe, it, expect } from 'vitest';
import { deriveIcpTargeting, MIN_SAMPLE_LEADS } from './icpTargeting';

const fullTargeting = {
  icp_line: 'DTC skincare founders running $100k to $1M a month',
  segments: [{ label: 'DTC skincare', note: 'their current buyer' }],
  pool_sources: ['engagers' as const, 'competitor_engagers' as const],
};

const namedThree = [
  { name: 'Ada Lovelace', headline: 'Founder, Analytical Co', source: 'engager' },
  { name: 'Grace Hopper', headline: 'CEO, Compiler Labs', source: 'engager' },
  { name: 'Karen Sparck Jones', headline: 'Founder, Retrieval Ltd', source: 'network' },
];

describe('deriveIcpTargeting', () => {
  it('returns null when icp_targeting is absent', () => {
    expect(deriveIcpTargeting(undefined, { named: namedThree })).toBeNull();
  });

  it('returns null when fewer than MIN_SAMPLE_LEADS named people exist', () => {
    expect(MIN_SAMPLE_LEADS).toBe(3);
    const result = deriveIcpTargeting(fullTargeting, { named: namedThree.slice(0, 2) });
    expect(result).toBeNull();
  });

  it('returns null when icp_line is blank', () => {
    const result = deriveIcpTargeting({ ...fullTargeting, icp_line: '   ' }, { named: namedThree });
    expect(result).toBeNull();
  });

  it('derives leads and pool labels when evidence is sufficient', () => {
    const result = deriveIcpTargeting(fullTargeting, { named: namedThree });
    expect(result).not.toBeNull();
    expect(result!.icpLine).toBe('DTC skincare founders running $100k to $1M a month');
    expect(result!.leads).toHaveLength(3);
    expect(result!.leads[0]).toEqual({
      name: 'Ada Lovelace',
      headline: 'Founder, Analytical Co',
      reason: 'Engaged your posts',
    });
    expect(result!.leads[2].reason).toBe('In your connections');
    expect(result!.poolLabels).toEqual([
      'People who engage your posts',
      'People who engage your competitors',
    ]);
  });

  it('caps sample leads at four and drops entries with no name', () => {
    const many = [...namedThree, { name: 'Ida Rhodes', headline: 'COO', source: 'engager' },
      { name: 'Jean Bartik', headline: 'Founder', source: 'engager' }, { name: '  ', headline: 'x', source: 'engager' }];
    const result = deriveIcpTargeting(fullTargeting, { named: many });
    expect(result!.leads).toHaveLength(4);
    expect(result!.leads.every((l) => l.name.trim().length > 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/Desktop/personal-site && npx vitest run lib/icpTargeting.test.ts`
Expected: FAIL with "Failed to resolve import './icpTargeting'".

- [ ] **Step 3: Add the payload type**

In `lib/scanTypes.ts`, immediately after the `engager_outreach?: {...};` line inside the `contentSystem` object type, add:

```typescript
    // ICP + targeting read (2026-08-20). Model-emitted from the prospect's own business,
    // never from a paid harvest. Absent -> the ICP block does not render. Sample leads are
    // drawn from `audience.named`, which is counted data, so no lead is ever invented here.
    icp_targeting?: {
      icp_line: string;
      segments?: { label: string; note?: string }[];
      pool_sources?: ('engagers' | 'competitor_engagers' | 'network' | 'signals')[];
    };
```

- [ ] **Step 4: Write the minimal implementation**

```typescript
// lib/icpTargeting.ts
// Pure derivation for the scan's ICP + targeting block. No React, no fetching.
// Fail-closed by design: every gate returns null rather than rendering a thin block.
// A thin ICP block is worse than none, because it invites the buyer to check it.

export const MIN_SAMPLE_LEADS = 3;
const MAX_SAMPLE_LEADS = 4;

export type PoolSource = 'engagers' | 'competitor_engagers' | 'network' | 'signals';

export interface IcpTargeting {
  icp_line: string;
  segments?: { label: string; note?: string }[];
  pool_sources?: PoolSource[];
}

export interface SampleLead {
  name: string;
  headline: string;
  reason: string;
}

export interface DerivedIcpTargeting {
  icpLine: string;
  segments: { label: string; note?: string }[];
  leads: SampleLead[];
  poolLabels: string[];
}

const POOL_LABELS: Record<PoolSource, string> = {
  engagers: 'People who engage your posts',
  competitor_engagers: 'People who engage your competitors',
  network: 'Buyers already in your connections',
  signals: 'Accounts showing a hiring or spend signal',
};

// `source` mirrors the vocabulary already used by the audience audit block.
function reasonFor(source?: string): string {
  return source === 'network' ? 'In your connections' : 'Engaged your posts';
}

export function deriveIcpTargeting(
  targeting: IcpTargeting | undefined,
  audience: { named?: { name?: string; headline?: string; source?: string }[] } | undefined,
): DerivedIcpTargeting | null {
  if (!targeting) return null;
  const icpLine = (targeting.icp_line || '').trim();
  if (!icpLine) return null;

  const leads: SampleLead[] = (audience?.named ?? [])
    .filter((p) => (p.name || '').trim().length > 0)
    .slice(0, MAX_SAMPLE_LEADS)
    .map((p) => ({
      name: (p.name || '').trim(),
      headline: (p.headline || '').trim(),
      reason: reasonFor(p.source),
    }));

  if (leads.length < MIN_SAMPLE_LEADS) return null;

  const poolLabels = (targeting.pool_sources ?? [])
    .filter((s): s is PoolSource => s in POOL_LABELS)
    .map((s) => POOL_LABELS[s]);

  return { icpLine, segments: targeting.segments ?? [], leads, poolLabels };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd ~/Desktop/personal-site && npx vitest run lib/icpTargeting.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 6: Commit**

```bash
cd ~/Desktop/personal-site
git add lib/icpTargeting.ts lib/icpTargeting.test.ts lib/scanTypes.ts
git commit -m "feat(scan): fail-closed ICP targeting derivation"
```

---

### Task 2: IcpTargetingBlock component

**Files:**
- Create: `components/ui/IcpTargetingBlock.tsx`
- Test: `components/ui/IcpTargetingBlock.test.tsx`

**Model:** `sonnet`

**Interfaces:**
- Consumes: `DerivedIcpTargeting` from Task 1.
- Produces: default export `IcpTargetingBlock({ data, who }: { data: DerivedIcpTargeting; who: string })`.

- [ ] **Step 1: Write the failing test**

```typescript
// components/ui/IcpTargetingBlock.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import IcpTargetingBlock from './IcpTargetingBlock';

const data = {
  icpLine: 'DTC skincare founders running $100k to $1M a month',
  segments: [{ label: 'DTC skincare', note: 'their current buyer' }],
  leads: [
    { name: 'Ada Lovelace', headline: 'Founder, Analytical Co', reason: 'Engaged your posts' },
    { name: 'Grace Hopper', headline: 'CEO, Compiler Labs', reason: 'Engaged your posts' },
    { name: 'Karen Sparck Jones', headline: 'Founder, Retrieval Ltd', reason: 'In your connections' },
  ],
  poolLabels: ['People who engage your posts', 'People who engage your competitors'],
};

describe('IcpTargetingBlock', () => {
  it('renders the ICP line, every lead, and every pool label', () => {
    render(<IcpTargetingBlock data={data} who="Ada" />);
    expect(screen.getByText(/DTC skincare founders running/)).toBeTruthy();
    expect(screen.getByText('Grace Hopper')).toBeTruthy();
    expect(screen.getByText('People who engage your competitors')).toBeTruthy();
  });

  it('describes the liveness check as process and never reports a result', () => {
    render(<IcpTargetingBlock data={data} who="Ada" />);
    const text = document.body.textContent || '';
    expect(text).toContain('before it enters the send queue');
    expect(text).not.toMatch(/\d+\s*(profiles?|of them)\s+(are|were)\s+active/i);
  });

  it('contains no em dash anywhere in rendered copy', () => {
    render(<IcpTargetingBlock data={data} who="Ada" />);
    expect(document.body.textContent || '').not.toContain('—');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/Desktop/personal-site && npx vitest run components/ui/IcpTargetingBlock.test.tsx`
Expected: FAIL with "Failed to resolve import './IcpTargetingBlock'".

- [ ] **Step 3: Write the minimal implementation**

```tsx
// components/ui/IcpTargetingBlock.tsx
import React from 'react';
import type { DerivedIcpTargeting } from '../../lib/icpTargeting';

// The targeting read for Chapter 03. Every value here is derived upstream by
// deriveIcpTargeting, which fails closed. This component makes no decisions about
// whether there is enough evidence to show; it only draws what it is handed.
const IcpTargetingBlock: React.FC<{ data: DerivedIcpTargeting; who: string }> = ({ data, who }) => (
  <div className="icp-block" style={{ marginTop: 'clamp(24px,3vw,36px)' }}>
    <div className="icp-lead">
      <span className="icp-k">Who we go after for you</span>
      <p className="icp-line">{data.icpLine}</p>
    </div>

    {data.poolLabels.length > 0 && (
      <ul className="icp-pools">
        {data.poolLabels.map((label) => (
          <li key={label}>{label}</li>
        ))}
      </ul>
    )}

    <div className="icp-leads">
      <span className="icp-k">A few of them, {who}</span>
      {data.leads.map((lead) => (
        <div className="icp-lead-row" key={lead.name}>
          <span className="icp-name">{lead.name}</span>
          <span className="icp-headline">{lead.headline}</span>
          <span className="icp-reason">{lead.reason}</span>
        </div>
      ))}
    </div>

    <p className="icp-gov">
      Every profile gets a liveness check before it enters the send queue, and the lane runs
      under a fixed weekly cap on your account. Warm sends land at about 30% acceptance across
      the lanes we run. Cold sits near 10%, which is why we keep the pool warm.
    </p>
  </div>
);

export default IcpTargetingBlock;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/Desktop/personal-site && npx vitest run components/ui/IcpTargetingBlock.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
cd ~/Desktop/personal-site
git add components/ui/IcpTargetingBlock.tsx components/ui/IcpTargetingBlock.test.tsx
git commit -m "feat(scan): ICP targeting block component"
```

---

### Task 3: Wire the block into Chapter 03

**Files:**
- Modify: `components/ScanReportPage.tsx` (import near line 17; derivation near line 3056; render inside `cs-ch-outbound` at ~3519)

**Model:** `sonnet`

**Interfaces:**
- Consumes: `deriveIcpTargeting` (Task 1), `IcpTargetingBlock` (Task 2).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Add the import**

Beside the existing `import EngagerOutreachMockup from './ui/EngagerOutreachMockup';` at line 17, add:

```tsx
import IcpTargetingBlock from './ui/IcpTargetingBlock';
import { deriveIcpTargeting } from '../lib/icpTargeting';
```

- [ ] **Step 2: Derive alongside the existing engager derivation**

Immediately after the existing `const engager = cs.sample_output?.engager_outreach?.samples?.length ? cs.sample_output.engager_outreach : null;` (line 3061), add:

```tsx
  // Fails closed inside deriveIcpTargeting: no icp_line or fewer than 3 named people -> null.
  const icpTargeting = deriveIcpTargeting(cs.icp_targeting, aud);
```

- [ ] **Step 3: Widen the chapter gate and render the block**

Change the chapter gate at line 3518 from:

```tsx
        {(engager || winRowCount('outbound') > 0) && (
```

to:

```tsx
        {(engager || icpTargeting || winRowCount('outbound') > 0) && (
```

Then insert the block immediately after the `<SecHead ... />` closing tag and before `<WinRows k="outbound" />`:

```tsx
          {icpTargeting && <IcpTargetingBlock data={icpTargeting} who={who} />}
```

- [ ] **Step 4: Verify the build and full suite**

Run: `cd ~/Desktop/personal-site && npx tsc --noEmit && npm test`
Expected: tsc clean, full vitest suite green.

- [ ] **Step 5: Commit**

```bash
cd ~/Desktop/personal-site
git add components/ScanReportPage.tsx
git commit -m "feat(scan): render ICP targeting block in warm outbound chapter"
```

---

### Task 4: Correct the stale acceptance numbers

**Files:**
- Modify: `lib/contentSystemContent.ts:94-104`
- Test: `lib/contentSystemContent.test.ts` (create if absent)

**Model:** `haiku`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

Context for the implementer: `GOVERNANCE` is currently imported by no live module, so this renders nowhere today. It is corrected so that wiring it in later cannot ship a stale claim.

- [ ] **Step 1: Write the failing test**

```typescript
// lib/contentSystemContent.test.ts
import { describe, it, expect } from 'vitest';
import { GOVERNANCE } from './contentSystemContent';

describe('GOVERNANCE acceptance stats', () => {
  it('carries the 2026-08-20 measured figures and not the retired ones', () => {
    const blob = JSON.stringify(GOVERNANCE);
    expect(blob).toContain('30%');
    expect(blob).toContain('near 10%');
    expect(blob).not.toContain('27%');
    expect(blob).not.toContain('near 14');
  });

  it('states the sample size so the claim is checkable', () => {
    expect(JSON.stringify(GOVERNANCE)).toContain('2,118');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/Desktop/personal-site && npx vitest run lib/contentSystemContent.test.ts`
Expected: FAIL, `expect(blob).toContain('30%')`.

- [ ] **Step 3: Replace the stat and the provenance comment**

Replace the comment block at lines 94-97 with:

```typescript
// Account-safety governance for the warm engager lane. Every number is a
// measurement from Ivan's OWN live lanes, recomputed 2026-08-20 across both
// tenants (2,118 connection invites). Update here if the lanes drift.
// No em dashes, no AI tells (matches HONESTY RULE above).
```

Replace line 102 with:

```typescript
    { value: '30%', label: 'acceptance rate on warm engagers across 2,118 invites in our own lanes. Cold prospecting sits near 10%, and a low rate is exactly what LinkedIn throttles.' },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/Desktop/personal-site && npx vitest run lib/contentSystemContent.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
cd ~/Desktop/personal-site
git add lib/contentSystemContent.ts lib/contentSystemContent.test.ts
git commit -m "fix(copy): correct stale warm/cold acceptance figures to measured 30/10"
```

---

### Task 5: Identity line across owned surfaces

**Files:**
- Modify: `index.html:9`, `index.html:14`, `index.html:22`
- Modify: `components/ScanReportPage.tsx:3600`

**Model:** `haiku`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

Ivan has approved the wording. Supabase canon rows (`author-voice` v29, `brand-positioning` v10) are NOT touched by this task; they are staged separately for his approval.

- [ ] **Step 1: Assert the expected occurrence count before mutating**

```bash
cd ~/Desktop/personal-site
n=$(grep -c "LinkedIn Inbound System for Agencies" index.html)
[ "$n" -eq 3 ] || { echo "ABORT: expected 3 occurrences, found $n"; exit 1; }
echo "OK: 3 occurrences confirmed"
```

Expected: `OK: 3 occurrences confirmed`. If the count differs, stop and report rather than editing.

- [ ] **Step 2: Replace the three title strings**

```bash
cd ~/Desktop/personal-site
sed -i '' 's/Iván Manfredi: LinkedIn Inbound System for Agencies/Iván Manfredi: LinkedIn as a Revenue Line for Agencies/g' index.html
grep -c "LinkedIn as a Revenue Line for Agencies" index.html
```

Expected output: `3`.

- [ ] **Step 3: Replace the scan operator line**

In `components/ScanReportPage.tsx` line 3600, replace:

```tsx
              <div className="op-h">I&rsquo;m Iván. I turn a founder&rsquo;s LinkedIn into content, lead magnets and an audience they own.</div>
```

with:

```tsx
              <div className="op-h">I&rsquo;m Iván. I turn a founder&rsquo;s LinkedIn into a revenue line: the posts, the comments under them, and the DMs, through to a booked call.</div>
```

- [ ] **Step 4: Verify build and suite**

Run: `cd ~/Desktop/personal-site && npx tsc --noEmit && npm test`
Expected: tsc clean, suite green.

- [ ] **Step 5: Commit**

```bash
cd ~/Desktop/personal-site
git add index.html components/ScanReportPage.tsx
git commit -m "feat(positioning): revenue-line identity on title and scan operator line"
```

---

### Task 6: DM1 and sequence change proposal (REVIEW GATE, NO EXECUTION)

**Files:**
- Create: `docs/superpowers/plans/2026-08-20-dm1-sequence-change-proposal.md`

**Model:** `opus`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: a review document only. No Supabase row is written by this task.

**Ivan's explicit instruction: he reviews the exact changes before any are made.** This task produces the proposal and stops. Executing it is a separate decision he makes after reading it.

The four rows to read in full and propose diffs against, fetched live from Supabase `content_prompts`:

| Slug | Version | Role in the sequence |
|---|---|---|
| `trigger-research-synthesis-prompt` | v2 | The DM1 brain. Owns micro-persona, messaging pattern, hook and ask. |
| `outreach-wins-generator` | v10 | The per-prospect wins that ride in the message. |
| `connection-note-templates` | v1 | The 200-character connect note. |
| `followup-drafter` | v3 | Post-call follow-up, already enforces one recommended tier. |

- [ ] **Step 1: Fetch all four row bodies verbatim into the proposal doc**

Do not summarise them. The proposal shows current text and proposed text side by side, per changed passage.

- [ ] **Step 2: Pull Ivan's hand-sent corpus as the voice ground truth**

```
outreach_messages where ai_model IS NULL and message_type in ('dm','inmail')
```

Caution: old cold-engine emails are also `ai_model IS NULL` and are not his hand. Filter to dm/inmail only. Every proposed line is mirrored from this corpus rather than composed from the style rules.

- [ ] **Step 3: Write the proposal with one section per row**

Each section carries: the exact current passage, the exact proposed passage, and one sentence of why. No rewrites beyond the passages that carry the inbound framing or the booking ask.

- [ ] **Step 4: State the measured case for the sequencing change**

The Ivan tenant has 8,387 prospects, 136 replies, and 1 booked call. The first touch performs; the reply-to-call step does not. The proposal must argue for changing the reply-stage handling first and treating DM1 edits as secondary, or explicitly argue against that if the row contents suggest otherwise.

- [ ] **Step 5: Commit the proposal and stop**

```bash
cd ~/Desktop/personal-site
git add docs/superpowers/plans/2026-08-20-dm1-sequence-change-proposal.md
git commit -m "docs: DM1 and sequence change proposal for review"
```

Do not proceed to any Supabase write. Hand the document to Ivan.

---

## Self-Review

**Spec coverage.** ICP block (Tasks 1-3), acceptance-number correction (Task 4), identity line on the two code-owned surfaces (Task 5), DM1/sequence proposal held at a review gate (Task 6). The Supabase canon rows `author-voice` v29 and `brand-positioning` v10 are deliberately excluded from execution and are staged separately, because a locked identity line is Ivan's call and `taste-capture` stages rather than writes.

**Placeholder scan.** No TBDs. Every code step carries the code. Task 6 is a document-producing task by design, and its steps name the exact rows, the exact corpus filter, and the exact structure.

**Type consistency.** `deriveIcpTargeting`, `DerivedIcpTargeting`, `MIN_SAMPLE_LEADS`, `IcpTargetingBlock`, and the `icp_targeting` payload field are named identically in Tasks 1, 2, and 3. The `who` prop matches the existing `who` variable already in scope at the Chapter 03 render site.

**Model tags.** Task 1 and 2 build new logic with tests (`sonnet`). Task 3 is careful wiring into a 5,362-line live file (`sonnet`). Tasks 4 and 5 are asserted string edits (`haiku`). Task 6 is judgment-heavy voice work against a corpus (`opus`).

## Known gaps

- The upstream generator that emits `icp_targeting` into the report payload is NOT in this repo and is not covered by this plan. Tasks 1-3 make the scan render the field correctly when present and stay silent when absent, which is safe to ship on its own. Wiring the generator is a separate plan against the Railway scan service.
- `EngagerOutreachMockup` styling classes (`icp-*`) need CSS to match the surrounding `bbrec` design system. Task 2 emits semantic class names; the styling pass rides with Task 3's visual check.

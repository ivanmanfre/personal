# Scan Lead Journey Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking. Work inline unless a later instruction explicitly requests delegation. Do not use Fable.

**Goal:** Build a complete, readable mobile-first scan story that presents the client's existing samples and connects them through one illustrated buyer's journey.

**Architecture:** A development-only React page presents five naturally scrolling chapters. A typed sample adapter preserves original scan output; shared state connects resource inputs, example request and follow-up. A decorative character moves only between reading areas.

**Tech Stack:** Existing React 19, TypeScript, Framer Motion, Vite, Vitest and Playwright. Native HTML and SVG. No new runtime dependency.

**Spec:** `docs/superpowers/specs/2026-09-21-scan-lead-journey-design.md` is authoritative. The earlier concept document is discussion history.

## Global constraints

- Worktree: `/Users/ivanmanfredi/Desktop/personal-site-scan-preview-20260921`.
- Preview: `http://127.0.0.1:4317/dev/scan-walkthrough`.
- Preserve current uncommitted changes. No reset, production renderer changes, generator changes, workflow changes or deployment.
- Existing sample content, slide order and branding are preserved. Explicitly identify any proposed replacements or missing source data.
- Complete posts, carousel, lead magnet, newsletter and messages stay inline. No detail dialogs or clamped full post bodies.
- Five chapters: content/profile; shared carousel/resource/request; newsletter; conversations; recap/proof/service.
- All text uses plain words and the current voice rules. Zero em dashes and corrective-contrast constructions.
- Mobile body and sample text at least 16px, line-height at least 1.5; essential labels at least 12px; primary controls at least 44×44px.
- Reading sections keep natural height. No wheel interception, forced scrolling, autoplay or long decorative pinning.
- Existing product colours and typography govern the frame. Platform and client artifacts retain their own identity.
- Interaction and content survive reduced motion, image failures and unavailable embeds. No preview form submits externally.

## Files and responsibilities

All paths below are relative to the worktree.

| File | Responsibility |
|---|---|
| `components/dev/scan-walkthrough/ScanWalkthroughPreview.tsx` | Small composition root for the new page and shared state |
| `components/dev/scan-walkthrough/journey/model.ts` | Display data types, source adapter and state transitions |
| `components/dev/scan-walkthrough/journey/samples.json` | Sanitised public sample fixture from Andrew's scan, with source information |
| `components/dev/scan-walkthrough/journey/ReadingChapter.tsx` | Heading, short explanation, natural reading region and transition anchor |
| `components/dev/scan-walkthrough/journey/ContentChapter.tsx` | Complete post and focused profile view |
| `components/dev/scan-walkthrough/journey/ResourceChapter.tsx` | Existing carousel, related lead magnet and illustrative request record |
| `components/dev/scan-walkthrough/journey/FollowUpChapters.tsx` | Complete newsletter, follow-up and researched outreach |
| `components/dev/scan-walkthrough/journey/BuyerPath.tsx` | Decorative SVG character, route and transition progress |
| `components/dev/scan-walkthrough/journey/journey.css` | Scoped layout, type, responsive and reduced-motion rules |
| `components/dev/scan-walkthrough/journey/model.test.ts` | Sample preservation and cross-scene state tests |
| `scripts/check-scan-journey.cjs` | Browser interaction, layout and accessibility assertions |
| `components/dev/scan-walkthrough/StoryExhibits.tsx` | Reuse published RISE proof and opt-in audio; add a mobile external-open mode for the live calculator |

Read `components/ScanReportPage.tsx:3027` through its sample derivations, `lib/scanTypes.ts`, `lib/contentSystemFeed.ts`, `hooks/useScan.ts` and the existing UI renderers before adapting sample data. Reuse their public APIs where they meet the new reading contract. Avoid changing their behaviour for production callers.

## Shared interfaces

Define these once in `journey/model.ts`:

```ts
import type { ContentSystem } from '../../../../lib/scanTypes';

export type JourneySamples = NonNullable<ContentSystem['sample_output']>;
export type SourceKind = 'original-scan' | 'preview-draft';
export interface SampleSource {
  kind: SourceKind;
  url: string;
  capturedOn: string;
}
export interface JourneyFixture {
  founder: { name: string; company: string; profileUrl: string; avatarUrl?: string };
  buyer: { role: string; project: string };
  samples: JourneySamples;
  source: SampleSource;
}
export type ResearchPurpose = 'campaign' | 'creative' | 'category';
export interface JourneyState {
  category: string;
  purpose: ResearchPurpose;
  requested: boolean;
  subscribed: boolean;
}
export type JourneyAction =
  | { type: 'category'; value: string }
  | { type: 'purpose'; value: ResearchPurpose }
  | { type: 'request' }
  | { type: 'subscription'; value: boolean };
export const initialJourneyState: JourneyState = {
  category: 'Coffee', purpose: 'campaign', requested: false, subscribed: false,
};
export function journeyReducer(state: JourneyState, action: JourneyAction): JourneyState {
  switch (action.type) {
    case 'category': return { ...state, category: action.value, requested: false };
    case 'purpose': return { ...state, purpose: action.value, requested: false };
    case 'request': return { ...state, requested: true };
    case 'subscription': return { ...state, subscribed: action.value };
  }
}
```

`ContentChapter` receives `fixture`. `ResourceChapter` receives `fixture`, `state`, and `dispatch: React.Dispatch<JourneyAction>`. `FollowUpChapters` receives the same three props. Each reads original sample wording from `fixture`; dynamic scenario copy is separately labelled as a preview example. `BuyerPath` receives `rootRef: React.RefObject<HTMLElement | null>` and reads `[data-journey-transition]` anchors only.

## Task 1: Preserve the current page and inventory real samples

- [x] Save the current worktree diff and untracked source files in a local checkpoint before restructuring. Inspect `git status --short`; do not commit unrelated files.
- [x] Read the original report's public sample loader and sample types. Retrieve only the public sample material for `andrew-hayes-94`, using the existing data access route. Do not fetch workflow credentials or private contact data.
- [x] Write `journey/samples.json` with `JourneyFixture` fields. Preserve all post paragraphs, slide sources/order, lead magnet identity, newsletter subject/sections and message examples. Record the public source URL and capture date. Exclude service keys, private fields and unrelated report data.
- [x] Compare the fixture with the handwritten `data.ts`. Mark source kinds accurately. If an essential original sample is absent, record its absence visibly and identify the missing material before treating the exhibit as complete. Do not substitute RISE material into the CueVu slot.
- [x] Add fixture checks that assert required samples are present and original strings/slide ordering are preserved. Use the exact retrieved fixture values as the assertions, not invented expected copy.

Run `npm run test -- components/dev/scan-walkthrough/journey/model.test.ts`. This task passes when each displayed sample has a source and the adapter does not rewrite it.

## Task 2: Build the static reading layout at mobile width

- [x] Create `ReadingChapter.tsx` with this structure and exported props:

```tsx
export interface ReadingChapterProps {
  id: string;
  title: string;
  why: string;
  children: React.ReactNode;
}
export function ReadingChapter({ id, title, why, children }: ReadingChapterProps) {
  return <section id={id} className="journey-chapter">
    <div data-journey-transition aria-hidden="true" />
    <header><h2>{title}</h2><p>{why}</p></header>
    <div className="journey-reading">{children}</div>
  </section>;
}
```

- [x] Create scoped CSS around the following geometry; style platform artifacts within this reading layout:

```css
.scan-journey { color:#131210; background:#fff; font-family:'Schibsted Grotesk',sans-serif; }
.scan-journey .journey-chapter { padding:64px 18px; }
.scan-journey .journey-reading { width:100%; max-width:680px; margin:28px auto 0; }
.scan-journey .journey-chapter header { max-width:58ch; margin:auto; }
.scan-journey .journey-chapter h2 { font-size:clamp(36px,9vw,56px); line-height:1.08; }
.scan-journey .journey-chapter header p { font-size:17px; line-height:1.55; margin-top:20px; }
.scan-journey .sample-body { font-size:16px; line-height:1.6; max-width:58ch; }
.scan-journey button { min-width:44px; min-height:44px; }
.scan-journey :focus-visible { outline:3px solid #C8361B; outline-offset:4px; }
@media(min-width:390px) { .scan-journey .journey-chapter { padding-inline:20px; } }
@media(min-width:768px) {
  .scan-journey .journey-chapter { padding:90px 32px; }
  .scan-journey .sample-body { font-size:18px; }
}
@media(prefers-reduced-motion:reduce) {
  .scan-journey * { scroll-behavior:auto!important; }
}
```

- [x] Replace only the development page root. Keep `App.tsx`'s DEV route and lazy-loading guard unchanged. Import the new stylesheet without inheriting the older fixed-height scene rules.
- [x] Compose all five chapters with their full static samples. Reuse existing post, newsletter and resource renderers where suitable. A reused renderer that truncates content needs a local presentation wrapper or local equivalent, preserving its data contract.
- [x] Show the profile as readable identity, positioning and featured resource. Use original versus proposed labels correctly.
- [x] Capture 390×844 and 1440×900 screenshots of each chapter and its boundary. Fix incomplete text, repeated explanations and misleading transitions before adding motion.

This task passes when the full story is understandable without animation or opening another view.

## Task 3: Implement the shared carousel, resource and request

- [x] Keep slide index in `ResourceChapter`; original slide data order remains unchanged. Previous and next buttons clamp at the ends. Use functional updates:

```ts
setSlide(i => Math.max(0, i - 1));
setSlide(i => Math.min(slides.length - 1, i + 1));
```

- [x] On mobile, render one full-width slide, its position and 44px controls. If the source slide image's text cannot meet the reading rule, show the original slide text below it. No autoplay or gesture handler that prevents vertical scrolling.
- [x] Render the actual lead magnet in the same chapter, with a sample result visible. For an interactive planner, derive output from `state.category` and `state.purpose`. For a static document, present its real excerpt and file link.
- [x] Connect input changes to `journeyReducer`. Keep labels visible, update output in a polite status region and do not move focus after an input change.
- [x] Retain a functioning brief download for the planner example. HTML-escape dynamic values before generating the file; revoke Blob URLs after download.
- [x] Show the illustrative request record below the resource. The demo request sets `requested` only. It never posts to a remote endpoint. Newsletter subscription uses a separate visible checkbox and the `subscription` action.
- [x] Add these meaningful state tests:

```ts
import { describe, it, expect } from 'vitest';
import { initialJourneyState, journeyReducer } from './model';
describe('journey state', () => {
  it('retains choices when requesting the resource', () => {
    const coffee = journeyReducer(initialJourneyState, {type:'category',value:'Skincare'});
    const requested = journeyReducer(coffee, {type:'request'});
    expect(requested).toMatchObject({category:'Skincare',requested:true,subscribed:false});
  });
  it('invalidates an old request when the scenario changes', () => {
    const requested = journeyReducer(initialJourneyState, {type:'request'});
    const changed = journeyReducer(requested, {type:'purpose',value:'creative'});
    expect(changed).toMatchObject({purpose:'creative',requested:false});
  });
});
```

This task passes when every slide is accessible and the resource, record and download agree on the selected values.

## Task 4: Complete newsletter, outreach, recap and proof

- [x] Render the original newsletter subject and every section in natural page flow. Preserve complete paragraphs and its relevant next action. Label it as a newsletter sample whether or not the demo subscription is checked.
- [x] Show resource delivery as a short receipt where useful; do not use it as the newsletter sample.
- [x] Show a full warm follow-up tied to the same scenario. Preserve actual scan message text separately where it cannot be dynamically personalised without rewriting source material.
- [x] Show a full researched outreach example and the specific reason for contact. Bracketed details remain labelled as requiring verification. Explain that this is another entrance to a conversation.
- [x] Build a recap from the actual chapter labels and sample thumbnails. Keep HTML copy at its normal readable size. Label any example reply or possible call as illustrative.
- [x] Reuse the real RISE proof after the coherent CueVu path. Below 768px, the live calculator action opens the real page externally; it does not create an iframe with nested scrolling. Keep desktop live preview opt-in.
- [x] Keep the optional soundtrack default off. Its mobile control is in the header; no floating control can obscure reading content.

This task passes when the newsletter and both conversation routes are visible, correct and independent of optional controls.

## Task 5: Add the illustrated buyer and connecting motion

- [x] Draw one small consistent SVG person. Define idle and four walking poses through SVG limb transforms. The character has no speech bubbles, counters or required controls.
- [x] Implement `BuyerPath` using the transition anchors from `ReadingChapter`. Geometry is recalculated with `ResizeObserver` after fonts/images resize content. Disconnect observers on unmount.
- [x] Use scroll-linked motion values for position, with coordinates clamped to the active transition. During reading areas, use the resting pose at the transition's destination. Pose cycling stops when position stops changing. Reverse travel on reverse scrolling.
- [x] At widths below 1024px, place the character only within transition areas above content. At 1024px and above, reserve a 72px visual lane outside the reading column. Never position it on top of samples.
- [x] Use the existing ease `[0.22,0.84,0.36,1]` for 250–450ms discrete changes. Avoid layout animation of reading content. Character and path are `aria-hidden` and ignore pointer events.
- [x] In reduced-motion mode, render static markers and apply changes immediately. All samples retain their normal order.
- [x] At the final recap, animate only decorative route geometry on desktop. Mobile uses a vertical recap without zooming text.

Review discovery → profile → shared resources as an internal checkpoint, then finish the whole page. This task passes when movement makes the sequence clearer and never interrupts reading.

## Task 6: Browser verification and final local review

Create `scripts/check-scan-journey.cjs` using the installed Playwright package. Test the spec's complete viewport matrix. Include assertions equivalent to:

```js
const assert = require('node:assert/strict');
assert.equal(await page.locator('dialog').count(), 0);
assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
for (const selector of ['.sample-body','.newsletter-body']) {
  const sizes = await page.locator(selector).evaluateAll(nodes => nodes.map(node => {
    const css = getComputedStyle(node);
    return { font:parseFloat(css.fontSize), line:parseFloat(css.lineHeight) };
  }));
  assert.ok(sizes.length > 0);
  for (const size of sizes) { assert.ok(size.font >= 16); assert.ok(size.line / size.font >= 1.5); }
}
```

- [x] Verify each post's full fixture text appears in the selected sample. Select alternative posts with keyboard and confirm focus remains on the control.
- [x] Traverse every carousel slide and check first/last disabled buttons. Test touch swiping without blocking vertical page movement.
- [x] Change category and purpose, request the demo resource and download the file. Assert the visible record and downloaded content use those values.
- [x] Assert no write requests originate from demo input/request actions. Ignore unrelated read-only asset requests; record and inspect every attempted POST/PATCH/PUT/DELETE.
- [x] Test newsletter subscription independently from resource request. Verify full newsletter text remains readable in both states.
- [x] Verify no moving character or fixed control overlaps any reading region at all required widths. Capture representative mid-transition frames, not only settled scenes.
- [x] Repeat functional checks with reduced motion. Test 200% zoom and keyboard focus paths.
- [x] Simulate a missing image and unavailable live embed. Confirm readable fallback content and a direct link remain.
- [x] Run `npm run test -- components/dev/scan-walkthrough/journey/model.test.ts`, `node scripts/check-scan-journey.cjs`, `npm run build` and `git diff --check`.
- [x] Run design-metrics with the current creative preview metrics as the comparison anchor, declare mockup selectors, and include a performance pass. Evaluate density by distinguishing sample text from narration; do not cut full sample content to chase a word-count score.
- [x] Review desktop/mobile screenshots and seams against the spec's acceptance questions. Fix blocking reading or interaction findings. Commit only the scoped local implementation and evidence after checks pass. No deployment.

## Completion record

Save screenshots, browser assertions, source inventory and measurement results under `audits/andrew-scan-design-2026-09-21/lead-journey/` in the content-system workspace. Record the final local commit and any actual missing source assets. Completion requires the full sample set and all five chapters; a motion demonstration alone does not complete the task.

## Implementation notes, 2026-09-21

The public source contains four posts, six text carousel slides, the seven-question Story Checklist, three follow-up emails and engager outreach. It has no newsletter or cold-outbound sample. Those two exhibits are new drafts and visibly labelled. The real checklist replaces the earlier proposed research planner; its original questions remain unchanged. Category, writing purpose and checked answers drive the local example record, personal opening and downloadable HTML. See SOURCE-INVENTORY.md in the lead-journey audit folder.

Work remains on the local preview branch and worktree. No deployment or production changes. Full-repository TypeScript checking reports pre-existing errors in other modules; it reports no errors in scan-walkthrough.

Completed all six tasks. Full original newsletter/static-file steps were adapted to the source inventory above. The 200% check uses the equivalent 720px CSS viewport for a 1440px desktop window. Evidence, independent review and limitations are in the lead-journey audit directory.

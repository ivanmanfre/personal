# AI Image Spot-Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let anyone (Ivan + clients on `/client` boards) touch up an AI-generated post/carousel image safely — click a spot to region-lock an edit, or type a plain-English whole-image edit — with every AI result landing as a *proposal* (Keep / Try again / Go back), never an in-place overwrite.

**Architecture:** Two Supabase edge functions (`img-segment` = fal.ai SAM2 point→mask; `img-edit` = fal.ai Flux Fill masked inpaint OR Gemini 3.1 mask-free whole-image) do the pixel work server-side on keys the frontend never sees. A React `ImageEditorModal` mounts from the existing `CarouselEditor` control row, drives a pure state machine (`lib/imageEditModel.ts`) through segment → edit → **propose** → keep/revert, uploads accepted results to the `post-stills` bucket, and records a version row so the original is always recoverable. Code-rendered-card real-layer text editing is explicitly Phase 2 (needs the render-lane layout data, not in scope here).

**Tech Stack:** React + Vite + TypeScript + Tailwind (dashboard-v2 light theme), Vitest, Supabase (edge functions Deno, Postgres, Storage `post-stills`), fal.ai REST, Gemini 3.1 flash-image REST.

**Source of truth:** locked spec `~/.claude/projects/-Users-ivanmanfredi-Desktop-Ivan---Content-System/memory/ai-image-spot-editor-2026-07-04.md`.

## Global Constraints

- **Git hazard (personal-site runs live automation on `main`):** work in an ISOLATED git worktree; push with a refspec `git push origin <branch>:main` — never work directly on the primary checkout's `main`. Create the worktree via `superpowers:using-git-worktrees` before Task 1. `cp ~/Desktop/personal-site/.env <worktree>/.env` (gitignored) so vitest suites that touch the supabase client don't error "supabaseKey required".
- **Deploy:** frontend deploys via `git push origin <branch>:main` → GitHub Actions → Pages. Edge functions deploy manually: `supabase functions deploy <name> --project-ref bjbvqvzbzczjbatgmccb`. (`deploy-pages@v4` can stall ~2.5–3 min; if it does, ONE spaced empty-commit re-trigger.)
- **Census gate — every task that touches `components/dashboard/**` or `components/dashboard-v2/sections/**` MUST end with `node scripts/lightshim-census.mjs` returning exit 0 / `{"usedCount":N,"missing":[]}`.** Capture the exit code directly, never through `| tail`. Any new dark Tailwind class must be shimmed in `components/dashboard-v2/theme/light.css` first. Prefer `var(--ds-*)` tokens: `--ds-bg, --ds-card, --ds-line, --ds-ink, --ds-dim, --ds-faint, --ds-accent (#4f46e5), --ds-accent-hover, --ds-ok, --ds-warn, --ds-info, --ds-shadow-card, --ds-radius`.
- **FAL_KEY BLOCKER (Ivan action, external):** the stack has NO fal.ai key yet. Ivan must create a fal.ai account, add billing, and hand over `FAL_KEY`. Set it as an edge-function secret: `supabase secrets set FAL_KEY=<value> --project-ref bjbvqvzbzczjbatgmccb`. Tasks 4 and 5's **fal paths cannot be live-tested until this exists** — write and deploy the code, live-verify after the key lands. Task 5's **Gemini whole-image path IS testable now** (key already wired, see below).
- **GEMINI_API_KEY (already exists):** AI Studio static key (format `AQ.Ab8…`) passed as `?key=` query param or `x-goog-api-key` header — **NOT** `Authorization: Bearer` (Bearer → 401). Models: `gemini-3.1-flash-image-preview` (image edit), `gemini-2.5-flash` (vision). Set as edge secret `GEMINI_API_KEY` if not already: confirm with `supabase secrets list --project-ref bjbvqvzbzczjbatgmccb`.
- **Proposal loop is non-negotiable (Fable verdict):** NO AI edit ever mutates `carousel_drafts.image_urls` directly. Results are written to a preview path and only committed on explicit "Keep". Original is always the default.
- **Cost cap:** guard against retry-loop spend on `/client` boards (~$0.05/edit) — per-session soft cap in the model (Task 1).
- DRY, YAGNI, TDD, frequent commits. Colocated tests: `lib/<name>.test.ts`, run with `npx vitest run <file>`.

## File Structure

**New — pure logic (TDD core, no network, testable immediately):**
- `lib/imageEditModel.ts` — proposal state machine + version/undo stack + session cost guard.
- `lib/imagePresets.ts` — object-class → preset chips; command-bar free-text → intent.
- `lib/imageEditApi.ts` — request-body builders + thin `supabase.functions.invoke` wrappers for segment/edit.

**New — edge functions:**
- `supabase/functions/img-segment/index.ts` — POST {image_url,x,y} → fal SAM2 → {mask_url,bbox}.
- `supabase/functions/img-edit/index.ts` — POST {image_url, op, mask_url?, prompt?} → fal Flux Fill (masked) | Gemini (whole) → uploads to `post-stills` preview path → {result_url}.

**New — DB + actions:**
- `supabase/migrations/20260704_image_edit_versions.sql` — insert-only version/audit table (avoids ALTER; the outbound guard blocks ALTER/DROP/DELETE).
- `lib/studioActions.ts` — ADD `commitImageEdit()` + `revertImageEdit()` (reuse existing `post-stills` upload/getPublicUrl pattern).

**New — components (`components/dashboard/ImageEditor/`):**
- `ProposalPanel.tsx` — before/after + Keep / Try again / Go back (the safety lever — build FIRST of the components).
- `SelectionCanvas.tsx` — renders image, click-to-segment, mask overlay + dim scrim, brush mode.
- `ActionPopover.tsx` — preset chips + free-text for Erase/Replace/Refine on a selection.
- `CommandBar.tsx` — always-visible whole-image plain-English input.
- `ImageEditorModal.tsx` — shell wiring canvas + popover + command bar + proposal panel + undo, driven by `imageEditModel`.

**Modified:**
- `components/dashboard/CarouselEditor.tsx:513-537` — add "✨ Edit image" button to the control row; mount `ImageEditorModal`.
- `components/ClientBoardPage.tsx` — Phase-2 mount (Task 12, flagged).

**Out of scope (Phase 2, do NOT build here):** code-rendered-card real-layer text editing (double-click exact retype) — requires the 3-lane code-render layout data, which is not present in `carousel_drafts.image_urls` (those are baked image URLs). Needs its own small spec. Drag-to-move objects — same. Auto-flagged fixable spots (vision-QA feed) — strong v1.1, not now.

---

### Task 1: Proposal state machine + version/undo stack (`lib/imageEditModel.ts`)

**Files:**
- Create: `lib/imageEditModel.ts`
- Test: `lib/imageEditModel.test.ts`

**Interfaces:**
- Produces:
  - `type EditPhase = 'idle' | 'segmenting' | 'selected' | 'editing' | 'proposing' | 'error'`
  - `interface Selection { maskUrl: string; bbox: [number,number,number,number]; objectClass?: string }`
  - `interface EditState { phase: EditPhase; imageUrl: string; selection: Selection | null; proposalUrl: string | null; versions: string[]; error: string | null; editCount: number }`
  - `function initEditState(imageUrl: string): EditState`
  - `function onSegmentStart(s: EditState): EditState`
  - `function onSegmented(s: EditState, sel: Selection): EditState`
  - `function onEditStart(s: EditState): EditState`
  - `function onProposal(s: EditState, proposalUrl: string): EditState`
  - `function onKeep(s: EditState): EditState`  // commits proposal → imageUrl, pushes prior onto versions, clears selection/proposal, phase 'idle'
  - `function onTryAgain(s: EditState): EditState` // discard proposal, back to 'selected' (or 'idle' if whole-image), keep selection
  - `function onGoBack(s: EditState): EditState`   // discard proposal, back to 'idle', keep selection cleared
  - `function onUndo(s: EditState): EditState`      // pop versions → imageUrl
  - `function onError(s: EditState, msg: string): EditState`
  - `function canUndo(s: EditState): boolean`
  - `const MAX_EDITS_PER_SESSION = 40`
  - `function overCostCap(s: EditState): boolean` // editCount >= MAX_EDITS_PER_SESSION

- [ ] **Step 1: Write the failing test**

```ts
// lib/imageEditModel.test.ts
import { describe, it, expect } from 'vitest';
import {
  initEditState, onSegmentStart, onSegmented, onEditStart, onProposal,
  onKeep, onTryAgain, onGoBack, onUndo, onError, canUndo, overCostCap,
  MAX_EDITS_PER_SESSION,
} from './imageEditModel';

const sel = { maskUrl: 'https://x/mask.png', bbox: [10, 10, 50, 50] as [number,number,number,number], objectClass: 'laptop' };

describe('imageEditModel proposal machine', () => {
  it('starts idle with the original image and no versions', () => {
    const s = initEditState('https://x/orig.png');
    expect(s.phase).toBe('idle');
    expect(s.imageUrl).toBe('https://x/orig.png');
    expect(s.versions).toEqual([]);
    expect(canUndo(s)).toBe(false);
  });

  it('segment → selected carries the selection', () => {
    let s = onSegmentStart(initEditState('o'));
    expect(s.phase).toBe('segmenting');
    s = onSegmented(s, sel);
    expect(s.phase).toBe('selected');
    expect(s.selection?.objectClass).toBe('laptop');
  });

  it('edit → proposing holds proposalUrl without touching imageUrl', () => {
    let s = onSegmented(onSegmentStart(initEditState('orig')), sel);
    s = onEditStart(s);
    expect(s.phase).toBe('editing');
    s = onProposal(s, 'https://x/prop.png');
    expect(s.phase).toBe('proposing');
    expect(s.proposalUrl).toBe('https://x/prop.png');
    expect(s.imageUrl).toBe('orig'); // NOT mutated yet — the safety promise
  });

  it('Keep commits proposal and pushes the prior image onto versions', () => {
    let s = onProposal(onEditStart(onSegmented(onSegmentStart(initEditState('orig')), sel)), 'prop');
    s = onKeep(s);
    expect(s.imageUrl).toBe('prop');
    expect(s.versions).toEqual(['orig']);
    expect(s.proposalUrl).toBeNull();
    expect(s.selection).toBeNull();
    expect(s.phase).toBe('idle');
    expect(s.editCount).toBe(1);
  });

  it('Try again discards the proposal but keeps the selection', () => {
    let s = onProposal(onEditStart(onSegmented(onSegmentStart(initEditState('orig')), sel)), 'prop');
    s = onTryAgain(s);
    expect(s.imageUrl).toBe('orig');
    expect(s.proposalUrl).toBeNull();
    expect(s.selection).not.toBeNull();
    expect(s.phase).toBe('selected');
  });

  it('Go back discards proposal and clears selection to idle', () => {
    let s = onProposal(onEditStart(onSegmented(onSegmentStart(initEditState('orig')), sel)), 'prop');
    s = onGoBack(s);
    expect(s.imageUrl).toBe('orig');
    expect(s.selection).toBeNull();
    expect(s.phase).toBe('idle');
  });

  it('Undo pops the version stack back onto imageUrl', () => {
    let s = onKeep(onProposal(onEditStart(onSegmented(onSegmentStart(initEditState('orig')), sel)), 'prop'));
    expect(canUndo(s)).toBe(true);
    s = onUndo(s);
    expect(s.imageUrl).toBe('orig');
    expect(s.versions).toEqual([]);
  });

  it('error sets phase error with message', () => {
    const s = onError(initEditState('o'), 'fal 500');
    expect(s.phase).toBe('error');
    expect(s.error).toBe('fal 500');
  });

  it('cost cap trips at the session max', () => {
    const s = { ...initEditState('o'), editCount: MAX_EDITS_PER_SESSION };
    expect(overCostCap(s)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/imageEditModel.test.ts`
Expected: FAIL — "Cannot find module './imageEditModel'".

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/imageEditModel.ts
export type EditPhase = 'idle' | 'segmenting' | 'selected' | 'editing' | 'proposing' | 'error';

export interface Selection {
  maskUrl: string;
  bbox: [number, number, number, number];
  objectClass?: string;
}

export interface EditState {
  phase: EditPhase;
  imageUrl: string;
  selection: Selection | null;
  proposalUrl: string | null;
  versions: string[];
  error: string | null;
  editCount: number;
}

export const MAX_EDITS_PER_SESSION = 40;

export function initEditState(imageUrl: string): EditState {
  return { phase: 'idle', imageUrl, selection: null, proposalUrl: null, versions: [], error: null, editCount: 0 };
}

export function onSegmentStart(s: EditState): EditState {
  return { ...s, phase: 'segmenting', error: null };
}

export function onSegmented(s: EditState, sel: Selection): EditState {
  return { ...s, phase: 'selected', selection: sel };
}

export function onEditStart(s: EditState): EditState {
  return { ...s, phase: 'editing', error: null };
}

export function onProposal(s: EditState, proposalUrl: string): EditState {
  return { ...s, phase: 'proposing', proposalUrl }; // imageUrl deliberately untouched
}

export function onKeep(s: EditState): EditState {
  if (!s.proposalUrl) return s;
  return {
    ...s,
    imageUrl: s.proposalUrl,
    versions: [...s.versions, s.imageUrl],
    proposalUrl: null,
    selection: null,
    phase: 'idle',
    editCount: s.editCount + 1,
  };
}

export function onTryAgain(s: EditState): EditState {
  return { ...s, proposalUrl: null, phase: s.selection ? 'selected' : 'idle' };
}

export function onGoBack(s: EditState): EditState {
  return { ...s, proposalUrl: null, selection: null, phase: 'idle' };
}

export function onUndo(s: EditState): EditState {
  if (s.versions.length === 0) return s;
  const versions = [...s.versions];
  const prev = versions.pop()!;
  return { ...s, imageUrl: prev, versions, phase: 'idle', selection: null, proposalUrl: null };
}

export function onError(s: EditState, msg: string): EditState {
  return { ...s, phase: 'error', error: msg };
}

export function canUndo(s: EditState): boolean {
  return s.versions.length > 0;
}

export function overCostCap(s: EditState): boolean {
  return s.editCount >= MAX_EDITS_PER_SESSION;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/imageEditModel.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/imageEditModel.ts lib/imageEditModel.test.ts
git commit -m "feat(img-editor): proposal state machine + version/undo stack"
```

---

### Task 2: Preset chips + command-bar intent (`lib/imagePresets.ts`)

**Files:**
- Create: `lib/imagePresets.ts`
- Test: `lib/imagePresets.test.ts`

**Interfaces:**
- Produces:
  - `interface Chip { label: string; prompt: string; op: 'erase' | 'replace' | 'refine' }`
  - `function chipsForClass(objectClass: string | undefined): Chip[]` — 3–4 contextual chips; falls back to a generic set for unknown/undefined class. Always includes an Erase chip.
  - `interface CommandIntent { op: 'refine'; prompt: string; wholeImage: true }`
  - `function parseCommand(text: string): CommandIntent | null` — trims; returns null for empty/whitespace; otherwise a whole-image refine intent carrying the raw text.

- [ ] **Step 1: Write the failing test**

```ts
// lib/imagePresets.test.ts
import { describe, it, expect } from 'vitest';
import { chipsForClass, parseCommand } from './imagePresets';

describe('chipsForClass', () => {
  it('gives laptop-specific chips including an erase and a replace', () => {
    const chips = chipsForClass('laptop');
    expect(chips.length).toBeGreaterThanOrEqual(3);
    expect(chips.some(c => c.op === 'erase')).toBe(true);
    expect(chips.some(c => c.op === 'replace')).toBe(true);
    expect(chips.map(c => c.label.toLowerCase()).join(' ')).toContain('remove');
  });
  it('falls back to a generic set for unknown class and still has an erase', () => {
    const chips = chipsForClass(undefined);
    expect(chips.length).toBeGreaterThanOrEqual(3);
    expect(chips.some(c => c.op === 'erase')).toBe(true);
  });
});

describe('parseCommand', () => {
  it('returns null for empty / whitespace', () => {
    expect(parseCommand('')).toBeNull();
    expect(parseCommand('   ')).toBeNull();
  });
  it('wraps free text as a whole-image refine intent', () => {
    const i = parseCommand('  make it warmer ');
    expect(i).toEqual({ op: 'refine', prompt: 'make it warmer', wholeImage: true });
  });
});
```

- [ ] **Step 2: Run** `npx vitest run lib/imagePresets.test.ts` → FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/imagePresets.ts
export interface Chip { label: string; prompt: string; op: 'erase' | 'replace' | 'refine'; }
export interface CommandIntent { op: 'refine'; prompt: string; wholeImage: true; }

const GENERIC: Chip[] = [
  { label: 'Remove it', prompt: 'remove this object cleanly and fill the background naturally', op: 'erase' },
  { label: 'Make it brighter', prompt: 'brighten this region', op: 'refine' },
  { label: 'Different color', prompt: 'change the color of this object', op: 'replace' },
  { label: 'Replace with…', prompt: '', op: 'replace' },
];

const BY_CLASS: Record<string, Chip[]> = {
  laptop: [
    { label: 'Remove the laptop', prompt: 'remove the laptop cleanly and fill the surface naturally', op: 'erase' },
    { label: 'Different laptop', prompt: 'replace with a modern laptop', op: 'replace' },
    { label: 'Close the lid', prompt: 'show the laptop with its lid closed', op: 'refine' },
    { label: 'Replace with…', prompt: '', op: 'replace' },
  ],
  person: [
    { label: 'Remove them', prompt: 'remove this person cleanly and reconstruct the background', op: 'erase' },
    { label: 'Change the shirt', prompt: 'change the shirt color', op: 'refine' },
    { label: 'Replace with…', prompt: '', op: 'replace' },
  ],
  text: [
    { label: 'Remove this text', prompt: 'remove this text and fill the background', op: 'erase' },
    { label: 'Make it bolder', prompt: 'make this text bolder and higher contrast', op: 'refine' },
    { label: 'Replace with…', prompt: '', op: 'replace' },
  ],
};

export function chipsForClass(objectClass: string | undefined): Chip[] {
  if (!objectClass) return GENERIC;
  return BY_CLASS[objectClass.toLowerCase()] ?? GENERIC;
}

export function parseCommand(text: string): CommandIntent | null {
  const prompt = text.trim();
  if (!prompt) return null;
  return { op: 'refine', prompt, wholeImage: true };
}
```

- [ ] **Step 4: Run** `npx vitest run lib/imagePresets.test.ts` → PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/imagePresets.ts lib/imagePresets.test.ts
git commit -m "feat(img-editor): preset chips per object class + command-bar intent"
```

---

### Task 3: API client + request builders (`lib/imageEditApi.ts`)

**Files:**
- Create: `lib/imageEditApi.ts`
- Test: `lib/imageEditApi.test.ts`

**Interfaces:**
- Consumes: `supabase` from `./supabase`; `Selection` (Task 1).
- Produces:
  - `interface SegmentReq { image_url: string; x: number; y: number }`
  - `interface EditReq { image_url: string; op: 'erase'|'replace'|'refine'; mask_url?: string; prompt?: string; whole_image?: boolean; draft_id: string }`
  - `function buildSegmentReq(imageUrl: string, x: number, y: number): SegmentReq`
  - `function buildEditReq(a: {imageUrl:string; op:'erase'|'replace'|'refine'; maskUrl?:string; prompt?:string; wholeImage?:boolean; draftId:string}): EditReq`
  - `async function segmentAt(req: SegmentReq): Promise<{maskUrl:string; bbox:[number,number,number,number]; objectClass?:string}>`
  - `async function editImage(req: EditReq): Promise<{resultUrl:string}>`
  (The two async fns call `supabase.functions.invoke('img-segment'|'img-edit', { body })` and normalize the response; the builders are the unit-tested pure part.)

- [ ] **Step 1: Write the failing test** (builders only — network fns are covered by edge-fn tests + manual)

```ts
// lib/imageEditApi.test.ts
import { describe, it, expect } from 'vitest';
import { buildSegmentReq, buildEditReq } from './imageEditApi';

describe('request builders', () => {
  it('buildSegmentReq rounds coordinates to integers', () => {
    expect(buildSegmentReq('u', 12.6, 40.2)).toEqual({ image_url: 'u', x: 13, y: 40 });
  });
  it('buildEditReq for a masked erase omits whole_image and carries mask', () => {
    const r = buildEditReq({ imageUrl: 'u', op: 'erase', maskUrl: 'm', draftId: 'd' });
    expect(r).toEqual({ image_url: 'u', op: 'erase', mask_url: 'm', draft_id: 'd' });
    expect('whole_image' in r).toBe(false);
  });
  it('buildEditReq for a whole-image refine sets whole_image true and no mask', () => {
    const r = buildEditReq({ imageUrl: 'u', op: 'refine', prompt: 'warmer', wholeImage: true, draftId: 'd' });
    expect(r).toEqual({ image_url: 'u', op: 'refine', prompt: 'warmer', whole_image: true, draft_id: 'd' });
  });
});
```

- [ ] **Step 2: Run** `npx vitest run lib/imageEditApi.test.ts` → FAIL.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/imageEditApi.ts
import { supabase } from './supabase';

export interface SegmentReq { image_url: string; x: number; y: number; }
export interface EditReq {
  image_url: string;
  op: 'erase' | 'replace' | 'refine';
  mask_url?: string;
  prompt?: string;
  whole_image?: boolean;
  draft_id: string;
}

export function buildSegmentReq(imageUrl: string, x: number, y: number): SegmentReq {
  return { image_url: imageUrl, x: Math.round(x), y: Math.round(y) };
}

export function buildEditReq(a: {
  imageUrl: string; op: 'erase' | 'replace' | 'refine';
  maskUrl?: string; prompt?: string; wholeImage?: boolean; draftId: string;
}): EditReq {
  const req: EditReq = { image_url: a.imageUrl, op: a.op, draft_id: a.draftId };
  if (a.maskUrl) req.mask_url = a.maskUrl;
  if (a.prompt) req.prompt = a.prompt;
  if (a.wholeImage) req.whole_image = true;
  return req;
}

export async function segmentAt(req: SegmentReq) {
  const { data, error } = await supabase.functions.invoke('img-segment', { body: req });
  if (error) throw new Error(error.message || 'segment failed');
  if (!data?.mask_url) throw new Error(data?.error || 'no mask returned');
  return {
    maskUrl: data.mask_url as string,
    bbox: data.bbox as [number, number, number, number],
    objectClass: data.object_class as string | undefined,
  };
}

export async function editImage(req: EditReq) {
  const { data, error } = await supabase.functions.invoke('img-edit', { body: req });
  if (error) throw new Error(error.message || 'edit failed');
  if (!data?.result_url) throw new Error(data?.error || 'no result returned');
  return { resultUrl: data.result_url as string };
}
```

- [ ] **Step 4: Run** `npx vitest run lib/imageEditApi.test.ts` → PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/imageEditApi.ts lib/imageEditApi.test.ts
git commit -m "feat(img-editor): edge-fn client + request builders"
```

---

### Task 4: `img-segment` edge function (fal.ai SAM2)

**Files:**
- Create: `supabase/functions/img-segment/index.ts`

**Interfaces:**
- Consumes: request `{ image_url, x, y }`.
- Produces: `{ mask_url: string, bbox: [x,y,w,h], object_class?: string }` on 200; `{ error }` on 4xx/5xx.

**External-API note (confirm at build time when FAL_KEY lands):** fal.ai serves models over REST at `https://fal.run/<model-id>` with header `Authorization: Key ${FAL_KEY}`. Use the SAM2 point-prompt model — current slug `fal-ai/sam2/image` (verify exact slug + input schema at fal.ai/models/fal-ai/sam2 when the key exists; fal returns `{ image_url }` for the mask or an array of masks). This is genuine external-schema verification, not a placeholder — the code below is written to the documented shape and isolates the slug + response-parse in two clearly marked spots.

- [ ] **Step 1: Write the function**

```ts
// supabase/functions/img-segment/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey",
  "Access-Control-Max-Age": "86400",
  "Content-Type": "application/json",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

// --- fal slug (verify at fal.ai/models when FAL_KEY exists) ---
const FAL_SEGMENT_MODEL = "fal-ai/sam2/image";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const FAL_KEY = Deno.env.get("FAL_KEY");
  if (!FAL_KEY) return json({ error: "FAL_KEY not configured" }, 503);

  let body: { image_url?: string; x?: number; y?: number };
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const { image_url, x, y } = body;
  if (!image_url || typeof x !== "number" || typeof y !== "number") {
    return json({ error: "image_url, x, y required" }, 400);
  }

  try {
    const falRes = await fetch(`https://fal.run/${FAL_SEGMENT_MODEL}`, {
      method: "POST",
      headers: { "Authorization": `Key ${FAL_KEY}`, "Content-Type": "application/json" },
      // point-prompt input — confirm schema at fal.ai/models
      body: JSON.stringify({ image_url, prompts: [{ x, y, label: 1 }] }),
    });
    if (!falRes.ok) {
      const t = await falRes.text();
      return json({ error: `fal ${falRes.status}`, detail: t.slice(0, 500) }, 502);
    }
    const out = await falRes.json();
    // --- response parse (verify shape at fal.ai/models) ---
    const maskUrl: string | undefined = out?.image_url ?? out?.masks?.[0]?.url ?? out?.combined_mask?.url;
    if (!maskUrl) return json({ error: "fal returned no mask", raw: out }, 502);
    const bbox = out?.bbox ?? out?.masks?.[0]?.bbox ?? [x, y, 0, 0];
    return json({ mask_url: maskUrl, bbox, object_class: out?.object_class });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
```

- [ ] **Step 2: Deploy**

Run: `supabase functions deploy img-segment --project-ref bjbvqvzbzczjbatgmccb`
Expected: "Deployed Function img-segment".

- [ ] **Step 3: Verify the 503 guard works WITHOUT the key (testable now)**

Run:
```bash
curl -s -X POST "https://bjbvqvzbzczjbatgmccb.supabase.co/functions/v1/img-segment" \
  -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY" -H "content-type: application/json" \
  -d '{"image_url":"https://example.com/a.png","x":10,"y":10}'
```
Expected (until FAL_KEY set): `{"error":"FAL_KEY not configured"}` with 503. This confirms the function is live and the guard fires.

- [ ] **Step 4: GATED live test (AFTER Ivan provisions FAL_KEY)**

After `supabase secrets set FAL_KEY=<value> --project-ref bjbvqvzbzczjbatgmccb`, re-run the Step-3 curl with a real public `image_url` and a point on a known object. Expected: `{ "mask_url": "https://fal...", "bbox":[...] }`. If the parse fails, adjust the two marked spots to fal's actual response shape.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/img-segment/index.ts
git commit -m "feat(img-editor): img-segment edge fn (fal SAM2 point->mask)"
```

---

### Task 5: `img-edit` edge function (fal Flux Fill masked + Gemini whole-image)

**Files:**
- Create: `supabase/functions/img-edit/index.ts`

**Interfaces:**
- Consumes: `{ image_url, op, mask_url?, prompt?, whole_image?, draft_id }`.
- Produces: `{ result_url: string }` — a PREVIEW URL in `post-stills` under `${draft_id}/_edit_preview/<ts>.png` (NOT committed to the draft; the frontend commits on Keep). `{ error }` on failure.

**Routing:** `whole_image === true` OR no `mask_url` → **Gemini 3.1 flash-image** mask-free (testable now). `mask_url` present → **fal Flux Fill** masked inpaint (gated on FAL_KEY).

**External-API notes:**
- Gemini image edit: `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${GEMINI_API_KEY}` — body `{ contents:[{ parts:[{ inline_data:{ mime_type, data: <base64 of source image> } }, { text: <edit prompt> }] }] }`. Response image is base64 in `candidates[0].content.parts[].inline_data.data`. Key via `?key=`, NOT Bearer.
- fal Flux Fill (masked inpaint): `https://fal.run/fal-ai/flux-lora-fill` (or current inpaint slug — verify at fal.ai/models) with `{ image_url, mask_url, prompt }`, header `Authorization: Key ${FAL_KEY}`; returns `{ images:[{ url }] }`.

- [ ] **Step 1: Write the function**

```ts
// supabase/functions/img-edit/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey",
  "Access-Control-Max-Age": "86400",
  "Content-Type": "application/json",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

const FAL_INPAINT_MODEL = "fal-ai/flux-lora-fill"; // verify slug at fal.ai/models
const GEMINI_MODEL = "gemini-3.1-flash-image-preview";

async function fetchAsBase64(url: string): Promise<{ b64: string; mime: string }> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`fetch source ${r.status}`);
  const mime = r.headers.get("content-type") || "image/png";
  const buf = new Uint8Array(await r.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
  return { b64: btoa(bin), mime };
}

function opToPrompt(op: string, prompt?: string): string {
  if (prompt && prompt.trim()) return prompt.trim();
  if (op === "erase") return "remove the selected object and fill the area naturally to match the surroundings";
  return "improve the selected region";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let body: { image_url?: string; op?: string; mask_url?: string; prompt?: string; whole_image?: boolean; draft_id?: string };
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const { image_url, op = "refine", mask_url, prompt, whole_image, draft_id } = body;
  if (!image_url || !draft_id) return json({ error: "image_url and draft_id required" }, 400);

  const useGemini = whole_image === true || !mask_url;

  try {
    let resultBytes: Uint8Array;

    if (useGemini) {
      const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
      if (!GEMINI_API_KEY) return json({ error: "GEMINI_API_KEY not configured" }, 503);
      const { b64, mime } = await fetchAsBase64(image_url);
      const gRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [
              { inline_data: { mime_type: mime, data: b64 } },
              { text: opToPrompt(op, prompt) },
            ] }],
          }),
        },
      );
      if (!gRes.ok) return json({ error: `gemini ${gRes.status}`, detail: (await gRes.text()).slice(0, 500) }, 502);
      const g = await gRes.json();
      const part = g?.candidates?.[0]?.content?.parts?.find((p: any) => p?.inline_data?.data);
      if (!part) return json({ error: "gemini returned no image", raw: g }, 502);
      resultBytes = Uint8Array.from(atob(part.inline_data.data), (c) => c.charCodeAt(0));
    } else {
      const FAL_KEY = Deno.env.get("FAL_KEY");
      if (!FAL_KEY) return json({ error: "FAL_KEY not configured" }, 503);
      const falRes = await fetch(`https://fal.run/${FAL_INPAINT_MODEL}`, {
        method: "POST",
        headers: { "Authorization": `Key ${FAL_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ image_url, mask_url, prompt: opToPrompt(op, prompt) }),
      });
      if (!falRes.ok) return json({ error: `fal ${falRes.status}`, detail: (await falRes.text()).slice(0, 500) }, 502);
      const out = await falRes.json();
      const url: string | undefined = out?.images?.[0]?.url ?? out?.image?.url;
      if (!url) return json({ error: "fal returned no image", raw: out }, 502);
      const rb = await fetch(url);
      resultBytes = new Uint8Array(await rb.arrayBuffer());
    }

    // upload PREVIEW (not committed) to post-stills
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const path = `${draft_id}/_edit_preview/${Date.now()}.png`;
    const up = await supa.storage.from("post-stills").upload(path, resultBytes, { upsert: true, contentType: "image/png" });
    if (up.error) return json({ error: `upload ${up.error.message}` }, 500);
    const { data: pub } = supa.storage.from("post-stills").getPublicUrl(path);
    return json({ result_url: pub.publicUrl });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
```

- [ ] **Step 2: Deploy**

Run: `supabase functions deploy img-edit --project-ref bjbvqvzbzczjbatgmccb`
Expected: "Deployed Function img-edit".

- [ ] **Step 3: Live-test the Gemini whole-image path (TESTABLE NOW — no FAL_KEY needed)**

Confirm `GEMINI_API_KEY` is set: `supabase secrets list --project-ref bjbvqvzbzczjbatgmccb` (if absent, `supabase secrets set GEMINI_API_KEY=<the AI Studio key> --project-ref bjbvqvzbzczjbatgmccb`). Then:
```bash
curl -s -X POST "https://bjbvqvzbzczjbatgmccb.supabase.co/functions/v1/img-edit" \
  -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY" -H "content-type: application/json" \
  -d '{"image_url":"<a real public post-stills image url>","op":"refine","prompt":"make it warmer","whole_image":true,"draft_id":"<a real draft id>"}'
```
Expected: `{ "result_url": "https://bjbvqvzbzczjbatgmccb.supabase.co/storage/v1/object/public/post-stills/<draft_id>/_edit_preview/....png" }`. Open the URL — it should be the source image, warmer. This proves the whole pipeline minus fal.

- [ ] **Step 4: GATED — fal masked path (AFTER FAL_KEY)**

Re-run Step 3 with `mask_url` (from Task 4) and no `whole_image`. Expected: masked-inpaint result. Adjust `FAL_INPAINT_MODEL` slug / response parse if fal's schema differs.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/img-edit/index.ts
git commit -m "feat(img-editor): img-edit edge fn (fal Flux Fill masked + Gemini whole-image, preview-only)"
```

---

### Task 6: Version table + commit/revert actions

**Files:**
- Create: `supabase/migrations/20260704_image_edit_versions.sql`
- Modify: `lib/studioActions.ts` (add `commitImageEdit`, `revertImageEdit`)
- Test: `lib/imageEditCommit.test.ts` (pure index-swap helper)

**Interfaces:**
- Produces:
  - table `image_edit_versions(id uuid pk, draft_id text, image_index int, prev_url text, new_url text, op text, prompt text, created_at timestamptz default now())`
  - `function replaceAt(urls: string[], index: number, url: string): string[]` (pure, exported from studioActions or a small helper — TDD this)
  - `async function commitImageEdit(a: {draftId:string; imageUrls:string[]; index:number; newUrl:string; op:string; prompt?:string}): Promise<string[]>` — inserts a version row, patches `carousel_drafts.image_urls` with the new url at `index`, returns the new array.
  - `async function revertImageEdit(a: {draftId:string; imageUrls:string[]; index:number; prevUrl:string}): Promise<string[]>` — patches back to prevUrl (undo), returns new array. (Does not delete the version row — audit stays.)

**Migration note:** use `CREATE TABLE IF NOT EXISTS` (the outbound guard blocks ALTER/DROP/DELETE — a fresh insert-only table sidesteps that; do NOT ALTER `carousel_drafts`). Apply via `mcp__claude_ai_Supabase__apply_migration`.

- [ ] **Step 1: Write the failing test for the pure helper**

```ts
// lib/imageEditCommit.test.ts
import { describe, it, expect } from 'vitest';
import { replaceAt } from './studioActions';

describe('replaceAt', () => {
  it('swaps the url at the given index, leaving others intact', () => {
    expect(replaceAt(['a', 'b', 'c'], 1, 'B')).toEqual(['a', 'B', 'c']);
  });
  it('handles a single-image array', () => {
    expect(replaceAt(['only'], 0, 'new')).toEqual(['new']);
  });
  it('is a no-op clone when index is out of range', () => {
    const src = ['a', 'b'];
    const out = replaceAt(src, 5, 'x');
    expect(out).toEqual(['a', 'b']);
    expect(out).not.toBe(src);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run lib/imageEditCommit.test.ts` → FAIL (`replaceAt` not exported).

- [ ] **Step 3: Write the migration**

```sql
-- supabase/migrations/20260704_image_edit_versions.sql
create table if not exists public.image_edit_versions (
  id uuid primary key default gen_random_uuid(),
  draft_id text not null,
  image_index int not null default 0,
  prev_url text,
  new_url text not null,
  op text,
  prompt text,
  created_at timestamptz not null default now()
);
create index if not exists image_edit_versions_draft_idx on public.image_edit_versions (draft_id, created_at desc);
```

Apply it (via the Supabase MCP `apply_migration`, name `image_edit_versions`).

- [ ] **Step 4: Add the helpers to `lib/studioActions.ts`**

```ts
// add near the other exports in lib/studioActions.ts
export function replaceAt(urls: string[], index: number, url: string): string[] {
  const out = [...urls];
  if (index >= 0 && index < out.length) out[index] = url;
  return out;
}

export async function commitImageEdit(a: {
  draftId: string; imageUrls: string[]; index: number; newUrl: string; op: string; prompt?: string;
}): Promise<string[]> {
  const { supabase } = await import('./supabase');
  const next = replaceAt(a.imageUrls, a.index, a.newUrl);
  await supabase.from('image_edit_versions').insert({
    draft_id: a.draftId, image_index: a.index,
    prev_url: a.imageUrls[a.index] ?? null, new_url: a.newUrl, op: a.op, prompt: a.prompt ?? null,
  });
  const { error } = await supabase.from('carousel_drafts').update({ image_urls: next }).eq('id', a.draftId);
  if (error) throw new Error(error.message);
  return next;
}

export async function revertImageEdit(a: {
  draftId: string; imageUrls: string[]; index: number; prevUrl: string;
}): Promise<string[]> {
  const { supabase } = await import('./supabase');
  const next = replaceAt(a.imageUrls, a.index, a.prevUrl);
  const { error } = await supabase.from('carousel_drafts').update({ image_urls: next }).eq('id', a.draftId);
  if (error) throw new Error(error.message);
  return next;
}
```

- [ ] **Step 5: Run** `npx vitest run lib/imageEditCommit.test.ts` → PASS (3 tests). Commit.

```bash
git add supabase/migrations/20260704_image_edit_versions.sql lib/studioActions.ts lib/imageEditCommit.test.ts
git commit -m "feat(img-editor): image_edit_versions table + commit/revert actions"
```

---

### Task 7: `ProposalPanel` component (the safety lever — build first)

**Files:**
- Create: `components/dashboard/ImageEditor/ProposalPanel.tsx`

**Interfaces:**
- Consumes: none from earlier tasks (pure presentational).
- Produces:
  - `interface ProposalPanelProps { beforeUrl: string; afterUrl: string; busy?: boolean; onKeep: () => void; onTryAgain: () => void; onGoBack: () => void; wholeImageHint?: boolean }`
  - default export `ProposalPanel(props): JSX.Element`

**Design:** side-by-side before/after (stacked on mobile), captions "Before" / "After". Three buttons: **Keep** (primary, `bg-[var(--ds-accent)] text-white`), **Try again** (secondary outline), **Go back** (ghost). If `wholeImageHint`, show a small line "This changes the whole image." `Go back` is the default/escape (also wire Esc in the modal). Min tap target 44px (`min-h-[44px]`). Use only `var(--ds-*)` tokens / census-safe classes.

- [ ] **Step 1: Write the component**

```tsx
// components/dashboard/ImageEditor/ProposalPanel.tsx
import React from 'react';

export interface ProposalPanelProps {
  beforeUrl: string;
  afterUrl: string;
  busy?: boolean;
  onKeep: () => void;
  onTryAgain: () => void;
  onGoBack: () => void;
  wholeImageHint?: boolean;
}

export default function ProposalPanel(props: ProposalPanelProps) {
  const { beforeUrl, afterUrl, busy, onKeep, onTryAgain, onGoBack, wholeImageHint } = props;
  return (
    <div className="rounded-[var(--ds-radius)] border border-[var(--ds-line)] bg-[var(--ds-card)] p-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <figure className="m-0">
          <img src={beforeUrl} alt="Before" className="w-full rounded-[var(--ds-radius)] border border-[var(--ds-line)] object-contain" />
          <figcaption className="mt-1 text-xs text-[var(--ds-dim)]">Before</figcaption>
        </figure>
        <figure className="m-0">
          <img src={afterUrl} alt="After" className="w-full rounded-[var(--ds-radius)] border border-[var(--ds-line)] object-contain" />
          <figcaption className="mt-1 text-xs text-[var(--ds-dim)]">After</figcaption>
        </figure>
      </div>
      {wholeImageHint && (
        <p className="mt-2 text-xs text-[var(--ds-warn)]">This changes the whole image, not just one spot.</p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={onKeep} disabled={busy}
          className="min-h-[44px] px-4 rounded-[var(--ds-radius)] bg-[var(--ds-accent)] text-white font-medium disabled:opacity-50 hover:bg-[var(--ds-accent-hover)]">
          Keep
        </button>
        <button onClick={onTryAgain} disabled={busy}
          className="min-h-[44px] px-4 rounded-[var(--ds-radius)] border border-[var(--ds-line)] text-[var(--ds-ink)] disabled:opacity-50 hover:bg-[var(--ds-bg)]">
          Try again
        </button>
        <button onClick={onGoBack} disabled={busy}
          className="min-h-[44px] px-4 rounded-[var(--ds-radius)] text-[var(--ds-dim)] disabled:opacity-50 hover:bg-[var(--ds-bg)]">
          Go back
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Census**

Run: `node scripts/lightshim-census.mjs; echo "census exit $?"`
Expected: `{"usedCount":N,"missing":[]}` then `census exit 0`. If any new class is flagged, add its shim to `components/dashboard-v2/theme/light.css` and re-run.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/ImageEditor/ProposalPanel.tsx components/dashboard-v2/theme/light.css
git commit -m "feat(img-editor): ProposalPanel (before/after + Keep/Try-again/Go-back)"
```

---

### Task 8: `SelectionCanvas` component (image + click-to-segment + mask overlay + brush)

**Files:**
- Create: `components/dashboard/ImageEditor/SelectionCanvas.tsx`

**Interfaces:**
- Consumes: `Selection` (Task 1); `buildSegmentReq`, `segmentAt` (Task 3).
- Produces:
  - `interface SelectionCanvasProps { imageUrl: string; mode: 'click' | 'brush'; selection: Selection | null; busy?: boolean; onSegmentStart: () => void; onSegmented: (sel: Selection) => void; onError: (msg: string) => void; brushMaskRef?: React.MutableRefObject<HTMLCanvasElement | null> }`
  - default export `SelectionCanvas(props): JSX.Element`

**Behavior:** renders `<img>` (via existing Drive-safe `toImgSrc` inline pattern from CarouselEditor:209-212 — copy it locally). In `click` mode, an overlay captures clicks; on click, compute natural-image coordinates from the click rect, call `onSegmentStart()` then `segmentAt(buildSegmentReq(imageUrl, natX, natY))`, and on success call `onSegmented(sel)`; on failure `onError`. When `selection` set, draw the returned mask (`<img src={selection.maskUrl}>` as a positioned overlay with `mix-blend` highlight) and dim the rest with a scrim so the region-lock reads visually. In `brush` mode, expose a `<canvas>` the user paints on (white = mask) via pointer events, and hand the canvas up through `brushMaskRef` for the modal to export as a mask blob. Show a "finding edges…" state while `busy`.

*(Component is UI-heavy; implementer fleshes out pointer math and overlay positioning, then self-tests with the playwright-driver skill against a local dev image. Contract above is binding.)*

- [ ] **Step 1: Implement per the contract** (copy `toImgSrc` from `CarouselEditor.tsx:209-212`; use `var(--ds-*)` classes only; overlay uses absolute positioning over a `position:relative` wrapper sized to the rendered image).
- [ ] **Step 2: Self-test** with playwright-driver Mode 1 against a local dev route rendering the modal with a sample image; confirm 0 console errors and that a click enters the segmenting state (mock `segmentAt` if no FAL_KEY by temporarily pointing at a static mask, or test post-FAL_KEY).
- [ ] **Step 3: Census** `node scripts/lightshim-census.mjs; echo "census exit $?"` → exit 0.
- [ ] **Step 4: Commit** `git commit -m "feat(img-editor): SelectionCanvas (click-segment + mask overlay + brush)"`

---

### Task 9: `ActionPopover` + `CommandBar`

**Files:**
- Create: `components/dashboard/ImageEditor/ActionPopover.tsx`
- Create: `components/dashboard/ImageEditor/CommandBar.tsx`

**Interfaces:**
- Consumes: `chipsForClass`, `parseCommand`, `Chip` (Task 2).
- Produces:
  - `interface ActionPopoverProps { objectClass?: string; busy?: boolean; onAction: (a: { op:'erase'|'replace'|'refine'; prompt: string }) => void; onCancel: () => void }` — renders `chipsForClass(objectClass)` as tappable chips (chip with empty `prompt` opens a free-text field); a free-text input + "Apply" always available. Chip click → `onAction({op, prompt})`.
  - `interface CommandBarProps { busy?: boolean; onSubmit: (prompt: string) => void }` — always-visible input + send button; on submit runs `parseCommand`; ignores null; shows a few starter chips ("make it warmer", "more contrast", "simplify this background").

- [ ] **Step 1: Implement both** (census-safe classes, `min-h-[44px]` on inputs/buttons, `var(--ds-*)` tokens).
- [ ] **Step 2: Census** → exit 0.
- [ ] **Step 3: Commit** `git commit -m "feat(img-editor): ActionPopover (chips) + global CommandBar"`

---

### Task 10: `ImageEditorModal` shell (wires everything + undo)

**Files:**
- Create: `components/dashboard/ImageEditor/ImageEditorModal.tsx`

**Interfaces:**
- Consumes: everything above — `imageEditModel` (Task 1), `imageEditApi` (Task 3), `commitImageEdit`/`revertImageEdit` (Task 6), `ProposalPanel` (7), `SelectionCanvas` (8), `ActionPopover`/`CommandBar` (9).
- Produces:
  - `interface ImageEditorModalProps { open: boolean; draftId: string; imageUrls: string[]; index: number; onClose: () => void; onCommitted: (nextUrls: string[]) => void }`
  - default export `ImageEditorModal(props): JSX.Element | null`

**Behavior:** holds `EditState` (from `initEditState(imageUrls[index])`) in `useState`; `mode` ('click'|'brush') toggle; Esc / backdrop → `onGoBack` then close if idle. Flow:
1. Click path: `SelectionCanvas.onSegmented` → `onSegmented(state, sel)`; show `ActionPopover(objectClass=sel.objectClass)`. On action → `onEditStart` → `editImage(buildEditReq({imageUrl, op, maskUrl: sel.maskUrl, prompt, draftId}))` → `onProposal(state, resultUrl)` → render `ProposalPanel(before=state.imageUrl, after=resultUrl)`.
2. Command path: `CommandBar.onSubmit(prompt)` → `onEditStart` → `editImage(buildEditReq({imageUrl, op:'refine', prompt, wholeImage:true, draftId}))` → `onProposal` → `ProposalPanel(..., wholeImageHint)`.
3. `ProposalPanel.onKeep` → `commitImageEdit({draftId, imageUrls, index, newUrl: proposalUrl, op, prompt})` → `onKeep(state)` (local) → `onCommitted(nextUrls)` (parent refreshes). `onTryAgain` → re-run last edit (keep selection). `onGoBack` → `onGoBack(state)`.
4. Undo button visible when `canUndo(state)` → `revertImageEdit(...)` + `onUndo(state)` + `onCommitted`.
5. Guard: if `overCostCap(state)`, disable edit actions and show "You've made a lot of edits this session — reopen to continue." Show a real progress line while `phase==='editing'|'segmenting'` ("repainting that region… ~10s"), not a bare spinner. Show `state.error` inline with a "Try again" affordance when `phase==='error'`.

- [ ] **Step 1: Implement the shell per the flow above.**
- [ ] **Step 2: Self-test** with playwright-driver: render at 1440 + 375, exercise the Gemini command-bar path end-to-end (works without FAL_KEY), confirm proposal panel appears, Keep commits and the parent image updates, 0 console errors. Read the screenshots to verify layout.
- [ ] **Step 3: Census** → exit 0.
- [ ] **Step 4: Commit** `git commit -m "feat(img-editor): ImageEditorModal wiring canvas + popover + command bar + proposal + undo"`

---

### Task 11: Mount in `CarouselEditor`

**Files:**
- Modify: `components/dashboard/CarouselEditor.tsx` (control row `:513-537`; add modal mount near `:870`)

**Interfaces:**
- Consumes: `ImageEditorModal` (Task 10). Uses existing `draft.imageUrls`, `draft.id`, `onChanged`.

**Behavior:** add an "✨ Edit image" button to the existing control row (the block shown when `draft.type !== 'carousel'` at `:513-537`, and ALSO for carousels — enable for any draft with at least one baked image URL, editing `imageUrls[activeIndex]`; for the single-image case index 0). Track `editorOpen` state; on open, mount `<ImageEditorModal open draftId={draft.id} imageUrls={draft.imageUrls} index={activeIndex} onClose={()=>setEditorOpen(false)} onCommitted={()=>{ setEditorOpen(false); onChanged(); }} />`. Reuse the `run(...)` toast wrapper convention for any inline errors. Button disabled when `draft.imageUrls.length === 0` or the draft is a PDF/case-study type.

- [ ] **Step 1: Add the button + state + modal mount.**
- [ ] **Step 2: Self-test** with playwright-driver against a dev draft that has an image: open editor from the button, run a command-bar edit, Keep, confirm the CarouselEditor image refreshes. 0 console errors.
- [ ] **Step 3: Census** → exit 0.
- [ ] **Step 4: Commit** `git commit -m "feat(img-editor): mount editor from CarouselEditor control row"`

---

### Task 12: `/client` board mount (PERSISTED — Ivan decided 2026-07-04)

**Files:**
- Modify: `components/ClientBoardPage.tsx` (image card `Thumb` region `:214-221`, `:659`, `:831`)
- Create: `lib/clientBoardImageActions.ts` (board-scoped commit — distinct from `carousel_drafts`)

**DECISION (Ivan, "make it the best way"): PERSISTED.** Edits on a `/client` board SAVE — a client fixing a garbled number stays fixed on refresh. Board images live on `client_boards.board` items as `media_url`/`cover_url` (NOT `carousel_drafts`), so commit writes back to `client_boards.board` + an `image_edit_versions` row tagged `source:'client_board'`. Per-board cost cap (Global Constraints) is the spend guard since the page is semi-public.

**Interfaces:**
- Produces: `async function commitClientBoardImage(a: {boardId:string; itemId:string; field:'media_url'|'cover_url'; prevUrl:string; newUrl:string; op:string; prompt?:string}): Promise<void>` — reads the `client_boards` row, swaps the item's image field in the `board` jsonb, updates the row, inserts an `image_edit_versions` row (`draft_id` = `boardId+':'+itemId`, `op` prefixed `board:`).

- [ ] **Step 1: Write the failing test** for the pure jsonb-swap helper `swapBoardItemImage(board, itemId, field, url)` in `lib/clientBoardImageActions.test.ts` (finds the queue/library item by id, replaces `field`, returns a new board object; no-op clone if not found).
- [ ] **Step 2:** Run → FAIL. Implement `swapBoardItemImage` (pure) + `commitClientBoardImage` (async, uses it). Run → PASS.
- [ ] **Step 3:** Add an "✨ Edit" affordance on `Thumb` (`:214-221`) that opens `ImageEditorModal` with `onCommitted` wired to `commitClientBoardImage` for the item's `media_url`/`cover_url`. Enforce the per-board cost cap.
- [ ] **Step 4:** Census → exit 0. Self-test the persisted path (edit → Keep → refresh → edit sticks). Commit.

---

## Deferred (explicitly NOT in this plan — future specs)

- **Real-layer text editing for code-rendered cards** (double-click exact retype). The editor here operates on baked image URLs; exact text editing needs the 3-lane code-render layout data (see memory `notebook-carousel-style.md` / `image-visual-strategy-research`), which is not present in `carousel_drafts.image_urls`. Needs its own brainstorm + spec.
- **Drag-to-move objects** (erase + place + relight) — advanced, variable quality.
- **Auto-flagged fixable spots** feeding the existing vision-QA so the editor opens with problems pre-pinned — strong v1.1.
- **Hover-preview of the mask before click; +/- brush to refine the auto-selection.**

## Self-Review

- **Spec coverage:** click-spot region-lock (Tasks 4,8) ✓; Erase/Replace/Refine (Task 5,9) ✓; proposal loop Keep/Try/Back (Tasks 1,7,10) ✓ — the Fable safety lever; preset chips (Tasks 2,9) ✓; global command bar / free-comment no-click (Tasks 2,5,9,10) ✓ — Ivan's addition; latency honesty (Task 10) ✓; cost cap (Tasks 1,10,12) ✓; save-keeps-original + undo (Tasks 1,6,10) ✓; mount everywhere (Tasks 11,12) ✓ — `/client` PERSISTED (Ivan decided). Real-layer text + drag + auto-flag correctly deferred with reasons.
- **Placeholder scan:** the two fal model slugs (`fal-ai/sam2/image`, `fal-ai/flux-lora-fill`) are marked "verify at fal.ai/models when FAL_KEY exists" — this is legitimate external-API verification (fal slugs drift; cannot confirm without the key), isolated to single constants, not a lazy TODO.
- **Type consistency:** `Selection`, `EditState`, `EditReq`, `SegmentReq`, `Chip`, `CommandIntent`, `replaceAt`, `commitImageEdit` names used identically across tasks. `result_url`/`mask_url`/`bbox`/`object_class` snake_case at the edge boundary → camelCased in `imageEditApi` (`resultUrl`/`maskUrl`/`objectClass`) consistently.
- **Ordering:** pure logic (1–3) → edge fns (4–5) → DB/actions (6) → components leaf-first (7 ProposalPanel, 8 canvas, 9 popover/bar) → shell (10) → mount (11) → gated `/client` (12). Tasks 1–3, 6-pure, 7, 9 are fully testable/censusable with NO key; Task 5 Gemini path and the whole UI flow are testable now; only Task 4 and Task 5's fal branch need FAL_KEY for live verification.

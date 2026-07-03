# Content Studio Phase 5 · Item 1 — Style thumbnails + usage (real subset)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Give the single-image style cards real thumbnails + real usage counts, fix the GDrive-cover + "no kit_css" defects, and strip stale hand-coded counts — all frontend, no migration.

**Why reshaped:** `carousel_drafts` has no field recording which carousel *layout archetype* was used, and ~0 published carousels carry covers, so per-archetype carousel thumbnails/usage are not derivable. Single-image styles ARE derivable (`taxonomy.image_style` + `image_urls[0]`), names map 1:1 to the catalogue. Median engagement deferred (no clean draft→own_posts join).

## Global Constraints
- Frontend only. No migration, no n8n, no edge fn. Data via one `supabase.from('carousel_drafts')` read.
- Census gate: `node scripts/lightshim-census.mjs; echo "census exit $?"` (capture directly, never through `| tail`) must exit 0. Prefer existing tokenized/shimmed classes for new markup.
- vitest green; `npm run build` exit 0.
- No fake numbers. If a style has 0 published uses, show no count (not "0 posts").
- Ship from worktree via `git push origin feat/content-studio-phase5-styles:main`.

---

### Task 1: Pure style-usage aggregation + URL normalizer

**Files:** Create `lib/styleUsage.ts`, `lib/styleUsage.test.ts`

**Interfaces (Produces):**
```ts
export interface DraftUsageRow { taxonomy: any; image_urls: string[] | null; created_at: string; }
export interface StyleUsage { count: number; cover: string | null; }
export function aggregateImageStyleUsage(rows: DraftUsageRow[]): Record<string, StyleUsage>;
export function toRenderableImageUrl(url: string | null | undefined): string | null;
```
Rules:
- `aggregateImageStyleUsage`: group rows by `taxonomy.image_style` (skip rows with no image_style). `count` = rows in group. `cover` = `toRenderableImageUrl(image_urls[0])` of the **most recent** row (by `created_at` desc) in the group whose `image_urls[0]` normalizes to non-null; else null.
- `toRenderableImageUrl`: rewrite Google-Drive share links `https://drive.google.com/file/d/{ID}/view...` → `https://drive.google.com/thumbnail?id={ID}&sz=w600`; also handle `open?id={ID}` / `uc?id={ID}` forms. Pass through other http(s) URLs unchanged. Return null for null/empty/non-http.

- [ ] **Step 1: failing test**
```ts
import { describe, it, expect } from 'vitest';
import { aggregateImageStyleUsage, toRenderableImageUrl } from './styleUsage';

describe('toRenderableImageUrl', () => {
  it('rewrites a drive /file/d/ID/view link to a thumbnail link', () => {
    expect(toRenderableImageUrl('https://drive.google.com/file/d/ABC123/view?usp=drivesdk'))
      .toBe('https://drive.google.com/thumbnail?id=ABC123&sz=w600');
  });
  it('rewrites open?id= and uc?id= forms', () => {
    expect(toRenderableImageUrl('https://drive.google.com/open?id=XYZ')).toBe('https://drive.google.com/thumbnail?id=XYZ&sz=w600');
    expect(toRenderableImageUrl('https://drive.google.com/uc?id=XYZ&export=view')).toBe('https://drive.google.com/thumbnail?id=XYZ&sz=w600');
  });
  it('passes through a normal https image url', () => {
    expect(toRenderableImageUrl('https://cdn.x/y/slide-1.png')).toBe('https://cdn.x/y/slide-1.png');
  });
  it('returns null for empty/non-http', () => {
    expect(toRenderableImageUrl(null)).toBeNull();
    expect(toRenderableImageUrl('')).toBeNull();
    expect(toRenderableImageUrl('data:foo')).toBeNull();
  });
});

describe('aggregateImageStyleUsage', () => {
  it('counts per image_style and picks latest renderable cover', () => {
    const out = aggregateImageStyleUsage([
      { taxonomy: { image_style: 'Stat Card' }, image_urls: ['https://x/a.png'], created_at: '2026-06-01T00:00:00Z' },
      { taxonomy: { image_style: 'Stat Card' }, image_urls: ['https://x/b.png'], created_at: '2026-06-05T00:00:00Z' },
      { taxonomy: { image_style: 'Quote Card' }, image_urls: ['https://drive.google.com/file/d/QID/view'], created_at: '2026-06-02T00:00:00Z' },
      { taxonomy: { pillar: 'methodology' }, image_urls: ['https://x/c.png'], created_at: '2026-06-09T00:00:00Z' },
    ]);
    expect(out['Stat Card']).toEqual({ count: 2, cover: 'https://x/b.png' });
    expect(out['Quote Card']).toEqual({ count: 1, cover: 'https://drive.google.com/thumbnail?id=QID&sz=w600' });
    expect(out['undefined']).toBeUndefined();
  });
  it('skips rows with no renderable cover for the cover pick but still counts them', () => {
    const out = aggregateImageStyleUsage([
      { taxonomy: { image_style: 'Lifestyle Photo' }, image_urls: null, created_at: '2026-06-10T00:00:00Z' },
      { taxonomy: { image_style: 'Lifestyle Photo' }, image_urls: ['https://x/old.png'], created_at: '2026-06-01T00:00:00Z' },
    ]);
    expect(out['Lifestyle Photo']).toEqual({ count: 2, cover: 'https://x/old.png' });
  });
});
```
- [ ] **Step 2:** `npx vitest run lib/styleUsage.test.ts` → FAIL (no module).
- [ ] **Step 3: implement** `lib/styleUsage.ts` per the rules above.
- [ ] **Step 4:** `npx vitest run lib/styleUsage.test.ts` → PASS.
- [ ] **Step 5: commit** `feat(styles): pure image-style usage aggregation + drive-url normalizer`

---

### Task 2: useStyleUsage hook

**Files:** Create `hooks/useStyleUsage.ts`

**Interfaces:** Consumes `aggregateImageStyleUsage`. Produces `useStyleUsage(): { imageStyleStats: Record<string, StyleUsage>; loading: boolean }`.

Fetch once: `supabase.from('carousel_drafts').select('taxonomy, image_urls, created_at').eq('type','single_image').eq('status','published').limit(500)`, then `aggregateImageStyleUsage(rows)`. On error, toastError('load style usage', err) and leave stats `{}`. Mirror the fetch/loading shape of `useCarouselStyles`.

- [ ] **Step 1:** write the hook.
- [ ] **Step 2:** `npx tsc --noEmit` clean on the new file.
- [ ] **Step 3: commit** `feat(styles): useStyleUsage hook (published single-image counts + covers)`

---

### Task 3: Wire real thumbnails/counts into StyleGalleryPanel + defect fixes

**Files:** Modify `components/dashboard/StyleGalleryPanel.tsx`

- [ ] **Step 1:** import + call `useStyleUsage()` in `StyleGalleryPanel`; pass `usage={style.category==='single_image' ? imageStyleStats[style.name] : undefined}` into the single-image `AssetStyleCard` map (line ~195). Carousel map stays unchanged.
- [ ] **Step 2:** extend `AssetStyleCard` props with `usage?: StyleUsage`. When `usage?.cover`, render a thumbnail at the top of the card: a `≈16/9` rounded tile `<img src={usage.cover} onError={hide-to-fallback} loading="lazy" className="w-full h-full object-cover">`; on error swap to a neutral fallback tile (state `imgOk`, default true; onError → false → render a `bg-[var(--d-ink-3)]` tile with the style name in serif italic, mirroring the existing coverless kit tile at StyleGalleryPanel:353-357). When `usage?.count`, render a `text-[10.5px]` count chip ("N posts") next to the category label.
- [ ] **Step 3:** add `onError` fallback to the existing kit reference imgs — `CarouselStyleCard` reference strip (line ~348) and `NewStyleModal` ref thumbs (line ~511): on error, hide the broken `<img>` (set per-image error state or swap to a muted placeholder). Keep minimal.
- [ ] **Step 4:** fix the "— no kit_css" footer copy (`CarouselStyleCard`, line ~378): render `{style.hasKit ? '✓ kit_css' : (style.isDefault ? 'renderer default kit' : 'no custom kit')}` so the default kit no longer reads as a missing-data defect.
- [ ] **Step 5:** strip stale hand-coded counts/claims from blurbs so they don't contradict the real chips: in `ASSET_STYLES`, remove the parentheticals "Most-used single_image style (19 posts)." (Framework Diagram) and any "(N posts)"; in `TEXT_STYLES`, remove "Highest usage (9 posts)." (Methodology) and "(V3 Pattern G)". Keep the descriptive sentence.
- [ ] **Step 6: gates**
```bash
npx tsc --noEmit 2>&1 | grep -E "StyleGallery|styleUsage|useStyleUsage" ; echo "(empty=clean)"
node scripts/lightshim-census.mjs; echo "census exit $?"
npx vitest run
```
Expected: clean; census exit 0; vitest all pass. If census flags a new class, add the shim to `theme/light.css`.
- [ ] **Step 7: commit** `feat(styles): real single-image thumbnails + usage counts, drive-cover + kit-css copy fixes`

---

### Task 4: Build + self-test
- [ ] `npm run build` → exit 0.
- [ ] Deploy, then playwright inspect the live Styles tab at 1440+375: single-image cards show thumbnails + counts, 0 console errors, no broken-image icons.

## Self-review
- Coverage: single-image thumbnails+counts (T1-3), GDrive fix (T1 normalizer + T3 fallback), no-kit_css copy (T3.4), stale counts stripped (T3.5), img fallbacks (T3.2-3). Carousel archetypes untouched (honest catalogue). ✓
- Types: `StyleUsage`/`aggregateImageStyleUsage` identical across T1/T2/T3. ✓

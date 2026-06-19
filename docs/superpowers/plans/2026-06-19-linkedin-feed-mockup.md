# LinkedIn-Feed Mockup Component Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a presentational React component that renders a believable LinkedIn feed for a prospect from a fixture JSON spec — the visual centerpiece of the content-preview asset.

**Architecture:** A pure data layer (`lib/linkedinFeedSpec.ts`) validates + resolves a `FeedSpec` for a render mode. The `LinkedInFeedMockup` component consumes it and composes the **existing** `components/ui/LinkedInPostPreview.tsx` (one card per post), threading the prospect's profile into each. A new `LinkedInDocumentCard` renders the lead-magnet "document" post for the full (call) render. A dev-only route renders it against fixtures inside Ivan's brand frame, demonstrating the split visual register.

**Tech Stack:** TypeScript (strict), React 18, Vite, Tailwind v4 (CSS `@theme`), framer-motion, lucide-react, Vitest (data-layer tests), playwright-driver (visual self-test).

## Global Constraints

- **Language:** TypeScript strict, `.tsx` for components, `.ts` for lib. Named `interface Props` + `React.FC<Props>` + `export default` (match repo convention).
- **Reuse, don't rebuild:** post cards MUST compose the existing `components/ui/LinkedInPostPreview.tsx` (props: `text`, `author?`, `headline?`, `avatarUrl?`, `mediaUrl?: string|null`, `showFold?`, `stats?: {reactions?: number; comments?: number}`). Do NOT refactor that shared file (it's used by the post editor).
- **Split visual register:** the feed mimics LinkedIn's neutral UI (white cards, `#0a66c2` blue, `#dce6f1` borders — already in `LinkedInPostPreview`). The surrounding page uses Ivan's brand tokens — `--color-paper` (#F7F4EF), `--color-ink` (#1A1A1A), `--color-ink-mute` (#5A5752), `--font-display` (DM Serif Display), `--font-mono` (IBM Plex Mono). Apply brand tokens via inline `style={{ ... 'var(--token)' }}` per repo convention.
- **Testing:** no React Testing Library in repo — data layer is unit-tested with Vitest; the component is visually self-tested with playwright-driver. Do NOT add a component-test framework.
- **Type gate:** every task ends green on `npx tsc --noEmit`.
- **Dev server:** `npm run dev` → http://localhost:3000.

---

### Task 1: Feed spec types + `normalizeFeedSpec` (data layer, TDD)

**Files:**
- Create: `lib/linkedinFeedSpec.ts`
- Test: `lib/linkedinFeedSpec.test.ts`

**Interfaces:**
- Produces: `FeedSpec`, `ProfileSpec`, `TextPostSpec`, `ImagePostSpec`, `FeedPostSpec`, `LmCardSpec`, `RenderMode`, `NormalizedLmCard`, `NormalizedFeed`, and `normalizeFeedSpec(spec: FeedSpec, mode?: RenderMode): NormalizedFeed`. Later tasks import these.

- [ ] **Step 1: Write the failing test**

```ts
// lib/linkedinFeedSpec.test.ts
import { describe, it, expect } from 'vitest';
import { normalizeFeedSpec, type FeedSpec } from './linkedinFeedSpec';

const base: FeedSpec = {
  profile: { name: 'Jane Doe', headline: 'Founder, Acme', avatarUrl: '/x.jpg' },
  posts: [{ type: 'text', body: 'Hello world' }],
  lmCard: { coverUrl: '/cover.jpg', title: 'The Guide' },
};

describe('normalizeFeedSpec', () => {
  it('throws when profile.name is blank', () => {
    expect(() => normalizeFeedSpec({ ...base, profile: { ...base.profile, name: '  ' } }))
      .toThrow(/profile\.name/);
  });

  it('throws when there are no posts', () => {
    expect(() => normalizeFeedSpec({ ...base, posts: [] })).toThrow(/at least one post/);
  });

  it('throws when a post body is empty', () => {
    expect(() => normalizeFeedSpec({ ...base, posts: [{ type: 'text', body: '' }] }))
      .toThrow(/non-empty body/);
  });

  it('throws when an image post lacks imageUrl', () => {
    expect(() => normalizeFeedSpec({ ...base, posts: [{ type: 'image', body: 'pic', imageUrl: '' }] }))
      .toThrow(/imageUrl/);
  });

  it('drops lmCard in tease mode even when supplied', () => {
    expect(normalizeFeedSpec(base, 'tease').lmCard).toBeNull();
  });

  it('includes lmCard with default pages (8) in full mode', () => {
    expect(normalizeFeedSpec(base, 'full').lmCard).toEqual({
      coverUrl: '/cover.jpg', title: 'The Guide', pages: 8,
    });
  });

  it('lmCard is null in full mode when none supplied', () => {
    const { lmCard, ...rest } = base; void lmCard;
    expect(normalizeFeedSpec(rest as FeedSpec, 'full').lmCard).toBeNull();
  });

  it('defaults to tease mode', () => {
    expect(normalizeFeedSpec(base).lmCard).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/linkedinFeedSpec.test.ts`
Expected: FAIL — cannot resolve `./linkedinFeedSpec`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/linkedinFeedSpec.ts
// Spec + normalization for the LinkedIn-feed mockup. Pure data — no React.

export interface ProfileSpec {
  name: string;
  headline: string;
  avatarUrl: string;
}

export interface TextPostSpec {
  type: 'text';
  body: string;
  reactions?: number;
  comments?: number;
}

export interface ImagePostSpec {
  type: 'image';
  body: string;
  imageUrl: string;
  reactions?: number;
  comments?: number;
}

export type FeedPostSpec = TextPostSpec | ImagePostSpec;

export interface LmCardSpec {
  coverUrl: string;
  title: string;
  /** LinkedIn "document" page-count badge. Defaults to 8. */
  pages?: number;
}

export interface FeedSpec {
  profile: ProfileSpec;
  posts: FeedPostSpec[];
  lmCard?: LmCardSpec;
}

export type RenderMode = 'tease' | 'full';

export interface NormalizedLmCard {
  coverUrl: string;
  title: string;
  pages: number;
}

export interface NormalizedFeed {
  profile: ProfileSpec;
  posts: FeedPostSpec[];
  /** null in tease mode (LM held for the call); populated in full mode when supplied. */
  lmCard: NormalizedLmCard | null;
}

const DEFAULT_LM_PAGES = 8;

/**
 * Validate a FeedSpec and resolve it for a render mode.
 * - 'tease' → lmCard always null (held back for the call)
 * - 'full'  → lmCard included (pages defaulted) when supplied
 * Throws on structurally invalid specs so a bad scrape fails loud, not silently blank.
 */
export function normalizeFeedSpec(spec: FeedSpec, mode: RenderMode = 'tease'): NormalizedFeed {
  if (!spec.profile || !spec.profile.name.trim()) {
    throw new Error('normalizeFeedSpec: profile.name is required');
  }
  if (!Array.isArray(spec.posts) || spec.posts.length === 0) {
    throw new Error('normalizeFeedSpec: at least one post is required');
  }
  for (const post of spec.posts) {
    if (!post.body || !post.body.trim()) {
      throw new Error('normalizeFeedSpec: every post needs a non-empty body');
    }
    if (post.type === 'image' && !post.imageUrl) {
      throw new Error('normalizeFeedSpec: image posts need an imageUrl');
    }
  }

  let lmCard: NormalizedLmCard | null = null;
  if (mode === 'full' && spec.lmCard) {
    lmCard = {
      coverUrl: spec.lmCard.coverUrl,
      title: spec.lmCard.title,
      pages: spec.lmCard.pages ?? DEFAULT_LM_PAGES,
    };
  }

  return { profile: spec.profile, posts: spec.posts, lmCard };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/linkedinFeedSpec.test.ts`
Expected: PASS (8 tests). Then `npx tsc --noEmit` → no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/linkedinFeedSpec.ts lib/linkedinFeedSpec.test.ts
git commit -m "feat: feed spec types + normalizeFeedSpec for LinkedIn mockup"
```

---

### Task 2: `LinkedInFeedMockup` component (posts only — tease-capable)

**Files:**
- Create: `components/ui/LinkedInFeedMockup.tsx`

**Interfaces:**
- Consumes: `normalizeFeedSpec`, `FeedSpec`, `RenderMode` from `lib/linkedinFeedSpec`; default export of `components/ui/LinkedInPostPreview`.
- Produces: default export `LinkedInFeedMockup` with `Props { spec: FeedSpec; mode?: RenderMode; className?: string }`.

- [ ] **Step 1: Write the component**

```tsx
// components/ui/LinkedInFeedMockup.tsx
import React from 'react';
import LinkedInPostPreview from './LinkedInPostPreview';
import { normalizeFeedSpec, type FeedSpec, type RenderMode } from '../../lib/linkedinFeedSpec';

interface Props {
  spec: FeedSpec;
  /** 'tease' (reply: posts only) or 'full' (call: posts + LM card). Default 'tease'. */
  mode?: RenderMode;
  className?: string;
}

/**
 * Renders a believable LinkedIn feed for a prospect from a FeedSpec.
 * Composes the existing LinkedInPostPreview (one card per post), threading the
 * prospect's profile into each. Pure presentation — feed it a spec, it renders.
 * The feed mimics LinkedIn's neutral UI on purpose; the surrounding page supplies Ivan's brand frame.
 */
const LinkedInFeedMockup: React.FC<Props> = ({ spec, mode = 'tease', className = '' }) => {
  const feed = normalizeFeedSpec(spec, mode);
  const { profile, posts } = feed;

  return (
    <div className={`flex flex-col items-center gap-3 w-full ${className}`}>
      {posts.map((post, i) => (
        <LinkedInPostPreview
          key={i}
          text={post.body}
          author={profile.name}
          headline={profile.headline}
          avatarUrl={profile.avatarUrl}
          mediaUrl={post.type === 'image' ? post.imageUrl : null}
          stats={{ reactions: post.reactions, comments: post.comments }}
        />
      ))}
      {/* LM document card (full mode) wired in Task 4 */}
    </div>
  );
};

export default LinkedInFeedMockup;
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no errors. (Visual verification happens in Task 3 via the dev route.)

- [ ] **Step 3: Commit**

```bash
git add components/ui/LinkedInFeedMockup.tsx
git commit -m "feat: LinkedInFeedMockup composes post previews from a spec"
```

---

### Task 3: Fixtures + dev preview route + visual self-test (the tease render — MVP-critical)

**Files:**
- Create: `components/ui/linkedInFeedMockup.fixtures.ts`
- Create: `components/dev/LinkedInFeedMockupPreview.tsx`
- Modify: `App.tsx` (add one lazy import next to the other `lazy(() => import(...))` lines; add one `<Route>` inside `<Routes>` immediately before the catch-all `path="*"` route)

**Interfaces:**
- Consumes: `LinkedInFeedMockup` (Task 2), `FeedSpec` (Task 1).
- Produces: `sampleFeedSpec: FeedSpec`; default export `LinkedInFeedMockupPreview`; route `/dev/linkedin-feed`.

- [ ] **Step 1: Create the fixture**

```ts
// components/ui/linkedInFeedMockup.fixtures.ts
import type { FeedSpec } from '../../lib/linkedinFeedSpec';

/** Sample prospect feed for dev preview + visual testing. Stand-in data, not a real person. */
export const sampleFeedSpec: FeedSpec = {
  profile: {
    name: 'Jordan Vega',
    headline: 'Founder & CEO at Northwind Creative · Brand systems for B2B',
    avatarUrl: 'https://i.pravatar.cc/150?img=12',
  },
  posts: [
    {
      type: 'text',
      body: `Most agencies pitch "brand strategy" and deliver a logo.\n\nThe gap isn't talent. It's that strategy lives in a deck nobody reads after kickoff.\n\nWe started shipping a one-page operating brief instead — the 3 decisions every asset has to honor. Adoption went from "sometimes" to "every time."\n\nDeliverables don't change behavior. Constraints do.`,
      reactions: 214,
      comments: 18,
    },
    {
      type: 'text',
      body: `A client asked last week why our retainer costs more than the shop down the street.\n\nSimple: they're paying for the shop's busywork. We deleted 40% of ours.\n\nThe most expensive thing in any agency is work that looks like progress.`,
      reactions: 176,
      comments: 11,
    },
    {
      type: 'image',
      body: `The 3-layer brand system we install for every founder-led B2B account. Save this one.`,
      imageUrl: 'https://placehold.co/1200x900/2A8F65/FFFFFF/png?text=Brand+System',
      reactions: 309,
      comments: 27,
    },
  ],
  lmCard: {
    coverUrl: 'https://placehold.co/800x1000/1A1A1A/F7F4EF/png?text=Founder+Brand+Playbook',
    title: 'The Founder Brand Playbook',
    pages: 9,
  },
};
```

- [ ] **Step 2: Create the dev preview page**

```tsx
// components/dev/LinkedInFeedMockupPreview.tsx
import React from 'react';
import LinkedInFeedMockup from '../ui/LinkedInFeedMockup';
import { sampleFeedSpec } from '../ui/linkedInFeedMockup.fixtures';
import type { RenderMode } from '../../lib/linkedinFeedSpec';

/**
 * Dev-only preview for the LinkedIn feed mockup. Demonstrates the split visual register:
 * Ivan's brand frame (paper/ink/serif) wrapping the neutral LinkedIn feed.
 * Route: /dev/linkedin-feed  (add ?mode=full to include the LM document card)
 */
const LinkedInFeedMockupPreview: React.FC = () => {
  const mode: RenderMode =
    new URLSearchParams(window.location.search).get('mode') === 'full' ? 'full' : 'tease';
  const firstName = sampleFeedSpec.profile.name.split(' ')[0];

  return (
    <div className="min-h-screen w-full" style={{ backgroundColor: 'var(--color-paper)' }}>
      <div className="max-w-2xl mx-auto px-6 py-16">
        <p
          className="text-[12px] uppercase tracking-[0.2em] mb-2"
          style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-ink-mute)' }}
        >
          Preview · {mode === 'full' ? 'full reveal' : 'their feed, leveled up'}
        </p>
        <h1
          className="text-4xl mb-10"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--color-ink)' }}
        >
          What {firstName}’s feed could be doing
        </h1>
        <LinkedInFeedMockup spec={sampleFeedSpec} mode={mode} />
      </div>
    </div>
  );
};

export default LinkedInFeedMockupPreview;
```

- [ ] **Step 3: Wire the dev route in `App.tsx`**

Add this lazy import alongside the other `const X = lazy(() => import('./components/...'))` lines:

```tsx
const LinkedInFeedMockupPreview = lazy(() => import('./components/dev/LinkedInFeedMockupPreview'));
```

Add this route inside the `<Routes>` block, immediately before the catch-all `<Route path="*" ... />`:

```tsx
<Route path="/dev/linkedin-feed" element={<LinkedInFeedMockupPreview />} />
```

- [ ] **Step 4: Verify types + boot the dev server**

Run: `npx tsc --noEmit` → no errors.
Run: `npm run dev` (leave running on http://localhost:3000).

- [ ] **Step 5: Visual self-test with playwright-driver**

Use the **playwright-driver** skill (inspect lane) to load `http://localhost:3000/dev/linkedin-feed` and screenshot at widths 1440 and 390. Verify by eye:
- Three cards render: 2 text posts + 1 image post, in order.
- Every card shows **Jordan Vega** + the headline + avatar (profile threaded into each).
- LinkedIn chrome present: blue name, reaction strip with counts, Like/Comment/Repost/Send bar; image post shows the green "Brand System" media.
- The page frame is cream (`--color-paper`) with a serif headline "What Jordan’s feed could be doing" — i.e. brand frame around a neutral LinkedIn feed (split register holds).
- No LM document card yet (tease mode).

- [ ] **Step 6: Commit**

```bash
git add components/ui/linkedInFeedMockup.fixtures.ts components/dev/LinkedInFeedMockupPreview.tsx App.tsx
git commit -m "feat: dev preview route + fixtures for LinkedIn feed mockup"
```

---

### Task 4: `LinkedInDocumentCard` (LM post) + wire full-mode render (the call asset)

**Files:**
- Create: `components/ui/LinkedInDocumentCard.tsx`
- Modify: `components/ui/LinkedInFeedMockup.tsx` (import the card; render it after the posts when `feed.lmCard` is present)

**Interfaces:**
- Consumes: `NormalizedLmCard`, `ProfileSpec` from `lib/linkedinFeedSpec`.
- Produces: default export `LinkedInDocumentCard` with `Props { profile: ProfileSpec; card: NormalizedLmCard; caption?: string }`.

- [ ] **Step 1: Create the document card**

```tsx
// components/ui/LinkedInDocumentCard.tsx
import React from 'react';
import { ThumbsUp, MessageSquare, Repeat2, Send, Globe, MoreHorizontal, FileText } from 'lucide-react';
import type { NormalizedLmCard, ProfileSpec } from '../../lib/linkedinFeedSpec';

interface Props {
  profile: ProfileSpec;
  card: NormalizedLmCard;
  caption?: string;
}

/**
 * LinkedIn "document" post (PDF/carousel) for a lead-magnet preview.
 * Self-contained header (does NOT refactor the shared LinkedInPostPreview).
 */
const LinkedInDocumentCard: React.FC<Props> = ({ profile, card, caption }) => {
  return (
    <div className="rounded-lg bg-white text-[#1d2226] shadow-sm border border-[#dce6f1] overflow-hidden font-sans w-full max-w-[552px] mx-auto">
      {/* Header */}
      <div className="flex items-start gap-2 px-4 py-3">
        <img
          src={profile.avatarUrl}
          alt={profile.name}
          className="w-12 h-12 rounded-full object-cover bg-zinc-200 shrink-0"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
        />
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-semibold leading-tight text-[#0a66c2] truncate">{profile.name}</div>
          <div className="text-[12px] text-[#666] leading-tight mt-0.5 truncate">{profile.headline}</div>
          <div className="text-[12px] text-[#666] leading-tight mt-0.5 flex items-center gap-1">
            <span>2d</span><span>·</span><Globe className="w-3 h-3 inline-block" />
          </div>
        </div>
        <button className="p-1.5 rounded-full hover:bg-[#f3f2ef] text-[#666] transition-colors">
          <MoreHorizontal className="w-5 h-5" />
        </button>
      </div>

      {/* Caption */}
      {caption && (
        <div className="px-4 pb-3">
          <div className="text-[14px] text-[#1d2226] leading-[1.4] whitespace-pre-wrap">{caption}</div>
        </div>
      )}

      {/* Document block */}
      <div className="relative border-y border-[#dce6f1] bg-[#f3f6f8]">
        <img src={card.coverUrl} alt={card.title} className="w-full max-h-[520px] object-contain" loading="lazy" />
        <div className="absolute left-0 right-0 bottom-0 bg-[#1d2226]/85 text-white px-4 py-3 flex items-center gap-2">
          <FileText className="w-4 h-4 shrink-0" />
          <span className="text-[14px] font-semibold leading-tight truncate">{card.title}</span>
          <span className="ml-auto text-[12px] text-white/70 shrink-0">{card.pages} pages</span>
        </div>
      </div>

      {/* Reaction strip */}
      <div className="px-4 pt-3 pb-2 text-[12px] text-[#666] flex items-center gap-1">
        <span className="inline-flex -space-x-1">
          <span className="w-4 h-4 rounded-full bg-[#0a66c2] flex items-center justify-center ring-1 ring-white text-white text-[9px]">👍</span>
          <span className="w-4 h-4 rounded-full bg-[#df704d] flex items-center justify-center ring-1 ring-white text-white text-[9px]">❤</span>
        </span>
        <span className="ml-1">128</span>
        <span className="ml-auto">14 comments</span>
      </div>

      {/* Action bar */}
      <div className="border-t border-[#dce6f1] px-2 py-1 flex items-center justify-around">
        {[
          { icon: ThumbsUp, label: 'Like' },
          { icon: MessageSquare, label: 'Comment' },
          { icon: Repeat2, label: 'Repost' },
          { icon: Send, label: 'Send' },
        ].map((a) => (
          <button
            key={a.label}
            className="flex items-center gap-1.5 px-3 py-2 rounded text-[#666] hover:bg-[#f3f2ef] transition-colors text-[13px] font-semibold"
          >
            <a.icon className="w-5 h-5" />
            <span>{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default LinkedInDocumentCard;
```

- [ ] **Step 2: Wire it into `LinkedInFeedMockup.tsx`**

Add the import at the top (next to the `LinkedInPostPreview` import):

```tsx
import LinkedInDocumentCard from './LinkedInDocumentCard';
```

Replace the placeholder comment `{/* LM document card (full mode) wired in Task 4 */}` with:

```tsx
{feed.lmCard && (
  <LinkedInDocumentCard
    profile={profile}
    card={feed.lmCard}
    caption={`New — I put together "${feed.lmCard.title}", the playbook behind these posts. Comment "guide" and I'll send it over.`}
  />
)}
```

- [ ] **Step 3: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Visual self-test (full mode)**

With `npm run dev` running, use **playwright-driver** to load `http://localhost:3000/dev/linkedin-feed?mode=full` and screenshot at 1440 + 390. Verify:
- The 3 posts still render, and a **4th card** (the document card) appears after them.
- Document card shows the dark cover, the title "The Founder Brand Playbook", a `FileText` icon, and a **"9 pages"** badge bottom-right.
- Loading `/dev/linkedin-feed` (no query) still shows **only 3 posts** (tease mode unchanged).

- [ ] **Step 5: Commit**

```bash
git add components/ui/LinkedInDocumentCard.tsx components/ui/LinkedInFeedMockup.tsx
git commit -m "feat: LinkedIn document card for LM preview + full-mode render"
```

---

## Done When

- `npx vitest run lib/linkedinFeedSpec.test.ts` → 8 passing.
- `npx tsc --noEmit` → clean.
- `/dev/linkedin-feed` renders the 3-post tease; `?mode=full` adds the LM document card.
- The feed reads as a real LinkedIn feed (neutral UI) inside Ivan's cream/serif brand frame (split register).

## Out of Scope (per spec §9)

The runbook (Apify scrape, voice/brand profiling, engine fan-out, content-lint QA), the hosted preview page on LM landing infra, lm-beacon tracking, n8n automation. This plan delivers only the render component the runbook will later feed.

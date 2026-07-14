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

/** Designed media card for an image post — brand-mirrored copy DISTINCT from the caption.
 *  Rendered in the post media slot; the post falls back to imageUrl when absent. */
export interface ImageCardSpec {
  kicker?: string;
  headline: string;
  figure?: string;
  sub?: string;
}

/** The prospect's brand kit, threaded into sample artifacts (carousel slides, image cards)
 *  so they render in THEIR brand. Every field optional; renderers keep safe fallbacks. */
export interface BrandKitSpec {
  accent_hex?: string;
  accent2?: string;
  accent_secondary?: string;
  logo_url?: string;
  font_heading?: string;
  font_body?: string;
  surface_hex?: string;
  ink_hex?: string;
  is_dark?: boolean;
}

export interface ImagePostSpec {
  type: 'image';
  body: string;
  imageUrl?: string;
  /** Designed brand card; when present it takes the media slot over imageUrl. */
  imageCard?: ImageCardSpec;
  reactions?: number;
  comments?: number;
}

/** One drafted carousel slide. `role` picks the layout (fallback: first = cover,
 *  last = action, rest = point); `figure` is a dominant numeral for proof slides. */
export interface TextSlideSpec {
  heading: string;
  body: string;
  role?: 'cover' | 'point' | 'proof' | 'action';
  kicker?: string;
  figure?: string;
}

export interface CarouselPostSpec {
  type: 'carousel';
  body: string;
  slides: string[];
  /** Text-slide cards (heading + body). When present, the card renders these styled
   *  text slides instead of images; `slides` may be empty in that case. */
  textSlides?: TextSlideSpec[];
  reactions?: number;
  comments?: number;
}

export type FeedPostSpec = TextPostSpec | ImagePostSpec | CarouselPostSpec;

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
    if (post.type === 'image' && !post.imageUrl && !post.imageCard?.headline) {
      throw new Error('normalizeFeedSpec: image posts need an imageUrl or an imageCard');
    }
    if (
      post.type === 'carousel' &&
      (!Array.isArray(post.slides) || post.slides.length === 0) &&
      (!Array.isArray(post.textSlides) || post.textSlides.length === 0)
    ) {
      throw new Error('normalizeFeedSpec: carousel posts need at least one slide');
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

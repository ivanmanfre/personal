// Pure builder: a scan's LM payload -> a results-forward embed URL for the live assessment engine.
const RESOURCES_BASE = 'https://resources.ivanmanfredi.com';

/** The lead's brand, read off their site by the pipeline. Everything is optional: a prospect
 *  with no site (or an unreadable one) yields an empty brand and the embed stays neutral. */
export interface AssessmentEmbedBrand {
  accent_hex?: string;
  /** Loadable Google-font family names (the pipeline only forwards ones it could resolve). */
  font_heading?: string;
  font_body?: string;
  logo_url?: string;
}

export interface AssessmentEmbedLm {
  slug?: string;
  seed_answers?: Record<string, number>;
  /** The lead's brand color (hex). Threaded into the embed so the scorecard renders in
   *  the prospect's brand, matching their cover + post image. Empty/absent -> neutral. */
  accent_hex?: string;
  /** Richer per-generation brand (fonts + logo + color). Preferred over accent_hex. */
  brand?: AssessmentEmbedBrand;
}

export interface AssessmentEmbedOpts {
  prospectId?: string;
  src?: string;
}

/**
 * Build the iframe src for the LIVE assessment sample shown inside a prospect scan.
 * The prospect takes it the way their own leads would: fresh from the intro, in the
 * lead's brand color, with Ivan's chrome and fonts stripped (engine embed mode).
 * We deliberately do NOT use results-forward mode here — a pre-seeded score reads as
 * "already completed" and gives the prospect nothing to interact with.
 * Returns null when there's no slug to embed, so the caller can skip the section.
 */
export function buildAssessmentEmbedUrl(
  lm: AssessmentEmbedLm | undefined | null,
  opts?: AssessmentEmbedOpts
): string | null {
  if (!lm || !lm.slug) return null;
  const brand = lm.brand ?? {};
  const params = new URLSearchParams();
  params.set('src', opts?.src ?? 'scan_embed');
  if (opts?.prospectId) params.set('pid', opts.prospectId);
  // The lead's brand rides into the embed so the live assessment matches their site: color,
  // their real fonts (heading + body), and their logo. Each is skipped when absent.
  const accent = ((brand.accent_hex || lm.accent_hex) || '').replace(/[^0-9a-fA-F]/g, '');
  if (accent) params.set('accent', accent);
  if (brand.font_heading) params.set('font', brand.font_heading);
  if (brand.font_body) params.set('fontb', brand.font_body);
  if (brand.logo_url) params.set('logo', brand.logo_url);
  return `${RESOURCES_BASE}/${encodeURIComponent(lm.slug)}/?${params.toString()}`;
}

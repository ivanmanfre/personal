// Pure builder: a scan's LM payload -> a results-forward embed URL for the live assessment engine.
const RESOURCES_BASE = 'https://resources.ivanmanfredi.com';

/** The lead's brand, read off their site by the pipeline. Everything is optional: a prospect
 *  with no site (or an unreadable one) yields an empty brand and the embed stays neutral. */
export interface AssessmentEmbedBrand {
  accent_hex?: string;
  /** Loadable Google-font family names (the pipeline only forwards ones it could resolve). */
  font_heading?: string;
  font_body?: string;
  /** 'serif' when the lead's headline face is an upright serif (editorial brands). Drives the
   *  engine's ?headstyle=serif path: serif display headline, italic-pivot killed, sans questions. */
  font_heading_style?: string;
  logo_url?: string;
  /** Page background for the embed surface (hex, no #). Absent -> engine's default paper. */
  surface_hex?: string;
  /** Hero template variant (e.g. 'dark'). Absent -> engine's default hero. */
  hero?: string;
  /** Hero background color (hex). Only meaningful with a hero variant set. */
  hero_bg?: string;
  /** Secondary accent (hex) for hero italics / inline emphasis. */
  accent2?: string;
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
  /** Brand/company name the engine shows in embed context (engine-side ?bname). */
  bname?: string;
  /** Brand logo URL for the engine's embed chrome (engine-side ?blogo). */
  blogo?: string;
  /** End-screen CTA label, e.g. the client's real "Free Strategy Call" (engine-side ?cta). */
  cta?: string;
  /** Absolute http(s) URL the end-screen CTA points at, e.g. the client's contact page (engine-side ?ctaurl). */
  ctaurl?: string;
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
  // UTM attribution (P0.2, 2026-07-17): the embed's beacon events now persist scalar utm
  // columns in lm_events; 'scan' per the locked taxonomy, content = the prospect this scan
  // renders for, so embed engagement attributes to a named prospect.
  params.set('utm_source', 'scan');
  params.set('utm_medium', opts?.src ?? 'scan_embed');
  params.set('utm_campaign', lm.slug);
  if (opts?.prospectId) params.set('utm_content', opts.prospectId);
  // The lead's brand rides into the embed so the live assessment matches their site: color +
  // their real fonts (heading + body). The logo is NOT passed here — the wrapping site-header
  // mockup (LiveAssessmentEmbed) renders it in the nav, so the assessment hero stays logo-free.
  const accent = ((brand.accent_hex || lm.accent_hex) || '').replace(/[^0-9a-fA-F]/g, '');
  if (accent) params.set('accent', accent);
  if (brand.font_heading) params.set('font', brand.font_heading);
  if (brand.font_body) params.set('fontb', brand.font_body);
  // Upright-serif headline path: when the lead's headline face is a serif (editorial brands like
  // NoShoot), tell the engine to render it upright (no italic pivot) with sans questions. Additive
  // — an engine that doesn't know ?headstyle ignores it, so older embeds are unaffected.
  if ((brand.font_heading_style || '').toLowerCase() === 'serif') params.set('headstyle', 'serif');
  // Surface override: swap the engine's warm cream paper for the lead's page background
  // (e.g. clean white) so the embed reads as a page on THEIR site. Engine-side ?bg=.
  const surface = ((brand as any).surface_hex || '').replace(/[^0-9a-fA-F]/g, '');
  if (surface) params.set('bg', surface);
  // Radius + ink complete the brand kit (engine hardcodes 0-radius + ink literals).
  const radius = (brand as any).radius_px;
  if (typeof radius === 'number' && radius >= 0) params.set('r', String(radius));
  const ink = ((brand as any).ink_hex || '').replace(/[^0-9a-fA-F]/g, '');
  if (ink) params.set('ink', ink);
  // Hero template variant: swaps the engine's editorial hero for the lead's own register
  // (e.g. dark hero + secondary-accent italics). Engine-side ?hero/?hero_bg/?accent2.
  if (brand.hero) params.set('hero', brand.hero);
  const heroBg = (brand.hero_bg || '').replace(/[^0-9a-fA-F]/g, '');
  if (heroBg) params.set('hero_bg', heroBg);
  const accent2 = (brand.accent2 || '').replace(/[^0-9a-fA-F]/g, '');
  if (accent2) params.set('accent2', accent2);
  // Brand identity + CTA rewiring: the engine renders the CLIENT's name/logo and points the
  // end-screen CTA at THEIR contact page instead of Ivan's Calendly. Additive: an engine
  // that doesn't know these params ignores them. ctaurl must be absolute http(s).
  if (opts?.bname) params.set('bname', opts.bname);
  if (opts?.blogo) params.set('blogo', opts.blogo);
  if (opts?.cta) params.set('cta', opts.cta);
  if (opts?.ctaurl && /^https?:\/\//.test(opts.ctaurl)) params.set('ctaurl', opts.ctaurl);
  return `${RESOURCES_BASE}/${encodeURIComponent(lm.slug)}/?${params.toString()}`;
}

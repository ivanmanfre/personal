/** The V2 scan layout is on only when the build variable is exactly '1'. Unset, '0' or anything else keeps today's layout.
 *  Shared by the app (ScanStoryReport) and the prerender script so both read the switch the same way. */
export const scanHeroOn = (value) => value === '1';

/** A stored `content_system.hero` counts as present unless it is absent or null. A present hero the checks reject still
 *  gets the new layout (its plainest first screen); an absent or null one keeps today's page. */
export const heroPresent = (hero) => hero !== undefined && hero !== null;

/** One predicate for the app and the prerender: the new layout, and with it the partner page at /scan/<slug>/team/,
 *  exists when the switch is on and the scan stores a hero (accepted or rejected). Never for an absent or null hero. */
export const hasScanV2 = (switchValue, hero) => scanHeroOn(switchValue) && heroPresent(hero);

/** Prerender: the slugs whose partner page gets baked, from rows of {company_slug, hero}. */
export const teamSlugs = (rows, switchValue) => Array.isArray(rows)
 ? rows.filter((r) => r && r.company_slug && hasScanV2(switchValue, r.hero)).map((r) => r.company_slug)
 : [];

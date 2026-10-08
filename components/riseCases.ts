// Real RISE case studies for the scan page proof section. Every number is verbatim from the
// brand's own case page on risedtc.com/projects/<slug>/ (read 2026-10-08), and each card links
// there, so the page never says more than RISE's own site says. risedtc.com names these brands
// publicly; the scan links to Mattan's pages rather than restating anything they don't carry.
// Left out on purpose: launch stories ($0 to $X: Ivan's ICP ruling 08-17, prospects are running
// stores), food and beverage (RISE ICP 10-07), Mama Coco (page credits WEBITMD), Gobi Heat (page
// contradicts its own starting spend), and pages with no published numbers.

export type Vertical = 'beauty' | 'apparel' | 'accessories' | 'home';

export interface RiseCase {
  slug: string;
  name: string;
  sells: string;
  headline: string;
  stats: string[];
  image: string;
}

const C: Record<string, RiseCase> = {
  'josie-maran': {
    slug: 'josie-maran', name: 'Josie Maran', sells: 'Skincare and cosmetics, sold at Sephora and Ulta',
    headline: '52% improvement in ROAS',
    stats: ['28% increase in revenue', 'A framework for continued profitable scaling'],
    image: 'https://risedtc.com/wp-content/uploads/2025/04/CaseStudies-bg-josie-maran.jpg',
  },
  instyler: {
    slug: 'instyler', name: 'InStyler', sells: 'Hair tools, moved from infomercials to their own store',
    headline: '452% increase in revenue',
    stats: ['243% increase in ROAS', '481% increase in web traffic'],
    image: 'https://risedtc.com/wp-content/uploads/2025/04/CaseStudies-bg-instyler.jpg',
  },
  'black-and-bloom': {
    slug: 'black-and-bloom', name: 'Black and Bloom', sells: "Women's accessories, Australia into the U.S.",
    headline: 'Average order from $55 to $120',
    stats: ['540% ROAS', 'Repeat orders up 1.6x'],
    image: 'https://risedtc.com/wp-content/uploads/2025/05/CaseStudies-bg-blackBloom.jpg',
  },
  'juv-activewear': {
    slug: 'juv-activewear', name: 'JUV Activewear', sells: 'Activewear, competing with the biggest names in the U.S.',
    headline: '$12M+ in top line sales',
    stats: ['3X+ in-platform ROAS', '25% decrease in CPA'],
    image: 'https://risedtc.com/wp-content/uploads/2025/05/CaseStudies-bg-juv.jpg',
  },
  dickies: {
    slug: 'dickies', name: 'Dickies', sells: "Workwear, launching a women's line",
    headline: '$1M+ in profitable ad spend',
    stats: ['40% reduction in CPA', '33% increase in AOV'],
    image: 'https://risedtc.com/wp-content/uploads/2025/05/CaseStudies-bg-dickies.jpg',
  },
  'tenth-street-hats': {
    slug: 'tenth-street-hats', name: 'Tenth Street Hats', sells: 'Hats, made in the U.S. since 1921',
    headline: '800%+ ROAS on Google',
    stats: ['16+ profitable quarters'],
    image: 'https://risedtc.com/wp-content/uploads/2024/02/TenthStreet_fullRes_1.jpg',
  },
  'vienne-milano': {
    slug: 'vienne-milano', name: 'Vienne Milano', sells: 'Lingerie and stockings, sales had started to slow',
    headline: '272% increase in revenue',
    stats: ['4x increase in first-time customers', '108% increase in conversion rate'],
    image: 'https://risedtc.com/wp-content/uploads/2025/04/vienne-milano-3.jpg',
  },
  'piper-and-skye': {
    slug: 'piper-and-skye', name: 'Piper & Skye', sells: 'Luxury handbags in a crowded category',
    headline: '167% increase in revenue',
    stats: ['104% increase in conversion rate', '147% increase in first-time customers'],
    image: 'https://risedtc.com/wp-content/uploads/2025/05/CaseStudies-bg-piper-skye.jpg',
  },
  pregomesh: {
    slug: 'pregomesh', name: 'Pregomesh', sells: 'Handcrafted jewelry, Europe into the U.S.',
    headline: '6 straight quarters of record revenue',
    stats: ['482% increase in U.S. orders'],
    image: 'https://risedtc.com/wp-content/uploads/2025/04/CaseStudies-bg-pregomesh.jpg',
  },
  'leuchtturm-gruppe': {
    slug: 'leuchtturm-gruppe', name: 'LEUCHTTURM', sells: 'Premium notebooks and writing tools, less Amazon, more DTC',
    headline: '$12k to $150k+ a month on Google, profitably',
    stats: ['84% increase in revenue year over year', '60% more first-time customers'],
    image: 'https://risedtc.com/wp-content/uploads/2025/04/CaseStudies-bg-Leuchtturm.jpg',
  },
  'granite-gold': {
    slug: 'granite-gold', name: 'Granite Gold', sells: 'Stone care products, moved from retail to online',
    headline: '225% increase in order volume',
    stats: ['40% decrease in CPA'],
    image: 'https://risedtc.com/wp-content/uploads/2025/05/CaseStudies-bg-graniteGold.jpg',
  },
  'blazing-bull-grills': {
    slug: 'blazing-bull-grills', name: 'Blazing Bull Grills', sells: 'Infrared grills, a 40+ year old maker going DTC',
    headline: '154% increase in checkouts',
    stats: ['25% AOV increase'],
    image: 'https://risedtc.com/wp-content/uploads/2025/05/CaseStudies-bg-blazingBull.jpg',
  },
};

const BY_VERTICAL: Record<Vertical, string[]> = {
  beauty: ['josie-maran', 'instyler', 'black-and-bloom'],
  apparel: ['juv-activewear', 'dickies', 'vienne-milano'],
  accessories: ['black-and-bloom', 'piper-and-skye', 'tenth-street-hats'],
  home: ['leuchtturm-gruppe', 'granite-gold', 'blazing-bull-grills'],
};

// Word stems read from the store's own category words. Order matters: a lash or skincare store is
// beauty before anything else; apparel is RISE's first ICP and the fallback.
const RULES: Array<[Vertical, RegExp]> = [
  ['beauty', /lash|\bskin(?!ny)|cosmetic|makeup|make-up|beauty|serum|hair|nail|fragrance|perfume|\blip|\bbrow|\bspf|moistur|cleanser|mascara/],
  ['accessories', /jewel|earring|necklace|bracelet|\brings?\b|handbag|\bbags?\b|purse|wallet|\bwatch(es)?\b|sunglass|\bhats?\b|\bcaps?\b/],
  ['home', /\bhome|kitchen|cookware|grill|candle|\bbed|sofa|furniture|cleaning|cleaner|decor|notebook|stationery|\bpens?\b|garden|\bpets?\b|towel|\brugs?\b|\blamps?\b/],
  ['apparel', /shirt|\btees?\b|dress|apparel|wear|legging|\bsocks?\b|\bjeans?\b|denim|hoodie|lingerie|swim|\bbras?\b|jacket|\bpants\b|shorts\b|clothing/],
];

export function caseVertical(words: string[]): Vertical {
  const hay = words.filter(Boolean).join(' ').toLowerCase();
  for (const [v, rx] of RULES) if (rx.test(hay)) return v;
  return 'apparel';
}

export function casesFor(words: string[]): RiseCase[] {
  return BY_VERTICAL[caseVertical(words)].map((s) => C[s]);
}

export function caseUrl(c: RiseCase): string {
  return `https://risedtc.com/projects/${c.slug}/?utm_source=scan&utm_medium=case&utm_campaign=growth-scan&utm_content=${c.slug}`;
}

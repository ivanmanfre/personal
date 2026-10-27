// Per-client look, copied from the live boards' computed --cb-* tokens (26 Oct 2026).
export type Mode = 'gatekeeper' | 'team' | 'buffer';

export type Theme = {
  name: string;
  mode: Mode;
  tz: string;
  tzLabel: string;
  dark: boolean;
  accent: string;
  accentInk: string;
  accentFg: string;
  head: string;
  body: string;
  headColor?: string;
  fonts: string;
  /** First day (YYYY-MM-DD, UTC like the server's report slices) of the client's current billing period.
   *  When set, every outreach and content number on the board counts from this day. */
  periodStart?: string;
};

export const THEMES: Record<string, Theme> = {
  'arch-agency': {
    name: 'ARCH', mode: 'gatekeeper', tz: 'Europe/Zagreb', tzLabel: 'Zagreb', dark: true,
    accent: '#3562FF', accentInk: '#FFFFFF', accentFg: 'color-mix(in srgb, #3562FF 70%, #FFFFFF)',
    head: '"DM Sans"', body: '"DM Sans"', fonts: 'family=DM+Sans:opsz,wght@9..40,300..700',
  },
  'risedtc-com': {
    name: 'RISE DTC', mode: 'buffer', tz: 'America/Los_Angeles', tzLabel: 'PT', dark: true,
    accent: '#FFC71D', accentInk: '#111111', accentFg: '#FFC71D',
    head: 'Sora', body: 'Manrope', fonts: 'family=Sora:wght@300..700&family=Manrope:wght@300..800',
    // Mattan's new billing period starts 24 Oct 2026.
    periodStart: '2026-10-24',
  },
  'swishdm-live': {
    name: 'SwishDM', mode: 'team', tz: 'Europe/London', tzLabel: 'UK', dark: false,
    // White on this orange is 3.16:1; the brand guide puts navy text on orange.
    accent: '#FC5B06', accentInk: '#010D68', accentFg: '#C24603', headColor: '#010D68',
    head: 'Oswald', body: 'Lato', fonts: 'family=Oswald:wght@300..700&family=Lato:wght@300;400;700;900',
  },
};

const FALLBACK: Theme = {
  name: 'Content board', mode: 'buffer', tz: 'Europe/London', tzLabel: 'UK', dark: true,
  accent: '#E8E4D8', accentInk: '#111111', accentFg: '#E8E4D8',
  head: '"DM Sans"', body: '"DM Sans"', fonts: 'family=DM+Sans:opsz,wght@9..40,300..700',
};

/** The client's look. A board not listed above still opens: neutral look, and it approves when the board runs in review mode. */
export function themeFor(slug: string, board?: any): Theme {
  if (THEMES[slug]) return THEMES[slug];
  const name = String(board?.brand?.wordmark || board?.company_name || FALLBACK.name);
  return { ...FALLBACK, name, mode: board?.review_mode ? 'gatekeeper' : 'buffer' };
}

export function cssVars(t: Theme): Record<string, string> {
  const dark = t.dark
    ? { paper: '#0D0D0D', raise: '#161616', sunk: '#141414', ink: '#F5F4F0', soft: 'rgba(255,255,255,0.78)', mute: 'rgba(255,255,255,0.55)', line: 'rgba(255,255,255,0.10)', lineBold: 'rgba(255,255,255,0.24)', plate: '#171717' }
    : { paper: '#FFFFFF', raise: '#FFFFFF', sunk: '#F5F5F5', ink: '#111111', soft: '#333333', mute: '#5F5F59', line: '#E0E0E0', lineBold: 'rgba(17,17,17,0.26)', plate: '#333333' };
  return {
    '--paper': dark.paper, '--raise': dark.raise, '--sunk': dark.sunk, '--ink': dark.ink, '--soft': dark.soft,
    '--mute': dark.mute, '--line': dark.line, '--line-bold': dark.lineBold, '--plate': dark.plate,
    '--accent': t.accent, '--accent-ink': t.accentInk, '--accent-fg': t.accentFg,
    '--head-color': t.headColor || dark.ink,
    '--font-head': `${t.head}, system-ui, sans-serif`, '--font-body': `${t.body}, system-ui, sans-serif`,
  };
}

export function loadFonts(t: Theme) {
  const id = 'fonts-' + t.name;
  if (document.getElementById(id)) return;
  const l = document.createElement('link');
  l.id = id; l.rel = 'stylesheet';
  l.href = `https://fonts.googleapis.com/css2?${t.fonts}&family=Instrument+Sans:wght@400;500;600&display=swap`;
  document.head.appendChild(l);
}

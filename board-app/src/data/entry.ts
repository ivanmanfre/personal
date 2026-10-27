// Which board this page opens, and with which link.
//  - Production: VITE_BOARD_LOCKED_SLUG when the build is locked to one client (white-label host),
//    else the address: /client/<slug>/... gives the segment after `client`, otherwise the first segment.
//  - Dev: ?board=<slug>, with the dev-only view links from VITE_BOARDS (never in a production bundle).
export type BoardRef = { slug: string; k: string };

/** Dev-only full-power view links. `import.meta.env.DEV` is false in a build, so this folds to []. */
export const DEV_BOARDS: BoardRef[] = import.meta.env.DEV ? safeParse(import.meta.env.VITE_BOARDS) : [];

function safeParse(s: unknown): BoardRef[] {
  try { const v = JSON.parse(String(s || '[]')); return Array.isArray(v) ? v : []; } catch { return []; }
}

export type Entry = {
  slug: string;
  /** The ?k= board link, or '' when the page opened without one. */
  token: string;
  /** The board's own base path, ending in '/': '/client/arch-agency/' or '/board/'. */
  base: string;
};

const LOCKED = (import.meta.env.VITE_BOARD_LOCKED_SLUG as string | undefined) || '';

export function readEntry(): Entry {
  const q = new URLSearchParams(location.search);
  const k = q.get('k') || '';
  if (import.meta.env.DEV) {
    const slug = q.get('board') || LOCKED || 'arch-agency';
    // ?nok=1 opens the dev board without its view link, to see the sign-in path.
    const dev = q.get('nok') === '1' ? '' : DEV_BOARDS.find(b => b.slug === slug)?.k || '';
    return { slug, token: k || dev, base: '/' };
  }
  const segs = location.pathname.split('/').filter(Boolean);
  if (LOCKED) return { slug: LOCKED, token: k, base: import.meta.env.BASE_URL || '/' };
  const ci = segs.indexOf('client');
  if (ci >= 0 && segs[ci + 1]) return { slug: decodeURIComponent(segs[ci + 1]), token: k, base: '/' + segs.slice(0, ci + 2).join('/') + '/' };
  return { slug: decodeURIComponent(segs[0] || ''), token: k, base: segs[0] ? `/${segs[0]}/` : '/' };
}

/** The classic board lives at the same address plus `classic/`, carrying the same ?k= link. */
export function classicUrl(e: Entry, liveToken: string) {
  const k = liveToken || new URLSearchParams(location.search).get('k') || '';
  return `${e.base}classic/${k ? `?k=${encodeURIComponent(k)}` : ''}`;
}

/** Tracking and page views skip this browser: local dev, automation, or Ivan's own signed-in browser. */
export function isTestBrowser() {
  try {
    const h = location.hostname;
    if (h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '[::1]' || h.endsWith('.local')) return true;
    if (navigator.webdriver) return true;
    if (localStorage.getItem('dashboard_auth')) return true;
  } catch { /* fall through */ }
  return false;
}

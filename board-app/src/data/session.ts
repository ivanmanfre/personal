// Board sign-in session, stored exactly like the live board (lib/boardSession.ts in personal-site):
// localStorage `board_session_<slug>` = { token, email, expires_at }. Same key on the same origin,
// so anyone already signed in to the classic board stays signed in here, and back.
// The session token and the #ml link token never go into a query param, a log or the title.

export type BoardSession = { token: string; email: string; expires_at: string };

const key = (slug: string) => `board_session_${slug}`;

export function loadBoardSession(slug?: string): BoardSession | null {
  if (!slug) return null;
  try {
    const raw = localStorage.getItem(key(slug));
    if (!raw) return null;
    const s = JSON.parse(raw) as BoardSession;
    if (!s || !s.token) return null;
    if (s.expires_at && new Date(s.expires_at).getTime() < Date.now()) {
      localStorage.removeItem(key(slug));
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function saveBoardSession(slug: string, s: BoardSession) {
  try { localStorage.setItem(key(slug), JSON.stringify(s)); } catch { /* private mode: lives for this tab only */ }
}

export function clearBoardSession(slug?: string) {
  if (!slug) return;
  try { localStorage.removeItem(key(slug)); } catch { /* noop */ }
}

/** `#ml=<token>` (or `#...&ml=<token>`) from a sign-in email, decoded. */
export function readMagicLinkFragment(): string {
  try {
    const m = window.location.hash.match(/[#&]ml=([^&]+)/);
    return m ? decodeURIComponent(m[1]) : '';
  } catch {
    return '';
  }
}

/** Drop the `#ml=` fragment without a navigation, so the token never stays in the address bar. */
export function stripMagicLinkFragment() {
  try {
    if (/[#&]ml=/.test(window.location.hash)) history.replaceState(null, '', window.location.pathname + window.location.search);
  } catch { /* noop */ }
}

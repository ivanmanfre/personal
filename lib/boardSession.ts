// Client-board magic-link session storage + fragment helpers.
//
// Sessions are client-side only: the server (redeem_board_login) stores just a
// hash and returns the raw token once. We keep it in localStorage per slug and
// pass it to get_client_board_by_session / client_board_action_v2 as the secret.
//
// Hygiene law: the session token and the #ml link token NEVER go into query
// params, console.log, or document.title. This module reads the #ml fragment and
// strips it via history.replaceState; the token only ever travels in RPC bodies.

export interface BoardSession {
  token: string;
  email: string;
  expires_at: string;
}

const sessionKey = (slug: string) => `board_session_${slug}`;

export function loadBoardSession(slug?: string): BoardSession | null {
  if (!slug) return null;
  try {
    const raw = localStorage.getItem(sessionKey(slug));
    if (!raw) return null;
    const s = JSON.parse(raw) as BoardSession;
    if (!s || !s.token) return null;
    // Client-side expiry check (defense in depth; the server re-checks too).
    if (s.expires_at && new Date(s.expires_at).getTime() < Date.now()) {
      localStorage.removeItem(sessionKey(slug));
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function saveBoardSession(slug: string, s: BoardSession): void {
  try {
    localStorage.setItem(sessionKey(slug), JSON.stringify(s));
  } catch {
    /* private mode — session lives only for this tab's memory */
  }
}

export function clearBoardSession(slug?: string): void {
  if (!slug) return;
  try {
    localStorage.removeItem(sessionKey(slug));
  } catch {
    /* noop */
  }
}

/** Read a `#ml=<token>` (or `#…&ml=<token>`) magic-link fragment, decoded. */
export function readMagicLinkFragment(): string {
  try {
    const m = window.location.hash.match(/[#&]ml=([^&]+)/);
    return m ? decodeURIComponent(m[1]) : '';
  } catch {
    return '';
  }
}

/** Strip the `#ml=` fragment from the URL without a navigation, so the token is
 *  never left in the address bar / history / share surface. */
export function stripMagicLinkFragment(): void {
  try {
    if (/[#&]ml=/.test(window.location.hash)) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  } catch {
    /* noop */
  }
}

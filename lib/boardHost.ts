/**
 * White-label board addresses (2026-10-15).
 *
 * A board listed here also lives on the client's own domain, built from this same source by
 * `npm run build:board-host` (vite.board-host.config.ts, entry board-host.tsx) and published
 * into that domain's repo (scripts/publish-board-host.sh, deploy.yml `swishdm-board-mirror`).
 * The ivanmanfredi.com / inboundonsteroids.com /client/<slug> route keeps working for the
 * same slug; only the address we hand out and the house branding change.
 *
 * Keep in sync with HOSTED in supabase/functions/board-magic-link/index.ts (sign-in emails
 * requested from the client's domain link back to it).
 */
export const WHITE_LABEL_BOARDS: Record<string, { url: string }> = {
  'swishdm-live': { url: 'https://madebyswishdm.com/board' },
};

/** True when this board is white-labelled: no operator agency name anywhere on it. */
export function isWhiteLabelBoard(slug: string | null | undefined): boolean {
  return !!slug && Object.prototype.hasOwnProperty.call(WHITE_LABEL_BOARDS, slug);
}

/** The plain board address a teammate is given (never the ?k= board link). */
export function boardShareUrl(slug: string): string {
  return isWhiteLabelBoard(slug) ? WHITE_LABEL_BOARDS[slug].url : `https://inboundonsteroids.com/client/${slug}`;
}

/** Canonical address for the board page head. */
export function boardCanonicalUrl(slug: string): string {
  return isWhiteLabelBoard(slug) ? WHITE_LABEL_BOARDS[slug].url : `https://ivanmanfredi.com/client/${slug}`;
}

/**
 * Boards where the per-post Comments thread is the one way to ask for a change (2026-10-16,
 * Ivan: "there is no need for Request changes, we already have the comment"). On these boards
 * the review popup and post cards drop their Request changes / feedback inputs. Comments stay.
 */
const COMMENT_ONLY_CHANGE_BOARDS = new Set(['swishdm-live']);

/** True when change requests on this board go through Comments only. */
export function commentsCarryChanges(slug: string | null | undefined): boolean {
  return !!slug && COMMENT_ONLY_CHANGE_BOARDS.has(slug);
}

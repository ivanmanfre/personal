/** The one check for every buyer and partner profile link the new layout prints (ruling R-LINK, 2026-11-18).
 *  Parsed with the URL constructor; https only; host linkedin.com, www.linkedin.com or a two-letter country
 *  subdomain; no credentials or port; the normalised path is exactly /in/<handle> with an optional trailing slash.
 *  A handle is ASCII letters, digits, hyphen, underscore, or percent-escapes of non-ASCII bytes (%80 to %FF), so
 *  an escaped slash, dot, backslash or percent never passes. The printed link is rebuilt from the parts (origin +
 *  /in/<handle>/), never the stored string: no query, no fragment. Anything else gives no link. */
const HOST = /^(?:www\.|[a-z]{2}\.)?linkedin\.com$/;
const PATH = /^\/in\/((?:[A-Za-z0-9_-]|%[89A-Fa-f][0-9A-Fa-f])+)\/?$/;

export interface ProfileLink { url: string; id: string }

export function profileLink(x: unknown): ProfileLink | undefined {
 if (typeof x !== 'string') return undefined;
 let u: URL;
 try { u = new URL(x.trim()); } catch { return undefined; }
 if (u.protocol !== 'https:' || u.username || u.password || u.port || !HOST.test(u.hostname)) return undefined;
 const m = PATH.exec(u.pathname);
 if (!m) return undefined;
 // One person, one id: handles are case-insensitive and the country subdomain is the same profile.
 return {url: `${u.origin}/in/${m[1]}/`, id: m[1].toLowerCase()};
}

/** The canonical profile URL, or undefined when the stored value fails the check. */
export const profileUrlOf = (x: unknown) => profileLink(x)?.url;

/** Keeps the first row for each person (the list arrives ranked). Rows without a valid profile link are each their own person. */
export function uniqueByProfile<T>(rows: T[], url: (row: T) => unknown): T[] {
 const seen = new Set<string>();
 return rows.filter(r => {
  const id = profileLink(url(r))?.id;
  if (!id) return true;
  if (seen.has(id)) return false;
  seen.add(id);
  return true;
 });
}

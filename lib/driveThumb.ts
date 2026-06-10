// Convert a Google Drive URL into an inline-renderable thumbnail URL.
//
// Drive stores both image renders (PNG/JPG) and carousel PDFs at URLs shaped
// like `https://drive.google.com/file/d/<ID>/view?usp=drivesdk`. Those are
// viewer pages, not direct asset URLs — an <img src> request 302s into the
// viewer HTML and never renders. The fix is `drive.google.com/thumbnail?id=<ID>`,
// which serves a JPEG render at the requested width for both image AND PDF
// (first page) files. No auth needed for assets shared as "Anyone with the link".
export function driveThumbUrl(url: string | null | undefined, size = 200): string | null {
  if (!url) return null;
  const m = url.match(/drive\.google\.com\/file\/d\/([^/]+)/) || url.match(/[?&]id=([^&]+)/);
  if (m) return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w${size}`;
  return url;
}

// Append a cache-busting version token to an asset URL. When an image is
// overwritten at a STABLE storage path (e.g. an LM cover regen writes the same
// slug-derived filename), the URL never changes, so the browser/CDN keep serving
// the old bytes. Keying `?v=` on the row's updated_at forces a refetch exactly
// when the asset actually changed — and nothing else.
export function versionedAssetUrl(url: string | null | undefined, version: string | null | undefined): string | null {
  if (!url) return null;
  if (!version) return url;
  return `${url}${url.includes('?') ? '&' : '?'}v=${encodeURIComponent(version)}`;
}

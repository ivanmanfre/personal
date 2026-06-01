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

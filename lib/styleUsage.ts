export interface DraftUsageRow {
  taxonomy: any;
  image_urls: string[] | null;
  created_at: string;
}

export interface StyleUsage {
  count: number;
  cover: string | null;
}

/**
 * Rewrite a stored image URL into one that actually renders in an <img>.
 * Google-Drive share links (/file/d/ID/view, open?id=ID, uc?id=ID) don't
 * serve image bytes; the /thumbnail?id=ID endpoint does. Everything else
 * http(s) passes through; anything else (null, data:, relative) → null.
 */
export function toRenderableImageUrl(url: string | null | undefined): string | null {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  if (/drive\.google\.com/i.test(url)) {
    const m = url.match(/\/file\/d\/([^/]+)/) || url.match(/[?&]id=([^&]+)/);
    if (m && m[1]) return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w600`;
  }
  return url;
}

/**
 * Group published single-image drafts by taxonomy.image_style. Returns per
 * style the usage count and the most-recent renderable cover (image_urls[0]).
 * Rows without an image_style are ignored; rows whose cover doesn't normalize
 * still count toward the total but don't win the cover pick.
 */
export function aggregateImageStyleUsage(rows: DraftUsageRow[]): Record<string, StyleUsage> {
  const out: Record<string, StyleUsage> = {};
  const bestAt: Record<string, number> = {};
  for (const r of rows) {
    const style = r?.taxonomy?.image_style;
    if (!style || typeof style !== 'string') continue;
    if (!out[style]) {
      out[style] = { count: 0, cover: null };
      bestAt[style] = -Infinity;
    }
    out[style].count++;
    const cover = toRenderableImageUrl(r.image_urls?.[0]);
    const t = new Date(r.created_at).getTime();
    if (cover && t > bestAt[style]) {
      bestAt[style] = t;
      out[style].cover = cover;
    }
  }
  return out;
}

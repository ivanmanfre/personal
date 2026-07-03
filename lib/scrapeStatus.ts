// A post is "scraped" if the n8n tracker has stamped metrics_updated_at OR it
// already carries real metric data (legacy rows that were scraped before the
// metrics_updated_at column existed). Only genuinely empty rows — no timestamp
// AND no metrics — count as "not scraped yet". This keeps never-scraped
// placeholders out of the averages without wrongly zeroing real historical posts.
export interface ScrapeCountable {
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  metricsUpdatedAt: string | null;
}

export function isPostScraped(p: ScrapeCountable): boolean {
  return p.metricsUpdatedAt != null || (p.impressions + p.likes + p.comments + p.shares) > 0;
}

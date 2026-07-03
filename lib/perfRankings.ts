// Pure ranking guards for the Performance panel.
export function minSampleRanking<T extends { count: number }>(rows: T[], minN = 3): { ranked: T[]; pending: T[] } {
  const ranked: T[] = [], pending: T[] = [];
  for (const r of rows) (r.count >= minN ? ranked : pending).push(r);
  return { ranked, pending };
}

// De-duplicate x-axis date labels while preserving first-seen order, so a
// post-indexed chart with two posts on the same day doesn't print the tick twice.
export function dedupeTicks(dates: string[]): string[] {
  const seen = new Set<string>(), out: string[] = [];
  for (const d of dates) { if (!seen.has(d)) { seen.add(d); out.push(d); } }
  return out;
}

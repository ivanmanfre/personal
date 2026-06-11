export type Severity = 'tier1' | 'tier2' | 'tier3';

export interface PendingItem {
  category: string;
  itemKey: string;
  title: string;
  subtitle: string;
  severity: Severity;
  deeplink: string;
  createdAt: string;
}

export interface PendingGroup {
  category: string;
  count: number;
  topSeverity: Severity;
  items: PendingItem[];
}

export const SEVERITY_RANK: Record<Severity, number> = { tier1: 0, tier2: 1, tier3: 2 };

export function mapRow(r: any): PendingItem {
  return {
    category: r.category, itemKey: r.item_key, title: r.title,
    subtitle: r.subtitle || '', severity: (r.severity as Severity) || 'tier3',
    deeplink: r.deeplink, createdAt: r.created_at,
  };
}

export function sortItems(items: PendingItem[]): PendingItem[] {
  return [...items].sort((a, b) =>
    SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
    (b.createdAt || '').localeCompare(a.createdAt || ''));
}

export function computeUnreadCount(items: PendingItem[], lastOpenedAt: string): number {
  return items.filter((i) => i.createdAt > lastOpenedAt).length;
}

export function computeTopSeverity(items: PendingItem[], lastOpenedAt: string): Severity | null {
  const unread = items.filter((i) => i.createdAt > lastOpenedAt);
  if (!unread.length) return null;
  return unread.reduce<Severity>(
    (acc, i) => (SEVERITY_RANK[i.severity] < SEVERITY_RANK[acc] ? i.severity : acc), 'tier3');
}

export function groupByCategory(items: PendingItem[]): PendingGroup[] {
  const m = new Map<string, PendingItem[]>();
  for (const it of items) {
    const arr = m.get(it.category) ?? [];
    arr.push(it);
    m.set(it.category, arr);
  }
  return [...m.entries()]
    .map(([category, its]) => ({
      category,
      count: its.length,
      topSeverity: its.reduce<Severity>(
        (a, i) => (SEVERITY_RANK[i.severity] < SEVERITY_RANK[a] ? i.severity : a), 'tier3'),
      items: its,
    }))
    .sort((a, b) => SEVERITY_RANK[a.topSeverity] - SEVERITY_RANK[b.topSeverity]);
}

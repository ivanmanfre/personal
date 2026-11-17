// Second body shape on scan-open: section views and booking clicks for an open stored a moment ago.
// { kind: 'event', open_id, company_slug, events: [{ kind: 'section_view' | 'cta_click', name }] }, at most 20 events.
// Stored only when the open belongs to that slug and is younger than 6 hours; duplicates are ignored.

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,79}$/i;
const NAME_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
const KINDS = new Set(['section_view', 'cta_click']);
const MAX_EVENTS = 20;
const MAX_AGE_MS = 6 * 3600_000;

export type PageEvent = { kind: 'section_view' | 'cta_click'; name: string };
export type EventBatch = { openId: number; slug: string; events: PageEvent[] };
export type EventsDb = {
  from: (t: string) => {
    select: (c: string) => { eq: (k: string, v: number) => { maybeSingle: () => PromiseLike<{ data: unknown }> } };
    upsert: (rows: unknown[], o: { onConflict: string; ignoreDuplicates: boolean }) => PromiseLike<{ error: unknown }>;
  };
};

export function parseEventBody(body: Record<string, unknown>): EventBatch | null {
  const openId = body.open_id;
  const slug = String(body.company_slug || '').trim();
  if (typeof openId !== 'number' || !Number.isSafeInteger(openId) || openId <= 0) return null;
  if (!SLUG_RE.test(slug) || !Array.isArray(body.events)) return null;
  const seen = new Set<string>();
  const events: PageEvent[] = [];
  for (const e of body.events) {
    if (events.length >= MAX_EVENTS) break;
    const kind = String((e as { kind?: unknown })?.kind ?? '');
    const name = String((e as { name?: unknown })?.name ?? '');
    if (!KINDS.has(kind) || !NAME_RE.test(name) || seen.has(kind + ':' + name)) continue;
    seen.add(kind + ':' + name);
    events.push({ kind: kind as PageEvent['kind'], name });
  }
  return events.length ? { openId, slug: slug.toLowerCase(), events } : null;
}

/** Returns how many events were offered for insert (0 when the open is unknown, of another slug, or too old). */
export async function storeEvents(db: EventsDb, b: EventBatch): Promise<number> {
  const { data } = await db.from('scan_opens').select('company_slug, opened_at').eq('id', b.openId).maybeSingle();
  const open = data as { company_slug?: string; opened_at?: string } | null;
  if (!open || String(open.company_slug || '').toLowerCase() !== b.slug) return 0;
  const age = Date.now() - Date.parse(String(open.opened_at || ''));
  if (!(age >= -60_000 && age <= MAX_AGE_MS)) return 0;
  const rows = b.events.map((e) => ({ open_id: b.openId, company_slug: b.slug, kind: e.kind, name: e.name }));
  await db.from('scan_page_events').upsert(rows, { onConflict: 'open_id,kind,name', ignoreDuplicates: true });
  return rows.length;
}

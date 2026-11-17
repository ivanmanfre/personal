import { describe, expect, it } from 'vitest';
import { parseEventBody, storeEvents } from './events';

describe('parseEventBody', () => {
  const ok = { kind: 'event', open_id: 12, company_slug: 'acme-1', events: [{ kind: 'section_view', name: 'buyers' }, { kind: 'cta_click', name: 'book-close' }] };
  it('accepts a valid batch', () => expect(parseEventBody(ok)).toEqual({ openId: 12, slug: 'acme-1', events: ok.events }));
  it('drops bad names and kinds, keeps the rest', () => expect(parseEventBody({ ...ok, events: [{ kind: 'section_view', name: 'Bad Name' }, { kind: 'scroll', name: 'x' }, { kind: 'cta_click', name: 'book-close' }] })?.events).toEqual([{ kind: 'cta_click', name: 'book-close' }]));
  it('caps a batch at 20', () => expect(parseEventBody({ ...ok, events: Array.from({ length: 30 }, (_, i) => ({ kind: 'section_view', name: 's' + i })) })?.events).toHaveLength(20));
  it('dedupes inside a batch', () => expect(parseEventBody({ ...ok, events: [ok.events[0], ok.events[0]] })?.events).toHaveLength(1));
  it('rejects a missing open id or slug', () => {
    expect(parseEventBody({ ...ok, open_id: 'x' })).toBeNull();
    expect(parseEventBody({ ...ok, open_id: 1.5 })).toBeNull();
    expect(parseEventBody({ ...ok, company_slug: '../x' })).toBeNull();
    expect(parseEventBody({ ...ok, events: 'x' })).toBeNull();
    expect(parseEventBody({ ...ok, events: [] })).toBeNull();
  });
});

function fakeDb(open: { company_slug: string; opened_at: string } | null) {
  const inserted: unknown[] = [];
  return {
    inserted,
    from: (t: string) => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: open }) }) }),
      upsert: async (rows: unknown[], opts: unknown) => { inserted.push({ t, rows, opts }); return { error: null }; },
    }),
  };
}
const batch = { openId: 12, slug: 'acme-1', events: [{ kind: 'section_view' as const, name: 'buyers' }] };

describe('storeEvents', () => {
  it('stores events for a fresh open of the same slug, ignoring duplicates', async () => {
    const db = fakeDb({ company_slug: 'Acme-1', opened_at: new Date(Date.now() - 60_000).toISOString() });
    expect(await storeEvents(db, batch)).toBe(1);
    expect(db.inserted).toEqual([{ t: 'scan_page_events', rows: [{ open_id: 12, company_slug: 'acme-1', kind: 'section_view', name: 'buyers' }], opts: { onConflict: 'open_id,kind,name', ignoreDuplicates: true } }]);
  });
  it('refuses an open of another slug', async () => {
    const db = fakeDb({ company_slug: 'other', opened_at: new Date().toISOString() });
    expect(await storeEvents(db, batch)).toBe(0);
    expect(db.inserted).toEqual([]);
  });
  it('refuses an open older than 6 hours', async () => {
    const db = fakeDb({ company_slug: 'acme-1', opened_at: new Date(Date.now() - 7 * 3600_000).toISOString() });
    expect(await storeEvents(db, batch)).toBe(0);
  });
  it('refuses an unknown open', async () => expect(await storeEvents(fakeDb(null), batch)).toBe(0));
});

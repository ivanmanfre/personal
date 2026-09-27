/**
 * A post slot is a UTC instant chosen on the CLIENT'S wall clock. Copying a UTC (or the
 * browser's) time of day onto another date moves the post an hour on the client's clock
 * whenever a DST change sits in between (EU 25 Oct, US 1 Nov). So every slot here is
 * built from a client-local date + client-local time in the client's own zone, never from
 * the browser's zone and never from a literal UTC hour.
 */
export type ClientSlot = { tz: string; slot: string };

/** Posting clock per client_id. Unknown clients read like the board's default zone (LA). */
export const CLIENT_SLOTS: Record<string, ClientSlot> = {
  ivan: { tz: 'Europe/Madrid', slot: '09:00' },
  risedtc: { tz: 'America/Los_Angeles', slot: '07:00' },
  arch: { tz: 'Europe/Zagreb', slot: '09:00' },
};
const DEFAULT_SLOT: ClientSlot = { tz: 'America/Los_Angeles', slot: '09:00' };
export const clientSlot = (clientId?: string | null): ClientSlot =>
  (clientId && CLIENT_SLOTS[clientId]) || DEFAULT_SLOT;

/** Wall-clock date (YYYY-MM-DD) + time (HH:MM) in `tz` -> UTC ISO instant. The offset is
 *  read from `tz` at noon of that date, so it is right on either side of a DST change. */
export function wallToUtcISO(dateStr: string, timeStr: string, tz: string): string {
  const probe = new Date(`${dateStr}T12:00:00Z`);
  const asTz = new Date(probe.toLocaleString('en-US', { timeZone: tz }));
  const asUTC = new Date(probe.toLocaleString('en-US', { timeZone: 'UTC' }));
  const offMin = Math.round((asUTC.getTime() - asTz.getTime()) / 60000); // +420 for PDT
  const [hh, mm] = timeStr.split(':').map((n) => parseInt(n, 10));
  const base = new Date(`${dateStr}T00:00:00Z`).getTime();
  return new Date(base + (hh * 60 + mm + offMin) * 60000).toISOString();
}

/** The `tz` wall-clock date (YYYY-MM-DD) + time (HH:MM) of an instant. */
export function wallParts(at: string | number | Date, tz: string): { date: string; time: string } {
  const d = new Date(at);
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  return { date, time };
}

/** Drag-to-a-day: the new instant for `isoDate`, keeping the draft's own time of day ON THE
 *  CLIENT'S CLOCK (the client's slot when it has none yet). */
export function rescheduleInstant(scheduledAt: string | null | undefined, isoDate: string, clientId?: string | null): string {
  const { tz, slot } = clientSlot(clientId);
  const time = scheduledAt ? wallParts(scheduledAt, tz).time : slot;
  return wallToUtcISO(isoDate, time, tz);
}

/** Next open buffer slot: 4 client-local days out, rolled off the weekend, at the client's slot. */
export function nextBufferSlot(clientId?: string | null, now: Date = new Date()): string {
  const { tz, slot } = clientSlot(clientId);
  const d = new Date(`${wallParts(now, tz).date}T00:00:00Z`); // pure calendar maths on the client's date
  d.setUTCDate(d.getUTCDate() + 4);
  const day = d.getUTCDay();
  if (day === 6) d.setUTCDate(d.getUTCDate() + 2);
  else if (day === 0) d.setUTCDate(d.getUTCDate() + 1);
  return wallToUtcISO(d.toISOString().slice(0, 10), slot, tz);
}

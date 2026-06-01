import { supabase } from './supabase';

/**
 * Finds the next available posting slot.
 *
 * Strategy:
 *   - Default cadence: 1 slot per weekday, 09:00 in Ivan's local TZ (Buenos Aires)
 *   - Scan from tomorrow forward
 *   - Skip any slot that collides with an already-scheduled scheduled_post (±2h window)
 *   - Cap the scan at 30 days out
 *
 * Returns an ISO string suitable for inserting into an <input type="datetime-local">
 * field via toLocalParts() OR for raw use as scheduled_at.
 */
const TZ = 'America/Argentina/Buenos_Aires';
const SLOT_HOUR_LOCAL = 9;
const COLLISION_WINDOW_HOURS = 2;

function ymdInTz(d: Date, tz: string): { y: number; m: number; d: number } {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  const parts = Object.fromEntries(fmt.formatToParts(d).filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]));
  return { y: +parts.year, m: +parts.month, d: +parts.day };
}

function buildSlot(year: number, month: number, day: number, hour: number, tz: string): Date {
  // Construct a Date that represents `hour:00 on year-month-day in tz`.
  // We approximate by building a UTC string, then shifting by the tz offset for that local time.
  // Two-iteration fixed-point converges for any IANA tz including DST transitions.
  let attempt = new Date(Date.UTC(year, month - 1, day, hour, 0, 0));
  for (let i = 0; i < 3; i++) {
    const tzParts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false,
    }).formatToParts(attempt);
    const got: any = Object.fromEntries(tzParts.filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]));
    const drift = (year - +got.year) * 365 * 24 + (month - +got.month) * 31 * 24 + (day - +got.day) * 24 + (hour - +got.hour);
    if (drift === 0) break;
    attempt = new Date(attempt.getTime() + drift * 3600_000);
  }
  return attempt;
}

export async function findNextSlot(): Promise<Date> {
  // Pull all upcoming scheduled posts
  const { data } = await supabase
    .from('scheduled_posts')
    .select('scheduled_at')
    .gte('scheduled_at', new Date().toISOString())
    .in('status', ['scheduled', 'pending', 'posting']);
  const taken = (data || []).map((r: any) => new Date(r.scheduled_at).getTime()).sort((a, b) => a - b);

  const now = new Date();
  const todayLocal = ymdInTz(now, TZ);
  for (let offset = 1; offset <= 30; offset++) {
    const candidate = new Date(Date.UTC(todayLocal.y, todayLocal.m - 1, todayLocal.d + offset, 0, 0, 0));
    const cl = ymdInTz(candidate, TZ);
    const slot = buildSlot(cl.y, cl.m, cl.d, SLOT_HOUR_LOCAL, TZ);
    const slotMs = slot.getTime();
    // Skip weekends (Saturday=6, Sunday=0 in Date.getUTCDay)
    const dow = new Date(Date.UTC(cl.y, cl.m - 1, cl.d)).getUTCDay();
    if (dow === 0 || dow === 6) continue;
    const collides = taken.some((t) => Math.abs(t - slotMs) < COLLISION_WINDOW_HOURS * 3600_000);
    if (!collides) return slot;
  }
  // Fallback: just return tomorrow 9am even if it collides
  const t = ymdInTz(new Date(Date.now() + 24 * 3600_000), TZ);
  return buildSlot(t.y, t.m, t.d, SLOT_HOUR_LOCAL, TZ);
}

/** Formats a Date for an <input type="datetime-local"> in Ivan's tz. */
export function toDatetimeLocalString(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d);
  const p: any = Object.fromEntries(parts.filter((x) => x.type !== 'literal').map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

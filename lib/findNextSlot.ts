import { supabase } from './supabase';

/**
 * Finds the next available posting slot.
 *
 * Strategy:
 *   - Default cadence: 2 slots per day at 09:00 + 14:00 in Ivan's local TZ
 *     (Buenos Aires) — morning window for global + early-afternoon for US East/Central.
 *     Weekends included (audience engages on Sat/Sun too).
 *   - Scan from tomorrow forward, fills each day before moving on
 *   - Skip any slot that collides with an already-scheduled scheduled_post (±2h window)
 *   - Cap the scan at 30 days out
 *
 * Returns a Date in UTC representing the chosen slot. Use toDatetimeLocalString()
 * to render in the BA-aware <input type="datetime-local"> field.
 */
const TZ = 'America/Argentina/Buenos_Aires';
// 2026-06-05: restored 2-slots-per-day cadence (was 1/day after the 09:00-only
// rewrite). 09:00 BA = US East Coast morning; 14:00 BA = US lunch window.
const SLOT_HOURS_LOCAL = [9, 14];
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
  const nowMs = now.getTime();
  for (let offset = 1; offset <= 30; offset++) {
    // Anchor at 12:00 UTC (not midnight) so when we convert to BA we land on
    // the intended local day. Midnight UTC = 21:00 BA the PREVIOUS day, which
    // was making us pick today's already-past 9am slot.
    const candidate = new Date(Date.UTC(todayLocal.y, todayLocal.m - 1, todayLocal.d + offset, 12, 0, 0));
    const cl = ymdInTz(candidate, TZ);
    // Weekends are intentionally NOT skipped — post every day, incl. Sat/Sun.
    // Try each slot hour for this day in order — fill the day before moving on.
    for (const hour of SLOT_HOURS_LOCAL) {
      const slot = buildSlot(cl.y, cl.m, cl.d, hour, TZ);
      const slotMs = slot.getTime();
      if (slotMs <= nowMs) continue;
      const collides = taken.some((t) => Math.abs(t - slotMs) < COLLISION_WINDOW_HOURS * 3600_000);
      if (!collides) return slot;
    }
  }
  // Fallback: 36h from now in BA at the first slot hour, guaranteed future
  const t = ymdInTz(new Date(Date.now() + 36 * 3600_000), TZ);
  return buildSlot(t.y, t.m, t.d, SLOT_HOURS_LOCAL[0], TZ);
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

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
// 2-slots-per-day cadence, each within a WINDOW rather than a fixed time, so the
// auto-pick varies the minute day-to-day instead of posting at a robotic 09:00 /
// 14:00 every single day. Windows stay centered on the proven times — morning
// (~09:00 BA = US East Coast morning) and early-afternoon (~14:00 BA = US lunch).
//   startMin = minutes from local midnight; spreadMin = random jitter added on top.
const SLOT_WINDOWS = [
  { startMin: 8 * 60 + 30, spreadMin: 75 },  // 08:30–09:45 BA
  { startMin: 13 * 60 + 30, spreadMin: 75 }, // 13:30–14:45 BA
];
const COLLISION_WINDOW_HOURS = 2;

// Pick a random hour:minute inside a window.
function pickSlotTime(w: { startMin: number; spreadMin: number }): { hour: number; minute: number } {
  const total = w.startMin + Math.floor(Math.random() * (w.spreadMin + 1));
  return { hour: Math.floor(total / 60), minute: total % 60 };
}

function ymdInTz(d: Date, tz: string): { y: number; m: number; d: number } {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  const parts = Object.fromEntries(fmt.formatToParts(d).filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]));
  return { y: +parts.year, m: +parts.month, d: +parts.day };
}

function buildSlot(year: number, month: number, day: number, hour: number, minute: number, tz: string): Date {
  // Construct a Date that represents `hour:minute on year-month-day in tz`.
  // We approximate by building a UTC string, then shifting by the tz offset for that local time.
  // Two-iteration fixed-point converges for any IANA tz including DST transitions.
  // (Only whole-hour drift is corrected; the minute is preserved across shifts.)
  let attempt = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
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
    // Try each window for this day in order — fill the day before moving on.
    for (const w of SLOT_WINDOWS) {
      const { hour, minute } = pickSlotTime(w);
      const slot = buildSlot(cl.y, cl.m, cl.d, hour, minute, TZ);
      const slotMs = slot.getTime();
      if (slotMs <= nowMs) continue;
      const collides = taken.some((t) => Math.abs(t - slotMs) < COLLISION_WINDOW_HOURS * 3600_000);
      if (!collides) return slot;
    }
  }
  // Fallback: 36h from now in BA in the first window, guaranteed future
  const t = ymdInTz(new Date(Date.now() + 36 * 3600_000), TZ);
  const f = pickSlotTime(SLOT_WINDOWS[0]);
  return buildSlot(t.y, t.m, t.d, f.hour, f.minute, TZ);
}

/**
 * Formats a Date as browser-LOCAL wall-clock for an <input type="datetime-local">.
 * Local (not BA) on purpose: the input is parsed back with `new Date(value)`,
 * which interprets the string in the browser's timezone — so the field must be
 * filled in that same local basis or the round-trip shifts the time. This keeps
 * the editor consistent with the rest of the dashboard, which shows local time.
 * (Scheduling windows are still BA-anchored inside findNextSlot.)
 */
export function toDatetimeLocalString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Seed value for a schedule <input type="datetime-local"> from a row's current
 * scheduled_at. Returns the local "YYYY-MM-DDTHH:mm" string, or '' when there's
 * no valid time. Editors MUST seed from this so the field shows the current
 * schedule (instead of empty) and the action becomes "Update <that time>"
 * rather than silently auto-slotting to a different date.
 */
export function initialScheduleInput(scheduledAt: string | null | undefined): string {
  if (!scheduledAt) return '';
  const d = new Date(scheduledAt);
  if (Number.isNaN(d.getTime())) return '';
  return toDatetimeLocalString(d);
}

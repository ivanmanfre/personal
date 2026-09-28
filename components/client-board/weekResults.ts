/**
 * weekResults: the numbers behind the results plate at the top of the week page
 * (2026-09-29). Pure functions over `board.outreach_truth`, nothing else: calls booked in
 * the calendar month (the last 30 days during a month's first 7 days, so the plate never
 * opens on an early-month near-zero), who booked, who wrote back in the last 7 days, and a
 * weekly replies series with the calls booked each week.
 *
 * Every sentence the plate prints is built here from counts, so a slowdown reads as a
 * slowdown ("1 call booked last week, down from 3 the week before") and nothing is spun.
 */

export type WeekResultsTruth = {
  counted_at?: string | null;
  booked?: Array<{ name?: string | null; company?: string | null; booked_at?: string | null }> | null;
  replied_7d?: Array<{ name?: string | null; reply_intent?: string | null }> | null;
  replied_weekly?: Array<{ week_monday: string; people: number }> | null;
  funnel?: { contacted?: number | null } | null;
} | null | undefined;

export type BookedPerson = { name: string; company: string | null; day: string };
export type WeekBar = { monday: string; people: number; calls: number; current: boolean };
export type WeekResults = {
  /** 'month' = calendar month to date, '30d' = the trailing 30 days (first 7 days of a month). */
  window: 'month' | '30d';
  /** "in September" / "in the last 30 days". */
  label: string;
  n: number;
  people: BookedPerson[];
  /** The same count for the window before: "10 in August" / "4 in the 30 days before". */
  prev: { n: number; label: string };
  total: number;
  firstDay: string | null;
  contacted: number | null;
  /** Calls last full week against the week before, in plain words, or null with no history. */
  pace: string | null;
  wrote: { n: number; positive: number };
  weeks: WeekBar[];
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MON_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];

const fmtCache = new Map<string, Intl.DateTimeFormat>();
/** YYYY-MM-DD of an instant in a zone. */
export function dayIn(ts: string | null | undefined, tz: string): string | null {
  if (!ts) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(ts)) return ts;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  let f = fmtCache.get(tz);
  if (!f) { f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }); fmtCache.set(tz, f); }
  return f.format(d);
}
const noon = (k: string) => new Date(k + 'T12:00:00Z');
export const shift = (k: string, n: number) => new Date(noon(k).getTime() + n * 86400000).toISOString().slice(0, 10);
export const mondayOf = (k: string) => shift(k, -((noon(k).getUTCDay() + 6) % 7));
/** "6 Aug", the board's own short style. */
export const dayMonth = (k: string) => `${parseInt(k.slice(8, 10), 10)} ${MON_SHORT[parseInt(k.slice(5, 7), 10) - 1]}`;

const callWord = (n: number) => (n === 1 ? 'call' : 'calls');

export function initialsOf(name: string): string {
  const parts = name.replace(/[^\p{L}\s'-]/gu, ' ').split(/\s+/).filter(Boolean);
  const a = parts[0]?.charAt(0) ?? '';
  const b = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
  return (a + b).toUpperCase() || '?';
}
export const firstNameOf = (name: string) => name.trim().split(/\s+/)[0] || name;

/** "Karin, Trent, Constance, Sophie and 5 more". */
export function namesLine(names: string[], max = 4): string {
  const xs = names.filter(Boolean);
  if (xs.length <= 1) return xs[0] ?? '';
  if (xs.length > max + 1) return `${xs.slice(0, max).join(', ')} and ${xs.length - max} more`;
  return `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
}

export function weekResults(ot: WeekResultsTruth, today: string, tz: string, nWeeks = 9): WeekResults | null {
  if (!ot || !ot.counted_at) return null;

  /* booked: one row per person (name + company), dated in the board's zone, newest first */
  const seen = new Set<string>();
  const booked: BookedPerson[] = [];
  for (const b of ot.booked || []) {
    const day = dayIn(b.booked_at, tz);
    const name = (b.name || '').trim();
    if (!day || !name || day > today) continue;
    const key = `${name.toLowerCase()}|${(b.company || '').trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    booked.push({ name, company: (b.company || '').trim() || null, day });
  }
  booked.sort((a, z) => z.day.localeCompare(a.day));

  const dom = parseInt(today.slice(8, 10), 10);
  const y = parseInt(today.slice(0, 4), 10);
  const m = parseInt(today.slice(5, 7), 10);
  let window: WeekResults['window'];
  let from: string; let prevFrom: string; let prevTo: string; let label: string; let prevLabel: string;
  if (dom <= 7) {
    window = '30d';
    from = shift(today, -29);
    prevTo = shift(from, -1);
    prevFrom = shift(prevTo, -29);
    label = 'in the last 30 days';
    prevLabel = 'in the 30 days before';
  } else {
    window = 'month';
    from = `${today.slice(0, 7)}-01`;
    const pm = m === 1 ? 12 : m - 1;
    const py = m === 1 ? y - 1 : y;
    prevFrom = `${py}-${String(pm).padStart(2, '0')}-01`;
    prevTo = shift(from, -1);
    label = `in ${MONTHS[m - 1]}`;
    prevLabel = `in ${MONTHS[pm - 1]}`;
  }
  const people = booked.filter((b) => b.day >= from && b.day <= today);
  const prevN = booked.filter((b) => b.day >= prevFrom && b.day <= prevTo).length;

  /* pace: calls booked in the last full Mon-Sun week against the week before */
  const thisMon = mondayOf(today);
  const lastMon = shift(thisMon, -7);
  const prevMon = shift(thisMon, -14);
  const inWeek = (mon: string) => booked.filter((b) => b.day >= mon && b.day < shift(mon, 7)).length;
  const last = inWeek(lastMon);
  const before = inWeek(prevMon);
  let pace: string | null = null;
  const firstDay = booked.length ? booked[booked.length - 1].day : null;
  if (firstDay && firstDay < lastMon) {
    if (last === 0 && before === 0) pace = 'No calls booked in the last two weeks.';
    else if (last < before) pace = `${last === 0 ? 'No calls' : `${last} ${callWord(last)}`} booked last week, down from ${before} the week before.`;
    else if (last > before) pace = `${last} ${callWord(last)} booked last week, up from ${before} the week before.`;
    else pace = `${last} ${callWord(last)} booked last week, the same as the week before.`;
  }

  /* wrote back in the last 7 days, and how many of them were positive */
  const r7 = ot.replied_7d || [];
  const wrote = { n: r7.length, positive: r7.filter((r) => r.reply_intent === 'positive').length };

  /* the weekly series: the blob's own Monday grid, calls dropped onto the week they landed */
  const grid = [...(ot.replied_weekly || [])].sort((a, z) => a.week_monday.localeCompare(z.week_monday)).slice(-nWeeks);
  const weeks: WeekBar[] = grid.map((w) => {
    const mon = w.week_monday.slice(0, 10);
    return { monday: mon, people: w.people || 0, calls: inWeek(mon), current: mon >= thisMon };
  });

  const contacted = typeof ot.funnel?.contacted === 'number' && ot.funnel.contacted > 0 ? ot.funnel.contacted : null;
  return {
    window, label, n: people.length, people,
    prev: { n: prevN, label: prevLabel },
    total: booked.length, firstDay, contacted, pace, wrote, weeks,
  };
}

/** The sub-line under the big number: "10 in August. 19 since the first one on 6 Aug, from
 *  1,586 people contacted." Every clause drops out on its own when its input is missing. */
export function resultsSubline(r: WeekResults): string {
  const out: string[] = [];
  out.push(`${r.prev.n} ${r.prev.label}.`);
  if (r.total > 0 && r.firstDay) {
    out.push(`${r.total} since the first one on ${dayMonth(r.firstDay)}${r.contacted ? `, from ${r.contacted.toLocaleString('en-US')} people contacted` : ''}.`);
  }
  return out.join(' ');
}

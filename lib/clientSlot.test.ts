/**
 * ClientOps calendar slots vs DST (27 Sep). Dragging a post across a clock change must keep
 * it at the same time ON THE CLIENT'S CLOCK, whatever zone the operator's browser sits in.
 * The old onReschedule kept the BROWSER's local time and nextBufferSlot kept the browser's
 * time of day, so a Warsaw viewer moving a 07:00 PT RISE post across 1 Nov stored 06:00 PT.
 * Node honours a runtime change of process.env.TZ, so each case forces the viewer zone.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { rescheduleInstant, nextBufferSlot, wallToUtcISO, wallParts } from './clientSlot';

const ORIGINAL_TZ = process.env.TZ;
afterAll(() => { process.env.TZ = ORIGINAL_TZ; });

describe.each(['Europe/Warsaw', 'America/Los_Angeles'])('viewer in %s', (viewer) => {
  it('risedtc: 07:00 PDT dragged across 1 Nov stays 07:00 PST', () => {
    process.env.TZ = viewer;
    // Fri 30 Oct 07:00 PDT = 14:00Z -> Mon 2 Nov 07:00 PST = 15:00Z
    expect(rescheduleInstant('2026-10-30T14:00:00Z', '2026-11-02', 'risedtc')).toBe('2026-11-02T15:00:00.000Z');
    // and back again
    expect(rescheduleInstant('2026-11-02T15:00:00Z', '2026-10-30', 'risedtc')).toBe('2026-10-30T14:00:00.000Z');
  });

  it('arch: 09:00 CEST dragged across 25 Oct stays 09:00 CET', () => {
    process.env.TZ = viewer;
    // Fri 23 Oct 09:00 CEST = 07:00Z -> Mon 26 Oct 09:00 CET = 08:00Z
    expect(rescheduleInstant('2026-10-23T07:00:00Z', '2026-10-26', 'arch')).toBe('2026-10-26T08:00:00.000Z');
  });

  it('no DST in between keeps the UTC hour', () => {
    process.env.TZ = viewer;
    expect(rescheduleInstant('2026-10-06T14:00:00Z', '2026-10-08', 'risedtc')).toBe('2026-10-08T14:00:00.000Z');
    expect(rescheduleInstant('2026-11-10T08:00:00Z', '2026-11-12', 'ivan')).toBe('2026-11-12T08:00:00.000Z');
  });

  it('an unscheduled draft lands on the client slot in the client zone', () => {
    process.env.TZ = viewer;
    expect(rescheduleInstant(null, '2026-11-02', 'risedtc')).toBe('2026-11-02T15:00:00.000Z'); // 07:00 PST
    expect(rescheduleInstant(null, '2026-10-26', 'arch')).toBe('2026-10-26T08:00:00.000Z');    // 09:00 CET
    expect(rescheduleInstant(null, '2026-10-23', 'ivan')).toBe('2026-10-23T07:00:00.000Z');    // 09:00 CEST
  });

  it('nextBufferSlot: 4 client-local days out, off the weekend, at the client slot', () => {
    process.env.TZ = viewer;
    // Thu 29 Oct 2026 20:00Z: +4 = Mon 2 Nov (LA) -> 07:00 PST
    expect(nextBufferSlot('risedtc', new Date('2026-10-29T20:00:00Z'))).toBe('2026-11-02T15:00:00.000Z');
    // Wed 21 Oct 23:30Z = Thu 22 Oct in Zagreb: +4 = Mon 26 Oct -> 09:00 CET
    expect(nextBufferSlot('arch', new Date('2026-10-21T23:30:00Z'))).toBe('2026-10-26T08:00:00.000Z');
    // Tue 27 Oct 12:00Z: +4 = Sat 31 Oct in Madrid, rolled to Mon 2 Nov 09:00 CET
    expect(nextBufferSlot('ivan', new Date('2026-10-27T12:00:00Z'))).toBe('2026-11-02T08:00:00.000Z');
  });

  it('wallToUtcISO / wallParts round-trip in the client zone', () => {
    process.env.TZ = viewer;
    for (const [date, time, tz] of [
      ['2026-10-30', '07:00', 'America/Los_Angeles'], ['2026-11-02', '07:00', 'America/Los_Angeles'],
      ['2026-10-23', '09:00', 'Europe/Zagreb'], ['2026-10-26', '09:00', 'Europe/Zagreb'],
    ] as const) {
      expect(wallParts(wallToUtcISO(date, time, tz), tz)).toEqual({ date, time });
    }
  });
});

export function withinWindow(dateISO: string | null | undefined, days: number, nowMs: number): boolean {
  if (!dateISO) return false;
  const t = Date.parse(dateISO);
  if (Number.isNaN(t)) return false;
  return t >= nowMs - days * 86_400_000;
}

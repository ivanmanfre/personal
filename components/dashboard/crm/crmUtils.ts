export const PIPELINE = ['new','engaged','qualified','call_booked','proposal_sent','negotiating','won'] as const;
export const ALL_STAGES = [...PIPELINE, 'lost', 'nurture'] as const;

export interface StageMeta { label: string; c: string; bg: string; }
// On-system: status uses sage(good) / amber(warn) / red(bad) / neutral-grey only.
// Blue (--d-accent) is reserved for focus/info, not status. Chip colors match the funnel
// buckets (cold=new, warm=all active, win=won).
export const STAGE_META: Record<string, StageMeta> = {
  new:           { label: 'New',         c: 'var(--d-paper-dim)',    bg: 'rgba(180,183,192,.10)' },
  engaged:       { label: 'Engaged',     c: 'var(--d-warn)',         bg: 'var(--d-warn-bg)' },
  qualified:     { label: 'Qualified',   c: 'var(--d-warn)',         bg: 'var(--d-warn-bg)' },
  call_booked:   { label: 'Call booked', c: 'var(--d-warn)',         bg: 'var(--d-warn-bg)' },
  proposal_sent: { label: 'Proposal',    c: 'var(--d-warn)',         bg: 'var(--d-warn-bg)' },
  negotiating:   { label: 'Negotiating', c: 'var(--d-warn)',         bg: 'var(--d-warn-bg)' },
  won:           { label: 'Won',         c: 'var(--d-good)',         bg: 'var(--d-good-bg)' },
  lost:          { label: 'Lost',        c: 'var(--d-bad)',          bg: 'var(--d-bad-bg)' },
  nurture:       { label: 'Nurture',     c: 'var(--d-paper-dimmer)', bg: 'rgba(156,160,171,.08)' },
};
export const stageMeta = (s: string): StageMeta => STAGE_META[s] || STAGE_META.new;

export function initials(name: string): string {
  const p = (name || '?').trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '?';
  return (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
}

// deterministic warm avatar color from a string
export function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < (seed || '').length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return `hsl(${h} 42% 62%)`;
}

export function relTime(iso: string | null): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (isNaN(t)) return '—';
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return 'now';
  const m = Math.floor(s / 60); if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24); if (d < 7) return `${d}d`;
  const w = Math.floor(d / 7); if (w < 5) return `${w}w`;
  const mo = Math.floor(d / 30); if (mo < 12) return `${mo}mo`;
  return `${Math.floor(d / 365)}y`;
}

export const TODAY = () => new Date().toISOString().slice(0, 10);

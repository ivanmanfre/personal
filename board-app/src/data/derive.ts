import type { Model, Post, PostStatus } from './model';
import { addDays, dayKey, fmtWhen, weekOf } from './model';

type StatusOf = (p: Post) => PostStatus;

export const whenOf = (p: Post) => p.publishedAt || p.scheduledAt;

export function needsOk(m: Model, statusOf: StatusOf) {
  return m.posts.filter(p => statusOf(p) === 'needs_ok');
}

export function upcoming(m: Model, statusOf: StatusOf, now = new Date()) {
  // A post whose time has passed but is still not out is held or late; never call it "next out".
  return m.posts
    .filter(p => statusOf(p) === 'scheduled' && p.scheduledAt && new Date(p.scheduledAt) >= now)
    .sort((a, b) => a.scheduledAt!.localeCompare(b.scheduledAt!));
}

export function nextOut(m: Model, statusOf: StatusOf) {
  return upcoming(m, statusOf)[0];
}

export function nextSevenDays(m: Model, statusOf: StatusOf, now = new Date()) {
  const today = dayKey(now, m.theme.tz);
  const end = addDays(today, 6);
  return upcoming(m, statusOf, now).filter(p => dayKey(p.scheduledAt!, m.theme.tz) <= end);
}

export function weekDays(m: Model, statusOf: StatusOf, now = new Date()) {
  const wk = weekOf(now, m.theme.tz);
  return wk.days.map(day => {
    const posts = m.posts.filter(p => {
      const s = statusOf(p);
      if (s !== 'scheduled' && s !== 'live') return false;
      const w = whenOf(p);
      return !!w && dayKey(w, m.theme.tz) === day;
    });
    return { day, isToday: day === wk.today, isPast: day < wk.today, posts };
  });
}

export function published(m: Model, statusOf: StatusOf) {
  return m.posts.filter(p => statusOf(p) === 'live').sort((a, b) => (whenOf(b) || '').localeCompare(whenOf(a) || ''));
}

export function archived(m: Model, statusOf: StatusOf) {
  return m.posts.filter(p => statusOf(p) === 'archived').sort((a, b) => (b.archivedAt || '').localeCompare(a.archivedAt || ''));
}

export const reviewMinutes = (n: number) => Math.max(1, Math.round(n * 1.25));

export function whenLabel(p: Post, m: Model) {
  const w = whenOf(p);
  if (!w) return '';
  const { day, time } = fmtWhen(w, m.theme.tz);
  return `${day}, ${time} ${m.theme.tzLabel}`;
}

export const fmtInt = (n: number) => n.toLocaleString('en-GB');

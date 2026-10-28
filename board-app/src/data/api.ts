// Every call the board makes to Supabase: anon-key RPCs over fetch, the same functions and the same
// auth routing as the live board (components/ClientBoardPage.tsx in personal-site):
//  - reads: a ?k= board link uses the token functions; without one, the signed-in session uses the _v2 functions.
//  - writes: a signed-in member acts as themselves (_v2 with p_session); the bare ?k= link is the fallback (v1, p_token).
//  - comments need a signed-in person: board_comment_add / _v2 take a session only, never a board link.
import type { BoardSession } from './session';

const URL = import.meta.env.VITE_SUPABASE_URL as string;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export type Cred = { slug: string; token: string; session: BoardSession | null };

const headers = () => ({ apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' });

async function rpc<T>(name: string, body: Record<string, unknown>, keepalive = false): Promise<T> {
  const r = await fetch(`${URL}/rest/v1/rpc/${name}`, { method: 'POST', headers: headers(), body: JSON.stringify(body), keepalive });
  if (!r.ok) throw new Error(`${name} ${r.status}`);
  const t = await r.text();
  return (t ? JSON.parse(t) : null) as T;
}

export type RawComment = {
  id: string; ref: string; at: string; by: string | null; text: string; parent: string | null;
  mentions?: { email: string; label: string }[]; resolved_at?: string | null; resolved_by?: string | null;
};

export type Member = { email: string; name?: string | null; role?: string | null; owner?: boolean };
export type TeamRes = Res & { members?: Member[]; cap?: number; already_member?: boolean };

export type Raw = {
  board: any;
  slot: { approved?: string[]; approved_meta?: Record<string, { at: string; by: string | null }>; removed?: string[] } | null;
  activity: any[];
  report?: any | null;
  signals?: any | null;
  audience?: any | null;
  comments: RawComment[];
  /** carousel_drafts.scheduled_at per post: the schedule authority (a reschedule does not rewrite the queue's own field). */
  schedule: Record<string, string | null> | null;
  /** board_team_list: everyone who can sign in, with names and roles. */
  members: Member[];
  /** Seats on the team list. */
  teamCap: number;
  /** Role of whoever is looking: 'admin' for the bare board link, else the member's role. */
  role: string;
  /** Email of the signed-in member, when there is one. */
  me: string | null;
};

export class AuthError extends Error {}

export async function loadBoard(c: Cred): Promise<Raw> {
  const s = c.session?.token || null;
  const both = { p_slug: c.slug, p_session: s, p_token: c.token || null };
  const soft = <T,>(p: Promise<T>) => p.catch(() => null);
  let b: any, slot: any, report: any, signals: any, audience: any, sched: any;
  if (c.token) {
    const t = { p_slug: c.slug, p_token: c.token };
    [b, slot, report, signals, audience, sched] = await Promise.all([
      rpc<any>('get_client_board', t),
      soft(rpc<any>('client_board_slot_state', t)),
      soft(rpc<any>('client_board_report', t)),
      soft(rpc<any>('client_board_funnel_signals', t)),
      soft(rpc<any>('client_board_audience', t)),
      soft(rpc<any>('client_board_schedule', t)),
    ]);
  } else if (s) {
    const v = { p_slug: c.slug, p_session: s };
    [b, slot, report, signals, audience, sched] = await Promise.all([
      rpc<any>('get_client_board_by_session', v),
      soft(rpc<any>('client_board_slot_state_v2', v)),
      soft(rpc<any>('client_board_report_v2', v)),
      soft(rpc<any>('client_board_funnel_signals_v2', v)),
      soft(rpc<any>('client_board_audience_v2', v)),
      soft(rpc<any>('client_board_schedule_v2', v)),
    ]);
  } else {
    throw new AuthError('no credentials');
  }
  const resp = Array.isArray(b) ? b[0] : b;
  if (!resp || !resp.board) throw new AuthError('board did not open');
  const [act, comments, team] = await Promise.all([
    soft(rpc<any>('board_activity', both)),
    soft(rpc<any>('board_comments_list_v2', both)),
    soft(rpc<any>('board_team_list', both)),
  ]);
  let schedule: Raw['schedule'] = null;
  if (sched?.ok && Array.isArray(sched.items)) {
    schedule = {};
    for (const it of sched.items) if (it && it.id) schedule[it.id] = it.scheduled_at ?? null;
  }
  return {
    board: resp.board, slot: slot?.ok ? slot : null, activity: act?.ok ? act.items : [],
    report: report?.ok ? report.report : null, signals: signals?.ok ? signals.signals : null,
    audience: audience?.ok ? audience.audience : null, comments: comments?.ok && Array.isArray(comments.items) ? comments.items : [],
    schedule,
    members: team?.ok && Array.isArray(team.members) ? team.members : [],
    teamCap: team?.ok && Number(team.cap) > 0 ? Number(team.cap) : 25,
    role: team?.ok ? String(team.my_role || (c.token && !s ? 'admin' : 'approver')) : (c.token && !s ? 'admin' : 'approver'),
    me: (comments?.ok && comments.me) || (team?.ok && team.me) || null,
  };
}

/* ---------- Writes ---------- */
export type Res = { ok: boolean; error?: string; [k: string]: unknown };

async function call(name: string, body: Record<string, unknown>): Promise<Res> {
  try {
    const out = await rpc<Res | null>(name, body);
    return out && typeof out === 'object' ? out : { ok: false, error: 'no_answer' };
  } catch {
    return { ok: false, error: 'network' };
  }
}

/** Session first (attributed to the member), else the board link, else nothing to write with. */
function route(c: Cred, v1: string, v2: string, args: Record<string, unknown>): Promise<Res> {
  if (c.session?.token) return call(v2, { p_slug: c.slug, p_session: c.session.token, ...args });
  if (c.token) return call(v1, { p_slug: c.slug, p_token: c.token, ...args });
  return Promise.resolve({ ok: false, error: 'not_authenticated' });
}

export const api = {
  approve: (c: Cred, ref: string) => route(c, 'client_board_action', 'client_board_action_v2', { p_action: 'approve', p_ref: ref, p_payload: null }),
  /** The live board's undo: an `undo_approve` note in the action log walks the approval back. */
  undoApprove: (c: Cred, ref: string) => call('board_slot_notes', {
    p_slug: c.slug, p_events: [{ ref, payload: { event: 'undo_approve' } }],
    p_session: c.session?.token || null, p_token: c.session?.token ? null : c.token || null,
  }),
  editDraft: (c: Cred, id: string, body: string, base: string) => c.session?.token
    ? call('client_board_edit_draft_v2', { p_slug: c.slug, p_session: c.session.token, p_draft_id: id, p_body: body, p_base: base })
    : route(c, 'client_board_edit_draft', '', { p_draft_id: id, p_body: body }),
  setSchedule: (c: Cred, id: string, at: string | null) => route(c, 'client_board_set_schedule', 'client_board_set_schedule_v2', { p_draft_id: id, p_scheduled_at: at }),
  hideDraft: (c: Cred, id: string) => route(c, 'client_board_hide_draft', 'client_board_hide_draft_v2', { p_draft_id: id }),
  archiveDraft: (c: Cred, id: string, archived: boolean) => route(c, 'client_board_archive_draft', 'client_board_archive_draft_v2', { p_draft_id: id, p_archived: archived }),
  setMedia: (c: Cred, id: string, url: string) => route(c, 'client_board_set_media', 'client_board_set_media_v2', { p_draft_id: id, p_media_url: url }),
  /** Comments need a person. SwishDM (team board) always uses _v2; elsewhere _v2 only when someone is tagged. */
  addComment: (c: Cred, ref: string, text: string, parent: string | null, mentions: string[]) => {
    if (!c.session?.token) return Promise.resolve<Res>({ ok: false, error: 'need_session' });
    const v2 = c.slug === 'swishdm-live' || mentions.length > 0;
    return call(v2 ? 'board_comment_add_v2' : 'board_comment_add', {
      p_slug: c.slug, p_ref: ref, p_text: text, p_parent: parent, p_session: c.session.token, ...(v2 ? { p_mentions: mentions } : {}),
    });
  },
  /** Team (board_team_*): the board link and admins can add, remove and change roles; everyone signed in can read. */
  teamList: (c: Cred) => call('board_team_list', { p_slug: c.slug, p_session: c.session?.token || null, p_token: c.session?.token ? null : c.token || null }),
  teamAdd: (c: Cred, email: string, name: string | null, role: string) => call('board_team_add_v2', {
    p_slug: c.slug, p_email: email, p_name: name, p_role: role, p_session: c.session?.token || null, p_token: c.session?.token ? null : c.token || null,
  }),
  teamRemove: (c: Cred, email: string) => call('board_team_remove', { p_slug: c.slug, p_email: email, p_session: c.session?.token || null, p_token: c.session?.token ? null : c.token || null }),
  teamRole: (c: Cred, email: string, role: string) => call('board_team_set_role', { p_slug: c.slug, p_email: email, p_role: role, p_session: c.session?.token || null, p_token: c.session?.token ? null : c.token || null }),
  resolveComment: (c: Cred, id: string, resolved: boolean) => {
    if (!c.session?.token) return Promise.resolve<Res>({ ok: false, error: 'need_session' });
    return call('board_comment_resolve', { p_slug: c.slug, p_comment_id: id, p_resolved: resolved, p_session: c.session.token });
  },
};

/* ---------- Sign-in ---------- */
/** Mint and send the sign-in email. The edge function always answers ok (no way to probe who is allowed). */
export async function requestLink(slug: string, email: string) {
  try {
    await fetch(`${URL}/functions/v1/board-magic-link`, { method: 'POST', headers: headers(), body: JSON.stringify({ slug, email }) });
  } catch { /* same outcome either way */ }
}

export async function redeem(slug: string, secret: string, kind: 'code' | 'link'): Promise<BoardSession | null> {
  try {
    const res = await rpc<any>('redeem_board_login', { p_slug: slug, p_secret: secret, p_kind: kind });
    if (res?.ok && res.session_token) return { token: res.session_token, email: res.email, expires_at: res.expires_at };
  } catch { /* fall through */ }
  return null;
}

export async function publicBrand(slug: string): Promise<string> {
  try {
    const b = await rpc<any>('client_board_public_brand', { p_slug: slug });
    if (b?.ok && b.mode === 'live') return String(b.wordmark || b.company_name || '').trim();
  } catch { /* keep the theme name */ }
  return '';
}

/* ---------- Photo library ---------- */
export type Photo = { name: string; url: string; thumb: string };

/** The client's photo library: same bucket, list and filter as the live board (lib/clientPhotoLibrary.ts).
 *  HEIC files are left out: browsers cannot show them, and each has a JPG twin. */
export async function listPhotos(slug: string): Promise<Photo[]> {
  const r = await fetch(`${URL}/storage/v1/object/list/client-photos`, {
    method: 'POST', headers: headers(),
    body: JSON.stringify({ prefix: slug, limit: 200, offset: 0, sortBy: { column: 'name', order: 'desc' } }),
  });
  if (!r.ok) throw new Error('photos ' + r.status);
  const files: { id: string | null; name: string }[] = await r.json();
  return files
    .filter(f => isClientLibraryPhoto(f, slug) && !/\.(heic|heif)$/i.test(f.name))
    .map(f => {
      const path = `${encodeURIComponent(slug)}/${encodeURIComponent(f.name)}`;
      return {
        name: f.name,
        url: `${URL}/storage/v1/object/public/client-photos/${path}`,
        thumb: `${URL}/storage/v1/render/image/public/client-photos/${path}?width=240&height=240&resize=cover`,
      };
    });
}

export function isClientLibraryPhoto(file: { id: string | null; name: string }, slug: string): boolean {
  if (file.id === null || /^\./.test(file.name)) return false;
  if (slug !== 'risedtc-com') return true;
  return /^\d{13}-\d+-.+/.test(file.name) || /^ig-\d{4}-\d{2}-\d{2}-.+\.(?:jpe?g|png|webp|heic|heif|avif|gif)$/i.test(file.name);
}

/* ---------- Tracking ---------- */
export function sendTrack(c: Cred, events: unknown[], keepalive: boolean) {
  return rpc<Res>('board_track', {
    p_slug: c.slug, p_events: events, p_session: c.session?.token || null, p_token: c.session?.token ? null : c.token || null,
  }, keepalive);
}

export async function insertPageview(row: Record<string, unknown>) {
  await fetch(`${URL}/rest/v1/pageviews`, {
    method: 'POST', headers: { ...headers(), Prefer: 'return=minimal' }, body: JSON.stringify(row), keepalive: true,
  });
}

/* ---------- Plain error lines ---------- */
const ERR: Record<string, string> = {
  view_only: 'Your role can read and comment only, so this was not saved.',
  not_authenticated: 'Your sign-in has run out. Sign in again and try once more.',
  need_session: 'Sign in with your email to do this.',
  not_found: 'This board link no longer works. Sign in with your email instead.',
  changed_meanwhile: 'This post was changed while you were editing. Your text is still in the box. Copy it, then close and reopen the post to see the new version.',
  draft_not_editable: 'This post can no longer be changed here. It may already be out.',
  draft_not_schedulable: 'This post can no longer be moved here. It may already be out.',
  draft_not_hideable: 'This post can no longer be pulled here. It may already be out.',
  draft_not_found: 'This post is no longer on the board.',
  draft_not_archivable: 'This post can no longer be restored here.',
  already_published: 'This post is already live on LinkedIn.',
  unschedule_first: 'This post is scheduled as a carousel or video, so the picture cannot change here.',
  bad_date: 'Pick a time later than now, within the next year.',
  bad_body: 'The post needs at least 20 characters.',
  bad_text: 'Comments can be up to 2,000 characters.',
  bad_ref: 'This post is no longer on the board.',
  bad_parent: 'That thread is gone. Write a new comment instead.',
  bad_mentions: 'Someone you tagged is not on this board. Remove the tag and send again.',
  rate_limited: 'That is a lot of comments in a few minutes. Wait a little and send again.',
  not_allowed: 'Only the person who wrote this comment can resolve it.',
  admin_only: 'Only a team admin can change the team.',
  bad_email: 'That email address does not look right.',
  bad_name: 'Keep the name under 80 characters.',
  list_full: 'The team is full. Remove someone first.',
  owner: 'The board owner always keeps access.',
  owner_is_admin: 'The board owner always stays an admin.',
  last_member: 'The board needs at least one person on the team.',
  cannot_remove_self: 'You cannot remove yourself. Ask another admin.',
  cannot_change_self: 'You cannot change your own role. Ask another admin.',
  not_member: 'That person is no longer on the team.',
  not_available: 'Team sign-in is not switched on for this board yet.',
};
export const errText = (e?: string) => ERR[e || ''] || 'That did not save. Check your connection and try again.';

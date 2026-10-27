// The board's write layer. Every change shows at once (optimistic), goes to the same RPC the live
// board uses, and rolls back with a plain error line if the server says no. Changes stay layered on
// the last board read until a newer read (focus, every 5 minutes) carries them itself.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Comment, Model, Post, PostStatus } from './model';
import { NOTE_RE, noteText } from './model';
import { api, errText, type Cred, type Res } from './api';
import { track } from './track';
import type { BoardSession } from './session';

export type EditEntry = { id: string; at: string; before: string; after: string; by: string };

type Local = {
  /** Approved in this tab: id -> when. */
  approved: Record<string, string>;
  /** Pulled in this tab. 'pending' waits out the undo window before the write goes out. */
  pulled: Record<string, 'pending' | 'done'>;
  restored: Record<string, true>;
  edits: Record<string, string>;
  editLog: Record<string, EditEntry[]>;
  schedule: Record<string, string | null>;
  /** Picture override: url, or '' for no picture. */
  media: Record<string, string>;
  comments: Comment[];
  resolved: Record<string, boolean>;
};

type Toast = { id: number; text: string; kind: 'ok' | 'err' };

export type Ctx = {
  /** The board as read from the server, with this tab's changes laid over it. */
  model: Model;
  local: Local;
  toasts: Toast[];
  toast: (text: string) => void;
  fail: (text: string) => void;
  dismiss: (id: number) => void;
  canAct: boolean;
  canApprove: boolean;
  signedIn: boolean;
  me: string | null;
  approve: (id: string) => void;
  unapprove: (id: string) => void;
  pull: (id: string) => void;
  unpull: (id: string) => void;
  restore: (id: string) => void;
  saveEdit: (id: string, before: string, body: string) => Promise<{ ok: boolean; error?: string }>;
  reschedule: (id: string, at: string, label: string) => void;
  setPhoto: (id: string, url: string) => void;
  /** `sess` carries a sign-in that just happened, before the next render hands it down. */
  addComment: (ref: string, text: string, parent: string | null, mentions: string[], sess?: BoardSession) => Promise<'ok' | 'need_session' | 'failed'>;
  addNote: (postId: string, quote: string, text: string, sess?: BoardSession) => Promise<'ok' | 'need_session' | 'failed'>;
  resolveComment: (id: string, on: boolean) => void;
  statusOf: (p: Post) => PostStatus;
  bodyOf: (p: Post) => string;
  isResolved: (c: Comment) => boolean;
};

const C = createContext<Ctx | null>(null);

const EMPTY: Local = { approved: {}, pulled: {}, restored: {}, edits: {}, editLog: {}, schedule: {}, media: {}, comments: [], resolved: {} };
const uid = () => Math.random().toString(36).slice(2);
const without = <T,>(o: Record<string, T>, k: string) => { const c = { ...o }; delete c[k]; return c; };
const UNDO_MS = 6000;

export function LocalProvider({ model: base, fetchedAt, cred, children }: { model: Model; fetchedAt: number; cred: Cred; children: ReactNode }) {
  const [local, setLocal] = useState<Local>(EMPTY);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const credRef = useRef(cred);
  credRef.current = cred;
  // When each change was confirmed by the server, so a board read that started later can replace it.
  const confirmed = useRef<Record<string, number>>({});
  const pullTimers = useRef<Record<string, number>>({});
  const chain = useRef<Record<string, Promise<unknown>>>({});

  const push = useCallback((text: string, kind: Toast['kind']) => {
    const id = ++seq.current;
    setToasts(t => [...t.filter(x => x.text !== text), { id, text, kind }].slice(-3));
    window.setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), kind === 'err' ? 9000 : 2600);
  }, []);
  const toast = useCallback((text: string) => push(text, 'ok'), [push]);
  const fail = useCallback((text: string) => push(text, 'err'), [push]);
  const dismiss = useCallback((id: number) => setToasts(t => t.filter(x => x.id !== id)), []);

  /** Run writes for one post in order, so an undo never overtakes the change it undoes. */
  const inOrder = useCallback(<T,>(key: string, fn: () => Promise<T>): Promise<T> => {
    const p = (chain.current[key] || Promise.resolve()).then(fn, fn);
    chain.current[key] = p.catch(() => null);
    return p;
  }, []);
  const ok = (key: string) => { confirmed.current[key] = Date.now(); };

  // A newer board read carries every change confirmed before it started: drop those overlays.
  useEffect(() => {
    const stale = Object.entries(confirmed.current).filter(([, t]) => t < fetchedAt).map(([k]) => k);
    if (!stale.length && !local.comments.length) return;
    for (const k of stale) delete confirmed.current[k];
    const drop = new Set(stale);
    const serverIds = new Set(base.comments.map(c => c.id));
    setLocal(l => {
      const prune = <T,>(kind: string, o: Record<string, T>) => Object.fromEntries(Object.entries(o).filter(([id]) => !drop.has(`${kind}:${id}`))) as Record<string, T>;
      return {
        ...l,
        approved: prune('approved', l.approved),
        pulled: Object.fromEntries(Object.entries(l.pulled).filter(([id, v]) => v === 'pending' || !drop.has(`pulled:${id}`))) as Local['pulled'],
        restored: prune('restored', l.restored),
        edits: prune('edits', l.edits),
        editLog: prune('edits', l.editLog),
        schedule: prune('schedule', l.schedule),
        media: prune('media', l.media),
        resolved: prune('resolved', l.resolved),
        comments: l.comments.filter(c => !serverIds.has(c.id)),
      };
    });
  }, [fetchedAt, base]); // eslint-disable-line react-hooks/exhaustive-deps

  const report = useCallback((r: Res) => fail(errText(r.error)), [fail]);

  /* ---------- approve ---------- */
  const approve = useCallback((id: string) => {
    setLocal(l => ({ ...l, approved: { ...l.approved, [id]: new Date().toISOString() } }));
    track('approve', id);
    void inOrder(id, async () => {
      const r = await api.approve(credRef.current, id);
      if (r.ok) ok(`approved:${id}`);
      else { setLocal(l => ({ ...l, approved: without(l.approved, id) })); report(r); }
    });
  }, [inOrder, report]);

  const unapprove = useCallback((id: string) => {
    let prev: string | undefined;
    setLocal(l => { prev = l.approved[id]; return { ...l, approved: without(l.approved, id) }; });
    track('approve', id, { undo: true });
    void inOrder(id, async () => {
      const r = await api.undoApprove(credRef.current, id);
      if (r.ok) ok(`approved:${id}`);
      else { setLocal(l => ({ ...l, approved: { ...l.approved, [id]: prev || new Date().toISOString() } })); report(r); }
    });
  }, [inOrder, report]);

  /* ---------- pull (hide) ---------- */
  // The hide removes the post from the board for good, so the write waits out a short undo window.
  // Leaving the page sends it at once.
  const commitPull = useCallback((id: string) => {
    window.clearTimeout(pullTimers.current[id]);
    delete pullTimers.current[id];
    void inOrder(id, async () => {
      const r = await api.hideDraft(credRef.current, id);
      if (r.ok) { ok(`pulled:${id}`); setLocal(l => (l.pulled[id] ? { ...l, pulled: { ...l.pulled, [id]: 'done' } } : l)); }
      else { setLocal(l => ({ ...l, pulled: without(l.pulled, id) })); report(r); }
    });
  }, [inOrder, report]);
  const pull = useCallback((id: string) => {
    setLocal(l => ({ ...l, pulled: { ...l.pulled, [id]: 'pending' } }));
    track('pull', id);
    pullTimers.current[id] = window.setTimeout(() => commitPull(id), UNDO_MS);
  }, [commitPull]);
  const unpull = useCallback((id: string) => {
    if (!pullTimers.current[id]) return;
    window.clearTimeout(pullTimers.current[id]);
    delete pullTimers.current[id];
    setLocal(l => ({ ...l, pulled: without(l.pulled, id) }));
    track('pull', id, { undo: true });
  }, []);
  useEffect(() => {
    const flush = () => { for (const id of Object.keys(pullTimers.current)) commitPull(id); };
    const vis = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('pagehide', flush);
    return () => { document.removeEventListener('visibilitychange', vis); window.removeEventListener('pagehide', flush); };
  }, [commitPull]);

  /* ---------- restore an archived post ---------- */
  const restore = useCallback((id: string) => {
    setLocal(l => ({ ...l, restored: { ...l.restored, [id]: true } }));
    void inOrder(id, async () => {
      const r = await api.archiveDraft(credRef.current, id, false);
      if (r.ok) { ok(`restored:${id}`); toast('Back on the board'); }
      else { setLocal(l => ({ ...l, restored: without(l.restored, id) })); report(r); }
    });
  }, [inOrder, report, toast]);

  /* ---------- edit copy ---------- */
  // The editor waits for the answer and stays open on a failure, so typed text is never lost.
  const saveEdit = useCallback(async (id: string, before: string, body: string) => {
    if (before === body) return { ok: true };
    track('edit', id, { chars: [...body].length });
    const r = await inOrder(id, () => api.editDraft(credRef.current, id, body, before));
    if (!r.ok) return { ok: false, error: errText(r.error) };
    ok(`edits:${id}`);
    setLocal(l => ({
      ...l, edits: { ...l.edits, [id]: body },
      editLog: { ...l.editLog, [id]: [...(l.editLog[id] || []), { id: uid(), at: new Date().toISOString(), before, after: body, by: 'You' }] },
    }));
    toast('Saved');
    return { ok: true };
  }, [inOrder, toast]);

  /* ---------- move ---------- */
  const reschedule = useCallback((id: string, at: string, label: string) => {
    const had = Object.prototype.hasOwnProperty.call(local.schedule, id);
    const prev = local.schedule[id];
    setLocal(l => ({ ...l, schedule: { ...l.schedule, [id]: at } }));
    track('reschedule', id, { to: at });
    void inOrder(id, async () => {
      const r = await api.setSchedule(credRef.current, id, at);
      if (r.ok) { ok(`schedule:${id}`); toast(`Moved to ${label}`); }
      else { setLocal(l => ({ ...l, schedule: had ? { ...l.schedule, [id]: prev } : without(l.schedule, id) })); report(r); }
    });
  }, [inOrder, report, toast, local.schedule]);

  /* ---------- picture ---------- */
  const setPhoto = useCallback((id: string, url: string) => {
    const had = Object.prototype.hasOwnProperty.call(local.media, id);
    const prev = local.media[id];
    setLocal(l => ({ ...l, media: { ...l.media, [id]: url } }));
    track('photo', id, { cleared: !url });
    void inOrder(id, async () => {
      const r = await api.setMedia(credRef.current, id, url);
      if (r.ok) { ok(`media:${id}`); toast(url ? 'Picture changed' : 'Picture removed'); }
      else { setLocal(l => ({ ...l, media: had ? { ...l.media, [id]: prev } : without(l.media, id) })); report(r); }
    });
  }, [inOrder, report, toast, local.media]);

  /* ---------- comments ---------- */
  const addComment = useCallback(async (ref: string, text: string, parent: string | null, labels: string[], sess?: BoardSession) => {
    const c = sess ? { ...credRef.current, session: sess } : credRef.current;
    if (!c.session?.token) return 'need_session' as const;
    const emails = labels.map(l => base.mentionables.find(x => x.label === l)?.email).filter((x): x is string => !!x);
    const tmp = 'tmp-' + uid();
    const nm = text.match(NOTE_RE);
    const me = base.nameOf(c.session.email);
    setLocal(l => ({ ...l, comments: [...l.comments, {
      id: tmp, ref, at: new Date().toISOString(), by: me, byEmail: c.session!.email, text: nm ? nm[2] : text, quote: nm ? nm[1] : undefined,
      parent, mentions: labels, local: true,
    }] }));
    track('comment', ref, { reply: !!parent, mentions: emails.length, line_note: !!nm });
    const r = await api.addComment(c, ref, text, parent, emails);
    if (r.ok && r.item && typeof r.item === 'object') {
      const it = r.item as any;
      setLocal(l => ({
        ...l,
        comments: l.comments.map(x => (x.id === tmp ? { ...x, id: String(it.id), at: it.at || x.at } : x)),
        // A reply reopens a resolved thread on the server; show the same here.
        resolved: r.reopened_thread ? { ...l.resolved, [String(r.reopened_thread)]: false } : l.resolved,
      }));
      return 'ok' as const;
    }
    setLocal(l => ({ ...l, comments: l.comments.filter(x => x.id !== tmp) }));
    if (r.error === 'need_session' || r.error === 'not_authenticated') {
      if (r.error === 'not_authenticated') fail(errText('not_authenticated'));
      return 'need_session' as const;
    }
    report(r);
    return 'failed' as const;
  }, [base, fail, report]);

  const addNote = useCallback((postId: string, quote: string, text: string, sess?: BoardSession) => addComment(postId, noteText(quote, text), null, [], sess), [addComment]);

  const resolveComment = useCallback((id: string, on: boolean) => {
    if (id.startsWith('tmp-')) return;
    if (!credRef.current.session?.token) { fail(errText('need_session')); return; }
    const had = Object.prototype.hasOwnProperty.call(local.resolved, id);
    const prev = local.resolved[id];
    setLocal(l => ({ ...l, resolved: { ...l.resolved, [id]: on } }));
    track('resolve', id, { resolved: on });
    void inOrder('c:' + id, async () => {
      const r = await api.resolveComment(credRef.current, id, on);
      if (r.ok) ok(`resolved:${id}`);
      else { setLocal(l => ({ ...l, resolved: had ? { ...l.resolved, [id]: prev } : without(l.resolved, id) })); report(r); }
    });
  }, [inOrder, report, fail, local.resolved]);

  // The board everyone reads: server truth with this tab's body, picture and date changes on top.
  const model = useMemo<Model>(() => {
    if (!Object.keys(local.edits).length && !Object.keys(local.media).length && !Object.keys(local.schedule).length) return base;
    return {
      ...base,
      posts: base.posts.map(p => {
        let q = p;
        if (p.id in local.edits) q = { ...q, body: local.edits[p.id] };
        if (p.id in local.media) { const u = local.media[p.id]; q = { ...q, image: u || undefined, images: u ? [u] : [] }; }
        if (p.id in local.schedule) q = { ...q, scheduledAt: local.schedule[p.id] || undefined };
        return q;
      }),
    };
  }, [base, local.edits, local.media, local.schedule]);

  const role = base.role;
  const canAct = role !== 'viewer';
  const value = useMemo<Ctx>(() => ({
    model, local, toasts, toast, fail, dismiss,
    canAct, canApprove: canAct && base.theme.mode !== 'buffer',
    signedIn: !!cred.session?.token, me: cred.session?.email || base.me,
    approve, unapprove, pull, unpull, restore, saveEdit, reschedule, setPhoto, addComment, addNote, resolveComment,
    statusOf: p => {
      if (local.restored[p.id] && p.status === 'archived') return base.reviewMode ? 'needs_ok' : 'buffer';
      if (local.pulled[p.id]) return 'archived';
      if (p.status === 'needs_ok' && local.approved[p.id]) return 'approved';
      return p.status;
    },
    bodyOf: p => local.edits[p.id] ?? p.body,
    isResolved: c => (c.id in local.resolved ? local.resolved[c.id] : !!c.resolvedAt),
  }), [model, local, toasts, toast, fail, dismiss, canAct, base, cred.session, approve, unapprove, pull, unpull, restore, saveEdit, reschedule, setPhoto, addComment, addNote, resolveComment]);

  return <C.Provider value={value}>{children}</C.Provider>;
}

/** The store when the board has loaded, else null (loading screen). */
export function useLocalMaybe() { return useContext(C); }

export function useLocal() {
  const c = useContext(C);
  if (!c) throw new Error('LocalProvider missing');
  return c;
}

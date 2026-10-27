import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, ChevronDown, CornerDownRight, PenLine, RotateCcw } from 'lucide-react';
import type { Comment, Model, Post } from '../data/model';
import { dayKey, fmtWhen } from '../data/model';
import { diffHunks, diffLines } from '../data/diff';
import { plural } from '../data/copy';
import { useLocal, type EditEntry } from '../data/store';
import { useAuth } from '../data/auth';
import type { BoardSession } from '../data/session';
import { track } from '../data/track';
import { Avatar } from './kit';
import { SignInForm } from './SignIn';

/* Comment threads beside a post, like the live board: one thread per comment, replies under it,
   @mentions, resolve. Line notes from the review are comments that quote their line; copy edits
   (from the change log, and from this tab) sit in the same thread with their diff. */

type Item =
  | { kind: 'comment'; at: string; c: Comment }
  | { kind: 'edit'; at: string; e: EditEntry };

export function stamp(iso: string, m: Model) {
  const w = fmtWhen(iso, m.theme.tz);
  const today = dayKey(new Date(), m.theme.tz) === dayKey(iso, m.theme.tz);
  return `${today ? 'Today' : w.day.replace(/^\w+ /, '')}, ${w.time} ${m.theme.tzLabel}`;
}

function Text({ text, team }: { text: string; team: string[] }) {
  const parts = useMemo(() => {
    const tags = team.map(t => '@' + t).sort((a, b) => b.length - a.length);
    if (!tags.length) return [{ t: text, at: false }];
    const re = new RegExp(`(${tags.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');
    return text.split(re).filter(Boolean).map(t => ({ t, at: tags.includes(t) }));
  }, [text, team]);
  // A tag for a name two teammates share carries the email in brackets for the server; show the name only.
  return <>{parts.map((p, i) => (p.at ? <span key={i} className="mention" title={p.t.slice(1)}>{p.t.replace(/ \([^()]+@[^()]+\)$/, '')}</span> : <Fragment key={i}>{p.t}</Fragment>))}</>;
}

export function Composer({ team, onSend, placeholder, submit = 'Comment', onCancel, autoFocus = false, label, people }: {
  team: string[]; onSend: (text: string, mentions: string[]) => Promise<boolean>; placeholder: string; submit?: string; onCancel?: () => void; autoFocus?: boolean; label: string;
  /** Tag suggestions: `label` is inserted after the @, `display` is what the list shows. */
  people?: { label: string; display: string; email: string }[];
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [trig, setTrig] = useState<{ start: number; q: string } | null>(null);
  const [pick, setPick] = useState(0);
  const ref = useRef<HTMLTextAreaElement>(null);
  const caret = useRef<number | null>(null);
  // Put the caret after an inserted @name in the same paint, so the next key lands after it.
  useLayoutEffect(() => {
    if (caret.current == null || !ref.current) return;
    ref.current.setSelectionRange(caret.current, caret.current);
    caret.current = null;
  }, [text]);
  const opts = people && people.length ? people : team.map(t => ({ label: t, display: t, email: '' }));
  const list = trig ? opts.filter(t => (t.label + ' ' + t.display).toLowerCase().includes(trig.q.toLowerCase())).slice(0, 6).map(t => t.label) : [];
  const shown = (l: string) => opts.find(o => o.label === l);
  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);
  const sense = (v: string, caret: number) => {
    const mm = v.slice(0, caret).match(/(?:^|\s)@([^@\n]{0,40})$/);
    const done = mm && team.some(t => mm[1].startsWith(t + ' ') || mm[1] === t);
    setTrig(mm && !done ? { start: caret - mm[1].length - 1, q: mm[1] } : null);
    setPick(0);
  };
  const choose = (name: string) => {
    if (!trig) return;
    const at = ref.current?.selectionStart ?? text.length;
    const next = text.slice(0, trig.start) + '@' + name + ' ' + text.slice(at);
    caret.current = trig.start + name.length + 2;
    setText(next); setTrig(null);
    ref.current?.focus();
  };
  const send = async () => {
    const t = text.trim(); if (!t || busy) return;
    setBusy(true);
    const done = await onSend(t, opts.map(o => o.label).filter(n => t.includes('@' + n)));
    setBusy(false);
    if (done) { setText(''); setTrig(null); }
  };
  return (
    <div className="relative">
      <textarea
        ref={ref} rows={2} value={text} placeholder={placeholder} aria-label={label}
        role="combobox" aria-expanded={!!trig && list.length > 0} aria-autocomplete="list"
        onChange={e => { setText(e.target.value); sense(e.target.value, e.target.selectionStart); }}
        onClick={e => sense(e.currentTarget.value, e.currentTarget.selectionStart)}
        onBlur={() => window.setTimeout(() => setTrig(null), 120)}
        onKeyDown={e => {
          if (trig && list.length) {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setPick(i => (i + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length); return; }
            if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); choose(list[pick] || list[0]); return; }
          }
          // Esc closes the mention list, then cancels a reply; the drawer or review moves focus out of the field.
          if (e.key === 'Escape') { if (trig) { e.stopPropagation(); setTrig(null); } else if (onCancel) onCancel(); }
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void send(); }
        }}
        className="block w-full resize-none rounded-[12px] border hair bg-paper px-3 py-2.5 text-[13.5px] leading-[1.45] text-ink placeholder:text-mute outline-none focus:border-[var(--line-bold)]"
      />
      {trig && list.length > 0 && (
        <ul role="listbox" aria-label="Mention a teammate" className="absolute left-0 right-0 top-full mt-1 z-10 rounded-[12px] border hair bg-paper p-1">
          {list.map((t, i) => (
            <li key={t} role="option" aria-selected={i === pick}>
              <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => choose(t)}
                className={`w-full text-left flex items-center gap-2.5 h-10 px-2 rounded-[8px] text-[13.5px] ${i === pick ? 'bg-sunk text-ink' : 'text-soft'}`}>
                <Avatar name={shown(t)?.display || t} size={24} tone="plain" />
                <span className="min-w-0 truncate">{shown(t)?.display || t}</span>
                {shown(t)?.email && shown(t)!.display !== shown(t)!.email && <span className="ml-auto text-[11.5px] text-mute truncate max-w-[45%]">{shown(t)!.email}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex items-center gap-2">
        <span className="text-[11.5px] text-mute max-sm:invisible">Ctrl or Cmd + Enter to send</span>
        <span className="ml-auto flex items-center gap-1">
          {onCancel && <button type="button" className="btn btn-text btn-sm !h-8" onClick={onCancel}>Cancel</button>}
          <button type="button" className="btn btn-primary btn-sm !h-8" disabled={!text.trim() || busy} style={!text.trim() || busy ? { opacity: 0.45 } : undefined} onClick={() => void send()} data-testid="comment-send">{busy ? 'Sending' : submit}</button>
        </span>
      </div>
    </div>
  );
}

function Head({ name, at, m, tag }: { name: string; at: string; m: Model; tag?: ReactNode }) {
  return (
    <div className="flex items-baseline gap-2 min-w-0 flex-wrap">
      <span className="text-[13px] font-semibold text-ink">{name}</span>
      {tag}
      <span className="text-[11.5px] text-mute tnum">{stamp(at, m)}</span>
    </div>
  );
}

export function Comments({ post, m, onLine, focusNote, onFocused }: {
  post: Post; m: Model; onLine?: (line: number | null) => void; focusNote?: string | null; onFocused?: () => void;
}) {
  const { local, addComment, resolveComment, isResolved, signedIn: hasSession, me } = useLocal();
  const { entry, signedIn } = useAuth();
  const reduce = useReducedMotion();
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [openDiff, setOpenDiff] = useState<Record<string, boolean>>({});
  // A comment typed before signing in waits here, and goes out as soon as the code is in.
  const [waiting, setWaiting] = useState<{ text: string; parent: string | null; mentions: string[] } | null>(null);
  const [askIn, setAskIn] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const all = [...m.comments, ...local.comments].filter(c => c.ref === post.id);
  const repliesOf = (id: string) => all.filter(c => c.parent === id).sort((a, b) => a.at.localeCompare(b.at));
  const lineOf = (q?: string) => (q ? post.body.split('\n').findIndex(l => l.replace(/\s+/g, ' ').trim().slice(0, 240) === q) : -1);
  // Copy edits: the server's change log, plus edits saved in this tab that the log does not carry yet.
  const serverEdits: EditEntry[] = m.activity.filter(a => a.action === 'edit_copy' && a.ref === post.id && typeof a.before === 'string' && typeof a.after === 'string')
    .map(a => ({ id: a.id, at: a.at, before: a.before as string, after: a.after as string, by: a.by }));
  const edits = [...serverEdits, ...(local.editLog[post.id] || [])];
  const items: Item[] = [
    ...all.filter(c => !c.parent).map(c => ({ kind: 'comment' as const, at: c.at, c })),
    ...edits.map(e => ({ kind: 'edit' as const, at: e.at, e })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  const done = (it: Item) => (it.kind === 'comment' ? isResolved(it.c) : false);
  const open = items.filter(it => !done(it));
  const closed = items.filter(done);
  const mine = (c: Comment) => !!me && (c.byEmail || '').toLowerCase() === me.toLowerCase();
  const viewer = m.role === 'viewer';

  useEffect(() => { setReplyTo(null); setShowDone(false); setWaiting(null); setAskIn(false); }, [post.id]);
  useEffect(() => {
    if (!focusNote) return;
    const el = box.current?.querySelector<HTMLElement>(`[data-thread="${focusNote}"]`);
    if (el) { el.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' }); el.focus({ preventScroll: true }); }
    onFocused?.();
  }, [focusNote, onFocused, reduce]);

  const send = async (text: string, parent: string | null, mentions: string[], sess?: BoardSession) => {
    const r = await addComment(post.id, text, parent, mentions, sess);
    if (r === 'need_session') { setWaiting({ text, parent, mentions }); setAskIn(true); return false; }
    if (r === 'ok') { setWaiting(null); setAskIn(false); if (parent) setReplyTo(null); }
    return r === 'ok';
  };

  const replies = (id: string) => (
    <>
      {repliesOf(id).map(r => (
        <div key={r.id} className="mt-2.5 ml-1 pl-3 border-l-2 hair" style={r.id.startsWith('tmp-') ? { opacity: 0.6 } : undefined}>
          <Head name={r.by} at={r.at} m={m} />
          <p className="mt-0.5 text-[13.5px] leading-[1.5] text-soft whitespace-pre-wrap break-words"><Text text={r.text} team={m.team} /></p>
        </div>
      ))}
    </>
  );
  const replyBox = (id: string) => replyTo === id && (
    <div className="mt-1 ml-1 pl-3 border-l-2 hair">
      <Composer autoFocus team={m.team} people={m.mentionables} label="Reply" placeholder="Write a reply, @ to mention" submit="Send reply" onCancel={() => setReplyTo(null)}
        onSend={(t, men) => send(t, id, men)} />
    </div>
  );

  const actions = (c: Comment, resolved: boolean) => {
    const pending = c.id.startsWith('tmp-');
    const canResolve = !viewer || mine(c);
    return (
      <div className="mt-1.5 flex items-center gap-1 -ml-2">
        <button type="button" disabled={pending} className="btn btn-text btn-sm !h-8 !px-2 !text-[12.5px]" aria-expanded={replyTo === c.id} onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}><CornerDownRight size={13} /> Reply</button>
        {canResolve && !pending && (
          <button type="button" className="btn btn-text btn-sm !h-8 !px-2 !text-[12.5px] ml-auto" data-testid="resolve"
            onClick={() => (hasSession ? resolveComment(c.id, !resolved) : setAskIn(true))}>
            {resolved ? <><RotateCcw size={13} /> Reopen</> : <><Check size={13} /> Resolve</>}
          </button>
        )}
        {pending && <span className="ml-auto text-[11.5px] text-mute pr-2">Sending</span>}
      </div>
    );
  };

  const render = (it: Item) => {
    if (it.kind === 'comment') {
      const c = it.c; const r = isResolved(c);
      const line = lineOf(c.quote);
      return (
        <div data-thread={c.id} tabIndex={-1} className="outline-none" style={c.id.startsWith('tmp-') ? { opacity: 0.6 } : undefined}
          onMouseEnter={c.quote ? () => onLine?.(line >= 0 ? line : null) : undefined} onMouseLeave={c.quote ? () => onLine?.(null) : undefined}
          onFocus={c.quote ? () => onLine?.(line >= 0 ? line : null) : undefined} onBlur={c.quote ? () => onLine?.(null) : undefined}>
          <div className="flex gap-2.5">
            <Avatar name={c.by} size={28} tone={mine(c) ? 'accent' : 'plain'} />
            <div className="min-w-0 flex-1">
              <Head name={c.by} at={c.at} m={m} tag={c.quote ? <span className="chip !h-[18px] !px-1.5 !text-[10.5px]">Note on a line</span> : undefined} />
              {c.quote && <p className="mt-1 pl-2.5 border-l-2 text-[12.5px] leading-[1.45] text-mute clamp-2" style={{ borderColor: 'var(--accent)' }}>{c.quote}</p>}
              <p className="mt-0.5 text-[13.5px] leading-[1.5] text-ink whitespace-pre-wrap break-words"><Text text={c.text} team={m.team} /></p>
              {r && c.resolvedAt && !(c.id in local.resolved) && <p className="mt-1 text-[11.5px] text-mute">Resolved by {c.resolvedBy || 'your team'} · {stamp(c.resolvedAt, m)}</p>}
              {replies(c.id)}
              {actions(c, r)}
              {replyBox(c.id)}
            </div>
          </div>
        </div>
      );
    }
    const e = it.e;
    const hunks = diffHunks(diffLines(e.before, e.after));
    const shown = openDiff[e.id];
    const added = hunks.filter(h => h.kind === 'add').length;
    const removed = hunks.filter(h => h.kind === 'del').length;
    return (
      <div data-thread={e.id}>
        <div className="flex gap-2.5">
          <span className="h-7 w-7 shrink-0 rounded-full bg-sunk inline-flex items-center justify-center text-soft"><PenLine size={13} /></span>
          <div className="min-w-0 flex-1">
            <Head name={e.by} at={e.at} m={m} tag={<span className="chip chip-accent !h-[18px] !px-1.5 !text-[10.5px]">Edited</span>} />
            <button type="button" className="mt-1 text-[12.5px] text-soft inline-flex items-center gap-1 hover:text-ink" aria-expanded={!!shown}
              onClick={() => { if (!shown) track('expand', post.id, { which: 'edit_diff' }); setOpenDiff(x => ({ ...x, [e.id]: !x[e.id] })); }}>
              {plural(added, 'line')} added, {plural(removed, 'line')} removed
              <ChevronDown size={13} className={`transition-transform ${shown ? 'rotate-180' : ''}`} />
            </button>
            {shown && (
              <div className="mt-2 rounded-[10px] border hair overflow-hidden text-[12.5px] leading-[1.45]" data-testid="diff">
                {hunks.map((h, i) => h.kind === 'gap'
                  ? <div key={i} className="px-2.5 py-0.5 text-mute bg-sunk">…</div>
                  : <div key={i} className={`px-2.5 py-1 whitespace-pre-wrap break-words ${h.kind === 'add' ? 'diff-add' : h.kind === 'del' ? 'diff-del' : 'text-mute'}`}>
                      <span aria-hidden className="inline-block w-3 text-mute">{h.kind === 'add' ? '+' : h.kind === 'del' ? '−' : ''}</span>
                      <span className="sr-only">{h.kind === 'add' ? 'Added: ' : h.kind === 'del' ? 'Removed: ' : ''}</span>{h.text}
                    </div>)}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const key = (it: Item) => (it.kind === 'comment' ? it.c.id : it.e.id);
  return (
    <section ref={box} aria-label="Comments" data-testid="comments">
      <div className="flex items-center gap-2 mb-3">
        <span className="eyebrow">Comments</span>
        <span className="chip !h-[18px] !px-1.5 !text-[10.5px] !tracking-normal">{open.filter(i => i.kind !== 'edit').length} open</span>
      </div>
      {open.length === 0 && <p className="text-[13px] text-mute mb-3">{closed.length ? 'No open comments.' : 'No comments yet. Your team and Ivan see what you write here.'}</p>}
      <div className="grid gap-4">
        <AnimatePresence initial={false}>
          {open.map(it => (
            <motion.div key={key(it)} layout={reduce ? false : 'position'}
              initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.12 } }}
              className="pb-4 border-b hair last:border-b-0 last:pb-0">
              {render(it)}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      {closed.length > 0 && (
        <div className="mt-3">
          <button type="button" className="text-[12.5px] font-semibold text-soft inline-flex items-center gap-1 hover:text-ink h-8" aria-expanded={showDone}
            onClick={() => { if (!showDone) track('expand', post.id, { which: 'resolved_threads' }); setShowDone(v => !v); }}>
            {plural(closed.length, 'resolved thread')} <ChevronDown size={13} className={`transition-transform ${showDone ? 'rotate-180' : ''}`} />
          </button>
          {showDone && <div className="mt-2 grid gap-4 opacity-80">{closed.map(it => <div key={key(it)}>{render(it)}</div>)}</div>}
        </div>
      )}
      <div className="mt-4 pt-4 border-t hair">
        {askIn && !hasSession ? (
          <div className="rounded-[14px] border hair p-3.5" data-testid="comment-signin">
            <SignInForm slug={entry.slug} compact
              onAuthed={s => { signedIn(s); setAskIn(false); if (waiting) void send(waiting.text, waiting.parent, waiting.mentions, s); }}
              intro={<>
                <p className="text-[13px] text-ink font-semibold">Sign in to comment</p>
                <p className="mt-1 text-[12.5px] text-soft leading-[1.5]">Comments carry your name, so they need your email once.{waiting ? ' Your comment is kept and goes out right after.' : ''}</p>
                {waiting && <p className="mt-2 pl-2.5 border-l-2 text-[12.5px] text-mute clamp-2" style={{ borderColor: 'var(--accent)' }}>{waiting.text}</p>}
              </>} />
            <button type="button" className="mt-2 btn btn-text btn-sm !px-1" onClick={() => setAskIn(false)}>Not now</button>
          </div>
        ) : (
          <Composer team={m.team} people={m.mentionables} label="Add a comment" placeholder={hasSession ? 'Add a comment, @ to mention a teammate' : 'Add a comment'} onSend={(t, men) => send(t, null, men)} />
        )}
      </div>
    </section>
  );
}

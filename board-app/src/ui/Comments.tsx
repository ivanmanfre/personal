import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, ChevronDown, CornerDownRight, PenLine, RotateCcw } from 'lucide-react';
import type { Comment, Model, Post } from '../data/model';
import { dayKey, fmtWhen } from '../data/model';
import { diffHunks, diffLines } from '../data/diff';
import { fixOf, pinsOf, reviewOf } from '../data/review';
import { plural } from '../data/copy';
import { useLocal, type EditEntry } from '../data/store';
import { useAuth } from '../data/auth';
import type { BoardSession } from '../data/session';
import { track } from '../data/track';
import { Avatar } from './kit';
import { SignInForm } from './SignIn';

/* Comment threads beside a post, like the live board: one thread per comment, replies under it,
   @mentions, resolve. Line notes from the review are comments that quote their line; copy edits
   (from the change log, and from this tab) sit in the same thread with their diff.
   A line note carries the number of its pin in the post. When the text changed after the note, the note
   shows what happened to its line. Pointing at a note draws a line from its paragraph to the note. */

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

/* A thin line from a paragraph of the post to its note, drawn over the page while the note is pointed at.
   Only when the two sit side by side and both are in view. */
function Connector({ postId, link }: { postId: string; link: { key: string; id: string } | null }) {
  const [d, setD] = useState<{ x1: number; y1: number; x2: number; y2: number; color: string } | null>(null);
  useEffect(() => {
    if (!link) { setD(null); return; }
    let raf = 0;
    let last: string | undefined; // unset, so the first measure always commits, also when there is nothing to draw
    // Measured every frame while a note is pointed at, so the line follows scrolling, resizing and any change
    // of layout (the post entering edit mode, a reply box opening), and goes away when its paragraph does.
    const calc = () => {
      raf = requestAnimationFrame(calc);
      const t = document.querySelector<HTMLElement>(`[data-thread="${link.id}"]`);
      // The post beside this thread: the copy inside the same sheet or review, when more than one is on the page.
      const scope = t?.closest('[role="dialog"]') || document;
      const a = scope.querySelector<HTMLElement>(`[data-post="${postId}"] [data-anchor="${link.key}"]`);
      let next: { x1: number; y1: number; x2: number; y2: number; color: string } | null = null;
      if (a && t) {
        const ar = a.getBoundingClientRect(), tr = t.getBoundingClientRect();
        let top = 0, bottom = window.innerHeight;
        for (let el = a.parentElement; el; el = el.parentElement) {
          const o = getComputedStyle(el).overflowY;
          if (o === 'auto' || o === 'scroll') { const r = el.getBoundingClientRect(); top = Math.max(top, r.top); bottom = Math.min(bottom, r.bottom); break; }
        }
        const y1 = ar.top + Math.min(ar.height / 2, 10), y2 = tr.top + 14;
        if (!(tr.left < ar.right + 20 || y1 < top || y1 > bottom || y2 < top || y2 > bottom)) {
          next = { x1: Math.round(ar.right + 2), y1: Math.round(y1), x2: Math.round(tr.left - 8), y2: Math.round(y2), color: getComputedStyle(t).getPropertyValue('--accent').trim() || '#111' };
        }
      }
      const sig = next ? `${next.x1},${next.y1},${next.x2},${next.y2},${next.color}` : '';
      if (sig !== last) { last = sig; setD(next); }
    };
    calc();
    return () => cancelAnimationFrame(raf);
  }, [link, postId]);
  if (!d) return null;
  const mx = (d.x1 + d.x2) / 2;
  return createPortal(
    <svg className="pin-link" aria-hidden data-testid="pin-link" style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 95 }}>
      <path d={`M ${d.x1} ${d.y1} C ${mx} ${d.y1}, ${mx} ${d.y2}, ${d.x2} ${d.y2}`} pathLength={1} fill="none" stroke={d.color} strokeWidth={1.5} strokeLinecap="round" />
      <circle cx={d.x1} cy={d.y1} r={3} fill={d.color} />
      <circle cx={d.x2} cy={d.y2} r={3} fill={d.color} />
    </svg>,
    document.body,
  );
}

export function Comments({ post, m, onLine, focusNote, onFocused }: {
  post: Post; m: Model; onLine?: (key: string | null) => void; focusNote?: string | null; onFocused?: () => void;
}) {
  const { local, addComment, resolveComment, isResolved, signedIn: hasSession, me, bodyOf } = useLocal();
  const [link, setLink] = useState<{ key: string; id: string } | null>(null);
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
  // Where each line note sits in the post, and what changed in the text since it was reviewed.
  const review = reviewOf(post, bodyOf(post), m);
  const pins = pinsOf(all, bodyOf(post), review, isResolved);
  // Copy edits: the server's change log, plus edits saved in this tab that the log does not carry yet.
  const serverEdits: EditEntry[] = m.activity.filter(a => a.action === 'edit_copy' && a.ref === post.id && typeof a.before === 'string' && typeof a.after === 'string')
    .map(a => ({ id: a.id, at: a.at, before: a.before as string, after: a.after as string, by: a.by }));
  const edits = [...serverEdits, ...(local.editLog[post.id] || [])];
  const items: Item[] = [
    ...all.filter(c => !c.parent).map(c => ({ kind: 'comment' as const, at: c.at, c })),
    ...edits.map(e => ({ kind: 'edit' as const, at: e.at, e })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  const done = (it: Item) => (it.kind === 'comment' ? isResolved(it.c) : false);
  // Pinned notes first, in the order of the text; everything else stays in the order it was written.
  const pinN = (it: Item) => (it.kind === 'comment' ? pins.get(it.c.id)?.n ?? Infinity : Infinity);
  const open = items.filter(it => !done(it)).sort((a, b) => { const x = pinN(a), y = pinN(b); return x === y ? 0 : x - y; });
  const closed = items.filter(done);
  const mine = (c: Comment) => !!me && (c.byEmail || '').toLowerCase() === me.toLowerCase();
  const viewer = m.role === 'viewer';

  useEffect(() => { setReplyTo(null); setShowDone(false); setWaiting(null); setAskIn(false); setLink(null); }, [post.id]);
  useEffect(() => {
    if (!focusNote) return;
    // A pin can point at a resolved note (its line was reworded or removed): open the resolved threads first.
    if (!showDone && closed.some(it => it.kind === 'comment' && it.c.id === focusNote)) { setShowDone(true); return; }
    const el = box.current?.querySelector<HTMLElement>(`[data-thread="${focusNote}"]`);
    if (el) { el.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' }); el.focus({ preventScroll: true }); }
    onFocused?.();
  }, [focusNote, onFocused, reduce, showDone]); // eslint-disable-line react-hooks/exhaustive-deps

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
      const pin = pins.get(c.id);
      const fix = fixOf(pin, c, review);
      const point = pin ? () => { onLine?.(pin.key); setLink({ key: pin.key, id: c.id }); } : undefined;
      const leave = pin ? () => { onLine?.(null); setLink(null); } : undefined;
      return (
        <div data-thread={c.id} tabIndex={-1} className="outline-none" style={c.id.startsWith('tmp-') ? { opacity: 0.6 } : undefined}
          onMouseEnter={point} onMouseLeave={leave} onFocus={point} onBlur={leave}>
          <div className="flex gap-2.5">
            <Avatar name={c.by} size={28} tone={mine(c) ? 'accent' : 'plain'} />
            <div className="min-w-0 flex-1">
              <Head name={c.by} at={c.at} m={m} tag={c.quote ? <>
                {pin && <span className="li-marker inline-flex items-center justify-center h-[17px] min-w-[17px] px-1 rounded-full text-[10.5px] font-bold self-center" aria-label={`Pin ${pin.n} in the post`} data-testid="thread-pin">{pin.n}</span>}
                <span className="chip !h-[18px] !px-1.5 !text-[10.5px]">Note on a line</span>
              </> : undefined} />
              {c.quote && <p className="mt-1 pl-2.5 border-l-2 text-[12.5px] leading-[1.45] text-mute clamp-2" style={{ borderColor: 'var(--accent)' }}>{c.quote}</p>}
              <p className="mt-0.5 text-[13.5px] leading-[1.5] text-ink whitespace-pre-wrap break-words"><Text text={c.text} team={m.team} /></p>
              {fix && (
                <div className="mt-2 rounded-[10px] border hair overflow-hidden" data-testid="note-fix">
                  <div className="px-2.5 py-1 min-h-7 flex flex-wrap items-center gap-x-1.5 bg-sunk text-[11.5px] font-semibold text-soft">
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><Check size={12} className="text-accent-fg" />{fix.kind === 'removed' ? 'Removed' : fix.kind === 'added' ? 'Added after this line' : 'Reworded'}</span>
                    {review?.at && <span className="font-normal text-mute tnum whitespace-nowrap">{stamp(review.at, m)}</span>}
                  </div>
                  <div className="px-2.5 py-1.5 text-[12.5px] leading-[1.5] text-ink break-words">
                    {fix.blocks.map((b, i) => (
                      <p key={i} className={i ? 'mt-1.5' : undefined}>
                        {b.kind === 'change'
                          ? b.segs.map((g, x) => (g.kind === 'same' ? <span key={x}>{g.text}</span> : <span key={x} className={g.kind === 'del' ? 'diff-del' : 'diff-add'}><span className="sr-only">{g.kind === 'del' ? 'Removed: ' : 'Added: '}</span>{g.text}</span>))
                          : <span className={b.kind === 'del' ? 'diff-del' : 'diff-add'}>{b.text}</span>}
                      </p>
                    ))}
                  </div>
                </div>
              )}
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
      <Connector postId={post.id} link={link} />
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

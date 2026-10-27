import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, CircleCheck, PenLine, X } from 'lucide-react';
import type { Model, Post } from '../data/model';
import { plural } from '../data/copy';
import { useLocal } from '../data/store';
import { LinkedInPost } from '../ui/LinkedInPost';
import { Comments } from '../ui/Comments';
import { SOFT, useIsPhone } from '../ui/kit';

type Outcome = 'approved' | 'notes' | 'skipped';
type Fly = 'left' | 'right' | null;

/* story-viewer move: segmented progress, arrow keys, direction-aware spring slide. */
const slide = {
  enter: ({ dir }: { dir: number; fly: Fly }) => ({ x: dir > 0 ? 72 : -72, opacity: 0 }),
  center: { x: 0, opacity: 1, rotate: 0 },
  exit: ({ dir, fly }: { dir: number; fly: Fly }) =>
    fly === 'right' ? { x: 420, rotate: 7, opacity: 0 }
      : fly === 'left' ? { x: -420, rotate: -7, opacity: 0 }
        : { x: dir > 0 ? -72 : 72, opacity: 0 },
};

function Why({ post }: { post: Post }) {
  const rows: [string, string | undefined][] = [
    ['Where it came from', post.source],
    ['Topic', post.topic],
    ['Format', [post.format, post.angle].filter(Boolean).join(' · ')],
    ['Free resource', post.lmKeyword ? `People comment ${post.lmKeyword} to get ${post.lmTitle || 'it'} by message` : undefined],
  ];
  const doneSteps = post.trail.filter(t => t.done);
  return (
    <div>
      <div className="eyebrow mb-3">Why this post</div>
      <dl className="grid grid-cols-[minmax(0,1fr)] gap-3.5">
        {rows.filter(r => r[1]).map(([k, v]) => (
          <div key={k}>
            <dt className="text-[12px] text-mute">{k}</dt>
            <dd className="text-[14.5px] text-ink mt-0.5">{v}</dd>
          </div>
        ))}
      </dl>
      {doneSteps.length > 0 && (
        <ul className="mt-5 grid gap-2">
          {doneSteps.map(t => (
            <li key={t.step} className="flex gap-2.5 text-[13px] text-soft">
              <Check size={14} className="text-accent-fg mt-[3px] shrink-0" />
              <span><span className="text-ink">{t.step}.</span> {t.detail}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Focus({ m, startId, onClose }: { m: Model; startId?: string; onClose: () => void }) {
  const { approve, local, canApprove } = useLocal();
  const [editing, setEditing] = useState(false);
  const [line, setLine] = useState<number | null>(null);
  const [focusNote, setFocusNote] = useState<string | null>(null);
  const clearFocus = useCallback(() => setFocusNote(null), []);
  const phone = useIsPhone();
  const reduce = useReducedMotion();
  // Snapshot the queue when the review opens so posts do not shift under the reader. A board read in the
  // background refreshes each post's contents but never the order or the membership.
  const [ids] = useState(() => m.posts.filter(p => p.status === 'needs_ok' && !local.approved[p.id]).map(p => p.id));
  const snap = useMemo(() => new Map(m.posts.map(p => [p.id, p])), []); // eslint-disable-line react-hooks/exhaustive-deps
  const queue = useMemo(() => ids.map(id => m.posts.find(p => p.id === id) || snap.get(id)!).filter(Boolean), [ids, m.posts, snap]);
  const [idx, setIdx] = useState(() => Math.max(0, queue.findIndex(p => p.id === startId)));
  const [dir, setDir] = useState(1);
  const [fly, setFly] = useState<Fly>(null);
  const [out, setOut] = useState<Record<string, Outcome>>({});
  const [done, setDone] = useState(queue.length === 0);
  const post = queue[idx];
  // Anything written on this post in the review counts as notes: line notes and comments are saved as
  // comments the moment they are written, so "Send notes" only moves on.
  const notes = post ? local.comments.filter(c => c.ref === post.id && !c.id.startsWith('tmp-')).length : 0;
  useEffect(() => { setEditing(false); setLine(null); }, [post?.id]);

  const step = useCallback((d: number, f: Fly = null) => {
    setFly(f);
    setDir(d);
    if (d > 0 && idx >= queue.length - 1) { setDone(true); return; }
    setIdx(i => Math.min(Math.max(i + d, 0), queue.length - 1));
  }, [idx, queue.length]);

  const decide = useCallback((o: Outcome, f: Fly = null) => {
    if (!post) return;
    if (o === 'approved') { if (!canApprove) return; approve(post.id); }
    else if (o === 'notes') { if (!notes) return; }
    setOut(x => ({ ...x, [post.id]: o }));
    step(1, f);
  }, [post, notes, approve, canApprove, step]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      // In a text field, Esc leaves the field (the field may cancel its own edit first); keys type normally.
      if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT')) { if (e.key === 'Escape' && t.getAttribute('aria-expanded') !== 'true') requestAnimationFrame(() => { if (document.activeElement === t || !document.contains(t)) document.querySelector<HTMLElement>('[data-testid="focus"]')?.focus(); }); return; }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape') { e.preventDefault(); if (editing) setEditing(false); else onClose(); return; }
      if (done || editing) return;
      if ((e.key === 'e' || e.key === 'E') && canApprove) { e.preventDefault(); setEditing(true); return; }
      if (e.key === 'ArrowRight') { e.preventDefault(); if (post && !out[post.id]) setOut(x => ({ ...x, [post.id]: 'skipped' })); step(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); if (idx > 0) step(-1); }
      else if (e.key === 'a' || e.key === 'A') { e.preventDefault(); decide('approved'); }
      else if (e.key === 'n' || e.key === 'N') { e.preventDefault(); decide('notes'); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [done, post, out, idx, step, decide, onClose, editing, canApprove]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    const opener = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    const t = window.setTimeout(() => document.querySelector<HTMLElement>('[data-testid="focus"]')?.focus(), 60);
    return () => { document.body.style.overflow = prev; window.clearTimeout(t); if (opener && document.contains(opener)) opener.focus({ preventScroll: true }); };
  }, []);

  // tinder swipe on phone: right approves, left skips. Only transform and opacity move.
  const x = useMotionValue(0);
  const okTint = useTransform(x, [0, 140], [0, 1]);
  const skipTint = useTransform(x, [-140, 0], [1, 0]);
  const rot = useTransform(x, [-240, 240], [-5, 5]);

  const approvedN = Object.values(out).filter(o => o === 'approved').length;
  const notesN = Object.values(out).filter(o => o === 'notes').length;
  const skippedN = queue.length - approvedN - notesN;
  const word = m.theme.mode === 'team' ? 'your team' : 'you';

  return (
    <motion.div
      className="fixed inset-0 z-[70] bg-paper flex flex-col"
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12, transition: { duration: 0.18 } }}
      transition={SOFT}
      role="dialog" aria-modal aria-label="Review posts" tabIndex={-1}
      data-testid="focus"
    >
      {/* Segmented progress */}
      <header className="shrink-0 px-4 sm:px-8 pt-3 sm:pt-4 pb-3 border-b hair">
        <div className="flex gap-1" aria-hidden>
          {queue.map((p, i) => {
            const o = out[p.id];
            const bg = done || i < idx || o
              ? o === 'approved' ? 'var(--accent)' : o === 'notes' ? 'color-mix(in srgb, var(--accent) 40%, var(--paper))' : 'var(--line-bold)'
              : i === idx ? 'var(--ink)' : 'var(--line)';
            return (
              <button key={p.id} className="h-[3px] flex-1 rounded-full relative overflow-hidden" style={{ background: 'var(--line)' }}
                onClick={() => { if (!done) { setFly(null); setDir(i > idx ? 1 : -1); setIdx(i); } }} aria-label={`Post ${i + 1}`}>
                <motion.span className="absolute inset-0 rounded-full bar-x" style={{ background: bg }} initial={false} animate={{ scaleX: done || i <= idx || o ? 1 : 0 }} transition={SOFT} />
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex items-center justify-between gap-4">
          <div className="eyebrow" data-testid="focus-counter">{done ? 'All done' : `Post ${idx + 1} of ${queue.length}`}</div>
          <div className="hidden md:flex items-center gap-4 text-[12px] text-mute">
            {!done && <><span className="inline-flex items-center gap-1.5"><span className="kbd">A</span> approve</span><span className="inline-flex items-center gap-1.5"><span className="kbd">N</span> send notes</span><span className="inline-flex items-center gap-1.5"><span className="kbd">E</span> edit</span><span className="inline-flex items-center gap-1.5"><span className="kbd"><ArrowLeft size={11} /></span><span className="kbd"><ArrowRight size={11} /></span> move</span></>}
          </div>
          <button className="btn btn-outline btn-sm" onClick={onClose} aria-label="Close review"><X size={15} /> <span className="max-sm:hidden">Close</span> <span className="kbd max-md:hidden">Esc</span></button>
        </div>
      </header>

      <div className="relative flex-1 min-h-0 overflow-hidden">
        <AnimatePresence initial={false} custom={{ dir, fly }} mode="popLayout">
          {done ? (
            <motion.div key="done" className="absolute inset-0 overflow-y-auto" initial={reduce ? { opacity: 0 } : { opacity: 0, x: 72 }} animate={{ opacity: 1, x: 0 }} transition={SOFT}>
              <div className="mx-auto max-w-[680px] px-6 py-16 sm:py-24" data-testid="focus-done">
                <CircleCheck size={28} className="text-accent-fg" strokeWidth={1.5} />
                <h2 className="display text-[36px] sm:text-[48px] mt-6">
                  {plural(approvedN, 'approved', 'approved')}{notesN ? `, ${notesN} sent back with notes` : ''}.
                </h2>
                <p className="mt-4 text-[18px] text-soft">
                  {notesN ? 'Your comments are on the posts, and Ivan sees them now.' : approvedN ? 'Approved posts go into the next open slots.' : `Nothing changed. The posts stay here until ${word} decide.`}
                  {skippedN > 0 && ` ${plural(skippedN, 'post')} left for later.`}
                </p>
                <div className="mt-10 border-t hair">
                  {queue.map(p => (
                    <div key={p.id} className="flex items-center gap-3 py-3 border-b hair">
                      <span className={`chip ${out[p.id] === 'approved' ? 'chip-accent' : out[p.id] === 'notes' ? '' : 'chip-mute'}`}>{out[p.id] === 'approved' ? 'Approved' : out[p.id] === 'notes' ? 'Notes sent' : 'Later'}</span>
                      <span className="text-[14.5px] text-ink truncate">{p.title}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-10 flex flex-wrap gap-2">
                  <button className="btn btn-primary btn-lg" onClick={onClose}>Back to home</button>
                  {skippedN > 0 && <button className="btn btn-outline btn-lg" onClick={() => { const first = queue.findIndex(p => !out[p.id] || out[p.id] === 'skipped'); setOut(o => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== 'skipped'))); setDone(false); setDir(-1); setIdx(Math.max(first, 0)); }}>Look at the later ones</button>}
                </div>
              </div>
            </motion.div>
          ) : post && (
            <motion.div
              key={post.id}
              custom={{ dir, fly }}
              variants={reduce ? undefined : slide}
              initial={reduce ? { opacity: 0 } : 'enter'}
              animate={reduce ? { opacity: 1 } : 'center'}
              exit={reduce ? { opacity: 0 } : 'exit'}
              transition={{ x: { type: 'spring', stiffness: 300, damping: 30 }, rotate: { type: 'spring', stiffness: 300, damping: 30 }, opacity: { duration: 0.2 } }}
              className="absolute inset-0 overflow-y-auto overscroll-contain scroll-quiet"
            >
              <div className={`mx-auto max-w-[1320px] ${phone ? 'px-3 pt-4 pb-40' : 'px-8 py-10'} grid gap-10 md:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_330px_250px] lg:gap-12 xl:gap-10`}>
                <div className="min-w-0 md:pl-11 md:row-span-2">
                  <div className="flex items-start justify-between gap-3 mb-5 px-1 md:px-0">
                    <h2 className="display text-[24px] sm:text-[30px] min-w-0">{post.title}</h2>
                    {phone && !editing && canApprove && <button className="btn btn-outline btn-sm shrink-0" onClick={() => setEditing(true)}><PenLine size={14} /> Edit</button>}
                  </div>
                  {phone && !editing ? (
                    <motion.div
                      drag={reduce || !canApprove ? false : 'x'}
                      dragSnapToOrigin
                      dragElastic={0.7}
                      dragDirectionLock
                      style={{ x, rotate: rot }}
                      onDragEnd={(_, i) => {
                        if (i.offset.x > 110) decide('approved', 'right');
                        else if (i.offset.x < -110) { setOut(o => ({ ...o, [post.id]: o[post.id] || 'skipped' })); step(1, 'left'); }
                      }}
                      className="relative"
                      data-testid="swipe-card"
                    >
                      <LinkedInPost post={post} model={m} notes activeLine={line} onLineMarker={setFocusNote} />
                      <motion.div className="swipe-tint flex items-start justify-start p-4" style={{ opacity: okTint, background: 'color-mix(in srgb, var(--accent) 16%, transparent)', outline: '2px solid var(--accent)' }}>
                        <span className="btn btn-primary btn-sm">Approve</span>
                      </motion.div>
                      <motion.div className="swipe-tint flex items-start justify-end p-4" style={{ opacity: skipTint, background: 'rgba(0,0,0,0.10)', outline: '2px solid var(--line-bold)' }}>
                        <span className="btn btn-sm" style={{ background: 'var(--ink)', color: 'var(--paper)' }}>Later</span>
                      </motion.div>
                    </motion.div>
                  ) : (
                    <LinkedInPost post={post} model={m} notes={!editing} editing={editing} onEditDone={() => setEditing(false)} activeLine={line} onLineMarker={setFocusNote} />
                  )}
                  {phone && !editing && <p className="mt-3 text-center text-[12px] text-mute">Swipe right to approve, left for later. Tap a line to leave a note.</p>}
                </div>
                <aside className="min-w-0 px-1 md:px-0 md:col-start-2 md:row-start-1 xl:col-start-3 md:sticky md:top-10 self-start order-3 md:order-none">
                  {!phone && (
                    <div className="grid gap-2.5 mb-8">
                      {canApprove
                        ? <button className="btn btn-primary btn-lg w-full" disabled={editing} style={editing ? { opacity: 0.45 } : undefined} onClick={() => decide('approved')} data-testid="focus-approve">Approve <span className="kbd" style={{ opacity: 0.6 }}>A</span></button>
                        : <p className="text-[13px] text-mute">You can read and comment. Approving is for approvers on your team.</p>}
                      <button className="btn btn-outline btn-lg w-full" disabled={!notes || editing} onClick={() => decide('notes')} data-testid="focus-notes" title={notes ? undefined : 'Leave a line note or a comment first'}>Send notes{notes ? ` (${notes})` : ''} <span className="kbd">N</span></button>
                      {!editing && canApprove && <button className="btn btn-outline w-full" onClick={() => setEditing(true)} data-testid="focus-edit"><PenLine size={15} /> Edit the post <span className="kbd">E</span></button>}
                      {editing && <p className="text-[12.5px] text-mute text-center">Save or cancel the edit to approve.</p>}
                      <button className="btn btn-text w-full" onClick={() => { setOut(o => ({ ...o, [post.id]: o[post.id] || 'skipped' })); step(1); }}>Skip for now <span className="kbd"><ArrowRight size={11} /></span></button>
                      {idx > 0 && <button className="btn btn-text btn-sm w-full text-mute" onClick={() => step(-1)}><ArrowLeft size={13} /> Previous post</button>}
                    </div>
                  )}
                  <Why post={post} />
                </aside>
                <div className="min-w-0 px-1 md:px-0 md:col-start-2 md:row-start-2 xl:row-start-1 order-2 md:order-none max-md:pt-2 xl:border-l xl:pl-10 hair">
                  <Comments post={post} m={m} onLine={setLine} focusNote={focusNote} onFocused={clearFocus} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {phone && !done && post && (
        <div className="shrink-0 border-t hair bg-paper px-3 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] grid gap-2" style={{ gridTemplateColumns: 'auto minmax(0,1fr) minmax(0,1.2fr)' }}>
          <button className="btn btn-text !px-3" onClick={() => { setOut(o => ({ ...o, [post.id]: o[post.id] || 'skipped' })); step(1); }}>Later</button>
          <button className="btn btn-outline" disabled={!notes} onClick={() => decide('notes')}>Send notes</button>
          {canApprove ? <button className="btn btn-primary" onClick={() => decide('approved')} data-testid="focus-approve">Approve</button> : <span />}
        </div>
      )}
    </motion.div>
  );
}

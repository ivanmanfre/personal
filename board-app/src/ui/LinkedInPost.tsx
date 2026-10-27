import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Ellipsis, Globe, MessageCircle, Plus, Repeat2, SendHorizontal, ThumbsUp } from 'lucide-react';
import type { Model, Post } from '../data/model';
import { fmtWhen } from '../data/model';
import { useLocal } from '../data/store';
import { useAuth } from '../data/auth';
import { Avatar } from './kit';
import { SignInForm } from './SignIn';
import type { BoardSession } from '../data/session';

export const LI_LIMIT = 3000;
export const charCount = (s: string) => [...s].length;

/* LinkedIn-like preview.
   - `notes`: each line gets a gutter "+" that opens a note box under that exact line (github-inline-diff move).
     A saved note goes to the comment thread beside the post; the line keeps a small numbered marker.
   - `editing`: the body turns into a textarea in the same card, growing with the text, with LinkedIn's
     3,000-character limit counted live. */
export function LinkedInPost({ post, model, notes = false, compact = false, editing = false, onEditDone, activeLine = null, onLineMarker }: {
  post: Post; model: Model; notes?: boolean; compact?: boolean;
  editing?: boolean; onEditDone?: () => void;
  activeLine?: number | null; onLineMarker?: (noteId: string) => void;
}) {
  const { local, addNote, bodyOf, saveEdit, isResolved, model: mv } = useLocal();
  const { entry, signedIn } = useAuth();
  const reduce = useReducedMotion();
  const body = bodyOf(post);
  const lines = body.split('\n');
  // Open line notes on this post: comments that start with the quoted line.
  const postNotes = [...mv.comments, ...local.comments].filter(c => c.ref === post.id && c.quote && !c.parent && !isResolved(c));
  const lineKey = (s: string) => s.replace(/\s+/g, ' ').trim().slice(0, 240);
  const [openLine, setOpenLine] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [needIn, setNeedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  const edited = (local.edits[post.id] != null && local.edits[post.id] !== post.body) || model.activity.some(a => a.action === 'edit_copy' && a.ref === post.id);

  useEffect(() => { setOpenLine(null); setDraft(''); setNeedIn(false); }, [post.id]);
  useEffect(() => { if (openLine != null) ta.current?.focus(); }, [openLine]);
  useEffect(() => { if (editing) setOpenLine(null); }, [editing]);

  const save = async (sess?: BoardSession) => {
    if (openLine == null || !draft.trim() || busy) return;
    setBusy(true);
    const r = await addNote(post.id, lineKey(lines[openLine] || ''), draft.trim(), sess);
    setBusy(false);
    if (r === 'need_session') { setNeedIn(true); return; }
    if (r === 'ok') { setDraft(''); setOpenLine(null); setNeedIn(false); }
  };

  const when = post.publishedAt ? fmtWhen(post.publishedAt, model.theme.tz).day : post.scheduledAt ? fmtWhen(post.scheduledAt, model.theme.tz).day : 'Draft';
  const f = model.founder;

  return (
    <article
      className="li-card relative bg-white text-[rgba(0,0,0,0.9)] font-li rounded-[10px] border"
      style={{ borderColor: editing ? 'var(--accent)' : '#DCDAD5', colorScheme: 'light' }}
      data-testid="li-card"
    >
      <header className="flex items-start gap-2.5 px-4 pt-3.5 pb-2">
        <Avatar name={f.name || model.company} src={f.avatar} size={48} tone="accent" />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="text-[14px] font-semibold text-[rgba(0,0,0,0.9)] truncate">{f.name || model.company}</div>
          <div className="text-[12px] text-[rgba(0,0,0,0.6)] truncate mt-0.5">{f.headline}</div>
          <div className="text-[12px] text-[rgba(0,0,0,0.6)] mt-0.5 inline-flex items-center gap-1">
            {when}{edited && !editing && <> · <span className="font-semibold text-[rgba(0,0,0,0.75)]" data-testid="edited-mark">Edited</span></>} · <Globe size={11} strokeWidth={2} />
          </div>
        </div>
        <Ellipsis size={20} className="text-[rgba(0,0,0,0.6)] mt-1" />
      </header>

      {editing ? (
        <Editor key={post.id} initial={body} onCancel={() => onEditDone?.()} onSave={async next => {
          const r = await saveEdit(post.id, body, next);
          if (r.ok) onEditDone?.();
          return r;
        }} />
      ) : (
        <div className={`px-4 pb-3 text-[14px] leading-[20px] ${compact ? 'max-h-[340px] overflow-hidden' : ''}`}>
          {lines.map((raw, i) => {
            if (!raw.trim()) return <div key={i} className="h-[20px]" />;
            const lineNotes = postNotes.filter(n => n.quote === lineKey(raw));
            const isOpen = openLine === i;
            const lit = isOpen || activeLine === i;
            return (
              <div key={i} className="relative">
                <div
                  className={`li-line group relative -mx-2 px-2 rounded-[4px] ${notes ? 'cursor-text' : ''} ${lit ? 'li-line-on' : ''} ${lineNotes.length ? 'li-line-noted' : ''}`}
                  onClick={notes ? () => { setOpenLine(isOpen ? null : i); setDraft(''); setNeedIn(false); } : undefined}
                  data-line={i}
                >
                  {notes && (
                    <button
                      type="button"
                      aria-label={`Leave a note on line ${i + 1}`}
                      onClick={e => { e.stopPropagation(); setOpenLine(i); setDraft(''); setNeedIn(false); }}
                      className="li-plus absolute top-0 -left-[34px] h-[20px] w-[20px] rounded-full inline-flex items-center justify-center"
                    >
                      <Plus size={13} strokeWidth={2.5} />
                    </button>
                  )}
                  <span className="whitespace-pre-wrap break-words">{raw}</span>
                  {lineNotes.length > 0 && (
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); onLineMarker?.(lineNotes[0].id); }}
                      className="li-marker ml-1.5 align-[1px] inline-flex items-center justify-center h-[17px] min-w-[17px] px-1 rounded-full text-[10.5px] font-bold"
                      aria-label={`${lineNotes.length} note${lineNotes.length > 1 ? 's' : ''} on this line, shown in the comments`}
                    >
                      {lineNotes.length}
                    </button>
                  )}
                </div>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, transition: { duration: 0.1 } }}
                      transition={{ duration: 0.2 }}
                      className="li-compose my-2 rounded-[8px] border p-2.5"
                      onClick={e => e.stopPropagation()}
                    >
                      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[rgba(0,0,0,0.6)] mb-1.5">Note on this line</div>
                      <textarea
                        ref={ta}
                        rows={2}
                        value={draft}
                        onChange={e => setDraft(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Escape') { e.stopPropagation(); setOpenLine(null); }
                          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void save();
                        }}
                        placeholder="What should change here?"
                        aria-label={`Note on line ${i + 1}`}
                        className="w-full resize-none bg-transparent text-[14px] leading-[20px] text-[rgba(0,0,0,0.9)] placeholder:text-[rgba(0,0,0,0.45)] outline-none"
                      />
                      <div className="flex items-center justify-between gap-1.5 mt-1">
                        <span className="text-[11.5px] text-[rgba(0,0,0,0.55)] max-sm:hidden">Shows in the comments beside the post</span>
                        <span className="flex gap-1.5 ml-auto">
                          <button className="h-8 px-3 rounded-full text-[13px] font-semibold text-[rgba(0,0,0,0.65)] hover:text-black" onClick={() => setOpenLine(null)}>Cancel</button>
                          <button className="h-8 px-3.5 rounded-full text-[13px] font-semibold disabled:opacity-40" style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }} disabled={!draft.trim() || busy} onClick={() => void save()} data-testid="save-note">{busy ? 'Saving' : 'Save note'}</button>
                        </span>
                      </div>
                      {needIn && (
                        <div className="mt-2.5 pt-2.5 border-t app !min-h-0 rounded-[8px] px-2.5 pb-2.5" style={{ borderColor: '#EBE9E4' }}>
                          <SignInForm slug={entry.slug} compact onAuthed={s => { signedIn(s); setNeedIn(false); void save(s); }}
                            intro={<p className="text-[12.5px] text-soft leading-[1.5] pt-1">Notes carry your name, so they need your email once. Your note stays here.</p>} />
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
          {post.lmKeyword && (
            <div className="mt-3 text-[12.5px] text-[rgba(0,0,0,0.6)]">People who comment <span className="font-semibold text-[rgba(0,0,0,0.85)]">{post.lmKeyword}</span> get {post.lmTitle || 'the resource'} by message.</div>
          )}
        </div>
      )}

      {post.image && (
        <div className="relative border-t" style={{ borderColor: '#EBE9E4' }}>
          <img src={post.image} alt="" className="w-full h-auto" loading="lazy" />
          {post.images.length > 1 && (
            <span className="absolute top-2.5 right-2.5 rounded-full px-2 h-6 inline-flex items-center text-[12px] font-semibold" style={{ background: 'rgba(0,0,0,0.65)', color: '#fff' }}>1 / {post.images.length}</span>
          )}
        </div>
      )}

      {post.perf && (
        <div className="flex items-center justify-between px-4 py-2 text-[12px] text-[rgba(0,0,0,0.6)] border-b" style={{ borderColor: '#EBE9E4' }}>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full" style={{ background: '#378FE9' }}><ThumbsUp size={9} color="#fff" fill="#fff" /></span>
            {post.perf.reactions}
          </span>
          <span>{post.perf.comments} comments · {post.perf.impressions.toLocaleString('en-GB')} impressions</span>
        </div>
      )}
      <footer className="flex items-center justify-around px-2 py-1 text-[13px] font-semibold text-[rgba(0,0,0,0.6)]" aria-hidden>
        {[[ThumbsUp, 'Like'], [MessageCircle, 'Comment'], [Repeat2, 'Repost'], [SendHorizontal, 'Send']].map(([I, l]) => {
          const Icon = I as typeof ThumbsUp;
          return <span key={l as string} className="inline-flex items-center gap-1.5 px-2 py-2.5"><Icon size={17} strokeWidth={1.75} /><span className="max-[400px]:hidden">{l as string}</span></span>;
        })}
      </footer>
    </article>
  );
}

function Editor({ initial, onSave, onCancel }: { initial: string; onSave: (s: string) => Promise<{ ok: boolean; error?: string }>; onCancel: () => void }) {
  const [text, setText] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const save = async () => {
    if (saving) return;
    setSaving(true); setErr('');
    const r = await onSave(text);
    setSaving(false);
    if (!r.ok) setErr(r.error || 'That did not save. Try again.');
  };
  const ref = useRef<HTMLTextAreaElement>(null);
  const count = charCount(text);
  const over = count > LI_LIMIT;
  const changed = text !== initial;
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);
  useEffect(() => { const el = ref.current; if (el) { el.focus(); el.setSelectionRange(0, 0); el.scrollTop = 0; } }, []);
  return (
    <div className="px-4 pb-3" data-testid="post-editor">
      <textarea
        ref={ref}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Escape') { e.stopPropagation(); onCancel(); }
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !over && changed) void save();
        }}
        aria-label="Post text"
        className="li-editor block w-full resize-none overflow-hidden bg-[#FAF9F7] rounded-[6px] -mx-2 px-2 py-1.5 text-[14px] leading-[20px] text-[rgba(0,0,0,0.9)] outline-none"
        style={{ width: 'calc(100% + 16px)' }}
      />
      <div className="mt-2.5 flex items-center gap-2 flex-wrap">
        <span className={`text-[12px] tnum ${over ? 'font-semibold text-[#B42318]' : 'text-[rgba(0,0,0,0.6)]'}`} aria-live="polite" data-testid="char-count">
          {count.toLocaleString('en-GB')} / {LI_LIMIT.toLocaleString('en-GB')}{over ? ` · ${(count - LI_LIMIT).toLocaleString('en-GB')} over LinkedIn's limit` : ''}
        </span>
        <span className="ml-auto flex gap-1.5">
          <button className="h-9 px-4 rounded-full text-[13px] font-semibold text-[rgba(0,0,0,0.65)] hover:text-black" onClick={onCancel}>Cancel</button>
          <button className="h-9 px-4 rounded-full text-[13px] font-semibold disabled:opacity-40" style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }} disabled={over || !changed || saving} onClick={() => void save()} data-testid="save-edit">{saving ? 'Saving' : 'Save'}</button>
        </span>
      </div>
      {err && <p className="mt-2 text-[12.5px] leading-[1.45] text-[#B42318]" role="alert" data-testid="edit-error">{err}</p>}
    </div>
  );
}

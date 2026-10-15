import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
export type ActivityEntry = { id: string; action: string; at: string; by: string; ref?: string; event?: string; field?: string; before?: unknown; after?: unknown; text?: string; note?: string; phase?: string; operation?: string };
const labels: Record<string, string> = { approve: 'Approved a post', request_changes: 'Requested changes', edit_copy: 'Edited copy', edit_title: 'Edited a title', set_media: 'Changed a post image', set_schedule: 'Changed a schedule', hide_draft: 'Removed a buffer post', comment: 'Commented', invite: 'Added a teammate', team_remove: 'Removed a teammate', team_role: 'Changed a team role', edit_lm_promo: 'Edited lead magnet copy', photo_upload: 'Uploaded a photo', delete_photo: 'Deleted a photo', shift_request: 'Requested a strategy change', audn_accept: 'Accepted an audience recommendation', audn_reject: 'Rejected an audience recommendation', audn_defer: 'Deferred an audience recommendation', classification_proposed: 'Proposed post tags', edit_tags: 'Changed post tags', angle_swap: 'Changed an idea', angle_swap_undone: 'Restored an idea', post_removed: 'Removed a post', post_restored: 'Restored a post', day_left_empty: 'Left a day empty', day_refilled: 'Reopened a day', slot_replaced: 'Replaced a post', slot_replace_undone: 'Restored a slot', undo_approve: 'Withdrew approval', voice_note: 'Added a voice note', idea_note: 'Added an idea note', idea_draft_next: 'Requested an idea draft', idea_pass: 'Passed on an idea' };
const valueText = (v: unknown) => v == null ? 'None' : typeof v === 'string' ? v : JSON.stringify(v, null, 2);
export default function BoardActivity({ slug, session, token, revision = 0 }: { slug: string; session?: string | null; token?: string; revision?: number }) {
 const [open, setOpen] = useState(false); const [rows, setRows] = useState<ActivityEntry[]>([]);
 const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [more, setMore] = useState(false);
 const [refresh, setRefresh] = useState(0); const requestId = useRef(0); const [loadedSlug, setLoadedSlug] = useState(slug);
 const load = async (older = false) => {
  const request = ++requestId.current;
  setBusy(true); setError('');
  try {
   const last = older ? rows.at(-1) : null;
   const { data, error: rpcError } = await supabase.rpc('board_activity', { p_slug: slug, p_session: session || null, p_token: session ? null : token || null, ...(last ? { p_before_at: last.at, p_before_id: last.id } : {}) });
   if (rpcError || !data?.ok || !Array.isArray(data.items)) throw Error('unavailable');
   if (request !== requestId.current) return;
   setLoadedSlug(slug);
   setRows(current => older ? [...current, ...data.items] : data.items); setMore(data.items.length === 50);
  } catch { if (request === requestId.current) setError('Activity could not load. Try again.'); }
  finally { if (request === requestId.current) setBusy(false); }
 };
 useEffect(() => { if (open) void load(); return () => { requestId.current++; }; }, [open, slug, session, token, revision, refresh]);
 return <details id="board-activity" className="mt-6 rounded-xl border p-4" style={{ borderColor: 'var(--cb-line)', color: 'var(--cb-ink)' }} onToggle={e => setOpen(e.currentTarget.open)}>
  <summary className="min-h-[44px] cursor-pointer py-3 text-[15px] font-semibold">Team activity</summary>
  {open && <div className="mt-3">
   <p className="text-[13px]" style={{ color: 'var(--cb-ink-mute)' }}>Who changed what across this board. Shared-link actions are labelled “board link”. A started file operation remains unconfirmed until a completion entry appears.</p>
   <button type="button" disabled={busy} onClick={() => setRefresh(n => n + 1)} className="mt-2 min-h-[44px] underline">Refresh activity</button>
   {busy && <p role="status">Loading activity…</p>}
   {error && <p role="alert">{error}</p>}
   {!busy && !error && rows.length === 0 && <p className="mt-3">No recorded changes yet.</p>}
   <ol className="mt-3 divide-y">
    {(loadedSlug === slug ? rows : []).map(row => <li key={row.id} className="py-3 text-[14px]">
     <p className="font-semibold">{row.action === 'photo_operation' ? `${row.operation === 'delete' ? 'File deletion' : 'File upload'}: ${row.phase === 'started' ? 'started, completion unconfirmed' : row.phase}` : labels[row.event || row.action] || 'Board change'}</p>
     <p className="text-[12px]" style={{ color: 'var(--cb-ink-mute)', overflowWrap: 'anywhere' }}>{row.by} · <time dateTime={row.at} title={row.at}>{new Date(row.at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</time></p>
     {row.ref && /^(invite|team_remove|team_role|photo_operation|photo_upload|delete_photo)$/.test(row.action) && <p className="mt-1 break-all">{row.ref}</p>}
     {(row.text || row.note) && <p className="mt-2 whitespace-pre-wrap break-words">{row.text || row.note}</p>}
     {(row.before !== undefined && row.before !== null || row.after !== undefined && row.after !== null) && <details className="mt-2"><summary className="min-h-[44px] cursor-pointer py-3 underline">See what changed</summary><dl className="mt-2 grid gap-2 sm:grid-cols-2">{(['Before', 'After'] as const).map((label, i) => <div key={label} className="min-w-0"><dt className="font-semibold">{label}</dt><dd className="whitespace-pre-wrap break-words text-[13px]">{valueText(i ? row.after : row.before)}</dd></div>)}</dl></details>}
    </li>)}
   </ol>
   {more && loadedSlug === slug && <button type="button" disabled={busy} onClick={() => void load(true)} className="min-h-[44px] underline">Earlier changes</button>}
  </div>}
 </details>;
}

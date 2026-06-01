# Interview Studio Dashboard (Phase A1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the guided Interview Studio dashboard panel — an auto-stockable queue of interview ideas where each shows a question + talking-point beats + an optional collapsible script, plus a "go record → come back" upload block (QR mobile page, desktop drag-drop, in-browser record) — backed by a new `interview_clips` Supabase table.

**Architecture:** A new React panel (`InterviewStudioPanel`) + data hook (`useInterviewClips`) mirroring the existing `VideoIdeasPanel`/`useVideoIdeas` pattern (Supabase singleton, direct table writes, `originals` storage bucket, realtime). A new public token-scoped mobile-upload route mirrors the existing `/v/:token` standalone route. Uploads flip `status` and fire an n8n `interview-render` webhook (the workflow itself is Phase A2 — the call is in place and fails gracefully until then).

**Tech Stack:** React 19 + Vite 6 + TypeScript 5.8 (tsconfig `noEmit`), Tailwind v4 (dark zinc theme), `@supabase/supabase-js`, `sonner` toasts, `lucide-react` icons, `qrcode.react` (new dep). No unit-test runner — verification is `npx tsc` (typecheck gate) + a dev-server/Playwright visual smoke. Supabase project `bjbvqvzbzczjbatgmccb`.

**Scope boundary (Phase A2 / B — NOT in this plan):** the n8n "Interview Render" workflow (Deepgram transcription → POST video-engine `/render/interview-clip`), ElevenLabs question voicing, and the n8n "Interview Idea Generator" auto-scoring workflow. This plan ends at: ideas display in the queue, the guided detail view works, footage uploads to storage against a row, status flips, and the render webhook fires.

---

## File Structure

**Create:**
- `supabase/migrations/20260601_interview_clips.sql` — table + RLS + `upload_token` default.
- `hooks/useInterviewClips.ts` — data + actions (load, field update, upload, fire render).
- `components/dashboard/InterviewStudioPanel.tsx` — the queue + detail panel.
- `components/dashboard/InterviewUploadPage.tsx` — public token-scoped mobile upload page.

**Modify:**
- `types/dashboard.ts` — add `InterviewClip` interface + `'interview'` to the `Tab` union (line 904).
- `components/dashboard/Dashboard.tsx` — add `LazyInterviewStudioPanel` + `panelComponents` entry.
- `components/dashboard/DashboardLayout.tsx` — add `{ id: 'interview', ... }` to the Content `tabGroups` group (~line 34).
- `App.tsx` — add the `/interview-upload/:token` standalone route.
- `package.json` — add `qrcode.react` dependency.

**Reuse (import, do not copy):** `supabase` from `lib/supabase`; `toastError`/`toastSuccess` from `lib/dashboardActions`; `VideoRecorder` (`components/dashboard/VideoRecorder.tsx`, prop `onRecordingComplete`); the `originals` storage bucket; `useAutoRefresh` for realtime.

---

## Task 1: `interview_clips` table

**Files:**
- Create: `supabase/migrations/20260601_interview_clips.sql`

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/20260601_interview_clips.sql`:

```sql
-- Interview Studio: pipeline of AI-interview clip ideas.
create table if not exists public.interview_clips (
  id uuid primary key default gen_random_uuid(),
  source_ref text,
  source_summary text,
  question text not null,
  beats jsonb not null default '[]'::jsonb,
  script text,
  question_audio_url text,
  question_duration_seconds numeric,
  answer_footage_url text,
  answer_duration_seconds numeric,
  caption_words jsonb,
  output_url text,
  render_status text not null default 'queued',
  render_error text,
  status text not null default 'queued',
  upload_token text not null default replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists interview_clips_status_idx on public.interview_clips (status);
create unique index if not exists interview_clips_upload_token_idx on public.interview_clips (upload_token);

-- Mirror the dashboard's direct-write access pattern (anon key writes, like video_ideas).
alter table public.interview_clips enable row level security;

create policy "interview_clips anon read"   on public.interview_clips for select using (true);
create policy "interview_clips anon insert" on public.interview_clips for insert with check (true);
create policy "interview_clips anon update" on public.interview_clips for update using (true) with check (true);
create policy "interview_clips anon delete" on public.interview_clips for delete using (true);
```

- [ ] **Step 2: Apply the migration to the remote project**

Apply via the Supabase MCP `apply_migration` (project `bjbvqvzbzczjbatgmccb`, name `interview_clips`, the SQL above). If MCP is unavailable, run it in the Supabase SQL editor.

- [ ] **Step 3: Verify the table exists and is writable with the anon key**

Run (replace `$ANON` with `VITE_SUPABASE_ANON_KEY`):

```bash
curl -s "https://bjbvqvzbzczjbatgmccb.supabase.co/rest/v1/interview_clips?select=id&limit=1" \
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
```
Expected: `[]` (empty array, HTTP 200) — table exists and anon can read. If you get a permission error, re-check the RLS policies.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260601_interview_clips.sql
git commit -m "feat(interview-studio): interview_clips table + RLS"
```

---

## Task 2: TypeScript type + row mapper

**Files:**
- Modify: `types/dashboard.ts` (add interface; extend `Tab` union at line 904)

- [ ] **Step 1: Add the `InterviewClip` interface**

In `types/dashboard.ts`, add near the other panel types (e.g. just above the `Tab` type at line 904):

```ts
export interface InterviewClip {
  id: string;
  sourceRef: string | null;
  sourceSummary: string | null;
  question: string;
  beats: string[];
  script: string | null;
  questionAudioUrl: string | null;
  questionDurationSeconds: number | null;
  answerFootageUrl: string | null;
  answerDurationSeconds: number | null;
  captionWords: unknown | null;
  outputUrl: string | null;
  renderStatus: string;
  renderError: string | null;
  status: string;
  uploadToken: string;
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 2: Add `'interview'` to the `Tab` union**

In `types/dashboard.ts:904`, add `'interview'` to the union (place it next to `'video'`):

```ts
... | 'video' | 'interview' | 'agent-ready' | ...
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc`
Expected: no new errors. (Adding an unused interface + a union member won't break anything yet.)

- [ ] **Step 4: Commit**

```bash
git add types/dashboard.ts
git commit -m "feat(interview-studio): InterviewClip type + interview tab id"
```

---

## Task 3: `useInterviewClips` hook

**Files:**
- Create: `hooks/useInterviewClips.ts`

This mirrors `useVideoIdeas.ts`. Note: it uses **direct `.update()`** for field/status writes (not the `dashboard_action` RPC) so it doesn't depend on that RPC's table allowlist — matching how `uploadRecording` already writes in `useVideoIdeas`.

- [ ] **Step 1: Write the hook**

Create `hooks/useInterviewClips.ts`:

```ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { toastError, toastSuccess } from '../lib/dashboardActions';
import type { InterviewClip } from '../types/dashboard';

const N8N_BASE = 'https://n8n.ivanmanfredi.com';

function mapClip(row: any): InterviewClip {
  return {
    id: row.id,
    sourceRef: row.source_ref,
    sourceSummary: row.source_summary,
    question: row.question,
    beats: Array.isArray(row.beats) ? row.beats : [],
    script: row.script,
    questionAudioUrl: row.question_audio_url,
    questionDurationSeconds: row.question_duration_seconds,
    answerFootageUrl: row.answer_footage_url,
    answerDurationSeconds: row.answer_duration_seconds,
    captionWords: row.caption_words,
    outputUrl: row.output_url,
    renderStatus: row.render_status || 'queued',
    renderError: row.render_error,
    status: row.status || 'queued',
    uploadToken: row.upload_token,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function useInterviewClips() {
  const [clips, setClips] = useState<InterviewClip[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('interview_clips')
        .select('*')
        .order('created_at', { ascending: false });
      setClips((data || []).map(mapClip));
    } catch (err) {
      toastError('load interview clips', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const statusCounts = useMemo(() =>
    clips.reduce((acc: Record<string, number>, c) => {
      acc[c.status] = (acc[c.status] || 0) + 1;
      return acc;
    }, {}),
    [clips]
  );

  const updateField = useCallback(async (id: string, fields: Partial<Record<string, unknown>>) => {
    try {
      const { error } = await supabase.from('interview_clips').update(fields).eq('id', id);
      if (error) throw error;
      await fetch();
    } catch (err) {
      toastError('update interview clip', err);
    }
  }, [fetch]);

  // Measure a video file's duration in the browser (for answer_duration_seconds).
  const measureDuration = (file: File): Promise<number> => new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(Math.max(0, v.duration || 0)); };
    v.onerror = () => { URL.revokeObjectURL(url); resolve(0); };
    v.src = url;
  });

  const uploadAnswer = useCallback(async (id: string, file: File) => {
    try {
      const ext = file.name.split('.').pop() || 'mp4';
      const path = `interview-clips/${id}/answer.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('originals')
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: pub } = supabase.storage.from('originals').getPublicUrl(path);
      const duration = await measureDuration(file);

      const { error } = await supabase
        .from('interview_clips')
        .update({
          answer_footage_url: pub.publicUrl,
          answer_duration_seconds: duration,
          status: 'recorded',
          render_status: 'transcribing',
        })
        .eq('id', id);
      if (error) throw error;

      // Fire the render orchestration webhook (workflow is Phase A2; fail-soft).
      try {
        await window.fetch(`${N8N_BASE}/webhook/interview-render`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ interviewClipId: id }),
        });
      } catch { /* webhook not live yet — status already flipped */ }

      toastSuccess('Footage uploaded — render queued');
      await fetch();
    } catch (err) {
      toastError('upload answer footage', err);
    }
  }, [fetch]);

  const deleteClip = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from('interview_clips').delete().eq('id', id);
      if (error) throw error;
      toastSuccess('Interview idea deleted');
      await fetch();
    } catch (err) {
      toastError('delete interview clip', err);
    }
  }, [fetch]);

  return { clips, statusCounts, loading, refresh: fetch, updateField, uploadAnswer, deleteClip };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add hooks/useInterviewClips.ts
git commit -m "feat(interview-studio): useInterviewClips hook"
```

---

## Task 4: `InterviewStudioPanel` (queue + detail)

**Files:**
- Create: `components/dashboard/InterviewStudioPanel.tsx`
- Modify: `package.json` (add `qrcode.react`)

- [ ] **Step 1: Add the QR dependency**

Run: `npm install qrcode.react`
Expected: `qrcode.react` added to `package.json` dependencies; `node_modules/qrcode.react` exists.

- [ ] **Step 2: Write the panel**

Create `components/dashboard/InterviewStudioPanel.tsx`:

```tsx
import React, { useState, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Mic, Upload, Video, ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { useInterviewClips } from '../../hooks/useInterviewClips';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import VideoRecorder from './VideoRecorder';
import type { InterviewClip } from '../../types/dashboard';

const STATUS_BADGE: Record<string, string> = {
  queued: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  recorded: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  rendered: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  published: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
};

function badgeClass(status: string): string {
  return STATUS_BADGE[status] || 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30';
}

const InterviewStudioPanel: React.FC = () => {
  const { clips, statusCounts, loading, refresh, uploadAnswer, deleteClip } = useInterviewClips();
  useAutoRefresh(refresh, { realtimeTables: ['interview_clips'] });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scriptOpen, setScriptOpen] = useState(false);
  const [recording, setRecording] = useState(false);

  const selected = useMemo(
    () => clips.find((c) => c.id === selectedId) || clips[0] || null,
    [clips, selectedId],
  );

  const uploadUrl = selected
    ? `${window.location.origin}/interview-upload/${selected.uploadToken}`
    : '';

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && selected) await uploadAnswer(selected.id, file);
  };

  return (
    <div className="flex h-full text-zinc-200">
      {/* Queue */}
      <div className="w-64 border-r border-zinc-800 p-3 overflow-y-auto">
        <div className="flex items-center gap-2 mb-3">
          <Mic className="w-4 h-4 text-emerald-400" />
          <span className="font-semibold text-sm">Interview Studio</span>
          <span className="ml-auto text-xs text-zinc-500">{clips.length}</span>
        </div>
        {loading && <div className="text-xs text-zinc-500">Loading…</div>}
        {!loading && clips.length === 0 && (
          <div className="text-xs text-zinc-500">No interview ideas yet. The queue auto-stocks from your content pipeline.</div>
        )}
        {clips.map((c) => (
          <button
            key={c.id}
            onClick={() => { setSelectedId(c.id); setScriptOpen(false); setRecording(false); }}
            className={`block w-full text-left p-2.5 rounded-lg border mb-2 transition-colors ${
              selected?.id === c.id ? 'border-emerald-500 bg-emerald-500/5' : 'border-zinc-800 hover:border-zinc-700'
            }`}
          >
            <div className="text-xs text-zinc-200 leading-snug mb-1.5 line-clamp-2">{c.question}</div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${badgeClass(c.status)}`}>{c.status}</span>
          </button>
        ))}
        <div className="mt-2 text-[10px] text-zinc-600">
          {Object.entries(statusCounts).map(([s, n]) => `${n} ${s}`).join(' · ')}
        </div>
      </div>

      {/* Detail */}
      <div className="flex-1 p-6 overflow-y-auto">
        {!selected && <div className="text-zinc-500 text-sm">Select an idea from the queue.</div>}
        {selected && (
          <>
            {selected.sourceSummary && (
              <div className="text-xs text-zinc-500 mb-2">
                FROM: {selected.sourceSummary} · generated via Voice Guardrails ✓
              </div>
            )}
            <h2 className="text-2xl font-semibold text-zinc-50 leading-tight mb-5">{selected.question}</h2>

            <div className="grid grid-cols-2 gap-6">
              {/* Beats */}
              <div>
                <h4 className="text-[11px] tracking-wide text-zinc-500 font-semibold mb-2">TALKING POINTS</h4>
                {selected.beats.length === 0 && <div className="text-xs text-zinc-600">No beats.</div>}
                {selected.beats.map((b, i) => (
                  <div key={i} className="flex gap-2 items-start text-sm text-zinc-300 my-2">
                    <span className="w-[7px] h-[7px] bg-emerald-500 mt-1.5 flex-none" />
                    <span>{b}</span>
                  </div>
                ))}
              </div>

              {/* Optional script */}
              <div>
                <h4 className="text-[11px] tracking-wide text-zinc-500 font-semibold mb-2">FULL SCRIPT (OPTIONAL)</h4>
                {selected.script ? (
                  <div className="border border-zinc-800 rounded-lg bg-zinc-800/40">
                    <button
                      onClick={() => setScriptOpen((o) => !o)}
                      className="flex items-center gap-1.5 w-full px-3 py-2 text-xs text-zinc-400"
                    >
                      {scriptOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      {scriptOpen ? 'Full script' : 'Expand full script'}
                    </button>
                    {scriptOpen && (
                      <div className="px-3 pb-3 pt-2 text-sm leading-relaxed text-zinc-300 border-t border-zinc-800 whitespace-pre-wrap">
                        {selected.script}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-zinc-600">No script for this one — riff the beats.</div>
                )}
              </div>
            </div>

            {/* Record / upload */}
            <div className="mt-6 border-t border-zinc-800 pt-5">
              <div className="text-sm text-zinc-200 mb-3">📱 Go record this on your phone, then come back:</div>
              <div className="flex gap-6 items-start flex-wrap">
                <div className="text-center">
                  <div className="bg-white p-2 rounded-md inline-block">
                    <QRCodeSVG value={uploadUrl} size={88} />
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-1.5">scan to upload</div>
                </div>
                <div className="flex flex-col gap-3">
                  <label className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg bg-emerald-500 text-emerald-950 cursor-pointer w-fit">
                    <Upload className="w-4 h-4" /> Upload clip
                    <input type="file" accept="video/*" className="hidden" onChange={onFile} />
                  </label>
                  <button
                    onClick={() => setRecording((r) => !r)}
                    className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg border border-zinc-700 text-zinc-200 w-fit"
                  >
                    <Video className="w-4 h-4" /> {recording ? 'Close recorder' : 'Record in browser'}
                  </button>
                  {selected.answerFootageUrl && (
                    <div className="text-[11px] text-emerald-400">✓ footage uploaded · {selected.renderStatus}</div>
                  )}
                </div>
              </div>
              {recording && (
                <div className="mt-4">
                  <VideoRecorder onRecordingComplete={(file: File) => uploadAnswer(selected.id, file)} />
                </div>
              )}
            </div>

            <button
              onClick={() => deleteClip(selected.id)}
              className="mt-6 inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-red-400"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete idea
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default InterviewStudioPanel;
```

- [ ] **Step 3: Verify `VideoRecorder`'s callback prop name + signature**

Run: `grep -n "onRecordingComplete\|interface Props" components/dashboard/VideoRecorder.tsx`
Expected: confirms `onRecordingComplete` exists. Check whether it passes a `File` or a `Blob`. If it passes a `Blob`, wrap it: `onRecordingComplete={(blob) => uploadAnswer(selected.id, new File([blob], 'recording.webm', { type: 'video/webm' }))}`. Adjust the panel's `VideoRecorder` usage to match the real signature before typechecking.

- [ ] **Step 4: Typecheck**

Run: `npx tsc`
Expected: no errors. Fix any prop-signature mismatch surfaced for `VideoRecorder` or `useAutoRefresh` (confirm `useAutoRefresh`'s real signature with `grep -n "export function useAutoRefresh\|export const useAutoRefresh" hooks/useAutoRefresh.ts` and match the options shape).

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/InterviewStudioPanel.tsx package.json package-lock.json
git commit -m "feat(interview-studio): InterviewStudioPanel queue + guided detail"
```

---

## Task 5: Register the tab

**Files:**
- Modify: `components/dashboard/Dashboard.tsx` (lazy import + `panelComponents`)
- Modify: `components/dashboard/DashboardLayout.tsx` (`tabGroups`)

- [ ] **Step 1: Add the lazy import**

In `components/dashboard/Dashboard.tsx`, next to `LazyVideoIdeasPanel` (line 64), add:

```tsx
const LazyInterviewStudioPanel = lazy(retryImport(() => import('./InterviewStudioPanel')));
```

- [ ] **Step 2: Register in `panelComponents`**

Find the `panelComponents` map in `Dashboard.tsx` (`grep -n "panelComponents" components/dashboard/Dashboard.tsx`). Add an entry mapping the tab id to the component (match the existing entry style, e.g. alongside `video: LazyVideoIdeasPanel`):

```tsx
  interview: LazyInterviewStudioPanel,
```

- [ ] **Step 3: Add the nav tab**

In `components/dashboard/DashboardLayout.tsx`, in the `Content` group (right after the `video` entry, ~line 34), add:

```tsx
      { id: 'interview', label: 'Interview', icon: <Mic className="w-[18px] h-[18px]" /> },
```

Ensure `Mic` is imported from `lucide-react` at the top of `DashboardLayout.tsx` (add it to the existing `lucide-react` import if missing).

- [ ] **Step 4: Typecheck**

Run: `npx tsc`
Expected: no errors. The `id: 'interview'` is valid because Task 2 added it to the `Tab` union.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/Dashboard.tsx components/dashboard/DashboardLayout.tsx
git commit -m "feat(interview-studio): register Interview tab"
```

---

## Task 6: Public mobile-upload page + route

**Files:**
- Create: `components/dashboard/InterviewUploadPage.tsx`
- Modify: `App.tsx`

- [ ] **Step 1: Write the upload page**

Create `components/dashboard/InterviewUploadPage.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

const N8N_BASE = 'https://n8n.ivanmanfredi.com';

const InterviewUploadPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [row, setRow] = useState<{ id: string; question: string } | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'uploading' | 'done' | 'notfound'>('loading');

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('interview_clips')
        .select('id, question')
        .eq('upload_token', token)
        .maybeSingle();
      if (data) { setRow(data); setState('ready'); } else { setState('notfound'); }
    })();
  }, [token]);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !row) return;
    setState('uploading');
    try {
      const ext = file.name.split('.').pop() || 'mp4';
      const path = `interview-clips/${row.id}/answer.${ext}`;
      const { error: upErr } = await supabase.storage.from('originals').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('originals').getPublicUrl(path);
      await supabase.from('interview_clips')
        .update({ answer_footage_url: pub.publicUrl, status: 'recorded', render_status: 'transcribing' })
        .eq('id', row.id);
      try {
        await fetch(`${N8N_BASE}/webhook/interview-render`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ interviewClipId: row.id }),
        });
      } catch { /* fail-soft */ }
      setState('done');
    } catch {
      setState('ready');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F7F4EF', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
        {state === 'loading' && <p>Loading…</p>}
        {state === 'notfound' && <p>This upload link is invalid or expired.</p>}
        {(state === 'ready' || state === 'uploading') && row && (
          <>
            <div style={{ fontSize: 13, color: '#2A8F65', fontWeight: 600, marginBottom: 8 }}>YOUR QUESTION</div>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 24, color: '#1A1A1A', lineHeight: 1.2, marginBottom: 24 }}>{row.question}</h1>
            <label style={{ display: 'inline-block', background: '#1A1A1A', color: '#F7F4EF', padding: '14px 22px', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
              {state === 'uploading' ? 'Uploading…' : 'Choose your recording'}
              <input type="file" accept="video/*" style={{ display: 'none' }} onChange={onFile} disabled={state === 'uploading'} />
            </label>
          </>
        )}
        {state === 'done' && <p style={{ fontSize: 18, color: '#1A1A1A' }}>✓ Uploaded. You can close this and head back to the dashboard.</p>}
      </div>
    </div>
  );
};

export default InterviewUploadPage;
```

- [ ] **Step 2: Add the standalone route in `App.tsx`**

`App.tsx` gates standalone pages by path (like `/v/:token`). Mirror that pattern. Add a lazy import near the other lazies:

```tsx
const InterviewUploadPage = lazy(() => import('./components/dashboard/InterviewUploadPage'));
```

Add a path flag near `isDashboardV2Path` (~line 62):

```tsx
  const isInterviewUpload = location.pathname.startsWith('/interview-upload/');
```

Add a standalone `<Routes>` block mirroring the existing `/v/:token` block (around line 91), rendered before the dashboard branches when `isInterviewUpload` is true:

```tsx
  if (isInterviewUpload) {
    return (
      <Suspense fallback={null}>
        <Routes>
          <Route path="/interview-upload/:token" element={<InterviewUploadPage />} />
        </Routes>
      </Suspense>
    );
  }
```

Match the exact `Suspense`/wrapper style used by the existing `/v/:token` and `/walkthrough` standalone branches (read lines 85–130 of `App.tsx` and copy their structure — they may early-return a wrapped element rather than using an `if`). Use whichever pattern is already there.

- [ ] **Step 3: Typecheck**

Run: `npx tsc`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/InterviewUploadPage.tsx App.tsx
git commit -m "feat(interview-studio): public token-scoped mobile upload page"
```

---

## Task 7: Seed data + visual verification

**Files:**
- Create: `scripts/seed-interview-clips.sql` (seed fixture)

- [ ] **Step 1: Write seed rows**

Create `scripts/seed-interview-clips.sql`:

```sql
insert into public.interview_clips (source_summary, question, beats, script, status, render_status)
values
('"AI agents are overhyped" — LinkedIn post', 'What do most agencies get wrong about AI agents?',
 '["They automate the flashy task, not the costly one","Real ROI is in the boring back-office repetition","Example: invoice triage vs an AI chatbot","Takeaway: map cost-per-task before you build"]'::jsonb,
 'Most teams buy the demo, not the outcome. They wire up a chatbot because it looks like progress — meanwhile the thing quietly bleeding hours is invoice triage, and nobody touches it. Map cost-per-task first and the build picks itself.',
 'queued', 'queued'),
('Weekly ops review', 'The one workflow every service team should automate first?',
 '["Start where the same data is re-keyed 3+ times","Lead intake is almost always the bleeding edge","Show the before: 6 tools, 20 min per lead","Takeaway: automate the handoff, not the whole job"]'::jsonb,
 null, 'queued', 'queued');
```

- [ ] **Step 2: Apply the seed**

Apply via Supabase MCP `execute_sql` (project `bjbvqvzbzczjbatgmccb`) or the SQL editor.

- [ ] **Step 3: Run the dashboard and verify the queue + detail (REQUIRED visual check)**

Run: `npm run dev` (Vite, port 5173). Open `http://localhost:5173/dashboard`, authenticate, open the **Interview** tab. Confirm:
- Queue shows the 2 seeded ideas with `queued` badges.
- Selecting the first shows the question, the 4 beats (sage square bullets), and an expandable Full Script that opens/closes.
- Selecting the second shows "No script for this one — riff the beats."
- The record/upload block shows a QR code, an "Upload clip" button, and "Record in browser".

Take a screenshot (Playwright or the `playwright-driver` skill against `localhost:5173/dashboard`) and inspect it. Fix any layout/style issues before proceeding.

- [ ] **Step 4: Verify the upload path (REQUIRED)**

Either scan the QR with a phone OR open `http://localhost:5173/interview-upload/<upload_token>` (copy a token from the seeded row). Confirm the page shows the question and a file picker. Upload any short video; confirm:
- The file lands in Supabase storage `originals/interview-clips/<id>/answer.*` (check the Supabase dashboard or `supabase.storage` list).
- The row's `status` flips to `recorded` and `answer_footage_url` is set.
- Back in the dashboard Interview tab, the idea now shows "✓ footage uploaded".
(The `interview-render` webhook will 404 until Phase A2 — that's expected and handled fail-soft.)

- [ ] **Step 5: Commit**

```bash
git add scripts/seed-interview-clips.sql
git commit -m "test(interview-studio): seed fixture + verified queue/detail/upload flow"
```

---

## Self-Review (completed during planning)

- **Spec coverage:** Delivers the spec's Phase A *dashboard* surface — Option A queue+detail (Task 4), beats-primary + collapsible optional script (Task 4), all three upload paths (Task 4 drag-drop + in-browser; Task 6 QR mobile page), `interview_clips` table incl. `upload_token` (Task 1), realtime queue (`useAutoRefresh` in Task 4), tab registration (Task 5). The n8n render workflow, ElevenLabs voicing, Deepgram, and the auto-scoring generator are explicitly deferred to Phase A2/B (header + scope boundary). The `interview-render` webhook call is in place (Task 3, Task 6) firing to the future workflow.
- **Type consistency:** `InterviewClip` field names (Task 2) match `mapClip` output (Task 3) and panel usage (Task 4). `uploadAnswer(id, file)` signature is identical in the hook (Task 3) and both call sites (panel Task 4, and the upload page reimplements the same storage+update inline in Task 6). Tab id `'interview'` is added to the union (Task 2) before being used in registration (Task 5).
- **Placeholder scan:** No TBD/TODO. The two real verification dependencies — `VideoRecorder`'s exact callback signature and `useAutoRefresh`'s exact options shape — are called out with explicit grep-and-adjust steps (Task 4 steps 3–4) rather than assumed, because they're existing code I did not fully read.

---

## After this plan (follow-on)

- **Phase A2 — render orchestration:** n8n "Interview Render" workflow (webhook `interview-render` → Deepgram transcribe `answer_footage_url` → POST video-engine `/render/interview-clip` with `{question, questionAudioUrl, questionDurationSeconds, videoUrl, words, answerDurationSeconds}` → write `output_url`, flip `status=rendered`), plus ElevenLabs question voicing to populate `question_audio_url`/`question_duration_seconds` at idea-creation time. Then wire the dashboard "review → publish" step.
- **Phase B — auto-stock:** n8n "Interview Idea Generator" that scores content for video-interview fit and generates question + beats + script via a ClickUp prompt page embedding the VOICE GUARDRAILS block (Forbidden Language `2ky5ezad-1913` + Ivan's Voice `2ky5ezad-1033`).

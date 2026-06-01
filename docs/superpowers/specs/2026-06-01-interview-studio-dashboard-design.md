# Interview Studio Dashboard — Design

**Date:** 2026-06-01
**Author:** Ivan Manfredi (brainstormed with Claude)
**Status:** Approved design — pending implementation plan
**Relates to:** the AI-interview clip format (Plan 1 shipped: `InterviewClip` Remotion composition + `POST /render/interview-clip` on the video engine, branch `feat/interview-clip`). This is "Plan 2 — orchestration", dashboard-first.

## Goal

Give Ivan a guided dashboard experience that turns the AI-interview format into a low-friction habit: a pipeline of interview ideas flows in automatically, and for each one the dashboard hands him a question + talking points, tells him to go record, and lets him drop the footage back in — then renders and publishes the finished studio-look clip.

The emotional target: open the panel, see "here's your next question and the beats to hit," go shoot it on the phone, come back, upload, done.

## Decisions locked during brainstorming

| Decision | Choice |
|---|---|
| "Script" meaning | **Talking points / beats** are primary (riff in own words, stay authentic). A **full verbatim script is available but collapsed** beside the beats — optional crutch, not the default. |
| Session shape | A **pipeline/queue of ideas**, worked **one at a time**. Not an ad-hoc generate-each-time, not a forced batch stepper. |
| Queue source | **Auto-stocked** by an n8n job that scores existing content for video-interview fit and generates question + beats + script. |
| Upload path | **All three** supported: QR/mobile-upload link, desktop drag-drop, in-browser record. All land the same file against the same idea. |
| Panel layout | **Option A — queue + detail**: queue list (left) with status badges; selected idea (right) with question, beats, expandable script, and the record/upload block. |
| Copy quality | **All generated copy runs through Ivan's anti-AI voice rules** — ClickUp Forbidden Language (`2ky5ezad-1913`) + Ivan's Voice (`2ky5ezad-1033`) via the VOICE GUARDRAILS block. No AI tells. |

## Architecture (data flow)

```
[content pipeline]
   → n8n "Interview Idea Generator" (scores content for video-fit;
     Claude via Railway proxy; prompt in ClickUp; VOICE GUARDRAILS applied)
   → interview_clips row (status=queued; question, beats[], script, source ref)
   → ElevenLabs voices the question → question_audio_url

[dashboard: Interview Studio panel]
   queue (left)  ·  selected idea detail (right: question / beats / expandable script)
   → "go record" + upload (QR mobile page | drag-drop | in-browser)
   → footage lands in Supabase storage, row.status=recorded
   → POST n8n webhook /interview-render

[n8n "Interview Render"]
   → Deepgram transcribes answer footage → words[]
   → POST video-engine /render/interview-clip {question, questionAudioUrl,
     questionDurationSeconds, videoUrl, words, answerDurationSeconds}
   → output mp4 → Drive/storage → row.status=rendered, output_url

[dashboard]
   review rendered clip → publish (existing LinkedIn/IG path) → status=published
```

## Data model — `interview_clips` (Supabase)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `source_ref` | text | post / content-idea id the question came from |
| `source_summary` | text | short human label shown as "FROM: …" |
| `question` | text | generated interview question (voice-guardrailed) |
| `beats` | jsonb | array of talking-point strings (primary guidance) |
| `script` | text | optional full verbatim script (collapsed in UI) |
| `question_audio_url` | text | ElevenLabs host voice of the question |
| `question_duration_seconds` | numeric | length of question audio (drives render) |
| `answer_footage_url` | text | uploaded answer clip (storage) |
| `answer_duration_seconds` | numeric | measured on upload |
| `caption_words` | jsonb | Deepgram word-timings (answer-relative) |
| `output_url` | text | finished 9:16 clip |
| `render_status` | text | queued / recording / transcribing / rendering / done / error |
| `render_error` | text | null unless failed |
| `status` | text | queued / recorded / rendered / published |
| `upload_token` | text | unguessable token for the mobile-upload page (scopes upload to this row) |
| `created_at` | timestamptz | |

## Components

### Dashboard (personal-site, React 19 + Vite + Tailwind v4, dark zinc theme)

**New panel — `InterviewStudioPanel.tsx`** (`components/dashboard/`), registered as a tab in the three usual places (`types/dashboard.ts` Tab union, `Dashboard.tsx` lazy + `panelComponents`, `DashboardLayout.tsx` `tabGroups`). v2 Shell registration mirrors the existing pattern.

- **Queue (left):** reads `interview_clips` via the `supabase` singleton, ordered newest-first, status badges styled like existing panels (blue=ready, amber=rendering, violet=published). Live updates via `useAutoRefresh({ realtimeTables: ['interview_clips'] })`.
- **Detail (right):** selected idea shows source label, the question (large), **beats** (square sage bullets, primary, left col), and an **expandable Full Script** (collapsed by default, right col). A small "Voice Guardrails ✓" marker.
- **Record/upload block:** "Go record this on your phone, then come back" with: (a) a **QR code** + short link to the mobile-upload page scoped by `upload_token`; (b) a **drag-drop** zone (reuses `supabase.storage.from('originals').upload(...)` pattern from `useVideoIdeas`); (c) **Record in browser** reusing `VideoRecorder.tsx`. All set `answer_footage_url`, flip `status=recorded`, and POST the render webhook.
- **Hook — `useInterviewClips.ts`** mirrors `useVideoIdeas.ts`: load, field updates via `dashboardAction('interview_clips', …)`, upload, and webhook fire to `${N8N_BASE}/webhook/interview-render`. Status polling + realtime like the video panel.

**New mobile-upload page** — a tiny route (e.g. `/upload/:token`) that resolves the `interview_clips` row by `upload_token`, shows the question for context, accepts a single video file → same storage upload → same status flip + webhook. No dashboard auth (token is the capability); token is single-purpose and per-row.

### Backend (n8n + ClickUp prompt + existing video engine)

- **n8n "Interview Render" workflow** (new): webhook `interview-render` → Deepgram transcribe `answer_footage_url` → POST video-engine `/render/interview-clip` → store `output_url` → update row. Reuses the Deepgram + render-call patterns from the existing Video Generator workflow.
- **ElevenLabs question voicing:** at idea-generation time (so `question_audio_url` + `question_duration_seconds` are ready before recording), reusing the existing ElevenLabs credential/voice.
- **n8n "Interview Idea Generator" workflow** (Phase B): scores existing content for video-interview fit, generates question + beats + script through a **ClickUp prompt page** (per project rule — prompts never hardcoded in nodes) that embeds the VOICE GUARDRAILS block referencing Forbidden Language + Ivan's Voice. Writes `interview_clips` rows with `status=queued`.

## Phasing

**Phase A — the guided panel + render orchestration (build first; the value Ivan asked for):**
- `interview_clips` table + `upload_token`.
- `InterviewStudioPanel` (queue + detail + beats + expandable script + 3 upload paths) and `useInterviewClips`.
- Mobile-upload page.
- n8n "Interview Render" workflow (Deepgram → `/render/interview-clip`) + ElevenLabs question voicing.
- Seed the queue with 1–2 ideas (manual insert or a one-off generation) so the flow is demoable end-to-end.

**Phase B — auto-stocking (after A proves the loop):**
- n8n "Interview Idea Generator": content video-fit scoring + question/beats/script generation via the ClickUp voice-guardrailed prompt, auto-filling the queue.

## Non-goals (YAGNI)

- Verbatim teleprompter as the default (rejected — beats primary, script is an optional reveal).
- Forced multi-question batch stepper (rejected — one-at-a-time from a queue).
- Re-building TTS/transcription/render — all reused (ElevenLabs, Deepgram, shipped `/render/interview-clip`).
- A separate auth system for the mobile page (the per-row `upload_token` is the capability).

## Open questions for planning

- Is `interview_clips` a new table or an extension of `video_ideas`? (Lean new table — distinct lifecycle + columns; decide in plan.)
- Exact `output_url` destination (Google Drive vs Supabase storage `originals`) — match whatever the Video Generator currently does.
- Where the mobile-upload route mounts (App.tsx route) and whether it needs to be excluded from the dashboard-v2 flag/auth wrapper.
- v1-only panel, or register in both v1 and v2 Shell from the start.

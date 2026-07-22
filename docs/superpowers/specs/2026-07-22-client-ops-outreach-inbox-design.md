# Client Ops — Outreach Inbox (two-pane) design

**Date:** 2026-07-22
**Surface:** Client Ops → Outreach (per-client, RISE DTC first)
**Author:** Ivan + Claude

## Problem

The Outreach section shows a client's LinkedIn outreach as lane-grouped accordions
(campaign → sequence copy → collapsible people). That is good for *auditing the
message templates*, but it hides the thing Ivan actually needs day to day: the live
**conversations**. He wants a comprehensive inbox — see every chat and every sent
connection, scan them fast, open one, read the full thread, and answer from inside it.

## Decisions (locked)

- **Scope:** per-client, inside Client Ops → Outreach for the selected client.
- **Layout:** two-pane inbox (conversation list left, thread + draft/composer right),
  collapsing to single-column on narrow screens.

## Key finding: zero backend work

The existing read RPC `operator_client_outreach(p_gate, p_client_id)` already returns
everything an inbox needs, per prospect across the client's active campaigns:

- identity (name, company, headline, icp_score, lane/campaign)
- lifecycle timestamps: `connection_sent_at`, `connected_at`, `last_dm_sent_at`,
  `last_reply_at`, `reply_count`, `dm_count`, `needs_manual_reply`, `awaiting_reply`,
  `messaged`, `blacklisted`, name-gate flags
- full `messages[]` timeline (inbound + outbound + reactions, each with text +
  timestamp, time-ordered)

Pending drafts come from `operator_client_pending_drafts(p_gate, p_client_id)`, each
carrying `prospect_id` → joins cleanly to a thread. Approve/edit/send reuse the existing
gated write paths verbatim: `operator_approve_rise_draft` (with its `conversation_moved_on`
guard), `operator_edit_rise_draft`, `operator_send_to_lead`.

**No migrations, no RPC changes, no n8n changes.** This is a frontend reorganization of
two hooks Ivan already ships.

## Architecture

New component `OutreachInbox.tsx` (scoped `co4-` CSS). It consumes the SAME two hooks
`useClientOutreach` + `useClientPendingDrafts` and derives a `conversations` model
client-side. `OutreachView.tsx` hosts it as the default tab; the current lane view is
demoted to a secondary "Lanes & sequences" tab; the standalone Waiting/Drafts tabs are
removed (the inbox subsumes both).

### Conversation model (derived, client-side)

A prospect becomes a *conversation* iff it has activity:
`connection_sent_at || connected_at || messages.length > 0`. Never-contacted staged
prospects are excluded from the default list and reachable via the "Staged" segment.

Per conversation compute:
- `lastActivityAt` = max(last_reply_at, last_dm_sent_at, connected_at,
  connection_sent_at, newest message time)
- `snippet` = newest non-reaction message text, else a lifecycle label
  ("Connected, no message yet" / "Invite sent")
- `status`: `needs_reply` (needs_manual_reply) > `awaiting` (messaged, no newer reply)
  > `connected` (connected, not messaged) > `invited` (invite sent, not yet connected)
- `draft`: the pending draft whose `prospect_id` matches (if any)

### Left pane — conversation list

- Segment chips: `All · Needs reply · Awaiting · Connected · Invite sent · Drafts · Staged`
  with live counts. Default segment = `All` but sorted needs-reply-first.
- Search box (name / company, case-insensitive substring).
- Sort: `needs_reply` first, then `lastActivityAt` desc.
- Row: status dot, name · company, snippet (1 line, ellipsized), relative age, ICP chip,
  badges (● draft, scan ✓, name-gated, blacklisted). Selected row highlighted.

### Right pane — thread

- Header: name, company, headline; status line derived from timestamps
  ("connected 3d ago · 2 DMs · replied 2m ago"); channel + ICP + lane chips.
- Timeline: chat bubbles (inbound left, outbound right), reactions rendered as a small
  inline note, and connection lifecycle rendered as centered system lines
  ("Connection request sent · Jul 20", "Connected · Jul 21").
- Inline draft block (when a pending draft exists for this prospect): the draft text,
  Edit (textarea + Save/Cancel via `editRiseDraft`), Approve & send (via
  `approveRiseDraft`; on `conversation_moved_on` the block drops and the list reloads).
  Scan-link badge shown when present.
- Manual composer: textarea + Send (via `operator_send_to_lead`, gated, `window.confirm`
  from the client's seat). Same behavior as today's `SendComposer`.
- Empty state when nothing is selected; auto-select the top conversation on load, and if
  any conversation needs a reply, select the first one (keeps "pending responses first").

### Responsive

Below ~760px: list only; selecting a conversation swaps to a full-width thread with a
"‹ All chats" back button. Above: fixed two-pane grid, both panes independently
scrollable, bounded to the section height (the dashboard shell already bounds the row to
the viewport, commit f33a27c).

## Guardrails preserved

- Read-only surface except the three existing gated write paths; nothing new can send.
- `conversation_moved_on` guard still fires on approve, so a draft written before a manual
  takeover is discarded, never double-sent.
- Every rendered line is data pulled from Supabase (messages, copy) — no fabricated copy
  generated here. The composer is free-text authored by the operator.
- Armed banner (sending paused) preserved.

## Out of scope (later)

- Global cross-client inbox roll-up (this design is the per-client foundation).
- Scan link in the thread header (would need `report_url` added to the prospect payload).
- Realtime push; the inbox reloads on the existing manual refresh + hook mounts.

## Files

- NEW `components/dashboard-v2/sections/clientops2/OutreachInbox.tsx`
- EDIT `components/dashboard-v2/sections/clientops2/OutreachView.tsx` (host Inbox as
  default tab; keep Lanes tab; drop Waiting/Drafts tabs)
- No `shared.tsx` change (all fields already present)

Deploy: `git push origin main` (stage only own files).

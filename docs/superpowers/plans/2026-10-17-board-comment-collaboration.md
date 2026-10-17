# Board comment collaboration implementation plan

> **For agentic workers:** Use executing-plans to implement this plan inline, with a fresh review before merge.

**Goal:** Add board-member mentions, reversible thread resolution and useful feedback counts to SwishDM review.

**Architecture:** Add versioned RPCs around the existing board comment API. Keep original comment/audit records, validate membership and permissions server-side, and expose mention/resolution metadata through the existing board team context. Extend the current comment composer and batch cards rather than introducing another review surface.

**Tech Stack:** React, TypeScript, Vitest, Supabase PostgreSQL.

**Spec:** User approved the recommendation to start with @mentions and resolved comments, in this thread.

## Global constraints

- One post preview remains. Existing post approval, scheduling and other client layouts stay intact.
- Only authenticated board members can write. The board link can read; approvers/admins can resolve any thread and viewers can resolve their own.
- Mention candidates and accepted recipients come from the current board's team only.
- Resolution applies to a root thread, keeps replies/history, and is reversible.
- Mentions appear inside the board; retain the existing operator notification path.
- Writes confirm only after server success. Errors preserve draft text. No production test messages.

## Review focus

- Rejected/expired sessions, cross-board references and nonmember mentions must never write.
- A reply's mention must count on its root thread; resolved threads stop contributing to open counts.
- Names with spaces, duplicate first names, deleting selected mention text and keyboard selection must work.
- Failed resolution must keep the actual status; failed comments must preserve text and recipients.
- Comments and mention state must survive mobile panel switches and post navigation must not eat composer keys.

### Task 1: Persistent collaboration contracts

Files: `supabase/migrations/20261017_board_comment_collaboration.sql`, `supabase/tests/board_comment_collaboration.sql`.

- [x] Inspect and back up live comment/auth functions.
- [x] Write SQL behavioral assertions in a rollback transaction for invalid sessions, cross-board parents, invalid mention recipients, successful root/reply writes, permission checks, resolution and reopening.
- [x] Run assertions against the unchanged database and observe missing-function failures.
- [x] Add `board_comments_list_v2`, `board_comment_add_v2`, `board_comment_resolve`; reuse original add/list behavior while preserving metadata and audit trail.
- [x] Apply migration, rerun rollback tests, verify function grants and anonymous denial.

### Task 2: Comment composer and feedback indicators

Files: `components/client-board/team.tsx`, new `CommentComposer.tsx`, `components/ClientBoardPage.tsx`, `components/client-board/BatchReviewOverview.tsx`, corresponding tests.

- [x] Write failing component tests for selecting real-member mentions, replies, text deletion, keyboard behavior, failed writes, resolving/reopening and per-card root-thread counts.
- [x] Extend optional team context fields for members, mention recipients and resolution callbacks.
- [x] Use versioned RPCs and update local comments from server receipts; refresh on board focus with cleanup.
- [x] Render accessible @mention suggestions, highlighted mentions and root-thread Resolve/Reopen actions.
- [x] Show open-thread counts and Mentioned you indicators on batch cards; provide Open feedback / Mentioned you filters.
- [x] Run focused and complete Node suites, Deno tests, main/board builds, desktop/phone interaction checks.

### Task 3: Review and release

- [x] Independent code/security review; address material issues with regression tests.
- [ ] Create and link PR, verify exact head/base/checks, merge.
- [ ] Publish through documented board release workflow and verify live bundle.
- [ ] Capture accepted behavior and verification evidence in shared task memory.

## Verification record

- Live existing functions backed up; new migration tested transactionally before application.
- SQL tests pass after applying migration, with all fixture rows rolled back. Original comment/auth definitions remain unchanged.
- Actual anon RPC calls confirm unauthenticated read/write/resolve denial.
- 969 Node tests and 6 Deno tests pass; main and board-host builds pass.
- Desktop 1440px and phone 375px checks: mention picker, selected identity, posting, resolving, batch filters, draft retention and zero horizontal overflow.
- Independent review found duplicate-name identity loss and conditional-mount draft loss. Regression tests observed RED then GREEN after server/client label disambiguation and parent-owned drafts.
- Also fixed completed-tag prose replacement and strict server tag boundaries. Versioned reads include all visible board comments so old open threads remain counted; 501-row rollback fixture verifies this.
- No real production comments were posted for testing.

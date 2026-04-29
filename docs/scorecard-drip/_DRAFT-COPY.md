# Scorecard Drip — Email Copy Drafts

**Source of truth (post-approval):** ClickUp Prompts Library. This file is a versioned reference draft for review.

**Tokens used:**
- `{{first_name}}` — fallback "there"
- `{{verdict}}` — "Agent-Ready" / "Close" / "Foundation first"
- `{{score}}` — "18"
- `{{weakest_title}}` — full precondition title
- `{{weakest_key}}` — `structured_input` / `decision_logic` / `narrow_scope` / `human_loop`
- `{{result_url}}` — `https://ivanmanfredi.com/scorecard/result/:id`
- `{{roadmap_pdf_url}}` — Supabase Storage public link
- `{{blueprint_url}}` — `https://ivanmanfredi.com/assessment`
- `{{discovery_url}}` — `https://ivanmanfredi.com/start`
- `{{unsubscribe_url}}` — n8n-generated

**Send timing (10-day arc):**
- Email 1 → immediate
- Email 2 → +3 days
- Email 3 → +7 days
- Email 4 → +10 days

**Drip-stop:** any Blueprint CTA click → `engaged` state, all subsequent emails cancelled.

**Tone benchmarks:**
- Iván's Upwork profile (conversational, plain, no jargon)
- No "immutable infrastructure", no "self-healing", no "AI consultant", no "Hire a System"
- Italic serif only on approved drama pivots: "Agent-Ready Ops", "scale without scaling payroll", "90-Day Payback Rule", "run without you", "systems that outlast hires"

---

# EMAIL 1 — Immediate (the verdict + roadmap)

**Subject:** Your Agent-Ready verdict ({{score}}/20)

**Preheader:** Plus your 30-day roadmap, attached.

**Body:**

Hey {{first_name}},

You finished the scorecard. Your verdict is **{{verdict}}**, scored {{score}}/20.

Here's what that means in plain English:

> {{verdict_one_liner}}

The weakest link in your stack right now is **{{weakest_title}}**. That's the precondition I'd start with — not because the others don't matter, but because most teams fix three out of four and then stall on the one they didn't.

I put together a short PDF that walks through how to tighten that specific precondition over the next 30 days. No theory, no jargon. Just the order to do things in.

→ [Download your 30-day roadmap]({{roadmap_pdf_url}})

Your scorecard result lives at this URL if you want to bookmark or share it: {{result_url}}

I'll send a couple more notes over the next ten days — one with a story about what {{weakest_title}} looks like when it breaks, one with the specific moves I'd make to fix it. After that, I'll go quiet unless you write back.

— Iván

---

*Manfredi · [ivanmanfredi.com](https://ivanmanfredi.com)*
*[Unsubscribe]({{unsubscribe_url}})*

**Verdict one-liners (slot into `{{verdict_one_liner}}`):**
- `agent_ready`: "You meet the four preconditions every AI deployment needs before it ships. The infrastructure is there — what's missing is sequencing."
- `close`: "You're one or two preconditions short of being deployment-ready. The gaps aren't fatal, but they will block the build until you close them."
- `foundation`: "The preconditions aren't in place yet. That's not a problem — it just means the work to do first is ops work, not AI work. Reverse the order and the rest gets easier."

---

# EMAIL 2 — Day 3 (what the weakest precondition looks like when it breaks)

**Subject:** When {{weakest_title}} goes wrong

**Preheader:** A short story from a recent build.

**Body:**

{{first_name}},

Quick follow-up on your scorecard. You scored lowest on **{{weakest_title}}**, so let me show you what that actually looks like when it breaks in production.

{{precondition_failure_story}}

The pattern is always the same. The team thinks the AI is the problem. The AI is fine — it's working with what it was given. The thing underneath it isn't ready, and the failure shows up as "the AI isn't accurate enough."

Most of the work I do isn't AI work. It's tightening the {{weakest_title_lower}} so the AI can actually do its job.

Next email I'll walk through the specific moves that fix this. Until then.

— Iván

*[Unsubscribe]({{unsubscribe_url}})*

---

# EMAIL 3 — Day 7 (the actual fix)

**Subject:** How to tighten {{weakest_title}}

**Preheader:** Three moves, in order.

**Body:**

{{first_name}},

Here's the order I'd fix {{weakest_title}} in. Not the only way — just the one that's worked across the last twenty-something builds.

{{precondition_fix_steps}}

That's the full sequence. None of it requires AI. Most of it doesn't require code. It's process work, which is why most founders skip it — it doesn't feel like the exciting part.

Here's the thing: if you do this work first, the AI build that comes next takes a fraction of the time and actually holds. If you skip it, the AI build will look like it works in the demo and quietly drift in production.

If you want help mapping this for your specific operation, that's what the **Agent-Ready Blueprint** does. One week. You leave with the sequenced plan.

→ [Build your Blueprint]({{blueprint_url}})

— Iván

*[Unsubscribe]({{unsubscribe_url}})*

---

# EMAIL 4-A — Day 10 (Agent-Ready / Close path → Blueprint CTA)

**Subject:** Last note from me

**Preheader:** Then I'll get out of your inbox.

**Body:**

{{first_name}},

Last note. You scored {{verdict}} — meaning you're either there or one or two preconditions away.

When teams in your spot pay for the **Agent-Ready Blueprint**, here's what they get back:

- A scorecard against all four preconditions, with specific gaps named
- Your **90-Day AI Rollout Plan** — sequenced builds for the next 90 and 180 days
- Costed gap analysis with a dollar number on every gap
- Decision logic for the first project, ready to hand to any builder
- A 60-minute live walkthrough of the findings

It's $2,500. If you move forward with any follow-on engagement (Lead Magnet System, Fractional, custom build), the full $2,500 is credited back. If I tell you to wait and fix the foundation first, that recommendation is the deliverable.

The way I think about it: if your operation clears the four conditions, AI becomes a force multiplier. If it doesn't, you're funding demos that never ship. The Blueprint is one week of finding out which one you are.

→ [Build your Blueprint]({{blueprint_url}})

If now isn't the right time, no follow-up. The roadmap is yours to keep.

— Iván

*[Unsubscribe]({{unsubscribe_url}})*

---

# EMAIL 4-B — Day 10 (Foundation path → Discovery call CTA)

**Subject:** Last note from me

**Preheader:** Then I'll get out of your inbox.

**Body:**

{{first_name}},

Last note. You scored {{verdict}} — meaning the four preconditions aren't quite in place yet, and AI work right now would be premature.

That's the most useful thing the scorecard can tell someone. Most founders find this out by spending six months and $40k on a build that doesn't hold.

If you want to talk through what to fix first, I do free 30-minute discovery calls. No pitch. We figure out the right path and what — if anything — I should be involved in. Sometimes the answer is "you don't need me yet, here's what to do for the next quarter." That's a fine outcome.

→ [Book a 30-min call]({{discovery_url}})

If now isn't the right time, no follow-up. The roadmap is yours to keep.

— Iván

*[Unsubscribe]({{unsubscribe_url}})*

---

# PRECONDITION SNIPPETS (slot into Email 2 + Email 3)

These are the per-precondition bodies. Email 2 uses `{{precondition_failure_story}}`, Email 3 uses `{{precondition_fix_steps}}`. The drip workflow picks based on `{{weakest_key}}`.

---

## Snippet — `structured_input` (Reliable input pipeline)

### Email 2 body — failure story:

A founder I worked with last year had a lead-qualification AI that kept misclassifying enterprise leads as SMB. They tuned the prompt for two weeks. Tried three different models. Same result.

The actual problem: the source data the AI was reading lived in four places — HubSpot, a Notion table their SDR maintained by hand, an Apollo enrichment that fired sometimes, and a Calendly intake form. Each source had a slightly different idea of "company size." When the AI saw conflicting signals, it defaulted to the smallest number, which made every enterprise lead look like a 50-person SMB.

Fixing the prompt wouldn't have helped. The input pipeline was incoherent.

### Email 3 body — fix steps:

1. **Pick one canonical source per data point.** Pick the one that's most consistently maintained, not the one that's most "complete." A 70%-coverage source that's reliably current beats a 95%-coverage source that's six months stale.

2. **Make extraction explicit.** If your canonical source is a doc or a chat history, that's fine — but write the extraction step. Either someone's tagging the doc consistently, or you have a parser that pulls structure out of it. Pretending the AI can "just read" unstructured stuff is the most expensive shortcut in this space.

3. **Test the pipeline before you test the model.** Before any prompt work, ship the data layer. If the same query gives the same answer twice in a row across a week, you're ready. If it doesn't, fix that first.

---

## Snippet — `decision_logic` (Documentable decision logic)

### Email 2 body — failure story:

A consulting firm I worked with had a senior associate who triaged inbound RFPs better than anyone else. They wanted to encode her judgment so the rest of the team could move faster.

Six weeks in, the AI was getting roughly half the calls right. The associate would look at an RFP and say "no, this one's actually a fit, you missed the signal that they mentioned a deadline." The team would update the prompt. Next week, a different signal got missed.

What was actually happening: she had eighteen heuristics in her head, layered, with weights that shifted based on context. She wasn't being unhelpful — she genuinely couldn't tell us all of them. The decision logic wasn't documentable because it wasn't documented even to herself.

We spent two weeks shadowing her with a transcription tool, asking her to think out loud on every RFP. That document — not the prompt — was what made it work.

### Email 3 body — fix steps:

1. **Shadow your best operator on the actual work for a week.** Record what they do, ask them to narrate why. The thing you're encoding isn't their conscious decisions — it's the unconscious ones.

2. **Write the heuristics as if-then rules first, weights second.** Resist starting with weights. The hard part is naming the rules; the weights only matter once you know what they're weighing.

3. **Test the doc before you test the model.** Hand the doc to someone else on the team and have them make ten decisions using only the doc. If they get six right, the doc is ready for an AI. If they get three right, the doc isn't done yet — and the AI won't save you.

---

## Snippet — `narrow_scope` (Narrow initial scope)

### Email 2 body — failure story:

A SaaS founder hired me to help "automate ops with AI." We mapped what that meant. The list had nineteen workflows on it. Lead routing, onboarding emails, support triage, invoice reconciliation, Slack summaries, churn alerts, all of it.

I asked which one was the bottleneck. He couldn't pick. They all seemed important.

We agreed to start with one — support triage — and the build shipped in four weeks. It saved the support team about twelve hours a week. He immediately wanted to roll the same approach across the other eighteen workflows.

The problem: the next eighteen weren't the same shape. Lead routing required CRM integrations they didn't have. Onboarding emails needed brand voice training the company hadn't done. Invoice reconciliation touched a finance system with brittle exports. None of those problems showed up until we tried.

The narrow scope wasn't a constraint — it was the reason the first build worked.

### Email 3 body — fix steps:

1. **Pick one workflow. Define it end-to-end.** What's the input? What's the output? Who's the user? What does failure look like? If you can't answer those four questions in five minutes, the scope isn't narrow yet.

2. **Refuse to widen until the first one is in production for 30 days.** Not "demo'd" — running, with humans not babying it. The 30 days is where you find out which assumptions were wrong.

3. **When you do widen, treat each new workflow as a separate scope decision.** Don't assume the second one is just like the first. The reason narrow scope works is that it forces you to surface the hidden constraints. Skipping that step on workflow #2 erases the win from workflow #1.

---

## Snippet — `human_loop` (Human-in-the-loop by design)

### Email 2 body — failure story:

An agency I worked with had an AI summarizer for their client weekly reports. The team loved it. It saved each PM about an hour a week.

Six months in, a major client churned. Reason given: "the reports stopped reflecting what was actually happening on our account."

What had happened: the AI summaries were good 90% of the time. Nobody read them carefully because they were usually fine. The 10% of weeks where the AI missed nuance, the wrong summary went out and the PM didn't catch it. Over six months, the cumulative drift broke the relationship.

The summarizer wasn't bad. The review step was missing. "PM glances at it" is not a review step — it's a hope.

### Email 3 body — fix steps:

1. **Name the human.** Not "the team" — a specific person, by role, who owns review. If review is everyone's job, it's nobody's job.

2. **Design the review path before the AI ships.** The AI's output needs to land somewhere the reviewer is already looking — their inbox, their Slack, their queue. Adding a new dashboard the reviewer has to remember to check is how reviews stop happening.

3. **Plan the failure path.** What happens when the reviewer flags something wrong? Does it go back into the AI's training? Does it route to a human-only path next time? "Reviewer fixes it manually and we hope it doesn't happen again" is the failure mode of every AI ops project that quietly stops working.

---

# PDF ROADMAP CONTENT (4 templates, one per `{{weakest_key}}`)

These are the content outlines for the 4 PDF roadmaps. Format: editorial single-column, sage/cream brand, italic-serif headers. Generated once, stored in Supabase Storage, linked from Email 1.

Page 1: cover (verdict + score + weakest title + Iván's logo)
Page 2: "what this roadmap is for"
Page 3-5: 30-day plan in 3 weeks
Page 6: how to know it worked
Page 7: when to come back to me

The body of pages 3-5 reuses the Email 3 fix steps (deeper, with worked examples), plus a week-by-week calendar.

---

## PDF — `structured_input`

**Title:** "30 Days to Reliable Input Pipeline"
**Subtitle:** "How to tighten the data your AI is reading from"

**Week 1: Audit**
- Day 1-2: Map every source the AI currently reads from (or would, if you built it). Write each one as: source name → who maintains it → freshness → format
- Day 3-5: Pick ONE canonical source per data point. Document why
- Day 6-7: Sanity check — pull 20 sample records by hand and verify the canonical source actually agrees with itself

**Week 2: Extract**
- Day 8-10: For unstructured sources, write the extraction step. Either tag the source or build a parser. Don't ship "the AI will figure it out"
- Day 11-12: Test extraction on 50 sample records. Aim for 80%+ accuracy on the structured fields
- Day 13-14: Document the data contract — what fields, what types, what's required, what's optional

**Week 3: Stabilize**
- Day 15-19: Run the same query against the pipeline twice a day for a week. Log the answers
- Day 20-21: Review the log. If the same query gave different answers, find why and fix it before any AI work

**Week 4: Verify**
- Day 22-26: Hand the pipeline to someone who didn't build it. Ask them to query 10 records. If they can do it without asking you questions, the pipeline is documented enough
- Day 27-28: Write the runbook for when something breaks
- Day 29-30: You're ready to start the AI work. Begin with one narrow use case, not a sweep

**How to know it worked:** the same input gives the same output 100% of the time. When something breaks, the runbook tells you where to look. New team members can use the pipeline without you in the loop.

**When to come back to me:** when you've completed Weeks 1-2 and want a second pair of eyes before Week 3, or when you're ready to ship the first AI build on top of a tight pipeline.

---

## PDF — `decision_logic`

**Title:** "30 Days to Documentable Decision Logic"
**Subtitle:** "How to encode your best operator's judgment so an agent can use it"

**Week 1: Shadow**
- Day 1-3: Pick the work you want to encode. Pick ONE workflow, not a category
- Day 4-5: Sit with your best operator. Ask them to narrate every decision out loud, including the ones they think are obvious
- Day 6-7: Record everything. Transcribe later

**Week 2: Surface the rules**
- Day 8-10: Read the transcripts. Pull out every "if X then Y" you can find — including the ones that contradict each other
- Day 11-12: Group the rules. Some will be hard rules (always/never), others will be heuristics (usually). Note which is which
- Day 13-14: Show the doc to your operator. Ask: "what's missing?" The unconscious rules show up here

**Week 3: Test on humans first**
- Day 15-19: Hand the doc to someone else on the team. Have them make 10 decisions using ONLY the doc. Score against your operator's choices
- Day 20-21: For every miss, find the rule that was missing. Add it. Re-test

**Week 4: Encode**
- Day 22-26: NOW write the prompt. Use the doc as the source. Don't paraphrase
- Day 27-28: Test on 10 fresh cases. Compare to operator. Adjust prompt for the misses
- Day 29-30: Ship to staging behind a human review step (see human-in-the-loop section)

**How to know it worked:** a non-expert on the team can replicate your operator's decisions 80%+ of the time using only the doc. When they can't, the gap is a known limitation, not an unknown one.

**When to come back to me:** when you've completed Week 1-2 and need help structuring the rules, or when the doc is solid and you're ready to encode.

---

## PDF — `narrow_scope`

**Title:** "30 Days to Narrow Initial Scope"
**Subtitle:** "How to pick the one workflow that'll actually ship"

**Week 1: Inventory**
- Day 1-3: Write down every workflow you've thought "AI could help with." Don't filter
- Day 4-5: For each one, write three things: who does it today, how often, what does failure cost
- Day 6-7: Sort the list by cost-of-failure × frequency. The bottom of the list is your bottleneck

**Week 2: Define one workflow end-to-end**
- Day 8-10: Pick the top one. Define: input, output, user, success metric, failure mode
- Day 11-12: Map the current process step by step. Where does it slow down? Where does it break?
- Day 13-14: Define what "AI doing this" actually looks like in your environment. Where does the input come from? Where does the output go?

**Week 3: Cut scope harder**
- Day 15-17: Try to cut the workflow in half. Which 50% can you defer? You're aiming for "one job, end-to-end" not "the whole function"
- Day 18-19: Validate the cut with the operator who does the work today. Ask: "if I automated only this part, would it help?"
- Day 20-21: Lock the scope. Write it down. Print it. Pin it somewhere

**Week 4: Build prep**
- Day 22-26: For the locked scope, identify the other three preconditions: structured input, decision logic, human review. What's missing?
- Day 27-28: If anything's missing, that's the next 30 days
- Day 29-30: If nothing's missing, you're ready to build

**How to know it worked:** you can describe the workflow in two sentences. Anyone on your team would describe it the same way. The build estimate is in weeks, not months.

**When to come back to me:** when the scope is locked and you want to validate the build estimate before signing a SOW with anyone.

---

## PDF — `human_loop`

**Title:** "30 Days to Human-in-the-Loop by Design"
**Subtitle:** "How to build review into the system, not bolt it on later"

**Week 1: Name the human**
- Day 1-3: For your target workflow, identify the specific role that owns review. Not "the team" — one role
- Day 4-5: Talk to the person in that role. Ask: "if AI did this work and 5% of it was wrong, how would you find the 5%?"
- Day 6-7: If they don't have an answer, the review path doesn't exist yet. That's what Week 2 is for

**Week 2: Design the review path**
- Day 8-10: Map where the AI's output needs to land. Inbox? Slack? CRM queue? It needs to be somewhere the reviewer is already looking
- Day 11-12: Design the review UI. What does the reviewer see? What's their lightest possible action — approve, reject, edit?
- Day 13-14: Write the SLA. How fast does review need to happen? What happens if it doesn't?

**Week 3: Plan the failure path**
- Day 15-17: When the reviewer flags an error, where does that signal go? Back into AI training? Routes to human-only next time? Logged for later?
- Day 18-19: Define escalation. If a reviewer is unsure, who do they escalate to?
- Day 20-21: Pressure-test with the reviewer. Walk them through three hypothetical failure scenarios. Adjust if their answer is "I'd just fix it manually"

**Week 4: Build review before AI**
- Day 22-26: Build the review surface FIRST. Even if the AI side is just a dummy that outputs random data, the review step needs to be real
- Day 27-28: Have the reviewer use it for a week. Iterate based on friction
- Day 29-30: Now connect the AI side. Review step is already proven

**How to know it worked:** the reviewer can spot errors in under 30 seconds per item. The failure path actually closes the loop — errors don't repeat. New team members in the reviewer role can be trained in under a day.

**When to come back to me:** when the review surface is live and you want to validate it before connecting the AI, or when you've discovered the workflow you wanted to automate is actually one where review can't be designed in (sometimes the answer is: don't automate this).

---

# WORKFLOW NOTES (for n8n build)

**Trigger:** Webhook from `scorecard-submit` edge function. Payload: `{ id, ...row }`.

**State machine per row:**
- `subscribed` → Email 1 sent → wait 3 days
- `subscribed` after 3 days → Email 2 sent → wait 4 days
- `subscribed` after 7 days → Email 3 sent → wait 3 days
- `subscribed` after 10 days → Email 4 sent → drip complete

**Stop conditions checked before each send:**
- `engaged = true` (set by Stripe webhook on Blueprint purchase, or Calendly webhook on call booking)
- `unsubscribed = true` (set by unsubscribe link handler)

**Personalization at send time:**
- Pull `weakest[0]` → look up snippet by `weakest_key`
- Inject verdict-specific copy (Email 1 one-liner, Email 4 path)
- Render PDF link based on `weakest_key`

**Footer on every email:**
```
— Iván
*Manfredi · ivanmanfredi.com*
*[Unsubscribe]({{unsubscribe_url}})*
```

**Sender:**
- From: `Iván Manfredi <hello@ivanmanfredi.com>` (matches existing Resend `RESEND_FROM` from `feedback-railway-claude-proxy-fragile.md` pattern)
- Reply-to: same

**Unsubscribe:**
- One-click unsubscribe link
- Generates token at send time, n8n endpoint flips `unsubscribed = true`
- CAN-SPAM compliant

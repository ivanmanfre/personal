# DM1 and sequence change proposal, for Ivan's approval

**Date:** 2026-08-20
**Status:** REVIEW ONLY. Nothing was written to Supabase. No prompt row was changed. No n8n workflow was touched.
**Scope:** the four rows named in the brief, plus the live copy those rows point at.

---

## 1. The measured case and what it implies about sequencing

### 1.1 The numbers, read from the rows

Ivan tenant means `outreach_campaigns.client_id IS NULL`. Read 2026-08-20.

| Stage | Ivan | RISE |
|---|---|---|
| Prospects in the table | 8,388 | 1,997 |
| Invites sent | 1,479 | 659 |
| Accepted | 269 | 169 |
| Ever DM'd | 913 | 731 |
| Ever replied | 136 | 60 |
| Call booked | **1** | 3 |

Acceptance by temperature, both tenants, 2,138 invites total:

| Lane | Invites | Accepted | Rate |
|---|---|---|---|
| Warm (engagers, anchors, orbit, profile view, hiring signal) | 1,140 | 339 | **29.7%** |
| Cold (vertical lists) | 998 | 99 | **9.9%** |

That confirms the brief's 29.8% / 10.0% figures. The small drift is invites that landed since the brief was written.

### 1.2 The step that is actually leaking

Ivan's 136 replied threads, broken down by who spoke last:

| State | Count |
|---|---|
| We spoke last (ball in their court) | 53 |
| **They spoke last and we never answered** | **83** |

Classifying the last inbound message on those 83 unanswered threads:

| Their last message reads as | Count | Verbatim samples |
|---|---|---|
| Positive or a live question | **23** | "Looks promising. Send it over the plan." / "yes" / "Tell me more about what you do" / "Feel free to send the sample over - happy to take a look." / "Booked a call! See you tomorrow." |
| Neutral | 52 | "Best of luck with it Ivan" / "Rodrigo reacted 👊" / "Curious how you are using LinkedIn combined with his method?" |
| Hard no | 7 | "No thanks" / "I'm not interested" |
| Empty | 1 | |

And what those 136 repliers ever actually received:

| Asset | Reached |
|---|---|
| Ever sent a `/scan/` link | 70 of 136 (51%) |
| Ever sent the Calendly link | 56 of 136 (41%) |
| Had a real 2+ turn conversation (`reply_count >= 2`) | 29 of 136 (21%) |

### 1.3 What that implies

DM1 converts 136 replies out of 913 DMs, 14.9%. On a cold-to-warm LinkedIn lane that is a working first touch. The connect note carries 29.7% acceptance on warm. **The first touch is not the problem.**

Half of the people who replied never received the one asset the whole pitch is built around. Twenty-three warm, hand-raising threads are sitting unanswered right now, against one booked call all-time. A wording change to DM1 would move a number that is already the healthiest in the funnel, while the step that turns interest into a call goes untouched.

**Recommendation: change the reply stage first, and treat every DM1 edit in this document as secondary.**

### 1.4 The honest complication with the four rows I was asked to propose against

I checked which live n8n workflow reads each of the four rows, and whether that workflow is active.

| Row | Read by | Workflow active? | Verdict |
|---|---|---|---|
| `trigger-research-synthesis-prompt` v2 | `Outreach - Trigger Research Engine` `wBBL75oqWcTf78yp` | **NO** | **Dormant.** 452 prospects carry `researched_at`; **zero** were researched after 2026-07-05. This row has produced nothing in six weeks. |
| `outreach-wins-generator` v10 | `Outreach - Wins Builder` `SqyPbHT4h6wEr2cX`, `Outreach - DM Sequence` `joU7VaM5OiRAwLwP`, `Outreach - Warm Reply Drafter` `X8woPv26UrC4Mnhz`, `Outreach - InMail Audit Sender` `73SU0w4HbG9AVPdG`, `Outreach - IVAN Open-Profile Message Sender` `htPRRZy1x7xPJV9s` | **YES, all five** | **Live and load-bearing.** The only one of the four that is both live and reaches the reply stage. |
| `connection-note-templates` v1 | `Outreach - Connection Request Sender` `5ZXtArhobWrDDpfJ` names the slug, but only inside a dormancy notice | Workflow YES, row NO | **The row is a tombstone.** Its own body says so. Live note copy is hardcoded in the `Query + Build Notes` jsCode. Editing the row ships nothing. |
| `followup-drafter` v3 | `Not-Closed Follow-Up Drafter (auto)` `kuvRZToKfH2nh7NA` | **NO** | Dormant, and post-call anyway, so it sits after the step that is leaking. |

So one of the four rows is live in the reply path. Two are dead. One is post-call.

**The reply stage is governed by rows that are not in this brief:** `ivan-reply-exemplars` v18 and `ivan-reply-voice-core` v1, both read by `Outreach - Warm Reply Drafter` `X8woPv26UrC4Mnhz` (active, every 15 minutes). If you want the reply-to-call step to change, that is where the lever is, plus the 23 unanswered threads which need a person, not a prompt.

I am not proposing edits to those rows here because the brief scoped me to four, and because `ivan-reply-exemplars` regenerates daily from Ivan's own sent messages, so hand-editing it would be overwritten. I flag it in section 5.

---

## 2. Row by row

### 2.1 `trigger-research-synthesis-prompt` v2

**Recommendation: no change today. One change if and only if you re-arm the workflow.**

This row has produced nothing since 2026-07-05. Editing it changes no message that goes out this week. The proposal below is conditional.

It also carries no direct booking ask. Its `ask` field is specified as "one genuine question", and the three worked examples are all genuine questions ("What's driving the hires, volume growth or process gaps?"). That is already the right shape for a first touch. I am not touching it.

#### Change 2.1a, conditional

**CURRENT** (line 41, verbatim):

> You are a research analyst for Ivan Manfredi, a B2B automation consultant. You receive raw data about a prospect and their company from multiple sources (LinkedIn activity, website scrape, job postings, news). Your job is to find ONE specific, timely reason to reach out.

**PROPOSED:**

> You are a research analyst for Ivan Manfredi. He turns a founder's LinkedIn into a revenue line: the posts, the comments under them, and the DMs, through to a booked call. You receive raw data about a prospect and their company from multiple sources (LinkedIn activity, website scrape, job postings, news). Your job is to find ONE specific, timely reason to reach out.

**Why:** "B2B automation consultant" is not a thing Ivan sells, and it is the only sentence in the row that states who he is, so every hook this row would generate is anchored to the wrong business.

#### Passages in this row I am deliberately leaving alone

The `FORBIDDEN in hook and ask` block bans exclamation marks and emoji. That reads like it contradicts Ivan's real DM register, and it would if it governed a DM. It does not. It governs a one-line research artefact that gets assembled into copy downstream. Leaving it.

---

### 2.2 `outreach-wins-generator` v10

**Recommendation: one change. This is the row I would ship first of the four.**

It feeds five active workflows, including the Warm Reply Drafter, which is the reply stage.

#### Change 2.2a

**CURRENT** (line 2, verbatim, including the garbled clause):

> You generate "first wins" for Ivan Manfredi's outreach. Ivan runs an inbound service run for you: it runs a founder's LinkedIn end to end (content in their voice, a lead magnet that captures readers not ready to book, follow-up on engagers), leads land named in their inbox, they only approve.

**PROPOSED:**

> You generate "first wins" for Ivan Manfredi's outreach. Ivan turns a founder's LinkedIn into a revenue line: the posts, the comments under them, and the DMs, through to a booked call. It runs end to end (content in their voice, a lead magnet that captures readers not ready to book, follow-up on engagers), leads land named in their inbox, they only approve.

**Why:** this is the only sentence in the row that states the positioning, it is read by every live sender, and the current version also has a broken clause ("an inbound service run for you") that the model has been reading for weeks.

#### Passages in this row I am deliberately leaving alone

The `PILLAR TAG RULE` requires each win to be tagged `"content" | "inbound" | "outbound"`. Those are machine keys, never rendered to a prospect, and downstream consumers match on the literal string. Renaming `"inbound"` there would break the tag contract and buy nothing.

The `REGISTER (2026-08-19, Ivan)` block already bans "we", "our", "the engine", and "we build" inside a win, and requires bare imperatives. That is exactly the wins-are-suggestions rule and the never-say-engine rule, already enforced at the source. It handles this well. No change.

The `POSITIONING RULE` already forces every build to land on LinkedIn rather than on their website. That is the revenue-line framing in practice, already correct. No change.

---

### 2.3 `connection-note-templates` v1

**Recommendation: no change to the row. Two changes proposed against the live n8n copy, and I recommend you reject the first of them unless you want it.**

The row body is a dormancy notice dated 2026-05-24. It says, verbatim:

> **This prompt is NOT executed by any live workflow.** ... Connection notes are built in n8n workflow `5ZXtArhobWrDDpfJ` ("Query + Build Notes" code node).

I confirmed that: the workflow is active, and the note strings are hardcoded in the jsCode. Editing the row ships nothing to any prospect.

So the proposals below are **n8n code-node changes**, not prompt-row changes. They are a different class of action and should be judged as such.

#### Change 2.3a, the anchor note. I flag this one hard.

This is the note behind the 26% to 49% acceptance lanes. It also carries two comments in the code recording that you personally reverted agent edits to this exact string, once for the `him` to `them` swap and once for the anchor allow-list gate. I am proposing it only because it says "engine" to a prospect, which the hard rules forbid.

**CURRENT** (jsCode, `lm_anchor` / `eh_anchor` branch, assembled):

> Hey {first}, saw you around {anchorFull}'s content so figured we run in the same world. I run the inbound engine {anchorFirst} uses to book calls - all done for him. Thought you'd be worth a hello.

**PROPOSED:**

> Hey {first}, saw you around {anchorFull}'s content so figured we run in the same world. I run {anchorFirst}'s LinkedIn for him, posts through to booked calls. Thought you'd be worth a hello.

**Why:** it removes the only instance of "engine" in a prospect-facing string, and it keeps "for him", which is the clause you added on 2026-08-10 after Peter Ruchti read the claim backwards.

**Length check, because the 200-character cap is real.** Measured across the worst-case name and anchor pairs in the roster:

| Pair | Current | Proposed |
|---|---|---|
| Kyle / Kyle Hunt | 182 | 175 |
| Jo / Michael Zipursky | 190 | 183 |
| Carlos / Carlos Delgado Gonzalez | 200 | 193 |
| Konstantinos / Niharikaa Lekharu | 203 (drops a clause) | 196 |

The proposed line is shorter in every case and fits under 200 everywhere, so the length guard that currently strips " - all done for him" on the longest pairs stops firing. That is a side benefit, not the reason.

**My honest read: this is a copy change on your best-performing arm, on a string you have defended twice.** If you would rather keep the measured arm intact and accept one instance of "engine" in a 200-character note, reject this and I will not raise it again.

#### Change 2.3b, the no-anchor fallback

**CURRENT** (jsCode, `lm_anchor` / `eh_anchor` branch, `anchorFull` empty):

> Hey {first}, we seem to run in the same agency world. I run inbound engines that turn LinkedIn into booked calls. Reaching out to a few folks worth a hello.

**PROPOSED:**

> Hey {first}, we seem to run in the same agency world. I turn a founder's LinkedIn into a revenue line: the posts, comments and DMs. Reaching out to a few folks worth a hello.

**Why:** this is the fallback nobody has ever defended in a revert, it carries both "engine" and the old inbound framing, and it is the branch where the positioning statement can land whole.

Length: 165 to 175 characters across the name range, comfortably inside the cap. A fuller variant using your exact approved wording, "the posts, the comments under them, and the DMs", measures 189 to 199, which fits but leaves almost no headroom for a long first name. I recommend the shorter one and note the fuller one exists if you prefer it verbatim.

#### The cold note. I recommend NOT changing it.

**CURRENT** (jsCode, `SET_A` / `gift_v2_lm`):

> Hi {first}, working with a few {bizCat} right now on inbound and lead magnet systems. Good to connect with folks in that space.

It carries the old framing. I still recommend leaving it, for three reasons. It does not say "engine". It was selected on measured data (14.5% on 83 sends, against 6.1% and 7.6% for the arms it beat). And the code comment records your own rule that a copy change means a new variant key, so touching it resets the measurement on the one cold arm that works, while cold is currently the residual lane taking whatever warm does not fill. The cost is high and the benefit is one adjective.

---

### 2.4 `followup-drafter` v3

**Recommendation: no change. Zero passages proposed.**

I read the row in full and found nothing carrying the inbound framing. It never states what Ivan sells. Its identity content is limited to move 6, "Ivan supervises every send, the buyer owns the audience, list and content", which is already the ownership frame and is already correct.

Its move 2 is a direct booking ask:

> Primary ask is a dated 15-minute follow-up call. Offer two concrete time windows (e.g. "Tuesday morning or Thursday after 2"). The call is the ask, not "let me know your thoughts".

That is a booking ask, and at this stage it belongs there. This row fires after a call has already happened. Removing the booking ask from a post-call follow-up would break the thing it exists to do. I am leaving it.

One observation that is not a copy change and needs your call: **the workflow that reads this row, `kuvRZToKfH2nh7NA`, is inactive.** So warm-but-not-closed calls currently get no drafted follow-up at all. Given that the measured leak is at the reply-to-call step, an inactive post-call drafter is worth knowing about even though it sits downstream of the leak.

---

## 3. Approval table

Tick one box per line. Nothing ships until you do.

| # | Row / file | What changes | Class | Approve | Reject |
|---|---|---|---|---|---|
| 2.1a | `trigger-research-synthesis-prompt` v2 | Identity sentence, "B2B automation consultant" replaced with the revenue-line wording. **Only if you re-arm `wBBL75oqWcTf78yp`.** | Supabase row | ☐ | ☐ |
| 2.2a | `outreach-wins-generator` v10 | Opening positioning sentence replaced with the revenue-line wording, garbled clause fixed | Supabase row | ☐ | ☐ |
| 2.3a | n8n `5ZXtArhobWrDDpfJ` `Query + Build Notes` | Anchor note, "the inbound engine {a} uses to book calls - all done for him" becomes "{a}'s LinkedIn for him, posts through to booked calls" | n8n code node, on a measured arm | ☐ | ☐ |
| 2.3b | n8n `5ZXtArhobWrDDpfJ` `Query + Build Notes` | No-anchor fallback note rewritten to the revenue-line wording | n8n code node | ☐ | ☐ |
| 2.3c | n8n `5ZXtArhobWrDDpfJ` cold `gift_v2_lm` | **Leave as is.** Tick approve to confirm you agree it stays | no change | ☐ | ☐ |
| 2.4a | `followup-drafter` v3 | **No copy change.** Separate question: re-arm `kuvRZToKfH2nh7NA`? | workflow arming | ☐ | ☐ |
| 3.1 | Sequencing | Work the 23 unanswered warm threads before shipping any copy change above | operator action | ☐ | ☐ |

**Count per row:** `trigger-research-synthesis-prompt` 1 conditional. `outreach-wins-generator` 1. `connection-note-templates` 0 to the row, 2 to the live n8n copy it points at. `followup-drafter` 0.

---

## 4. What I did NOT change, and why

**The reply-stage rows.** `ivan-reply-exemplars` v18 and `ivan-reply-voice-core` v1 are what the Warm Reply Drafter actually reads. They are outside the four I was given. `ivan-reply-exemplars` regenerates daily from your own sent messages, so a hand edit gets overwritten within a day. `ivan-reply-voice-core` holds two standing rules, bubble splitting and never repeat your own last message, and neither carries positioning. There is nothing there for me to rewrite. The reply stage needs threads answered, not copy tuned.

**`ivan-company-facts` v2, and this is the biggest one.** It is not in the four rows, and the Warm Reply Drafter treats it as the single source of truth for who Ivan is and what he charges. Its identity line currently reads:

> IDENTITY (paste-adjacent, never contradict): I build and run LinkedIn inbound services for agency owners: content, lead magnets, warm outreach, and nurture that turn a founder's feed into pipeline they own.

That is the old framing, sitting in the row every reply-stage draft is anchored to. If you approve only one positioning change this week, it should probably be this row rather than any of the four. I did not touch it and I am not proposing wording for it here, because it is outside the scope you set and because it also carries the live price, which I will not go near without you looking at it.

**Your own scan-delivery line.** The Warm Reply Drafter instructs the model to close with:

> I ran an audit of your inbound potential off your LinkedIn, what's there today and what we'd run for you: {scanUrl}

It carries "inbound". It is also your line. It appears close to thirty times in your hand-sent corpus, unchanged, sent by you. Changing it would be rewriting copy you ratified by repetition, so I left it and I am naming it here instead.

**DM1's cold opener.** The live DM1 for cold reads "May I send you one of our audits on your LinkedIn positioning and potential? Yours to keep." The code records that you ratified that wording verbatim on 2026-08-11 after cutting the Kyle stat from it yourself. Not touching it.

**The wins pillar tags** (`"content" | "inbound" | "outbound"`), because they are machine keys with downstream consumers.

**The cold `gift_v2_lm` connect note**, for the measurement reason in 2.3.

**The hook and ask ban on exclamation marks and emoji** in `trigger-research-synthesis-prompt`, because it governs a research artefact rather than a DM, so it does not collide with your real DM register.

**Two live DM1 strings that carry "engine" and that I did not propose against.** I am naming them rather than quietly leaving them, since the never-say-engine rule covers them too:

- Wins DM1: "That's what my done-for-you inbound engine handles end to end, so leads come in without you writing a thing."
- Kyle-lane DM1: "I run Kyle's inbound for him, and the audience and list it built are his. Took him from $30k to $80k a month."

Both live in `joU7VaM5OiRAwLwP` `Send DM`, not in any of the four rows. Both would need the same treatment as 2.3a. I left them out of the approval table so this document does not turn into a nine-item copy sweep on a week when the actual leak is unanswered threads. Say the word and they become a second document.

---

## 5. Open questions for you

1. **Sequencing.** Do you want the 23 unanswered warm threads worked before any copy above ships? That is my recommendation. Twenty-three live conversations against one all-time booked call is a bigger number than any wording.

2. **"booked calls".** The Warm Reply Drafter prompt currently says `Do not use the exact phrase 'booked calls'`. Your approved identity wording ends on "through to a booked call", and my proposed note 2.3a uses "booked calls". One of those has to give. Which?

3. **The anchor note.** You have reverted agent edits to that exact string twice. Do you want it touched at all for the sake of one word, or does the measured arm stay frozen?

4. **`trigger-research-synthesis-prompt`.** Dead six weeks. Re-arm it, or retire the row? Change 2.1a is worth nothing until you answer.

5. **`ivan-company-facts` v2.** Outside this brief, and probably the highest-leverage positioning string in the stack. Do you want it as the next document?

6. **`kuvRZToKfH2nh7NA`.** The post-call follow-up drafter is inactive. Deliberate, or drift?

---

## 6. Added 2026-08-20, after the niche work: one more row, not touched

While making the scan's ICP section niche-aware I found the same hardcoded
buyer rubric in a third place, and it writes copy prospects read. It sits
inside your review gate, so I changed nothing.

**`qZoIELMKc9IT8Gzp` — Outreach - DM1 Wins Enricher, node `Generate Win Ideas`.**

It carries a byte-identical copy of the audience-audit classifier prompt:
"the ICP of interest = decision-makers AT direct-to-consumer / ecommerce
CONSUMER BRANDS". It uses it to count how many buyers sit in a prospect's
audience, and that count becomes the number in their DM1 win line.

The defect is the same one the scan had. For a prospect who does not sell to
consumer brands, a mobile UA studio or a recruiting firm, the rubric matches
almost nobody, so the count is near zero. The DM1 win either goes out with a
weak number or the row skips.

Two live systems were fixed today and this one was left alone:

| System | Rubric | Status |
|---|---|---|
| `EcPnaYR6buyhOlSi` Audience Audit | per prospect, falls back to DTC | shipped |
| `lnYNdQR5m3Q50zlH` scan `icp_targeting` | per prospect, null when unsure | shipped |
| `qZoIELMKc9IT8Gzp` DM1 Wins Enricher | still hardcoded DTC | **untouched, awaiting you** |

The fix is a straight port of what already runs in the audit: derive the
buyer from the prospect's headline first, classify against that, and fall
back to the DTC rubric verbatim when the headline is too thin to name one.
Roughly thirty lines, same shape, already proven on live data.

**Question 7 for you:** port it, or leave DM1 counting consumer-brand buyers
only?

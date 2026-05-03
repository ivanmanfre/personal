# UTM Manual TODOs (Wave 0 / P30-2)

> One-time manual updates Ivan needs to make. Everything Claude could update
> programmatically already shipped in Wave 0. The items below require either
> human judgement, a manual UI action, or LinkedIn auth that Claude can't
> obtain.

## 1. LinkedIn bio link

**Where:** linkedin.com/in/ivanmanfredi → "About" → contact → website.

**Update from:** `https://ivanmanfredi.com`
**To:** `https://ivanmanfredi.com/?utm_source=linkedin&utm_medium=profile&utm_campaign=bio-2026`

LinkedIn truncates display text but the underlying URL keeps query params, so
attribution still works on click.

## 2. LinkedIn featured-section CTAs

For each featured item that links to ivanmanfredi.com (Blueprint, Newsletter,
Lead Magnet System, etc.), edit the link with:

- Newsletter feature: `https://ivanmanfredi.com/agent-ready-letter?utm_source=linkedin&utm_medium=profile&utm_campaign=featured-newsletter`
- Blueprint feature: `https://ivanmanfredi.com/assessment?utm_source=linkedin&utm_medium=profile&utm_campaign=featured-blueprint`
- LMS feature: `https://ivanmanfredi.com/lead-magnet-system?utm_source=linkedin&utm_medium=profile&utm_campaign=featured-lms`

## 3. Calendly profile + event-type pages

**Where:** Calendly → Account → Profile bio + each event type description.

Replace any naked `https://ivanmanfredi.com` link with:
`https://ivanmanfredi.com/?utm_source=podcast&utm_medium=bio&utm_campaign=calendly-profile-2026`

(Adjust `utm_source` per surface — calendly-profile-bio = `podcast`-ish
borrowed-audience, change to `direct` if it's just for already-converted
prospects.)

## 4. Manual LinkedIn DMs

When you DM someone manually with a link to ivanmanfredi.com, prefer the
Calendly link when offering a call (auto-tagged via the site flow) OR
manually append:

`?utm_source=linkedin&utm_medium=dm&utm_campaign=manual-dm-2026-05`

Update `2026-05` to current year-month each month.

## 5. Podcast guest descriptions

Each accepted podcast guest spot — host bio / show notes / episode
description should link to the assessment with:

`https://ivanmanfredi.com/assessment?utm_source=podcast&utm_medium=bio&utm_campaign=<podcast-slug>-<yyyy-mm>`

Examples:
- `https://ivanmanfredi.com/assessment?utm_source=podcast&utm_medium=bio&utm_campaign=build-a-better-agency-2026-06`
- `https://ivanmanfredi.com/assessment?utm_source=podcast&utm_medium=bio&utm_campaign=future-firm-2026-07`

## 6. Email signature

Plain-text + HTML email signature. Replace ivanmanfredi.com with:
`https://ivanmanfredi.com/?utm_source=email&utm_medium=signature&utm_campaign=signature-2026`

## 7. Stripe Payment Link metadata

**Where:** Stripe Dashboard → Payment Links → the Blueprint link → "Custom
fields" / "Metadata".

Add a static metadata field if/when you want to override what
`client_reference_id` carries. Otherwise the wave-0 frontend
(`buildStripeCheckoutUrl`) will inject `client_reference_id` automatically.

Set Stripe success URL to:
`https://ivanmanfredi.com/assessment/welcome?session_id={CHECKOUT_SESSION_ID}`

(So the post-purchase tracking beacon can fire — the welcome page reads
`session_id` from URL, joins to original sessionStorage UTMs, and posts
to /api/track-conversion if/when that endpoint is added.)

## 8. Newsletter issues already drafted in n8n

Wave 0 ships UTM auto-injection in the newsletter-send workflow (P30-2). For
already-drafted issues sitting in queue, manually re-render or re-send so
they pick up the new templates.

---

**Verification:** After making each change, hit the URL in an incognito
window. Then check `pageviews` table: that row should have non-null
`utm_source` matching what you set.

```sql
select utm_source, utm_medium, utm_campaign, ts
  from pageviews
 where ts > now() - interval '5 minutes'
 order by ts desc;
```

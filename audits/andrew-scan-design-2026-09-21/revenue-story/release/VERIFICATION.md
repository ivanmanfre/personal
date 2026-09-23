# Story production lane: review release

23 September 2026. Local worktree only; no deployment, remote record mutation or pipeline activation.

- Three finished review candidates use the production renderer: Luiza, Andrew and Nerijus.
- 31 unit/regression tests pass: assessment states, stored source rows, malformed payloads, lead binding, approval gate, stale and late requests.
- Real saved-row review pages pass at 375 and 1440px. Eight labelled synthetic scenarios, unknown lead and missing editorial draft also pass without substituting another lead.
- All three candidates pass carousel, connector, keyboard and overflow checks at 320, 375, 390, 768, 1024, 1180, 1280, 1440 and 1680px.
- Existing seven-width interaction suite passes for Luiza and Andrew: copy/download, team choice, lead-magnet tabs, chat, motion, pause/resume, reduced motion, image loading and CTA.
- Actual public route verified locally with intercepted approved payloads: all three identities, mobile layout, canonical link, share title, per-scan share image and noindex pass. The prerender wait recognizes the new title format. Test approval was not stored remotely.
- Desktop/mobile screenshots inspected. Build passes. Whole-repo type checking still reports existing errors outside the edited production-lane files; this is not a clean global typecheck claim.
- Independent review found malformed team/color/date crashes and a stray research label on Simmer’s artwork. Fixed, with regression tests for malformed data.

Key data issue: 17/18 sampled recent records omit buyer_definition. The new renderer does not promote their legacy match counts to verified buyer claims. Missing/blocked data never becomes zero, and network counts stay within the observed sample.

Release JSON files are draft handoff records. They require user review and subsequent generator/deployment work described in docs/scan-production-lane.md before broad rollout.

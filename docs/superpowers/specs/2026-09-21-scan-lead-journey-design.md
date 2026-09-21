# Scan lead journey: decided design

Status: direction selected at Ivan's request on 2026-09-21. Ready for implementation planning. This is a local preview redesign; deployment remains outside scope.

This document supersedes the open choices in `2026-09-21-scan-lead-journey-concept.md`. The concept file remains a record of the discussion.

## Direction

An illustrated buyer travels down one continuous, vertical story made from the client's actual sample materials. The artwork is a small ink-drawn person with four walking poses and one resting pose. LinkedIn posts, the profile, the carousel, the lead magnet and email remain recognisable, readable surfaces.

Normal scrolling drives progress. The person walks only through the spaces between reading areas and rests while a sample is on screen. They never obscure copy or controls. The main reading experience works with all motion disabled.

Desktop has more room around each exhibit and a narrow route alongside it. Mobile gives the sample the full available width and places the person in the chapter transition above it. No permanent character column reduces mobile reading width.

## Scope and source material

Improve the presentation of the samples already produced by the scan. Preserve their wording, slide order, client identity and source metadata. Changes to misleading or unusable sample content must be identified separately, not silently introduced as presentation work.

The existing production report reads `content_system.sample_output.posts`, `.lm`, `.newsletter`, `.follow_ups`, `.engager_outreach` and `.cold_outbound`. Relevant renderers exist in `components/ui/LinkedInPostPreview.tsx`, `NewsletterMockup.tsx`, `FollowUpSequence.tsx`, `EngagerOutreachMockup.tsx` and `LiveAssessmentEmbed.tsx`. The feed adapter is `lib/contentSystemFeed.ts`.

The current development preview uses handwritten CueVu drafts in `components/dev/scan-walkthrough/data.ts`. They must be distinguished from the original scan's generated assets. The implementation starts with an inventory of the actual sample data. Any missing sample is labelled explicitly; another client's work cannot fill that slot under CueVu's name.

## Story order

An opening introduces the buyer and the project they might have. Then five chapters carry the same buyer and topic.

| Chapter | Heading direction | What the reader sees | Why it belongs |
|---|---|---|---|
| Content and profile | “Help the right people find you.” | A complete formatted post, followed by a focused profile view showing the offer and featured resource. | The topic gets the buyer's attention. The profile helps them understand who can help. |
| Carousel and lead magnet | “Give them something useful.” | One shared exhibit: the existing carousel, then the related lead magnet. The example request and resulting contact record complete this chapter. | The carousel explains an idea. The resource helps the buyer apply it and gives the client context for follow-up. |
| Newsletter | “Keep helping after they leave.” | A complete newsletter sample with subject, useful content and one next action. | It gives an interested reader another reason to return or reply. Subscription is a separate explicit choice in the example. |
| Conversations | “Talk about what they need.” | A complete follow-up tied to the resource. A researched outreach example shows another way to start a conversation. | Follow-up carries the earlier context; outreach reaches relevant people who may never see the post. |
| Whole service and proof | “Here’s what we’d run.” | A compact route recap using the same materials and buyer; real RISE examples; one call invitation. | The prospect sees how the work connects and what we would operate for them. |

The profile is a beat within the content chapter. The carousel and lead magnet share one chapter. The contact record is the visible consequence of the request, not another large dashboard section.

This is an illustrative path. A buyer can reply directly to outreach. A request does not guarantee a qualified project or a booked call. Preserve the distinction in labels and the overview.

## Reading and copy contract

- Each chapter has one heading and one short explanation before the sample.
- Aim for 4–8 words in headings and 12–20 words in explanations. Use everyday words.
- Never repeat the heading's claim in the explanation; explain why the buyer continues.
- Complete posts and newsletters remain complete. The short-copy target applies to the surrounding narration.
- Use one main sample at a time. All critical examples are available in the page. No detail dialogs, collapsed post bodies or nested report views.
- Samples use the client's language and branding. Proposed content and illustrative contacts remain clearly labelled.
- Mobile body and sample text: at least 16px, line-height at least 1.5. Essential labels: at least 12px. Headings: clamp between 36px and 56px below 768px.
- Desktop body: 18px. Text columns: maximum 58ch. Sample exhibit width: maximum 680px, with additional space reserved for artwork only.
- At 360px wide, page padding is 18px per side. At 390–767px, 20px per side. No horizontal page overflow at 320px or above.
- No fixed overlay may cover a sample or a control. Audio stays in the header on mobile.

## Presentation and interaction decisions

### Content and profile

Default to a strong complete post from the scan. If several posts exist, use a labelled select on mobile and compact buttons on desktop. Selecting another post preserves focus and keeps the reading start in view. The page does not auto-cycle posts.

The profile beat carries the same founder identity from the post into headline, offer and featured resource. Avoid shrinking a full profile screenshot. Proposed changes are labelled. Only observed profile information can be presented as existing.

### Shared carousel and resource showcase

Use the actual carousel asset. The active slide is front-facing and fills the exhibit width. A restrained edge of the next slide suggests progression on desktop. Mobile shows the active slide at full width with 44px previous/next buttons and a readable slide count. Swipe is optional; vertical scrolling must continue normally. No autoplay.

For image-only slides whose original text becomes too small on mobile, display the corresponding source text below the slide. Preserve the asset; don't force the user to zoom to understand it. Every slide remains reachable by buttons and keyboard.

The lead magnet appears immediately below the carousel in the same chapter. A short connecting line explains the relationship only if both samples address the same topic. Unrelated materials remain a shared sample collection with honest individual descriptions.

A supported interactive resource runs inline. Its visible result is present with labelled sample inputs before any click. Changing an input updates the result and the illustrative request context. Download works without navigating away. A static guide is shown as a readable excerpt with a direct full-file link; it is not dressed up as a working tool.

The demo hand-off uses clearly labelled example contact details and performs no external submission. Keep source, chosen category and research purpose together. Changing inputs updates dependent examples and resets the simulated request state.

### Newsletter and conversations

The newsletter is a complete issue with subject and sections. It is distinct from the delivery email. It scrolls with the page and has no nested scrollbar.

Show one short full follow-up referring to the same resource choice. Place the researched outreach message beneath a short explanation of its separate entry route. Both remain visible in normal flow, without requiring the reader to switch a hidden branch to understand outreach.

### Character, path and motion

Use native HTML for all text and controls, an SVG path for the route and one consistent SVG character. No game-engine dependency. Existing React and Framer Motion drive motion.

The character is 48px tall on desktop and 36px on mobile. Mark it and the path decorative for assistive technology. On desktop it stays in a dedicated 72px visual lane outside the reading column. Below 1024px, it appears only in chapter transition areas, never beside body text.

Character movement follows scroll distance through those transitions. Walking poses change only while its position changes. Reverse scrolling reverses travel. Clamp the character to its route. Resizing recalculates geometry without resetting selected samples.

Reading sections have natural height. No full-screen scroll lock, wheel interception or artificial multi-screen pinning. Keep transitions to transforms and opacity. Use the existing ease [0.22, 0.84, 0.36, 1], 250–450ms for discrete controls. Respect reduced motion with immediate state changes and static route markers.

Final overview: on desktop, briefly pull back the decorative route to connect the visible chapter markers. HTML text remains readable and unscaled. On mobile, reveal a vertical recap with the same labels and sample thumbnails. No miniature page screenshot.

### Sound, backgrounds and third-party proof

Retain optional audio, off by default. It closes on disable, hidden tab and unmount. Audio is not part of navigation or required understanding.

The first build uses the real artifacts and a restrained illustrated path. No generated full-screen background is planned. A single character asset supplies the illustrated identity. Any later background experiment must preserve reading contrast and performance.

Keep the published RISE resource gallery after the main story. Desktop can retain its opt-in live calculator. Mobile opens the real calculator in a separate tab, with the screenshot and explanation still available inline, avoiding a second scrolling surface inside the story.

## Visual identity

Story frame: white #FFFFFF, ink #131210, red #C8361B used sparingly, Schibsted Grotesk. Maintain the product identity. Platform artifacts keep their platform fonts and chrome; client samples keep their own visual identity.

Each exhibit has a composition appropriate to its format. The post is a feed artifact; carousel is a deck; resource is a real tool or document; newsletter is an email. The route and recurring buyer provide continuity. Repeated generic card grids are excluded.

21st.dev references in the concept file inform transition staging and active-slide prominence. Their wheel interception, automatic cycling and decorative overlays are excluded. No new package is required.

## Responsive and accessibility acceptance

Test 320×740, 360×640, 375×667, 390×844, 768×1024, 1024×768 and 1440×900. Test 200% zoom from a desktop window and reduced-motion mode. Test keyboard access and touch/pointer input.

Required checks:

- No horizontal page overflow, clipped words, overlays covering controls or nested page-like scroll regions.
- Primary buttons at least 44×44px. Focus indication is visible. Changes do not lose keyboard focus.
- Post body and newsletter remain full and legible without opening another view.
- Every slide is reachable; first/last controls have correct disabled states.
- Resource changes propagate to the contact record and follow-up. Download reflects the selected values.
- No personal details or form values are submitted from the preview.
- Images have descriptive text alternatives; decorative character and route are hidden from accessibility output.
- Failed image or embed loads preserve readable source text and an explicit working link.
- Reduced motion retains every piece of content and interaction.
- Mobile still explains the sequence without the character moving.

## Build sequence and scope boundary

Build a complete static version first, starting at 390px wide. Integrate the original sample outputs. Review the reading order and seams. Add the character and movement after the static version explains the strategy clearly. Then test the full path on all required sizes.

Complete all five chapters in the local preview. The first three beats are an internal motion checkpoint, not the final deliverable. No production renderer, scan generator or live workflow is changed by this plan. Deployment is a separate action.

The current inline-story work is uncommitted and build-passing but visually unreviewed. Preserve it before implementation; do not reset the working tree. Use the same isolated preview worktree and development route.

# Content-System Kinetic Demo Reel — Plan

**Goal:** Replace the hero video placeholder on `/content-system` with an autoplaying,
Apple/Linear-style product demo reel: real product screenshots animating step by step with a
moving cursor and kinetic-text captions, on a loop, in the cream/sage editorial palette.

**Decisions (locked with Ivan 2026-06-15):**
- Build approach: **coded in-page** (React + framer-motion), not a rendered mp4. Screen-record to
  mp4 later only if a shareable asset is wanted.
- Playback: **autoplay loop**, hands-off, mobile-friendly.

**Tech:** React 19 + framer-motion 12. New component `components/DemoReel.tsx`. Replaces
`<VideoSlot>` in the hero of `ContentSystemPage.tsx`. Uses existing `/content-system/ui/*.webp`
screenshots. Honours `prefers-reduced-motion` (shows the end card statically, no motion). No new
deps, no video files.

## The reel (6 beats + end card, ~2.8s each, loops)

Each beat = a real screenshot (browser-framed) crossfading in with a subtle scale/parallax, a
**kinetic caption** (words animate in), and on action beats a **fake cursor** that glides to a
target and pulses a click.

1. **It finds the idea** — sources→brain micro-visual or board, caption "It finds the idea."
2. **Writes it in your voice** — `editor.webp`, caption animates, faux typing feel.
3. **Refuses to ship slop** — `editor.webp` + a QA "passed" badge stamp, caption "No AI slop."
4. **You approve in one tap** — `board.webp`, cursor glides to an Approve control + click pulse.
5. **Ships your whole funnel** — `calendar.webp` → `leadmagnets.webp`, caption "Posts + lead magnets."
6. **Learns what works** — `performance.webp`, caption "It learns what lands."
- **End card** — "Five posts a week. Without writing a word." + the Book-a-call CTA, holds briefly,
  then loops to beat 1.

## Mechanics
- A step index advances on an interval (cleared/paused when tab hidden via `visibilitychange`).
- `AnimatePresence` crossfades the framed screenshot between beats.
- Caption: per-beat key so words re-animate (stagger fade/`y`).
- Fake cursor: framer `animate` to target coords per beat; click = quick scale-down + ring pulse.
- Progress: 6 dots / thin bar showing position; subtle, bottom.
- A small "demo" / "auto-playing" affordance; respects reduced-motion (static end card).

## Build order
1. Scaffold `DemoReel.tsx` with the beat data + interval state machine + AnimatePresence stage.
2. Kinetic caption sub-component (staggered words).
3. Fake cursor + click pulse on action beats.
4. Progress indicator + end card + loop.
5. Wire into hero (replace VideoSlot), reduced-motion fallback, mobile sizing.
6. Verify with screenshots at 1440 + 390, iterate on timing/feel, deploy.

## Out of scope (for now)
- Rendering to mp4 (later, by screen-recording the coded reel).
- Audio / voiceover.
- Real interactivity (it is a reel, not a clickable product tour — the diagram already covers that).

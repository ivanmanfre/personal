# Ascension audit: new scan journey vs old scan, 2026-09-23

Surfaces: new = /dev/scan-walkthrough (luiza-vass-8c, andrew-hayes-94); old = inboundonsteroids.com/scan/<slug>/. Brand lane: Black Box (product surface). Evidence: harness JSONs (new-*, old-*, after-*, after2-*), probe.json / probe-after.json, impeccable detector, new-00..14.jpg.

## Measured, new vs old (Luiza, 1440 unless noted)
| | old | new before fixes | new after fixes |
|---|---|---|---|
| Words on page | 2632 | 1962 | ~2000 |
| Labels under 11px | 12 | 0 | 0 |
| Lines over 68ch | 20 | 2 | 2 |
| Red elements (law: once) | 2 | 18 | 3 (ON, the 9, final CTA) |
| Drop shadows (law: none) | 0 | 3-4 | 0 |
| Booking asks | 9 | 1 (at 98%) | 6 |
| Longest stretch with no ask | 23% | 97.5% | 34% |
| Mobile layout shift (CLS) | 0 | 0.336 | 0.0001 |
| Mobile LCP | 1652ms | 504ms | ~500ms |

## Verified and fixed
- P0 Wrong prospect flashed: Luiza's page rendered Andrew/CueVu for ~150ms before her data loaded (also the 0.336 mobile CLS). Now a loading state until the scan arrives; motion check asserts it.
- P0 One ask at 98% of the page. Header "Book a call" (replaced the ambient-sound toggle), quiet ink asks after the fold, after ch02, after ch04, after the month strip; red close kept.
- P1 Red used 12-18x against the once-per-composition law. Now ON + the highlighted figure + final CTA.
- P1 Drop shadows and hard-offset shadows (brand: printed, never floating). Removed; THE BOX (4px + 1px outline offset 3px) restored on the pillar toggle and the call card.
- P1 Wordmark off-spec ("inboundonsteroids." lowercase). Now INBOUND ON(900, red) STEROIDS.
- P1 Feed-card action bars overflowed the card edge and cards had uneven heights. Icon-only bar, equal heights.
- P1 The chapter guide line ran through the wide chapter 05 text. Hidden there.
- P1 Side progress rail collided with chapter 05 below 1320px. Side rail only at 1320px+, top bar below.
- P2 Tabular digits spaced the comma in "3,120". Fixed.

## Still open
- P2 Longest ask-free stretch is 34% (~4,400px: chapters 01-02). Old was 23%.
- P2 H2 ladder is the same for every prospect ("A story makes them stop." ...). Old also generic, so not a regression; the h2s could carry the prospect's own data.
- P2 Display type is weight 500 at -0.055em; the Black Box sheet says 800 at -0.035em.
- P2 Old page content the new one lacks: the full cold-outbound chapter (ICP segments, sources, filters) and "From your own words" verbatim quotes.
- Note: Luiza's lead magnet shows the staffing score in five places. Sent scan, left as-is by Ivan's ruling.
- Note: Luiza's engager samples talk about community-manager and gameplay-editor roles; identical on the old page, unverified against her posts.

## Refuted
- Density spike of 600+ words in the feed row: line-clamped post text is counted by the probe but not visible. Visible density matches old.
- Detector low-contrast hits: mid-reveal opacity captured in motion.
- Detector "Arial 27%": LinkedIn/Gmail platform mockups, platform exception.
- Detector numbered-section labels: brand ignore list (kicker above heading).

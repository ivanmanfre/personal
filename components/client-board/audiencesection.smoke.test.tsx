// @vitest-environment jsdom
/**
 * audiencesection.smoke.test.tsx — the audience review block, both skins, every state.
 *
 * goal-run audience-learning-03-client-experience-2026-09-09, board UI seat.
 * Gate C1 (rendering + auth) is built on this file plus board/auth-boundary.json.
 *
 * THE FIXTURES BELOW ARE NOT HAND-WRITTEN. Each one is the `expected` payload of a
 * PGlite case that ran the real migration through the real wrapper RPC:
 *   normal              board/fixtures/board-normal.json  sha256:ab244d32e73036ba
 *   empty               board/fixtures/board-empty.json  sha256:ef738810b977392a
 *   unknown             board/fixtures/board-unknown-labels.json  sha256:11f189074d6c7f0e
 *   incomplete_history  board/fixtures/board-incomplete-history.json  sha256:a097fe564f638d7b
 *   stale               board/fixtures/board-stale.json  sha256:c4312ff71c28106c
 *   unavailable         board/fixtures/board-flag-off.json  sha256:b52c7a16eb583437
 * They are inlined rather than read off disk so this test keeps passing after the
 * goal-run folder is gone. Regenerate with `node board/harness-board.mjs --freeze`
 * in that folder, then re-paste.
 *
 * Both skins are rendered by their REAL surface component (DeskPerformanceSurface
 * for desk, PerformanceSurface for blackbox), inside that skin's own `--cb-*`
 * variable map, so the section is exercised exactly as a board renders it.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DeskPerformanceSurface } from './DeskPerformanceSurface';
import { PerformanceSurface } from '../ClientBoardPage';
import { AUDIENCE_COPY } from './audienceCopy';
import type { Board } from '../ClientBoardPage';

export const FIXTURES: Record<string, any> = {
  "normal": {
    "posts": [
      {
        "raw": {
          "shares": 0,
          "comments": 1,
          "coverage": "collected",
          "reactions": 5,
          "captured_at": "2026-09-08T09:00:00+00:00",
          "impressions": 310
        },
        "rank": {
          "rank": 3,
          "basis": "matched_age",
          "eligible_n": 3,
          "target_age_days": 7
        },
        "topic": "reach",
        "format": "text",
        "engagers": {
          "people": 2,
          "unknown": 0,
          "coverage": "collected",
          "positive": 1,
          "borderline": 0,
          "excluded_operator": 0
        },
        "published_at": "2026-09-01T09:00:00+00:00",
        "post_social_id": "urn:li:activity:9000000000000000003",
        "assisted_outcomes": 1
      },
      {
        "raw": {
          "shares": 1,
          "comments": 4,
          "coverage": "collected",
          "reactions": 12,
          "captured_at": "2026-09-01T09:00:00+00:00",
          "impressions": 640
        },
        "rank": {
          "rank": 2,
          "basis": "matched_age",
          "eligible_n": 3,
          "target_age_days": 7
        },
        "topic": "trust",
        "format": "carousel",
        "engagers": {
          "people": 3,
          "unknown": 1,
          "coverage": "collected",
          "positive": 1,
          "borderline": 1,
          "excluded_operator": 1
        },
        "published_at": "2026-08-25T09:00:00+00:00",
        "post_social_id": "urn:li:activity:9000000000000000002",
        "assisted_outcomes": 1
      },
      {
        "raw": {
          "shares": 2,
          "comments": 9,
          "coverage": "collected",
          "reactions": 21,
          "captured_at": "2026-08-25T09:00:00+00:00",
          "impressions": 1180
        },
        "rank": {
          "rank": 1,
          "basis": "matched_age",
          "eligible_n": 3,
          "target_age_days": 7
        },
        "topic": "buyers",
        "format": "text",
        "engagers": {
          "people": null,
          "unknown": null,
          "coverage": "not_collected",
          "positive": null,
          "borderline": null,
          "excluded_operator": 0
        },
        "published_at": "2026-08-18T09:00:00+00:00",
        "post_social_id": "urn:li:activity:9000000000000000001",
        "assisted_outcomes": 0
      }
    ],
    "state": "normal",
    "assets": [
      {
        "source": "client call, 2026-08-20",
        "asset_id": "as-1",
        "confidentiality": "public",
        "factual_context": "Screen recording of the returns flow the client walked us through."
      }
    ],
    "client_id": "alpha",
    "freshness": {
      "engagers_as_of": "2026-09-02T11:00:00+00:00",
      "snapshots_as_of": "2026-09-08T09:00:00+00:00",
      "stale_after_days": 14
    },
    "reviewed_at": "2026-09-08T09:00:00+00:00",
    "monthly_median": [
      {
        "n": 2,
        "basis": "matched_age",
        "month": "2026-08-01",
        "target_age_days": 7,
        "median_reactions": 16.5
      },
      {
        "n": 1,
        "basis": "matched_age",
        "month": "2026-09-01",
        "target_age_days": 7,
        "median_reactions": 5
      }
    ],
    "review_cadence": "weekly",
    "recommendations": [
      {
        "decision": {
          "state": null,
          "reason": null,
          "decided_at": null
        },
        "evidence": {
          "sample_n": 4,
          "unknowns": 1,
          "source_ids": [
            "src-03"
          ],
          "source_dates": [
            "2026-09-02"
          ]
        },
        "link_state": "unknown",
        "asset_state": "none",
        "proof_needed": "Nothing beyond what is already on the board.",
        "what_changed": "A buyer-side account published a breakdown of what they check before signing.",
        "could_publish": "Your version of the same checklist, answered against your own delivery.",
        "asset_required": false,
        "why_it_matters": "It names the checks your buyers run, in their own words.",
        "recommendation_id": "rec-0002"
      },
      {
        "decision": {
          "state": "accepted",
          "reason": "We have the recording and the objection is the one we hear most.",
          "decided_at": "2026-09-08T16:00:00+00:00"
        },
        "evidence": {
          "sample_n": 12,
          "unknowns": 3,
          "source_ids": [
            "src-01",
            "src-02"
          ],
          "source_dates": [
            "2026-08-20",
            "2026-08-27"
          ]
        },
        "link_state": "unknown",
        "asset_state": "approved",
        "proof_needed": "The returns-flow recording, so the walkthrough is your own screen and not a description.",
        "what_changed": "Two of the accounts on your roster started answering the same objection in public this month.",
        "could_publish": "A short teardown of how the objection actually plays out, with the numbers you already have.",
        "asset_required": true,
        "why_it_matters": "Your buyers raise that objection on discovery calls, so a published answer meets them before the call.",
        "recommendation_id": "rec-0001"
      }
    ],
    "capability_version": 1
  },
  "empty": {
    "posts": [],
    "state": "empty",
    "assets": [],
    "client_id": "alpha",
    "freshness": {
      "engagers_as_of": null,
      "snapshots_as_of": null,
      "stale_after_days": 14
    },
    "reviewed_at": null,
    "monthly_median": [],
    "review_cadence": "weekly",
    "recommendations": [],
    "capability_version": 1
  },
  "unknown": {
    "posts": [
      {
        "raw": {
          "shares": null,
          "comments": null,
          "coverage": "collected",
          "reactions": 7,
          "captured_at": "2026-09-01T09:00:00+00:00",
          "impressions": null
        },
        "rank": {
          "rank": 1,
          "basis": "matched_age",
          "eligible_n": 1,
          "target_age_days": 7
        },
        "topic": "buyers",
        "format": "text",
        "engagers": {
          "people": 2,
          "unknown": 2,
          "coverage": "collected",
          "positive": 0,
          "borderline": 0,
          "excluded_operator": 0
        },
        "published_at": "2026-08-25T09:00:00+00:00",
        "post_social_id": "urn:li:activity:9000000000000000011",
        "assisted_outcomes": 0
      }
    ],
    "state": "unknown",
    "assets": [],
    "client_id": "alpha",
    "freshness": {
      "engagers_as_of": "2026-08-26T11:00:00+00:00",
      "snapshots_as_of": "2026-09-01T09:00:00+00:00",
      "stale_after_days": 14
    },
    "reviewed_at": null,
    "monthly_median": [
      {
        "n": 1,
        "basis": "matched_age",
        "month": "2026-08-01",
        "target_age_days": 7,
        "median_reactions": 7
      }
    ],
    "review_cadence": "weekly",
    "recommendations": [],
    "capability_version": 1
  },
  "incomplete_history": {
    "posts": [
      {
        "raw": {
          "shares": null,
          "comments": null,
          "coverage": "unknown",
          "reactions": 4,
          "captured_at": "2026-09-05T09:00:00+00:00",
          "impressions": 260
        },
        "rank": {
          "rank": null,
          "basis": "observed_age",
          "eligible_n": null,
          "target_age_days": null
        },
        "topic": "buyers",
        "format": "text",
        "engagers": {
          "people": null,
          "unknown": null,
          "coverage": "unknown",
          "positive": null,
          "borderline": null,
          "excluded_operator": 0
        },
        "published_at": "2026-08-12T09:00:00+00:00",
        "post_social_id": "urn:li:activity:9000000000000000022",
        "assisted_outcomes": 0
      },
      {
        "raw": {
          "shares": null,
          "comments": null,
          "coverage": "collected",
          "reactions": 9,
          "captured_at": "2026-09-04T09:00:00+00:00",
          "impressions": 400
        },
        "rank": {
          "rank": null,
          "basis": "observed_age",
          "eligible_n": null,
          "target_age_days": null
        },
        "topic": "buyers",
        "format": "text",
        "engagers": {
          "people": 1,
          "unknown": 0,
          "coverage": "collected",
          "positive": 1,
          "borderline": 0,
          "excluded_operator": 0
        },
        "published_at": "2026-08-05T09:00:00+00:00",
        "post_social_id": "urn:li:activity:9000000000000000021",
        "assisted_outcomes": 0
      }
    ],
    "state": "incomplete_history",
    "assets": [],
    "client_id": "alpha",
    "freshness": {
      "engagers_as_of": "2026-09-01T10:00:00+00:00",
      "snapshots_as_of": "2026-09-05T09:00:00+00:00",
      "stale_after_days": 14
    },
    "reviewed_at": null,
    "monthly_median": [],
    "review_cadence": "weekly",
    "recommendations": [],
    "capability_version": 1
  },
  "stale": {
    "posts": [
      {
        "raw": {
          "shares": null,
          "comments": null,
          "coverage": "collected",
          "reactions": 11,
          "captured_at": "2026-07-08T09:00:00+00:00",
          "impressions": 520
        },
        "rank": {
          "rank": 1,
          "basis": "matched_age",
          "eligible_n": 1,
          "target_age_days": 7
        },
        "topic": "buyers",
        "format": "text",
        "engagers": {
          "people": 1,
          "unknown": 0,
          "coverage": "collected",
          "positive": 1,
          "borderline": 0,
          "excluded_operator": 0
        },
        "published_at": "2026-07-01T09:00:00+00:00",
        "post_social_id": "urn:li:activity:9000000000000000031",
        "assisted_outcomes": 0
      }
    ],
    "state": "stale",
    "assets": [],
    "client_id": "alpha",
    "freshness": {
      "engagers_as_of": "2026-07-02T10:00:00+00:00",
      "snapshots_as_of": "2026-07-08T09:00:00+00:00",
      "stale_after_days": 14
    },
    "reviewed_at": null,
    "monthly_median": [
      {
        "n": 1,
        "basis": "matched_age",
        "month": "2026-07-01",
        "target_age_days": 7,
        "median_reactions": 11
      }
    ],
    "review_cadence": "weekly",
    "recommendations": [],
    "capability_version": 1
  },
  "unavailable": null
};

/** The two skins' variable maps, copied from ClientBoardPage's SKIN_VARS so the
 *  rendered markup carries the same ink/paper/accent a real board would. */
const SKIN_VARS: Record<string, Record<string, string>> = {
  desk: {
    '--cb-ink': '#111111', '--cb-paper': '#FFFFFF', '--cb-paper-raise': '#FFFFFF',
    '--cb-paper-sunk': '#F5F5F5', '--cb-desk': '#FFFFFF',
    '--cb-ink-soft': '#333333', '--cb-ink-mute': '#5F5F59',
    '--cb-line': '#E0E0E0', '--cb-line-bold': 'rgba(17,17,17,0.26)', '--cb-divide': 'rgba(17,17,17,0.08)',
    '--cb-serif': '"Sora", system-ui, sans-serif', '--cb-body': '"Inter Tight", system-ui, sans-serif',
    '--cb-mono': '"Inter Tight", system-ui, sans-serif',
    '--cb-card-shadow': 'none', '--cb-hero-shadow': 'none', '--cb-lift': 'none',
    '--cb-plate': '#333333', '--cb-plate-ink': '#FFFFFF', '--cb-plate-mute': '#ABABA3',
    '--cb-plate-line': 'rgba(255,255,255,0.14)', '--cb-accent': '#FFC71D',
  },
  blackbox: {
    '--cb-ink': '#131210', '--cb-paper': '#FFFFFF', '--cb-paper-raise': '#FFFFFF',
    '--cb-paper-sunk': '#F5F3EF', '--cb-desk': '#FFFFFF',
    '--cb-ink-soft': '#3A3833', '--cb-ink-mute': '#6B675E',
    '--cb-line': 'rgba(19,18,16,0.16)', '--cb-line-bold': 'rgba(19,18,16,0.28)', '--cb-divide': 'rgba(19,18,16,0.09)',
    '--cb-serif': '"Schibsted Grotesk", system-ui, sans-serif',
    '--cb-body': '"Schibsted Grotesk", system-ui, sans-serif',
    '--cb-mono': '"Schibsted Grotesk", system-ui, sans-serif',
    '--cb-card-shadow': 'none', '--cb-hero-shadow': 'none', '--cb-lift': 'none',
    '--cb-accent': '#C8361B',
  },
};

const BASE_BOARD: Board = { company_name: 'Test Co', queue: [], performance: { posts: [] } } as Board;

const NOOP_DECIDE = async () => true;

export function renderSkin(
  skin: 'desk' | 'blackbox', audience: unknown, live = true,
  /** Present on a live board, absent on a preview board — exactly how
   *  ClientBoardPage wires it (`isLive ? decideAudience : undefined`). */
  onDecide: (() => Promise<boolean>) | undefined = live ? NOOP_DECIDE : undefined,
): string {
  const surface = skin === 'desk'
    ? <DeskPerformanceSurface board={BASE_BOARD} accent="#FFC71D" live={live} showAim audience={audience as never} onAudienceDecide={onDecide as never} />
    : <PerformanceSurface board={BASE_BOARD} accent="#C8361B" live={live} showAim={false} audience={audience as never} onAudienceDecide={onDecide as never} />;
  return renderToStaticMarkup(
    <div data-skin={skin} style={SKIN_VARS[skin] as React.CSSProperties}>{surface}</div>,
  );
}

/** The four retired universal timing promises (correction ledger C01-C04) plus the
 *  one that survives. None of the four may appear in any rendered board markup. */
const RETIRED_TIMING = [
  'Profile views usually move within the first week of posting.',
  'First inbound DMs typically follow once posting is consistent.',
  'Opt-ins start as soon as your first lead magnet goes live.',
  'Booked calls follow opt-ins as outreach ramps.',
];
const KEPT_TIMING = 'Tracking starts the day delivery goes live.';

const INTERNAL_TABLES = /post_engagers|client_post_engagers|outreach_prospects|outreach_messages|carousel_drafts|client_board_actions|client_ideas|client_registry/;

/** n8n workflow ids are 16-character mixed-case alphanumerics. A bare 16-run of
 *  digits is a platform post id and is fine (it is a link target); a 16-run that
 *  mixes upper and lower case is an internal id and must never reach a client. */
function workflowIdLike(html: string): string[] {
  return (html.match(/\b[A-Za-z0-9]{16}\b/g) || [])
    .filter((m) => /[a-z]/.test(m) && /[A-Z]/.test(m));
}

const STATES = ['normal', 'empty', 'unknown', 'incomplete_history', 'stale'] as const;
const SKINS = ['desk', 'blackbox'] as const;

describe('AudienceSection: six states, both skins', () => {
  for (const skin of SKINS) {
    for (const state of STATES) {
      it(`${skin}: renders the ${state} state and says so`, () => {
        const html = renderSkin(skin, FIXTURES[state]);
        // the section rendered, tagged with the state it is in
        expect(html).toContain(`data-audn-section="${state}"`);
        // the state's own sentence is on screen
        expect(html).toContain((AUDIENCE_COPY.state as Record<string, string>)[state]);
        // The state chip, for every state that still has one. `normal` lost its
        // chip in run 04: the only thing it said was "Up to date", which is the
        // freshness chip's claim to make and reads `freshness.overall` alone.
        const chip = AUDIENCE_COPY.stateChip[state];
        if (state === 'normal') {
          expect(chip).toBeUndefined();
          expect(html).not.toContain(AUDIENCE_COPY.freshnessChip.fresh);
        } else {
          expect(html).toContain(chip);
        }
        // no retired timing promise anywhere in the rendered board
        for (const s of RETIRED_TIMING) expect(html).not.toContain(s);
        // no internal table or workflow name reaches a client
        expect(html).not.toMatch(INTERNAL_TABLES);
        expect(workflowIdLike(html)).toEqual([]);
      });
    }

    it(`${skin}: a live board with audience null renders no section at all`, () => {
      const html = renderSkin(skin, FIXTURES.unavailable, true);
      expect(FIXTURES.unavailable).toBeNull();
      expect(html).not.toContain('data-audn-section');
      expect(html).not.toContain(AUDIENCE_COPY.eyebrow);
      expect(html).not.toContain(AUDIENCE_COPY.recs.heading);
      expect(html).not.toContain(AUDIENCE_COPY.posts.heading);
      // and no sample data: none of the fixture deck leaks in
      expect(html).not.toContain('9000000000000000002');
      expect(html).not.toContain('rec-0001');
    });
  }
});

describe('AudienceSection: what the normal state actually shows', () => {
  const html = renderSkin('desk', FIXTURES.normal);

  it('shows the raw metric with the date it was taken', () => {
    expect(html).toContain('>12<');                    // reactions, as a real metric cell
    // The source metric is called `impressions`. It used to print as "reads",
    // which names an event nobody measures (run-04 CONTRACTS §2.4).
    expect(html).toContain('310 impressions');
    expect(html).not.toContain('310 reads');
    expect(html).toContain(AUDIENCE_COPY.posts.capturedAt('1 Sep'));
  });

  it('spells out the rank basis, with the eligible denominator', () => {
    expect(html).toContain(AUDIENCE_COPY.posts.rank.matched(1, 3, 7));
    expect(html).toContain(AUDIENCE_COPY.posts.rank.matched(3, 3, 7));
  });

  it('counts relevant engagers as people, and shows the operator it excluded', () => {
    expect(html).toContain(AUDIENCE_COPY.posts.people.total(3));
    expect(html).toContain(AUDIENCE_COPY.posts.people.positiveOne);
    expect(html).toContain(AUDIENCE_COPY.posts.people.borderline(1));
    expect(html).toContain(AUDIENCE_COPY.posts.people.unknown(1));
    expect(html).toContain(AUDIENCE_COPY.posts.people.excluded(1));
  });

  it('names the remainder so the parts reconcile with the total, and shows no zero buckets', () => {
    // the 1 Sep post has 2 people, 1 of them positive: the other is named, not
    // left as a silent gap, and the empty buckets are not printed as zeros
    expect(html).toContain(AUDIENCE_COPY.posts.people.notAFit(1));
    expect(html).not.toContain(AUDIENCE_COPY.posts.people.borderline(0));
    expect(html).not.toContain(AUDIENCE_COPY.posts.people.unknown(0));
  });

  it('never adds people across posts into a distinct-people total', () => {
    // one person engaged with two of the three posts, so 2 + 3 = 5 would be a
    // wrong distinct count. The headline states coverage instead.
    expect(html).toContain(AUDIENCE_COPY.headline.withCoverage(3, 2));
    expect(html).not.toMatch(/5 people we can name/);
    expect(html).toContain(AUDIENCE_COPY.posts.notSummed);
  });

  it('pluralises the per-post counts', () => {
    expect(html).toContain('1 comment');
    expect(html).not.toContain('1 comments');
    expect(html).not.toContain('1 shares');
  });

  it('renders a dashed blank, never a zero, for the post nobody engaged', () => {
    expect(html).toContain(AUDIENCE_COPY.posts.people.none);
    expect(html).toContain('cb-blank');
  });

  it('says assisted, never caused', () => {
    expect(html).toContain(AUDIENCE_COPY.posts.assisted(1));
    expect(html).toContain(AUDIENCE_COPY.posts.assistedNote);
    expect(html).not.toMatch(/caused|drove|generated the booking/i);
  });

  it('shows the absolute monthly median with its sample size', () => {
    expect(html).toContain(AUDIENCE_COPY.trend.heading);
    expect(html).toContain(AUDIENCE_COPY.trend.sample(2));
    expect(html).toContain(AUDIENCE_COPY.trend.age(7));
    expect(html).toContain(AUDIENCE_COPY.trend.basisMatched);
  });

  it('answers the five recommendation questions and records the decision with its reason', () => {
    expect(html).toContain(AUDIENCE_COPY.recs.whatChanged);
    expect(html).toContain(AUDIENCE_COPY.recs.whyItMatters);
    expect(html).toContain(AUDIENCE_COPY.recs.couldPublish);
    expect(html).toContain(AUDIENCE_COPY.recs.proofNeeded);
    expect(html).toContain(AUDIENCE_COPY.recs.supports);
    expect(html).toContain(AUDIENCE_COPY.recs.happenedAfter);
    // the month abbreviation comes from the runtime's own locale data ("Sep" on
    // some ICU builds, "Sept" on others), so the date itself is matched loosely
    expect(html).toMatch(/You said use it, \d{1,2} \w{3,4}\./);
    expect(html).toContain('the objection is the one we hear most');
    expect(html).toContain(AUDIENCE_COPY.linkState.unknown);
  });

  it('shows only approved, non-private material', () => {
    expect(html).toContain(AUDIENCE_COPY.assets.heading);
    expect(html).toContain('Screen recording of the returns flow');
  });
});

describe('AudienceSection: decision controls', () => {
  it('are switched off with a note on a preview board', () => {
    const html = renderSkin('desk', FIXTURES.normal, false);
    expect(html).toContain(AUDIENCE_COPY.decision.previewNote);
    expect(html).toContain('disabled=""');
  });

  it('require a reason: the field and its prompt are always present', () => {
    const html = renderSkin('desk', FIXTURES.normal, true);
    expect(html).toContain(AUDIENCE_COPY.decision.reasonLabel);
    expect(html).toContain(AUDIENCE_COPY.decision.reasonPlaceholder);
    expect(html).toContain(AUDIENCE_COPY.decision.accept);
    expect(html).toContain(AUDIENCE_COPY.decision.reject);
    expect(html).toContain(AUDIENCE_COPY.decision.defer);
  });

  it('are live buttons, not dead spans, when a live board hands over a decide fn', () => {
    const html = renderSkin('desk', FIXTURES.normal, true);
    expect(html).not.toContain(AUDIENCE_COPY.decision.previewNote);
    expect(html).not.toContain('disabled=""');
    // the kit renders a real <button> only when an onClick was given
    expect(html).toMatch(/<button type="button" class="pill[^"]*"[^>]*>Use it<\/button>/);
  });

  // (a live board with no decide fn is not a state the page can produce:
  //  ClientBoardPage passes `isLive ? decideAudience : undefined`, so the two
  //  always travel together.)
});

describe('W18: one expectationFor, no retired timing copy left in the tree', () => {
  const here = path.dirname(new URL(import.meta.url).pathname);
  const read = (p: string) => fs.readFileSync(path.join(here, p), 'utf8');

  it('both surfaces import the shared expectation module, and neither defines one', () => {
    const desk = read('DeskPerformanceSurface.tsx');
    const page = read('../ClientBoardPage.tsx');
    expect(desk).toMatch(/import \{ expectationFor \} from '\.\/expectation'/);
    expect(page).toMatch(/import \{ expectationFor \} from '\.\/client-board\/expectation'/);
    expect(desk).not.toMatch(/function expectationFor/);
    expect(page).not.toMatch(/function expectationFor/);
    // exactly one definition exists, and it is the exported one
    const shared = read('expectation.ts');
    expect((shared.match(/export function expectationFor/g) || []).length).toBe(1);
  });

  it('none of the four retired sentences survives anywhere in the component tree', () => {
    const root = path.resolve(here, '..');
    const files: string[] = [];
    const walk = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, e.name);
        if (e.isDirectory()) walk(full);
        else if (/\.(tsx?|ts)$/.test(e.name) && !e.name.endsWith('.test.tsx')) files.push(full);
      }
    };
    walk(root);
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8');
      for (const s of RETIRED_TIMING) {
        expect(`${path.relative(root, f)} :: ${src.includes(s)}`).toBe(`${path.relative(root, f)} :: false`);
      }
    }
  });

  it('the surviving C05 line is still the fallback', () => {
    expect(read('expectation.ts')).toContain(KEPT_TIMING);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * RUN 04. The three corrections the Run 03 handoff asked for, each with the
 * failure it prevents.
 *
 * The fixtures below are BUILT FROM `FIXTURES.normal` — the frozen PGlite
 * payload — by replacing only the block under test. Every other field, and
 * therefore every other assertion above, is the real migration's output.
 * `freshness.sources` / `overall` and `people[]` are the run-04 CONTRACTS
 * §2.1 / §2.2 shapes, which migration 07 is being changed to emit.
 * ══════════════════════════════════════════════════════════════════════════ */

const clone = (o: unknown) => JSON.parse(JSON.stringify(o));

const D_FRESH = '2026-09-08T09:00:00+00:00';   // 1 day before the cutoff
const D_OLD = '2026-06-30T09:00:00+00:00';     // 71 days before it

function withFreshness(overall: string, metrics: unknown, engagement: unknown) {
  const f = clone(FIXTURES.normal);
  f.freshness = {
    snapshots_as_of: (metrics as { as_of: string | null } | null)?.as_of ?? null,
    engagers_as_of: (engagement as { as_of: string | null } | null)?.as_of ?? null,
    stale_after_days: 14,
    sources: { metrics, engagement },
    overall,
  };
  return f;
}

const FRESHNESS_CASES = {
  fresh: withFreshness('fresh',
    { as_of: D_FRESH, state: 'fresh' }, { as_of: D_FRESH, state: 'fresh' }),
  /** THE ONE THE OLD DERIVATION HID: a snapshot taken yesterday, an engagement
   *  source last seen in June. The greatest-of-the-two rule called this normal
   *  and the chip said "Up to date". */
  partial: withFreshness('partial',
    { as_of: D_FRESH, state: 'fresh' }, { as_of: D_OLD, state: 'stale' }),
  /** And the reverse, so neither source is privileged. */
  partialReversed: withFreshness('partial',
    { as_of: D_OLD, state: 'stale' }, { as_of: D_FRESH, state: 'fresh' }),
  stale: withFreshness('stale',
    { as_of: D_OLD, state: 'stale' }, { as_of: D_OLD, state: 'stale' }),
  missing: withFreshness('missing',
    { as_of: null, state: 'missing' }, { as_of: null, state: 'missing' }),
};

const S = AUDIENCE_COPY.freshness.sources;

describe('run 04 §2.1: the freshness chip reads overall, and every source says its own date', () => {
  for (const skin of SKINS) {
    it(`${skin}: "Up to date" is printed for fresh and for nothing else`, () => {
      const ok = renderSkin(skin, FRESHNESS_CASES.fresh);
      expect(ok).toContain(AUDIENCE_COPY.freshnessChip.fresh);
      for (const key of ['partial', 'partialReversed', 'stale', 'missing'] as const) {
        const html = renderSkin(skin, FRESHNESS_CASES[key]);
        expect(html).not.toContain(AUDIENCE_COPY.freshnessChip.fresh);
      }
    });
  }

  it('a fresh metric with a stale engagement source is partial, and the stale date is on screen', () => {
    const html = renderSkin('desk', FRESHNESS_CASES.partial);
    expect(html).toContain('data-audn-freshness="partial"');
    expect(html).toContain(AUDIENCE_COPY.freshnessChip.partial);
    expect(html).toContain(S.metricsFresh('8 Sep'));
    expect(html).toContain(S.engagementStale('30 Jun'));
    // and the window it was judged against is stated, not only in `stale`
    expect(html).toContain(AUDIENCE_COPY.freshness.staleAfter(14));
  });

  it('the reverse mix is partial too: neither source can carry the other', () => {
    const html = renderSkin('desk', FRESHNESS_CASES.partialReversed);
    expect(html).toContain(AUDIENCE_COPY.freshnessChip.partial);
    expect(html).toContain(S.metricsStale('30 Jun'));
    expect(html).toContain(S.engagementFresh('8 Sep'));
  });

  it('both stale, and both missing, are explicit', () => {
    const stale = renderSkin('desk', FRESHNESS_CASES.stale);
    expect(stale).toContain(AUDIENCE_COPY.freshnessChip.stale);
    expect(stale).toContain(S.metricsStale('30 Jun'));
    expect(stale).toContain(S.engagementStale('30 Jun'));

    const missing = renderSkin('desk', FRESHNESS_CASES.missing);
    expect(missing).toContain(AUDIENCE_COPY.freshnessChip.missing);
    expect(missing).toContain(S.metricsMissing);
    expect(missing).toContain(S.engagementMissing);
  });

  it('a payload with no sources block still prints its two dates and claims no freshness', () => {
    const html = renderSkin('desk', FIXTURES.normal);   // the pre-§2.1 payload
    expect(html).toContain(AUDIENCE_COPY.freshness.snapshots('8 Sep'));
    expect(html).toContain(AUDIENCE_COPY.freshness.engagers('2 Sep'));
    expect(html).not.toContain(AUDIENCE_COPY.freshnessChip.fresh);
  });
});

/* ── §2.2 relationship ──────────────────────────────────────────────────── */

function withPeople(people: unknown[]) {
  const f = clone(FIXTURES.normal);
  f.people = people;
  return f;
}

const PEOPLE = [
  { person_ref: 'p1', label: 'positive',
    relationship: { state: 'existing_prospect_stage:replied', source: 'outreach_prospects.current', effective_date: '2026-08-03T10:00:00+00:00' } },
  { person_ref: 'p2', label: 'positive',
    relationship: { state: 'unknown', source: null, effective_date: null } },
  { person_ref: 'p3', label: 'borderline',
    relationship: { state: 'existing_prospect_stage:booked', source: 'outreach_prospects.current', effective_date: '2026-07-19T10:00:00+00:00' } },
  // a stage token with no client-facing word: the token must NOT reach the page
  { person_ref: 'p4', label: 'unknown',
    relationship: { state: 'existing_prospect_stage:seq7_variant_b', source: 'outreach_prospects.current', effective_date: '2026-08-21T10:00:00+00:00' } },
  // relationship key absent entirely
  { person_ref: 'p5', label: 'positive' },
];

describe('run 04 §2.2: a relevance label is not a relationship, and never a new prospect', () => {
  for (const skin of SKINS) {
    it(`${skin}: every person carries a chip, and an unknown one says so in words`, () => {
      const html = renderSkin(skin, withPeople(PEOPLE));
      expect(html).toContain('data-audn-relationship');
      expect(html).toContain(AUDIENCE_COPY.relationship.known('3 Aug', 'they replied to us'));
      expect(html).toContain(AUDIENCE_COPY.relationship.known('19 Jul', 'they booked a call'));
      // two people have no record: p2 (state unknown) and p5 (no key at all)
      expect(html).toContain(AUDIENCE_COPY.relationship.unknown);
      expect(html).toContain(AUDIENCE_COPY.relationship.unknownMany(2));
      expect(html).toContain(AUDIENCE_COPY.relationship.footnote);
    });
  }

  it('an unmapped stage token never reaches the client: the date survives, the token does not', () => {
    const html = renderSkin('desk', withPeople(PEOPLE));
    expect(html).not.toContain('seq7_variant_b');
    expect(html).not.toContain('existing_prospect_stage');
    expect(html).toContain(AUDIENCE_COPY.relationship.knownDateOnly('21 Aug'));
  });

  it('a positive label never reads as a new prospect or as a certified buyer', () => {
    const html = renderSkin('desk', withPeople(PEOPLE));
    expect(html).toContain(AUDIENCE_COPY.posts.people.positiveOne);
    expect(AUDIENCE_COPY.posts.people.positiveOne).toContain('relevant');
    for (const banned of ['new prospect', 'new prospects', 'look like your buyers', 'looks like your buyer']) {
      expect(html.toLowerCase()).not.toContain(banned);
    }
  });

  it('no person name and no internal id rides in on the relationship block', () => {
    const html = renderSkin('desk', withPeople(PEOPLE));
    expect(html).not.toMatch(INTERNAL_TABLES);
    expect(workflowIdLike(html)).toEqual([]);
    for (const p of PEOPLE) expect(html).not.toContain(`>${p.person_ref}<`);
  });

  it('a payload with no people block renders no relationship section at all', () => {
    const html = renderSkin('desk', FIXTURES.normal);
    expect(html).not.toContain('data-audn-relationship');
  });

  it('past the chip cap the remainder is counted in words, never dropped', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      person_ref: `q${i}`, label: 'positive',
      relationship: { state: 'existing_prospect_stage:replied', source: 'outreach_prospects.current', effective_date: '2026-08-03T10:00:00+00:00' },
    }));
    const html = renderSkin('desk', withPeople(many));
    expect(html).toContain(AUDIENCE_COPY.relationship.more(6));
  });
});

/* ── §2.4 headline + the two limits ────────────────────────────────────── */

describe('run 04 §2.4: the headline is grammatical and the relevance counts carry their limits', () => {
  it('one post reads as a sentence, not as "1 of it"', () => {
    expect(AUDIENCE_COPY.headline.withCoverage(1, 1))
      .toBe('1 post reviewed. Engagement collected for 1 post.');
    expect(AUDIENCE_COPY.headline.withCoverage(1, 1)).not.toContain(' of it');
  });

  it('more than one reads N of M', () => {
    expect(AUDIENCE_COPY.headline.withCoverage(3, 2))
      .toBe('3 posts reviewed. Engagement collected for 2 of 3 posts.');
  });

  it('the rendered normal board carries the new headline and neither old clause', () => {
    const html = renderSkin('desk', FIXTURES.normal);
    expect(html).toContain('Engagement collected for');
    expect(html).not.toContain('People collected on');
  });

  for (const skin of SKINS) {
    it(`${skin}: the classifier-quality and source-coverage limits sit under the counts`, () => {
      const html = renderSkin(skin, FIXTURES.normal);
      expect(html).toContain(AUDIENCE_COPY.limits.classifier);
      expect(html).toContain(AUDIENCE_COPY.limits.coverage);
    });
  }
});

/* ── §2.4 expectation lines, checked against what is actually measured ──── */

describe('run 04 §2.4: no expectation sentence says that waiting supplies a number', () => {
  const here = path.dirname(new URL(import.meta.url).pathname);
  const src = fs.readFileSync(path.join(here, 'expectation.ts'), 'utf8');
  const lines = (src.match(/return '[^']+';/g) || []).map((m) => m.slice(8, -2));

  it('reads five sentences and no more', () => {
    expect(lines.length).toBe(5);
  });

  it('none of them ties a number to elapsed time', () => {
    for (const l of lines) {
      expect(`${l} :: ${/live long enough|within the first|over time|as .* ramps|typically follow|usually/i.test(l)}`)
        .toBe(`${l} :: false`);
    }
  });

  it('the profile-view line states the measured condition instead of a waiting period', () => {
    const view = lines.find((l) => l.startsWith('Profile views')) as string;
    expect(view).toContain('LinkedIn names the viewer');
    expect(view).toContain('floor');
    expect(view).not.toContain('long enough');
  });

  it('the DM line states the attribution rule it actually uses', () => {
    const dm = lines.find((l) => l.startsWith('Inbound DMs')) as string;
    expect(dm).toContain('reacted to or commented on one of your posts before writing');
  });

  it('the opt-in line says a gate is what captures one', () => {
    const opt = lines.find((l) => l.startsWith('Opt-ins')) as string;
    expect(opt).toContain('gated lead magnet');
    expect(opt).toContain('ungated page has no gate');
  });
});

/* ── the voice rules this run was given, checked on the copy itself ─────── */

describe('run 04: every client-visible string obeys the voice rules', () => {
  const here = path.dirname(new URL(import.meta.url).pathname);
  const sources = ['audienceCopy.ts', 'expectation.ts']
    .map((f) => fs.readFileSync(path.join(here, f), 'utf8'));

  /** The rule is about what a client READS. The block comments in these files are
   *  engineering prose and are allowed their punctuation; every quoted string is
   *  a candidate for the screen and is not. */
  it('no em dash in any client-visible string', () => {
    for (const src of sources) {
      const stripped = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      const literals = stripped.match(/'[^'\n]*'|`[^`]*`/g) || [];
      // a guard on the extraction itself: if the regex ever stops matching, the
      // test must fail rather than pass over an empty list
      expect(literals.length).toBeGreaterThan(5);
      for (const l of literals) expect(`${l} :: ${l.includes('—')}`).toBe(`${l} :: false`);
    }
  });

  it('no rounded-full and no hex colour in the section or its copy', () => {
    const sec = fs.readFileSync(path.join(here, 'AudienceSection.tsx'), 'utf8');
    expect(sec).not.toContain('rounded-full');
    expect(sec).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});

/* ── §2.2 against migration 07's ACTUAL emitted shape ───────────────────── */

/**
 * The block above was written to the CONTRACT. This one is written to what
 * `audn_board_payload` actually builds (`20260911_audn_07_board_payload.sql`,
 * the `people` CTE): `person_key`, `label`, `posts`, `first_observed_at`,
 * `last_observed_at`, `relationship {state, source, effective_date}`.
 *
 * The identifier is `person_key`, not `person_ref`. It is a LinkedIn profile
 * urn and it MUST NOT reach the markup: the section uses it as a React key and
 * nothing else, and a React key is not serialised.
 */
const PAYLOAD_07_PEOPLE = [
  { person_key: 'ACoAABBBBBBBBBBBBBBBBBBB1', label: 'positive', posts: 2, first_observed_at: '2026-08-19T10:00:00+00:00', last_observed_at: '2026-09-01T10:00:00+00:00',
    relationship: { state: 'existing_prospect_stage:replied', source: 'outreach_prospects.current', effective_date: '2026-08-03T10:00:00+00:00' } },
  { person_key: 'ACoAABBBBBBBBBBBBBBBBBBB2', label: 'borderline', posts: 1, first_observed_at: '2026-08-26T10:00:00+00:00', last_observed_at: '2026-08-26T10:00:00+00:00',
    relationship: { state: 'unknown', source: null, effective_date: null } },
  { person_key: 'ACoAABBBBBBBBBBBBBBBBBBB3', label: 'unknown', posts: 1, first_observed_at: '2026-09-02T10:00:00+00:00', last_observed_at: '2026-09-02T10:00:00+00:00',
    relationship: { state: 'existing_prospect_stage:connect_sent', source: 'outreach_prospects.current', effective_date: '2026-09-01T10:00:00+00:00' } },
];

describe('run 04 §2.2: the block renders migration 07\'s own people[] shape', () => {
  for (const skin of SKINS) {
    it(`${skin}: chips render off person_key, and the key never reaches the markup`, () => {
      const html = renderSkin(skin, withPeople(PAYLOAD_07_PEOPLE));
      expect(html).toContain('data-audn-relationship');
      expect(html).toContain(AUDIENCE_COPY.relationship.known('3 Aug', 'they replied to us'));
      // asserted in two halves: `toLocaleDateString` renders September as "Sep"
      // or "Sept" depending on the ICU build, and a whole-chip match would tie
      // this test to whichever one the runner happens to ship
      expect(html).toContain('Known to us since 1 Sep');
      expect(html).toContain(AUDIENCE_COPY.relationship.stage.connect_sent);
      expect(html).toContain(AUDIENCE_COPY.relationship.unknownMany(1));
      for (const p of PAYLOAD_07_PEOPLE) expect(html).not.toContain(p.person_key);
      expect(html).not.toContain('ACoAA');
    });
  }

  it('the extra fields migration 07 carries are not printed anywhere', () => {
    const html = renderSkin('desk', withPeople(PAYLOAD_07_PEOPLE));
    expect(html).not.toContain('first_observed_at');
    expect(html).not.toContain('outreach_prospects.current');
  });
});

/**
 * desk-kit harness — renders every primitive at reference density into a standalone HTML
 * document, so the phase1 density gate can measure the kit itself before five surfaces
 * inherit it.
 *
 * Run:  npx vitest run components/client-board/desk-kit.harness.test.tsx
 * Then: node phase1-gate/gate.cjs --file <the written harness> --out <json>
 */
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'fs';
import path from 'path';
import {
  DeskKitStyle, Eyebrow, SectionRule, DeskH2, Footnote, Cols,
  Card, Plate, PlateMute, PlateRule,
  Num, Stat, StatStrip, Chip, Pill, Delta,
  BarRow, Spark, Funnel, JourneyPlate,
  Ledger, LedgerRow, LedgerCell, LedgerBar,
  Drill, Diff, Thumb, SlideStrip, Blank, StatBlank,
} from './desk-kit';

const OUT_DIR = '/Users/ivanmanfredi/.claude/projects/-Users-ivanmanfredi-Desktop-Ivan---Content-System/memory/goal-runs/rise-board-desk-panels-2026-08-01-out';
const OUT_FILE = path.join(OUT_DIR, 'phase1-harness.html');

/**
 * The desk var map, copied from ClientBoardPage's SKIN_VARS (skin === 'desk').
 * `--cb-serif` / `--cb-body` are board-driven there (board.brand.font_heading/font_body);
 * here they carry the approved reference pair, Sora + Manrope.
 */
const DESK_VARS: Record<string, string> = {
  '--cb-ink': '#111111', '--cb-paper': '#FFFFFF', '--cb-paper-raise': '#FFFFFF',
  '--cb-paper-sunk': '#F5F5F5', '--cb-desk': '#FFFFFF',
  '--cb-ink-soft': '#333333', '--cb-ink-mute': '#5F5F59',
  '--cb-line': '#E0E0E0', '--cb-line-bold': 'rgba(17,17,17,0.26)', '--cb-divide': 'rgba(17,17,17,0.08)',
  '--cb-serif': '"Sora", system-ui, sans-serif',
  '--cb-body': '"Manrope", system-ui, sans-serif',
  '--cb-mono': '"Manrope", system-ui, sans-serif',
  '--cb-clinical': '"Manrope", system-ui, sans-serif',
  '--cb-card-shadow': 'none', '--cb-hero-shadow': 'none', '--cb-lift': 'none',
  '--cb-plate': '#333333', '--cb-plate-ink': '#FFFFFF', '--cb-plate-mute': '#96968F',
  '--cb-plate-line': 'rgba(255,255,255,0.14)',
  '--cb-accent': '#FFC71D', '--cb-mint': '#2F7D4F',
};

/** The [data-skin="desk"] scoped block, copied verbatim from ClientBoardPage.tsx. */
const DESK_SCOPED_CSS = `
[data-skin="desk"] * { box-shadow: none !important; }
[data-skin="desk"] .cb-linkedin-preview { box-shadow: 0 1px 2px rgba(17,17,17,0.06) !important; }
[data-skin="desk"] .rounded, [data-skin="desk"] .rounded-md, [data-skin="desk"] .rounded-lg,
[data-skin="desk"] .rounded-xl, [data-skin="desk"] .rounded-2xl, [data-skin="desk"] .rounded-3xl { border-radius: 25px !important; }
[data-skin="desk"] .rounded-full { border-radius: 9999px !important; }
[data-skin="desk"] .cb-linkedin-preview { border-radius: 14px !important; }
[data-skin="desk"] .cb-linkedin-preview .rounded-full { border-radius: 9999px !important; }
[data-skin="desk"] .uppercase { font-weight: 800 !important; letter-spacing: 0.14em; }
[data-skin="desk"] .cb-num-serif { font-style: normal !important; font-weight: 700; font-variant-numeric: tabular-nums; }
[data-skin="desk"] .cb-accent-phrase { font-style: normal !important; font-weight: 700; }
[data-skin="desk"] h1, [data-skin="desk"] h2, [data-skin="desk"] h3,
[data-skin="desk"] .cb-display { font-weight: 300 !important; letter-spacing: -0.015em; }
[data-skin="desk"] h1 b, [data-skin="desk"] h2 b, [data-skin="desk"] h3 b,
[data-skin="desk"] h1 strong, [data-skin="desk"] h2 strong, [data-skin="desk"] .cb-display b { font-weight: 700 !important; }
[data-skin="desk"] .cb-plate { background: var(--cb-plate, #333) !important; color: var(--cb-plate-ink, #fff) !important; border-color: var(--cb-plate, #333) !important; }
[data-skin="desk"] .cb-plate .cb-plate-mute { color: var(--cb-plate-mute, #96968F) !important; }
[data-skin="desk"] .cb-plate hr, [data-skin="desk"] .cb-plate .cb-plate-rule { border-color: var(--cb-plate-line, rgba(255,255,255,0.14)) !important; }
[data-skin="desk"] .cb-blank { border: 2px dashed var(--cb-line-bold) !important; background: repeating-linear-gradient(45deg, rgba(17,17,17,0.045) 0 4px, rgba(17,17,17,0) 4px 9px) !important; }
@media (prefers-reduced-motion: no-preference) {
  [data-skin="desk"] .card, [data-skin="desk"] .cb-plate { transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease; }
  [data-skin="desk"] .card:hover { transform: translateY(-2px); border-color: var(--cb-line-bold, #c9c9c2); }
  [data-skin="desk"] .cb-plate:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(17,17,17,0.16) !important; }
  [data-skin="desk"] .cb-liftable { transition: transform .15s ease, background .15s ease, border-color .15s ease; }
  [data-skin="desk"] .cb-liftable:hover { transform: translateY(-1px); }
}
`;

/** Minimal shell: no sidebar, no sticky bar — the kit is the subject, not the chrome. */
const SHELL_CSS = `
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:var(--cb-paper,#fff)}
body{font-family:Manrope,system-ui,-apple-system,sans-serif;color:#111;line-height:1.55;
 -webkit-font-smoothing:antialiased;overflow-x:hidden}
img{max-width:100%}
.tab{display:block;padding:34px;max-width:1040px}
@media(max-width:1023px){.tab{padding:26px 18px;overflow-x:clip}}
`;

const COVER = 'https://bjbvqvzbzczjbatgmccb.supabase.co/storage/v1/object/public/post-stills/rise-quote/b6a25431-cfcc-4e8e-8ed4-39825d4ed540.png';

const Harness = () => (
  <section className="tab" id="tab-kit">
    <Eyebrow>Desk kit &middot; every primitive</Eyebrow>
    <DeskH2>This week: 93 invites, 40 DMs, 15 InMails. <b>27 accepts, 8 wrote back.</b></DeskH2>

    {/* ── PLATE 1: bar rows, the this-week-vs-last idiom ── */}
    <Plate style={{ marginTop: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
        <Eyebrow on="plate">This week against last</Eyebrow>
        <PlateMute style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.04em' }}>31 Jul</PlateMute>
      </div>
      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700 }}>Connection invites</div>
        <BarRow on="plate" label="w/ 20 Jul" pct={62.4}
          value={<Num size="row" inline tone="plate-mute">58</Num>} />
        <BarRow on="plate" tone="strong" label="this week, Mon-Fri" pct={100}
          value={<Num size="big" inline tone="plate">93</Num>} />
        <PlateRule />
        <div style={{ fontSize: 13.5, fontWeight: 700, marginTop: 14 }}>DMs <PlateMute style={{ fontWeight: 600 }}>&middot; follow-ups included</PlateMute></div>
        <BarRow on="plate" label="w/ 20 Jul" pct={20}
          value={<Num size="row" inline tone="plate-mute">8</Num>} />
        <BarRow on="plate" tone="strong" label="this week, Mon-Fri" pct={100}
          value={<Num size="big" inline tone="plate">40</Num>} />
        <PlateRule />
        <div style={{ fontSize: 13.5, fontWeight: 700, marginTop: 14 }}>InMails</div>
        <BarRow on="plate" label="w/ 20 Jul" pct={73.3}
          value={<Num size="row" inline tone="plate-mute">11</Num>} />
        <BarRow on="plate" tone="strong" label="this week, Mon-Fri" pct={100}
          value={<Num size="big" inline tone="plate">15</Num>} />
      </div>
      <div style={{ marginTop: 17, display: 'flex', gap: 9, flexWrap: 'wrap', alignItems: 'center' }}>
        <Chip tone="plate">2 live weeks of data: direction, not a trend</Chip>
        <Delta on="plate" dir="up">+60%</Delta>
        <Delta on="plate">flat</Delta>
      </div>
    </Plate>

    {/* ── PLATE 2: the funnel ── */}
    <Plate style={{ marginTop: 22 }}>
      <Eyebrow on="plate">Everyone contacted so far</Eyebrow>
      <div style={{ marginTop: 18 }}>
        <Funnel
          steps={[
            { value: 153, label: 'People contacted', note: '· first touch only', pct: 100 },
            { value: 28, label: 'Accepted the invite', pct: 18.3, delta: '→ 18% of 153' },
            { value: 9, label: 'Wrote back', pct: 5.9, delta: '→ 32% of accepts', highlight: true },
            { label: 'Calls booked', blank: true },
          ]}
        />
      </div>
      <Footnote on="plate" style={{ marginTop: 16 }}>A first touch is an invite with a note, a first DM, or an InMail.</Footnote>
    </Plate>

    {/* ── PLATE 3: the journey graphic ── */}
    <Plate style={{ marginTop: 22 }} pad="28px 26px 24px">
      <JourneyPlate
        left={{ value: 9, label: 'Replies in play', sub: 'as of 31 Jul, 02:05' }}
        right={{ label: 'Calls booked', blank: true }}
      />
    </Plate>

    {/* ── The chart ── */}
    <Card style={{ marginTop: 22 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <Eyebrow>Daily reads, 21&ndash;30 Jul</Eyebrow>
        <Chip tone="accent">best post</Chip>
      </div>
      <Spark
        values={[187, 176, 201, 163, 1354, 216, 132, 148]}
        labels={['21', '22', '23', '24', '27', '28', '29', '30']}
        highlight={4}
        height="clamp(160px, 40vw, 220px)"
      />
      <Footnote>Bar height is reads. One post carried the week.</Footnote>
    </Card>

    {/* ── The aim mix: spark with top metrics ── */}
    <Card style={{ marginTop: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <Eyebrow>What the posts aim at</Eyebrow>
        <Chip>20 posts in the pipeline</Chip>
      </div>
      <Spark values={[9, 6, 5]} topLabels={[9, 6, 5]} labels={['Reach', 'Trust', 'Buyers']} highlight={0} barPad="clamp(0px, 3.2vw, 46px)" />
    </Card>

    {/* ── KPI tiles + deltas + a blank ── */}
    <Cols n={3} min={150} gap={16} style={{ marginTop: 22 }}>
      <div style={{ borderLeft: '3px solid var(--cb-accent)', paddingLeft: 14 }}>
        <Num size="big">1,852</Num>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--cb-ink-mute)', marginTop: 6 }}>Reads</div>
        <div style={{ marginTop: 8 }}><Delta dir="up">+155%</Delta></div>
      </div>
      <div style={{ borderLeft: '3px solid var(--cb-accent)', paddingLeft: 14 }}>
        <Num size="big">463</Num>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--cb-ink-mute)', marginTop: 6 }}>Reads per post</div>
        <div style={{ marginTop: 8 }}><Delta dir="up">+154%</Delta></div>
      </div>
      <div style={{ borderLeft: '3px solid var(--cb-line)', paddingLeft: 14 }}>
        <Num size="big" tone="mute">2.38%</Num>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--cb-ink-mute)', marginTop: 6 }}>Engagement rate</div>
        <div style={{ marginTop: 8 }}><Delta>&minus;36%</Delta></div>
      </div>
    </Cols>

    {/* ── Section rule + pills + a media row + a drill ── */}
    <SectionRule
      label="Scheduled"
      count={6}
      blurb="posts, dated and queued"
      right={<><Pill active>List</Pill> <Pill>Calendar</Pill></>}
      style={{ marginTop: 30 }}
    />
    <Card style={{ marginTop: 12 }} liftable>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <Thumb src={COVER} size="lg" />
        <div style={{ flex: '1 1 210px', minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--cb-serif)', fontWeight: 600, fontSize: 15.5, lineHeight: 1.35 }}>ChatGPT shopping checklist carousel</div>
          <div style={{ marginTop: 7, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Chip>carousel</Chip><Chip>reach</Chip><Chip tone="accent">ships today</Chip>
          </div>
        </div>
      </div>
      <SlideStrip srcs={[COVER, COVER, COVER, COVER, COVER, COVER]} style={{ marginTop: 12 }} />
      <Drill label="Open the copy" style={{ marginTop: 10 }}>
        <div style={{ fontWeight: 700, color: 'var(--cb-ink)' }}>Open ChatGPT and ask it what to buy in your category.</div>
        <div style={{ marginTop: 6 }}>Ninety-three percent of those runs ended without a single visit to any website.</div>
      </Drill>
    </Card>

    {/* ── Caps drill: two meters ── */}
    <Card style={{ marginTop: 12 }} pad="4px 26px">
      <Drill
        ruled={false}
        label="open it"
        summaryLeft={<>Sent today under your name: <b>20</b> invites, <b>7</b> DMs</>}
      >
        <Cols n={2} min={200} gap={20}>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <Num size="big" inline>20</Num>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--cb-ink-mute)' }}>invites &middot; cap 40</span>
            </div>
            <LedgerBar pct={50} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <Num size="big" inline>7</Num>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--cb-ink-mute)' }}>DMs &middot; cap 30</span>
            </div>
            <LedgerBar pct={23.3} />
          </div>
        </Cols>
      </Drill>
    </Card>

    {/* ── The changes log: diff inside a drill ── */}
    <SectionRule label="Changes log" count={40} blurb="changes on this board" style={{ marginTop: 30 }} />
    <div style={{ padding: '16px 14px 12px', background: 'color-mix(in srgb, var(--cb-accent) 8%, var(--cb-paper))', borderLeft: '3px solid var(--cb-accent)', borderRadius: '0 14px 14px 0', marginTop: 10 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span style={{ flex: 'none', fontSize: 11.5, fontWeight: 800 }}>31 Jul 04:45</span>
        <Chip tone="accent">Mattan</Chip>
        <span style={{ fontSize: 13, fontWeight: 800 }}>Copy edited</span>
      </div>
      <Drill ruled={false} label="See the edit" style={{ marginTop: 6 }}>
        <Diff
          before={'Open ChatGPT and ask it what to buy.\n\nIf your store does not show up, this is why.'}
          after={'Open ChatGPT and ask it what to buy.\n\nIf your store does not show up, this is why. I ran a study in July that watched 221 real runs.'}
          meta={<Delta>+152 characters</Delta>}
        />
      </Drill>
    </div>

    {/* ── The ledger: 6 rows + a group band ── */}
    <SectionRule label="The ledger" blurb="Bar length is share of the best post." style={{ marginTop: 30 }} />
    <Ledger
      style={{ marginTop: 12 }}
      columns={[{ width: '1%', style: { padding: '8px 10px 8px 0' } }, { label: 'Post' }, { label: 'Reads · rate', align: 'right', width: '1%' }]}
    >
      <LedgerRow tone="group">
        <LedgerCell colSpan={2} style={{ padding: '13px 8px' }}>
          <span style={{ fontFamily: 'var(--cb-serif)', fontWeight: 700, fontSize: 15 }}>Week of 20 Jul</span>
          <span style={{ display: 'block', marginTop: 2, fontSize: 12.5, fontWeight: 600, color: 'var(--cb-ink-mute)' }}>4 posts, 3.71% rate</span>
        </LedgerCell>
        <LedgerCell num align="right" width="1%">727<span style={{ display: 'block', marginTop: 6 }}><Delta>baseline</Delta></span></LedgerCell>
      </LedgerRow>
      {[
        { d: '21 Jul', t: 'Don’t run ads on broken tracking', aim: 'buyers', r: 187, rate: '4.8%', pct: 13.8, best: false },
        { d: '22 Jul', t: 'Read your agency’s incentive off its invoice', aim: 'buyers', r: 176, rate: '3.4%', pct: 13.0, best: false },
        { d: '23 Jul', t: 'Five places the money leaks in every store', aim: 'trust', r: 201, rate: '4.1%', pct: 14.8, best: false },
        { d: '24 Jul', t: 'Pay us only when we grow you', aim: 'reach', r: 163, rate: '3.0%', pct: 12.0, best: false },
        { d: '27 Jul', t: 'The checkout teardown', aim: 'reach', r: 1354, rate: '2.1%', pct: 100, best: true },
        { d: '28 Jul', t: 'ROAS versus cash conversion', aim: 'trust', r: 216, rate: '3.8%', pct: 16.0, best: false },
      ].map((p) => (
        <LedgerRow key={p.d} tone={p.best ? 'best' : 'default'}>
          <LedgerCell width={62} style={{ padding: '12px 10px 12px 0' }}><Thumb src={COVER} /></LedgerCell>
          <LedgerCell style={{ padding: '12px 8px' }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--cb-ink-mute)', fontVariantNumeric: 'tabular-nums' }}>{p.d}</div>
            <div style={{ marginTop: 3, fontSize: 14.5, fontWeight: 600, lineHeight: 1.3 }}>{p.t}</div>
            <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <Chip tone={p.best ? 'accent' : 'default'} style={{ fontSize: 12, padding: '3px 10px' }}>{p.aim}</Chip>
              {p.best && <Chip tone="accent" style={{ fontSize: 12, padding: '3px 10px' }}>best</Chip>}
            </div>
            <LedgerBar pct={p.pct} tone={p.best ? 'strong' : 'muted'} />
          </LedgerCell>
          <LedgerCell num align="right" width="1%">
            {p.r.toLocaleString('en-US')}
            <span style={{ display: 'block', marginTop: 5, fontFamily: 'var(--cb-body)', fontSize: 12.5, fontWeight: 700, color: 'var(--cb-ink-mute)' }}>{p.rate}</span>
          </LedgerCell>
        </LedgerRow>
      ))}
    </Ledger>

    {/* ── Footer stats + honest blanks ── */}
    <StatStrip>
      <Stat value="8" caption="posts published" />
      <Stat value="2,579" caption="reads all time" />
      <Stat value="1,354" caption="best post" />
      <StatBlank caption="opt-ins, not tracked yet" />
    </StatStrip>
    <Footnote>Dates past 7 Aug: <Blank style={{ display: 'inline-flex', width: 44, height: 22, minHeight: 22, verticalAlign: 'middle' }} /> not set yet.</Footnote>
  </section>
);

const doc = (body: string) => `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Desk kit harness &middot; rise-board-desk-panels 2026-08-01</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>${SHELL_CSS}${DESK_SCOPED_CSS}</style>
</head><body>
${body}
</body></html>
`;

describe('desk-kit harness', () => {
  it('renders every primitive and writes the gate harness', () => {
    const vars = Object.entries(DESK_VARS).map(([k, v]) => `${k}:${v}`).join(';');
    const markup = renderToStaticMarkup(
      <div data-skin="desk" style={{ ...(DESK_VARS as any) }}>
        <DeskKitStyle />
        <Harness />
      </div>
    );
    // renderToStaticMarkup already inlines the custom properties, but assert the root carries
    // them: an unset var map silently falls back to the literals and hides skin regressions.
    expect(markup).toContain('--cb-plate:#333333');
    expect(vars).toContain('--cb-accent:#FFC71D');

    const html = doc(markup);
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(OUT_FILE, html, 'utf8');

    // Gate contract: numbers must be measurable, visuals countable, the plate present.
    expect(markup).toContain('data-metric');
    expect(markup).toContain('data-viz');
    expect(markup).toContain('cb-plate');
    expect(markup).toContain('class="num cb-num-serif"');
    expect(markup).toContain('<table class="tbl"');
    expect(markup).toContain('class="n"');
    expect(markup).toContain('<details class="drill"');
    expect(markup).toContain('cb-blank');
    expect(markup).toContain('<section class="tab" id="tab-kit">');
    // No <p> anywhere: proseShare and paraOver2Lines are structurally zero.
    expect(markup).not.toMatch(/<p[\s>]/);
    // Every drill ships collapsed — the gate binds on the default state.
    expect(markup).not.toMatch(/<details[^>]*\sopen/);
    expect(fs.existsSync(OUT_FILE)).toBe(true);
  });
});

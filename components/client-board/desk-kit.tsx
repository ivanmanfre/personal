/**
 * desk-kit — the shared primitive vocabulary for the "desk" client-board skin.
 *
 * WHAT THIS IS
 * The React port of the approved static board (phase2-tournament/shell-v2.html +
 * phase3-panels/frag-*.html). Five surface builders consume this file as their API doc:
 * every visual constant (px size, weight, tracking, radius, spacing) is copied faithfully
 * from that reference, and every colour/font is expressed through the `--cb-*` CSS
 * variables that ClientBoardPage's desk SKIN_VARS map already sets on the board root.
 *
 * HARD RULES FOR SURFACE BUILDERS
 * 1. Never hardcode a hex. Ink/paper/line/accent all come from `var(--cb-…)`. The single
 *    exception, inherited from the reference, is the rgba-white overlays used INSIDE a
 *    dark <Plate/> — those are plate-relative and stay literal.
 * 2. Every per-row metric value must render through <Num/>, <Stat/>, <LedgerCell num/>, or
 *    <Spark topLabels/>. Those are the ONLY things the density gate can see as a metric
 *    (`.num`, `[data-metric]`, `.stat b`, `table.tbl td.n`, `.cmp td.v`). An untagged
 *    number is graded as prose and drags the panel toward a fail.
 * 3. Every chart/diagram must carry `data-viz` (or `.bar`/`.spark`). <Spark/>, <Funnel/>,
 *    <JourneyPlate/>, <LedgerBar/> and <BarRow/> already do. The gate wants >= 1 per panel.
 * 4. Never use <p> for anything longer than two rendered lines. This kit deliberately emits
 *    zero <p> tags; use <Footnote/> or plain divs for captions.
 * 5. Render <DeskKitStyle/> once per page. It carries the only rules that cannot be inlined
 *    (the details/summary marker reset and the +/- disclosure glyph).
 *
 * Everything here is server-renderable: no hooks, no effects, no browser APIs. <Drill/>
 * uses native <details>, so disclosure costs zero JS.
 */
import React from 'react';

type Base = {
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
};

const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

/** Where a primitive is rendered. `plate` switches to the plate-relative palette. */
export type Surface = 'paper' | 'plate';

/* ────────────────────────────────────────────────────────────────────────────
 * Tokens — the reference's constants, re-expressed as variables.
 * Green/red have no `--cb-*` slot in the board var map, so they are read through
 * a variable WITH the reference literal as fallback: a board may override them,
 * nothing here bakes a hex into the component tree.
 * ──────────────────────────────────────────────────────────────────────────── */
const INK = 'var(--cb-ink)';
const INK_SOFT = 'var(--cb-ink-soft)';
const MUTE = 'var(--cb-ink-mute)';
const PAPER = 'var(--cb-paper)';
const SUNK = 'var(--cb-paper-sunk)';
const LINE = 'var(--cb-line)';
const LINE_BOLD = 'var(--cb-line-bold)';
const ACCENT = 'var(--cb-accent)';
const SERIF = 'var(--cb-serif)';
const BODY = 'var(--cb-body)';
const OK = 'var(--cb-ok, #2F7D4F)';
const DOWN = 'var(--cb-down, #B8341F)';
/** Plate-relative literals — allowed, they are relative to the dark plate, not the brand. */
const PLATE_INK = 'var(--cb-plate-ink)';
const PLATE_MUTE = 'var(--cb-plate-mute)';
const PLATE_LINE = 'var(--cb-plate-line)';
const PLATE_TRACK = 'rgba(255,255,255,0.09)';
const PLATE_FILL_MUTED = 'rgba(255,255,255,0.32)';
const PLATE_DASH = 'rgba(255,255,255,0.5)';
const PLATE_SOFT_TEXT = '#C9C9C2';

/**
 * The one stylesheet the kit cannot inline. Render <DeskKitStyle/> once per page
 * (or inject DESK_KIT_CSS into your own <style>) or drills lose their +/- glyph.
 */
export const DESK_KIT_CSS = `
details.drill > summary { list-style: none; }
details.drill > summary::-webkit-details-marker { display: none; }
details.drill > summary .more::after { content: " +"; color: var(--cb-accent); }
details.drill[open] > summary .more::after { content: " −"; }
@media (prefers-reduced-motion: no-preference) {
  .spark i span, .barfill { transform-origin: bottom; animation: cbk-grow .5s ease-out backwards; }
  @keyframes cbk-grow { from { transform: scaleY(.55); opacity: .4 } }
}
`;

/** Drop once per page, above the panels. Zero JS. */
export const DeskKitStyle: React.FC = () => <style>{DESK_KIT_CSS}</style>;

/* ══════════════════════════ SECTION CHROME ══════════════════════════ */

/**
 * Uppercase micro-label that opens every block. 12px / 800 / .14em, muted.
 * @example <Eyebrow>Outreach</Eyebrow>
 */
export const Eyebrow: React.FC<Base & { on?: Surface; tone?: 'mute' | 'ink' }> = ({
  on = 'paper', tone = 'mute', className, style, children,
}) => (
  <div
    className={cx('eyebrow', 'uppercase', className)}
    style={{
      fontFamily: BODY, fontSize: 12, fontWeight: 800, letterSpacing: '0.14em',
      textTransform: 'uppercase', lineHeight: 1.35,
      color: on === 'plate' ? PLATE_MUTE : tone === 'ink' ? INK : MUTE,
      ...style,
    }}
  >
    {children}
  </div>
);

/**
 * The header row above a list section: eyebrow + optional count + blurb, closed by the
 * reference's 2px ink rule. The count renders as a real, gate-visible metric.
 * @example <SectionRule label="Scheduled" count={6} blurb="posts, dated and queued" />
 */
export const SectionRule: React.FC<Base & {
  label: React.ReactNode;
  count?: number | string;
  blurb?: React.ReactNode;
  /** Right-hand slot: filter pills, a view toggle, a chip. */
  right?: React.ReactNode;
}> = ({ label, count, blurb, right, className, style, children }) => (
  <div
    className={className}
    style={{
      display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap',
      paddingBottom: 12, borderBottom: `2px solid ${INK}`, ...style,
    }}
  >
    <div style={{
      fontFamily: BODY, fontSize: 12, fontWeight: 800, letterSpacing: '0.14em',
      textTransform: 'uppercase', color: INK, flex: '1 1 auto',
    }}>{label}</div>
    {count !== undefined && <Num size="row" inline style={{ fontSize: 19 }}>{count}</Num>}
    {blurb && <span style={{ fontSize: 12.5, fontWeight: 600, color: MUTE }}>{blurb}</span>}
    {right}
    {children}
  </div>
);

/**
 * The two-tone editorial headline: a light Sora sentence carrying the narrative, a <b>
 * carrying the verdict. Children-driven so the verdict span is the builder's call.
 * @example <DeskH2>This week: 93 invites, 40 DMs. <b>27 accepts, 8 wrote back.</b></DeskH2>
 */
export const DeskH2: React.FC<Base> = ({ className, style, children }) => (
  <h2
    className={cx('cb-display', className)}
    style={{
      fontFamily: SERIF, fontWeight: 300, fontSize: 'clamp(25px, 2.6vw, 30px)',
      lineHeight: 1.16, letterSpacing: '-0.015em', color: INK, margin: '10px 0 0', ...style,
    }}
  >
    {children}
  </h2>
);

/** Small grey footnote line (the reference's `.n2`). Honest-blank captions live here. */
export const Footnote: React.FC<Base & { on?: Surface }> = ({ on = 'paper', className, style, children }) => (
  <div
    className={className}
    style={{
      fontSize: 12.5, fontWeight: 600, lineHeight: 1.5, marginTop: 8,
      color: on === 'plate' ? PLATE_MUTE : MUTE, ...style,
    }}
  >
    {children}
  </div>
);

/**
 * 2- or 3-column grid that collapses to one column on mobile (reference `.grid2`/`.grid3`).
 * `n` sets the default per-column minimum; pass `min` to override it directly.
 */
export const Cols: React.FC<Base & { n?: 2 | 3; gap?: number; min?: number }> = ({
  n = 2, gap = 18, min, className, style, children,
}) => (
  <div
    className={className}
    style={{
      display: 'grid', gap,
      gridTemplateColumns: `repeat(auto-fit, minmax(min(${min ?? (n === 3 ? 190 : 240)}px, 100%), 1fr))`,
      ...style,
    }}
  >
    {children}
  </div>
);

/* ══════════════════════════ CONTAINERS ══════════════════════════ */

/**
 * White paper card: hairline border, 25px radius, no shadow.
 * @example <Card><Eyebrow>Booked calls</Eyebrow>…</Card>
 */
export const Card: React.FC<Base & { liftable?: boolean; pad?: string | number }> = ({
  liftable, pad, className, style, children,
}) => (
  <div
    className={cx('card', liftable && 'cb-liftable', className)}
    style={{
      border: `1px solid ${LINE}`, borderRadius: 25, background: PAPER, color: INK,
      padding: pad ?? 'clamp(20px, 2.2vw, 24px) clamp(20px, 2.4vw, 26px)', ...style,
    }}
  >
    {children}
  </div>
);

/**
 * The ONE dark proof plate per panel. Carries that panel's single most important number.
 * Anything inside it must use the plate-relative helpers: <PlateMute/>, <PlateRule/>,
 * `on="plate"` on Chip/Delta/BarRow/Blank/Num.
 * @example <Plate><Eyebrow on="plate">This week against last</Eyebrow>…</Plate>
 */
export const Plate: React.FC<Base & { pad?: string | number }> = ({ pad, className, style, children }) => (
  <div
    className={cx('cb-plate', className)}
    style={{
      background: 'var(--cb-plate)', color: PLATE_INK, border: '1px solid var(--cb-plate)',
      borderRadius: 25,
      padding: pad ?? 'clamp(24px, 2.6vw, 32px) clamp(22px, 3vw, 36px)', ...style,
    }}
  >
    {children}
  </div>
);

/** Muted text inside a plate. Uses the class the desk skin already scopes. */
export const PlateMute: React.FC<Base & { as?: 'span' | 'div' }> = ({ as = 'span', className, style, children }) => {
  const Tag = as as any;
  return <Tag className={cx('cb-plate-mute', className)} style={{ color: PLATE_MUTE, ...style }}>{children}</Tag>;
};

/** Hairline divider inside a plate. */
export const PlateRule: React.FC<Base & { gap?: number }> = ({ gap = 15, className, style }) => (
  <div
    className={cx('cb-plate-rule', className)}
    style={{ borderTop: `1px solid ${PLATE_LINE}`, marginTop: gap, paddingTop: 0, ...style }}
  />
);

/* ══════════════════════════ NUMBERS ══════════════════════════ */

export type NumSize = 'hero' | 'big' | 'row';
const NUM_PX: Record<NumSize, string> = {
  /** The one number that IS the story. 54px desktop / ~37px mobile. */
  hero: 'clamp(34px, 9.4vw, 54px)',
  /** KPI-tile / plate-callout scale. */
  big: 'clamp(26px, 4.6vw, 28px)',
  /** Per-row metric scale. Never go below this: the gate floors row metrics at 18px. */
  row: 'clamp(20px, 4.4vw, 22px)',
};

/**
 * A gate-visible numeral. Always emits `class="num cb-num-serif" data-metric`, the display
 * face, and tabular figures so columns line up.
 * @example <Num size="hero" tone="accent">1,354</Num>
 * @example <Num size="row" inline>58</Num>
 */
export const Num: React.FC<Base & {
  size?: NumSize;
  tone?: 'ink' | 'accent' | 'mute' | 'soft' | 'plate' | 'plate-mute';
  /** `true` when the numeral sits inline in a flex row rather than owning its line. */
  inline?: boolean;
}> = ({ size = 'row', tone = 'ink', inline, className, style, children }) => (
  <span
    className={cx('num', 'cb-num-serif', className)}
    data-metric=""
    style={{
      display: inline ? 'inline' : 'block',
      fontFamily: SERIF, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
      fontSize: NUM_PX[size], lineHeight: 1,
      color: tone === 'accent' ? ACCENT
        : tone === 'mute' ? MUTE
        : tone === 'soft' ? INK_SOFT
        : tone === 'plate' ? PLATE_INK
        : tone === 'plate-mute' ? PLATE_SOFT_TEXT
        : INK,
      ...style,
    }}
  >
    {children}
  </span>
);

/**
 * Footer KPI. Renders `.stat` with a `<b>` value (gate-visible) and an `<i>` caption.
 * @example <Stat value="8" caption="posts published" />
 */
export const Stat: React.FC<Base & { value: React.ReactNode; caption: React.ReactNode }> = ({
  value, caption, className, style,
}) => (
  <div className={cx('stat', className)} style={style}>
    <b style={{
      display: 'block', fontFamily: SERIF, fontWeight: 700,
      fontSize: 'clamp(26px, 7vw, 34px)', lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: INK,
    }}>{value}</b>
    <i style={{
      display: 'block', fontStyle: 'normal', fontSize: 12.5, fontWeight: 600,
      color: MUTE, marginTop: 8, lineHeight: 1.35,
    }}>{caption}</i>
  </div>
);

/** The footer stat strip: an auto-fit row of <Stat/>s over a hairline. */
export const StatStrip: React.FC<Base & { ruled?: boolean }> = ({ ruled = true, className, style, children }) => (
  <div
    className={className}
    style={{
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(140px, 100%), 1fr))',
      gap: 16, marginTop: 22, paddingTop: ruled ? 20 : 0,
      borderTop: ruled ? `1px solid ${LINE}` : undefined, ...style,
    }}
  >
    {children}
  </div>
);

/* ══════════════════════════ LABELS & ACTIONS ══════════════════════════ */

/**
 * Soft status pill. Never interactive — use <Pill/> for anything clickable.
 * @example <Chip tone="accent">best post</Chip>
 */
export const Chip: React.FC<Base & { tone?: 'default' | 'accent' | 'plate' }> = ({
  tone = 'default', className, style, children,
}) => (
  <span
    className={cx('chip', className)}
    style={{
      display: 'inline-block', borderRadius: 999, padding: '5px 13px',
      fontFamily: BODY, fontSize: 12.5, fontWeight: 700, lineHeight: 1.35,
      background: tone === 'accent' ? ACCENT : tone === 'plate' ? 'rgba(255,255,255,0.12)' : SUNK,
      color: tone === 'accent' ? INK : tone === 'plate' ? '#E6E6DF' : MUTE,
      ...style,
    }}
  >
    {children}
  </span>
);

/**
 * Bordered action pill. Renders a real <button> when `onClick` is given, a <span> otherwise
 * (so a static/server-rendered board never ships a dead button).
 * @example <Pill active onClick={() => setView('list')}>List</Pill>
 */
export const Pill: React.FC<Base & {
  active?: boolean;
  tone?: 'default' | 'accent';
  onClick?: () => void;
  type?: 'button' | 'submit';
  'aria-pressed'?: boolean;
}> = ({ active, tone = 'default', onClick, className, style, children, ...rest }) => {
  const s: React.CSSProperties = {
    display: 'inline-block', border: `1px solid ${active ? INK : tone === 'accent' ? ACCENT : LINE}`,
    borderRadius: 999, padding: '8px 17px', fontFamily: BODY, fontSize: 13, fontWeight: 700,
    lineHeight: 1.35, cursor: onClick ? 'pointer' : 'default',
    background: active ? INK : tone === 'accent' ? ACCENT : PAPER,
    color: active ? PAPER : tone === 'accent' ? INK : MUTE,
    ...style,
  };
  if (!onClick) return <span className={cx('pill', active && 'p', className)} style={s} {...rest}>{children}</span>;
  return (
    <button
      type="button"
      className={cx('pill', 'cb-liftable', active && 'p', className)}
      style={s}
      onClick={onClick}
      aria-pressed={active}
      {...rest}
    >
      {children}
    </button>
  );
};

/**
 * The +/- trend badge. `flat` is the default ON PURPOSE: per the locked copy rules, rate and
 * percentage deltas render flat grey, never red. Only unambiguous count wins get `up`.
 * @example <Delta>&rarr; 18% of 153</Delta>
 * @example <Delta dir="up">+155%</Delta>
 */
export const Delta: React.FC<Base & { dir?: 'up' | 'down' | 'flat'; on?: Surface }> = ({
  dir = 'flat', on = 'paper', className, style, children,
}) => {
  const paper: Record<string, React.CSSProperties> = {
    up: { background: `color-mix(in srgb, ${OK} 14%, ${PAPER})`, color: OK },
    down: { background: `color-mix(in srgb, ${DOWN} 12%, ${PAPER})`, color: DOWN },
    flat: { background: SUNK, color: MUTE },
  };
  const plate: Record<string, React.CSSProperties> = {
    up: { background: 'rgba(255,255,255,0.14)', color: '#8FE0AC' },
    down: { background: 'rgba(255,255,255,0.14)', color: '#E9A79A' },
    flat: { background: 'rgba(255,255,255,0.10)', color: PLATE_SOFT_TEXT },
  };
  return (
    <span
      className={cx('delta', dir, className)}
      style={{
        display: 'inline-block', borderRadius: 999, padding: '3px 11px',
        fontFamily: BODY, fontSize: 12.5, fontWeight: 800, lineHeight: 1.4,
        fontVariantNumeric: 'tabular-nums',
        ...(on === 'plate' ? plate[dir] : paper[dir]), ...style,
      }}
    >
      {children}
    </span>
  );
};

/* ══════════════════════════ DRAWN ELEMENTS ══════════════════════════ */

/**
 * Labelled horizontal bar, the this-week-vs-last idiom. Pass the value as a <Num/> so it is
 * gate-visible: `tone="muted"` for last week (small, dim), `tone="strong"` for this week
 * (big, accent fill).
 * @example <BarRow on="plate" label="w/ 20 Jul" value={<Num size="row" inline tone="plate-mute">58</Num>} pct={62.4} />
 */
export const BarRow: React.FC<Base & {
  label: React.ReactNode;
  value: React.ReactNode;
  /** 0-100. Clamped. */
  pct: number;
  tone?: 'muted' | 'strong';
  on?: Surface;
  labelWidth?: number;
  valueWidth?: number;
}> = ({ label, value, pct, tone = 'muted', on = 'paper', labelWidth = 114, valueWidth = 56, className, style }) => {
  const w = Math.max(0, Math.min(100, pct));
  const plate = on === 'plate';
  return (
    <div
      className={className}
      style={{ display: 'flex', alignItems: 'center', gap: 11, marginTop: 8, ...style }}
    >
      <span style={{
        flex: 'none', width: labelWidth, fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap',
        color: plate ? (tone === 'strong' ? PLATE_SOFT_TEXT : PLATE_MUTE) : MUTE,
      }}>{label}</span>
      <span style={{
        flex: 'none', width: valueWidth, textAlign: 'right',
        display: 'inline-block', overflow: 'visible',
      }}>{value}</span>
      <span
        className="bar"
        style={{
          flex: '1 1 50px', minWidth: 0, height: 12, borderRadius: 999,
          background: plate ? PLATE_TRACK : SUNK, display: 'block', overflow: 'hidden',
        }}
      >
        <span
          className="barfill"
          style={{
            display: 'block', height: '100%', width: `${w}%`, minWidth: w > 0 ? 6 : 0, borderRadius: 999,
            background: tone === 'strong' ? ACCENT : plate ? PLATE_FILL_MUTED : LINE_BOLD,
          }}
        />
      </span>
    </div>
  );
};

/**
 * Bar-chart column group. Counts as an encoding (`.spark` + `data-viz`). `topLabels` render
 * as gate-visible metrics above each bar; `labels` render under a hairline axis rule.
 * @example <Spark values={[187,176,201]} labels={['21','22','23']} highlight={2} />
 */
export const Spark: React.FC<Base & {
  values: number[];
  /** Axis labels under the rule, one per value. */
  labels?: React.ReactNode[];
  /** Values printed above each bar. Rendered at 20px so they clear the row-metric floor. */
  topLabels?: Array<React.ReactNode>;
  /** Index rendered in the accent colour. */
  highlight?: number;
  on?: Surface;
  height?: string | number;
  /** Override the scale ceiling; defaults to max(values). */
  max?: number;
  /** Horizontal padding inside each column, to narrow the bars. Reference used
   *  `clamp(0px, 3.2vw, 46px)` on the 3-bar aim-mix chart. */
  barPad?: string | number;
}> = ({ values, labels, topLabels, highlight, on = 'paper', height, max, barPad, className, style }) => {
  const plate = on === 'plate';
  const ceil = max ?? Math.max(1, ...values);
  return (
    <div
      className={cx('spark', className)}
      data-viz=""
      style={{
        display: 'flex', alignItems: 'flex-end', gap: 'clamp(4px, 1.2vw, 14px)',
        height: height ?? 'clamp(140px, 34vw, 180px)', paddingTop: 12, overflow: 'visible', ...style,
      }}
    >
      {values.map((v, i) => {
        const on_ = highlight === i;
        return (
          <i
            key={i}
            style={{
              flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column',
              justifyContent: 'flex-end', height: '100%', fontStyle: 'normal',
              padding: barPad !== undefined ? `0 ${typeof barPad === 'number' ? `${barPad}px` : barPad}` : undefined,
            }}
          >
            {topLabels && topLabels[i] !== undefined && (
              <u
                data-metric=""
                style={{
                  textDecoration: 'none', display: 'block', textAlign: 'center', marginBottom: 7,
                  fontFamily: SERIF, fontWeight: 700, fontSize: 20, lineHeight: 1,
                  fontVariantNumeric: 'tabular-nums',
                  color: on_ ? (plate ? ACCENT : INK) : plate ? PLATE_SOFT_TEXT : MUTE,
                }}
              >{topLabels[i]}</u>
            )}
            <span
              style={{
                display: 'block', width: '100%', borderRadius: '6px 6px 0 0',
                height: `${Math.max(2, (v / ceil) * 100)}%`,
                background: on_ ? ACCENT : plate ? PLATE_FILL_MUTED : LINE_BOLD,
              }}
            />
            {labels && labels[i] !== undefined && (
              <em
                style={{
                  fontStyle: 'normal', display: 'block', textAlign: 'center', marginTop: 7,
                  fontSize: 11.5, fontWeight: on_ ? 800 : 600, fontVariantNumeric: 'tabular-nums',
                  paddingTop: 6,
                  borderTop: `1px solid ${on_ ? ACCENT : plate ? 'rgba(255,255,255,0.28)' : LINE}`,
                  color: on_ ? (plate ? ACCENT : INK) : plate ? PLATE_SOFT_TEXT : MUTE,
                }}
              >{labels[i]}</em>
            )}
          </i>
        );
      })}
    </div>
  );
};

/**
 * The stacked funnel: big numeral + label + optional delta + proportional bar, joined by
 * dashed connectors. Carries `data-viz`. A step with `blank` renders the honest not-tracked
 * placeholder (em-dash + dashed empty bar) instead of a fabricated zero.
 * @example <Funnel steps={[{value:153,label:'People contacted',pct:100},{value:28,label:'Accepted',pct:18.3,delta:'→ 18% of 153'}]} />
 */
export type FunnelStep = {
  value?: React.ReactNode;
  label: React.ReactNode;
  note?: React.ReactNode;
  delta?: React.ReactNode;
  /** 0-100 bar width. Ignored when `blank`. */
  pct?: number;
  /** Renders the accent fill, for the step that is the story. */
  highlight?: boolean;
  /** Honest blank: em-dash numeral, dashed empty track, "not tracked yet" note. */
  blank?: boolean;
};

export const Funnel: React.FC<Base & { steps: FunnelStep[]; on?: Surface }> = ({
  steps, on = 'plate', className, style,
}) => {
  const plate = on === 'plate';
  return (
    <div className={className} data-viz="" style={style}>
      {steps.map((s, i) => (
        <React.Fragment key={i}>
          {i > 0 && (
            <div style={{
              height: 20, marginLeft: 11,
              borderLeft: `1px dashed ${plate ? PLATE_DASH : LINE_BOLD}`,
            }} />
          )}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
            <span
              className={s.blank ? undefined : 'num cb-num-serif'}
              {...(s.blank ? {} : { 'data-metric': '' })}
              style={{
                fontFamily: SERIF, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                fontSize: 'clamp(30px, 8.4vw, 44px)', lineHeight: 1,
                color: s.blank ? (plate ? '#7F7F78' : MUTE)
                  : s.highlight ? ACCENT
                  : plate ? PLATE_INK : INK,
              }}
            >{s.blank ? '—' : s.value}</span>
            <span style={{
              fontSize: 13.5, fontWeight: 700, lineHeight: 1.35,
              color: s.blank ? (plate ? PLATE_MUTE : MUTE) : plate ? PLATE_SOFT_TEXT : INK,
            }}>
              {s.label}
              {s.note && <> <PlateMute style={{ fontWeight: 600, color: plate ? PLATE_MUTE : MUTE }}>{s.note}</PlateMute></>}
            </span>
            {s.blank
              ? <span style={{ fontSize: 13.5, fontWeight: 700, color: plate ? PLATE_MUTE : MUTE }}>not tracked yet</span>
              : s.delta ? <Delta on={on}>{s.delta}</Delta> : null}
          </div>
          {s.blank ? (
            <div style={{
              marginTop: 9, height: 14, borderRadius: 999,
              border: `1px dashed ${plate ? 'rgba(255,255,255,0.22)' : LINE_BOLD}`,
            }} />
          ) : (
            <div className="bar" style={{
              marginTop: 9, height: 14, borderRadius: 999,
              background: plate ? PLATE_TRACK : SUNK, overflow: 'hidden',
            }}>
              <div className="barfill" style={{
                height: '100%', width: `${Math.max(0, Math.min(100, s.pct ?? 0))}%`,
                minWidth: 14, borderRadius: 999,
                background: s.highlight ? ACCENT : plate ? 'rgba(255,255,255,0.34)' : LINE_BOLD,
              }} />
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

/**
 * The 2-node journey graphic (dot -> dashed line -> arrow -> dashed node), as used in the
 * outreach leads fold. Render it INSIDE a <Plate/>. Carries `data-viz`.
 * @example <JourneyPlate left={{value:9,label:'Replies in play',sub:'as of 31 Jul'}} right={{label:'Calls booked', blank:true}} />
 */
export const JourneyPlate: React.FC<Base & {
  left: { value: React.ReactNode; label: React.ReactNode; sub?: React.ReactNode };
  right: { value?: React.ReactNode; label: React.ReactNode; sub?: React.ReactNode; blank?: boolean };
}> = ({ left, right, className, style }) => (
  <div className={className} style={style}>
    <div data-viz="" style={{ position: 'relative', height: 36 }}>
      <div style={{ position: 'absolute', left: '25%', right: '25%', top: 17, borderTop: `2px dashed rgba(255,255,255,0.38)` }} />
      <div style={{ position: 'absolute', left: 0, width: '25%', top: 17, borderTop: `2px solid ${ACCENT}` }} />
      <div style={{ position: 'absolute', left: '25%', top: 9, width: 20, height: 20, marginLeft: -10, borderRadius: '50%', background: ACCENT }} />
      <div style={{ position: 'absolute', left: '75%', top: 9, width: 20, height: 20, marginLeft: -10, borderRadius: '50%', border: `2px dashed ${PLATE_DASH}` }} />
      <div style={{
        position: 'absolute', left: '52%', top: 13, width: 0, height: 0,
        borderLeft: '9px solid rgba(255,255,255,0.45)',
        borderTop: '5px solid transparent', borderBottom: '5px solid transparent',
      }} />
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginTop: 14, textAlign: 'center' }}>
      <div>
        <Num size="hero" tone="accent">{left.value}</Num>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: PLATE_INK, marginTop: 6, lineHeight: 1.3 }}>{left.label}</div>
        {left.sub && <div style={{ fontSize: 11.5, color: PLATE_MUTE, marginTop: 3, lineHeight: 1.35 }}>{left.sub}</div>}
      </div>
      <div>
        {right.blank
          ? (
            <div style={{ height: 'clamp(34px, 9.4vw, 54px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Blank on="plate" style={{ width: '100%', maxWidth: 82, height: 'clamp(27px, 6.8vw, 38px)' }} />
            </div>
          )
          : <Num size="hero" tone="plate">{right.value}</Num>}
        <div style={{ fontSize: 12.5, fontWeight: 700, color: PLATE_SOFT_TEXT, marginTop: 6, lineHeight: 1.3 }}>{right.label}</div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#B6B6AE', marginTop: 3, lineHeight: 1.35 }}>
          {right.sub ?? (right.blank ? 'not tracked yet' : null)}
        </div>
      </div>
    </div>
  </div>
);

/* ══════════════════════════ LEDGER ══════════════════════════ */

export type LedgerColumn = {
  label?: React.ReactNode;
  align?: 'left' | 'right';
  /** CSS width, e.g. `'1%'` for a shrink-to-fit numeric column. */
  width?: string | number;
  style?: React.CSSProperties;
};

/**
 * The ranked-post ledger. Emits `<table class="tbl">` so numeric cells rendered via
 * <LedgerCell num/> land on the gate's `table.tbl td.n` selector.
 * @example <Ledger columns={[{width:'1%'},{label:'Post'},{label:'Reads · rate',align:'right',width:'1%'}]}>…</Ledger>
 */
export const Ledger: React.FC<Base & { columns?: LedgerColumn[] }> = ({ columns, className, style, children }) => (
  <table
    className={cx('tbl', className)}
    style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14.5, tableLayout: 'auto', ...style }}
  >
    {columns && (
      <thead>
        <tr>
          {columns.map((c, i) => (
            <th
              key={i}
              style={{
                padding: '8px 9px', borderBottom: `1px solid ${LINE}`,
                textAlign: c.align ?? 'left', width: c.width,
                fontSize: 11.5, letterSpacing: '0.09em', textTransform: 'uppercase',
                color: MUTE, fontWeight: 800, ...c.style,
              }}
            >{c.label}</th>
          ))}
        </tr>
      </thead>
    )}
    <tbody>{children}</tbody>
  </table>
);

/** A ledger row. `group` = week subtotal band, `best` = the highlighted winning row. */
export const LedgerRow: React.FC<Base & { tone?: 'default' | 'group' | 'best' }> = ({
  tone = 'default', className, style, children,
}) => (
  <tr
    className={className}
    style={{
      background: tone === 'group' ? SUNK
        : tone === 'best' ? `color-mix(in srgb, ${ACCENT} 9%, ${PAPER})`
        : undefined,
      ...style,
    }}
  >
    {children}
  </tr>
);

/**
 * A ledger cell. `num` puts it on the gate's `td.n` selector AND sets the display face at
 * the row-metric size. Never render a numeric ledger value without it.
 * @example <LedgerCell num align="right" width="1%">1,354</LedgerCell>
 */
export const LedgerCell: React.FC<Base & {
  num?: boolean;
  align?: 'left' | 'right';
  width?: string | number;
  colSpan?: number;
  /** `top` for rows whose middle cell is tall (thumb + chips). */
  valign?: 'top' | 'middle';
}> = ({ num, align = 'left', width, colSpan, valign = 'top', className, style, children }) => (
  <td
    className={cx(num && 'n', className)}
    colSpan={colSpan}
    style={{
      padding: '12px 9px', borderBottom: `1px solid ${LINE}`, textAlign: align,
      verticalAlign: valign, width,
      ...(num ? {
        fontFamily: SERIF, fontWeight: 700, fontSize: 'clamp(20px, 4.4vw, 22px)',
        fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', lineHeight: 1.15,
      } : {}),
      ...style,
    }}
  >
    {children}
  </td>
);

/**
 * The share-of-best inline bar that sits under a ledger row's title. Counts as an encoding.
 * @example <LedgerBar pct={13.8} />
 */
export const LedgerBar: React.FC<Base & { pct: number; tone?: 'muted' | 'strong'; height?: number }> = ({
  pct, tone = 'muted', height, className, style,
}) => (
  <div
    className={cx('bar', className)}
    style={{
      marginTop: 9, height: height ?? (tone === 'strong' ? 16 : 10), borderRadius: 999,
      background: SUNK, overflow: 'hidden', ...style,
    }}
  >
    <div
      className="barfill"
      style={{
        height: '100%', width: `${Math.max(0, Math.min(100, pct))}%`, borderRadius: 999,
        background: tone === 'strong' ? ACCENT : LINE_BOLD,
      }}
    />
  </div>
);

/* ══════════════════════════ DISCLOSURE & DIFF ══════════════════════════ */

/**
 * Collapsed-by-default disclosure. Native <details>, zero JS. Every drill starts closed so
 * the density gate binds on the collapsed state: never rely on drill content to pass a gate.
 * Requires <DeskKitStyle/> on the page for the +/- glyph.
 * @example <Drill label="Open the copy" summaryLeft={<span>Sent today: 20 invites</span>}>…</Drill>
 */
export const Drill: React.FC<Base & {
  /** The `more`-style affordance text. Uppercase micro-label. */
  label?: React.ReactNode;
  /** Optional left-hand summary content, before the affordance. */
  summaryLeft?: React.ReactNode;
  /** Top hairline over the summary. Off when the drill sits inside an already-ruled row. */
  ruled?: boolean;
  summaryStyle?: React.CSSProperties;
  /** 'plate' lightens the summary + body for use on the dark proof plate. */
  on?: Surface;
}> = ({ label = 'more', summaryLeft, ruled = true, summaryStyle, on, className, style, children }) => (
  <details
    className={cx('drill', className)}
    style={{ borderTop: ruled ? `1px solid ${on === 'plate' ? 'rgba(255,255,255,.18)' : LINE}` : undefined, ...style }}
  >
    <summary
      style={{
        listStyle: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
        gap: 8, padding: '9px 0', flexWrap: 'wrap', ...summaryStyle,
      }}
    >
      {summaryLeft && <span style={{ fontSize: 14, fontWeight: 600, color: on === 'plate' ? 'var(--cb-plate-ink, #fff)' : INK_SOFT, flex: '1 1 240px', minWidth: 0 }}>{summaryLeft}</span>}
      <span
        className="more"
        style={{
          fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase',
          color: on === 'plate' ? '#C9C9C2' : MUTE, marginLeft: summaryLeft ? 'auto' : undefined, whiteSpace: 'nowrap',
        }}
      >{label}</span>
    </summary>
    <div className="din" style={{ padding: '10px 0 16px', fontSize: 14, color: on === 'plate' ? '#C9C9C2' : INK_SOFT, lineHeight: 1.5 }}>
      {children}
    </div>
  </details>
);

/**
 * Before/after copy-edit block. Sunk panes, uppercase mini-labels, tinted left rules derived
 * from the ok/down variables (no baked hex).
 * @example <Diff before="Open ChatGPT…" after="Open ChatGPT…" meta={<Delta>+152 characters</Delta>} />
 */
export const Diff: React.FC<Base & {
  before: React.ReactNode;
  after: React.ReactNode;
  beforeLabel?: React.ReactNode;
  afterLabel?: React.ReactNode;
  /** Footer slot, typically the char-delta chip. */
  meta?: React.ReactNode;
}> = ({ before, after, beforeLabel = 'Before', afterLabel = 'After', meta, className, style }) => {
  const pane = (accentVar: string): React.CSSProperties => ({
    background: `color-mix(in srgb, ${accentVar} 8%, ${PAPER})`,
    borderLeft: `3px solid ${accentVar}`,
    borderRadius: '0 12px 12px 0',
    padding: '8px 12px',
    color: `color-mix(in srgb, ${accentVar} 55%, ${INK})`,
    overflowWrap: 'anywhere',
  });
  const lab: React.CSSProperties = {
    display: 'block', fontSize: 11.5, fontWeight: 800, letterSpacing: '0.1em',
    textTransform: 'uppercase', marginBottom: 4,
  };
  return (
    <div className={cx('diff', className)} style={{ display: 'grid', gap: 8, fontSize: 13, lineHeight: 1.5, ...style }}>
      <div className="b4" style={pane(DOWN)}>
        <b style={lab}>{beforeLabel}</b>
        <span style={{ whiteSpace: 'pre-line' }}>{before}</span>
      </div>
      <div className="aft" style={pane(OK)}>
        <b style={lab}>{afterLabel}</b>
        <span style={{ whiteSpace: 'pre-line' }}>{after}</span>
      </div>
      {meta && <div style={{ marginTop: 1 }}>{meta}</div>}
    </div>
  );
};

/* ══════════════════════════ MEDIA ══════════════════════════ */

/**
 * Post cover thumbnail. Width AND maxWidth are pinned in px on purpose: inside a table cell
 * a percentage-width img collapses, which is the exact trap the reference hit.
 * @example <Thumb src={coverUrl} size="lg" />
 */
export const Thumb: React.FC<Base & { src: string; alt?: string; size?: 'sm' | 'lg' }> = ({
  src, alt = '', size = 'sm', className, style,
}) => {
  const px = size === 'lg' ? 74 : 52;
  return (
    <img
      className={cx('thumb', size === 'lg' && 'lg', className)}
      src={src}
      alt={alt}
      loading="lazy"
      onError={(e) => {
        const img = e.currentTarget as HTMLImageElement;
        img.style.opacity = '0';
        // the slot reads as a deliberate drawn ghost, never an empty cell
        img.style.border = '2px dashed var(--cb-line-bold)';
        img.style.background = 'repeating-linear-gradient(45deg, rgba(17,17,17,0.06) 0 4px, rgba(17,17,17,0) 4px 9px)';
        img.style.opacity = '1';
        img.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
      }}
      style={{
        width: px, minWidth: px, maxWidth: px, height: px, flex: 'none',
        borderRadius: size === 'lg' ? 14 : 12, objectFit: 'cover', objectPosition: 'top',
        border: `1px solid ${LINE}`, background: SUNK, display: 'block', ...style,
      }}
    />
  );
};

/**
 * Horizontal strip of 4:5 carousel slides. Scrolls internally, so it never produces page
 * overflow at 390px.
 * @example <SlideStrip srcs={slideUrls.slice(0, 6)} />
 */
export const SlideStrip: React.FC<Base & { srcs: string[]; height?: number; alt?: string }> = ({
  srcs, height = 110, alt = '', className, style,
}) => (
  <div
    className={cx('slides', className)}
    style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '4px 0', scrollbarWidth: 'thin', ...style }}
  >
    {srcs.map((s, i) => (
      <img
        key={i}
        src={s}
        alt={alt}
        loading="lazy"
        style={{
          height, aspectRatio: '4 / 5', objectFit: 'cover', objectPosition: 'top',
          borderRadius: 10, border: `1px solid ${LINE}`, flex: 'none', background: SUNK,
        }}
      />
    ))}
  </div>
);

/* ══════════════════════════ HONEST BLANKS ══════════════════════════ */

/**
 * The honest not-tracked placeholder: a dashed, hatched box carrying an em-dash. Never a
 * fabricated zero, never silence. On paper it uses the shipped `.cb-blank` class; on a plate
 * it drops the class (the desk skin's `.cb-blank` rule is paper-relative) and inlines the
 * plate-relative equivalent.
 * @example <Blank />   @example <Blank on="plate" style={{ maxWidth: 82 }} />
 */
export const Blank: React.FC<Base & { on?: Surface; glyph?: React.ReactNode }> = ({
  on = 'paper', glyph = '—', className, style, children,
}) => {
  const plate = on === 'plate';
  return (
    <div
      className={cx(!plate && 'cb-blank', className)}
      style={{
        border: `2px dashed ${plate ? PLATE_DASH : LINE_BOLD}`,
        background: plate
          ? 'repeating-linear-gradient(45deg, rgba(255,255,255,0.11) 0 4px, rgba(255,255,255,0) 4px 9px)'
          : 'repeating-linear-gradient(45deg, rgba(17,17,17,0.045) 0 4px, rgba(17,17,17,0) 4px 9px)',
        borderRadius: 9, minHeight: 38,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: SERIF, fontWeight: 700, fontSize: 'clamp(15px, 3.6vw, 20px)', lineHeight: 1,
        color: plate ? '#ADADA5' : MUTE,
        ...style,
      }}
    >
      {children ?? glyph}
    </div>
  );
};

/**
 * The stat-slot variant of <Blank/>: dashed box plus the locked "not tracked yet" caption,
 * sized to sit in a footer stat strip next to real <Stat/>s.
 * @example <StatBlank caption="opt-ins, not tracked yet" />
 */
export const StatBlank: React.FC<Base & { caption?: React.ReactNode; on?: Surface }> = ({
  caption = 'not tracked yet', on = 'paper', className, style,
}) => (
  <div className={className} style={style}>
    <Blank on={on} style={{ maxWidth: 96, height: 34, minHeight: 34 }} />
    <div style={{
      fontSize: 12.5, fontWeight: 600, marginTop: 8, lineHeight: 1.35,
      color: on === 'plate' ? PLATE_MUTE : MUTE,
    }}>{caption}</div>
  </div>
);

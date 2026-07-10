import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { prefersReduced } from './editorial';

// ─────────────────────────────────────────────────────────────────────────────
// FivePillarLoop — a calm, self-contained looping showcase of the full engine.
//
// One idea becomes a week of presence across five channels. A left rail lists
// the five pillars; a right-hand stage cross-fades between five code-built
// mini-mockups. The active pillar carries an accent border + a thin progress
// bar that fills over the dwell, then hands off to the next. Auto-advances on a
// single interval; pauses on hover/focus; rows are buttons that jump + restart.
//
// CALM on purpose (Ivan dislikes competing loops): one thing moves at a time —
// the cross-fade OR the progress bar, never a zoo of parallel animation.
// Honours prefers-reduced-motion: no interval, no cross-fade, a static stack.
// Brand source of truth: ~/.claude/memory/global/brand-visual-system.md
// ─────────────────────────────────────────────────────────────────────────────

const R = prefersReduced;
const EASE = [0.22, 0.84, 0.36, 1] as const;
const DWELL_MS = 3200;
const FADE_S = 0.45;

type Pillar = {
  name: string;
  role: string;
  render: () => React.ReactNode;
};

// ── Mini-mockup building blocks ──────────────────────────────────────────────

const FauxLine: React.FC<{ w: number | string; strong?: boolean; dim?: number }> = ({ w, strong, dim }) => (
  <div
    style={{
      height: strong ? 9 : 7,
      width: w,
      maxWidth: '100%',
      borderRadius: 3,
      background: strong ? 'var(--color-ink-mute)' : 'var(--color-hairline-bold)',
      opacity: dim ?? (strong ? 0.55 : 0.7),
    }}
  />
);

const Chip: React.FC<{ children: React.ReactNode; solid?: boolean }> = ({ children, solid }) => (
  <span
    style={{
      fontFamily: '"IBM Plex Mono", monospace',
      fontSize: 9.5,
      fontWeight: 700,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      padding: '3px 7px',
      borderRadius: 5,
      color: solid ? '#fff' : 'var(--color-accent-ink)',
      background: solid ? 'var(--color-accent)' : 'var(--color-accent-soft)',
      whiteSpace: 'nowrap',
      alignSelf: 'flex-start',
    }}
  >
    {children}
  </span>
);

const CardNote: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      fontFamily: '"IBM Plex Mono", monospace',
      fontSize: 11,
      letterSpacing: '0.02em',
      color: 'var(--color-ink-mute)',
    }}
  >
    {children}
  </div>
);

// 1 — Content: a mini LinkedIn post card + a row of 3 carousel-slide thumbnails.
const ContentMock: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
    <div
      style={{
        border: '1px solid var(--color-hairline)',
        borderRadius: 12,
        background: 'var(--color-paper)',
        padding: '14px 16px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
        <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--color-accent-soft)', border: '1px solid var(--color-accent)', flex: 'none' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontFamily: '"Source Serif 4", Georgia, serif', fontWeight: 600, fontSize: 13, color: 'var(--color-ink)' }}>You</span>
            <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 9, color: 'var(--color-ink-mute)', opacity: 0.7 }}>· 1st</span>
          </div>
          <div style={{ height: 5, width: 60, borderRadius: 3, background: 'var(--color-hairline-bold)', opacity: 0.6 }} />
        </div>
      </div>
      <div style={{ fontFamily: '"Source Serif 4", Georgia, serif', fontSize: 15, lineHeight: 1.5, color: 'var(--color-ink)', marginBottom: 8 }}>
        Your traffic is not the problem.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <FauxLine w="92%" />
        <FauxLine w="74%" />
      </div>
    </div>
    <div style={{ display: 'flex', gap: 10 }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            flex: 1,
            aspectRatio: '4 / 5',
            borderRadius: 8,
            background: '#1F1E1C',
            padding: 10,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            gap: 5,
          }}
        >
          <div style={{ height: 6, width: '80%', borderRadius: 3, background: 'rgba(255,255,255,0.28)' }} />
          <div style={{ height: 6, width: '55%', borderRadius: 3, background: 'rgba(255,255,255,0.16)' }} />
        </div>
      ))}
    </div>
  </div>
);

// 2 — Lead magnet: a cover block + interactive chip + one-line role.
const LeadMagnetMock: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
    <div
      style={{
        borderRadius: 12,
        background: 'var(--color-accent-soft)',
        border: '1px solid var(--color-accent)',
        padding: '26px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <Chip>Interactive</Chip>
      <div style={{ fontFamily: '"DM Serif Display", Georgia, serif', fontSize: 26, lineHeight: 1.1, color: 'var(--color-accent-ink)' }}>
        The Readiness Score
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 6,
              borderRadius: 3,
              background: i < 3 ? 'var(--color-accent)' : 'var(--color-accent-ink)',
              opacity: i < 3 ? 0.85 : 0.22,
            }}
          />
        ))}
      </div>
    </div>
    <CardNote>Scores a reader → a named lead.</CardNote>
  </div>
);

// 3 — Newsletter: a mini email with subject + preview + delivery foot.
const NewsletterMock: React.FC = () => (
  <div
    style={{
      border: '1px solid var(--color-hairline)',
      borderRadius: 12,
      background: 'var(--color-paper)',
      overflow: 'hidden',
    }}
  >
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        padding: '12px 16px',
        borderBottom: '1px solid var(--color-hairline)',
        background: 'var(--color-paper-sunk)',
      }}
    >
      <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--color-accent-soft)', border: '1px solid var(--color-accent)', flex: 'none' }} />
      <span style={{ fontFamily: '"Source Serif 4", Georgia, serif', fontSize: 12.5, color: 'var(--color-ink-soft)' }}>
        You · to your list
      </span>
    </div>
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontFamily: '"Source Serif 4", Georgia, serif', fontWeight: 600, fontSize: 15, lineHeight: 1.4, color: 'var(--color-ink)' }}>
        The one metric I check every Monday
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <FauxLine w="96%" />
        <FauxLine w="88%" />
        <FauxLine w="52%" />
      </div>
      <div style={{ borderTop: '1px solid var(--color-hairline)', paddingTop: 12, marginTop: 2 }}>
        <CardNote>Delivered to your whole list</CardNote>
      </div>
    </div>
  </div>
);

// 4 — Follow-ups: a stacked drip sequence with day chips.
const FollowUpMock: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    {[
      { day: 'Day 1', w: '86%' },
      { day: 'Day 3', w: '72%' },
      { day: 'Day 5', w: '64%' },
    ].map((row, i) => (
      <div
        key={row.day}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          border: '1px solid var(--color-hairline)',
          borderLeft: '2px solid var(--color-accent)',
          borderRadius: 10,
          background: 'var(--color-paper)',
          padding: '14px 16px',
          opacity: 1 - i * 0.12,
        }}
      >
        <Chip>{row.day}</Chip>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          <FauxLine w={row.w} strong />
          <FauxLine w="48%" />
        </div>
      </div>
    ))}
    <CardNote>Everyone who grabs the magnet gets the sequence.</CardNote>
  </div>
);

// 5 — Warm outreach: a mini DM thread + reply-detected note.
const WarmOutreachMock: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
        <div
          style={{
            maxWidth: '78%',
            borderRadius: '4px 14px 14px 14px',
            background: 'var(--color-paper-sunk)',
            border: '1px solid var(--color-hairline)',
            padding: '11px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <FauxLine w={120} />
          <FauxLine w={78} />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div
          style={{
            maxWidth: '78%',
            borderRadius: '14px 4px 14px 14px',
            background: 'var(--color-accent-soft)',
            border: '1px solid var(--color-accent)',
            padding: '11px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <FauxLine w={140} dim={0.5} />
          <FauxLine w={96} dim={0.5} />
        </div>
      </div>
    </div>
    <CardNote>Reply detected → draft ready for approval.</CardNote>
  </div>
);

const PILLARS: Pillar[] = [
  { name: 'Content', role: 'LinkedIn posts and carousels, drafted in your voice', render: () => <ContentMock /> },
  { name: 'Lead magnet', role: 'An interactive asset that turns readers into named leads', render: () => <LeadMagnetMock /> },
  { name: 'Newsletter', role: 'Your list hears from you, in your voice', render: () => <NewsletterMock /> },
  { name: 'Follow-ups', role: 'Everyone who grabs the magnet gets a sequence', render: () => <FollowUpMock /> },
  { name: 'Warm outreach', role: 'Reactions to your posts become conversations', render: () => <WarmOutreachMock /> },
];

// ── Rail row ─────────────────────────────────────────────────────────────────

const RailRow: React.FC<{
  pillar: Pillar;
  index: number;
  active: boolean;
  paused: boolean;
  onSelect: () => void;
}> = ({ pillar, index, active, paused, onSelect }) => (
  <button
    type="button"
    onClick={onSelect}
    aria-label={`Show pillar ${index + 1}: ${pillar.name}`}
    aria-current={active ? 'true' : undefined}
    style={{
      position: 'relative',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 16,
      width: '100%',
      textAlign: 'left',
      padding: '16px 18px',
      borderRadius: 12,
      borderLeft: `2px solid ${active ? 'var(--color-accent)' : 'transparent'}`,
      background: active ? 'var(--color-paper-raise)' : 'transparent',
      opacity: active ? 1 : 0.45,
      cursor: 'pointer',
      transition: 'opacity .35s ease, background .35s ease',
      overflow: 'hidden',
    }}
  >
    <span
      style={{
        fontFamily: '"DM Serif Display", Georgia, serif',
        fontStyle: 'italic',
        fontSize: 30,
        lineHeight: 1,
        color: 'var(--color-accent-ink)',
        flex: 'none',
        width: 26,
      }}
    >
      {index + 1}
    </span>
    <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <span
        style={{
          fontFamily: '"Source Serif 4", Georgia, serif',
          fontWeight: 600,
          fontSize: 17,
          lineHeight: 1.2,
          color: active ? 'var(--color-ink)' : 'var(--color-ink-soft)',
        }}
      >
        {pillar.name}
      </span>
      <span style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--color-ink-mute)' }}>{pillar.role}</span>
    </span>
    {/* Progress bar — fills over the dwell under the active row only. */}
    {active && !R && (
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          height: 2,
          width: '100%',
          background: 'var(--color-hairline)',
        }}
      >
        <motion.span
          key={`${index}-${paused}`}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: paused ? 0 : 1 }}
          transition={{ duration: paused ? 0 : DWELL_MS / 1000, ease: 'linear' }}
          style={{
            display: 'block',
            height: '100%',
            width: '100%',
            transformOrigin: 'left',
            background: 'var(--color-accent)',
          }}
        />
      </span>
    )}
  </button>
);

// ── Main component ───────────────────────────────────────────────────────────

export const FivePillarLoop: React.FC = () => {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (R || paused) return;
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % PILLARS.length);
    }, DWELL_MS);
    return () => window.clearInterval(id);
  }, [paused, active]);

  // ── Reduced motion: static, complete, intentional ──────────────────────────
  if (R) {
    return (
      <div style={{ display: 'grid', gap: 20, gridTemplateColumns: '1fr' }}>
        {PILLARS.map((p, i) => (
          <div
            key={p.name}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
              border: '1px solid var(--color-hairline-bold)',
              borderRadius: 16,
              background: 'var(--color-paper-raise)',
              padding: '22px 24px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
              <span
                style={{
                  fontFamily: '"DM Serif Display", Georgia, serif',
                  fontStyle: 'italic',
                  fontSize: 30,
                  lineHeight: 1,
                  color: 'var(--color-accent-ink)',
                  width: 26,
                  flex: 'none',
                }}
              >
                {i + 1}
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontFamily: '"Source Serif 4", Georgia, serif', fontWeight: 600, fontSize: 17, color: 'var(--color-ink)' }}>{p.name}</span>
                <span style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--color-ink-mute)' }}>{p.role}</span>
              </span>
            </div>
            <div>{p.render()}</div>
          </div>
        ))}
      </div>
    );
  }

  const pauseOn = () => setPaused(true);
  const pauseOff = () => setPaused(false);

  return (
    <div
      className="fpl-stage"
      onMouseEnter={pauseOn}
      onMouseLeave={pauseOff}
      onFocusCapture={pauseOn}
      onBlurCapture={pauseOff}
      style={{ display: 'grid', gap: 28, alignItems: 'start' }}
    >
      <style>{CSS}</style>

      {/* LEFT — pillar rail */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {PILLARS.map((p, i) => (
          <RailRow
            key={p.name}
            pillar={p}
            index={i}
            active={i === active}
            paused={paused}
            onSelect={() => setActive(i)}
          />
        ))}
      </div>

      {/* RIGHT — cross-fading stage */}
      <div
        style={{
          position: 'relative',
          minHeight: 340,
          background: 'var(--color-paper-raise)',
          border: '1px solid var(--color-hairline-bold)',
          borderRadius: 18,
          boxShadow: '0 20px 60px -28px rgba(0,0,0,0.28)',
          padding: '28px 30px',
          display: 'grid',
          alignItems: 'center',
          justifyItems: 'stretch',
        }}
      >
        {/* Grid-stack cross-fade: exiting + entering mockups share one cell so they
            overlap (no blank gap between pillars), and the card auto-heights to content. */}
        <AnimatePresence initial={false}>
          <motion.div
            key={active}
            style={{ gridArea: '1 / 1', width: '100%' }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: FADE_S, ease: EASE }}
          >
            {PILLARS[active].render()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

const CSS = `
.fpl-stage{grid-template-columns:1fr}
@media(min-width:768px){
  .fpl-stage{grid-template-columns:minmax(0,0.9fr) minmax(0,1.1fr)}
}
`;

export default FivePillarLoop;

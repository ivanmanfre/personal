import React from 'react';
import HeroA from './HeroA';
import HeroB from './HeroB';
import HeroC from './HeroC';
import HeroD from './HeroD';
import HeroE from './HeroE';
import HeroF from './HeroF';
import HeroG from './HeroG';
import HeroH from './HeroH';
import HeroI from './HeroI';
import HeroJ from './HeroJ';
import HeroK from './HeroK';
import HeroK2 from './HeroK2';
import HeroK3 from './HeroK3';

type Variant = {
  id: string;
  label: string;
  blurb: string;
  Component: React.FC;
  hasMotion: boolean;
};

const VARIANTS: Variant[] = [
  {
    id: 'A',
    label: 'A — NEUREL clone',
    blurb: 'Dark + neon-mint · Newsreader serif italic on pivot · terminal HUD chrome · stat strip. Direct port of the screenshot reference.',
    Component: HeroA,
    hasMotion: false,
  },
  {
    id: 'B',
    label: 'B — Current brand, readable body',
    blurb: 'Same paper + sage + Grotesk display headline. Body swapped to Inter 400 / line-height 1.65. Smallest possible change.',
    Component: HeroB,
    hasMotion: false,
  },
  {
    id: 'C',
    label: 'C — Editorial serif (Instrument Serif)',
    blurb: 'Paper + Instrument Serif headline + Source Serif 4 body. Closest free analog to NEUREL\'s PP Editorial New.',
    Component: HeroC,
    hasMotion: false,
  },
  {
    id: 'D',
    label: 'D — Anti-Anthropic reset',
    blurb: 'Pure white #FFFFFF · Inter only · single black accent. Deliberate distance from Claude\'s palette.',
    Component: HeroD,
    hasMotion: false,
  },
  {
    id: 'E',
    label: 'E — Magazine cover profile',
    blurb: 'Half-bleed huge portrait runs full to right edge. Italic Instrument Serif tight to left. Sage-rule pull-quote. New Yorker / Time profile feel.',
    Component: HeroE,
    hasMotion: false,
  },
  {
    id: 'F',
    label: 'F — Stripe Press monograph',
    blurb: 'No portrait in hero. Massive italic headline + dense lede + 4 preconditions as numbered manifesto entries. Authority through restraint.',
    Component: HeroF,
    hasMotion: false,
  },
  {
    id: 'G',
    label: 'G — Operator\'s notebook',
    blurb: 'Marginalia layout. Sage-italic callouts on "scale" and "doesn\'t". Polaroid-clip portrait at -1.5°. Reads like a working draft.',
    Component: HeroG,
    hasMotion: false,
  },
  {
    id: 'H',
    label: 'H — Cinematic kinetic reveal ✦',
    blurb: 'Multi-stage choreography: tag → headline word-by-word with blur → italic pivot lands LAST with rotateX entrance + sage sweep underline → sub-copy clip-mask types in → CTAs lift. Portrait does entrance scale + scroll parallax.',
    Component: HeroH,
    hasMotion: true,
  },
  {
    id: 'I',
    label: 'I — Letter-fly assembly + cursor spotlight ✦',
    blurb: 'Each letter starts scattered across the viewport with random rotation, then flies into place in a staggered cascade. Italic pivot assembles last. Sage spotlight follows your cursor.',
    Component: HeroI,
    hasMotion: true,
  },
  {
    id: 'J',
    label: 'J — Cursor-reactive flow field ✦',
    blurb: 'Canvas particle field — sage particles flock toward your cursor. Magnetic CTAs pull toward the pointer. Portrait tilts in 3D based on mouse position. The page has a heartbeat.',
    Component: HeroJ,
    hasMotion: true,
  },
  {
    id: 'K',
    label: 'K — Live operations dashboard ✦',
    blurb: 'Editorial typography meets Bloomberg-warm telemetry. Numbers count up via spring odometer. Live status dot. Q3 capacity bar fills. 8-week deployment chart bars in. Reads as: "real systems running NOW."',
    Component: HeroK,
    hasMotion: true,
  },
  {
    id: 'K2',
    label: 'K2 — Qualification right-rail ✦',
    blurb: 'Same K motion thesis, but the right-rail answers BUYER questions instead of showing telemetry: "Is this for me?" (vertical list), "What\'s my risk?" (italic guarantee), "Can I book?" (single real capacity bar). All decorative stats removed.',
    Component: HeroK2,
    hasMotion: true,
  },
  {
    id: 'K3',
    label: 'K3 — Precondition qualifier ✦',
    blurb: 'Same 3-col layout as K2 (portrait + copy + rail) but the right-rail swaps industry verticals for the 4 Agent-Ready preconditions. Qualifies by behaviour, not by SIC code — any service business that fits self-selects in; any that doesn\'t self-selects out.',
    Component: HeroK3,
    hasMotion: true,
  },
];

const HeroComparePage: React.FC = () => {
  const [active, setActive] = React.useState<string>('A');
  const [replayKeys, setReplayKeys] = React.useState<Record<string, number>>(
    Object.fromEntries(VARIANTS.map((v) => [v.id, 0]))
  );

  const replay = (id: string) => {
    setReplayKeys((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  };

  React.useEffect(() => {
    document.title = 'Hero variants — comparison';
  }, []);

  return (
    <div className="bg-paper">
      {/* Sticky toggle bar */}
      <div
        className="sticky top-0 z-50 backdrop-blur-md border-b"
        style={{
          backgroundColor: 'rgba(247,244,239,0.92)',
          borderColor: 'rgba(0,0,0,0.08)',
        }}
      >
        <div className="container mx-auto px-6 py-3 flex items-center gap-2 overflow-x-auto">
          <span
            className="text-[11px] uppercase tracking-[0.2em] shrink-0 mr-2"
            style={{ fontFamily: '"IBM Plex Mono", monospace', color: '#737373' }}
          >
            Hero compare ·
          </span>
          {VARIANTS.map((v) => (
            <button
              key={v.id}
              onClick={() => {
                setActive(v.id);
                document
                  .getElementById(`variant-${v.id}`)
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className="px-3 py-1.5 text-sm rounded transition-colors shrink-0 relative"
              style={{
                backgroundColor: active === v.id ? '#1A1A1A' : 'transparent',
                color: active === v.id ? '#F7F4EF' : '#1A1A1A',
                border: '1px solid #1A1A1A',
                fontWeight: 500,
              }}
            >
              {v.id}
              {v.hasMotion && (
                <span
                  className="absolute -top-1 -right-1"
                  style={{ color: '#2A8F65', fontSize: '8px' }}
                >
                  ●
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {VARIANTS.map(({ id, label, blurb, Component, hasMotion }) => (
        <div key={id} id={`variant-${id}`}>
          <div
            className="border-b px-8 py-6 flex items-start justify-between gap-6"
            style={{ backgroundColor: '#1A1A1A', color: '#F7F4EF', borderColor: '#000' }}
          >
            <div className="container mx-auto max-w-5xl flex items-start justify-between gap-6">
              <div>
                <div
                  className="text-[10px] uppercase tracking-[0.25em] mb-2"
                  style={{
                    fontFamily: '"IBM Plex Mono", monospace',
                    color: 'rgba(247,244,239,0.5)',
                  }}
                >
                  Variant
                </div>
                <h2
                  className="text-2xl mb-2"
                  style={{
                    fontFamily: '"Instrument Serif", serif',
                    fontStyle: 'italic',
                    fontWeight: 400,
                  }}
                >
                  {label}
                </h2>
                <p
                  className="text-sm max-w-3xl"
                  style={{ color: 'rgba(247,244,239,0.7)' }}
                >
                  {blurb}
                </p>
              </div>
              {hasMotion && (
                <button
                  onClick={() => replay(id)}
                  className="shrink-0 inline-flex items-center gap-2 px-4 py-2 transition-colors hover:bg-white/10"
                  style={{
                    border: '1px solid rgba(247,244,239,0.3)',
                    color: '#F7F4EF',
                    fontFamily: '"IBM Plex Mono", monospace',
                    fontSize: '11px',
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                  }}
                >
                  ↻ Replay
                </button>
              )}
            </div>
          </div>
          <div key={`${id}-${replayKeys[id]}`}>
            <Component />
          </div>
        </div>
      ))}
    </div>
  );
};

export default HeroComparePage;

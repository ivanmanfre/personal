import React from 'react';
import { ArrowRight } from 'lucide-react';

// Variant G — Operator's notebook.
// Annotated/marginalia treatment. Italic headline + small editor's notes pointing
// to numbers/terms in the headline (callouts with sage hand-drawn rules). Portrait
// rendered as small polaroid-style figure clipped into asymmetric grid. Makes the
// reader feel: "this is a working operator's draft, not a polished marketing site."
const HeroG: React.FC = () => {
  return (
    <section className="relative min-h-screen pt-24 pb-12 flex flex-col justify-center bg-paper overflow-hidden">
      {/* Subtle ruled-paper feel — horizontal hairlines */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(to bottom, transparent 31px, rgba(26,26,26,0.04) 32px)',
          backgroundSize: '32px 32px',
        }}
      />

      <div className="container mx-auto px-8 max-w-6xl relative z-10">
        <div className="grid lg:grid-cols-[1fr_280px] gap-12 items-start">
          <div>
            {/* Margin note */}
            <div
              className="mb-8 flex items-center gap-3"
              style={{
                fontFamily: '"Source Serif 4", Georgia, serif',
                fontStyle: 'italic',
                fontSize: '14px',
                color: 'rgba(26,26,26,0.55)',
              }}
            >
              <span style={{ color: '#2A8F65' }}>—</span>
              From Ivan's notebook · entry 047 · 2026.05.06
            </div>

            <h1
              className="mb-2 relative"
              style={{
                fontFamily: '"Instrument Serif", serif',
                fontWeight: 400,
                fontSize: 'clamp(3.5rem, 8.5vw, 7.5rem)',
                lineHeight: 0.96,
                letterSpacing: '-0.015em',
                color: '#1A1A1A',
              }}
            >
              Systems{' '}
              <span style={{ position: 'relative', display: 'inline-block' }}>
                scale
                <span
                  className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap"
                  style={{
                    fontFamily: '"Source Serif 4", serif',
                    fontStyle: 'italic',
                    fontSize: '14px',
                    color: '#2A8F65',
                    fontWeight: 400,
                  }}
                >
                  ↳ compounding ROI
                </span>
              </span>
              .
              <br />
              Headcount{' '}
              <span style={{ fontStyle: 'italic', position: 'relative', display: 'inline-block' }}>
                doesn't
                <span
                  className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap"
                  style={{
                    fontFamily: '"Source Serif 4", serif',
                    fontStyle: 'italic',
                    fontSize: '14px',
                    color: '#2A8F65',
                    fontWeight: 400,
                  }}
                >
                  ↳ linear cost, ceiling
                </span>
              </span>
              .
            </h1>

            <p
              className="mt-16 mb-10 max-w-xl"
              style={{
                fontFamily: '"Source Serif 4", Georgia, serif',
                fontWeight: 400,
                fontSize: '18px',
                lineHeight: 1.6,
                color: '#3D3D3B',
              }}
            >
              I diagnose where AI actually moves the needle in your business, then implement
              alongside the team you already trust. Ninety-day payback, or I don't build it.
            </p>

            <div className="flex flex-col sm:flex-row items-start gap-3">
              <a
                href="/assessment"
                className="btn-magnetic inline-flex items-center gap-2.5 px-7 py-3.5 bg-accent text-white"
                style={{ fontFamily: '"Source Serif 4", serif', fontWeight: 600, fontSize: '16px' }}
              >
                Build your Blueprint <ArrowRight size={18} />
              </a>
              <a
                href="/scorecard"
                className="inline-flex items-center gap-2 px-7 py-3.5 text-ink-mute hover:text-black"
                style={{
                  fontFamily: '"Source Serif 4", serif',
                  fontWeight: 600,
                  fontSize: '16px',
                  fontStyle: 'italic',
                }}
              >
                Are you Agent-Ready? <ArrowRight size={16} />
              </a>
            </div>
          </div>

          {/* Right column — polaroid portrait + handwritten caption */}
          <div className="hidden lg:block pt-4">
            <div className="relative" style={{ transform: 'rotate(-1.5deg)' }}>
              <div
                className="p-3 pb-12"
                style={{
                  backgroundColor: '#FBF9F4',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.06)',
                }}
              >
                <img
                  src="/ivan-hero.jpeg"
                  alt="Iván Manfredi"
                  className="w-full aspect-square object-cover object-top"
                  style={{ filter: 'grayscale(0.15) contrast(1.05)' }}
                />
                <div
                  className="absolute bottom-3 left-3 right-3 text-center"
                  style={{
                    fontFamily: '"Source Serif 4", Georgia, serif',
                    fontStyle: 'italic',
                    fontSize: '14px',
                    color: '#1A1A1A',
                  }}
                >
                  Manfredi, 2026
                </div>
              </div>
            </div>

            {/* Stat scribble below portrait */}
            <div
              className="mt-10 pl-4"
              style={{
                borderLeft: '2px solid #2A8F65',
                fontFamily: '"Source Serif 4", serif',
                fontStyle: 'italic',
                fontSize: '14px',
                color: '#1A1A1A',
                lineHeight: 1.5,
              }}
            >
              47 systems shipped.
              <br />
              $240M unlocked.
              <br />
              0 layoffs caused.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroG;

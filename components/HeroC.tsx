import React from 'react';
import { ArrowRight } from 'lucide-react';

// Variant C — Full editorial swap. Paper kept (still warm), but typography moves
// from grotesk display to Fraunces serif headline + Source Serif 4 body.
// Real magazine register, no grotesk anywhere. Tests "is editorial actually about
// SERIF discipline, not cream cosplay?"
const HeroC: React.FC = () => {
  return (
    <section className="relative min-h-screen pt-28 pb-12 flex flex-col justify-center bg-paper overflow-hidden">
      <div className="absolute inset-0 bg-grid-pattern hidden sm:block opacity-[0.06] pointer-events-none z-0" />

      <div className="container mx-auto px-6 relative z-10">
        <div className="flex flex-col lg:flex-row items-start gap-10 max-w-5xl mx-auto">
          <div className="flex-1 min-w-0">
            <div
              className="mb-6 text-[11px] uppercase tracking-[0.22em]"
              style={{
                fontFamily: '"IBM Plex Mono", monospace',
                color: 'rgba(26,26,26,0.55)',
              }}
            >
              — 01 / Manfredi // Agent-Ready Ops
            </div>

            {/* Headline — Fraunces, weight 600, italic on pivot */}
            <h1
              className="mb-10"
              style={{
                fontFamily: '"Instrument Serif", "Fraunces", serif',
                fontWeight: 400,
                fontSize: 'clamp(3.5rem, 8.5vw, 7rem)',
                lineHeight: 0.96,
                letterSpacing: '-0.015em',
                color: '#1A1A1A',
              }}
            >
              Systems scale.
              <br />
              Headcount{' '}
              <span style={{ fontStyle: 'italic', fontWeight: 400 }}>doesn't.</span>
            </h1>

            <p
              className="max-w-xl mb-10"
              style={{
                fontFamily: '"Source Serif 4", Georgia, serif',
                fontWeight: 400,
                fontSize: '19px',
                lineHeight: 1.6,
                color: '#3D3D3B',
              }}
            >
              I diagnose where AI actually moves the needle in your business — then implement
              it alongside the team you already trust. No outsourcing. No replacement-theater.
              Just leverage.
            </p>

            <div className="flex flex-col sm:flex-row items-start gap-3">
              <a
                href="/assessment"
                className="btn-magnetic w-full sm:w-auto px-7 py-3.5 bg-accent border-subtle-thick shadow-card-subtle flex items-center justify-center gap-2.5 text-white"
                style={{
                  fontFamily: '"Source Serif 4", Georgia, serif',
                  fontWeight: 600,
                  fontSize: '16px',
                }}
              >
                Build your Blueprint <ArrowRight size={18} />
              </a>
              <a
                href="/scorecard"
                className="w-full sm:w-auto px-7 py-3.5 text-ink-mute hover:text-black transition-colors flex items-center justify-center gap-2"
                style={{
                  fontFamily: '"Source Serif 4", Georgia, serif',
                  fontWeight: 600,
                  fontSize: '16px',
                  fontStyle: 'italic',
                }}
              >
                Are you Agent-Ready? <ArrowRight size={16} />
              </a>
            </div>
          </div>

          <div className="hidden lg:block shrink-0 pt-8">
            <picture>
              <source
                type="image/webp"
                srcSet="/ivan-hero-800.webp 800w, /ivan-hero-1200.webp 1200w"
                sizes="(min-width: 1280px) 320px, 288px"
              />
              <img
                src="/ivan-hero.jpeg"
                alt="Iván Manfredi"
                width="1200"
                height="1600"
                className="w-72 xl:w-80 aspect-[3/4] rounded-xl ring-1 ring-white/10 shadow-card-lift object-cover object-top portrait-editorial"
              />
            </picture>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroC;

import React from 'react';
import { ArrowRight } from 'lucide-react';

// Variant E — Magazine cover profile.
// Half-bleed huge portrait on right, italic Instrument Serif headline tight against
// left edge, mono byline strip on top, pull-quote rule. The reader feels like
// they've opened a Time/New Yorker profile of a single operator.
const HeroE: React.FC = () => {
  return (
    <section className="relative min-h-screen flex flex-col bg-paper overflow-hidden">
      {/* Top byline strip */}
      <div
        className="border-b px-8 py-4 flex justify-between items-center"
        style={{
          fontFamily: '"IBM Plex Mono", monospace',
          fontSize: '11px',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'rgba(26,26,26,0.55)',
          borderColor: 'rgba(26,26,26,0.12)',
        }}
      >
        <div>Issue 047 · Operator Profile</div>
        <div>
          <span style={{ color: '#2A8F65' }}>●</span> Taking new clients · Q3 2026
        </div>
      </div>

      <div className="flex-1 grid lg:grid-cols-[1.1fr_0.9fr] min-h-0">
        {/* Left — copy column */}
        <div className="flex flex-col justify-center px-8 lg:px-16 py-16">
          <div
            className="mb-8"
            style={{
              fontFamily: '"IBM Plex Mono", monospace',
              fontSize: '11px',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: 'rgba(26,26,26,0.55)',
            }}
          >
            <span style={{ color: '#2A8F65' }}>●</span>  Iván Manfredi · Founder, Agent-Ready Ops
          </div>

          <h1
            className="mb-10"
            style={{
              fontFamily: '"Instrument Serif", serif',
              fontWeight: 400,
              fontSize: 'clamp(4rem, 9vw, 8rem)',
              lineHeight: 0.92,
              letterSpacing: '-0.02em',
              color: '#1A1A1A',
            }}
          >
            Systems scale.
            <br />
            <span style={{ fontStyle: 'italic' }}>Headcount doesn't.</span>
          </h1>

          {/* Pull-quote with sage left rule */}
          <div className="mb-10 pl-5" style={{ borderLeft: '2px solid #2A8F65' }}>
            <p
              style={{
                fontFamily: '"Source Serif 4", Georgia, serif',
                fontWeight: 400,
                fontSize: '20px',
                lineHeight: 1.5,
                color: '#1A1A1A',
                fontStyle: 'italic',
              }}
            >
              "I diagnose where AI actually moves the needle in your business — then implement
              it alongside the team you already trust."
            </p>
            <p
              className="mt-3"
              style={{
                fontFamily: '"IBM Plex Mono", monospace',
                fontSize: '11px',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'rgba(26,26,26,0.55)',
              }}
            >
              — Manfredi, on his Agent-Ready methodology
            </p>
          </div>

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

        {/* Right — half-bleed portrait, runs to edge */}
        <div className="relative hidden lg:block" style={{ backgroundColor: '#1A1A1A' }}>
          <picture>
            <source
              type="image/webp"
              srcSet="/ivan-hero-1200.webp"
              sizes="50vw"
            />
            <img
              src="/ivan-hero.jpeg"
              alt="Iván Manfredi"
              className="absolute inset-0 w-full h-full object-cover object-top"
            />
          </picture>
          {/* Subtle grain on portrait */}
          <div
            className="absolute inset-0 mix-blend-overlay opacity-30 pointer-events-none"
            style={{
              backgroundImage:
                'url("data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.85%22/></filter><rect width=%22200%22 height=%22200%22 filter=%22url(%23n)%22 opacity=%220.4%22/></svg>")',
            }}
          />
          {/* Caption strip bottom-right */}
          <div
            className="absolute bottom-0 left-0 right-0 px-8 py-4 backdrop-blur-sm"
            style={{
              backgroundColor: 'rgba(26,26,26,0.7)',
              color: 'rgba(247,244,239,0.8)',
              fontFamily: '"IBM Plex Mono", monospace',
              fontSize: '11px',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
            }}
          >
            Manfredi, photographed in Buenos Aires · 2026
          </div>
        </div>

        {/* Mobile portrait — small, top */}
        <div className="lg:hidden px-8 mb-8">
          <img
            src="/ivan-hero.jpeg"
            alt="Iván Manfredi"
            className="w-40 aspect-[3/4] object-cover object-top"
          />
        </div>
      </div>
    </section>
  );
};

export default HeroE;

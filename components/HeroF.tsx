import React from 'react';
import { ArrowRight } from 'lucide-react';

// Variant F — Stripe Press monograph.
// No portrait. Authority through restraint. Massive italic Instrument Serif
// headline, dense Source Serif body, the 4 Agent-Ready preconditions rendered
// as numbered manifesto entries. Reader feels: "this person is a serious thinker."
const PRECONDITIONS = [
  { n: '01', label: 'Reliable input pipeline' },
  { n: '02', label: 'Documentable decision logic' },
  { n: '03', label: 'Narrow initial scope' },
  { n: '04', label: 'Human-in-the-loop by design' },
];

const HeroF: React.FC = () => {
  return (
    <section className="relative min-h-screen pt-24 pb-12 flex flex-col justify-center bg-paper overflow-hidden">
      <div className="container mx-auto px-8 max-w-4xl">
        {/* Tiny imprint mark */}
        <div
          className="mb-12 flex items-center justify-between"
          style={{
            fontFamily: '"IBM Plex Mono", monospace',
            fontSize: '10px',
            letterSpacing: '0.25em',
            textTransform: 'uppercase',
            color: 'rgba(26,26,26,0.5)',
          }}
        >
          <span>Manfredi · Volume 01</span>
          <span>Agent-Ready Ops™</span>
        </div>

        {/* Headline */}
        <h1
          className="mb-12"
          style={{
            fontFamily: '"Instrument Serif", serif',
            fontWeight: 400,
            fontSize: 'clamp(4rem, 10vw, 9rem)',
            lineHeight: 0.95,
            letterSpacing: '-0.02em',
            color: '#1A1A1A',
          }}
        >
          Systems scale.
          <br />
          <span style={{ fontStyle: 'italic' }}>Headcount doesn't.</span>
        </h1>

        {/* Lede — dense magazine paragraph */}
        <p
          className="mb-16 max-w-2xl"
          style={{
            fontFamily: '"Source Serif 4", Georgia, serif',
            fontWeight: 400,
            fontSize: '20px',
            lineHeight: 1.55,
            color: '#1A1A1A',
          }}
        >
          Every AI project that ships meets four preconditions. The ones that don't, fail
          predictably — usually six weeks in, after a lot of money has been spent. I diagnose
          which precondition you're missing, then build the system that addresses it.{' '}
          <span style={{ fontStyle: 'italic', color: '#2A8F65' }}>
            Ninety-day payback, or I don't build it.
          </span>
        </p>

        {/* Preconditions list — Stripe-Press style numbered entries */}
        <div className="mb-16 grid md:grid-cols-2 gap-x-12 gap-y-6">
          {PRECONDITIONS.map(({ n, label }) => (
            <div key={n} className="flex items-baseline gap-5">
              <span
                style={{
                  fontFamily: '"Instrument Serif", serif',
                  fontStyle: 'italic',
                  fontSize: '32px',
                  lineHeight: 1,
                  color: '#2A8F65',
                  fontWeight: 400,
                }}
              >
                {n}
              </span>
              <span
                style={{
                  fontFamily: '"Source Serif 4", Georgia, serif',
                  fontWeight: 500,
                  fontSize: '18px',
                  color: '#1A1A1A',
                  letterSpacing: '-0.005em',
                }}
              >
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* CTAs — minimal, restrained */}
        <div className="flex flex-col sm:flex-row items-start gap-6">
          <a
            href="/assessment"
            className="inline-flex items-center gap-2 group"
            style={{
              fontFamily: '"Instrument Serif", serif',
              fontStyle: 'italic',
              fontSize: '24px',
              color: '#1A1A1A',
              borderBottom: '1px solid #1A1A1A',
              paddingBottom: '4px',
            }}
          >
            Build your Blueprint{' '}
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </a>
          <a
            href="/scorecard"
            className="inline-flex items-center gap-2"
            style={{
              fontFamily: '"Source Serif 4", Georgia, serif',
              fontWeight: 500,
              fontSize: '16px',
              color: 'rgba(26,26,26,0.65)',
              fontStyle: 'italic',
            }}
          >
            Are you Agent-Ready? <ArrowRight size={14} />
          </a>
        </div>
      </div>

      {/* Tiny portrait as figure — bottom right corner only */}
      <div
        className="absolute bottom-8 right-8 hidden lg:flex items-center gap-3"
        style={{
          fontFamily: '"IBM Plex Mono", monospace',
          fontSize: '10px',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'rgba(26,26,26,0.55)',
        }}
      >
        <img
          src="/ivan-hero.jpeg"
          alt="Iván Manfredi"
          className="w-12 h-12 object-cover object-top"
          style={{ borderRadius: '0' }}
        />
        <div className="flex flex-col">
          <span style={{ color: '#1A1A1A' }}>Iván Manfredi</span>
          <span>Founder · Agent-Ready Ops</span>
        </div>
      </div>
    </section>
  );
};

export default HeroF;

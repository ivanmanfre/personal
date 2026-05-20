import React from 'react';
import { ArrowRight } from 'lucide-react';

// Variant D — Anti-Anthropic reset. Drops the cream entirely (#FFFFFF, not #F7F4EF).
// Inter for everything. Single black accent, no sage, no italic serif drama.
// Tests "what does the site look like if we deliberately STOP overlapping with
// Anthropic's brand vocabulary?"
const HeroD: React.FC = () => {
  return (
    <section
      className="relative min-h-screen pt-28 pb-12 flex flex-col justify-center overflow-hidden"
      style={{
        backgroundColor: '#FFFFFF',
        fontFamily: 'Inter, system-ui, sans-serif',
        color: '#0A0A0A',
      }}
    >
      <div className="container mx-auto px-6 relative z-10">
        <div className="flex flex-col lg:flex-row items-start gap-12 max-w-5xl mx-auto">
          <div className="flex-1 min-w-0">
            {/* Tag — minimal, no pill */}
            <div className="mb-6 flex items-center gap-3">
              <span
                style={{
                  display: 'inline-block',
                  width: '6px',
                  height: '6px',
                  backgroundColor: '#0A0A0A',
                }}
              />
              <span
                style={{
                  fontSize: '12px',
                  letterSpacing: '0.04em',
                  color: '#525252',
                  fontWeight: 500,
                }}
              >
                Agent-Ready Ops™ · Founder, Iván Manfredi
              </span>
            </div>

            {/* Headline — Inter 700, no serif drama, just confidence */}
            <h1
              className="mb-8"
              style={{
                fontFamily: 'Inter, system-ui, sans-serif',
                fontWeight: 700,
                fontSize: 'clamp(3rem, 7vw, 5.5rem)',
                lineHeight: 1.02,
                letterSpacing: '-0.035em',
              }}
            >
              Systems scale.
              <br />
              Headcount doesn't.
            </h1>

            <p
              className="max-w-xl mb-10"
              style={{
                fontWeight: 400,
                fontSize: '19px',
                lineHeight: 1.6,
                color: '#525252',
              }}
            >
              I diagnose where AI actually moves the needle in your business, then implement it
              alongside the team you already trust. No outsourcing. No replacement-theater.
              Just leverage.
            </p>

            <div className="flex flex-col sm:flex-row items-start gap-4">
              <a
                href="/assessment"
                className="inline-flex items-center gap-2 px-6 py-3.5"
                style={{
                  backgroundColor: '#0A0A0A',
                  color: '#FFFFFF',
                  fontWeight: 600,
                  fontSize: '15px',
                  borderRadius: '4px',
                }}
              >
                Build your Blueprint <ArrowRight size={16} />
              </a>
              <a
                href="/scorecard"
                className="inline-flex items-center gap-2 px-6 py-3.5"
                style={{
                  color: '#0A0A0A',
                  fontWeight: 600,
                  fontSize: '15px',
                  borderBottom: '1px solid #0A0A0A',
                  borderRadius: 0,
                  paddingLeft: 0,
                  paddingRight: 0,
                }}
              >
                Are you Agent-Ready? <ArrowRight size={14} />
              </a>
            </div>

            {/* Tiny stat row — no flourish */}
            <div className="mt-16 flex gap-12 max-w-md">
              <div>
                <div style={{ fontWeight: 600, fontSize: '24px' }}>47</div>
                <div style={{ fontSize: '12px', color: '#737373', marginTop: '2px' }}>
                  Systems shipped
                </div>
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '24px' }}>90d</div>
                <div style={{ fontSize: '12px', color: '#737373', marginTop: '2px' }}>
                  Payback or no-build
                </div>
              </div>
            </div>
          </div>

          <div className="hidden lg:block shrink-0 pt-2">
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
                style={{ borderRadius: '4px' }}
                className="w-72 xl:w-80 aspect-[3/4] object-cover object-top"
              />
            </picture>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroD;

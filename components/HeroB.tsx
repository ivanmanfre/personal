import React from 'react';
import { ArrowRight } from 'lucide-react';

// Variant B — Same brand, fixed body legibility.
// Keeps Space Grotesk display headline + sage + paper. Body switches to Inter 400
// at line-height 1.6 instead of Grotesk-medium tight. Tests "is the readability
// problem just the body weight?"
const HeroB: React.FC = () => {
  return (
    <section className="relative min-h-screen pt-28 pb-12 flex flex-col justify-center bg-paper overflow-hidden">
      <div className="absolute inset-0 bg-grid-pattern hidden sm:block opacity-[0.08] pointer-events-none z-0" />

      <div className="container mx-auto px-6 relative z-10">
        <div className="flex flex-col lg:flex-row items-start gap-10 max-w-5xl mx-auto">
          <div className="flex-1 min-w-0">
            <div className="mb-5">
              <span className="inline-block text-xs uppercase tracking-[0.1em] font-medium text-ink-soft border border-[color:var(--color-hairline-bold)] rounded px-2 py-1">
                Agent-Ready Ops™
              </span>
            </div>

            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] font-semibold tracking-tight leading-[1.02] mb-8">
              Systems scale.
              <br />
              Headcount <span className="font-drama italic font-normal">doesn't.</span>
            </h1>

            {/* Body switched to Inter 400, generous leading */}
            <p
              className="max-w-xl mb-10"
              style={{
                fontFamily: 'Inter, system-ui, sans-serif',
                fontWeight: 400,
                fontSize: '18px',
                lineHeight: 1.65,
                color: '#3D3D3B',
              }}
            >
              I diagnose where AI actually moves the needle in your business — then implement
              it alongside the team you already trust. No outsourcing, no replacement-theater,
              just leverage.
            </p>

            <div className="flex flex-col sm:flex-row items-start gap-3">
              <a
                href="/assessment"
                className="btn-magnetic w-full sm:w-auto px-7 py-3.5 bg-accent border-subtle-thick shadow-card-subtle flex items-center justify-center gap-2.5 font-semibold text-base tracking-wide text-white"
              >
                Build your Blueprint <ArrowRight size={18} />
              </a>
              <a
                href="/scorecard"
                className="w-full sm:w-auto px-7 py-3.5 font-semibold text-base tracking-wide text-ink-mute hover:text-black transition-colors flex items-center justify-center gap-2"
                style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
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

export default HeroB;

import React from 'react';
import { ArrowRight } from 'lucide-react';

// Variant A — NEUREL-clone: dark ground, neon-mint accent, editorial serif italic
// pivot, terminal-HUD chrome, stat strip. Direct port of the screenshot Ivan sent.
const HeroA: React.FC = () => {
  return (
    <section
      className="relative min-h-screen pt-20 pb-12 flex flex-col justify-center overflow-hidden"
      style={{
        backgroundColor: '#0A0A0A',
        color: '#E8E6DF',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* HUD background grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(197,255,78,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(197,255,78,0.04) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
        }}
      />

      {/* Top HUD bar */}
      <div
        className="absolute top-0 left-0 right-0 px-8 py-5 flex justify-between items-center text-[11px] uppercase tracking-[0.18em]"
        style={{ fontFamily: '"IBM Plex Mono", monospace', color: 'rgba(232,230,223,0.55)' }}
      >
        <div className="flex items-center gap-4">
          <span style={{ color: '#C5FF4E' }}>◆</span>
          <span>IVAN_OS</span>
          <span>·</span>
          <span>SESSION 05.06</span>
          <span style={{ color: '#C5FF4E' }}>· LIVE</span>
        </div>
        <div>DEPLOYMENTS 47</div>
      </div>

      {/* Nav row */}
      <div className="absolute top-14 left-0 right-0 px-8 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <span style={{ color: '#C5FF4E', fontSize: '14px' }}>◆</span>
          <span
            className="font-semibold tracking-[0.04em]"
            style={{ fontFamily: '"Newsreader", serif', fontStyle: 'italic', fontSize: '20px' }}
          >
            Manfredi
          </span>
        </div>
        <nav className="hidden md:flex items-center gap-8 text-sm">
          <a href="#" style={{ color: 'rgba(232,230,223,0.7)' }}>Services</a>
          <a href="#" style={{ color: 'rgba(232,230,223,0.7)' }}>Process</a>
          <a href="#" style={{ color: 'rgba(232,230,223,0.7)' }}>Work</a>
          <a href="#" style={{ color: 'rgba(232,230,223,0.7)' }}>Manifesto</a>
        </nav>
        <a
          href="/assessment"
          className="px-5 py-2.5 rounded-full text-sm font-medium transition-colors"
          style={{
            border: '1px solid #C5FF4E',
            color: '#C5FF4E',
          }}
        >
          Build your Blueprint →
        </a>
      </div>

      <div className="container mx-auto px-8 relative z-10 mt-16">
        <div className="max-w-5xl">
          {/* Section label */}
          <div
            className="mb-12 text-[11px] uppercase tracking-[0.22em]"
            style={{ fontFamily: '"IBM Plex Mono", monospace', color: 'rgba(232,230,223,0.45)' }}
          >
            <span style={{ color: 'rgba(232,230,223,0.85)' }}>— 01</span> / IVAN // AGENT-READY OPS
          </div>

          {/* Headline — Newsreader serif, italic on the pivot */}
          <h1
            className="mb-10"
            style={{
              fontFamily: '"Newsreader", serif',
              fontWeight: 400,
              fontSize: 'clamp(3.5rem, 8vw, 7rem)',
              lineHeight: 1.0,
              letterSpacing: '-0.02em',
            }}
          >
            Systems scale.
            <br />
            <span style={{ fontStyle: 'italic' }}>
              <span
                style={{
                  background: 'linear-gradient(transparent 60%, rgba(197,255,78,0.25) 60%)',
                  paddingRight: '0.1em',
                }}
              >
                Headcount doesn't.
              </span>
            </span>
          </h1>

          <p
            className="mb-12 max-w-xl"
            style={{
              color: 'rgba(232,230,223,0.7)',
              fontSize: '17px',
              lineHeight: 1.6,
            }}
          >
            I diagnose where AI actually moves the needle in your business — then implement it
            alongside the team you already trust. No outsourcing. No replacement-theater. Just
            leverage.
          </p>

          <div className="flex items-center gap-4">
            <a
              href="/assessment"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full font-medium text-sm"
              style={{ backgroundColor: '#C5FF4E', color: '#0A0A0A' }}
            >
              Book the diagnostic <ArrowRight size={16} />
            </a>
            <a
              href="/scorecard"
              className="inline-flex items-center gap-2 px-6 py-3.5 text-sm"
              style={{ color: 'rgba(232,230,223,0.85)' }}
            >
              Read the manifesto <ArrowRight size={14} />
            </a>
          </div>
        </div>
      </div>

      {/* Stat strip */}
      <div
        className="absolute bottom-0 left-0 right-0 border-t px-8 py-8 flex justify-between max-w-5xl mx-auto"
        style={{ borderColor: 'rgba(232,230,223,0.12)' }}
      >
        <div>
          <div
            style={{
              fontFamily: '"Newsreader", serif',
              fontStyle: 'italic',
              fontSize: '40px',
              lineHeight: 1,
            }}
          >
            47
          </div>
          <div
            className="mt-2 text-[10px] uppercase tracking-[0.2em]"
            style={{
              fontFamily: '"IBM Plex Mono", monospace',
              color: 'rgba(232,230,223,0.5)',
            }}
          >
            Deployments shipped
          </div>
        </div>
        <div>
          <div
            style={{
              fontFamily: '"Newsreader", serif',
              fontStyle: 'italic',
              fontSize: '40px',
              lineHeight: 1,
            }}
          >
            $240M
          </div>
          <div
            className="mt-2 text-[10px] uppercase tracking-[0.2em]"
            style={{
              fontFamily: '"IBM Plex Mono", monospace',
              color: 'rgba(232,230,223,0.5)',
            }}
          >
            Productivity unlocked
          </div>
        </div>
        <div>
          <div
            style={{
              fontFamily: '"Newsreader", serif',
              fontStyle: 'italic',
              fontSize: '40px',
              lineHeight: 1,
              color: '#C5FF4E',
            }}
          >
            0
          </div>
          <div
            className="mt-2 text-[10px] uppercase tracking-[0.2em]"
            style={{
              fontFamily: '"IBM Plex Mono", monospace',
              color: 'rgba(232,230,223,0.5)',
            }}
          >
            Layoffs caused
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroA;

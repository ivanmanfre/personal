import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

// ─────────────────────────────────────────────────────────────────────────────
// Editorial design primitives — mirror the tokens defined locally in
// LandingPage.tsx so /work, /fractional and any future marketing page share the
// same magazine-editorial system (roman DM Serif headlines, sage highlight
// sweep for emphasis, mono numbered labels, bordered paper cards). Kept as a
// standalone module on purpose: LandingPage owns its own copies, and this file
// lets the secondary pages match without refactoring the landing.
// Brand source of truth: ~/.claude/memory/global/brand-visual-system.md
// ─────────────────────────────────────────────────────────────────────────────

export const ease = [0.22, 0.84, 0.36, 1] as const;

export const prefersReduced =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const inView = prefersReduced
  ? { initial: false as const, transition: { duration: 0 } }
  : {
      initial: { opacity: 0, y: 28 },
      whileInView: { opacity: 1, y: 0 },
      viewport: { once: true, margin: '-80px' } as const,
      transition: { duration: 0.85, ease },
    };

export const T = {
  mono: {
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '11px',
    letterSpacing: '0.22em',
    textTransform: 'uppercase' as const,
    color: '#5A5752',
  } as React.CSSProperties,
  serif: {
    fontFamily: '"Source Serif 4", Georgia, serif',
    fontWeight: 400,
    fontSize: '18px',
    lineHeight: 1.7,
    color: '#3D3D3B',
  } as React.CSSProperties,
  display: (size = 'clamp(2.4rem, 4vw, 3.8rem)'): React.CSSProperties => ({
    fontFamily: '"DM Serif Display", "Bodoni Moda", Georgia, serif',
    fontStyle: 'normal',
    fontWeight: 400,
    fontSize: size,
    lineHeight: 1.1,
    letterSpacing: '-0.02em',
    color: '#1A1A1A',
  }),
};

export const DIVIDER = { borderColor: 'rgba(26,26,26,0.1)' };

export const Label: React.FC<{ children: React.ReactNode; dark?: boolean }> = ({ children, dark }) => (
  <div style={{ ...T.mono, color: dark ? 'rgba(247,244,239,0.62)' : '#5A5752', marginBottom: '1.75rem' }}>
    {children}
  </div>
);

// Roman headline that blurs in on scroll. Emphasis is carried by <SageSweep/>,
// never by italic (brand italic discipline, 2026-06-12).
export const RevealH2: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <motion.h2
    initial={prefersReduced ? false : { opacity: 0, y: 22, filter: 'blur(8px)' }}
    whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
    viewport={{ once: true, margin: '-60px' }}
    transition={{ duration: 0.9, ease }}
    style={style}
  >
    {children}
  </motion.h2>
);

// The signature emphasis move: a hand-drawn sage sweep behind a ROMAN phrase.
// Wrap the emphasised words in <span style={{position:'relative',display:'inline-block'}}>…<SageSweep/></span>.
export const SageSweep: React.FC<{ delay?: number; opacity?: number }> = ({ delay = 0.5, opacity = 0.78 }) => (
  <motion.svg
    initial={prefersReduced ? false : { scaleX: 0, opacity: 0 }}
    whileInView={{ scaleX: 1, opacity: 1 }}
    viewport={{ once: true, margin: '-40px' }}
    transition={{ delay, duration: 0.85, ease }}
    viewBox="0 0 400 100"
    preserveAspectRatio="none"
    aria-hidden="true"
    style={{
      position: 'absolute',
      left: '-4%',
      right: '-4%',
      top: '0.18em',
      width: '108%',
      height: '0.78em',
      transformOrigin: 'left',
      zIndex: -1,
      overflow: 'visible',
    }}
  >
    <path
      d="M 6 14 Q 70 10 140 14 Q 220 18 290 12 Q 350 15 394 16 L 394 86 Q 350 88 290 84 Q 220 92 140 86 Q 70 90 6 84 Z"
      fill="#2A8F65"
      opacity={opacity}
    />
  </motion.svg>
);

// Big numeral + small mono label (brand §5f numeral lockup).
export const Numeral: React.FC<{ fig: string; label: string; sage?: boolean; size?: string }> = ({ fig, label, sage, size = 'clamp(2rem,3vw,2.9rem)' }) => (
  <div>
    <div style={{ ...T.display(size), color: sage ? 'var(--color-accent)' : '#1A1A1A', lineHeight: 1, marginBottom: '8px' }}>{fig}</div>
    <div style={T.mono}>{label}</div>
  </div>
);

export const MagneticCTA: React.FC<{
  href: string;
  variant?: 'primary' | 'ghost';
  dark?: boolean;
  children: React.ReactNode;
  fontSize?: string;
  px?: string;
}> = ({ href, variant = 'primary', dark, children, fontSize = '16px', px = 'px-7 py-3.5' }) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const variantStyle: React.CSSProperties = variant === 'primary'
    ? { backgroundColor: dark ? '#F7F4EF' : '#1A1A1A', color: dark ? '#1A1A1A' : '#F7F4EF' }
    : {
        color: dark ? 'rgba(247,244,239,0.7)' : '#4A4A48',
        border: `1px solid ${dark ? 'rgba(247,244,239,0.15)' : 'rgba(26,26,26,0.14)'}`,
      };

  return (
    <div
      ref={wrapperRef}
      style={{ display: 'inline-block' }}
      onMouseMove={(e) => {
        if (!wrapperRef.current || prefersReduced) return;
        const rect = wrapperRef.current.getBoundingClientRect();
        setOffset({
          x: (e.clientX - rect.left - rect.width / 2) * 0.28,
          y: (e.clientY - rect.top - rect.height / 2) * 0.28,
        });
      }}
      onMouseLeave={() => setOffset({ x: 0, y: 0 })}
    >
      <motion.a
        href={href}
        animate={{ x: offset.x, y: offset.y }}
        transition={{ type: 'spring', stiffness: 250, damping: 20 }}
        style={{
          fontFamily: '"Source Serif 4", serif',
          fontWeight: 600,
          fontSize,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '10px',
          ...variantStyle,
        }}
        className={px}
      >
        {children}
      </motion.a>
    </div>
  );
};

export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    setMatches(mq.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [query]);
  return matches;
};

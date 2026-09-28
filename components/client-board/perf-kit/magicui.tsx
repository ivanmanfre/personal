// The Magic UI pieces of the perf-kit, ported from arch-report-app/src/components/magicui
// (2026-09-29). Originals by dillionverma on 21st.dev / magicui.design:
//   Blur Fade      https://21st.dev/@dillionverma/components/blur-fade
//   Number Ticker  https://21st.dev/@dillionverma/components/number-ticker
//   Avatar Circles https://21st.dev/@dillionverma/components/avatar-circles
//   Magic Card     https://21st.dev/@dillionverma/components/magic-card
//   Border Beam    https://21st.dev/@dillionverma/components/border-beam
//   Dot Pattern    https://21st.dev/@dillionverma/components/dot-pattern
// Adaptations carried over from the ARCH report (framer-motion `m`, useReveal for in-view
// with a headless/print safety, reduced motion renders the finished state, initials instead
// of photos), plus for the board: Tailwind classes became the `pk-*` classes in ./styles.ts
// (this repo's Tailwind theme is the editorial one, not the report's), the accent is RISE's
// own yellow read from --cb-accent, and the ARCH magenta is gone.
import { useCallback, useEffect, useId, useRef, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { m, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, type Variants } from 'framer-motion';
import { useReveal } from './motion';

const cx = (...p: Array<string | false | null | undefined>) => p.filter(Boolean).join(' ');

/* ─────────────────────────── Blur Fade ─────────────────────────── */

type Tag = 'div' | 'section' | 'li' | 'span' | 'h2' | 'ul' | 'ol';
export function BlurFade({ children, as = 'div', className, style, delay = 0, duration = 0.45, offset = 8, blur = '6px', id }: {
  children: ReactNode; as?: Tag; className?: string; style?: CSSProperties; delay?: number; duration?: number; offset?: number; blur?: string; id?: string;
}) {
  const [ref, shown] = useReveal<HTMLElement>();
  const reduce = useReducedMotion();
  const variants: Variants = {
    hidden: { y: offset, opacity: 0, filter: `blur(${blur})` },
    visible: { y: 0, opacity: 1, filter: 'blur(0px)' },
  };
  const Comp = m[as] as typeof m.div;
  return (
    <Comp
      ref={ref as RefObject<HTMLDivElement>}
      id={id}
      initial={reduce ? false : 'hidden'}
      animate={shown || reduce ? 'visible' : 'hidden'}
      variants={variants}
      transition={{ delay: 0.04 + delay, duration, ease: 'easeOut' }}
      className={className}
      style={style}
    >
      {children}
    </Comp>
  );
}

/* ─────────────────────────── Number Ticker ─────────────────────────── */

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

/** Counts up once when revealed; a hidden copy of the final value reserves the width, and
 *  screen readers only ever read the final value. The exact value is written when it ends. */
export function NumberTicker({ value, delay = 0, start, className, style }: { value: number; delay?: number; start?: boolean; className?: string; style?: CSSProperties }) {
  const [wrap, seen] = useReveal<HTMLSpanElement>(0.5);
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 140, damping: 24, restDelta: 0.001 });
  const go = start ?? seen;
  const final = fmt(value);
  const still = !!reduce || value === 0;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (still) { el.textContent = final; return; }
    if (!go) return;
    const t1 = window.setTimeout(() => mv.set(value), delay * 1000);
    const t2 = window.setTimeout(() => { if (ref.current) ref.current.textContent = final; }, delay * 1000 + 950);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
  }, [go, still, value, delay, final, mv]);

  useEffect(() => spring.on('change', (v) => { if (ref.current) ref.current.textContent = fmt(v); }), [spring]);

  return (
    <span ref={wrap} className={cx('pk-ticker', className)} style={style}>
      <span aria-hidden="true" className="pk-ticker-ghost">{final}</span>
      <span aria-hidden="true" ref={ref} className="pk-ticker-live">{still ? final : '0'}</span>
      <span className="pk-sr">{final}</span>
    </span>
  );
}

/* ─────────────────────────── Avatar Circles ─────────────────────────── */

export type AvatarItem = { initials: string; label: string; tone?: 'accent' | 'plain' };
export function AvatarCircles({ avatars, more = 0, size = 44, delay = 0, start = true }: { avatars: AvatarItem[]; more?: number; size?: number; delay?: number; start?: boolean }) {
  const reduce = useReducedMotion();
  const pop = (i: number) => ({
    initial: reduce ? false : ({ scale: 0.4, opacity: 0 } as const),
    animate: start ? { scale: 1, opacity: 1 } : undefined,
    transition: { type: 'spring' as const, bounce: 0.45, duration: 0.5, delay: delay + i * 0.07 },
  });
  const box: CSSProperties = { width: size, height: size, fontSize: Math.round(size * 0.3) };
  return (
    <div className="pk-avs" aria-hidden="true">
      {avatars.map((a, i) => (
        <m.span key={i} title={a.label} className={cx('pk-av', a.tone === 'plain' && 'pk-av-plain')} style={box} {...pop(i)}>{a.initials}</m.span>
      ))}
      {more > 0 && <m.span className="pk-av pk-av-more" style={box} {...pop(avatars.length)}>+{more}</m.span>}
    </div>
  );
}

/* ─────────────────────────── Magic Card (spotlight) ─────────────────────────── */

export function MagicCard({ children, className, size = 240 }: { children?: ReactNode; className?: string; size?: number }) {
  const mx = useMotionValue(-size);
  const my = useMotionValue(-size);
  const reset = useCallback(() => { mx.set(-size); my.set(-size); }, [mx, my, size]);
  const move = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    mx.set(e.clientX - r.left); my.set(e.clientY - r.top);
  }, [mx, my]);
  useEffect(() => {
    const out = (e: PointerEvent) => { if (!e.relatedTarget) reset(); };
    window.addEventListener('pointerout', out);
    window.addEventListener('blur', reset);
    return () => { window.removeEventListener('pointerout', out); window.removeEventListener('blur', reset); };
  }, [reset]);
  const border = useMotionTemplate`linear-gradient(#171717 0 0) padding-box, radial-gradient(${size}px circle at ${mx}px ${my}px, var(--cb-accent), rgba(255,199,29,0.12), rgba(255,255,255,0.09) 100%) border-box`;
  const glow = useMotionTemplate`radial-gradient(${size}px circle at ${mx}px ${my}px, rgba(255,199,29,0.08), transparent 100%)`;
  return (
    <m.div className={cx('pk-mcard', className)} onPointerMove={move} onPointerDown={move} onPointerLeave={reset} style={{ background: border }}>
      <m.div aria-hidden className="pk-mcard-glow" style={{ background: glow }} />
      <div className="pk-mcard-body">{children}</div>
    </m.div>
  );
}

/* ─────────────────────────── Border Beam ─────────────────────────── */

/** A light that travels the panel's border. Pure decoration: not rendered at all under
 *  reduced motion. */
export function BorderBeam({ size = 110, duration = 10 }: { size?: number; duration?: number }) {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <div aria-hidden="true" className="pk-beam">
      <m.div
        className="pk-beam-dot"
        style={{ width: size, offsetPath: `rect(0 auto auto 0 round ${size}px)` } as CSSProperties}
        initial={{ offsetDistance: '0%' }}
        animate={{ offsetDistance: ['0%', '100%'] }}
        transition={{ repeat: Infinity, ease: 'linear', duration }}
      />
    </div>
  );
}

/* ─────────────────────────── Dot Pattern ─────────────────────────── */

export function DotPattern({ gap = 18, r = 0.9 }: { gap?: number; r?: number }) {
  const id = useId();
  return (
    <svg aria-hidden="true" className="pk-dots">
      <defs>
        <pattern id={`${id}-d`} width={gap} height={gap} patternUnits="userSpaceOnUse">
          <circle cx={1} cy={1} r={r} fill="currentColor" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id}-d)`} />
    </svg>
  );
}

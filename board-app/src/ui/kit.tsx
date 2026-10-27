import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AlignLeft, ChevronDown, X } from 'lucide-react';
import { initials } from '../data/model';
import { useLocal } from '../data/store';

export const SPRING = { type: 'spring' as const, stiffness: 420, damping: 38, mass: 0.8 };
export const SOFT = { type: 'spring' as const, stiffness: 260, damping: 32 };

export function useMedia(q: string) {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [q]);
  return m;
}
export const useIsPhone = () => useMedia('(max-width: 760px)');

/* number-flow: each digit is a 0-9 strip that springs to its place (transform only). */
export function AnimatedNumber({ value, className = '' }: { value: number; className?: string }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? value : 0);
  useEffect(() => {
    if (reduce) { setShown(value); return; }
    const t = window.setTimeout(() => setShown(value), 60);
    return () => window.clearTimeout(t);
  }, [value, reduce]);
  const target = value.toLocaleString('en-GB');
  // Each slot is sized by its final glyph, so proportional digits sit at their natural spacing.
  const now = shown.toLocaleString('en-GB').padStart(target.length, ' ').slice(-target.length);
  return (
    <span className={`inline-flex ${className}`} style={{ fontVariantNumeric: 'proportional-nums' }} aria-label={target} role="text">
      {target.split('').map((ch, i) =>
        /\d/.test(ch) ? (
          <span key={i} aria-hidden className="relative inline-block overflow-hidden" style={{ height: '1em' }}>
            <span className="invisible">{ch}</span>
            <motion.span
              className="absolute inset-x-0 top-0 flex flex-col items-center"
              initial={false}
              animate={{ y: `${-(/\d/.test(now[i]) ? Number(now[i]) : 0)}em` }}
              transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 140, damping: 22, mass: 0.9, delay: i * 0.04 }}
            >
              {Array.from({ length: 10 }, (_, d) => <span key={d} style={{ height: '1em', lineHeight: 1 }}>{d}</span>)}
            </motion.span>
          </span>
        ) : (
          <span key={i} aria-hidden>{ch}</span>
        ),
      )}
    </span>
  );
}

/* A post thumbnail: the real cover when there is one, the hook set in type when there is not. */
export function Thumb({ src, text, size = 56, ratio, className = '', rounded = 10 }: { src?: string; text: string; size?: number | 'fill'; ratio?: string; className?: string; rounded?: number }) {
  const [bad, setBad] = useState(false);
  const style: React.CSSProperties = size === 'fill'
    ? { width: '100%', aspectRatio: ratio || '4 / 5', borderRadius: rounded }
    : { width: size, height: size, borderRadius: rounded, flex: `0 0 ${size}px` };
  if (src && !bad) {
    return (
      <div className={`overflow-hidden bg-sunk border hair ${className}`} style={style}>
        <img src={src} alt="" loading="lazy" onError={() => setBad(true)} className="w-full h-full object-cover" />
      </div>
    );
  }
  const words = text.split(/\s+/).slice(0, size === 'fill' ? 12 : 5).join(' ');
  const small = typeof size === 'number' && size < 72;
  if (typeof size === 'number' && size < 56) {
    return (
      <div className={`relative overflow-hidden bg-sunk border hair flex items-center justify-center text-mute ${className}`} style={style} aria-hidden>
        <div className="absolute inset-y-0 left-0 w-[2px] bg-accent" />
        <AlignLeft size={Math.round(size * 0.36)} strokeWidth={1.75} />
      </div>
    );
  }
  return (
    <div className={`relative overflow-hidden bg-sunk border hair ${className}`} style={{ ...style, containerType: 'inline-size' }} aria-hidden>
      <div className="absolute inset-y-0 left-0 w-[2px] bg-accent" />
      <div
        className="absolute inset-0 font-display text-head"
        style={{ padding: small ? '7px 6px 6px 9px' : 'clamp(5px, 9cqi, 14px) clamp(5px, 8cqi, 12px) 8px clamp(7px, 10cqi, 14px)', fontSize: small ? 8.5 : 'clamp(7px, 10.5cqi, 14px)', lineHeight: 1.18, fontWeight: 400, letterSpacing: '-0.01em', overflow: 'hidden' }}
      >
        {words}
      </div>
    </div>
  );
}

export function Avatar({ name, src, size = 36, tone = 'wash' }: { name: string; src?: string; size?: number; tone?: 'wash' | 'accent' | 'plain' }) {
  const [bad, setBad] = useState(false);
  if (src && !bad) return <img src={src} alt="" onError={() => setBad(true)} className="rounded-full object-cover" style={{ width: size, height: size, flex: `0 0 ${size}px` }} />;
  const bg = tone === 'accent' ? 'var(--accent)' : tone === 'plain' ? 'var(--sunk)' : 'var(--accent-wash)';
  const fg = tone === 'accent' ? 'var(--accent-ink)' : tone === 'plain' ? 'var(--soft)' : 'var(--accent-fg)';
  return (
    <span className="inline-flex items-center justify-center rounded-full font-semibold" style={{ width: size, height: size, flex: `0 0 ${size}px`, background: bg, color: fg, fontSize: size * 0.36, letterSpacing: '0.02em' }} aria-hidden>
      {initials(name) || '·'}
    </span>
  );
}

/* Right drawer on desktop, bottom sheet on phone. */
export function Sheet({ open, onClose, title, eyebrow, children, width = 520 }: { open: boolean; onClose: () => void; title: ReactNode; eyebrow?: ReactNode; children: ReactNode; width?: number }) {
  const phone = useIsPhone();
  const reduce = useReducedMotion();
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useLayoutEffect(() => { close.current = onClose; });
  useEffect(() => {
    if (!open) return;
    // Esc inside a text field leaves the field first (the field's own handler may cancel an edit);
    // the next Esc closes the drawer.
    const k = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.tagName === 'SELECT')) {
        if (t.getAttribute('aria-expanded') === 'true') return; // an open suggestion list closes first
        requestAnimationFrame(() => { if (document.activeElement === t || !document.contains(t)) panel.current?.focus(); });
        return;
      }
      e.stopPropagation(); close.current();
    };
    // Tab stays inside the drawer while it is open.
    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !panel.current) return;
      const f = [...panel.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])')].filter(x => x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    // Focus goes back to whatever opened the drawer.
    const opener = document.activeElement as HTMLElement | null;
    window.addEventListener('keydown', k, true);
    window.addEventListener('keydown', trap);
    const t = window.setTimeout(() => panel.current?.focus(), 50);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', k, true); window.removeEventListener('keydown', trap); window.clearTimeout(t); document.body.style.overflow = prev;
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, [open]);
  const off = phone ? { y: '100%' } : { x: '100%' };
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60]">
          <motion.div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.55)' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onClick={onClose} />
          <motion.div
            ref={panel}
            tabIndex={-1}
            role="dialog"
            aria-modal
            aria-label={typeof title === 'string' ? title : undefined}
            aria-labelledby={typeof title === 'string' ? undefined : 'sheet-title'}
            className={`absolute bg-paper flex flex-col outline-none ${phone ? 'left-0 right-0 bottom-0 rounded-t-[18px] border-t' : 'top-0 right-0 bottom-0 border-l'} hair`}
            style={phone ? { maxHeight: '88dvh' } : { width: `min(${width}px, 100vw)` }}
            initial={reduce ? { opacity: 0 } : off}
            animate={reduce ? { opacity: 1 } : { x: 0, y: 0 }}
            exit={reduce ? { opacity: 0 } : off}
            transition={SOFT}
            drag={phone && !reduce ? 'y' : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, i) => { if (i.offset.y > 120 || i.velocity.y > 600) onClose(); }}
          >
            {phone && <div className="flex justify-center pt-2.5 pb-1"><span className="block h-1 w-10 rounded-full bg-line-bold" /></div>}
            <div className={`flex items-start justify-between gap-4 ${phone ? 'px-5 pt-2 pb-4' : 'px-7 pt-7 pb-5'} border-b hair`}>
              <div className="min-w-0">
                {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
                <h2 id="sheet-title" className="display text-[24px] sm:text-[26px] break-words">{title}</h2>
              </div>
              <button onClick={onClose} aria-label="Close" className="btn btn-outline btn-sm !px-0 w-9 shrink-0"><X size={16} strokeWidth={1.75} /></button>
            </div>
            <div className={`flex-1 overflow-y-auto overscroll-contain scroll-quiet ${phone ? 'px-5 pb-8' : 'px-7 pb-10'}`}>{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/* Accordion fold. The content fades in and the page below glides on transforms (layout="position"),
   so nothing animates height. The closed header carries a one-line summary. */
export function Fold({ id, title, summary, open, onToggle, children, hovered, onHover }: {
  id: string; title: string; summary: ReactNode; open: boolean; onToggle: () => void; children: ReactNode;
  hovered: boolean; onHover: (on: boolean) => void;
}) {
  const reduce = useReducedMotion();
  const btn = useRef<HTMLButtonElement>(null);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const all = [...document.querySelectorAll<HTMLButtonElement>('[data-fold-head]')];
    const i = all.indexOf(btn.current!);
    const next = all[i + (e.key === 'ArrowDown' ? 1 : -1)];
    if (next) { e.preventDefault(); next.focus(); }
  };
  return (
    <motion.section layout={reduce ? false : 'position'} transition={SOFT} className="border-t hair">
      <button
        ref={btn}
        data-fold-head
        onClick={onToggle}
        onKeyDown={onKey}
        onMouseEnter={() => onHover(true)}
        onMouseLeave={() => onHover(false)}
        aria-expanded={open}
        aria-controls={`fold-${id}`}
        className="relative w-full text-left flex items-center gap-4 py-5 px-3 -mx-3"
        style={{ width: 'calc(100% + 24px)' }}
      >
        {hovered && <motion.span layoutId="fold-pill" className="absolute inset-x-0 inset-y-1.5 rounded-[12px] bg-sunk" transition={SPRING} />}
        <span className="relative flex-1 min-w-0 flex max-sm:flex-col sm:items-center gap-x-4 gap-y-1">
          <span className="display text-[22px] sm:text-[24px] shrink-0">{title}</span>
          <span className={`flex-1 min-w-0 sm:text-right text-[13.5px] text-mute truncate ${open ? 'sm:invisible' : ''}`}>{summary}</span>
        </span>
        <motion.span className="relative text-mute shrink-0" animate={{ rotate: open ? 180 : 0 }} transition={SPRING}><ChevronDown size={18} strokeWidth={1.5} /></motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={`fold-${id}`}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
            className="pb-10 pt-1"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

export function Toaster() {
  const { toasts, dismiss } = useLocal();
  return (
    <div className="pointer-events-none fixed inset-x-0 z-[90] flex flex-col items-center gap-2 px-4 bottom-[84px] md:bottom-6" aria-live="polite">
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6 }}
            transition={SPRING}
            role={t.kind === 'err' ? 'alert' : undefined}
            className={`pointer-events-auto max-w-[560px] rounded-[18px] px-4 min-h-9 py-2 inline-flex items-center gap-2.5 text-[13px] font-semibold border ${t.kind === 'err' ? 'leading-snug' : ''}`}
            style={t.kind === 'err'
              ? { background: 'var(--paper)', color: 'var(--ink)', borderColor: '#E5484D' }
              : { background: 'var(--ink)', color: 'var(--paper)', borderColor: 'var(--ink)' }}
            data-testid={t.kind === 'err' ? 'error-line' : 'toast'}
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full shrink-0" style={{ background: t.kind === 'err' ? '#E5484D' : 'var(--accent)' }} />
            <span className={t.kind === 'err' ? 'font-medium' : ''}>{t.text}</span>
            {t.kind === 'err' && <button className="ml-1 text-mute hover:text-ink shrink-0" aria-label="Dismiss" onClick={() => dismiss(t.id)}><X size={14} /></button>}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/* Measures a node so a parent can line things up with it (used by the stage strip). */
export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export function SectionHead({ eyebrow, right, className = '' }: { eyebrow: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <div className={`flex items-center justify-between gap-4 mb-5 ${className}`}>
      <div className="eyebrow flex items-center gap-2.5">{eyebrow}</div>
      {right}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-[15px] text-mute py-2">{children}</p>;
}

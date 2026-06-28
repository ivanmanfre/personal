import React from 'react';

/**
 * Studio UI primitives — Shadcn-style components, hand-rolled to match the
 * dashboard's warm-dark + sage palette without pulling in the full Shadcn
 * generator (Radix + tailwindcss-animate + clsx + class-variance-authority).
 *
 * Goal: a tiny set of building blocks that the dashboard panels + editors can
 * standardize on, so chrome stops looking like a different person built each
 * page. One Card, one Button, one Badge, one Input — consistent focus rings,
 * consistent hover, consistent radii and padding.
 */

const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

// ─── Card ────────────────────────────────────────────────────────────────────
export const Card: React.FC<React.HTMLAttributes<HTMLDivElement> & { padded?: boolean }> = ({
  className, padded = true, children, ...rest
}) => (
  <div
    className={cn(
      'rounded-xl ring-1 ring-zinc-800/60 bg-gradient-to-b from-zinc-900/40 to-zinc-950/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_4px_12px_rgba(0,0,0,0.2)]',
      padded && 'p-3.5',
      className,
    )}
    {...rest}
  >
    {children}
  </div>
);

export const CardLabel: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...rest }) => (
  <div
    className={cn(
      'text-[10px] uppercase tracking-[0.08em] text-zinc-500 font-semibold mb-2',
      className,
    )}
    {...rest}
  >
    {children}
  </div>
);

// ─── Button ──────────────────────────────────────────────────────────────────
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type BtnSize = 'sm' | 'md';

export const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant;
  size?: BtnSize;
  block?: boolean;
}>(({ className, variant = 'secondary', size = 'md', block, children, ...rest }, ref) => {
  const base = 'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:opacity-40 disabled:cursor-not-allowed';
  const sizes: Record<BtnSize, string> = {
    sm: 'px-2.5 py-1 text-xs',
    md: 'px-3 py-2 text-sm',
  };
  const variants: Record<BtnVariant, string> = {
    primary:   'bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 active:from-emerald-600 active:to-emerald-700 text-white shadow-md shadow-emerald-900/30 ring-1 ring-emerald-400/30',
    secondary: 'bg-[var(--ds-line)] hover:bg-black/[.06] active:bg-black/[.09] text-[var(--ds-ink)] ring-1 ring-[var(--ds-line)] shadow-sm',
    ghost:     'bg-transparent hover:bg-black/[.03] text-[var(--ds-dim)]',
    danger:    'bg-gradient-to-b from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white shadow-md shadow-red-900/30 ring-1 ring-red-400/30',
  };
  return (
    <button
      ref={ref}
      className={cn(base, sizes[size], variants[variant], block && 'w-full', className)}
      {...rest}
    >
      {children}
    </button>
  );
});
Button.displayName = 'Button';

// ─── Badge ───────────────────────────────────────────────────────────────────
type BadgeTone = 'neutral' | 'sage' | 'sky' | 'amber' | 'red' | 'violet';

export const Badge: React.FC<React.HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
  size?: 'sm' | 'md';
}> = ({ tone = 'neutral', size = 'sm', className, children, ...rest }) => {
  const tones: Record<BadgeTone, string> = {
    neutral: 'bg-zinc-800/70 text-zinc-300 border-zinc-700/50',
    sage:    'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
    sky:     'bg-sky-500/10 text-sky-300 border-sky-500/30',
    amber:   'bg-amber-500/10 text-amber-300 border-amber-500/30',
    red:     'bg-red-500/10 text-red-300 border-red-500/30',
    violet:  'bg-violet-500/10 text-violet-300 border-violet-500/30',
  };
  const sizes = size === 'sm'
    ? 'px-1.5 py-0.5 text-[10.5px] uppercase tracking-wider font-medium'
    : 'px-2 py-0.5 text-xs font-medium';
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded border', sizes, tones[tone], className)}
      {...rest}
    >
      {children}
    </span>
  );
};

// ─── Input + Textarea ────────────────────────────────────────────────────────
const fieldBase = 'w-full rounded-lg bg-[var(--ds-bg)] ring-1 ring-inset ring-[var(--ds-line)] px-3 py-2 text-sm text-[var(--ds-ink)] placeholder-zinc-400 transition-all duration-150 focus:outline-none focus:ring-emerald-500/40 focus:bg-white';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...rest }, ref) => <input ref={ref} className={cn(fieldBase, className)} {...rest} />
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...rest }, ref) => <textarea ref={ref} className={cn(fieldBase, 'resize-y', className)} {...rest} />
);
Textarea.displayName = 'Textarea';

// ─── FieldLabel ──────────────────────────────────────────────────────────────
export const FieldLabel: React.FC<React.LabelHTMLAttributes<HTMLLabelElement>> = ({
  className, children, ...rest
}) => (
  <label
    className={cn(
      'block text-xs uppercase tracking-[0.08em] text-zinc-500 font-semibold mb-1.5',
      className,
    )}
    {...rest}
  >
    {children}
  </label>
);

// ─── EmptyState ──────────────────────────────────────────────────────────────
export const EmptyState: React.FC<{
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  action?: React.ReactNode;
}> = ({ icon, title, description, action }) => (
  <div className="rounded-md border border-dashed border-zinc-800 bg-zinc-950/40 px-4 py-8 text-center">
    {icon && <div className="flex justify-center mb-2 text-zinc-600">{icon}</div>}
    {title && <div className="text-sm text-zinc-300 font-medium">{title}</div>}
    {description && <div className="mt-1 text-xs text-zinc-500 max-w-xs mx-auto leading-snug">{description}</div>}
    {action && <div className="mt-3">{action}</div>}
  </div>
);

// ─── Divider ─────────────────────────────────────────────────────────────────
export const Divider: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('h-px bg-zinc-800/70', className)} />
);

// ─── Skeleton ────────────────────────────────────────────────────────────────
/** Pulsing rounded bar for loading states. Use width via className. */
// Modern skeleton with shimmer sweep
export const Skeleton: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...rest }) => (
  <div
    className={cn(
      'relative overflow-hidden rounded-md bg-zinc-800/50',
      'before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.6s_infinite]',
      'before:bg-gradient-to-r before:from-transparent before:via-zinc-700/40 before:to-transparent',
      className,
    )}
    {...rest}
  />
);

/** Studio list skeleton row — placeholder with thumb + title bar + meta bars matching list layout. */
export const ListRowSkeleton: React.FC = () => (
  <div className="flex items-center gap-3 px-4 py-2.5 border-b border-zinc-800/30">
    <Skeleton className="w-8 h-8 shrink-0 rounded-lg" />
    <div className="flex-1 min-w-0 space-y-1.5">
      <Skeleton className="h-3 w-3/5" />
      <Skeleton className="h-2.5 w-2/5 opacity-60" />
    </div>
    <Skeleton className="h-4 w-16 hidden md:block rounded" />
    <Skeleton className="h-4 w-14 hidden lg:block rounded" />
    <Skeleton className="h-3 w-16 rounded" />
  </div>
);

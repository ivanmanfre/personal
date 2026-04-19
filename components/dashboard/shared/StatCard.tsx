import React, { useEffect, useRef, useState } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Props {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  subValue?: string;
  trend?: { value: number; label?: string }; // percentage change — positive = up, negative = down
}

// Map text color classes to background tint classes
// Restricted palette: emerald = positive/primary, zinc = neutral metric,
// red = error, amber = warning, blue = info. Other accents kept for back-compat
// but all new code should pick from the four semantic options.
const colorToBg: Record<string, string> = {
  'text-emerald-400': 'bg-emerald-500/15 border-emerald-500/20',
  'text-zinc-300':    'bg-zinc-700/30 border-zinc-700/40',
  'text-zinc-400':    'bg-zinc-700/30 border-zinc-700/40',
  'text-red-400':     'bg-red-500/15 border-red-500/20',
  'text-amber-400':   'bg-amber-500/15 border-amber-500/20',
  'text-blue-400':    'bg-blue-500/15 border-blue-500/20',
  // Legacy accents — deprecated, kept so older panels keep rendering
  'text-pink-400':    'bg-pink-500/15 border-pink-500/20',
  'text-violet-400':  'bg-violet-500/15 border-violet-500/20',
  'text-orange-400':  'bg-orange-500/15 border-orange-500/20',
  'text-cyan-400':    'bg-cyan-500/15 border-cyan-500/20',
  'text-purple-400':  'bg-purple-500/15 border-purple-500/20',
};

const colorToAccent: Record<string, string> = {
  'text-emerald-400': 'from-emerald-500',
  'text-zinc-300':    'from-zinc-500',
  'text-zinc-400':    'from-zinc-500',
  'text-red-400':     'from-red-500',
  'text-amber-400':   'from-amber-500',
  'text-blue-400':    'from-blue-500',
  'text-pink-400':    'from-pink-500',
  'text-violet-400':  'from-violet-500',
  'text-orange-400':  'from-orange-500',
  'text-cyan-400':    'from-cyan-500',
  'text-purple-400':  'from-purple-500',
};

/** Extract a numeric value and its prefix/suffix for animated counting */
function parseValue(val: string | number): { num: number; prefix: string; suffix: string } | null {
  const str = String(val);
  const match = str.match(/^([^0-9]*)([\d,.]+)(.*)$/);
  if (!match) return null;
  const num = parseFloat(match[2].replace(/,/g, ''));
  if (isNaN(num)) return null;
  return { prefix: match[1], num, suffix: match[3] };
}

function formatWithCommas(n: number, hasDecimal: boolean): string {
  if (hasDecimal) return n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return Math.round(n).toLocaleString('en-US');
}

function useCountUp(target: number, duration = 600): number {
  const [current, setCurrent] = useState(0);
  const prevTarget = useRef(target);

  useEffect(() => {
    const from = prevTarget.current === target ? 0 : prevTarget.current;
    prevTarget.current = target;
    if (target === 0) { setCurrent(0); return; }

    const start = performance.now();
    let raf: number;

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(from + (target - from) * eased);
      if (progress < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return current;
}

const StatCard: React.FC<Props> = ({ label, value, icon, color, subValue, trend }) => {
  const bgClass = colorToBg[color] || 'bg-zinc-500/15 border-zinc-500/20';
  const accentClass = colorToAccent[color] || 'from-zinc-500';

  const parsed = parseValue(value);
  const animated = useCountUp(parsed?.num ?? 0);
  const hasDecimal = String(value).includes('.');

  const displayValue = parsed
    ? `${parsed.prefix}${formatWithCommas(animated, hasDecimal)}${parsed.suffix}`
    : value;

  return (
    <div className="group relative bg-zinc-900/90 border border-zinc-800/80 rounded-xl p-4 hover:border-zinc-700/80 transition-all duration-300 overflow-hidden hover:shadow-lg hover:shadow-black/20">
      {/* Top accent line */}
      <div className={`absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent ${accentClass} to-transparent opacity-40 group-hover:opacity-80 transition-opacity duration-300`} />

      {/* Subtle background glow */}
      <div className={`absolute -top-8 -right-8 w-24 h-24 rounded-full ${bgClass.split(' ')[0]} blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <span className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium block mb-2">{label}</span>
          <p className="text-[28px] font-bold tracking-tight leading-none animate-count-up">{displayValue}</p>
          {trend && (
            <div className={`flex items-center gap-1 mt-1.5 ${trend.value > 0 ? 'text-emerald-400' : trend.value < 0 ? 'text-red-400' : 'text-zinc-500'}`}>
              {trend.value > 0 ? <TrendingUp className="w-3 h-3" /> : trend.value < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
              <span className="text-[11px] font-medium">{trend.value > 0 ? '+' : ''}{trend.value}%</span>
              {trend.label && <span className="text-[10px] text-zinc-600">{trend.label}</span>}
            </div>
          )}
          {subValue && <p className="text-[11px] text-zinc-500 mt-2">{subValue}</p>}
        </div>
        <div className={`shrink-0 w-10 h-10 rounded-xl border flex items-center justify-center ${bgClass} ${color} transition-all duration-300 group-hover:scale-110`}>
          {icon}
        </div>
      </div>
    </div>
  );
};

export default StatCard;

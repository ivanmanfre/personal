import React, { useEffect, useRef, useState } from 'react';
import { useInView, motion } from 'framer-motion';

interface Props {
  value: number;
  label: string;
  suffix?: string;
  decimals?: number;
  /** Animation duration in ms */
  durationMs?: number;
}

const LiveMetricCounter: React.FC<Props> = ({
  value,
  label,
  suffix,
  decimals = 0,
  durationMs = 1100,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px 0px' });
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let frame: number;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / durationMs, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayed(value * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
      else setDisplayed(value);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, value, durationMs]);

  const formatted = decimals > 0 ? displayed.toFixed(decimals) : Math.round(displayed).toLocaleString();

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 12 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
      transition={{ duration: 0.4 }}
      className="border-l-2 border-accent pl-5 py-2"
    >
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-5xl md:text-6xl font-drama italic font-normal leading-none text-ink tabular-nums">
          {formatted}
        </span>
        {suffix && (
          <span className="font-mono text-xs uppercase tracking-[0.18em] text-ink-mute pb-2">
            {suffix}
          </span>
        )}
      </div>
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute">
        {label}
      </p>
    </motion.div>
  );
};

export default LiveMetricCounter;

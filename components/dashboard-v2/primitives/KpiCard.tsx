import React from 'react';
import { useCountUp } from './useCountUp';
import { Sparkline } from './Sparkline';
import { Ring } from './Ring';

interface KpiCardProps {
  label: string;
  value: number;
  trend?: {
    direction: 'up' | 'down' | 'flat';
    label: string;
  };
  spark?: {
    points: number[];
    stroke: string;
  };
  ring?: {
    max: number;
    stroke: string;
    size?: number;
  };
}

const trendColor = {
  up:   'var(--ds-ok)',
  down: 'var(--ds-warn)',
  flat: 'var(--ds-faint)',
};

const trendIcon = {
  up:   '▲',
  down: '▼',
  flat: '—',
};

export function KpiCard({ label, value, trend, spark, ring }: KpiCardProps) {
  const display = useCountUp(value);

  return (
    <div
      style={{
        background: 'var(--ds-card)',
        border: '1px solid var(--ds-line)',
        borderRadius: 'var(--ds-radius)',
        boxShadow: 'var(--ds-shadow-card)',
        padding: '16px 17px 14px',
        position: 'relative',
        transition: 'transform .16s, box-shadow .16s',
      }}
    >
      {/* Label */}
      <div
        style={{
          fontSize: '11px',
          textTransform: 'uppercase',
          letterSpacing: '.07em',
          color: 'var(--ds-faint)',
          fontWeight: 600,
        }}
      >
        {label}
      </div>

      {/* Value */}
      <div
        style={{
          fontSize: '30px',
          fontWeight: 700,
          letterSpacing: '-.02em',
          marginTop: '8px',
          lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--ds-ink)',
        }}
      >
        {display}
      </div>

      {/* Trend */}
      {trend && (
        <div
          style={{
            fontSize: '11.5px',
            fontWeight: 600,
            marginTop: '7px',
            display: 'inline-flex',
            gap: '4px',
            alignItems: 'center',
            color: trendColor[trend.direction],
          }}
        >
          {trendIcon[trend.direction]} {trend.label}
        </div>
      )}

      {/* Sparkline — absolute bottom-right */}
      {spark && (
        <div
          style={{
            position: 'absolute',
            right: '14px',
            bottom: '14px',
            width: '74px',
            height: '30px',
          }}
        >
          <Sparkline points={spark.points} stroke={spark.stroke} />
        </div>
      )}

      {/* Ring — absolute center-right */}
      {ring && (
        <div
          style={{
            position: 'absolute',
            right: '14px',
            top: '50%',
            transform: 'translateY(-50%)',
          }}
        >
          <Ring
            value={value}
            max={ring.max}
            stroke={ring.stroke}
            size={ring.size ?? 60}
          />
        </div>
      )}
    </div>
  );
}

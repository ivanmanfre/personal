import React from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useFontPicker } from './FontPicker';

// Variant K — Live operations dashboard hero with live font picker.
// Editorial typography (Instrument Serif italic) co-existing with a Bloomberg-warm
// stat strip: numbers tick up like an odometer, "live" pulse indicators, a
// horizontal capacity bar that fills, a "deployments this week" mini-chart.
// Reads as: "this is a working operator with real systems running NOW."

// Odometer-style number that counts up
const CountUp: React.FC<{ to: number; prefix?: string; suffix?: string; delay?: number }> = ({
  to,
  prefix = '',
  suffix = '',
  delay = 0,
}) => {
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 60, damping: 30 });
  const display = useTransform(spring, (v) => `${prefix}${Math.round(v).toLocaleString()}${suffix}`);

  React.useEffect(() => {
    const t = setTimeout(() => mv.set(to), delay * 1000);
    return () => clearTimeout(t);
  }, [to, delay, mv]);

  return (
    <motion.span
      style={{
        fontFamily: '"Instrument Serif", serif',
        fontStyle: 'italic',
        fontWeight: 400,
      }}
    >
      {display}
    </motion.span>
  );
};

const HeroK: React.FC = () => {
  const [font, FontPicker] = useFontPicker('hero-k', 'dmserif');
  return (
    <section className="relative min-h-screen pt-24 pb-8 flex flex-col bg-paper overflow-hidden">
      <FontPicker />

      {/* Top live status strip */}
      <motion.div
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.22, 0.84, 0.36, 1] }}
        className="border-b px-8 py-3 flex items-center justify-between"
        style={{
          fontFamily: '"IBM Plex Mono", monospace',
          fontSize: '11px',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'rgba(26,26,26,0.7)',
          borderColor: 'rgba(26,26,26,0.12)',
        }}
      >
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <motion.span
              animate={{ opacity: [1, 0.2, 1] }}
              transition={{ duration: 1.4, repeat: Infinity }}
              style={{ color: '#2A8F65', fontSize: '10px' }}
            >
              ●
            </motion.span>
            <span style={{ color: '#2A8F65' }}>Live · Booking Q3 2026</span>
          </div>
          <span>Session 05.06</span>
        </div>
        <div className="flex items-center gap-6">
          <span>Deployments this week: <span style={{ color: '#1A1A1A' }}>3</span></span>
          <span>Capacity: 60%</span>
        </div>
      </motion.div>

      <div className="container mx-auto px-8 max-w-6xl flex-1 flex flex-col justify-center py-12">
        {/* Top byline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="mb-10"
          style={{
            fontFamily: '"IBM Plex Mono", monospace',
            fontSize: '11px',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'rgba(26,26,26,0.55)',
          }}
        >
          — 01 / Manfredi // Agent-Ready Ops
        </motion.div>

        <div className="grid lg:grid-cols-[1.4fr_1fr] gap-12 items-start">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 1.2, ease: [0.22, 0.84, 0.36, 1] }}
              className="mb-10"
              style={{
                fontFamily: font.family,
                fontWeight: font.weight,
                fontSize: `clamp(${3.5 * (font.scaleAdjust ?? 1)}rem, ${8.5 * (font.scaleAdjust ?? 1)}vw, ${7.5 * (font.scaleAdjust ?? 1)}rem)`,
                lineHeight: 0.96,
                letterSpacing: font.letterSpacing ?? '-0.015em',
                color: '#1A1A1A',
              }}
            >
              Systems scale.
              <br />
              <span style={{ fontStyle: 'italic' }}>Headcount doesn't.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.0, duration: 0.9 }}
              className="max-w-xl mb-10"
              style={{
                fontFamily: '"Source Serif 4", Georgia, serif',
                fontWeight: 400,
                fontSize: '19px',
                lineHeight: 1.6,
                color: '#3D3D3B',
              }}
            >
              I diagnose where AI actually moves the needle in your business — then implement
              alongside the team you already trust.{' '}
              <span style={{ fontStyle: 'italic', color: '#2A8F65' }}>
                Ninety-day payback, or I don't build it.
              </span>
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.3, duration: 0.7 }}
              className="flex flex-col sm:flex-row items-start gap-3"
            >
              <a
                href="/assessment"
                className="btn-magnetic inline-flex items-center gap-2.5 px-7 py-3.5 bg-accent text-white"
                style={{ fontFamily: '"Source Serif 4", serif', fontWeight: 600, fontSize: '16px' }}
              >
                Build your Blueprint <ArrowRight size={18} />
              </a>
              <a
                href="/scorecard"
                className="inline-flex items-center gap-2 px-7 py-3.5 text-ink-mute hover:text-black"
                style={{
                  fontFamily: '"Source Serif 4", serif',
                  fontWeight: 600,
                  fontSize: '16px',
                  fontStyle: 'italic',
                }}
              >
                Are you Agent-Ready? <ArrowRight size={16} />
              </a>
            </motion.div>
          </div>

          {/* Right column — live data panel */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1.0, duration: 1.0 }}
            className="border-l pl-8"
            style={{ borderColor: 'rgba(26,26,26,0.12)' }}
          >
            <div
              className="mb-6"
              style={{
                fontFamily: '"IBM Plex Mono", monospace',
                fontSize: '10px',
                letterSpacing: '0.25em',
                textTransform: 'uppercase',
                color: 'rgba(26,26,26,0.5)',
              }}
            >
              Telemetry · Updated live
            </div>

            <div className="space-y-7">
              {/* Stat 1 */}
              <div>
                <div style={{ fontSize: '52px', lineHeight: 1, color: '#1A1A1A' }}>
                  <CountUp to={47} delay={1.4} />
                </div>
                <div
                  className="mt-2"
                  style={{
                    fontFamily: '"IBM Plex Mono", monospace',
                    fontSize: '10px',
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                    color: 'rgba(26,26,26,0.55)',
                  }}
                >
                  Systems shipped
                </div>
              </div>

              {/* Stat 2 with capacity bar */}
              <div>
                <div style={{ fontSize: '52px', lineHeight: 1, color: '#1A1A1A' }}>
                  <CountUp to={240} prefix="$" suffix="M" delay={1.7} />
                </div>
                <div
                  className="mt-2"
                  style={{
                    fontFamily: '"IBM Plex Mono", monospace',
                    fontSize: '10px',
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                    color: 'rgba(26,26,26,0.55)',
                  }}
                >
                  Productivity unlocked
                </div>
              </div>

              {/* Stat 3 */}
              <div>
                <div style={{ fontSize: '52px', lineHeight: 1, color: '#2A8F65' }}>
                  <CountUp to={0} delay={2.0} />
                </div>
                <div
                  className="mt-2"
                  style={{
                    fontFamily: '"IBM Plex Mono", monospace',
                    fontSize: '10px',
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                    color: 'rgba(26,26,26,0.55)',
                  }}
                >
                  Layoffs caused
                </div>
              </div>

              {/* Capacity bar */}
              <div className="pt-4 border-t" style={{ borderColor: 'rgba(26,26,26,0.12)' }}>
                <div className="flex justify-between mb-2"
                  style={{
                    fontFamily: '"IBM Plex Mono", monospace',
                    fontSize: '10px',
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                    color: 'rgba(26,26,26,0.55)',
                  }}
                >
                  <span>Q3 Capacity</span>
                  <span>60%</span>
                </div>
                <div className="h-1 w-full" style={{ backgroundColor: 'rgba(26,26,26,0.1)' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: '60%' }}
                    transition={{ delay: 2.2, duration: 1.4, ease: [0.22, 0.84, 0.36, 1] }}
                    className="h-full"
                    style={{ backgroundColor: '#2A8F65' }}
                  />
                </div>
              </div>

              {/* Mini bar chart */}
              <div>
                <div
                  className="mb-2"
                  style={{
                    fontFamily: '"IBM Plex Mono", monospace',
                    fontSize: '10px',
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                    color: 'rgba(26,26,26,0.55)',
                  }}
                >
                  Deployments · last 8 weeks
                </div>
                <div className="flex items-end gap-1.5 h-12">
                  {[2, 4, 3, 5, 2, 6, 4, 3].map((h, i) => (
                    <motion.div
                      key={i}
                      initial={{ height: 0 }}
                      animate={{ height: `${h * 14}%` }}
                      transition={{ delay: 2.4 + i * 0.08, duration: 0.6 }}
                      className="flex-1"
                      style={{ backgroundColor: i === 7 ? '#2A8F65' : 'rgba(26,26,26,0.4)' }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default HeroK;

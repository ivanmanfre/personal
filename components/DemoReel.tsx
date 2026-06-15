import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, MousePointer2 } from 'lucide-react';
import { prefersReduced } from './editorial';

// ─────────────────────────────────────────────────────────────────────────────
// DemoReel — an autoplaying, Apple/Linear-style product demo for the hero of
// /content-system. Real product screenshots animate step by step with kinetic
// captions and a fake cursor, on a loop, in the cream/sage editorial palette.
// Coded (not a video file) so it stays crisp and editable; can be screen-recorded
// to mp4 later. Honours prefers-reduced-motion (shows the end card, no motion).
// Brand source of truth: ~/.claude/memory/global/brand-visual-system.md
// ─────────────────────────────────────────────────────────────────────────────

const R = prefersReduced;
const EASE = [0.22, 0.84, 0.36, 1] as const;

type Beat = {
  verb: string;        // the kinetic emphasis word(s)
  rest: string;        // remainder of the caption
  sub: string;         // small supporting line
  shot: string;
  alt: string;
  badge?: string;      // optional stamp on the frame (e.g. QA PASSED)
  cursor?: { x: number; y: number }; // % of stage; if set, cursor glides here + clicks
};

const BEATS: Beat[] = [
  { verb: 'It finds', rest: 'the idea.', sub: 'From your calls, the web and your past winners.', shot: '/content-system/ui/board.webp', alt: 'The content pipeline board filling with drafted ideas' },
  { verb: 'Written', rest: 'in your voice.', sub: 'Trained on how you actually talk.', shot: '/content-system/ui/editor.webp', alt: 'The post editor showing a draft in Ivan’s voice' },
  { verb: 'No', rest: 'AI slop.', sub: 'Nine-point QA, then a de-slop lint.', shot: '/content-system/ui/editor.webp', alt: 'A draft passing the anti-slop quality gate', badge: 'QA passed' },
  { verb: 'You approve', rest: 'in one tap.', sub: 'Your only step. Under ten minutes a day.', shot: '/content-system/ui/board.webp', alt: 'Approving a finished draft on the board', cursor: { x: 84, y: 30 } },
  { verb: 'It ships', rest: 'the whole funnel.', sub: 'Posts and lead magnets, scheduled for you.', shot: '/content-system/ui/calendar.webp', alt: 'The publishing calendar scheduling posts' },
  { verb: 'It learns', rest: 'what works.', sub: 'Next week leans toward what landed.', shot: '/content-system/ui/performance.webp', alt: 'The performance dashboard tracking results' },
];

const STEP_MS = 3000;
const END_MS = 4200;
const END = BEATS.length; // end-card index

export const DemoReel: React.FC = () => {
  const [i, setI] = useState(R ? END : 0);
  const [paused, setPaused] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pause when the tab is hidden (saves cycles, avoids a jump on return).
  useEffect(() => {
    const onVis = () => setPaused(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    if (R || paused) return;
    const dur = i === END ? END_MS : STEP_MS;
    timer.current = setTimeout(() => setI((p) => (p + 1) % (END + 1)), dur);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [i, paused]);

  const onEnd = i === END;
  const beat = onEnd ? null : BEATS[i];

  return (
    <div className="dr-root" aria-label="Auto-playing product demo">
      <style>{CSS}</style>

      {/* Caption */}
      <div className="dr-caption" aria-live="off">
        <AnimatePresence mode="wait">
          {beat ? (
            <motion.h3
              key={`cap-${i}`}
              className="dr-cap-h"
              initial={R ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={R ? undefined : { opacity: 0, y: -12 }}
              transition={{ duration: 0.5, ease: EASE }}
            >
              <span className="dr-verb">{beat.verb}</span> {beat.rest}
            </motion.h3>
          ) : (
            <motion.h3
              key="cap-end"
              className="dr-cap-h"
              initial={R ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={R ? undefined : { opacity: 0, y: -12 }}
              transition={{ duration: 0.5, ease: EASE }}
            >
              All of it. <span className="dr-verb">On autopilot.</span>
            </motion.h3>
          )}
        </AnimatePresence>
        <div className="dr-sub-wrap">
          <AnimatePresence mode="wait">
            <motion.p
              key={`sub-${i}`}
              className="dr-sub"
              initial={R ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={R ? undefined : { opacity: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              {beat ? beat.sub : 'Five posts a week, plus carousels and lead magnets, all on autopilot.'}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>

      {/* Stage */}
      <div className="dr-stage">
        <div className="dr-chrome" aria-hidden="true"><span /><span /><span /></div>
        <div className="dr-screen">
          <AnimatePresence mode="popLayout">
            {beat ? (
              <motion.img
                key={`shot-${i}`}
                src={beat.shot}
                alt={beat.alt}
                className="dr-shot"
                initial={R ? false : { opacity: 0, scale: 1.06 }}
                animate={{ opacity: 1, scale: R ? 1 : 1.01 }}
                exit={R ? undefined : { opacity: 0, scale: 1.0 }}
                transition={{ opacity: { duration: 0.55, ease: EASE }, scale: { duration: STEP_MS / 1000, ease: 'linear' } }}
              />
            ) : (
              <motion.div
                key="end"
                className="dr-end"
                initial={R ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={R ? undefined : { opacity: 0 }}
                transition={{ duration: 0.5 }}
              >
                <div className="dr-end-kicker">The content system</div>
                <div className="dr-end-h">Five posts a week,<br />without writing a word.</div>
                <a className="dr-end-cta" href="/start">Book a 20-min look <ArrowRight size={16} aria-hidden="true" /></a>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Optional badge stamp */}
          <AnimatePresence>
            {beat?.badge && (
              <motion.div
                key={`badge-${i}`}
                className="dr-badge"
                initial={R ? false : { opacity: 0, scale: 0.6, rotate: -8 }}
                animate={{ opacity: 1, scale: 1, rotate: -6 }}
                exit={R ? undefined : { opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.45, ease: EASE, delay: 0.6 }}
              >
                ✓ {beat.badge}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Fake cursor (only on action beats) */}
          {!R && beat?.cursor && (
            <motion.div
              key={`cur-${i}`}
              className="dr-cursor"
              initial={{ left: '50%', top: '64%', opacity: 0 }}
              animate={{ left: `${beat.cursor.x}%`, top: `${beat.cursor.y}%`, opacity: 1 }}
              transition={{ duration: 0.9, ease: EASE }}
            >
              <MousePointer2 size={22} className="dr-cursor-i" />
              <motion.span
                className="dr-click"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: [0, 1.8], opacity: [0.6, 0] }}
                transition={{ duration: 0.6, delay: 1.0, ease: 'easeOut' }}
              />
            </motion.div>
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="dr-progress" aria-hidden="true">
        {Array.from({ length: END + 1 }).map((_, k) => (
          <button
            key={k}
            className={`dr-dot ${k === i ? 'is-on' : ''}`}
            onClick={() => setI(k)}
            tabIndex={-1}
            aria-label={`Go to step ${k + 1}`}
          />
        ))}
      </div>
    </div>
  );
};

const CSS = `
.dr-root{position:relative;width:100%}
.dr-caption{min-height:96px;text-align:center;margin-bottom:18px}
.dr-cap-h{font-family:"DM Serif Display",Georgia,serif;font-weight:400;font-size:clamp(1.6rem,3.4vw,2.6rem);line-height:1.08;letter-spacing:-0.01em;color:#1A1A1A;margin:0}
.dr-verb{font-style:italic;color:var(--color-accent-ink)}
.dr-sub-wrap{height:24px;margin-top:10px}
.dr-sub{font-family:"Source Serif 4",Georgia,serif;font-size:15px;color:var(--color-ink-soft);margin:0}

.dr-stage{position:relative;border-radius:14px;overflow:hidden;border:1px solid var(--color-hairline-bold);background:#0E0F12;box-shadow:0 30px 80px -28px rgba(0,0,0,.5)}
.dr-chrome{display:flex;gap:7px;align-items:center;padding:11px 14px;border-bottom:1px solid rgba(255,255,255,.07)}
.dr-chrome span{width:11px;height:11px;border-radius:50%;background:rgba(255,255,255,.18)}
.dr-screen{position:relative;width:100%;aspect-ratio:16/9.4;overflow:hidden;background:#0E0F12}
.dr-shot{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:top}

.dr-end{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;text-align:center;background:radial-gradient(120% 120% at 50% 0%, #14181f 0%, #0E0F12 60%);padding:24px}
.dr-end-kicker{font-family:"IBM Plex Mono",monospace;font-size:11px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:#7fd0a6}
.dr-end-h{font-family:"DM Serif Display",Georgia,serif;font-size:clamp(1.5rem,3.4vw,2.4rem);line-height:1.12;color:#F7F4EF}
.dr-end-cta{display:inline-flex;align-items:center;gap:8px;font-family:"Source Serif 4",Georgia,serif;font-style:italic;font-weight:600;font-size:16px;padding:12px 22px;border-radius:6px;background:var(--color-accent);color:#fff;text-decoration:none;transition:transform .2s,background .2s}
.dr-end-cta:hover{background:#2FA876;transform:translateY(-1px)}

.dr-badge{position:absolute;top:16px;right:16px;font-family:"IBM Plex Mono",monospace;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#0E0F12;background:#7fd0a6;padding:7px 12px;border-radius:6px;box-shadow:0 8px 24px -8px rgba(0,0,0,.5)}

.dr-cursor{position:absolute;z-index:3;transform:translate(-3px,-3px);color:#fff;filter:drop-shadow(0 2px 4px rgba(0,0,0,.6))}
.dr-cursor-i{fill:#fff}
.dr-click{position:absolute;left:-2px;top:-2px;width:30px;height:30px;border-radius:50%;border:2px solid #7fd0a6;background:rgba(127,208,166,.25)}

.dr-progress{display:flex;gap:8px;justify-content:center;margin-top:18px}
.dr-dot{width:30px;height:4px;border-radius:2px;border:0;padding:0;background:var(--color-hairline-bold);cursor:pointer;transition:background .3s}
.dr-dot.is-on{background:var(--color-accent)}
`;

export default DemoReel;

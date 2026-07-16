import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { submitGrade, submitGradeCapture, type GradeVerdict } from '../lib/gradeApi';
import { SPECIMENS } from '../lib/gradeSpecimens';

// ── Black Box canon v4 (same tokens as ScanReportPage; module-private by convention) ──
const SERIF = '"Schibsted Grotesk", system-ui, -apple-system, sans-serif';
const BODY_SERIF = '"Source Serif 4", Georgia, serif';
const INK = '#131210';
const RED = '#C8361B';
const PAPER = '#FFFFFF';
const MUTED = '#6B675E';
const SEC = '#4A463E';
const HAIR = '#C9C2B2';
const EASE = [0.22, 0.84, 0.36, 1] as const;

const PAGE_VARS: React.CSSProperties = {
  ['--color-paper' as any]: PAPER,
  ['--color-ink' as any]: INK,
  ['--color-hairline' as any]: HAIR,
  background: PAPER,
  color: INK,
  minHeight: '100vh',
};

// The composition's single red lives on the rewrite figure in the verdict,
// so the wordmark here renders ink-only (unlike scan reports, where ON carries it).
const Wordmark: React.FC = () => (
  <span style={{ fontFamily: SERIF, fontWeight: 500, letterSpacing: '-0.02em', fontSize: 18, lineHeight: 1, color: INK, whiteSpace: 'nowrap' }}>
    INBOUND<span style={{ fontWeight: 900 }}>ON</span>STEROIDS
  </span>
);

const Label: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: MUTED, ...style }}>
    {children}
  </div>
);

// Count-up figure: 0 → target, cubic ease-out, tabular numerals so nothing jitters.
const CountUp: React.FC<{ to: number; color?: string; delay?: number; size?: number }> = ({ to, color = INK, delay = 0, size = 48 }) => {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now() + delay * 1000;
    const dur = 900;
    const tick = (t: number) => {
      if (t < start) { raf = requestAnimationFrame(tick); return; }
      const k = Math.min(1, (t - start) / dur);
      setVal(Math.round(to * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, delay]);
  return (
    <div style={{ fontFamily: SERIF, fontWeight: 800, fontSize: size, letterSpacing: '-0.02em', color, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
      {val}%
    </div>
  );
};

// Ten-cell measurement strip; cells fill one by one.
const CellStrip: React.FC<{ pct: number; delay?: number; cellW?: number; cellH?: number }> = ({ pct, delay = 0, cellW = 17, cellH = 24 }) => {
  const filled = Math.max(0, Math.min(10, Math.round(pct / 10)));
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {Array.from({ length: 10 }, (_, i) => (
        <motion.div
          key={i}
          initial={{ background: 'rgba(19,18,16,0)' }}
          animate={{ background: i < filled ? 'rgba(19,18,16,1)' : 'rgba(19,18,16,0)' }}
          transition={{ delay: delay + i * 0.07, duration: 0.12 }}
          style={{ width: cellW, height: cellH, border: `1.5px solid ${INK}` }}
        />
      ))}
    </div>
  );
};

// Static mini strip for the specimen log (no animation, it scrolls).
const MiniStrip: React.FC<{ pct: number }> = ({ pct }) => {
  const filled = Math.max(0, Math.min(10, Math.round(pct / 10)));
  return (
    <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
      {Array.from({ length: 10 }, (_, i) => (
        <div key={i} style={{ width: 7, height: 12, border: `1px solid ${INK}`, background: i < filled ? INK : 'transparent' }} />
      ))}
    </div>
  );
};

// The measured range drawn on the instrument face: a 0-35 rule with the two real
// list anchors (worst 6, best 21) and a marker for this hook.
const RangeScale: React.FC<{ pct: number; delay?: number }> = ({ pct, delay = 0 }) => {
  const MAX = 35;
  const x = (v: number) => `${Math.min(100, (v / MAX) * 100)}%`;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay, duration: 0.4 }} style={{ marginTop: 24 }}>
      <Label style={{ marginBottom: 12 }}>Where it sits on the measured range</Label>
      <div style={{ position: 'relative', height: 44, margin: '0 26px 0 4px' }}>
        <div style={{ position: 'absolute', top: 18, left: 0, right: 0, height: 1.5, background: INK }} />
        {[{ v: 6, t: 'WORST LIST. 6' }, { v: 21, t: 'BEST LIST. 21' }, { v: 35, t: 'CEILING. 35' }].map(a => (
          <div key={a.v} style={{ position: 'absolute', left: x(a.v), top: 0, transform: 'translateX(-50%)', textAlign: 'center' }}>
            <div style={{ width: 1.5, height: 10, background: MUTED, margin: '13px auto 0' }} />
            <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 9, letterSpacing: '0.1em', color: MUTED, marginTop: 4, whiteSpace: 'nowrap' }}>{a.t}</div>
          </div>
        ))}
        <motion.div
          initial={{ left: '0%', opacity: 0 }}
          animate={{ left: x(Math.min(pct, MAX)), opacity: 1 }}
          transition={{ delay: delay + 0.2, duration: 0.9, ease: EASE as any }}
          style={{ position: 'absolute', top: 4, transform: 'translateX(-50%)', textAlign: 'center' }}
        >
          <div style={{ fontFamily: SERIF, fontWeight: 800, fontSize: 10, letterSpacing: '0.08em', color: INK, marginBottom: 1 }}>YOURS</div>
          <div style={{ width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: `9px solid ${INK}`, margin: '0 auto' }} />
        </motion.div>
      </div>
    </motion.div>
  );
};

const READ_STEPS = [
  'Reading the hook.',
  'Holding it against 5,092 measured hooks.',
  'Scoring the crowd it pulls.',
  'Writing the verdict.',
];

// Instrument reading sequence shown while the engine runs (~14s live).
const ReadingSequence: React.FC = () => {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep(s => Math.min(s + 1, READ_STEPS.length - 1)), 3800);
    return () => clearInterval(id);
  }, []);
  return (
    <div style={{ padding: '10px 0 4px' }}>
      {READ_STEPS.map((s, i) => (
        <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', opacity: i <= step ? 1 : 0.22, transition: 'opacity 0.4s' }}>
          <span style={{ fontFamily: SERIF, fontWeight: 800, fontSize: 11, letterSpacing: '0.1em', color: i < step ? MUTED : INK, minWidth: 24 }}>
            {i < step ? 'OK' : String(i + 1).padStart(2, '0')}
          </span>
          <span style={{ fontFamily: SERIF, fontWeight: i === step ? 800 : 700, fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase', color: i === step ? INK : MUTED }}>
            {s}
          </span>
          {i === step && (
            <motion.span
              animate={{ opacity: [1, 0.15, 1] }}
              transition={{ repeat: Infinity, duration: 1.1 }}
              style={{ display: 'inline-block', width: 9, height: 14, background: INK }}
            />
          )}
        </div>
      ))}
    </div>
  );
};

const inputBase: React.CSSProperties = {
  width: '100%',
  fontFamily: BODY_SERIF,
  fontSize: 16,
  color: INK,
  background: PAPER,
  border: `1.5px solid ${INK}`,
  borderRadius: 0,
  padding: '12px 14px',
  outline: 'none',
  boxSizing: 'border-box',
};

// Three real specimens as one-click chips: shortest first so they read as chips.
const CHIP_SPECIMENS = [...SPECIMENS].sort((a, b) => a.hook.length - b.hook.length).slice(0, 3);

type Stage = 'form' | 'grading' | 'verdict';

const ScanGradePage: React.FC = () => {
  const [hook, setHook] = useState('');
  const [audience, setAudience] = useState('');
  const [stage, setStage] = useState<Stage>('form');
  const [verdict, setVerdict] = useState<GradeVerdict | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [captureState, setCaptureState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (stage === 'verdict') boxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [stage]);

  const runGrade = async (text: string, aud: string) => {
    const trimmed = text.trim();
    if (trimmed.length < 10) {
      setError('Paste the actual hook. Ten characters minimum.');
      return;
    }
    setError(null);
    setHook(trimmed);
    setStage('grading');
    boxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    try {
      const v = await submitGrade(trimmed, aud.trim());
      setVerdict(v);
      setStage('verdict');
      setCaptureState('idle');
    } catch (e) {
      setError('The grader hit a snag. Give it another run.');
      setStage('form');
    }
  };

  const handleCapture = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setCaptureState('error');
      return;
    }
    setCaptureState('sending');
    try {
      await submitGradeCapture({ email: email.trim(), hook: hook.trim(), audience: audience.trim(), verdict });
      setCaptureState('done');
    } catch {
      setCaptureState('error');
    }
  };

  // specimen log: split into two columns for the scrolling wall
  const colA = SPECIMENS.filter((_, i) => i % 2 === 0);
  const colB = SPECIMENS.filter((_, i) => i % 2 === 1);

  return (
    <div style={PAGE_VARS}>
      {/* vertical marquee keyframes for the specimen log */}
      <style>{`
        @keyframes gradeLogScroll { 0% { transform: translateY(0); } 100% { transform: translateY(-50%); } }
        .grade-log-col { animation: gradeLogScroll 46s linear infinite; }
        .grade-log-col.slow { animation-duration: 58s; }
        .grade-log:hover .grade-log-col { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) { .grade-log-col { animation: none; } }
      `}</style>

      {/* header */}
      <header style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '18px 20px', borderBottom: `2.5px solid ${INK}` }}>
        <Wordmark />
        <Label>Instrument 01 — Hook Grader</Label>
      </header>

      <main style={{ maxWidth: 860, margin: '0 auto', padding: '44px 20px 96px' }}>
        {/* hero */}
        <Label>The Hook Grader</Label>
        <h1 style={{ fontFamily: SERIF, fontWeight: 800, fontSize: 'clamp(34px, 6.4vw, 58px)', letterSpacing: '-0.03em', lineHeight: 1.02, margin: '10px 0 14px', color: INK }}>
          Paste your hook. See who it lets in.
        </h1>
        <p style={{ fontFamily: BODY_SERIF, fontSize: 16, lineHeight: 1.55, color: SEC, margin: '0 0 22px', maxWidth: 640 }}>
          It measures one thing: the buyer share of the crowd your hook pulls in. The scale comes from measured comment sections, worst list 6%, best list 21%.
        </p>

        {/* receipt stat row */}
        <div style={{ display: 'flex', borderTop: `2.5px solid ${INK}`, borderBottom: `1px solid ${HAIR}`, marginBottom: 34 }}>
          {[
            ['5,092', 'hooks pulled'],
            ['53', 'creators measured'],
            ['731', 'commenters scored'],
            ['400', 'graded blind'],
          ].map(([n, t], i) => (
            <div key={t} style={{ flex: 1, padding: '14px 4px 12px 0', borderLeft: i ? `1px solid ${HAIR}` : 'none', paddingLeft: i ? 14 : 0 }}>
              <div style={{ fontFamily: SERIF, fontWeight: 800, fontSize: 'clamp(20px, 3.6vw, 30px)', letterSpacing: '-0.02em', color: INK, lineHeight: 1 }}>{n}</div>
              <Label style={{ marginTop: 6, fontSize: 10 }}>{t}</Label>
            </div>
          ))}
        </div>

        {/* THE INSTRUMENT — heavy rule + hairline offset; the page's one sanctioned tilt */}
        <div ref={boxRef} style={{ scrollMarginTop: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <Label>{stage === 'verdict' ? 'Hook Grader. Live verdict' : 'The instrument'}</Label>
            <Label>For agency owners</Label>
          </div>
          <div style={{ border: `1px solid ${HAIR}`, padding: 5, transform: 'rotate(-0.35deg)' }}>
            <div style={{ border: `3px solid ${INK}`, padding: '22px 22px 24px', background: PAPER }}>

              {stage === 'form' && (
                <div>
                  <Label style={{ marginBottom: 10 }}>Your lead magnet hook</Label>
                  <textarea
                    value={hook}
                    onChange={(e) => setHook(e.target.value)}
                    rows={3}
                    maxLength={600}
                    placeholder="The first two lines of your post, or the title of the thing you give away…"
                    style={{
                      width: '100%', boxSizing: 'border-box', border: 'none', outline: 'none', resize: 'vertical',
                      fontFamily: BODY_SERIF, fontStyle: 'italic', fontSize: 'clamp(18px, 2.6vw, 23px)', lineHeight: 1.45,
                      color: INK, background: PAPER, padding: 0, minHeight: 96, caretColor: RED,
                    }}
                  />
                  <div style={{ height: 1, background: HAIR, margin: '6px 0 16px' }} />
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    <input
                      value={audience}
                      onChange={(e) => setAudience(e.target.value)}
                      maxLength={200}
                      placeholder="Who you sell to (optional)"
                      style={{ ...inputBase, flex: '1 1 240px', width: 'auto', fontSize: 14.5, padding: '10px 12px', borderWidth: 1.5 }}
                    />
                    <button
                      onClick={() => runGrade(hook, audience)}
                      style={{
                        fontFamily: SERIF, fontWeight: 800, fontSize: 15, letterSpacing: '0.1em',
                        background: INK, color: PAPER, border: 'none', borderRadius: 0,
                        padding: '13px 34px', cursor: 'pointer',
                      }}
                    >
                      GRADE IT
                    </button>
                  </div>
                  {error && (
                    <p style={{ fontFamily: BODY_SERIF, fontSize: 14.5, color: INK, margin: '12px 0 0' }}>{error}</p>
                  )}
                  <div style={{ marginTop: 18 }}>
                    <Label style={{ marginBottom: 8 }}>No hook on you? Grade a specimen from the corpus</Label>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {CHIP_SPECIMENS.map(s => (
                        <button
                          key={s.hook}
                          onClick={() => runGrade(s.hook.replace('…', ''), '')}
                          style={{
                            fontFamily: BODY_SERIF, fontStyle: 'italic', fontSize: 13, color: SEC,
                            background: PAPER, border: `1px solid ${HAIR}`, borderRadius: 0,
                            padding: '7px 12px', cursor: 'pointer', textAlign: 'left', maxWidth: 250,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}
                        >
                          {s.hook.slice(0, 44)}…
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {stage === 'grading' && (
                <div>
                  <Label style={{ marginBottom: 6 }}>The hook under the instrument</Label>
                  <p style={{ fontFamily: BODY_SERIF, fontStyle: 'italic', fontSize: 17, lineHeight: 1.5, color: INK, margin: '0 0 12px', whiteSpace: 'pre-wrap' }}>
                    {hook}
                  </p>
                  <div style={{ height: 1, background: HAIR }} />
                  <ReadingSequence />
                  <p style={{ fontFamily: BODY_SERIF, fontStyle: 'italic', fontSize: 13.5, color: MUTED, margin: '8px 0 0' }}>
                    Takes about fifteen seconds. The scale came from 731 commenters scored one by one.
                  </p>
                </div>
              )}

              {stage === 'verdict' && verdict && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <Label style={{ marginBottom: 10 }}>The hook you pasted</Label>
                    <div style={{ fontFamily: SERIF, fontWeight: 800, fontSize: 11, letterSpacing: '0.12em', color: INK, border: `2px solid ${INK}`, padding: '4px 10px', whiteSpace: 'nowrap' }}>
                      {verdict.width_verdict} HOOK
                    </div>
                  </div>
                  <p style={{ fontFamily: BODY_SERIF, fontStyle: 'italic', fontSize: 18, lineHeight: 1.5, color: INK, margin: '0 0 24px', whiteSpace: 'pre-wrap' }}>
                    {verdict.hook}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', borderTop: `1px solid ${HAIR}`, paddingTop: 18 }}>
                    <div>
                      <Label style={{ marginBottom: 8 }}>As run. Buyer share of the crowd</Label>
                      <CellStrip pct={verdict.fit_estimate_pct} delay={0.3} />
                    </div>
                    <CountUp to={verdict.fit_estimate_pct} delay={0.3} />
                  </div>

                  <RangeScale pct={verdict.fit_estimate_pct} delay={1.1} />

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', borderTop: `1px solid ${HAIR}`, paddingTop: 18, marginTop: 26 }}>
                    <div>
                      <Label style={{ marginBottom: 8 }}>After the rewrite</Label>
                      {/* strip stays ink: the composition's single red is the rewrite figure */}
                      <CellStrip pct={verdict.rewrite_fit_estimate_pct} delay={1.7} />
                      <p style={{ fontFamily: BODY_SERIF, fontStyle: 'italic', fontSize: 15.5, color: SEC, margin: '12px 0 0', maxWidth: 460 }}>
                        "{verdict.rewrite}"
                      </p>
                    </div>
                    <CountUp to={verdict.rewrite_fit_estimate_pct} color={RED} delay={1.7} />
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </div>

        {/* verdict prose + capture */}
        {stage === 'verdict' && verdict && (
          <div>
            <div style={{ marginTop: 24 }}>
              {([
                ['Who it lets in', verdict.lets_in],
                ['Who scrolls past', verdict.turns_away],
                ['The leak', verdict.the_leak],
                ['One move', verdict.one_move],
              ] as const).map(([label, text], i) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 2.3 + i * 0.15, duration: 0.4, ease: EASE as any }}
                  style={{ borderTop: `1px solid ${HAIR}`, padding: '14px 0' }}
                >
                  <Label style={{ marginBottom: 6 }}>{label}</Label>
                  <p style={{ fontFamily: BODY_SERIF, fontSize: 15.5, lineHeight: 1.55, color: SEC, margin: 0 }}>{text}</p>
                </motion.div>
              ))}
            </div>

            <p style={{ fontFamily: BODY_SERIF, fontSize: 14.5, lineHeight: 1.55, color: MUTED, margin: '16px 0 0' }}>
              A tighter hook usually means fewer commenters and a larger share of buyers. That trade is the point.
            </p>

            {/* capture */}
            <div style={{ border: `1.5px solid ${INK}`, padding: '22px 22px 24px', marginTop: 30 }}>
              {captureState === 'done' ? (
                <p style={{ fontFamily: BODY_SERIF, fontSize: 15.5, color: INK, margin: 0 }}>
                  On its way. Check your inbox in the next day or so.
                </p>
              ) : (
                <>
                  <p style={{ fontFamily: BODY_SERIF, fontSize: 15.5, lineHeight: 1.55, color: INK, margin: '0 0 14px' }}>
                    Want the full breakdown, the rewrite reasoning and the fit math, in your inbox?
                  </p>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <input
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); if (captureState === 'error') setCaptureState('idle'); }}
                      type="email"
                      placeholder="your email"
                      style={{ ...inputBase, flex: '1 1 220px', width: 'auto' }}
                    />
                    <button
                      onClick={handleCapture}
                      disabled={captureState === 'sending'}
                      style={{
                        fontFamily: SERIF, fontWeight: 800, fontSize: 14, letterSpacing: '0.1em',
                        background: INK, color: PAPER, border: 'none', borderRadius: 0,
                        padding: '12px 24px', cursor: captureState === 'sending' ? 'wait' : 'pointer',
                      }}
                    >
                      {captureState === 'sending' ? 'SENDING…' : 'SEND THE BREAKDOWN'}
                    </button>
                  </div>
                  {captureState === 'error' && (
                    <p style={{ fontFamily: BODY_SERIF, fontSize: 14, color: INK, margin: '10px 0 0' }}>
                      That email did not go through. Check it and try again.
                    </p>
                  )}
                </>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 12, marginTop: 24 }}>
              <p style={{ fontFamily: BODY_SERIF, fontSize: 15, lineHeight: 1.55, color: SEC, margin: 0, maxWidth: 560 }}>
                I also built a longer one that reads your whole inbound setup and lead magnet. No call needed, you just get the read.{' '}
                <a href="https://ivanmanfredi.com/audit" style={{ color: INK, fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 3 }}>
                  Run the full scan →
                </a>
              </p>
              <button
                onClick={() => { setStage('form'); setVerdict(null); setCaptureState('idle'); setEmail(''); setHook(''); }}
                style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', background: 'transparent', color: MUTED, border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}
              >
                Grade another hook
              </button>
            </div>
          </div>
        )}

        {/* SPECIMEN LOG — real hooks from the blind validation batch, click to grade */}
        <div style={{ marginTop: 56 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: `2.5px solid ${INK}`, paddingBottom: 8, marginBottom: 0 }}>
            <Label style={{ color: INK }}>From the log. Real hooks, graded blind by this engine</Label>
            <Label>Click one to re-run it live</Label>
          </div>
          <div
            className="grade-log"
            style={{ display: 'flex', gap: 0, height: 330, overflow: 'hidden', position: 'relative', borderBottom: `1px solid ${HAIR}` }}
          >
            {[colA, colB].map((col, ci) => (
              <div key={ci} style={{ flex: 1, overflow: 'hidden', borderLeft: ci ? `1px solid ${HAIR}` : 'none' }}>
                <div className={`grade-log-col${ci ? ' slow' : ''}`}>
                  {[...col, ...col].map((s, i) => (
                    <div
                      key={i}
                      onClick={() => runGrade(s.hook.replace('…', ''), '')}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderBottom: `1px solid ${HAIR}`, cursor: 'pointer' }}
                    >
                      <MiniStrip pct={s.fit} />
                      <span style={{ fontFamily: SERIF, fontWeight: 800, fontSize: 14, color: INK, minWidth: 34, fontVariantNumeric: 'tabular-nums' }}>{s.fit}%</span>
                      <span style={{ fontFamily: BODY_SERIF, fontStyle: 'italic', fontSize: 13.5, color: SEC, lineHeight: 1.35, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                        {s.hook}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {/* bottom fade so the loop reads as a log, done with paper (flat, no gradient tint) */}
          </div>
          <p style={{ fontFamily: BODY_SERIF, fontSize: 13.5, lineHeight: 1.55, color: MUTED, margin: '12px 0 0' }}>
            400 hooks from 53 creators went through this exact engine blind, top and bottom performers both. These are a few, truncated and unattributed. A famous hook and a 2% buyer share sit together just fine, and that is the whole point of measuring.
          </p>
        </div>

        {/* method, compressed to a ledger line */}
        <p style={{ fontFamily: BODY_SERIF, fontSize: 13, lineHeight: 1.55, color: MUTED, margin: '40px 0 0', borderTop: `1px solid ${HAIR}`, paddingTop: 16 }}>
          The work behind the number: 5,092 hooks pulled from 53 B2B creators with real engagement attached; 731 commenters from giveaway posts scored one by one with the same filter I run my own leads through. Best list measured 21% real buyers, worst 6%, and nothing cold clears about 35. If your hook scores 6, that is what 6 looks like on a real list. Data pulled July 2026; method and raw numbers on request.
        </p>
      </main>
    </div>
  );
};

export default ScanGradePage;

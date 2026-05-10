import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import { useMetadata } from '../hooks/useMetadata';
import { preconditions, flatQuestions } from '../lib/preconditions';
import { computeScoresFromSubScores, scoreCard, ScoreMap, SubScores } from '../lib/scorecard';
import { INDUSTRIES, IndustryKey } from '../lib/industries';
import ScorecardQuestion from './scorecard/ScorecardQuestion';

type Stage = 'intro' | 'industry' | 'quiz' | 'submitting' | 'error';

const SUPABASE_BASE =
  import.meta.env.VITE_SUPABASE_URL || 'https://bjbvqvzbzczjbatgmccb.supabase.co';
const SUBMIT_ENDPOINT = `${SUPABASE_BASE}/functions/v1/scorecard-submit`;

const ease = [0.22, 0.84, 0.36, 1] as const;

function extractUtm(): Record<string, string> | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach((k) => {
    const v = params.get(k);
    if (v) utm[k] = v;
  });
  return Object.keys(utm).length ? utm : null;
}

const TOTAL_QUESTIONS = flatQuestions.length;

const SubmittingEscape: React.FC<{ onRetry: () => void }> = ({ onRetry }) => {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setShow(true), 6000);
    return () => window.clearTimeout(t);
  }, []);
  if (!show) return null;
  return (
    <p className="text-sm text-ink-mute">
      Taking longer than expected.{' '}
      <button
        type="button"
        onClick={onRetry}
        className="underline underline-offset-4 decoration-accent hover:text-black transition-colors"
      >
        Try again
      </button>
      .
    </p>
  );
};

// Word-by-word blur reveal for the H1, mirroring the landing hero pattern.
const RevealWord: React.FC<{ children: React.ReactNode; delay: number; italic?: boolean }> = ({
  children,
  delay,
  italic,
}) => (
  <motion.span
    initial={{ opacity: 0, y: 38, filter: 'blur(10px)' }}
    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
    transition={{ delay, duration: 0.85, ease }}
    style={{ display: 'inline-block', fontStyle: italic ? 'italic' : 'normal' }}
  >
    {children}
  </motion.span>
);

const ScorecardPage: React.FC = () => {
  useMetadata({
    title: 'Will your AI build survive production? — The Agent-Ready Scorecard | Manfredi',
    description:
      'A 2-minute self-check against the four preconditions every AI deployment needs before it ships. Verdict, per-precondition breakdown, and a path to your next move. No email required to see the score.',
    canonical: 'https://ivanmanfredi.com/scorecard',
  });

  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>('intro');
  const [industry, setIndustry] = useState<IndustryKey | null>(null);
  const [subScores, setSubScores] = useState<SubScores>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const current = flatQuestions[currentIndex];

  // Hide the global Footer during quiz/submitting so the funnel doesn't bleed
  // into newsletter/links chrome below the fold.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const hide = stage === 'quiz' || stage === 'submitting';
    document.body.classList.toggle('hide-site-footer', hide);
    return () => {
      document.body.classList.remove('hide-site-footer');
    };
  }, [stage]);

  useEffect(() => {
    if (stage === 'submitting' && typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [stage]);

  const submitScores = async (allSubs: SubScores) => {
    setStage('submitting');
    setSubmitError(null);
    let scores: ScoreMap;
    let result: ReturnType<typeof scoreCard>;
    try {
      scores = computeScoresFromSubScores(allSubs);
      result = scoreCard(scores);
    } catch (err) {
      console.error('scorecard scoring failed', err);
      setSubmitError('Could not compute your verdict. Refresh and try again.');
      setStage('error');
      return;
    }

    const ctrl = new AbortController();
    const timeoutId = setTimeout(() => ctrl.abort(), 12000);

    try {
      const res = await fetch(SUBMIT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scores,
          verdict: result.verdict,
          industry: industry ?? undefined,
          referrer: typeof document !== 'undefined' ? document.referrer || null : null,
          utm: extractUtm(),
        }),
        signal: ctrl.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.id) throw new Error('Missing id in response');

      const targetUrl = `/scorecard/result/${json.id}`;
      try {
        navigate(targetUrl, { state: { justSubmitted: true, scores, industry } });
      } catch (navErr) {
        console.error('navigate failed, falling back to hard redirect', navErr);
      }

      window.setTimeout(() => {
        if (window.location.pathname !== targetUrl) {
          window.location.assign(targetUrl);
        }
      }, 1200);
    } catch (err) {
      clearTimeout(timeoutId);
      const msg = err instanceof Error && err.name === 'AbortError'
        ? 'Submission timed out. Check your connection and try again.'
        : 'Something on our end. Try again in a sec.';
      console.error('scorecard submit failed', err);
      setSubmitError(msg);
      setStage('error');
    }
  };

  const handleAnswer = (subId: string, score: number) => {
    const next = { ...subScores, [subId]: score };
    setSubScores(next);
    if (currentIndex < TOTAL_QUESTIONS - 1) {
      setTimeout(() => setCurrentIndex((i) => i + 1), 220);
    } else {
      setTimeout(() => submitScores(next), 320);
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    } else {
      // From the first question, go back to the industry step
      setStage('industry');
    }
  };

  const handleRetry = () => {
    if (Object.keys(subScores).length === TOTAL_QUESTIONS) {
      submitScores(subScores);
    } else {
      setStage('quiz');
    }
  };

  const handleIndustrySelect = (key: IndustryKey) => {
    setIndustry(key);
    // Brief beat so the selection is visible, then advance.
    setTimeout(() => setStage('quiz'), 260);
  };

  return (
    <div className="min-h-screen bg-paper relative overflow-hidden">
      {/* Slow drifting paper grain — same texture as the landing hero */}
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none opacity-20 z-0"
        animate={{ backgroundPosition: ['0px 0px', '120px 120px'] }}
        transition={{ duration: 90, repeat: Infinity, ease: 'linear' }}
        style={{
          backgroundImage:
            'url("data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22/></filter><rect width=%22120%22 height=%22120%22 filter=%22url(%23n)%22 opacity=%220.3%22/></svg>")',
        }}
      />

      {/* Expanding sage rule across the top — same motif as landing */}
      {stage === 'intro' && (
        <motion.div
          aria-hidden="true"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.2, duration: 1.6, ease }}
          className="absolute top-[5.25rem] left-0 right-0 h-px z-[5]"
          style={{
            backgroundColor: 'var(--color-accent)',
            transformOrigin: 'left',
            opacity: 0.32,
          }}
        />
      )}

      <section className="pt-32 pb-24 px-6 relative z-10">
        <div className="container mx-auto max-w-3xl">
          <AnimatePresence mode="wait">
            {stage === 'intro' && (
              <motion.div
                key="intro"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.4 }}
              >
                {/* Eyebrow with pulsing dot — preserves the Agent-Ready brand */}
                <motion.div
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25, duration: 0.6, ease }}
                  className="mb-10 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-ink-mute"
                >
                  <motion.span
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    style={{ color: 'var(--color-accent)', fontSize: '8px' }}
                  >
                    ●
                  </motion.span>
                  <span>The Agent-Ready Scorecard · 2 minutes · No email to see your score</span>
                </motion.div>

                {/* Stakes-led H1 with word-by-word reveal + sage sweep on italic pivot */}
                <h1
                  className="mb-10"
                  style={{
                    fontFamily: '"DM Serif Display", "Bodoni Moda", Georgia, serif',
                    fontWeight: 400,
                    fontSize: 'clamp(2.6rem, 6.4vw, 5.4rem)',
                    lineHeight: 1.0,
                    letterSpacing: '-0.02em',
                    color: '#1A1A1A',
                  }}
                >
                  <RevealWord delay={0.35}>Will</RevealWord>{' '}
                  <RevealWord delay={0.46}>your</RevealWord>{' '}
                  <RevealWord delay={0.57}>AI</RevealWord>{' '}
                  <RevealWord delay={0.68}>build</RevealWord>
                  <br />
                  <motion.span
                    initial={{ opacity: 0, y: 60, filter: 'blur(18px)', rotateX: 28 }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)', rotateX: 0 }}
                    transition={{ delay: 0.85, duration: 0.9, ease }}
                    style={{
                      display: 'inline-block',
                      fontStyle: 'italic',
                      position: 'relative',
                      transformStyle: 'preserve-3d',
                      transformOrigin: 'bottom',
                    }}
                  >
                    survive
                    <motion.span
                      aria-hidden="true"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ delay: 1.4, duration: 0.7, ease }}
                      style={{
                        position: 'absolute',
                        left: '-2%',
                        right: '-2%',
                        bottom: '0.18em',
                        height: '0.44em',
                        backgroundColor: 'var(--color-accent)',
                        transformOrigin: 'left',
                        opacity: 0.28,
                        zIndex: -1,
                      }}
                    />
                  </motion.span>{' '}
                  <RevealWord delay={1.0}>production?</RevealWord>
                </h1>

                {/* Body — clip-mask reveal */}
                <motion.p
                  initial={{ opacity: 0, clipPath: 'inset(0 100% 0 0)' }}
                  animate={{ opacity: 1, clipPath: 'inset(0 0% 0 0)' }}
                  transition={{ delay: 1.05, duration: 1.0, ease }}
                  className="text-xl text-ink-soft max-w-2xl leading-relaxed mb-6"
                  style={{ fontFamily: '"Source Serif 4", Georgia, serif' }}
                >
                  Most AI projects break in production — a brittle input, a decision rule no one
                  wrote down, a scope that quietly widened until it never shipped. Twelve questions
                  across the four preconditions every AI deployment needs.{' '}
                  <span className="font-drama italic" style={{ color: 'var(--color-accent)' }}>
                    Verdict in two minutes, breakdown for free.
                  </span>
                </motion.p>

                {/* Pain-led promise bullets — visceral preview of the output */}
                <motion.ul
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.3, duration: 0.7, ease }}
                  className="space-y-2 mb-12 max-w-xl"
                  style={{ fontFamily: '"Source Serif 4", Georgia, serif' }}
                >
                  {[
                    'The precondition most likely to block your first agent from shipping.',
                    'Where in your stack the input pipeline silently breaks the build.',
                    'Which decision logic sits in one person\'s head — and what happens when they leave.',
                  ].map((line, i) => (
                    <li key={i} className="flex gap-3 text-base text-ink-soft leading-relaxed">
                      <span
                        aria-hidden="true"
                        className="mt-2.5 shrink-0 w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: 'var(--color-accent)' }}
                      />
                      <span>{line}</span>
                    </li>
                  ))}
                </motion.ul>

                {/* What you'll be scored on — preserved card, slightly tighter */}
                <motion.div
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.5, duration: 0.7, ease }}
                  className="bg-paper border border-[color:var(--color-hairline)] p-8 md:p-10 mb-12"
                >
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute mb-6">
                    What you'll be scored on
                  </p>
                  <div className="grid md:grid-cols-2 gap-6">
                    {preconditions.map((p, i) => (
                      <motion.div
                        key={p.key}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 1.6 + i * 0.08, duration: 0.5, ease }}
                        className="flex gap-4 border-l border-[color:var(--color-hairline-bold)] pl-5 py-1"
                      >
                        <span className="font-mono text-xs text-ink-mute mt-1">{p.number}</span>
                        <div className="flex-1">
                          <h3 className="font-mono text-sm uppercase tracking-widest font-bold mb-1.5">
                            {p.title}
                          </h3>
                          <p className="text-sm text-ink-soft leading-relaxed mb-2">
                            {p.description}
                          </p>
                          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">
                            3 questions
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>

                <motion.button
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.95, duration: 0.5, ease }}
                  type="button"
                  onClick={() => setStage('industry')}
                  className="btn-magnetic px-8 py-4 bg-accent border-subtle-thick shadow-card-subtle inline-flex items-center gap-3 font-semibold text-base tracking-wide text-white"
                >
                  Start the scorecard <ArrowRight aria-hidden="true" size={18} />
                </motion.button>
              </motion.div>
            )}

            {stage === 'industry' && (
              <motion.div
                key="industry"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.4, ease }}
              >
                <button
                  type="button"
                  onClick={() => setStage('intro')}
                  className="font-mono text-xs uppercase tracking-[0.18em] text-ink-mute hover:text-black flex items-center gap-2 transition-colors mb-10"
                >
                  <ArrowLeft aria-hidden="true" size={14} /> Back
                </button>

                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-mute mb-4">
                  Context · before we start
                </p>
                <h2
                  className="mb-3"
                  style={{
                    fontFamily: '"DM Serif Display", "Bodoni Moda", Georgia, serif',
                    fontWeight: 400,
                    fontSize: 'clamp(2rem, 4.4vw, 3.4rem)',
                    lineHeight: 1.05,
                    letterSpacing: '-0.02em',
                    color: '#1A1A1A',
                  }}
                >
                  Which best describes <span className="font-drama italic">your business?</span>
                </h2>
                <p className="text-base text-ink-soft mb-8 max-w-xl leading-relaxed">
                  Your verdict is industry-agnostic, but the weak-spot framing on your result page
                  is sharper when we know what you do.
                </p>

                <div className="grid sm:grid-cols-2 gap-3">
                  {INDUSTRIES.map((ind, i) => (
                    <motion.button
                      key={ind.key}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + i * 0.04, duration: 0.45, ease }}
                      type="button"
                      onClick={() => handleIndustrySelect(ind.key)}
                      className={`group text-left px-5 py-4 border transition-all ${
                        industry === ind.key
                          ? 'border-accent bg-accent/[0.04]'
                          : 'border-[color:var(--color-hairline-bold)] hover:border-ink hover:bg-paper-raise'
                      }`}
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span className="text-base font-medium leading-snug">{ind.label}</span>
                        <ArrowRight
                          aria-hidden="true"
                          size={16}
                          className="text-ink-mute opacity-0 group-hover:opacity-100 transition-opacity"
                        />
                      </span>
                    </motion.button>
                  ))}
                </div>

                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute mt-8">
                  This question is optional context · doesn't count toward your 12
                </p>
              </motion.div>
            )}

            {stage === 'quiz' && current && (
              <motion.div
                key={`quiz-${currentIndex}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex items-center justify-between mb-6">
                  <button
                    type="button"
                    onClick={handleBack}
                    className="font-mono text-xs uppercase tracking-[0.18em] text-ink-mute hover:text-black flex items-center gap-2 transition-colors"
                  >
                    <ArrowLeft aria-hidden="true" size={14} /> Back
                  </button>
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute">
                    {String(currentIndex + 1).padStart(2, '0')} / {String(TOTAL_QUESTIONS).padStart(2, '0')}
                  </span>
                </div>

                <div className="flex items-center gap-1 mb-6">
                  {flatQuestions.map((q, i) => (
                    <span
                      key={q.sub.id}
                      className={`h-1 flex-1 transition-all ${
                        i === currentIndex
                          ? 'bg-accent'
                          : i < currentIndex
                          ? 'bg-ink-mute'
                          : 'bg-[color:var(--color-hairline-bold)]'
                      }`}
                    />
                  ))}
                </div>

                <ScorecardQuestion
                  preconditionNumber={current.preconditionNumber}
                  preconditionTitle={current.preconditionTitle}
                  subIndex={current.subIndex}
                  totalSubs={3}
                  angle={current.sub.angle}
                  question={current.sub.question}
                  scoreLabels={current.sub.scoreLabels}
                  value={subScores[current.sub.id] ?? null}
                  onChange={(score) => handleAnswer(current.sub.id, score)}
                />
              </motion.div>
            )}

            {stage === 'submitting' && (
              <motion.div
                key="submitting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-32 text-center"
              >
                <div className="inline-flex items-center gap-3 font-mono text-sm uppercase tracking-[0.18em] text-ink-mute mb-6">
                  <span className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  Calculating your verdict
                </div>
                <SubmittingEscape onRetry={handleRetry} />
              </motion.div>
            )}

            {stage === 'error' && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="py-24 text-center"
              >
                <p className="text-xl text-ink-soft mb-6">{submitError}</p>
                <button
                  type="button"
                  onClick={handleRetry}
                  className="btn-magnetic px-7 py-3.5 bg-accent text-white font-semibold tracking-wide inline-flex items-center gap-2"
                >
                  Try again <ArrowRight aria-hidden="true" size={18} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>
    </div>
  );
};

export default ScorecardPage;

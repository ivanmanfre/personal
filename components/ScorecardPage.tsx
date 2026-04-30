import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import { useMetadata } from '../hooks/useMetadata';
import { preconditions, PreconditionKey } from '../lib/preconditions';
import { scoreCard, ScoreMap } from '../lib/scorecard';
import ScorecardQuestion from './scorecard/ScorecardQuestion';

type Stage = 'intro' | 'quiz' | 'submitting' | 'error';

const SUPABASE_BASE =
  import.meta.env.VITE_SUPABASE_URL || 'https://bjbvqvzbzczjbatgmccb.supabase.co';
const SUBMIT_ENDPOINT = `${SUPABASE_BASE}/functions/v1/scorecard-submit`;

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

const ScorecardPage: React.FC = () => {
  useMetadata({
    title: 'Are you Agent-Ready? — The 4-precondition Scorecard | Manfredi',
    description:
      'A 60-second self-check against the four preconditions every AI deployment needs before it ships. Get your score and a personalized 30-day roadmap by email.',
    canonical: 'https://ivanmanfredi.com/scorecard',
  });

  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>('intro');
  const [answers, setAnswers] = useState<Partial<ScoreMap>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const total = preconditions.length;
  const currentPrecondition = preconditions[currentIndex];

  useEffect(() => {
    if (stage === 'submitting' && typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [stage]);

  const submitScores = async (allAnswers: ScoreMap) => {
    setStage('submitting');
    setSubmitError(null);
    const result = scoreCard(allAnswers);
    try {
      const res = await fetch(SUBMIT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scores: allAnswers,
          verdict: result.verdict,
          referrer: typeof document !== 'undefined' ? document.referrer || null : null,
          utm: extractUtm(),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.id) throw new Error('Missing id in response');

      // Hand off to the result viewer with state so it can render without a fresh fetch
      navigate(`/scorecard/result/${json.id}`, {
        state: { justSubmitted: true, scores: allAnswers },
      });
    } catch (err) {
      console.error('scorecard submit failed', err);
      setSubmitError('Something on our end. Try again in a sec.');
      setStage('error');
    }
  };

  const handleAnswer = (key: PreconditionKey, score: number) => {
    const next = { ...answers, [key]: score };
    setAnswers(next);
    if (currentIndex < total - 1) {
      setTimeout(() => setCurrentIndex((i) => i + 1), 250);
    } else {
      // Last question — submit + navigate
      setTimeout(() => submitScores(next as ScoreMap), 350);
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) setCurrentIndex((i) => i - 1);
  };

  const handleRetry = () => {
    if (preconditions.every((p) => typeof answers[p.key] === 'number')) {
      submitScores(answers as ScoreMap);
    } else {
      setStage('quiz');
    }
  };

  return (
    <div className="min-h-screen bg-paper">
      <section className="pt-32 pb-24 px-6">
        <div className="container mx-auto max-w-3xl">
          <AnimatePresence mode="wait">
            {stage === 'intro' && (
              <motion.div
                key="intro"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.4 }}
              >
                <div className="mb-6">
                  <span className="inline-block text-xs uppercase tracking-[0.1em] font-medium text-ink-soft border border-[color:var(--color-hairline-bold)] rounded px-2 py-1">
                    Agent-Ready Scorecard
                  </span>
                </div>
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold leading-[1.05] tracking-tighter mb-6">
                  Are you <span className="font-drama italic font-normal">Agent-Ready?</span>
                </h1>
                <p className="text-xl text-ink-soft max-w-2xl leading-relaxed mb-12">
                  Four questions, one per precondition. 60 seconds. You'll get a verdict, a per-precondition breakdown, and a path to your next move. No email required to see the score.
                </p>

                <div className="bg-paper border border-[color:var(--color-hairline)] p-8 md:p-10 mb-12">
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute mb-6">
                    What you'll be scored on
                  </p>
                  <div className="grid md:grid-cols-2 gap-6">
                    {preconditions.map((p) => (
                      <div
                        key={p.key}
                        className="flex gap-4 border-l border-[color:var(--color-hairline-bold)] pl-5 py-1"
                      >
                        <span className="font-mono text-xs text-ink-mute mt-1">{p.number}</span>
                        <div className="flex-1">
                          <h3 className="font-mono text-sm uppercase tracking-widest font-bold mb-1.5">
                            {p.title}
                          </h3>
                          <p className="text-sm text-ink-soft leading-relaxed">
                            {p.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setStage('quiz')}
                  className="btn-magnetic px-8 py-4 bg-accent border-subtle-thick shadow-card-subtle inline-flex items-center gap-3 font-semibold text-base tracking-wide text-white"
                >
                  Start the scorecard <ArrowRight aria-hidden="true" size={18} />
                </button>
              </motion.div>
            )}

            {stage === 'quiz' && currentPrecondition && (
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
                    disabled={currentIndex === 0}
                    className="font-mono text-xs uppercase tracking-[0.18em] text-ink-mute hover:text-black disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                  >
                    <ArrowLeft aria-hidden="true" size={14} /> Back
                  </button>
                  <div className="flex items-center gap-2">
                    {preconditions.map((_, i) => (
                      <span
                        key={i}
                        className={`h-1 transition-all ${i === currentIndex ? 'w-8 bg-accent' : i < currentIndex ? 'w-4 bg-ink-mute' : 'w-4 bg-[color:var(--color-hairline-bold)]'}`}
                      />
                    ))}
                  </div>
                </div>

                <ScorecardQuestion
                  precondition={currentPrecondition}
                  index={currentIndex}
                  total={total}
                  value={answers[currentPrecondition.key] ?? null}
                  onChange={(score) => handleAnswer(currentPrecondition.key, score)}
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
                <div className="inline-flex items-center gap-3 font-mono text-sm uppercase tracking-[0.18em] text-ink-mute">
                  <span className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  Calculating your verdict
                </div>
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

import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import { useMetadata } from '../hooks/useMetadata';
import { preconditions, PreconditionKey } from '../lib/preconditions';
import { scoreCard, ScoreMap, ScorecardResult as ResultType } from '../lib/scorecard';
import ScorecardQuestion from './scorecard/ScorecardQuestion';
import ScorecardResult from './scorecard/ScorecardResult';

type Stage = 'intro' | 'quiz' | 'result';

const ScorecardPage: React.FC = () => {
  useMetadata({
    title: 'Are you Agent-Ready? — The 4-precondition Scorecard | Manfredi',
    description:
      'A 60-second self-check against the four preconditions every AI deployment needs before it ships. Get your score and a personalized 30-day roadmap by email.',
    canonical: 'https://ivanmanfredi.com/scorecard',
  });

  const [stage, setStage] = useState<Stage>('intro');
  const [answers, setAnswers] = useState<Partial<ScoreMap>>({});
  const [currentIndex, setCurrentIndex] = useState(0);

  const total = preconditions.length;
  const currentPrecondition = preconditions[currentIndex];

  const result: ResultType | null = useMemo(() => {
    const allAnswered = preconditions.every((p) => typeof answers[p.key] === 'number');
    if (!allAnswered) return null;
    return scoreCard(answers as ScoreMap);
  }, [answers]);

  useEffect(() => {
    if (stage === 'result' && typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [stage]);

  const handleAnswer = (key: PreconditionKey, score: number) => {
    setAnswers((prev) => ({ ...prev, [key]: score }));
    if (currentIndex < total - 1) {
      setTimeout(() => setCurrentIndex((i) => i + 1), 250);
    } else {
      setTimeout(() => setStage('result'), 350);
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
  };

  const handleRestart = () => {
    setAnswers({});
    setCurrentIndex(0);
    setStage('intro');
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
                {/* Progress + back */}
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

            {stage === 'result' && result && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <ScorecardResult result={result} onRestart={handleRestart} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>
    </div>
  );
};

export default ScorecardPage;

import React, { useEffect, useState } from 'react';
import { useParams, useLocation, Navigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { useMetadata } from '../hooks/useMetadata';
import { ScoreMap, scoreCard, ScorecardResult as ResultType } from '../lib/scorecard';
import { IndustryKey } from '../lib/industries';
import ScorecardResult from './scorecard/ScorecardResult';

const SUPABASE_BASE =
  import.meta.env.VITE_SUPABASE_URL || 'https://bjbvqvzbzczjbatgmccb.supabase.co';
const GET_ENDPOINT = `${SUPABASE_BASE}/functions/v1/scorecard-get`;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface LocationState {
  justSubmitted?: boolean;
  scores?: ScoreMap;
  industry?: IndustryKey | null;
}

const ScorecardResultViewerPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const state = (location.state ?? {}) as LocationState;

  const [result, setResult] = useState<ResultType | null>(
    state.scores ? scoreCard(state.scores) : null
  );
  const [industry, setIndustry] = useState<IndustryKey | null>(state.industry ?? null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!result);

  useMetadata({
    title: result
      ? `Agent-Ready Score: ${result.verdictLabel} (${result.total}/20) | Manfredi`
      : 'Agent-Ready Scorecard | Manfredi',
    description:
      'A 60-second self-check against the four preconditions every AI deployment needs before it ships.',
    canonical: id ? `https://ivanmanfredi.com/scorecard/result/${id}` : 'https://ivanmanfredi.com/scorecard',
  });

  useEffect(() => {
    if (!id || !UUID_RE.test(id)) return;
    if (result) {
      // We already have data via location state
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${GET_ENDPOINT}?id=${id}`);
        if (!res.ok) {
          if (res.status === 404) throw new Error('not_found');
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        if (cancelled) return;
        setResult(scoreCard(data.scores as ScoreMap));
        if (data.industry) setIndustry(data.industry as IndustryKey);
      } catch (err) {
        if (cancelled) return;
        console.error('scorecard-get failed', err);
        setError(err instanceof Error && err.message === 'not_found' ? 'not_found' : 'fetch');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, result]);

  if (!id || !UUID_RE.test(id)) {
    return <Navigate to="/scorecard" replace />;
  }

  return (
    <div className="min-h-screen bg-paper">
      <section className="pt-32 pb-24 px-6">
        <div className="container mx-auto max-w-3xl">
          <Link
            to="/scorecard"
            className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-ink-mute hover:text-black transition-colors mb-10"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            {state.justSubmitted ? 'Back to the Scorecard' : 'Take your own scorecard'}
          </Link>

          {loading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-32 text-center"
            >
              <div className="inline-flex items-center gap-3 font-mono text-sm uppercase tracking-[0.18em] text-ink-mute">
                <span className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                Loading verdict
              </div>
            </motion.div>
          )}

          {error === 'not_found' && (
            <motion.div
              key="notfound"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="py-24"
            >
              <h1 className="text-4xl font-semibold tracking-tight mb-6">
                Result not found
              </h1>
              <p className="text-lg text-ink-soft leading-relaxed mb-8 max-w-xl">
                That scorecard ID doesn't match anything in our records. The link may be old or malformed.
              </p>
              <Link
                to="/scorecard"
                className="btn-magnetic px-7 py-3.5 bg-accent text-white font-semibold tracking-wide inline-flex items-center gap-2"
              >
                Take the scorecard →
              </Link>
            </motion.div>
          )}

          {error === 'fetch' && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="py-24 text-center"
            >
              <p className="text-xl text-ink-soft mb-6">
                Couldn't load the verdict. Try refreshing.
              </p>
            </motion.div>
          )}

          {result && !error && (
            <ScorecardResult
              result={result}
              id={id}
              industry={industry}
              mode={state.justSubmitted ? 'submit' : 'view'}
            />
          )}
        </div>
      </section>
    </div>
  );
};

export default ScorecardResultViewerPage;

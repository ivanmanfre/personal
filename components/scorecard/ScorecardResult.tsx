import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Check, Share2 } from 'lucide-react';
import { preconditions, PreconditionKey } from '../../lib/preconditions';
import type { ScorecardResult as ResultType } from '../../lib/scorecard';

const SUPABASE_BASE =
  import.meta.env.VITE_SUPABASE_URL || 'https://bjbvqvzbzczjbatgmccb.supabase.co';
const ADD_EMAIL_ENDPOINT = `${SUPABASE_BASE}/functions/v1/scorecard-add-email`;
const SHARE_ENDPOINT = `${SUPABASE_BASE}/functions/v1/scorecard-share`;
// Share URL routes through the Cloudflare Worker at scorecard-share.ivanmanfredi.workers.dev
// which serves per-result OG cards (Satori-rendered PNG with italic-serif verdict + score).
// LinkedIn scrapers fetch the rich preview; browsers JS-redirect to /scorecard/result/:id.
// Override via VITE_SHARE_DOMAIN — e.g. once share.ivanmanfredi.com is added to Cloudflare DNS.
const SHARE_DOMAIN =
  import.meta.env.VITE_SHARE_DOMAIN ||
  'https://scorecard-share.ivanmanfredi.workers.dev';
const USING_WORKER =
  SHARE_DOMAIN.includes('workers.dev') ||
  SHARE_DOMAIN.includes('share.ivanmanfredi.com');

interface Props {
  result: ResultType;
  /** Row id from Supabase. When present, share + email-update flows are wired. */
  id?: string;
  /** 'submit' = post-quiz, show email gate. 'view' = visitor from share link, hide gate, show "take your own" CTA. */
  mode?: 'submit' | 'view';
  onRestart?: () => void;
}

const ScorecardResult: React.FC<Props> = ({ result, id, mode = 'submit', onRestart }) => {
  const [email, setEmail] = useState('');
  const [submitState, setSubmitState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);

  const shareUrl = id
    ? USING_WORKER
      ? `${SHARE_DOMAIN}/scorecard/${id}`
      : `${SHARE_DOMAIN}/share/scorecard/?ref=${id}`
    : '';

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) {
      setError('Missing result id — refresh and try again.');
      return;
    }
    if (!email || !email.includes('@')) {
      setError('Use a real email so we know where to send the roadmap.');
      return;
    }
    setSubmitState('sending');
    setError(null);
    try {
      const res = await fetch(ADD_EMAIL_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, email }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSubmitState('sent');
    } catch (err) {
      console.error('add-email failed', err);
      setSubmitState('error');
      setError('Something on our end. Try again in a sec.');
    }
  };

  const handleShare = async () => {
    if (!id) return;

    // Best-effort share-count increment
    fetch(SHARE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(() => {});

    // Copy URL to clipboard
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2400);
    } catch {
      // Fallback: open LinkedIn share dialog directly
    }

    // Open LinkedIn share dialog
    const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
    window.open(linkedinUrl, '_blank', 'noopener,noreferrer,width=720,height=600');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-8"
    >
      {/* Verdict block */}
      <div className="bg-paper border border-[color:var(--color-hairline)] shadow-card-subtle p-8 md:p-12">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-8 border-b border-[color:var(--color-hairline)] pb-6">
          <span className="font-mono text-xs uppercase tracking-[0.18em] text-ink-mute">
            {mode === 'view' ? 'Agent-Ready score' : 'Your Agent-Ready score'}
          </span>
          <span className="font-mono text-xs uppercase tracking-[0.18em] text-ink-mute">
            {result.total} / 20
          </span>
        </div>

        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute mb-2">
              Verdict
            </p>
            <p className="text-5xl md:text-7xl font-semibold tracking-tight leading-[0.95]">
              <span className="font-drama italic font-normal">{result.verdictLabel}</span>
            </p>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-7xl md:text-8xl font-drama italic font-normal leading-none text-accent">
              {result.total}
            </span>
            <span className="font-mono text-xs uppercase tracking-[0.18em] text-ink-mute pb-3">
              of 20
            </span>
          </div>
        </div>

        <p className="text-lg md:text-xl text-ink-soft leading-relaxed mb-10 max-w-2xl">
          {result.recommendation}
        </p>

        <div className="flex flex-col sm:flex-row items-start gap-3">
          <a
            href={result.ctaHref}
            className="btn-magnetic w-full sm:w-auto px-7 py-3.5 bg-accent border-subtle-thick shadow-card-subtle flex items-center justify-center gap-2.5 font-semibold text-base tracking-wide text-white"
          >
            {result.ctaLabel} <ArrowRight aria-hidden="true" size={18} />
          </a>

          {id && (
            <button
              type="button"
              onClick={handleShare}
              className="w-full sm:w-auto px-7 py-3.5 font-semibold text-base tracking-wide text-ink-mute hover:text-black transition-colors text-center flex items-center justify-center gap-2 border border-[color:var(--color-hairline-bold)]"
            >
              <Share2 size={16} aria-hidden="true" />
              {shareCopied ? 'Link copied' : 'Share to LinkedIn'}
            </button>
          )}

          {mode === 'submit' && onRestart && (
            <button
              type="button"
              onClick={onRestart}
              className="w-full sm:w-auto px-7 py-3.5 font-semibold text-base tracking-wide text-ink-mute hover:text-black transition-colors text-center"
            >
              Retake the scorecard
            </button>
          )}

          {mode === 'view' && (
            <Link
              to="/scorecard"
              className="w-full sm:w-auto px-7 py-3.5 font-semibold text-base tracking-wide text-ink-mute hover:text-black transition-colors text-center"
            >
              Take your own scorecard →
            </Link>
          )}
        </div>

        {id && shareCopied && (
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute mt-6">
            URL copied · also opening LinkedIn
          </p>
        )}
      </div>

      {/* Per-precondition breakdown */}
      <div className="bg-paper border border-[color:var(--color-hairline)] p-8 md:p-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute mb-6">
          By precondition
        </p>
        <div className="grid md:grid-cols-2 gap-6">
          {preconditions.map((p) => {
            const score = result.scores[p.key as PreconditionKey];
            const isWeakest = result.weakest.includes(p.key);
            return (
              <div
                key={p.key}
                className={`border-l pl-5 py-2 ${isWeakest ? 'border-accent' : 'border-[color:var(--color-hairline-bold)]'}`}
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="font-mono text-xs uppercase tracking-[0.16em] text-ink-soft">
                    {p.title}
                  </span>
                  <span className={`font-mono text-sm tabular-nums ${isWeakest ? 'text-accent font-bold' : 'text-ink-mute'}`}>
                    {score}/5
                  </span>
                </div>
                <p className="text-sm text-ink-soft leading-relaxed">
                  {p.description}
                </p>
              </div>
            );
          })}
        </div>
        {result.weakest.length > 0 && (
          <p className="text-sm text-ink-mute mt-6 pt-6 border-t border-[color:var(--color-hairline)]">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] mr-2">Weak spot</span>
            Start by tightening {result.weakest.length === 1 ? 'this precondition' : 'these preconditions'} before any AI build.
          </p>
        )}
      </div>

      {/* Email gate — only in submit mode, only if we have an id */}
      {mode === 'submit' && id && (
        <div className="bg-paper-sunk border border-[color:var(--color-hairline)] p-8 md:p-10">
          {submitState === 'sent' ? (
            <div className="flex items-start gap-4">
              <Check size={24} className="text-accent shrink-0 mt-1" strokeWidth={3} />
              <div>
                <p className="text-lg font-semibold mb-2">
                  Roadmap is on the way.
                </p>
                <p className="text-ink-soft leading-relaxed">
                  Check your inbox in the next few minutes. Reply to that email if you want to talk through the verdict.
                </p>
              </div>
            </div>
          ) : (
            <>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute mb-3">
                Optional
              </p>
              <h3 className="text-2xl md:text-3xl font-semibold tracking-tight mb-3">
                Get your <span className="font-drama italic font-normal">30-day roadmap</span> by email
              </h3>
              <p className="text-ink-soft leading-relaxed mb-6 max-w-xl">
                A short PDF that walks through your weak spots, the order to fix them in, and what to ship in the first 30 days. No newsletter spam.
              </p>
              <form onSubmit={handleEmailSubmit} className="flex flex-col sm:flex-row gap-3 max-w-xl">
                <input
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitState === 'sending'}
                  className="flex-1 px-5 py-3.5 bg-paper border border-[color:var(--color-hairline-bold)] text-base focus:outline-none focus:border-accent transition-colors"
                  required
                />
                <button
                  type="submit"
                  disabled={submitState === 'sending'}
                  className="btn-magnetic px-7 py-3.5 bg-black text-white font-semibold text-base tracking-wide flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {submitState === 'sending' ? 'Sending…' : 'Send the roadmap'}
                  {submitState !== 'sending' && <ArrowRight aria-hidden="true" size={18} />}
                </button>
              </form>
              {error && (
                <p className="text-sm text-red-700 mt-3">{error}</p>
              )}
            </>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default ScorecardResult;

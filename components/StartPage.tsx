import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ArrowLeft, Check } from 'lucide-react';
import { useMetadata } from '../hooks/useMetadata';
import { withUtmParams } from '../lib/utmCapture';

interface FormData {
  companySize: string;
  revenue: string;
  bottleneck: string;
  priorAttempt: string;
  budget: string;
  timeline: string;
  decisionMaker: string;
  email: string;
  name: string;
}

const companySizeOptions = [
  'Solo',
  '2–10',
  '10–30',
  '30–100',
  '100+',
];

const revenueOptions = [
  'Under $500k',
  '$500k–$1M',
  '$1M–$3M',
  '$3M–$10M',
  '$10M+',
];

const budgetOptions = [
  '$5k–$15k',
  '$15k–$30k',
  '$30k+',
  'Retainer',
];

const timelineOptions = [
  'This month',
  'Next 90 days',
  '6 months out',
  'Just exploring',
];

const decisionMakerOptions = [
  'Yes, it is my call',
  'I am the lead, others sign off',
  'I influence, someone else decides',
  'I am researching',
];

const TOTAL_STEPS = 4;
const STEP_TITLES = ['Your business', 'The problem', 'Fit', 'Where to send it'];

// Wave 0 / P30-1: Calendly URL is decorated with first-touch UTMs at click time
// (see useEffect below) so calendar_events.utm_* gets populated.
const CALENDLY_URL_BASE = 'https://calendly.com/im-ivanmanfredi/30min';

// Shared label + option-button styles (font-mono labels use ink-mute = #5A5752, AA-pass).
const labelCls = 'font-mono text-xs uppercase tracking-widest text-ink-mute block mb-3';
const optionCls = (active: boolean) =>
  `px-4 py-2 border font-medium text-sm transition-all ${
    active
      ? 'bg-black text-white border-black'
      : 'bg-paper text-ink-soft border-zinc-300 hover:border-black'
  }`;

const StartPage: React.FC = () => {
  useMetadata({
    title: 'Book a call | Manfredi',
    description: 'Answer 7 quick questions to help me come prepared. Filters for decision-maker, timeline, and budget fit so we don\'t waste each other\'s 30 minutes.',
    canonical: 'https://inboundonsteroids.com/',
  });
  const [step, setStep] = useState<'form' | 'approved' | 'waitlist'>('form');
  const [qStep, setQStep] = useState(0);
  const [form, setForm] = useState<FormData>({
    companySize: '',
    revenue: '',
    bottleneck: '',
    priorAttempt: '',
    budget: '',
    timeline: '',
    decisionMaker: '',
    email: '',
    name: '',
  });

  // Per-step gating — mirrors the original required set (companySize, revenue,
  // bottleneck, budget, name, email). Timeline/decisionMaker/priorAttempt stay
  // optional so qualification routing is unchanged.
  const canProceed = (s: number): boolean => {
    if (s === 0) return !!form.companySize && !!form.revenue;
    if (s === 1) return !!form.bottleneck.trim() && !!form.budget;
    if (s === 2) return true;
    if (s === 3) return !!form.name.trim() && !!form.email.trim();
    return false;
  };

  const submit = () => {
    // Qualification: meaningful company size, real budget, true decision authority, actionable timeline.
    const qualified =
      form.companySize !== 'Solo' &&
      form.companySize !== '2–10' &&
      form.decisionMaker !== 'I am researching' &&
      form.timeline !== 'Just exploring';

    // Fire-and-forget pipeline capture via lm-beacon - same pattern as lead magnet captures.
    fetch('https://bjbvqvzbzczjbatgmccb.supabase.co/functions/v1/lm-beacon', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: 'capture',
        lm_slug: qualified ? 'start-qualified' : 'start-waitlist',
        email: form.email,
        src: 'start-form',
        metadata: {
          name: form.name,
          company_size: form.companySize,
          revenue: form.revenue,
          bottleneck: form.bottleneck,
          prior_attempt: form.priorAttempt,
          budget: form.budget,
          timeline: form.timeline,
          decision_maker: form.decisionMaker,
        },
      }),
    }).catch(() => {
      /* silent - routing is client-side, capture is best-effort */
    });

    setStep(qualified ? 'approved' : 'waitlist');
  };

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canProceed(qStep)) return;
    if (qStep < TOTAL_STEPS - 1) {
      setQStep(qStep + 1);
    } else {
      submit();
    }
  };

  if (step === 'approved') {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center px-6 pt-32 pb-16">
        <div className="max-w-2xl w-full bg-paper rounded-2xl border border-[color:var(--color-hairline)] p-8 md:p-12 shadow-card-subtle text-center">
          <div className="w-16 h-16 bg-accent/20 border border-accent flex items-center justify-center mx-auto mb-6">
            <Check size={32} className="text-black" strokeWidth={3} />
          </div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4">
            You're a good fit.
          </h1>
          <p className="text-ink-soft mb-8 leading-relaxed">
            Based on what you shared, let's talk. Pick a time below. I'll come prepped - you don't have to re-explain anything.
          </p>
          <a
            href={withUtmParams(CALENDLY_URL_BASE, { utm_medium: 'calendly_link', booking_source_path: window.location.pathname })}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-magnetic inline-flex items-center gap-3 px-8 py-4 bg-black text-white font-bold tracking-wide border-subtle shadow-card"
          >
            Book a 30-minute call
            <ArrowRight aria-hidden="true" size={18} />
          </a>
          <p className="mt-8 text-sm text-ink-mute">
            Or skip the call: <a href="/assessment" className="underline hover:text-black">start with the $2,000 Blueprint</a>.
          </p>
        </div>
      </div>
    );
  }

  if (step === 'waitlist') {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center px-6 pt-32 pb-16">
        <div className="max-w-2xl w-full bg-paper rounded-2xl border border-[color:var(--color-hairline)] p-8 md:p-12 shadow-card-subtle text-center">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4">
            Thanks for sharing.
          </h1>
          <p className="text-ink-soft mb-8 leading-relaxed">
            Based on company stage and budget, a custom engagement isn't the best next move right now. Two better options:
          </p>
          <div className="space-y-4 text-left mb-8">
            <div className="border border-zinc-300 p-5 bg-paper">
              <h3 className="font-bold mb-2">The Agent-Ready Letter</h3>
              <p className="text-sm text-ink-soft mb-3">
                Weekly notes on AI systems that actually ship. Free.
              </p>
              <a href="/#newsletter" className="text-sm font-bold text-black underline">
                Subscribe
              </a>
            </div>
            <div className="border border-zinc-300 p-5 bg-paper">
              <h3 className="font-bold mb-2">Agent-Ready Blueprint</h3>
              <p className="text-sm text-ink-soft mb-3">
                If you want a paid diagnostic without committing to a build. $2,000.
              </p>
              <a href="/assessment" className="text-sm font-bold text-black underline">
                See the Blueprint
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isLast = qStep === TOTAL_STEPS - 1;

  return (
    <div className="min-h-screen bg-paper pt-32 pb-16 px-6">
      <div className="container mx-auto max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <span className="inline-block text-xs uppercase tracking-[0.1em] font-medium text-ink-soft border border-[color:var(--color-hairline-bold)] rounded px-2 py-1">
            Book a call
          </span>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mt-6 mb-3">
            A few quick questions first.
          </h1>
          <p className="text-ink-soft leading-relaxed">
            Two minutes. This helps me come prepared and stops us both from wasting 30 minutes if we're not a fit.
          </p>
          <p className="text-ink-soft leading-relaxed mt-3 text-sm">
            The full system, on the record:{' '}
            <a href="https://inboundonsteroids.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-black">
              inboundonsteroids.com
            </a>
          </p>
        </motion.div>

        {/* Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-xs uppercase tracking-widest text-ink-mute">
              Step {qStep + 1} of {TOTAL_STEPS} · {STEP_TITLES[qStep]}
            </span>
          </div>
          <div className="h-[3px] w-full bg-zinc-200 overflow-hidden">
            <motion.div
              className="h-full bg-accent"
              initial={false}
              animate={{ width: `${((qStep + 1) / TOTAL_STEPS) * 100}%` }}
              transition={{ duration: 0.4, ease: [0.22, 0.84, 0.36, 1] }}
            />
          </div>
        </div>

        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          onSubmit={handleNext}
          className="bg-paper rounded-2xl border border-[color:var(--color-hairline)] p-8 md:p-12 shadow-card-subtle"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={qStep}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.28, ease: [0.22, 0.84, 0.36, 1] }}
              className="space-y-8"
            >
              {qStep === 0 && (
                <>
                  <div>
                    <label className={labelCls}>01 - How many people on your team?</label>
                    <div className="flex flex-wrap gap-2">
                      {companySizeOptions.map((option) => (
                        <button key={option} type="button" onClick={() => setForm({ ...form, companySize: option })} className={optionCls(form.companySize === option)}>
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>02 - Annual revenue range</label>
                    <div className="flex flex-wrap gap-2">
                      {revenueOptions.map((option) => (
                        <button key={option} type="button" onClick={() => setForm({ ...form, revenue: option })} className={optionCls(form.revenue === option)}>
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {qStep === 1 && (
                <>
                  <div>
                    <label className={labelCls}>03 - What's the operational bottleneck you're trying to solve? (one sentence)</label>
                    <input
                      type="text"
                      value={form.bottleneck}
                      onChange={(e) => setForm({ ...form, bottleneck: e.target.value })}
                      placeholder="e.g. Lead qualification takes 8 hours a week..."
                      className="w-full px-4 py-3 border border-zinc-300 bg-paper focus:outline-none focus:border-black"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>04 - Have you tried AI or automation before? What happened? (optional)</label>
                    <textarea
                      value={form.priorAttempt}
                      onChange={(e) => setForm({ ...form, priorAttempt: e.target.value })}
                      rows={3}
                      placeholder="e.g. Tried ChatGPT for lead scoring. Output was inconsistent, nobody used it after 3 weeks."
                      className="w-full px-4 py-3 border border-zinc-300 bg-paper focus:outline-none focus:border-black resize-none"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>05 - Budget range you're considering</label>
                    <div className="flex flex-wrap gap-2">
                      {budgetOptions.map((option) => (
                        <button key={option} type="button" onClick={() => setForm({ ...form, budget: option })} className={optionCls(form.budget === option)}>
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {qStep === 2 && (
                <>
                  <div>
                    <label className={labelCls}>06 - When do you want this solved?</label>
                    <div className="flex flex-wrap gap-2">
                      {timelineOptions.map((option) => (
                        <button key={option} type="button" onClick={() => setForm({ ...form, timeline: option })} className={optionCls(form.timeline === option)}>
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>07 - Are you the decision-maker?</label>
                    <div className="flex flex-col gap-2">
                      {decisionMakerOptions.map((option) => (
                        <button key={option} type="button" onClick={() => setForm({ ...form, decisionMaker: option })} className={`text-left ${optionCls(form.decisionMaker === option)}`}>
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {qStep === 3 && (
                <>
                  <p className="text-ink-soft leading-relaxed">
                    Last step. Where should I send the confirmation and come-prepared notes?
                  </p>
                  <div>
                    <label className={labelCls}>Name</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full px-4 py-3 border border-zinc-300 bg-paper focus:outline-none focus:border-black"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Email</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="w-full px-4 py-3 border border-zinc-300 bg-paper focus:outline-none focus:border-black"
                    />
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Nav — stacks on mobile (primary on top), row on sm+ */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-3 mt-10">
            {qStep > 0 && (
              <button
                type="button"
                onClick={() => setQStep(qStep - 1)}
                className="inline-flex items-center justify-center gap-2 px-5 py-4 border border-zinc-300 text-ink-soft font-medium hover:border-black transition-colors w-full sm:w-auto"
              >
                <ArrowLeft aria-hidden="true" size={18} />
                Back
              </button>
            )}
            <button
              type="submit"
              disabled={!canProceed(qStep)}
              className="btn-magnetic w-full sm:flex-1 px-8 py-4 bg-black text-white font-bold tracking-wide border-subtle shadow-card flex items-center justify-center gap-3 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isLast ? 'See if we are a fit' : 'Continue'}
              <ArrowRight aria-hidden="true" size={18} />
            </button>
          </div>
        </motion.form>
      </div>
    </div>
  );
};

export default StartPage;

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Check } from 'lucide-react';
import { useMetadata } from '../hooks/useMetadata';

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

const CALENDLY_URL = 'https://calendly.com/ivan-intelligents/30min';

const StartPage: React.FC = () => {
  useMetadata({
    title: 'Book a call | Manfredi',
    description: 'Answer 7 quick questions to help me come prepared. Filters for decision-maker, timeline, and budget fit so we don\'t waste each other\'s 30 minutes.',
    canonical: 'https://ivanmanfredi.com/start',
  });
  const [step, setStep] = useState<'form' | 'approved' | 'waitlist'>('form');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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

    if (qualified) {
      setStep('approved');
    } else {
      setStep('waitlist');
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
            href={CALENDLY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-magnetic inline-flex items-center gap-3 px-8 py-4 bg-black text-white font-bold tracking-wide border-subtle shadow-card"
          >
            Book a 30-minute call
            <ArrowRight aria-hidden="true" size={18} />
          </a>
          <p className="mt-8 text-sm text-ink-mute">
            Or skip the call: <a href="/assessment" className="underline hover:text-black">start with the $2,500 Assessment</a>.
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
              <h3 className="font-bold mb-2">Agent-Ready Assessment</h3>
              <p className="text-sm text-ink-soft mb-3">
                If you want a paid diagnostic without committing to a build. $2,500.
              </p>
              <a href="/assessment" className="text-sm font-bold text-black underline">
                See the Assessment
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper pt-32 pb-16 px-6">
      <div className="container mx-auto max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
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
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          onSubmit={handleSubmit}
          className="bg-paper rounded-2xl border border-[color:var(--color-hairline)] p-8 md:p-12 shadow-card-subtle space-y-8"
        >

          {/* Q1 Company size */}
          <div>
            <label className="font-mono text-xs uppercase tracking-widest text-ink-mute block mb-3">
              01 - How many people on your team?
            </label>
            <div className="flex flex-wrap gap-2">
              {companySizeOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setForm({ ...form, companySize: option })}
                  className={`px-4 py-2 border font-medium text-sm transition-all ${
                    form.companySize === option
                      ? 'bg-black text-white border-black'
                      : 'bg-paper text-ink-soft border-zinc-300 hover:border-black'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          {/* Q2 Revenue */}
          <div>
            <label className="font-mono text-xs uppercase tracking-widest text-ink-mute block mb-3">
              02 - Annual revenue range
            </label>
            <div className="flex flex-wrap gap-2">
              {revenueOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setForm({ ...form, revenue: option })}
                  className={`px-4 py-2 border font-medium text-sm transition-all ${
                    form.revenue === option
                      ? 'bg-black text-white border-black'
                      : 'bg-paper text-ink-soft border-zinc-300 hover:border-black'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          {/* Q3 Bottleneck */}
          <div>
            <label className="font-mono text-xs uppercase tracking-widest text-ink-mute block mb-3">
              03 - What's the operational bottleneck you're trying to solve? (one sentence)
            </label>
            <input
              type="text"
              value={form.bottleneck}
              onChange={(e) => setForm({ ...form, bottleneck: e.target.value })}
              required
              placeholder="e.g. Lead qualification takes 8 hours a week..."
              className="w-full px-4 py-3 border border-zinc-300 bg-paper focus:outline-none focus:border-black"
            />
          </div>

          {/* Q4 Prior AI */}
          <div>
            <label className="font-mono text-xs uppercase tracking-widest text-ink-mute block mb-3">
              04 - Have you tried AI or automation before? What happened?
            </label>
            <textarea
              value={form.priorAttempt}
              onChange={(e) => setForm({ ...form, priorAttempt: e.target.value })}
              rows={3}
              placeholder="e.g. Tried ChatGPT for lead scoring. Output was inconsistent, nobody used it after 3 weeks."
              className="w-full px-4 py-3 border border-zinc-300 bg-paper focus:outline-none focus:border-black resize-none"
            />
          </div>

          {/* Q5 Budget */}
          <div>
            <label className="font-mono text-xs uppercase tracking-widest text-ink-mute block mb-3">
              05 - Budget range you're considering
            </label>
            <div className="flex flex-wrap gap-2">
              {budgetOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setForm({ ...form, budget: option })}
                  className={`px-4 py-2 border font-medium text-sm transition-all ${
                    form.budget === option
                      ? 'bg-black text-white border-black'
                      : 'bg-paper text-ink-soft border-zinc-300 hover:border-black'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          {/* Q6 Timeline */}
          <div>
            <label className="font-mono text-xs uppercase tracking-widest text-ink-mute block mb-3">
              06 - When do you want this solved?
            </label>
            <div className="flex flex-wrap gap-2">
              {timelineOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setForm({ ...form, timeline: option })}
                  className={`px-4 py-2 border font-medium text-sm transition-all ${
                    form.timeline === option
                      ? 'bg-black text-white border-black'
                      : 'bg-paper text-ink-soft border-zinc-300 hover:border-black'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          {/* Q7 Decision-maker */}
          <div>
            <label className="font-mono text-xs uppercase tracking-widest text-ink-mute block mb-3">
              07 - Are you the decision-maker?
            </label>
            <div className="flex flex-col gap-2">
              {decisionMakerOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setForm({ ...form, decisionMaker: option })}
                  className={`text-left px-4 py-2 border font-medium text-sm transition-all ${
                    form.decisionMaker === option
                      ? 'bg-black text-white border-black'
                      : 'bg-paper text-ink-soft border-zinc-300 hover:border-black'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div className="border-t border-zinc-200 pt-8 space-y-4">
            <div>
              <label className="font-mono text-xs uppercase tracking-widest text-ink-mute block mb-3">
                Name
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className="w-full px-4 py-3 border border-zinc-300 bg-paper focus:outline-none focus:border-black"
              />
            </div>
            <div>
              <label className="font-mono text-xs uppercase tracking-widest text-ink-mute block mb-3">
                Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                className="w-full px-4 py-3 border border-zinc-300 bg-paper focus:outline-none focus:border-black"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={
              !form.companySize ||
              !form.revenue ||
              !form.bottleneck ||
              !form.budget ||
              !form.email ||
              !form.name
            }
            className="btn-magnetic w-full px-8 py-4 bg-black text-white font-bold tracking-wide border-subtle shadow-card flex items-center justify-center gap-3 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Continue
            <ArrowRight aria-hidden="true" size={18} />
          </button>
        </motion.form>
      </div>
    </div>
  );
};

export default StartPage;

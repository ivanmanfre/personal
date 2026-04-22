import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Loader2, Save } from 'lucide-react';
import { useMetadata } from '../hooks/useMetadata';

const INTAKE_ENDPOINT = 'https://bjbvqvzbzczjbatgmccb.supabase.co/functions/v1/assessment-intake';

type Question =
  | { id: string; kind: 'text'; label: string; placeholder?: string; }
  | { id: string; kind: 'textarea'; label: string; placeholder?: string; }
  | { id: string; kind: 'scale'; label: string; minLabel: string; maxLabel: string; }
  | { id: string; kind: 'radio'; label: string; options: { value: string; label: string }[]; }
  | { id: string; kind: 'number'; label: string; unit: string; };

type Section = { eyebrow: string; title: string; blurb?: string; questions: Question[] };

const sections: Section[] = [
  {
    eyebrow: 'Context',
    title: 'About you',
    questions: [
      { id: 'company', kind: 'text', label: '1. Company name + website + your role', placeholder: 'Acme Legal · acmelegal.com · Managing Partner' },
      { id: 'size_revenue', kind: 'text', label: '2. Team size and annual revenue range', placeholder: 'e.g. 35 people · $5-10M ARR' },
      { id: 'work_description', kind: 'textarea', label: '3. In two sentences, what\'s the work you want AI to take off your plate?', placeholder: 'Our senior associates spend 6-8 hours a week reading intake calls to decide which leads are worth a proposal. It\'s high-judgment work but repetitive enough that we think AI could do 80% of it.' },
    ],
  },
  {
    eyebrow: 'Precondition 01',
    title: 'Reliable input pipeline',
    blurb: 'Can the agent read the same data every time — either from a structured source, or from a reliable extraction on top of messy input?',
    questions: [
      { id: 'input_source', kind: 'text', label: '4. Where does the information for this work first enter your business?', placeholder: 'e.g. a web form, an inbound email, a discovery call transcript, a HubSpot record' },
      {
        id: 'input_shape',
        kind: 'radio',
        label: '5. What shape is that source in today?',
        options: [
          { value: 'form', label: 'Already structured (form fields, CRM record, etc.)' },
          { value: 'unstructured', label: 'Unstructured (emails, call notes, docs) — but it can\'t be changed' },
          { value: 'fixable', label: 'Unstructured, but we could add structure if we wanted' },
          { value: 'mix', label: 'Mix of structured + unstructured sources' },
        ],
      },
      { id: 'input_consistency', kind: 'scale', label: '6. If two people on your team captured the same customer, would the critical fields look the same?', minLabel: 'Totally different', maxLabel: 'Identical' },
      { id: 'input_gap', kind: 'text', label: '7. What\'s the single piece of information most often missing, inconsistent, or hard to extract when this work starts?' },
    ],
  },
  {
    eyebrow: 'Precondition 02',
    title: 'Documentable decision',
    blurb: 'Can the judgment actually be written down?',
    questions: [
      { id: 'best_person', kind: 'text', label: '8. Who is the best person in your company at this work today?', placeholder: 'e.g. Sarah (Head of Operations)' },
      { id: 'documentability', kind: 'scale', label: '9. If they left tomorrow, could you write down how they do it?', minLabel: 'Impossible', maxLabel: 'Already documented' },
      { id: 'criteria', kind: 'textarea', label: '10. What criteria do they use? List them.', placeholder: '1. Industry fit (SaaS, services, e-commerce)\n2. Deal size over $25k ARR\n3. Decision-maker on the call\n4. Timeline to buy under 60 days' },
      {
        id: 'gut_feel',
        kind: 'radio',
        label: '11. Are any of those criteria gut-feel or subjective?',
        options: [
          { value: 'no', label: 'No, all objective' },
          { value: 'some', label: 'Some are subjective' },
          { value: 'mostly', label: 'Mostly gut feel' },
        ],
      },
      {
        id: 'frequency',
        kind: 'radio',
        label: '12. How often does this work happen?',
        options: [
          { value: 'daily', label: 'Multiple times per day' },
          { value: 'weekly', label: 'A few times per week' },
          { value: 'monthly', label: 'A few times per month' },
          { value: 'rare', label: 'Less than monthly' },
        ],
      },
    ],
  },
  {
    eyebrow: 'Precondition 03',
    title: 'Narrow scope',
    blurb: 'Can we pick one version, bound the problem, and ship?',
    questions: [
      { id: 'v1_scope', kind: 'textarea', label: '13. If you could only have AI do one version of this (one customer type, one channel, one product), which would it be?', placeholder: 'Only inbound leads from our enterprise tier, captured via the contact form. Not outbound, not referrals, not partner-sourced.' },
      { id: 'excluded', kind: 'textarea', label: '14. What would you deliberately leave out of the first version?' },
      { id: 'success_metric', kind: 'text', label: '15. How would you know the first version is working? What\'s the single number you\'d track?', placeholder: 'e.g. "% of qualified leads correctly flagged" or "hours saved per week"' },
      {
        id: 'tolerance',
        kind: 'radio',
        label: '16. Can you live with AI getting 5-10% of cases wrong at first, as long as a human catches them?',
        options: [
          { value: 'yes', label: 'Yes' },
          { value: 'no', label: 'No, it needs to be right the first time' },
          { value: 'depends', label: 'Depends on which ones it gets wrong' },
        ],
      },
    ],
  },
  {
    eyebrow: 'Precondition 04',
    title: 'Human review',
    blurb: 'Is review built into the design, not bolted on?',
    questions: [
      { id: 'reviewer', kind: 'text', label: '17. Who on your team would review the AI\'s output before anything goes out?', placeholder: 'e.g. Our operations manager · 5 years tenure' },
      { id: 'review_time', kind: 'number', label: '18. How much time can they realistically spend reviewing per day?', unit: 'minutes' },
      {
        id: 'uncertain_default',
        kind: 'radio',
        label: '19. When AI is uncertain, what should happen?',
        options: [
          { value: 'route', label: 'Route it to a human to decide' },
          { value: 'safest', label: 'Default to the safest choice and flag it' },
          { value: 'ask', label: 'Ask for more information before proceeding' },
        ],
      },
      { id: 'downside', kind: 'textarea', label: '20. What breaks if AI gets something wrong and nobody catches it? Explain the downstream damage.' },
    ],
  },
];

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const AssessmentIntakePage: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = params.get('session_id');

  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [status, setStatus] = useState<string>('not_started');
  const [buyer, setBuyer] = useState<{ email: string; name?: string | null } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saveTimer = useRef<number | null>(null);

  useMetadata({
    title: 'Assessment intake | Manfredi',
    description: 'Complete your Agent-Ready Assessment intake questionnaire.',
    canonical: 'https://ivanmanfredi.com/assessment/intake',
    noindex: true,
  });

  // Load existing draft on mount
  useEffect(() => {
    if (!sessionId) { setLoading(false); return; }
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`${INTAKE_ENDPOINT}?session_id=${encodeURIComponent(sessionId)}`);
        if (!res.ok) {
          if (cancelled) return;
          setError(res.status === 404 ? 'We couldn\'t match that payment session. Check the link in your confirmation email.' : 'Could not load your intake. Try reloading.');
          setLoading(false);
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setAnswers(data.answers ?? {});
        setStatus(data.status ?? 'not_started');
        setBuyer(data.buyer ?? null);
        setLoading(false);
      } catch {
        if (cancelled) return;
        setError('Network error. Check your connection and reload.');
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [sessionId]);

  // Debounced auto-save
  useEffect(() => {
    if (!sessionId || loading || status === 'submitted') return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);

    saveTimer.current = window.setTimeout(async () => {
      setSaveState('saving');
      try {
        const res = await fetch(INTAKE_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId, answers }),
        });
        setSaveState(res.ok ? 'saved' : 'error');
      } catch {
        setSaveState('error');
      }
    }, 1500);

    return () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); };
  }, [answers, sessionId, loading, status]);

  const setAnswer = (id: string, value: any) => setAnswers((prev) => ({ ...prev, [id]: value }));

  const totalQs = useMemo(() => sections.reduce((acc, s) => acc + s.questions.length, 0), []);
  const answeredQs = useMemo(() => Object.values(answers).filter((v) => v !== undefined && v !== '' && v !== null).length, [answers]);

  const handleSubmit = async () => {
    if (!sessionId) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(INTAKE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, answers, submit: true }),
      });
      if (!res.ok) throw new Error('submit failed');
      navigate(`/assessment/welcome?session_id=${encodeURIComponent(sessionId)}&intake=done`);
    } catch {
      setError('Could not submit. Try again, or email im@ivanmanfredi.com.');
      setSubmitting(false);
    }
  };

  if (!sessionId) {
    return (
      <div className="min-h-screen bg-paper pt-32 pb-24 px-6">
        <div className="container mx-auto max-w-2xl">
          <h1 className="text-3xl font-semibold mb-4">Missing session</h1>
          <p className="text-ink-soft">Open the intake from the link in your payment confirmation email.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-paper pt-32 pb-24 px-6 flex items-center justify-center">
        <Loader2 className="animate-spin text-ink-mute" size={24} />
      </div>
    );
  }

  if (error && !buyer) {
    return (
      <div className="min-h-screen bg-paper pt-32 pb-24 px-6">
        <div className="container mx-auto max-w-2xl">
          <h1 className="text-3xl font-semibold mb-4">Something's off</h1>
          <p className="text-ink-soft mb-4">{error}</p>
          <a href="mailto:im@ivanmanfredi.com" className="underline">im@ivanmanfredi.com</a>
        </div>
      </div>
    );
  }

  if (status === 'submitted') {
    return (
      <div className="min-h-screen bg-paper pt-32 pb-24 px-6">
        <div className="container mx-auto max-w-3xl">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
            <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.1em] font-medium text-ink-soft border border-[color:var(--color-hairline-bold)] px-2 py-1">
              <Check size={12} strokeWidth={3} className="text-accent-ink" /> Intake received
            </span>
          </motion.div>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tighter mb-6">
            Thanks. <span className="font-drama italic">I've got what I need.</span>
          </h1>
          <p className="text-lg text-ink-soft mb-8 leading-relaxed">
            I'll review your answers before our Day 2 call. If you haven't booked it yet, grab a slot from your welcome page.
          </p>
          <a href={`/assessment/welcome?session_id=${encodeURIComponent(sessionId)}`} className="inline-block px-6 py-3 bg-black text-white font-semibold tracking-wide hover:bg-accent-ink transition-colors">
            Back to welcome page
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper pt-32 pb-32 px-6">
      <div className="container mx-auto max-w-3xl">

        {/* Eyebrow */}
        <div className="mb-6">
          <span className="inline-block text-xs uppercase tracking-[0.1em] font-medium text-ink-soft border border-[color:var(--color-hairline-bold)] px-2 py-1">
            Assessment intake
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tighter leading-[1.05] mb-6 max-w-3xl">
          Tell me how the <span className="font-drama italic">work actually runs.</span>
        </h1>
        <p className="text-xl text-ink-soft leading-relaxed mb-4 max-w-2xl">
          Twenty questions, roughly 25 minutes. Your answers save as you type — close this tab and come back whenever. I'll review everything before our Day 2 call.
        </p>
        {buyer && (
          <p className="font-mono text-xs uppercase tracking-[0.1em] text-ink-mute mb-12">
            Signed in as {buyer.email}
          </p>
        )}

        {/* Progress + save indicator */}
        <div className="flex items-center justify-between mb-12 pb-4 border-b border-[color:var(--color-hairline)]">
          <p className="font-mono text-xs uppercase tracking-[0.1em] text-ink-mute">
            {answeredQs} of {totalQs} answered
          </p>
          <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.1em]">
            {saveState === 'saving' && (<><Loader2 size={12} className="animate-spin text-ink-mute" /><span className="text-ink-mute">Saving</span></>)}
            {saveState === 'saved' && (<><Save size={12} className="text-accent-ink" /><span className="text-ink-mute">Saved</span></>)}
            {saveState === 'error' && (<span className="text-red-600">Save failed</span>)}
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-24">
          {sections.map((section, sIdx) => (
            <section key={section.eyebrow} className="space-y-10">
              <header>
                <p className="font-mono text-xs uppercase tracking-[0.1em] text-ink-mute mb-2">{section.eyebrow}</p>
                <h2 className="text-3xl font-semibold tracking-tight mb-2">{section.title}</h2>
                {section.blurb && <p className="text-ink-soft">{section.blurb}</p>}
              </header>

              {section.questions.map((q) => (
                <div key={q.id} className="space-y-3">
                  <label className="block text-lg font-medium leading-relaxed" htmlFor={q.id}>{q.label}</label>

                  {q.kind === 'text' && (
                    <input id={q.id} type="text" value={answers[q.id] ?? ''} placeholder={q.placeholder} onChange={(e) => setAnswer(q.id, e.target.value)} className="w-full px-4 py-3 bg-paper border border-[color:var(--color-hairline-bold)] text-black placeholder-ink-mute focus:outline-none focus:border-accent transition-colors" />
                  )}

                  {q.kind === 'textarea' && (
                    <textarea id={q.id} rows={4} value={answers[q.id] ?? ''} placeholder={q.placeholder} onChange={(e) => setAnswer(q.id, e.target.value)} className="w-full px-4 py-3 bg-paper border border-[color:var(--color-hairline-bold)] text-black placeholder-ink-mute focus:outline-none focus:border-accent transition-colors resize-y" />
                  )}

                  {q.kind === 'number' && (
                    <div className="flex items-center gap-3">
                      <input id={q.id} type="number" min={0} value={answers[q.id] ?? ''} onChange={(e) => setAnswer(q.id, e.target.value)} className="w-32 px-4 py-3 bg-paper border border-[color:var(--color-hairline-bold)] text-black focus:outline-none focus:border-accent transition-colors" />
                      <span className="font-mono text-xs uppercase tracking-[0.1em] text-ink-mute">{q.unit}</span>
                    </div>
                  )}

                  {q.kind === 'scale' && (
                    <div>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button key={n} type="button" onClick={() => setAnswer(q.id, n)} className={`flex-1 py-3 font-mono text-lg border transition-colors ${answers[q.id] === n ? 'bg-black text-white border-black' : 'bg-paper text-ink-soft border-[color:var(--color-hairline-bold)] hover:border-black'}`}>
                            {n}
                          </button>
                        ))}
                      </div>
                      <div className="flex justify-between mt-2 font-mono text-xs uppercase tracking-[0.1em] text-ink-mute">
                        <span>{q.minLabel}</span>
                        <span>{q.maxLabel}</span>
                      </div>
                    </div>
                  )}

                  {q.kind === 'radio' && (
                    <div className="space-y-2">
                      {q.options.map((opt) => (
                        <label key={opt.value} className={`flex items-center gap-3 px-4 py-3 border cursor-pointer transition-colors ${answers[q.id] === opt.value ? 'bg-black text-white border-black' : 'bg-paper text-ink border-[color:var(--color-hairline-bold)] hover:border-black'}`}>
                          <input type="radio" name={q.id} value={opt.value} checked={answers[q.id] === opt.value} onChange={() => setAnswer(q.id, opt.value)} className="sr-only" />
                          <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${answers[q.id] === opt.value ? 'border-white' : 'border-[color:var(--color-hairline-bold)]'}`}>
                            {answers[q.id] === opt.value && <span className="w-2 h-2 rounded-full bg-paper" />}
                          </span>
                          <span>{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </section>
          ))}
        </div>

        {/* Submit */}
        <div className="mt-20 pt-12 border-t border-[color:var(--color-hairline-bold)]">
          <p className="text-ink-soft leading-relaxed mb-6">
            When you're done, submit below. I'll review everything before the Day 2 working session.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <button onClick={handleSubmit} disabled={submitting} className="px-8 py-4 bg-black text-white font-semibold tracking-wide hover:bg-accent-ink transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-3">
              {submitting ? <><Loader2 size={16} className="animate-spin" /> Submitting</> : <>Submit intake</>}
            </button>
            <p className="font-mono text-xs uppercase tracking-[0.1em] text-ink-mute">
              {answeredQs} of {totalQs} answered
            </p>
          </div>
          {error && <p className="text-red-600 text-sm mt-4">{error}</p>}
        </div>

      </div>
    </div>
  );
};

export default AssessmentIntakePage;

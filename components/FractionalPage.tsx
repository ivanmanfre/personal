import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useMetadata } from '../hooks/useMetadata';
import { T, DIVIDER, ease, inView, prefersReduced, Label, RevealH2, SageSweep, Numeral, MagneticCTA } from './editorial';

const builds = [
  {
    id: '01',
    name: 'Content System',
    tag: 'Not enough leads',
    desc: 'Lead magnet engine plus a post engine trained on your voice. Drafting daily by day 14, fully live by day 30. You self-edit everything in-browser.',
    href: '/content-system',
    cta: 'See the build',
  },
  {
    id: '02',
    name: 'Call Intelligence',
    tag: "Leads don't close, or don't stick",
    desc: 'Every sales and client call scored, deal risks flagged, churn caught before it happens. Scoped to your call stack on the fit call.',
    href: '/call-intelligence',
    cta: 'See how it works',
    signature: true,
  },
  {
    id: '03',
    name: 'Something else',
    tag: 'You just know you need AI',
    desc: "AI is wide, and most businesses need something off-menu. We break your idea into systems on the call. Experimental work gets a one-week prototype first.",
    href: '/start',
    cta: 'Bring it to the call',
  },
];

const buildSteps = [
  {
    n: '01',
    title: 'Fit call',
    duration: '30 min · free',
    desc: 'We figure out what to build first. If you arrive knowing, we scope it. If you arrive with "we need to do something with AI," we find the bottleneck worth starting with. You leave with a scope and a number, not a tier to decode.',
  },
  {
    n: '02',
    title: 'Scope locked',
    duration: 'same week',
    desc: 'A one-page proposal: the systems we are building, listed. That list is the contract. The price is fixed and in writing before anything starts, and it only moves if the list moves.',
  },
  {
    n: '03',
    title: 'Build starts day 1',
    duration: 'weeks 1–2',
    desc: 'No diagnostic phase, no waiting. Your first system is in progress before the first check-in. Slack access throughout.',
  },
  {
    n: '04',
    title: 'Systems live, plus your roadmap',
    duration: 'by day 30',
    desc: 'The promised systems are live and your team owns them. You also get a roadmap of what I found while building, costed and sequenced. Working inside your operation is the diagnosis. The roadmap is yours regardless.',
  },
  {
    n: '05',
    title: 'Next build, or not',
    duration: 'your call',
    desc: 'Most clients pick the top of the roadmap and run the next build. Some stop and move everything to the Care Plan. There is nothing to cancel, because there is nothing recurring.',
  },
];

const ownership = [
  'The code, the workflows, the integrations: all transferred to you',
  'No platform fees, no vendor lock-in, no hostage data',
  'In-browser editing, so your team changes copy without me',
  'Every system documented and handed over, not rented back',
];

const notIncluded = [
  'Bespoke products outside the AI-systems scope (brand design, paid ads, hiring)',
  'On-site presence. Remote-first, async-first',
  '24/7 on-call. Real emergencies handled same-day, but I sleep',
  'Open-ended scope. Each build ships what is on its list. New ideas go on the next list',
];

const faqs = [
  { q: 'Is this a retainer?', a: 'No. A build is a project: fixed scope, fixed price, an end date. The only recurring thing I sell is the Care Plan, and that is maintenance, not access.' },
  { q: 'What does a build cost?', a: 'Depends on how many systems are in it. You will have your exact number by the end of the fit call, fixed and in writing before we start. Larger builds can be paid over 90 days while the work ships in the first 30.' },
  { q: 'What if I want something custom?', a: 'That is most engagements. We break what you want into systems on the call and the price follows the scope. Genuinely experimental work gets a one-week prototype first.' },
  { q: 'How do I know it worked?', a: 'Systems that generate demand ship with their own scoreboard: leads captured, posts published, calls scored, replies booked. Systems that remove work get measured in hours back. Numbers, not vibes.' },
  { q: 'What happens after the first build?', a: 'You will have working systems and a roadmap. Most clients run another build on the roadmap. Some move straight to the Care Plan. Nothing auto-renews, so doing nothing is a clean outcome too.' },
  { q: 'What if the timeline slips?', a: 'The scope list is the promise and 30 days is the plan. If anything threatens the date you hear it from me early, with options, not at the deadline. You pay for things that exist, never for time.' },
  { q: 'When does the Care Plan start?', a: 'Whenever you stop building. It picks up every system I have shipped for you, whether that is after one build or five, and you can drop it whenever.' },
];

const Bullet: React.FC = () => (
  <span aria-hidden style={{ width: 6, height: 6, backgroundColor: 'var(--color-accent)', flexShrink: 0, marginTop: 9 }} />
);

const FractionalPage: React.FC = () => {
  useMetadata({
    title: 'How I Work | Manfredi',
    description: 'AI growth and retention systems for service businesses. Built in 30-day fixed-scope, fixed-price builds. You own everything. Optional Care Plan keeps it all alive.',
    canonical: 'https://ivanmanfredi.com/fractional',
  });

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-paper)' }}>

      {/* HERO */}
      <section className="pt-36 pb-16 md:pb-24 px-8">
        <div className="container mx-auto max-w-6xl">
          <motion.div {...inView}>
            <Label>How I work</Label>
            <RevealH2 style={{ ...T.display('clamp(2.6rem,5.2vw,4.6rem)'), marginBottom: '1.5rem', maxWidth: '20ch' }}>
              Systems built in{' '}
              <span style={{ position: 'relative', display: 'inline-block' }}>
                30 days.
                <SageSweep delay={0.5} opacity={0.85} />
              </span>
              <br />A partner that compounds.
            </RevealH2>
            <p style={{ ...T.serif, fontSize: '20px', maxWidth: '46ch', marginBottom: '1.25rem' }}>
              Everything I build ships the same way: fixed scope, fixed price agreed before we start, systems live by day 30. No retainer. You buy a finished thing, then decide if you want the next one.
            </p>
            <p style={{ ...T.serif, fontSize: '15.5px', color: '#5A5752', maxWidth: '46ch' }}>
              You work with the person who builds it. No account manager, no handoff, no junior doing the actual work. I take 2–3 builds per month.
            </p>
          </motion.div>
        </div>
      </section>

      {/* 01 — WHAT I BUILD */}
      <section className="py-14 md:py-20 border-t px-8" style={DIVIDER}>
        <div className="container mx-auto max-w-6xl">
          <motion.div {...inView} className="mb-12 max-w-2xl">
            <Label>01 / What I build</Label>
            <RevealH2 style={T.display('clamp(2rem,3.4vw,3rem)')}>
              Three places people start.
            </RevealH2>
            <p style={{ ...T.serif, fontSize: '16px', marginTop: '1rem' }}>
              The fit call decides what your first build is and what it costs, in one conversation.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-5">
            {builds.map((b, i) => (
              <motion.a
                key={b.id}
                href={b.href}
                initial={prefersReduced ? false : { opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.7, ease, delay: i * 0.08 }}
                className="group flex flex-col p-8 border"
                style={{ borderColor: 'rgba(26,26,26,0.12)', backgroundColor: 'var(--color-paper)', position: 'relative' }}
              >
                {b.signature && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', backgroundColor: 'var(--color-accent)' }} />}
                <div className="flex items-center justify-between mb-6">
                  <span style={{ ...T.mono, marginBottom: 0 }}>{b.id}</span>
                  {b.signature && <span style={{ ...T.mono, color: 'var(--color-accent-ink)', marginBottom: 0 }}>Signature</span>}
                </div>
                <h3 style={{ ...T.display('1.6rem'), marginBottom: '0.6rem' }}>{b.name}</h3>
                <div style={{ ...T.mono, marginBottom: '1.25rem' }}>{b.tag}</div>
                <p style={{ fontFamily: '"Source Serif 4", Georgia, serif', fontSize: '15px', lineHeight: 1.6, color: '#5A5752', marginBottom: '1.75rem', flex: 1 }}>{b.desc}</p>
                <div className="flex items-center gap-2" style={{ fontFamily: '"Source Serif 4", serif', fontWeight: 600, fontSize: '14px', color: 'var(--color-accent-ink)' }}>
                  {b.cta}
                  <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
                </div>
              </motion.a>
            ))}
          </div>
        </div>
      </section>

      {/* 02 — HOW A BUILD WORKS */}
      <section className="py-14 md:py-20 border-t px-8" style={DIVIDER}>
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-[minmax(0,30%)_1fr] gap-10 lg:gap-16">
            <motion.div {...inView}>
              <Label>02 / How a build works</Label>
              <RevealH2 style={T.display('clamp(2rem,3.4vw,3rem)')}>
                Same five steps, every time.
              </RevealH2>
              <p style={{ ...T.serif, fontSize: '16px', marginTop: '1rem', maxWidth: '34ch' }}>
                Whether it is a named system or something only your business needs.
              </p>
            </motion.div>

            <div>
              {buildSteps.map((s, i) => (
                <motion.div
                  key={s.n}
                  initial={prefersReduced ? false : { opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.6, ease, delay: i * 0.06 }}
                  className="grid grid-cols-[auto_1fr] gap-5 md:gap-7 py-7 border-t first:border-t-0 md:first:border-t"
                  style={DIVIDER}
                >
                  <span style={{ ...T.mono, fontSize: '12px', color: 'var(--color-accent-ink)', paddingTop: '4px' }}>{s.n}</span>
                  <div>
                    <div className="flex items-baseline justify-between gap-4 flex-wrap mb-2">
                      <h3 style={{ ...T.display('1.4rem'), lineHeight: 1.15 }}>{s.title}</h3>
                      <span style={{ ...T.mono, marginBottom: 0 }}>{s.duration}</span>
                    </div>
                    <p style={{ fontFamily: '"Source Serif 4", Georgia, serif', fontSize: '16px', lineHeight: 1.65, color: '#3D3D3B' }}>{s.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* THE ROADMAP IS HONEST — pull-quote, sage right rule */}
      <section className="py-14 md:py-20 border-t px-8" style={DIVIDER}>
        <div className="container mx-auto max-w-6xl">
          <motion.div {...inView} className="max-w-3xl ml-auto" style={{ borderRight: '2px solid var(--color-accent)', paddingRight: '2rem' }}>
            <Label>The roadmap is honest</Label>
            <p style={{ ...T.display('clamp(1.6rem,2.6vw,2.3rem)'), lineHeight: 1.25, marginBottom: '1.25rem' }}>
              Every first build produces a roadmap of the highest-leverage systems I found inside your business, costed and sequenced. It is yours regardless of what you do next.
            </p>
            <p style={{ ...T.serif, fontSize: '17px', color: '#1A1A1A' }}>
              If there is nothing worth building next, the roadmap says so. You move to the Care Plan or walk with working systems. I would rather lose the next build than sell you one you don't need.
            </p>
          </motion.div>
        </div>
      </section>

      {/* YOU OWN EVERYTHING */}
      <section className="py-14 md:py-20 border-t px-8" style={DIVIDER}>
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-[minmax(0,38%)_1fr] gap-10 lg:gap-16">
            <motion.div {...inView}>
              <Label>03 / Ownership</Label>
              <RevealH2 style={T.display('clamp(2rem,3.4vw,3rem)')}>
                You own everything.
              </RevealH2>
              <p style={{ ...T.serif, fontSize: '16px', marginTop: '1rem', maxWidth: '40ch' }}>
                Every build is production-hardened and handed over: monitoring, error handling, quality checks, documentation. Not a black box you rent.
              </p>
            </motion.div>
            <motion.ul {...inView} className="space-y-5 self-center">
              {ownership.map((o) => (
                <li key={o} className="flex items-start gap-4">
                  <Bullet />
                  <span style={{ fontFamily: '"Source Serif 4", Georgia, serif', fontSize: '18px', lineHeight: 1.55, color: '#1A1A1A' }}>{o}</span>
                </li>
              ))}
            </motion.ul>
          </div>
        </div>
      </section>

      {/* THE PARTNERSHIP */}
      <section className="py-14 md:py-20 border-t px-8" style={DIVIDER}>
        <div className="container mx-auto max-w-6xl">
          <motion.div {...inView} className="max-w-3xl">
            <Label>The partnership</Label>
            <RevealH2 style={{ ...T.display('clamp(2rem,3.4vw,3rem)'), marginBottom: '1.25rem' }}>
              A fractional partner you grow into, not one you sign up for.
            </RevealH2>
            <p style={{ ...T.serif, fontSize: '18px', marginBottom: '1rem' }}>
              Clients who stack builds end up with something that looks a lot like a fractional AI partner: someone who knows their business, ships every month, and answers in Slack. The difference is how you got there. Not by signing a retainer up front, but one finished project at a time, each one earning the next.
            </p>
            <p style={{ ...T.serif, fontSize: '18px', color: '#1A1A1A' }}>
              Step away whenever the roadmap runs dry. Come back when it doesn't.
            </p>
          </motion.div>
        </div>
      </section>

      {/* VS THE ALTERNATIVES */}
      <section className="py-14 md:py-20 border-t px-8" style={DIVIDER}>
        <div className="container mx-auto max-w-6xl">
          <motion.div {...inView} className="mb-12 max-w-2xl">
            <Label>04 / vs the alternatives</Label>
            <RevealH2 style={T.display('clamp(2rem,3.4vw,3rem)')}>
              Cheaper than a hire. Safer than a freelancer.
            </RevealH2>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-5">
            <motion.div {...inView} className="p-8 border" style={{ borderColor: 'rgba(26,26,26,0.12)' }}>
              <div className="mb-6"><Numeral fig="$200–400k" label="A senior AI hire, per year" sage /></div>
              <p style={{ ...T.serif, fontSize: '16px' }}>
                Fully loaded, if you can find one. Your first systems go live for less than one month of that cost, in less time than their recruiting process. No ramp, no benefits, no severance.
              </p>
            </motion.div>
            <motion.div {...inView} className="p-8 border" style={{ borderColor: 'rgba(26,26,26,0.12)' }}>
              <div className="mb-6"><Numeral fig="Month 2" label="When the cheap build breaks" /></div>
              <p style={{ ...T.serif, fontSize: '16px' }}>
                A cheap freelance build costs less up front. What it usually skips: quality checks, monitoring, error recovery, voice calibration, documentation, anyone answering when it breaks. You find out which kind you bought in month two.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* HOW WE PACE — left sage rule subhead */}
      <section className="py-14 md:py-20 border-t px-8" style={DIVIDER}>
        <div className="container mx-auto max-w-6xl">
          <motion.div {...inView} className="max-w-3xl" style={{ borderLeft: '2px solid var(--color-accent)', paddingLeft: '2rem' }}>
            <Label>How we pace</Label>
            <p style={{ ...T.display('clamp(1.5rem,2.4vw,2.1rem)'), lineHeight: 1.3 }}>
              We pace to your absorption. With AI in service businesses the real constraint is usually your team's headspace to take on new systems, so each build ships only what you can actually integrate, leaving runway for the previous wave to land.
            </p>
          </motion.div>
        </div>
      </section>

      {/* CARE PLAN — subordinate */}
      <section className="py-12 border-t px-8" style={DIVIDER}>
        <div className="container mx-auto max-w-6xl">
          <motion.div {...inView} className="flex flex-col md:flex-row md:items-center gap-5 md:gap-10 p-7 border" style={{ borderColor: 'rgba(26,26,26,0.12)', backgroundColor: 'var(--color-paper-sunk)' }}>
            <div className="md:w-1/3">
              <Label>When you're done building</Label>
              <Numeral fig="$1k/mo" label="Care Plan · optional" />
            </div>
            <p style={{ ...T.serif, fontSize: '16px', flex: 1 }}>
              Keeps everything alive: monitoring, fixes, prompt updates, and upgrades when new models ship. No new builds, cancel whenever. Every system I ship is eligible. It starts with a full health pass, so everything is at 100%.
            </p>
          </motion.div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-14 md:py-20 border-t px-8" style={DIVIDER}>
        <div className="container mx-auto max-w-6xl">
          <motion.div {...inView} className="mb-10">
            <Label>Common questions</Label>
          </motion.div>
          <div className="grid md:grid-cols-2 gap-x-12 gap-y-8">
            {faqs.map((f) => (
              <motion.div
                key={f.q}
                initial={prefersReduced ? false : { opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.55, ease }}
              >
                <h3 style={{ ...T.display('1.25rem'), marginBottom: '0.5rem' }}>{f.q}</h3>
                <p style={{ fontFamily: '"Source Serif 4", Georgia, serif', fontSize: '16px', lineHeight: 1.6, color: '#3D3D3B' }}>{f.a}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA — dark band */}
      <section className="border-t" style={{ borderColor: 'rgba(247,244,239,0.12)', backgroundColor: '#1A1A1A' }}>
        <div className="container mx-auto max-w-6xl px-8 py-20 md:py-28 text-center">
          <motion.div {...inView}>
            <Label dark>Start here</Label>
            <h2 style={{ ...T.display('clamp(2.2rem,4vw,3.6rem)'), color: '#F7F4EF', marginBottom: '1.25rem' }}>
              Start with the{' '}
              <span style={{ position: 'relative', display: 'inline-block' }}>
                fit call.
                <SageSweep delay={0.45} opacity={0.9} />
              </span>
            </h2>
            <p style={{ fontFamily: '"Source Serif 4", Georgia, serif', fontSize: '17px', color: 'rgba(247,244,239,0.66)', maxWidth: '42ch', margin: '0 auto 2rem', lineHeight: 1.6 }}>
              30 minutes, free. We figure out what to build first and what it costs. If the answer is "nothing yet," I'll tell you that too.
            </p>
            <MagneticCTA href="/start" dark fontSize="17px" px="px-9 py-4">
              Book the fit call <ArrowRight size={18} />
            </MagneticCTA>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default FractionalPage;

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Check } from 'lucide-react';
import { useMetadata } from '../hooks/useMetadata';

const builds = [
  {
    name: 'Content System',
    tag: 'The growth engine',
    description:
      'Lead magnet engine plus post engine, trained on your voice. Drafting daily by day 14, fully live by day 30. You self-edit everything through an in-browser editor, so there is no dependency on me for text changes.',
    bestFor: '"Not enough leads."',
    href: '/lead-magnet-system',
    highlighted: false,
  },
  {
    name: 'Call Intelligence',
    tag: 'Signature',
    description:
      'Every sales and client call scored, deal risks flagged, churn signals caught before they become churn. Scoped to your call stack on the fit call.',
    bestFor: '"Leads come in but don\'t close, or don\'t stick."',
    href: '/call-intelligence',
    highlighted: true,
  },
  {
    name: 'Something else',
    tag: 'The call is for that too',
    description:
      'AI is wide, and most businesses need something that is not on a menu. On the fit call we break your idea into systems and you leave with a scope and a number. If it is genuinely experimental, it gets a one-week prototype first so neither of us bets a full build on a guess.',
    bestFor: '"I know what I want built" or "I just know I need AI."',
    href: '/start',
    highlighted: false,
  },
];

const systems = [
  { name: 'Demand', role: 'Creates attention and inbound.', livesHere: 'Content System', isProduct: true },
  { name: 'Pipeline', role: 'Captures, qualifies and routes every lead.', livesHere: 'Lead magnets · outreach', isProduct: false },
  { name: 'Conversion', role: 'Wins the deals you are already in.', livesHere: 'Call Intelligence', isProduct: true },
  { name: 'Delivery', role: 'Runs the repeatable work behind the service.', livesHere: 'Scoped to you', isProduct: false },
  { name: 'Command', role: 'Watches all of it and shows you what is happening.', livesHere: 'Dashboards · alerts', isProduct: false },
];

const buildSteps = [
  {
    title: 'Fit call',
    duration: '30 min · free',
    description:
      'We figure out what to build first. If you arrive knowing, we scope it. If you arrive with "we need to do something with AI," we find the bottleneck worth starting with. Either way you leave with a scope and a number, not a tier to decode.',
  },
  {
    title: 'Scope locked',
    duration: 'same week',
    description:
      'You get a one-page proposal: the systems we are building, listed. That list is the contract. The price is fixed and in writing before anything starts, and it only moves if the list moves.',
  },
  {
    title: 'Build starts day 1',
    duration: 'weeks 1-2',
    description:
      'No diagnostic phase, no waiting. Your first system is in progress before the first check-in. Slack access throughout.',
  },
  {
    title: 'Systems live, plus your roadmap',
    duration: 'by day 30',
    description:
      'The promised systems are live and your team owns them. You also get something you did not pay for: a roadmap of what I found while building. Working inside your operation is the diagnosis, and the roadmap is yours regardless of what you do next.',
  },
  {
    title: 'Next build, or not',
    duration: 'your call',
    description:
      'Most clients pick the top of the roadmap and run the next build. Some stop and put everything on the Care Plan. Both are fine. There is nothing to cancel because there is nothing recurring.',
  },
];

const ownershipPoints = [
  'The code, the workflows, the integrations: all transferred to you',
  'No platform fees, no vendor lock-in, no hostage data',
  'In-browser editing so your team changes copy without me',
  'Every system documented and handed over, not rented back to you',
];

const notIncluded = [
  'Bespoke products outside the AI-systems scope (brand design, paid ads management, hiring)',
  'On-site presence. This is remote-first, async-first',
  '24/7 on-call response. Real emergencies handled same-day, but I sleep',
  'Open-ended scope. Each build ships exactly what is on its list. New ideas go on the next list, which is a feature, not a limitation',
];

const faqs = [
  {
    q: 'Is this a retainer?',
    a: 'No. A build is a project: fixed scope, fixed price, an end date. The only recurring thing I sell is the Care Plan, and that is maintenance, not access.',
  },
  {
    q: 'What does a build cost?',
    a: 'Depends on how many systems are in it. You will have your exact number by the end of the fit call, fixed and in writing before we start. Larger builds can be paid over 90 days while the work ships in the first 30.',
  },
  {
    q: 'What if I want something custom?',
    a: 'That is most engagements. We break what you want into systems on the call and the price follows the scope. If something is genuinely experimental, it gets a one-week prototype first.',
  },
  {
    q: 'How do I know it worked?',
    a: 'Systems that generate demand ship with their own scoreboard: leads captured, posts published, calls scored, replies booked. Systems that remove work get measured in hours back. Either way you are looking at numbers, not vibes.',
  },
  {
    q: 'What happens after the first build?',
    a: 'You will have working systems and a roadmap. Most clients run another build on the roadmap\'s top items. Some move straight to the Care Plan. Nothing auto-renews, so doing nothing is also a clean outcome.',
  },
  {
    q: 'What if the timeline slips?',
    a: 'The scope list is the promise and 30 days is the plan. If anything threatens the date you hear it from me early, with options, not at the deadline. You are never paying for time, only for things that exist.',
  },
  {
    q: 'When does the Care Plan start?',
    a: 'Whenever you stop building. It picks up every system I have shipped for you, whether that is after one build or five, and you can drop it whenever.',
  },
];

// Renders **bold** markdown inline
function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-black">{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

const FractionalPage: React.FC = () => {
  useMetadata({
    title: 'How I Work | Manfredi',
    description:
      'AI growth and retention systems for service businesses. Built in 30-day fixed-scope, fixed-price builds. You own everything. Optional Care Plan keeps it all alive.',
    canonical: 'https://ivanmanfredi.com/fractional',
  });

  return (
    <div className="min-h-screen bg-paper">
      <section className="pt-32 pb-24 px-6">
        <div className="container mx-auto max-w-5xl">

          {/* HERO */}
          <motion.div
            initial={{ y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <span className="inline-block text-xs uppercase tracking-[0.1em] font-medium text-ink-soft border border-[color:var(--color-hairline-bold)] rounded px-2 py-1">
              AI systems · built in 30-day builds
            </span>
          </motion.div>

          <motion.h1
            initial={{ y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl lg:text-6xl font-semibold leading-[1.05] tracking-tighter mb-6 max-w-4xl"
          >
            Systems built in <span className="font-drama italic">30 days.</span><br />
            A partner that compounds.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-ink-soft max-w-2xl leading-relaxed mb-4"
          >
            Everything I build ships the same way: fixed scope, fixed price agreed before we start, systems live by day 30. No retainer. You buy a finished thing, then decide if you want the next one.
          </motion.p>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-base text-ink-mute max-w-2xl leading-relaxed mb-16"
          >
            You work with the person who builds it. No account manager, no handoff, no junior doing the actual work. I take 2-3 builds per month.
          </motion.p>

          {/* THE MAP — five systems */}
          <motion.div
            initial={{ y: 20 }}
            whileInView={{ y: 0 }}
            viewport={{ once: true }}
            className="mb-20"
          >
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-3">
              Every service business runs on <span className="font-drama italic">five systems.</span>
            </h2>
            <p className="text-ink-soft mb-10 max-w-2xl leading-relaxed">
              I build the AI version of each, one at a time, and you own every one. You start where it hurts most, usually Demand or Conversion, and the system you install starts feeding the next.
            </p>

            <div className="space-y-5 mb-8">
              {systems.map((sys, i) => (
                <div key={sys.name} className="border-l border-accent pl-6 relative">
                  <span className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-accent" aria-hidden="true" />
                  <div className="flex items-baseline justify-between gap-4 flex-wrap mb-1">
                    <h3 className="font-semibold text-lg text-black tracking-tight">
                      <span className="font-mono text-[11px] uppercase tracking-widest text-ink-mute mr-3">0{i + 1}</span>
                      {sys.name}
                    </h3>
                    <span className={`font-mono text-[10px] uppercase tracking-widest ${sys.isProduct ? 'text-black' : 'text-ink-mute'}`}>
                      {sys.livesHere}
                    </span>
                  </div>
                  <p className="text-ink-soft leading-relaxed">
                    {sys.role}
                  </p>
                </div>
              ))}
            </div>

            <p className="text-ink-soft leading-relaxed max-w-2xl mb-6">
              Each one feeds the next. Demand fills the pipeline, a clean pipeline sharpens conversion, and Command finally lets you see the bottleneck after this one. The roadmap you get after your first build is exactly that: the next system worth installing.
            </p>

            <p className="text-sm text-ink-mute leading-relaxed max-w-2xl border-l-2 border-zinc-300 pl-4">
              Two of these, Demand and Conversion, I have productized because every business needs them. The rest get shaped to your business on the call. Most businesses run beautifully on two or three, not five.
            </p>
          </motion.div>

          {/* WHAT I BUILD */}
          <motion.div
            initial={{ y: 10 }}
            whileInView={{ y: 0 }}
            viewport={{ once: true }}
            className="mb-4"
          >
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-3">
              What I build
            </h2>
            <p className="text-ink-soft mb-10 max-w-2xl">
              The two systems I have productized, plus the one that covers everything else. The fit call decides which you start with and what it costs, in one conversation.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6 mb-20">
            {builds.map((build) => (
              <motion.div
                key={build.name}
                initial={{ y: 30 }}
                whileInView={{ y: 0 }}
                viewport={{ once: true }}
                className={`flex flex-col p-7 border shadow-card ${
                  build.highlighted
                    ? 'bg-black text-white border-black'
                    : 'bg-paper text-black border-zinc-300'
                }`}
              >
                <span className={`font-mono text-xs uppercase tracking-widest mb-3 block ${build.highlighted ? 'text-accent' : 'text-ink-mute'}`}>
                  {build.tag}
                </span>
                <h3 className={`text-xl font-semibold tracking-tight mb-3 ${build.highlighted ? 'text-white' : ''}`}>
                  {build.name}
                </h3>
                <p className={`text-sm leading-relaxed mb-5 flex-1 ${build.highlighted ? 'text-zinc-300' : 'text-ink-soft'}`}>
                  {build.description}
                </p>
                <div className={`text-xs italic mb-5 pt-4 border-t ${build.highlighted ? 'border-zinc-700 text-zinc-400' : 'border-zinc-200 text-ink-mute'}`}>
                  <span className={`font-mono not-italic uppercase tracking-widest text-[10px] block mb-1 ${build.highlighted ? 'text-zinc-500' : 'text-ink-mute'}`}>
                    Best for
                  </span>
                  {build.bestFor}
                </div>
                <a
                  href={build.href}
                  className={`w-full text-center px-5 py-2.5 border font-bold tracking-wide text-xs transition-colors ${
                    build.highlighted
                      ? 'bg-accent text-black border-accent hover:bg-paper'
                      : 'bg-paper text-black border-black hover:bg-black hover:text-white'
                  }`}
                >
                  {build.name === 'Something else' ? 'Bring it to the call' : 'Learn more'}
                </a>
              </motion.div>
            ))}
          </div>

          {/* HOW A BUILD WORKS */}
          <motion.div
            initial={{ y: 20 }}
            whileInView={{ y: 0 }}
            viewport={{ once: true }}
            className="mb-20"
          >
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-3">
              How a build works
            </h2>
            <p className="text-ink-soft mb-8 max-w-2xl">
              Same five steps every time, whether it is a named system or something only your business needs.
            </p>
            <div className="space-y-6">
              {buildSteps.map((step, i) => (
                <div key={step.title} className="border-l border-accent pl-6 relative">
                  <span className="absolute -left-[7px] top-1 w-3 h-3 rounded-full bg-accent" aria-hidden="true" />
                  <div className="flex items-baseline justify-between gap-4 flex-wrap mb-1">
                    <h3 className="font-semibold text-lg text-black tracking-tight">
                      <span className="font-mono text-[11px] uppercase tracking-widest text-ink-mute mr-3">0{i + 1}</span>
                      {step.title}
                    </h3>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-ink-mute">
                      {step.duration}
                    </span>
                  </div>
                  <p className="text-ink-soft leading-relaxed">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* HONESTY CALLOUT */}
          <motion.div
            initial={{ y: 20 }}
            whileInView={{ y: 0 }}
            viewport={{ once: true }}
            className="mb-20 bg-paper-sunk border-l-2 border-accent p-8 md:p-10"
          >
            <h3 className="text-2xl md:text-3xl font-semibold tracking-tight mb-4">
              The roadmap <span className="font-drama italic">is honest.</span>
            </h3>
            <p className="text-lg text-ink-soft leading-relaxed mb-3">
              Every first build produces a roadmap of the highest-leverage systems I found while working inside your business: which of the five to install next, costed and sequenced. It is yours regardless of what you do next.
            </p>
            <p className="text-lg text-black leading-relaxed font-medium">
              If there is nothing worth building next, the roadmap says so. You move to the Care Plan or just walk with working systems. I would rather lose the next build than sell you one you don't need.
            </p>
          </motion.div>

          {/* OWNERSHIP */}
          <motion.div
            initial={{ y: 20 }}
            whileInView={{ y: 0 }}
            viewport={{ once: true }}
            className="mb-20"
          >
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-3">
              You own everything
            </h2>
            <p className="text-ink-soft mb-6 max-w-2xl">
              Every build is production-hardened and handed over: monitoring, error handling, quality checks, documentation. Not a black box you rent.
            </p>
            <ul className="space-y-3 max-w-2xl">
              {ownershipPoints.map((item) => (
                <li key={item} className="flex items-start gap-3 text-ink-soft leading-relaxed">
                  <Check size={16} className="shrink-0 mt-1 text-black" strokeWidth={3} />
                  <span>{renderInline(item)}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* PACE-TO-ABSORPTION */}
          <motion.div
            initial={{ y: 20 }}
            whileInView={{ y: 0 }}
            viewport={{ once: true }}
            className="mb-20 bg-paper-sunk border-l-2 border-accent p-8 md:p-10"
          >
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-ink-mute mb-3">
              How we pace
            </p>
            <p className="text-xl md:text-2xl leading-relaxed text-ink-soft">
              We pace to <span className="font-drama italic text-black">your absorption</span>. With AI in service businesses, the real constraint is usually your team's headspace to take on new systems, so each build ships only what you can actually integrate, leaving runway for the previous wave to land.
            </p>
          </motion.div>

          {/* THE PARTNERSHIP */}
          <motion.div
            initial={{ y: 20 }}
            whileInView={{ y: 0 }}
            viewport={{ once: true }}
            className="mb-20 max-w-3xl"
          >
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-4">
              The partnership
            </h2>
            <p className="text-base text-ink-soft leading-relaxed mb-3">
              Clients who stack builds end up with something that looks a lot like a fractional AI partner: someone who knows their business, ships every month, and answers in Slack. The difference is how you got there. Not by signing a retainer up front, but one finished project at a time, each one earning the next.
            </p>
            <p className="text-base text-ink-soft leading-relaxed">
              Step away whenever the roadmap runs dry. Come back when it doesn't.
            </p>
          </motion.div>

          {/* VS THE ALTERNATIVES */}
          <motion.div
            initial={{ y: 10 }}
            whileInView={{ y: 0 }}
            viewport={{ once: true }}
            className="mb-20 max-w-3xl space-y-3"
          >
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-3">
              vs the alternatives
            </h2>
            <p className="text-base text-ink-soft leading-relaxed">
              A full-time senior AI hire runs <span className="font-mono">$200k-$400k</span>/yr fully loaded, if you can find one. Your first systems go live for less than one month of that hire's loaded cost, in less time than their recruiting process.
            </p>
            <p className="text-base text-ink-soft leading-relaxed">
              A cheap freelance build costs less up front. What it usually doesn't include: quality checks, monitoring, error recovery, voice calibration, documentation, or anyone answering when it breaks. You find out which kind you bought in month two.
            </p>
            <p className="text-base text-ink-soft leading-relaxed">
              No recruiting risk. No ramp. No benefits. No severance. No commitment past the build you're in.
            </p>
          </motion.div>

          {/* CARE PLAN */}
          <motion.div
            initial={{ y: 20 }}
            whileInView={{ y: 0 }}
            viewport={{ once: true }}
            className="mb-20 max-w-3xl mx-auto bg-paper-sunk border border-zinc-300 p-6 md:p-7 text-center"
          >
            <span className="font-mono text-xs uppercase tracking-widest text-ink-mute mb-2 block">
              When you're done building
            </span>
            <p className="text-ink-soft leading-relaxed">
              The optional <strong className="text-black font-semibold">Care Plan at $1k/mo</strong> keeps everything alive: monitoring, fixes, prompt updates, and upgrades when new models ship. No new builds, cancel whenever. Every system I ship is eligible.
            </p>
          </motion.div>

          {/* OUT OF SCOPE */}
          <motion.div
            initial={{ y: 20 }}
            whileInView={{ y: 0 }}
            viewport={{ once: true }}
            className="mb-20"
          >
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-4">
              What's not in scope
            </h2>
            <p className="text-ink-soft mb-6">Clear boundaries protect both of us.</p>
            <ul className="space-y-3">
              {notIncluded.map((item, i) => (
                <li key={i} className="flex items-start gap-4 text-ink-soft">
                  <span className="font-mono text-zinc-400 mt-1">-</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* FAQ */}
          <motion.div
            initial={{ y: 20 }}
            whileInView={{ y: 0 }}
            viewport={{ once: true }}
            className="mb-20"
          >
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-8">
              Common questions
            </h2>
            <div className="space-y-6">
              {faqs.map((faq) => (
                <div key={faq.q} className="border-b border-[color:var(--color-hairline)] pb-6">
                  <h3 className="font-semibold text-lg text-black tracking-tight mb-2">
                    {faq.q}
                  </h3>
                  <p className="text-ink-soft leading-relaxed">
                    {faq.a}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* FINAL CTA */}
          <motion.div
            initial={{ y: 20 }}
            whileInView={{ y: 0 }}
            viewport={{ once: true }}
            className="bg-black text-white p-10 md:p-16 text-center border border-[color:var(--color-hairline-bold)]"
          >
            <h2 className="text-3xl md:text-4xl font-semibold mb-4 tracking-tight">
              Start with the fit call
            </h2>
            <p className="text-zinc-400 mb-8 max-w-xl mx-auto leading-relaxed">
              30 minutes, free. We figure out what to build first and what it costs. If the answer is "nothing yet," I'll tell you that too.
            </p>
            <a
              href="/start"
              className="btn-magnetic inline-flex items-center gap-3 px-10 py-5 bg-accent text-white font-bold text-lg tracking-wide border-subtle-thick shadow-card"
            >
              Book the fit call
              <ArrowRight aria-hidden="true" size={20} />
            </a>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default FractionalPage;

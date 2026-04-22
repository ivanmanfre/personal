import React from 'react';
import { motion } from 'framer-motion';

const steps = [
    {
        id: '01',
        title: 'Diagnose',
        desc: (
            <>The paid Agent-Ready Assessment. I score your operation on the 4 preconditions and map exactly <span className="font-drama italic">where capacity is leaking.</span> You leave with a scorecard and a 30-day roadmap. Credit applied to any follow-on engagement.</>
        ),
        color: 'bg-paper border-zinc-200',
        textColor: 'text-black',
        icon: (
            <div className="w-48 h-48 relative opacity-40">
                <svg viewBox="0 0 100 100" className="w-full h-full">
                    <path
                        d="M 50 50 L 50 0 A 50 50 0 0 1 100 50 Z"
                        fill="rgba(0,0,0,0.08)"
                    />
                    <circle cx="50" cy="50" r="20" stroke="black" strokeWidth="1" fill="none" strokeDasharray="4 4" />
                    <circle cx="50" cy="50" r="40" stroke="black" strokeWidth="1" fill="none" />
                    <line x1="50" y1="0" x2="50" y2="100" stroke="black" strokeWidth="1" opacity="0.3" />
                    <line x1="0" y1="50" x2="100" y2="50" stroke="black" strokeWidth="1" opacity="0.3" />
                    {[20, 45, 70, 85].map((pos, i) => (
                        <circle key={i} cx={pos} cy={pos} r="2" fill="black" />
                    ))}
                </svg>
            </div>
        )
    },
    {
        id: '02',
        title: 'Design',
        desc: (
            <>I architect the full system end-to-end. Every data flow, decision point, and integration drawn out <span className="font-drama italic">before anyone writes code.</span> You sign off on the blueprint, so what gets built is exactly what we agreed on.</>
        ),
        color: 'bg-paper border-zinc-200',
        textColor: 'text-black',
        icon: (
            <div className="w-48 h-32 relative opacity-50">
                <svg viewBox="0 0 200 100" className="w-full h-full">
                    <path
                        d="M 10 20 L 190 20 M 10 50 L 190 50 M 10 80 L 190 80 M 40 10 L 40 90 M 100 10 L 100 90 M 160 10 L 160 90"
                        stroke="#27272a"
                        strokeWidth="1"
                        fill="none"
                    />
                    <path
                        d="M 40 50 C 70 50, 70 20, 100 20 C 130 20, 130 80, 160 80"
                        stroke="currentColor" style={{ color: 'var(--color-accent)' }}
                        strokeWidth="2"
                        fill="none"
                    />
                    <circle cx="40" cy="50" r="3" fill="#fff" stroke="currentColor" style={{ color: 'var(--color-accent)' }} strokeWidth="1" />
                    <circle cx="100" cy="20" r="3" fill="#fff" stroke="currentColor" style={{ color: 'var(--color-accent)' }} strokeWidth="1" />
                    <circle cx="160" cy="80" r="3" fill="#fff" stroke="currentColor" style={{ color: 'var(--color-accent)' }} strokeWidth="1" />
                </svg>
            </div>
        )
    },
    {
        id: '03',
        title: 'Build',
        desc: (
            <>I build, test, and deploy into your existing stack. Most systems <span className="font-drama italic">ship in 3 to 4 weeks.</span> Your team uses it the day it launches — no multi-month rollout, no invisible progress.</>
        ),
        color: 'bg-paper border-zinc-200',
        textColor: 'text-black',
        icon: (
            <div className="w-48 h-48 relative opacity-60">
                <svg viewBox="0 0 100 100" className="w-full h-full">
                    {[20, 50, 80].map((y, i) => (
                        <rect key={`server-${i}`} x="20" y={y} width="60" height="15" rx="2" fill="none" stroke="currentColor" style={{ color: 'var(--color-accent)' }} strokeWidth="1" />
                    ))}
                    {/* Static "live" dots — no pulse, no sweep */}
                    <circle cx="72" cy="27" r="2" fill="currentColor" style={{ color: 'var(--color-accent)' }} />
                    <circle cx="72" cy="57" r="2" fill="currentColor" style={{ color: 'var(--color-accent)' }} />
                    <circle cx="72" cy="87" r="2" fill="currentColor" style={{ color: 'var(--color-accent)' }} />
                </svg>
            </div>
        )
    },
];

const Connector: React.FC = () => (
    <div className="flex flex-col items-center relative z-10 py-0">
        <div className="w-px h-20 bg-[color:var(--color-hairline-bold)]" />
    </div>
);

const Process: React.FC = () => {
    return (
        <section className="relative bg-paper py-32 border-t border-[color:var(--color-hairline)]">
            <div className="container mx-auto px-6 mb-16 flex justify-center">
                <span className="inline-block text-xs uppercase tracking-[0.1em] font-medium text-ink-soft border border-[color:var(--color-hairline-bold)] rounded px-2 py-1">
                    How We Work Together
                </span>
            </div>

            <div className="container mx-auto px-6 max-w-4xl flex flex-col items-center">
                {steps.map((step, i) => (
                    <React.Fragment key={step.id}>
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ type: 'spring', bounce: 0.25 }}
                            className={`w-full ${step.color} border`}
                        >
                            <div className="flex flex-col md:flex-row items-center gap-8 p-8 md:p-12">
                                {/* Text */}
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-6">
                                        <span className="font-mono text-xs uppercase tracking-[0.1em] text-ink-soft border border-[color:var(--color-hairline-bold)] px-2 py-1">
                                            {step.id}
                                        </span>
                                        <div className="h-px flex-grow bg-[color:var(--color-hairline-bold)] max-w-16" />
                                    </div>
                                    <h2 className={`text-3xl md:text-4xl font-semibold mb-4 tracking-tighter leading-none ${step.textColor}`}>
                                        {step.title}
                                    </h2>
                                    <p className="text-lg font-medium text-ink-soft leading-relaxed">
                                        {step.desc}
                                    </p>
                                </div>

                                {/* Icon */}
                                <div className="shrink-0 flex items-center justify-center">
                                    {step.icon}
                                </div>
                            </div>
                        </motion.div>

                        {i < steps.length - 1 && <Connector />}
                    </React.Fragment>
                ))}
            </div>
        </section>
    );
};

export default Process;

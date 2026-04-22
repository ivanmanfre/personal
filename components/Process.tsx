import React from 'react';
import { motion } from 'framer-motion';

const steps = [
    {
        id: '01',
        title: 'Diagnose',
        desc: (
            <>The Agent-Ready Assessment. I score your operation on the 4 preconditions and map exactly <span className="font-drama italic">where capacity is leaking.</span> You leave with a staged roadmap for the next 30, 90, and 180 days: what to build first, what compounds, what needs foundation work before it ships.</>
        ),
        color: 'bg-paper border-zinc-200',
        textColor: 'text-black',
        icon: (
            <div className="w-48 h-48 relative opacity-50">
                <svg viewBox="0 0 100 100" className="w-full h-full">
                    {/* Outer dial */}
                    <circle cx="50" cy="50" r="40" stroke="currentColor" style={{ color: 'var(--color-accent)' }} strokeWidth="0.75" fill="none" opacity="0.5" />
                    {/* Inner dial */}
                    <circle cx="50" cy="50" r="20" stroke="black" strokeWidth="0.75" fill="none" strokeDasharray="3 3" opacity="0.4" />
                    {/* Crosshairs */}
                    <line x1="50" y1="5" x2="50" y2="95" stroke="black" strokeWidth="0.5" opacity="0.2" />
                    <line x1="5" y1="50" x2="95" y2="50" stroke="black" strokeWidth="0.5" opacity="0.2" />
                    {/* Sweeping radar arm, 12s rotation, slow and editorial */}
                    <motion.line
                        x1="50" y1="50" x2="50" y2="10"
                        stroke="currentColor"
                        style={{ color: 'var(--color-accent)', transformOrigin: '50px 50px' }}
                        strokeWidth="1"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
                    />
                    {/* Data points, static */}
                    {[{ x: 30, y: 35 }, { x: 70, y: 40 }, { x: 60, y: 70 }, { x: 25, y: 65 }].map((pt, i) => (
                        <circle key={i} cx={pt.x} cy={pt.y} r="1.5" fill="currentColor" style={{ color: 'var(--color-accent-ink)' }} />
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
            <div className="w-48 h-32 relative opacity-60">
                <svg viewBox="0 0 200 100" className="w-full h-full">
                    {/* Grid */}
                    <path
                        d="M 10 20 L 190 20 M 10 50 L 190 50 M 10 80 L 190 80 M 40 10 L 40 90 M 100 10 L 100 90 M 160 10 L 160 90"
                        stroke="#27272a"
                        strokeWidth="0.5"
                        fill="none"
                        opacity="0.3"
                    />
                    {/* Slow-drawing accent path, 6s cycle with long pause between draws */}
                    <motion.path
                        d="M 40 50 C 70 50, 70 20, 100 20 C 130 20, 130 80, 160 80"
                        stroke="currentColor"
                        style={{ color: 'var(--color-accent)' }}
                        strokeWidth="1.5"
                        fill="none"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: [0, 1, 1] }}
                        transition={{
                            duration: 6,
                            times: [0, 0.5, 1],
                            repeat: Infinity,
                            ease: [0.25, 0.46, 0.45, 0.94],
                        }}
                    />
                    {/* Static waypoints */}
                    <circle cx="40" cy="50" r="2.5" fill="#fff" stroke="currentColor" style={{ color: 'var(--color-accent)' }} strokeWidth="1" />
                    <circle cx="100" cy="20" r="2.5" fill="#fff" stroke="currentColor" style={{ color: 'var(--color-accent)' }} strokeWidth="1" />
                    <circle cx="160" cy="80" r="2.5" fill="#fff" stroke="currentColor" style={{ color: 'var(--color-accent)' }} strokeWidth="1" />
                </svg>
            </div>
        )
    },
    {
        id: '03',
        title: 'Build',
        desc: (
            <>I build, test, and deploy into your existing stack. Your team uses it <span className="font-drama italic">the day it launches.</span> No multi-month rollout, no invisible progress.</>
        ),
        color: 'bg-paper border-zinc-200',
        textColor: 'text-black',
        icon: (
            <div className="w-48 h-48 relative opacity-70">
                <svg viewBox="0 0 100 100" className="w-full h-full">
                    {[20, 50, 80].map((y, i) => (
                        <rect key={`server-${i}`} x="20" y={y} width="60" height="15" rx="1.5" fill="none" stroke="currentColor" style={{ color: 'var(--color-accent)' }} strokeWidth="0.75" />
                    ))}
                    {/* Subtle live-state pulses, staggered, 3s cycle, low opacity shift */}
                    {[27, 57, 87].map((y, i) => (
                        <motion.circle
                            key={`pulse-${i}`}
                            cx="72"
                            cy={y}
                            r="2"
                            fill="currentColor"
                            style={{ color: 'var(--color-accent)' }}
                            animate={{ opacity: [1, 0.4, 1] }}
                            transition={{
                                duration: 3,
                                repeat: Infinity,
                                delay: i * 0.6,
                                ease: [0.25, 0.46, 0.45, 0.94],
                            }}
                        />
                    ))}
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

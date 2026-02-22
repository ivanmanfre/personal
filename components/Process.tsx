import React from 'react';
import { motion } from 'framer-motion';

const steps = [
    {
        id: '01',
        title: 'Diagnostic Phase',
        desc: 'I map every process, data flow, and manual touchpoint in your business to find exactly where time and capital are leaking.',
        color: 'bg-white',
        textColor: 'text-black',
        icon: (
            <div className="w-48 h-48 relative opacity-40">
                <svg viewBox="0 0 100 100" className="w-full h-full">
                    <motion.path
                        d="M 50 50 L 50 0 A 50 50 0 0 1 100 50 Z"
                        fill="rgba(0,0,0,0.1)"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                        style={{ transformOrigin: "50px 50px" }}
                    />
                    <circle cx="50" cy="50" r="20" stroke="black" strokeWidth="1" fill="none" strokeDasharray="4 4" />
                    <circle cx="50" cy="50" r="40" stroke="black" strokeWidth="2" fill="none" />
                    <line x1="50" y1="0" x2="50" y2="100" stroke="black" strokeWidth="1" opacity="0.3" />
                    <line x1="0" y1="50" x2="100" y2="50" stroke="black" strokeWidth="1" opacity="0.3" />
                    {[20, 45, 70, 85].map((pos, i) => (
                        <motion.circle
                            key={i}
                            cx={pos}
                            cy={pos}
                            r="2"
                            fill="black"
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: [1, 2, 1], opacity: [1, 0, 1] }}
                            transition={{ duration: 2, repeat: Infinity, delay: i * 0.5 }}
                        />
                    ))}
                </svg>
            </div>
        )
    },
    {
        id: '02',
        title: 'Architecture Blueprint',
        desc: 'You receive a complete system architecture: immutable data models, secure API routes, and logic trees — before a single workflow is built.',
        color: 'bg-black',
        textColor: 'text-white',
        icon: (
            <div className="w-48 h-32 relative opacity-50">
                <svg viewBox="0 0 200 100" className="w-full h-full">
                    <motion.path
                        d="M 10 20 L 190 20 M 10 50 L 190 50 M 10 80 L 190 80 M 40 10 L 40 90 M 100 10 L 100 90 M 160 10 L 160 90"
                        stroke="#27272a"
                        strokeWidth="1"
                        fill="none"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <motion.path
                        d="M 40 50 C 70 50, 70 20, 100 20 C 130 20, 130 80, 160 80"
                        stroke="#00E676"
                        strokeWidth="3"
                        fill="none"
                        initial={{ pathLength: 0, pathOffset: 1 }}
                        animate={{ pathLength: 1, pathOffset: 0 }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    />
                    <circle cx="40" cy="50" r="4" fill="#fff" />
                    <circle cx="100" cy="20" r="4" fill="#fff" />
                    <circle cx="160" cy="80" r="4" fill="#fff" />
                </svg>
            </div>
        )
    },
    {
        id: '03',
        title: 'Deployment Protocol',
        desc: 'I construct, stress-test, and deploy the workflow end-to-end into your tech stack. Operations shift from manual drag to automated throughput instantly.',
        color: 'bg-zinc-900',
        textColor: 'text-white',
        icon: (
            <div className="w-48 h-48 relative opacity-60">
                <svg viewBox="0 0 100 100" className="w-full h-full">
                    {[20, 50, 80].map((y, i) => (
                        <rect key={`server-${i}`} x="20" y={y} width="60" height="15" rx="2" fill="none" stroke="#00E676" strokeWidth="2" />
                    ))}
                    {[27, 57, 87].map((y, i) => (
                        <motion.line
                            key={`pulse-${i}`}
                            x1="25"
                            y1={y}
                            x2="45"
                            y2={y}
                            stroke="#fff"
                            strokeWidth="2"
                            initial={{ x: 0, opacity: 0 }}
                            animate={{ x: [0, 30, 0], opacity: [0, 1, 0] }}
                            transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3, ease: "easeInOut" }}
                        />
                    ))}
                    <motion.circle cx="72" cy="27" r="2" fill="#00E676" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 0.5, repeat: Infinity }} />
                    <motion.circle cx="72" cy="57" r="2" fill="#00E676" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 0.8, repeat: Infinity }} />
                    <motion.circle cx="72" cy="87" r="2" fill="#00E676" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 0.6, repeat: Infinity }} />
                </svg>
            </div>
        )
    },
];

const Connector: React.FC = () => (
    <div className="flex flex-col items-center relative z-10 py-0">
        {/* Output dot */}
        <div className="w-5 h-5 rounded-full bg-zinc-900 border-2 border-accent flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-accent" />
        </div>

        {/* Animated path */}
        <div className="relative w-px h-16 bg-zinc-800 overflow-visible">
            <motion.div
                className="absolute left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-accent"
                animate={{ top: ['0%', '100%'] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
            />
        </div>

        {/* Arrow */}
        <svg width="16" height="10" viewBox="0 0 16 10" className="text-accent">
            <path d="M8 10 L0 0 L16 0 Z" fill="#00E676" />
        </svg>

        {/* Input dot */}
        <div className="w-5 h-5 rounded-full bg-zinc-900 border-2 border-accent flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
        </div>
    </div>
);

const Process: React.FC = () => {
    return (
        <section className="relative bg-zinc-950 py-24">
            <div className="container mx-auto px-6 mb-16 flex justify-center">
                <div className="inline-flex items-center gap-2 px-6 py-3 bg-white border-4 border-black text-black font-black uppercase tracking-widest text-xl shadow-[8px_8px_0px_0px_rgba(0,230,118,1)] transform -rotate-2">
                    The Architecture Protocol
                </div>
            </div>

            <div className="container mx-auto px-6 max-w-4xl flex flex-col items-center">
                {steps.map((step, i) => (
                    <React.Fragment key={step.id}>
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ type: 'spring', bounce: 0.25 }}
                            className={`w-full ${step.color} border-4 border-zinc-800`}
                        >
                            <div className="flex flex-col md:flex-row items-center gap-8 p-8 md:p-12">
                                {/* Text */}
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-6">
                                        <span className="font-mono text-2xl font-black bg-accent text-black px-3 py-1 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                                            {step.id}
                                        </span>
                                        <div className="h-0.5 flex-grow bg-zinc-800 max-w-16" />
                                    </div>
                                    <h2 className={`text-3xl md:text-4xl font-black uppercase mb-4 tracking-tighter leading-none ${step.textColor}`}>
                                        {step.title}
                                    </h2>
                                    <p className="text-lg font-medium text-zinc-500 leading-relaxed">
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

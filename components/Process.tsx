import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

const steps = [
    {
        id: '01',
        title: 'Diagnostic Phase',
        desc: 'I map every process, data flow, and manual touchpoint in your business to find exactly where time and capital are leaking.',
        color: 'bg-white',
        textColor: 'text-black',
        icon: (
            <div className="w-64 h-64 relative opacity-40">
                <svg viewBox="0 0 100 100" className="w-full h-full">
                    {/* Radar Sweep */}
                    <motion.path
                        d="M 50 50 L 50 0 A 50 50 0 0 1 100 50 Z"
                        fill="rgba(0,0,0,0.1)"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                        style={{ transformOrigin: "50px 50px" }}
                    />
                    {/* Concentric Assessment Rings */}
                    <circle cx="50" cy="50" r="20" stroke="black" strokeWidth="1" fill="none" strokeDasharray="4 4" />
                    <circle cx="50" cy="50" r="40" stroke="black" strokeWidth="2" fill="none" />
                    {/* Targeting Crosshairs */}
                    <line x1="50" y1="0" x2="50" y2="100" stroke="black" strokeWidth="1" opacity="0.3" />
                    <line x1="0" y1="50" x2="100" y2="50" stroke="black" strokeWidth="1" opacity="0.3" />
                    {/* Ping Dots */}
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
        desc: 'You receive a complete system architecture: immutable data models, secure API routes, and logic trees, before a single line of code is written.',
        color: 'bg-black',
        textColor: 'text-white',
        icon: (
            <div className="w-72 h-48 relative opacity-50">
                <svg viewBox="0 0 200 100" className="w-full h-full">
                    {/* Grid Matrix Drawing */}
                    <motion.path
                        d="M 10 20 L 190 20 M 10 50 L 190 50 M 10 80 L 190 80 M 40 10 L 40 90 M 100 10 L 100 90 M 160 10 L 160 90"
                        stroke="#27272a" /* zinc-800 */
                        strokeWidth="1"
                        fill="none"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    />
                    {/* Logic Node Connections */}
                    <motion.path
                        d="M 40 50 C 70 50, 70 20, 100 20 C 130 20, 130 80, 160 80"
                        stroke="#00E676" /* accent */
                        strokeWidth="3"
                        fill="none"
                        initial={{ pathLength: 0, pathOffset: 1 }}
                        animate={{ pathLength: 1, pathOffset: 0 }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        style={{  }}
                    />
                    {/* Logic Nodes */}
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
            <div className="w-64 h-64 relative opacity-60">
                <svg viewBox="0 0 100 100" className="w-full h-full">
                    {/* Server Stacks */}
                    {[20, 50, 80].map((y, i) => (
                        <rect key={`server-${i}`} x="20" y={y} width="60" height="15" rx="2" fill="none" stroke="#2979FF" strokeWidth="2" />
                    ))}
                    {/* Data Pulses passing through servers */}
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
                            style={{ filter: 'drop-shadow(0px 0px 4px rgba(255, 255, 255, 0.8))' }}
                        />
                    ))}
                    {/* Status Indicators */}
                    <motion.circle cx="72" cy="27" r="2" fill="#00E676" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 0.5, repeat: Infinity }} />
                    <motion.circle cx="72" cy="57" r="2" fill="#00E676" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 0.8, repeat: Infinity }} />
                    <motion.circle cx="72" cy="87" r="2" fill="#00E676" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 0.6, repeat: Infinity }} />
                </svg>
            </div>
        )
    },
];

const StackCard: React.FC<{
    step: typeof steps[0];
    i: number;
    totalSteps: number;
    progress: any;
    range: number[];
    targetScale: number;
}> = ({ step, i, totalSteps, progress, range, targetScale }) => {

    const container = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({
        target: container,
        offset: ['start end', 'start start']
    });

    const imageScale = useTransform(scrollYProgress, [0, 1], [2, 1]);
    const scale = useTransform(progress, range, [1, targetScale]);

    return (
        <div ref={container} className="h-[55vh] flex items-center justify-center sticky top-0">
            <motion.div
                style={{ scale, top: `calc(-5vh + ${i * 25}px)` }}
                className={`flex flex-col relative ${step.color} border-2 border-zinc-800 w-full max-w-6xl h-[55vh] md:h-[50vh] mx-auto px-4 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.6)] origin-top`}
            >
                {/* Visual Artifact Container */}
                <div className="absolute inset-0 w-full h-full flex items-center justify-center lg:justify-end lg:pr-32 opacity-30 lg:opacity-100 pointer-events-none z-0">
                    {step.icon}
                </div>

                <div className="flex flex-col justify-center h-full p-8 md:p-12 lg:p-16 relative z-10 lg:w-2/3">
                    <div className="flex items-center gap-3 mb-6">
                        <span className="font-mono text-2xl md:text-3xl font-black bg-accent text-black px-3 py-1 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                            {step.id}
                        </span>
                        <div className="h-0.5 flex-grow bg-zinc-800 max-w-24"></div>
                    </div>

                    <h2 className={`text-3xl md:text-4xl lg:text-5xl font-black uppercase mb-6 tracking-tighter leading-none font-drama italic ${step.textColor}`}>
                        {step.title}
                    </h2>

                    <p className="text-lg md:text-xl font-medium text-zinc-500 leading-relaxed max-w-xl">
                        {step.desc}
                    </p>
                </div>

                {/* n8n Input Port (top center) */}
                {i > 0 && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-30">
                        <div className="w-6 h-6 rounded-full bg-zinc-900 border-2 border-accent flex items-center justify-center shadow-[0_0_12px_rgba(0,230,118,0.3)]">
                            <div className="w-2 h-2 rounded-full bg-accent"></div>
                        </div>
                    </div>
                )}

                {/* n8n Output Port (bottom center) */}
                {i < totalSteps - 1 && (
                    <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-30">
                        <div className="w-6 h-6 rounded-full bg-zinc-900 border-2 border-accent flex items-center justify-center shadow-[0_0_12px_rgba(0,230,118,0.3)]">
                            <div className="w-2 h-2 rounded-full bg-accent animate-pulse"></div>
                        </div>
                    </div>
                )}
            </motion.div>
        </div>
    );
};

const Process: React.FC = () => {
    const container = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({
        target: container,
        offset: ['start start', 'end end']
    });

    return (
        <section ref={container} className="relative bg-zinc-950 pt-16 pb-16">
            <div className="container mx-auto px-6 mb-[6vh] relative z-10 flex justify-center">
                <div className="inline-flex items-center gap-2 px-6 py-3 bg-white border-4 border-black text-black font-black uppercase tracking-widest text-xl shadow-[8px_8px_0px_0px_rgba(0,230,118,1)] transform -rotate-2">
                    The Architecture Protocol
                </div>
            </div>

            {steps.map((step, i) => {
                const targetScale = 1 - ((steps.length - i) * 0.05);
                return (
                    <StackCard
                        key={step.id}
                        i={i}
                        totalSteps={steps.length}
                        step={step}
                        progress={scrollYProgress}
                        range={[i * .25, 1]}
                        targetScale={targetScale}
                    />
                );
            })}
        </section>
    );
};

export default Process;
import React from 'react';
import { motion } from 'framer-motion';
import { FileText, Webhook, Brain, CheckCircle } from 'lucide-react';

// Editorial-grade pipeline diagram. Still structure; one purposeful animation
// (data flowing left→right through the 3 nodes). No cursor, no frantic pulses,
// no black chips. Tells the "I build agent pipelines" story without the 2022
// SaaS demo theatrics.

const AutomationCursorFlow: React.FC = () => {
    return (
        <div className="w-full h-80 bg-paper rounded-2xl border border-[color:var(--color-hairline)] shadow-card-subtle relative overflow-hidden">

            {/* Decorative grid, static */}
            <div
                className="absolute inset-0 opacity-[0.06]"
                style={{
                    backgroundImage: "linear-gradient(to right, #000 1px, transparent 1px), linear-gradient(to bottom, #000 1px, transparent 1px)",
                    backgroundSize: '20px 20px',
                }}
            />

            {/* Hairline section label */}
            <div className="absolute top-4 left-4 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-soft border border-[color:var(--color-hairline-bold)] px-2 py-1 z-20">
                Agent-Ready Pipeline
            </div>

            <div className="p-8 h-full flex flex-col justify-center relative z-10 w-full">

                <div className="flex justify-between items-center w-full max-w-sm mx-auto relative mt-6">

                    {/* Connection line base */}
                    <div className="absolute top-1/2 left-0 w-full h-px bg-[color:var(--color-hairline-bold)] -z-10 translate-y-[-50%]" />

                    {/* Slow, editorial "data flow" pulse moving left to right through the pipeline */}
                    <motion.div
                        className="absolute top-1/2 h-px w-12 -z-10 translate-y-[-50%]"
                        style={{
                            background: 'linear-gradient(90deg, transparent 0%, var(--color-accent) 50%, transparent 100%)',
                        }}
                        animate={{ left: ['-12%', '100%'] }}
                        transition={{
                            duration: 5,
                            repeat: Infinity,
                            ease: 'linear',
                        }}
                    />

                    {/* Node 1: Trigger, pulses when data arrives */}
                    <div className="flex flex-col items-center gap-2">
                        <motion.div
                            className="w-14 h-14 bg-white border border-[color:var(--color-hairline-bold)] flex items-center justify-center shadow-card-subtle z-10 relative"
                            animate={{ borderColor: ['rgba(26,26,26,0.25)', 'var(--color-accent)', 'rgba(26,26,26,0.25)'] }}
                            transition={{ duration: 5, times: [0, 0.1, 0.25], repeat: Infinity, ease: 'easeOut' }}
                        >
                            <Webhook size={22} className="text-black" />
                        </motion.div>
                        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute">Trigger</span>
                    </div>

                    {/* Node 2: Logic, pulses mid-cycle */}
                    <div className="flex flex-col items-center gap-2">
                        <motion.div
                            className="w-14 h-14 bg-white border border-[color:var(--color-hairline-bold)] flex items-center justify-center shadow-card-subtle z-10 relative"
                            animate={{ borderColor: ['rgba(26,26,26,0.25)', 'var(--color-accent)', 'rgba(26,26,26,0.25)'] }}
                            transition={{ duration: 5, times: [0.35, 0.5, 0.65], repeat: Infinity, ease: 'easeOut' }}
                        >
                            <Brain size={22} className="text-accent-ink" />
                        </motion.div>
                        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute">Agent Logic</span>
                    </div>

                    {/* Node 3: Output, pulses end of cycle */}
                    <div className="flex flex-col items-center gap-2">
                        <motion.div
                            className="w-14 h-14 bg-white border border-[color:var(--color-hairline-bold)] flex items-center justify-center shadow-card-subtle z-10 relative"
                            animate={{ borderColor: ['rgba(26,26,26,0.25)', 'var(--color-accent)', 'rgba(26,26,26,0.25)'] }}
                            transition={{ duration: 5, times: [0.75, 0.9, 1], repeat: Infinity, ease: 'easeOut' }}
                        >
                            <FileText size={22} className="text-black" />
                        </motion.div>
                        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute">Generate Output</span>
                    </div>
                </div>

                {/* Status indicator, subtle live pulse */}
                <div className="mt-12 text-center w-full">
                    <div className="inline-flex items-center gap-2 px-3 py-1 border border-[color:var(--color-hairline-bold)]">
                        <motion.span
                            className="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent"
                            animate={{ opacity: [1, 0.4, 1] }}
                            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                        />
                        <span className="font-mono text-[10px] uppercase text-ink-soft tracking-[0.1em]">
                            Running · Monitored
                        </span>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default AutomationCursorFlow;

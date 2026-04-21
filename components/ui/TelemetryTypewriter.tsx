import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const feedData = [
    "[INTAKE] Structured input: 24/24 fields parsed. PASS",
    "[LOGIC] Decision tree matched: lead_qualification.v3",
    "[AGENT] Scoring 248 leads against defined rubric...",
    "[SCORE] 47 qualified, 184 nurture, 17 disqualified",
    "[REVIEW] 3 edge cases routed to human review",
    "[HANDOFF] Qualified leads synced to HubSpot",
    "[AUDIT] Decision log written to long-term storage",
    "[WAITING] Polling for next batch..."
];

const TelemetryTypewriter: React.FC = () => {
    const [lines, setLines] = useState<string[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        if (currentIndex < feedData.length) {
            const timer = setTimeout(() => {
                setLines(prev => [...prev, feedData[currentIndex]]);
                setCurrentIndex(prev => prev + 1);
            }, Math.random() * 800 + 400);
            return () => clearTimeout(timer);
        } else {
            const resetTimer = setTimeout(() => {
                setLines([]);
                setCurrentIndex(0);
            }, 5000);
            return () => clearTimeout(resetTimer);
        }
    }, [currentIndex]);

    return (
        <div className="w-full h-fit bg-paper-sunk border border-[color:var(--color-hairline-bold)] relative overflow-hidden font-mono">

            {/* Header Bar */}
            <div className="border-b border-[color:var(--color-hairline)] p-3 flex justify-between items-center relative z-10">
                <span className="text-xs uppercase tracking-[0.1em] text-ink-soft">Agent log</span>
                <div className="flex items-center gap-2">
                    <span className="relative flex h-1.5 w-1.5">
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent"></span>
                    </span>
                    <span className="text-[10px] text-ink-soft uppercase tracking-[0.1em]">Live</span>
                </div>
            </div>

            {/* Content Area */}
            <div className="p-6 h-64 overflow-y-auto no-scrollbar flex flex-col justify-end text-sm relative z-10">
                <AnimatePresence>
                    {lines.map((line, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className={`mb-2 ${line.includes('[REVIEW]') || line.includes('[HANDOFF]') ? 'text-accent-ink font-medium' :
                                    line.includes('[WAITING]') ? 'text-ink-mute' :
                                        'text-ink-soft'
                                }`}
                        >
                            <span className="text-ink-mute mr-2">{'>'}</span>{line}
                        </motion.div>
                    ))}
                </AnimatePresence>
                <motion.div
                    animate={{ opacity: [1, 0] }}
                    transition={{ repeat: Infinity, duration: 0.8 }}
                    className="w-2 h-4 bg-ink mt-1 inline-block"
                />
            </div>
        </div>
    );
};

export default TelemetryTypewriter;

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TerminalSquare } from 'lucide-react';

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
            }, Math.random() * 800 + 400); // Random delay between 400ms and 1200ms
            return () => clearTimeout(timer);
        } else {
            // Reset loop after a long pause
            const resetTimer = setTimeout(() => {
                setLines([]);
                setCurrentIndex(0);
            }, 5000);
            return () => clearTimeout(resetTimer);
        }
    }, [currentIndex]);

    return (
        <div className="w-full h-fit bg-zinc-950 border-subtle-thick border-zinc-800 shadow-lg relative overflow-hidden font-mono group hover:border-accent transition-colors">

            {/* Header Bar */}
            <div className="bg-zinc-900 border-b border-zinc-800 p-3 flex justify-between items-center relative z-10">
                <div className="flex items-center gap-3">
                    <TerminalSquare size={16} className="text-zinc-500" />
                    <span className="text-xs uppercase tracking-widest text-zinc-500 font-bold">System_Telemetry.log</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
                    </span>
                    <span className="text-[10px] text-accent uppercase tracking-widest">Live</span>
                </div>
            </div>

            {/* Content Area */}
            <div className="p-6 h-64 overflow-y-auto no-scrollbar flex flex-col justify-end text-sm md:text-base relative z-10">
                <AnimatePresence>
                    {lines.map((line, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className={`mb-2 font-medium ${line.includes('[REVIEW]') || line.includes('[HANDOFF]') ? 'text-accent' :
                                    line.includes('[WAITING]') ? 'text-zinc-500' :
                                        'text-zinc-300'
                                }`}
                        >
                            <span className="text-zinc-600 mr-2">{'>'}</span>{line}
                        </motion.div>
                    ))}
                </AnimatePresence>
                {/* Blinking Cursor */}
                <motion.div
                    animate={{ opacity: [1, 0] }}
                    transition={{ repeat: Infinity, duration: 0.8 }}
                    className="w-2 h-4 bg-accent mt-1 inline-block"
                />
            </div>

            {/* Scanline effect removed — cleaner editorial feel */}
        </div>
    );
};

export default TelemetryTypewriter;

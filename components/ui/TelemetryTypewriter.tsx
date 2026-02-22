import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, TerminalSquare } from 'lucide-react';

const feedData = [
    "[WEBHOOK_RECEIVED] source: docusign_connect payload: contract_signed",
    "[PROCESSING] Extracting entities via Claude-3-Opus... success. 248ms",
    "[ACTION] Created Google Drive workspace: _Client_AcmeCorp",
    "[API_CALL] Generating SLA templates from repository...",
    "[ACTION] Slack channel #ext-acme-corp created. 3 users invited.",
    "[SYSTEM] Workflow 'SignFlow' execution completed. Status: 200 OK",
    "[WAITING] Polling for next event..."
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
        <div className="w-full h-fit bg-zinc-950 comic-border-thick border-zinc-800 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden font-mono group hover:border-accent transition-colors">

            {/* Header Bar */}
            <div className="bg-zinc-900 border-b-2 border-zinc-800 p-3 flex justify-between items-center relative z-10">
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
                            className={`mb-2 font-medium ${line.includes('[WEBHOOK') ? 'text-pink' :
                                    line.includes('[ACTION]') ? 'text-accent' :
                                        line.includes('[SYSTEM]') ? 'text-cyan' :
                                            'text-zinc-400'
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

            {/* Scanline Effect */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan/5 to-transparent h-[200%] w-full animate-scanline pointer-events-none z-0 opacity-20 group-hover:opacity-40 transition-opacity" />
        </div>
    );
};

export default TelemetryTypewriter;

import React from 'react';
import { motion } from 'framer-motion';
import { FileText, Webhook, Brain, CheckCircle } from 'lucide-react';

const AutomationCursorFlow: React.FC = () => {

    return (
        <div className="w-full h-80 bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden group hover:border-accent transition-colors">

            {/* Decorative Grid */}
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "linear-gradient(to right, #000 1px, transparent 1px), linear-gradient(to bottom, #000 1px, transparent 1px)", backgroundSize: '20px 20px' }} />

            <div className="absolute top-4 left-4 bg-black text-white font-mono text-[10px] uppercase tracking-widest px-2 py-1 shadow-[2px_2px_0px_0px_rgba(0,230,118,1)] z-20">
                System Builder Instance
            </div>

            <div className="p-8 h-full flex flex-col justify-center relative z-10 w-full">

                {/* The Nodes */}
                <div className="flex justify-between items-center w-full max-w-sm mx-auto relative mt-6">

                    {/* Connection Line */}
                    <div className="absolute top-1/2 left-0 w-full h-1 bg-zinc-200 -z-10 translate-y-[-50%]"></div>
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                        className="absolute top-1/2 left-0 h-1 bg-black -z-10 translate-y-[-50%]"
                    />

                    {/* Node 1: Trigger */}
                    <div className="flex flex-col items-center gap-2">
                        <motion.div
                            initial={{ scale: 1, backgroundColor: "#fff" }}
                            animate={{ scale: [1, 0.9, 1], backgroundColor: ["#fff", "#00E676", "#fff"] }}
                            transition={{ duration: 4, times: [0, 0.1, 0.3], repeat: Infinity }}
                            className="w-14 h-14 bg-white border-2 border-black flex items-center justify-center shadow-[4px_4px_0px_0px_black] z-10 relative"
                        >
                            <Webhook size={24} className="text-black" />
                        </motion.div>
                        <span className="font-mono text-[9px] uppercase font-bold text-zinc-500">Trigger</span>
                    </div>

                    {/* Node 2: Logic */}
                    <div className="flex flex-col items-center gap-2">
                        <motion.div
                            initial={{ scale: 1, backgroundColor: "#fff" }}
                            animate={{ scale: [1, 0.9, 1], backgroundColor: ["#fff", "#2979FF", "#fff"] }}
                            transition={{ duration: 4, times: [0, 0.4, 0.6], repeat: Infinity }}
                            className="w-14 h-14 bg-white border-2 border-black flex items-center justify-center shadow-[4px_4px_0px_0px_black] z-10 relative"
                        >
                            <Brain size={24} className="text-black" />
                        </motion.div>
                        <span className="font-mono text-[9px] uppercase font-bold text-zinc-500">Agent Logic</span>
                    </div>

                    {/* Node 3: Output */}
                    <div className="flex flex-col items-center gap-2">
                        <motion.div
                            initial={{ scale: 1, backgroundColor: "#fff" }}
                            animate={{ scale: [1, 1.1, 1], backgroundColor: ["#fff", "#FF4081", "#fff"] }}
                            transition={{ duration: 4, times: [0, 0.7, 0.9], repeat: Infinity }}
                            className="w-14 h-14 bg-white border-2 border-black flex items-center justify-center shadow-[4px_4px_0px_0px_black] z-10 relative"
                        >
                            <FileText size={24} className="text-black" />
                        </motion.div>
                        <span className="font-mono text-[9px] uppercase font-bold text-zinc-500">Generate Output</span>
                    </div>
                </div>

                {/* Simulated Live Action Log */}
                <div className="mt-12 text-center w-full">
                    <motion.div
                        animate={{ opacity: [1, 0, 1] }}
                        transition={{ duration: 0.5, repeat: Infinity }}
                        className="inline-flex items-center gap-2 px-3 py-1 bg-zinc-100 border-2 border-black shadow-[2px_2px_0px_0px_black]"
                    >
                        <CheckCircle size={14} className="text-black" />
                        <span className="font-mono text-xs uppercase font-bold text-black tracking-widest">
                            System Active & Syncing
                        </span>
                    </motion.div>
                </div>

            </div>

            {/* The Animated Cursor */}
            <motion.div
                animate={{
                    x: ["10%", "30%", "30%", "60%", "60%", "90%", "90%", "10%"],
                    y: ["80%", "45%", "45%", "45%", "45%", "45%", "45%", "80%"],
                    scale: [1, 1, 0.8, 1, 0.8, 1, 0.8, 1] // Click effect
                }}
                transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut",
                    times: [0, 0.1, 0.15, 0.4, 0.45, 0.7, 0.75, 1]
                }}
                className="absolute z-30 pointer-events-none drop-shadow-xl"
                style={{ width: '28px', height: '28px' }}
            >
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4 2L20 10L13 13L16 20L13 22L10 15L4 18V2Z" fill="black" stroke="white" strokeWidth="2" strokeLinejoin="round" />
                </svg>
            </motion.div>

        </div>
    );
};

export default AutomationCursorFlow;

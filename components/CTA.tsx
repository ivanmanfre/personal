import React from 'react';
import { motion } from 'framer-motion';

const CTA: React.FC = () => {
    return (
        <section className="py-24 bg-paper relative overflow-hidden border-t border-zinc-200">
            <div className="container mx-auto px-6 text-center relative z-10">
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    whileInView={{ scale: 1, opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ type: "spring", duration: 0.8 }}
                    className="bg-white border border-zinc-200 p-12 shadow-card max-w-4xl mx-auto"
                >
                    <h2 className="text-4xl md:text-5xl lg:text-6xl font-semibold mb-6 leading-[0.9]">
                        Ready to grow <br /> <span className="font-drama italic">without hiring?</span>
                    </h2>
                    <p className="text-xl font-normal mb-10 max-w-lg mx-auto">
                        A 1-week paid diagnostic. Scored readiness plus a 30-day roadmap. 100% credited toward any follow-on engagement.
                    </p>

                    <a
                        href="/assessment"
                        className="btn-magnetic relative z-20 group inline-flex items-center gap-3 px-12 py-6 bg-black text-white text-xl font-semibold border border-zinc-200 shadow-card focus:outline-none"
                    >
                        <span className="relative z-10 tracking-wide">Start with the Assessment — $2,500</span>
                    </a>

                    <p className="mt-6 text-sm text-zinc-500">
                        Prefer to talk first? <a href="/start" className="underline hover:text-black">Book a call</a>.
                    </p>
                </motion.div>
            </div>
        </section>
    );
};

export default CTA;
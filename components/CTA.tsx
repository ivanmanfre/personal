import React from 'react';
import { motion } from 'framer-motion';

const CTA: React.FC = () => {
    return (
        <section className="py-32 bg-paper relative overflow-hidden border-t border-[color:var(--color-hairline)]">
            <div className="container mx-auto px-6 text-center relative z-10">
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    whileInView={{ scale: 1, opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ type: "spring", duration: 0.8 }}
                    className="bg-paper rounded-xl border border-[color:var(--color-hairline)] p-12 shadow-card-subtle max-w-4xl mx-auto"
                >
                    <h2 className="text-4xl md:text-5xl lg:text-6xl font-semibold mb-6 leading-[0.9]">
                        Ready to grow <br /> <span className="font-drama italic">without hiring?</span>
                    </h2>
                    <p className="text-xl font-normal mb-10 max-w-lg mx-auto">
                        A 1-week diagnostic. I evaluate your operation against the 4 preconditions and hand back a staged 30, 90, and 180-day roadmap.
                    </p>

                    <a
                        href="/assessment"
                        className="inline-flex items-center gap-3 px-8 py-4 bg-black text-white font-semibold tracking-wide hover:bg-accent-ink transition-colors"
                    >
                        Start with the Assessment
                    </a>

                    <p className="mt-6 text-sm text-ink-mute">
                        Prefer to talk first? <a href="/start" className="underline hover:text-black">Book a call</a>.
                    </p>
                </motion.div>
            </div>
        </section>
    );
};

export default CTA;
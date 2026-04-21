import React from 'react';
import { motion } from 'framer-motion';
import { Target } from 'lucide-react';

const About: React.FC = () => {

    return (
        <section id="about" className="py-32 bg-paper-sunk relative overflow-hidden border-t border-[color:var(--color-hairline)]">
            <div className="container mx-auto px-6 relative z-10 max-w-6xl">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="mb-20 flex justify-center"
                >
                    <div className="inline-flex items-center gap-2 px-3 py-1 border border-[color:var(--color-hairline-bold)] text-ink-soft font-mono text-[11px] uppercase tracking-[0.14em]">
                        <Target size={12} className="text-accent-ink" /> Core Philosophy
                    </div>
                </motion.div>

                <div className="flex flex-col gap-24">

                    {/* Contrast 1 */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="text-center md:text-left border-l border-[color:var(--color-hairline-bold)] pl-6 md:pl-8"
                    >
                        <p className="text-xl md:text-3xl font-medium text-ink-soft mb-6 tracking-tight">
                            Most consultants focus on writing strategy decks.
                        </p>
                        <h2 className="text-4xl md:text-5xl lg:text-6xl font-semibold text-black leading-[1] tracking-tighter">
                            I focus on <br /> <span className="text-accent-ink">Deploying Systems.</span>
                        </h2>
                    </motion.div>

                    {/* Contrast 2 */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="text-center md:text-right border-r border-[color:var(--color-hairline-bold)] pr-6 md:pr-8"
                    >
                        <p className="text-xl md:text-3xl font-medium text-ink-soft mb-6 tracking-tight">
                            Most AI projects fail. Not because of the model.
                        </p>
                        <h2 className="text-4xl md:text-5xl lg:text-6xl font-semibold text-black leading-[1] tracking-tighter">
                            I make you <br /> <span className="text-accent-ink">Agent-Ready.</span>
                        </h2>
                    </motion.div>

                </div>

                {/* About Me */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                    className="mt-24 flex flex-col md:flex-row items-center gap-12 md:gap-16"
                >
                    {/* Photo */}
                    <div className="shrink-0 relative group hover-lift">
                        <picture>
                            <source
                                type="image/webp"
                                srcSet="/ivan-portrait-400.webp 400w, /ivan-portrait-800.webp 800w"
                                sizes="(max-width: 768px) 192px, 224px"
                            />
                            <img
                                src="/ivan-portrait.jpg"
                                alt="Iván Manfredi"
                                width="400"
                                height="400"
                                loading="lazy"
                                className="relative z-10 w-48 h-48 md:w-56 md:h-56 object-cover border border-[color:var(--color-hairline-bold)] transition-all duration-500 portrait-editorial"
                            />
                        </picture>
                    </div>

                    {/* Bio */}
                    <div className="flex-1 text-center md:text-left">
                        <h3 className="text-3xl md:text-4xl font-semibold text-black mb-4 tracking-tight">
                            Iván <span className="font-drama italic">Manfredi</span>
                        </h3>
                        <p className="font-mono text-[11px] text-accent-ink uppercase tracking-[0.14em] mb-4">Agent-Ready Ops™</p>
                        <p className="text-lg text-ink-soft leading-relaxed max-w-xl">
                            I've shipped 100+ AI and automation systems for growing service businesses - agencies, consultancies, law and accounting firms. Every engagement is a productized project or a flat-rate retainer tied to outcomes. Never hourly.
                        </p>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.4 }}
                    className="mt-32 max-w-4xl mx-auto text-center"
                >
                    <div className="bg-white rounded-2xl border border-[color:var(--color-hairline)] p-8 md:p-12 shadow-card-subtle relative group hover-lift transition-all">
                        <div className="absolute top-0 right-0 w-0 h-0 border-l-[40px] border-l-transparent border-t-[40px] border-t-accent"></div>

                        <p className="text-lg md:text-xl text-ink-soft leading-relaxed">
                            Every project follows one rule: <br /><br />
                            <span className="text-black font-semibold">If it doesn't pay back in 90 days, I don't build it.</span> <br /><br />
                            The 90-Day Payback Rule. No exceptions.
                        </p>
                    </div>
                </motion.div>

            </div>
        </section>
    );
};

export default About;

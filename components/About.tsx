import React from 'react';
import { motion } from 'framer-motion';
import { Target } from 'lucide-react';

const About: React.FC = () => {

    return (
        <section id="about" className="py-32 bg-zinc-900 relative overflow-hidden">
            <div className="container mx-auto px-6 relative z-10 max-w-6xl">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="mb-20 flex justify-center"
                >
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-700 text-white font-mono text-xs tracking-widest">
                        <Target size={14} className="text-accent" /> Core Philosophy
                    </div>
                </motion.div>

                <div className="flex flex-col gap-24">

                    {/* Contrast 1 */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="text-center md:text-left border-l-2 border-zinc-800 pl-6 md:pl-10"
                    >
                        <p className="text-xl md:text-3xl font-medium text-zinc-400 mb-6 tracking-tight">
                            Most consultants focus on <span className="text-zinc-400">writing strategy decks.</span>
                        </p>
                        <h2 className="text-4xl md:text-5xl lg:text-6xl font-semibold text-white leading-[1] tracking-tighter">
                            I focus on <br /> <span className="text-accent">Deploying Systems.</span>
                        </h2>
                    </motion.div>

                    {/* Contrast 2 */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="text-center md:text-right border-r-2 border-zinc-800 pr-6 md:pr-10"
                    >
                        <p className="text-xl md:text-3xl font-medium text-zinc-400 mb-6 tracking-tight">
                            Most AI projects fail. <span className="text-zinc-400">Not because of the model.</span>
                        </p>
                        <h2 className="text-4xl md:text-5xl lg:text-6xl font-semibold text-white leading-[1] tracking-tighter">
                            I make you <br /> <span className="text-accent">Agent-Ready.</span>
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
                                className="relative z-10 w-48 h-48 md:w-56 md:h-56 object-cover border border-zinc-700 transition-all duration-500 portrait-editorial"
                            />
                        </picture>
                    </div>

                    {/* Bio */}
                    <div className="flex-1 text-center md:text-left">
                        <h3 className="text-3xl md:text-4xl font-semibold text-white mb-4 tracking-tight">
                            Iván <span className="font-drama italic text-accent">Manfredi</span>
                        </h3>
                        <p className="font-mono text-xs text-accent uppercase tracking-widest mb-4">Agent-Ready Ops™</p>
                        <p className="text-lg text-zinc-400 leading-relaxed max-w-xl">
                            I build AI systems for growing service businesses - agencies, consultancies, law and accounting firms. Every engagement is a productized project or a flat-rate retainer tied to outcomes. Never hourly.
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
                    <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-8 md:p-12 shadow-card-subtle relative group hover-lift transition-all">
                        <div className="absolute top-0 right-0 w-0 h-0 border-l-[40px] border-l-transparent border-t-[40px] border-t-accent"></div>

                        <p className="text-lg md:text-xl text-zinc-400 leading-relaxed">
                            Every project follows one rule: <br /><br />
                            <span className="text-white font-bold bg-zinc-800 px-2 py-1">If it doesn't pay back in 90 days, I don't build it.</span> <br /><br />
                            The 90-Day Payback Rule. No exceptions.
                        </p>
                    </div>
                </motion.div>

            </div>
        </section>
    );
};

export default About;

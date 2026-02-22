import React from 'react';
import { motion } from 'framer-motion';
import { Target } from 'lucide-react';

const About: React.FC = () => {

    return (
        <section id="about" className="py-32 bg-black border-y-4 border-black relative overflow-hidden">
            <div className="container mx-auto px-6 relative z-10 max-w-6xl">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="mb-20 flex justify-center"
                >
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 border-2 border-zinc-700 text-white font-mono text-xs uppercase tracking-widest shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
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
                        className="text-center md:text-left border-l-4 border-zinc-800 pl-6 md:pl-10"
                    >
                        <p className="text-xl md:text-3xl font-bold text-zinc-500 mb-6 tracking-tight">
                            Most consultants focus on <span className="text-zinc-400">writing strategy decks.</span>
                        </p>
                        <h2 className="text-4xl md:text-5xl lg:text-6xl font-black uppercase text-white leading-[1] tracking-tighter">
                            I focus on <br /> <span className="font-drama italic text-accent">Deploying Systems.</span>
                        </h2>
                    </motion.div>

                    {/* Contrast 2 */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="text-center md:text-right border-r-4 border-zinc-800 pr-6 md:pr-10"
                    >
                        <p className="text-xl md:text-3xl font-bold text-zinc-500 mb-6 tracking-tight">
                            Agencies sell <span className="text-zinc-400">retainers for manual labor.</span>
                        </p>
                        <h2 className="text-4xl md:text-5xl lg:text-6xl font-black uppercase text-white leading-[1] tracking-tighter">
                            I build to <br /> <span className="font-drama italic text-accent">Eradicate the labor.</span>
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
                        <div className="absolute inset-0 bg-accent translate-x-3 translate-y-3 border-2 border-black transition-transform group-hover:translate-x-4 group-hover:translate-y-4"></div>
                        <img
                            src="/ivan-portrait.jpg"
                            alt="Iván Manfredi"
                            className="relative z-10 w-48 h-48 md:w-56 md:h-56 object-cover border-4 border-black transition-all duration-500"
                        />
                    </div>

                    {/* Bio */}
                    <div className="flex-1 text-center md:text-left">
                        <h3 className="text-3xl md:text-4xl font-black uppercase text-white mb-4 tracking-tight">
                            Iván <span className="font-drama italic text-accent">Manfredi</span>
                        </h3>
                        <p className="font-mono text-xs text-accent uppercase tracking-widest mb-4">AI & Automation Architect</p>
                        <p className="text-lg text-zinc-400 leading-relaxed max-w-xl">
                            I've architected automation systems for companies across finance, legal, healthcare, and SaaS, eliminating thousands of hours of manual work. I don't sell retainers. I build infrastructure that compounds.
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
                    <div className="bg-zinc-900 border-4 border-zinc-800 p-8 md:p-12 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative group hover-lift transition-all">
                        <div className="absolute top-0 right-0 w-0 h-0 border-l-[40px] border-l-transparent border-t-[40px] border-t-accent"></div>

                        <p className="text-lg md:text-xl font-mono text-zinc-400 leading-relaxed">
                            EVERY AUTOMATION ARCHITECTURE IS BUILT ON A SINGLE RULE: <br /><br />
                            <span className="text-white font-bold bg-zinc-800 px-2 py-1">IF WE CANNOT TIE THE WORKFLOW DIRECTLY TO HOURS SAVED, ERRORS REDUCED, OR REVENUE GAINED, IT DOES NOT GET BUILT.</span> <br /><br />
                            NO HYPE. NO GENERIC CHATBOTS. PURE ROI ENGINEERING.
                        </p>
                    </div>
                </motion.div>

            </div>
        </section>
    );
};

export default About;

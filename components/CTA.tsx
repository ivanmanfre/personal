import React from 'react';
import { motion } from 'framer-motion';

const CTA: React.FC = () => {
    return (
        <section className="py-24 bg-dots relative overflow-hidden border-t-4 border-black">
            <div className="container mx-auto px-6 text-center relative z-10">
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    whileInView={{ scale: 1, opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ type: "spring", duration: 0.8 }}
                    className="bg-white border-4 border-black p-12 shadow-comic max-w-4xl mx-auto"
                >
                    <h2 className="text-4xl md:text-5xl lg:text-6xl font-black uppercase mb-6 leading-[0.9]">
                        Ready To Stop <br /> <span className="font-drama italic">Wasting Your Best Talent?</span>
                    </h2>
                    <p className="text-xl font-bold mb-10 max-w-lg mx-auto">
                        30-minute strategy call. I'll show you exactly where your biggest operational wins are hiding.
                    </p>

                    <a
                        href="https://calendly.com/ivan-intelligents/30min"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-magnetic relative z-20 group inline-flex items-center gap-3 px-12 py-6 bg-black text-white text-xl font-black uppercase border-4 border-black shadow-comic focus:outline-none"
                    >
                        <span className="relative z-10 group-hover:text-black transition-colors duration-300 tracking-wide">Book Strategy Call</span>
                    </a>
                </motion.div>
            </div>
        </section>
    );
};

export default CTA;
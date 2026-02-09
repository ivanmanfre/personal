import React from 'react';
import { motion } from 'framer-motion';

const steps = [
    { id: '01', title: 'Discovery', desc: 'I map your processes and find where time and money are being wasted.' },
    { id: '02', title: 'Blueprint', desc: 'You get a full system architecture before a single line of code is written.' },
    { id: '03', title: 'Build', desc: 'I build, test, and document every workflow end-to-end.' },
    { id: '04', title: 'Launch', desc: 'We deploy, measure results, and optimize for ROI.' },
];

const Process: React.FC = () => {
  return (
    <section className="py-24 bg-accent border-t-4 border-black">
        <div className="container mx-auto px-6">
            <div className="flex flex-col md:flex-row gap-12 items-center">
                {/* Left Title */}
                <motion.div 
                    className="md:w-1/3"
                    initial={{ opacity: 0, x: -50 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                >
                    <h2 className="text-6xl font-black uppercase leading-none mb-6">The <br/> Plan</h2>
                    <p className="text-xl font-bold border-l-4 border-black pl-6">Simple, effective, and ruthless execution.</p>
                </motion.div>

                {/* Right Steps */}
                <div className="md:w-2/3 w-full space-y-6">
                    {steps.map((step, i) => (
                        <motion.div 
                            key={step.id} 
                            initial={{ opacity: 0, x: 50 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.15, type: "spring" }}
                            className="flex items-stretch bg-white border-2 border-black shadow-comic hover:translate-x-2 transition-transform"
                        >
                            <div className="bg-black text-white font-black text-3xl p-6 flex items-center justify-center w-24 shrink-0">
                                {step.id}
                            </div>
                            <div className="p-6 flex flex-col justify-center">
                                <h3 className="text-2xl font-black uppercase">{step.title}</h3>
                                <p className="font-medium">{step.desc}</p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>
    </section>
  );
};

export default Process;
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Calculator, DollarSign, Clock, ArrowRight } from 'lucide-react';

const ROI: React.FC = () => {
    const [hoursPerWeek, setHoursPerWeek] = useState(20);
    const [hourlyRate, setHourlyRate] = useState(150);

    const calculateYearlyCost = () => hoursPerWeek * hourlyRate * 52;
    const calculateFiveYearCost = () => calculateYearlyCost() * 5;
    const automationInvestment = 5000; // Example base cost
    const calculateROI = () => ((calculateYearlyCost() - automationInvestment) / automationInvestment) * 100;

    return (
        <section className="py-24 bg-paper border-b border-zinc-200 relative overflow-hidden" id="roi-calculator">
            <div className="absolute inset-0 bg-grid-pattern opacity-50 z-0"></div>
            <div className="container mx-auto px-6 max-w-5xl relative z-10">

                <div className="text-center mb-16">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white font-mono text-sm uppercase mb-6 border-subtle shadow-md"
                    >
                        <Calculator size={16} /> ROI Engine
                    </motion.div>
                    <h2 className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tighter mb-6">
                        What Manual Work <span className="text-zinc-400 inline-block">Really Costs</span>
                    </h2>
                    <p className="text-xl md:text-2xl font-medium max-w-3xl mx-auto text-zinc-700">
                        See exactly how much manual tasks cost your business every year.
                    </p>
                </div>

                <div className="flex flex-col lg:flex-row gap-12 items-start">

                    {/* Controls */}
                    <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        className="w-full lg:w-1/2 border-subtle-thick bg-white p-8 shadow-card"
                    >
                        <div className="mb-10">
                            <label className="flex items-center justify-between mb-4 font-medium uppercase text-xl">
                                <span className="flex items-center gap-2"><Clock className="text-accent" /> Hours lost per week</span>
                                <span className="font-mono text-2xl text-accent bg-black px-3 py-1 border-subtle shadow-card-sm">{hoursPerWeek}</span>
                            </label>
                            <input
                                type="range"
                                min="5"
                                max="100"
                                step="5"
                                value={hoursPerWeek}
                                onChange={(e) => setHoursPerWeek(Number(e.target.value))}
                                className="w-full h-3 bg-zinc-200 rounded-none appearance-none cursor-pointer border border-zinc-300"
                            />
                            <div className="flex justify-between text-xs font-mono font-medium text-zinc-400 mt-2 uppercase">
                                <span>5 hrs</span>
                                <span>100 hrs</span>
                            </div>
                        </div>

                        <div className="mb-8">
                            <label className="flex items-center justify-between mb-4 font-medium uppercase text-xl">
                                <span className="flex items-center gap-2"><DollarSign className="text-accent" /> Blended Hourly Value</span>
                                <span className="font-mono text-2xl text-accent bg-black px-3 py-1 border-subtle shadow-card-sm">${hourlyRate}</span>
                            </label>
                            <input
                                type="range"
                                min="50"
                                max="500"
                                step="25"
                                value={hourlyRate}
                                onChange={(e) => setHourlyRate(Number(e.target.value))}
                                className="w-full h-3 bg-zinc-200 rounded-none appearance-none cursor-pointer border border-zinc-300"
                            />
                            <div className="flex justify-between text-xs font-mono font-medium text-zinc-400 mt-2 uppercase">
                                <span>$50/hr</span>
                                <span>$500/hr</span>
                            </div>
                        </div>

                        <p className="text-sm font-medium text-zinc-500 italic">
                            *Blended value = the average hourly revenue target of the team members doing the manual work.
                        </p>
                    </motion.div>

                    {/* Results Display */}
                    <motion.div
                        initial={{ opacity: 0, x: 30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        className="w-full lg:w-1/2 flex flex-col gap-6"
                    >
                        <div className="border-subtle-thick bg-black text-white p-8 shadow-card relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-accent opacity-10 rounded-full blur-3xl"></div>
                            <h3 className="font-medium text-zinc-400 uppercase tracking-widest text-sm mb-2">Yearly Cost of Manual Work</h3>
                            <div className="text-5xl sm:text-6xl md:text-7xl font-bold font-mono tracking-tighter text-white">
                                ${calculateYearlyCost().toLocaleString()}
                            </div>
                            <p className="font-medium text-zinc-500 mt-4 leading-relaxed">
                                If you change nothing, this is the cash value of the time your team burns on repetitive tasks over the next 12 months.
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="border-subtle bg-white p-6 shadow-card-sm">
                                <h3 className="font-medium text-zinc-500 uppercase tracking-widest text-xs mb-2">5-Year Cost</h3>
                                <div className="text-3xl font-bold font-mono text-zinc-800">
                                    ${(calculateFiveYearCost() / 1000).toFixed(0)}k
                                </div>
                            </div>
                            <div className="border-subtle bg-accent p-6 shadow-card-sm">
                                <h3 className="font-medium text-black uppercase tracking-widest text-xs mb-2">Yr 1 Automation ROI</h3>
                                <div className="text-3xl font-bold font-mono text-black">
                                    +{calculateROI().toLocaleString(undefined, { maximumFractionDigits: 0 })}%
                                </div>
                            </div>
                        </div>

                        <a
                            href="https://calendly.com/ivan-intelligents/30min"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full mt-2 px-8 py-5 bg-accent border-subtle-thick shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all active:shadow-sm active:translate-y-1 flex items-center justify-center gap-3 font-bold text-xl tracking-wide text-black"
                        >
                            See What You'd Save <ArrowRight size={24} />
                        </a>

                    </motion.div>

                </div>
            </div>
        </section>
    );
};

export default ROI;

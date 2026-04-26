import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

const ROI: React.FC = () => {
    const [hoursPerWeek, setHoursPerWeek] = useState(20);
    const [hourlyRate, setHourlyRate] = useState(150);

    const calculateYearlyCost = () => hoursPerWeek * hourlyRate * 52;
    const calculateFiveYearCost = () => calculateYearlyCost() * 5;
    const typicalBuildPrice = 10000;
    const calculatePaybackDays = () => {
        const dailyCost = calculateYearlyCost() / 365;
        if (dailyCost === 0) return 999;
        return Math.round(typicalBuildPrice / dailyCost);
    };

    return (
        <section className="py-32 bg-paper border-b border-[color:var(--color-hairline)] relative overflow-hidden" id="roi-calculator">
            <div className="container mx-auto px-6 max-w-5xl relative z-10">

                <div className="mb-16 flex justify-center">
                    <motion.span
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="inline-block text-xs uppercase tracking-[0.1em] font-medium text-ink-soft border border-[color:var(--color-hairline-bold)] rounded px-2 py-1"
                    >
                        90-Day Payback Check
                    </motion.span>
                </div>

                <div className="text-center mb-16">
                    <h2 className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight mb-6">
                        The <span className="font-drama italic">90-Day Payback</span> Rule
                    </h2>
                    <p className="text-xl md:text-2xl font-medium max-w-3xl mx-auto text-ink-soft leading-relaxed">
                        If I can't recoup the project in 90 days, I don't build it. Here's what your number looks like.
                    </p>
                </div>

                <div className="flex flex-col lg:flex-row gap-8 items-start">

                    {/* Controls */}
                    <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        className="w-full lg:w-1/2 bg-paper border border-[color:var(--color-hairline)] p-8 shadow-card-subtle"
                    >
                        <div className="mb-10">
                            <label className="flex items-center justify-between mb-4">
                                <span className="font-mono text-xs uppercase tracking-[0.1em] text-ink-soft">Hours lost per week</span>
                                <span className="stat-numeral font-mono text-2xl text-black border border-[color:var(--color-hairline-bold)] bg-paper-sunk px-3 py-1">{hoursPerWeek}</span>
                            </label>
                            <input
                                type="range"
                                min="5"
                                max="100"
                                step="5"
                                value={hoursPerWeek}
                                onChange={(e) => setHoursPerWeek(Number(e.target.value))}
                                className="stat-slider"
                                aria-label="Hours lost per week"
                            />
                            <div className="flex justify-between text-xs font-mono text-ink-mute mt-2 uppercase tracking-[0.1em]">
                                <span>5 hrs</span>
                                <span>100 hrs</span>
                            </div>
                        </div>

                        <div className="mb-8">
                            <label className="flex items-center justify-between mb-4">
                                <span className="font-mono text-xs uppercase tracking-[0.1em] text-ink-soft">Blended hourly value</span>
                                <span className="stat-numeral font-mono text-2xl text-black border border-[color:var(--color-hairline-bold)] bg-paper-sunk px-3 py-1">${hourlyRate}</span>
                            </label>
                            <input
                                type="range"
                                min="50"
                                max="500"
                                step="25"
                                value={hourlyRate}
                                onChange={(e) => setHourlyRate(Number(e.target.value))}
                                className="stat-slider"
                                aria-label="Blended hourly value in dollars"
                            />
                            <div className="flex justify-between text-xs font-mono text-ink-mute mt-2 uppercase tracking-[0.1em]">
                                <span>$50/hr</span>
                                <span>$500/hr</span>
                            </div>
                        </div>

                        <p className="text-sm text-ink-mute leading-relaxed">
                            Blended value = the average hourly revenue target of the team members doing the manual work.
                        </p>
                    </motion.div>

                    {/* Results Display */}
                    <motion.div
                        initial={{ opacity: 0, x: 30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        className="w-full lg:w-1/2 flex flex-col gap-6"
                    >
                        <div className="bg-paper border border-[color:var(--color-hairline-bold)] p-8 shadow-card-subtle">
                            <h3 className="font-mono text-xs uppercase tracking-[0.1em] text-ink-soft mb-3">Annual cost of this bottleneck</h3>
                            <div className="stat-numeral text-5xl sm:text-6xl md:text-7xl font-semibold font-mono text-black mb-4">
                                ${calculateYearlyCost().toLocaleString()}
                            </div>
                            <p className="text-ink-soft leading-relaxed">
                                This is the cash your team burns on repeat work over 12 months if nothing changes.
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-paper-sunk border border-[color:var(--color-hairline)] p-6">
                                <h3 className="font-mono text-xs uppercase tracking-[0.1em] text-ink-mute mb-3">5-Year drag</h3>
                                <div className="stat-numeral text-3xl font-semibold font-mono text-black">
                                    ${(calculateFiveYearCost() / 1000).toFixed(0)}k
                                </div>
                            </div>
                            <div className="bg-paper-sunk border border-[color:var(--color-hairline)] p-6">
                                <h3 className="font-mono text-xs uppercase tracking-[0.1em] text-ink-mute mb-3">Payback at $10k build</h3>
                                <div className="stat-numeral text-3xl font-semibold font-mono text-accent-ink">
                                    ~{calculatePaybackDays()} days
                                </div>
                            </div>
                        </div>

                        <a
                            href="/assessment"
                            className="w-full mt-2 px-6 py-4 bg-accent text-white font-semibold tracking-wide flex items-center justify-center gap-3 hover:bg-accent-ink hover:text-white transition-colors"
                        >
                            See if you're Agent-Ready <ArrowRight aria-hidden="true" size={18} />
                        </a>
                        <p className="text-sm text-ink-mute text-center">
                            Not ready to talk? <a href="/#newsletter" className="underline hover:text-black">Get The Agent-Ready Letter</a>.
                        </p>

                    </motion.div>

                </div>
            </div>
        </section>
    );
};

export default ROI;

import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { motion } from 'framer-motion';

const cases = [
  {
    id: "01",
    client: "ProvalTech",
    title: "AI Call Performance",
    metric: "100% Audit Rate",
    desc: "Automated QA & performance scoring for every sales call.",
    color: "bg-accent"
  },
  {
    id: "02",
    client: "ProSWPPP",
    title: "Auto-Invoice & Docs",
    metric: "800 Hrs/Yr Saved",
    desc: "Automated invoicing and regulatory document generation.",
    color: "bg-pink-400"
  },
  {
    id: "03",
    client: "MediaScale",
    title: "Content AI",
    metric: "20x Output",
    desc: "1 Video -> 20 Tweets + Blog.",
    color: "bg-green-400"
  }
];

const CaseStudies: React.FC = () => {
  const upworkUrl = "https://www.upwork.com/freelancers/~01ce6d9c9060674d84";

  return (
    <section id="cases" className="py-24 bg-white border-t-4 border-black">
      <div className="container mx-auto px-6">
        <motion.h2 
            initial={{ y: 50, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            className="text-6xl md:text-8xl font-black mb-16 uppercase text-center text-outline"
        >
            Case Studies
        </motion.h2>
        
        <div className="flex flex-col lg:flex-row gap-8">
            {cases.map((study, i) => (
                <motion.a 
                    href={upworkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    key={i} 
                    initial={{ opacity: 0, y: 50 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.2, type: "spring", bounce: 0.4 }}
                    className="flex-1 border-4 border-black shadow-comic hover:shadow-comic-hover transition-all bg-white group hover:-translate-y-2 block cursor-pointer"
                >
                    {/* Image Area */}
                    <div className={`h-48 ${study.color} border-b-4 border-black flex items-center justify-center relative overflow-hidden`}>
                        <div className="absolute inset-0 bg-dots opacity-20" />
                        <span className="text-9xl font-black opacity-20 text-black absolute -bottom-10 -right-10 select-none transition-transform group-hover:scale-110">{study.id}</span>
                        <div className="relative z-10 font-black text-4xl bg-white border-2 border-black px-4 py-2 shadow-comic transform -rotate-3 group-hover:rotate-0 transition-transform text-center">
                            {study.metric}
                        </div>
                    </div>
                    
                    {/* Content */}
                    <div className="p-8">
                        <div className="flex justify-between items-start mb-4">
                            <span className="font-bold uppercase text-xs tracking-widest bg-black text-white px-2 py-1">{study.client}</span>
                            <ArrowUpRight size={28} className="border-2 border-black rounded-full p-1 group-hover:bg-black group-hover:text-white transition-colors" />
                        </div>
                        <h3 className="text-3xl font-black uppercase mb-2">{study.title}</h3>
                        <p className="text-lg font-medium border-l-4 border-black pl-4">{study.desc}</p>
                    </div>
                </motion.a>
            ))}
        </div>
      </div>
    </section>
  );
};

export default CaseStudies;
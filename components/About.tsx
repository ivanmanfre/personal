import React, { useState } from 'react';
import { motion } from 'framer-motion';

const About: React.FC = () => {
  // Using Google Drive thumbnail URL for reliable embedding
  // ID: 1YYjN5YoqKIfFvP64qRBsQokYnypG2Gwo
  const [imgSrc, setImgSrc] = useState('https://drive.google.com/thumbnail?id=1YYjN5YoqKIfFvP64qRBsQokYnypG2Gwo&sz=w1000');

  return (
    <section id="about" className="py-24 bg-white border-t-4 border-black">
      <div className="container mx-auto px-6">
        <div className="border-4 border-black shadow-comic bg-white p-8 md:p-12 flex flex-col lg:flex-row gap-12">
            
            {/* Profile Image (Halftone Style) */}
            <motion.div 
                initial={{ opacity: 0, scale: 0.9, rotate: -5 }}
                whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="lg:w-1/4 relative max-w-xs"
            >
                <div className="aspect-[4/5] bg-black border-2 border-black relative z-10 overflow-hidden group">
                    <img 
                        src={imgSrc}
                        onError={(e) => {
                            // Fallback to professional placeholder if drive link fails
                            e.currentTarget.src = "https://images.unsplash.com/photo-1560250097-0b93528c311a?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=800&q=80"
                        }}
                        alt="Iván Manfredi" 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                    />
                    {/* Halftone Overlay */}
                    <div className="absolute inset-0 bg-dots opacity-30 mix-blend-overlay pointer-events-none" />
                </div>
                {/* Offset Decor */}
                <div className="absolute top-4 left-4 w-full h-full bg-cyan-400 border-2 border-black -z-0" />
            </motion.div>

            {/* Text Content */}
            <motion.div 
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="lg:w-2/3 flex flex-col justify-center"
            >
                <div className="inline-block bg-pink border-2 border-black px-4 py-1 text-white font-bold uppercase tracking-widest w-fit mb-4 shadow-comic transform -rotate-1">
                    Why Partner With Me
                </div>
                <h2 className="text-4xl md:text-6xl font-black uppercase mb-6 leading-none">
                    Strategy First. <br/> Tools Second.
                </h2>
                <p className="text-xl md:text-2xl font-bold leading-relaxed mb-8 border-l-4 border-accent pl-6">
                    "If we can't tie the automation to ROI, I won't build it."
                </p>
                <div className="space-y-6 text-lg font-medium">
                    <p>
                        My approach is not for everyone. I don't start with "What do you want to build?" 
                        I start with: <span className="bg-yellow-200 px-1 border border-black">"Where is the single biggest bottleneck capping your revenue right now?"</span>
                    </p>
                    
                    <ul className="space-y-4 mt-4">
                        <li className="flex items-start gap-3">
                            <div className="w-6 h-6 bg-black text-white flex items-center justify-center font-bold text-sm shrink-0 border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">1</div>
                            <div>
                                <strong className="uppercase block text-sm tracking-wide mb-1">Architect, Not Just A Builder</strong>
                                You receive a full system blueprint, clear documentation, and a solution built to scale, not just a quick fix that breaks in a month.
                            </div>
                        </li>
                        <li className="flex items-start gap-3">
                            <div className="w-6 h-6 bg-black text-white flex items-center justify-center font-bold text-sm shrink-0 border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">2</div>
                            <div>
                                <strong className="uppercase block text-sm tracking-wide mb-1">Long-Term Vision</strong>
                                Nearly every partnership starts with "fix this one process" and evolves into "here's how we build an operation that can't be beaten."
                            </div>
                        </li>
                        <li className="flex items-start gap-3">
                            <div className="w-6 h-6 bg-black text-white flex items-center justify-center font-bold text-sm shrink-0 border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">3</div>
                            <div>
                                <strong className="uppercase block text-sm tracking-wide mb-1">Focus on Outcome</strong>
                                We build what will have the highest impact on your bottom line.
                            </div>
                        </li>
                    </ul>
                </div>
            </motion.div>

        </div>
      </div>
    </section>
  );
};

export default About;
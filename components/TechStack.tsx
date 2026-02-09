import React from 'react';
import { Sparkles, Workflow } from 'lucide-react';
import { motion, Variants } from 'framer-motion';

const TechStack: React.FC = () => {
  const tools = [
    { name: "n8n", slug: "n8n", bg: "bg-red-200" },
    { name: "Make", slug: "make", bg: "bg-purple-200" },
    { name: "Zapier", slug: "zapier", bg: "bg-orange-200" },
    { name: "OpenAI", src: "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/openai.svg", bg: "bg-green-200" },
    { name: "Claude", slug: "anthropic", bg: "bg-yellow-100" },
    { name: "Gemini", slug: "googlegemini", bg: "bg-blue-100" },
    { name: "LangChain", slug: "langchain", bg: "bg-white" },
    { name: "Flowise", isLucide: true, icon: Workflow, bg: "bg-pink-100" },
    { name: "HubSpot", slug: "hubspot", bg: "bg-orange-200" },
    { name: "Salesforce", src: "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/salesforce.svg", bg: "bg-blue-200" },
    { name: "Twilio", src: "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/twilio.svg", bg: "bg-red-200" },
    { name: "Airtable", slug: "airtable", bg: "bg-blue-200" },
    { name: "Notion", slug: "notion", bg: "bg-white" },
    { name: "Slack", src: "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/slack.svg", bg: "bg-white" },
    { name: "Python", slug: "python", bg: "bg-yellow-200" },
  ];

  const container: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  };

  const item: Variants = {
    hidden: { scale: 0, opacity: 0 },
    show: { scale: 1, opacity: 1, transition: { type: "spring", stiffness: 200 } }
  };

  return (
    <section className="py-24 bg-cyan-400 border-t-4 border-black">
      <div className="container mx-auto px-6">
         <div className="text-center mb-12">
            <motion.div 
                initial={{ y: -20, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ once: true }}
                className="inline-flex items-center justify-center gap-2 bg-white border-2 border-black px-6 py-2 shadow-comic mb-6 transform rotate-2"
            >
              <Sparkles size={20} className="text-black" />
              <span className="font-bold uppercase">Platform Agnostic Architecture</span>
            </motion.div>
            <motion.h2 
                initial={{ scale: 0.9, opacity: 0 }}
                whileInView={{ scale: 1, opacity: 1 }}
                viewport={{ once: true }}
                className="text-5xl md:text-7xl font-black text-white text-outline uppercase"
            >
                I Use What Works
            </motion.h2>
            <p className="text-white font-bold text-xl mt-4 max-w-2xl mx-auto">
                I don't use tools because they are trendy; I use them because they work.
            </p>
         </div>

         <motion.div 
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-50px" }}
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
         >
            {tools.map((tool: any) => (
                <motion.div 
                    key={tool.name} 
                    variants={item}
                    className={`${tool.bg} aspect-square border-2 border-black shadow-comic flex flex-col items-center justify-center p-4 hover:-translate-y-1 hover:shadow-comic-hover transition-all`}
                >
                    {tool.isLucide ? (
                        <tool.icon size={40} className="mb-3 text-black" />
                    ) : (
                        <img
                            src={tool.src || `https://cdn.simpleicons.org/${tool.slug}/000000`}
                            alt={tool.name}
                            className="w-10 h-10 mb-3"
                            style={tool.src ? { filter: 'brightness(0)' } : undefined}
                        />
                    )}
                    <span className="font-bold text-xs uppercase tracking-wider">{tool.name}</span>
                </motion.div>
            ))}
         </motion.div>
      </div>
    </section>
  );
};

export default TechStack;
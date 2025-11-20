import React from 'react';
import { Bot, Zap, Database, Share2, BarChart3, Workflow } from 'lucide-react';
import { motion, Variants } from 'framer-motion';

const services = [
  {
    title: "Strategic Automation",
    description: "Eradicate manual work and eliminate human error. I create a 'Single Source of Truth' for your data.",
    icon: Workflow,
    color: "bg-accent",
    tags: ["Workflow Design", "Multi-app Orchestration"]
  },
  {
    title: "AI Agents & Clones",
    description: "Automate complex decision-making. Clone your best sales rep or support agent.",
    icon: Bot,
    color: "bg-cyan-400",
    tags: ["Lead Qualification", "Support Bots"]
  },
  {
    title: "Operational Scale",
    description: "Build a business that can 3x its revenue without 3x the headcount.",
    icon: BarChart3,
    color: "bg-pink-400",
    tags: ["Audit", "Infrastructure"]
  },
  {
    title: "RAG & LLM Integration",
    description: "Systems that 'know' your business. Intelligent doc processing powered by OpenAI & Claude.",
    icon: Database,
    color: "bg-green-400",
    tags: ["Vector DB", "Semantic Search"]
  },
  {
    title: "CRM Architecture",
    description: "Deep cleanups for HubSpot, Salesforce & Pipedrive. End-to-end data hygiene.",
    icon: Share2,
    color: "bg-orange-400",
    tags: ["Data Cleaning", "Migration"]
  },
  {
    title: "Reporting Dashboards",
    description: "Real-time pulse on your business. Stop flying blind and start making data-driven decisions.",
    icon: Zap,
    color: "bg-purple-400",
    tags: ["Analytics", "KPI Tracking"]
  }
];

const container: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const item: Variants = {
  hidden: { opacity: 0, y: 50, rotate: 2 },
  show: { opacity: 1, y: 0, rotate: 0, transition: { type: "spring", bounce: 0.4 } }
};

const Services: React.FC = () => {
  return (
    <section id="services" className="py-24 border-t-4 border-black bg-white">
      <div className="container mx-auto px-6">
        <motion.div 
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="mb-16 flex flex-col md:flex-row items-end gap-6 justify-between border-b-4 border-black pb-8"
        >
            <div>
                <h2 className="text-xl font-bold bg-black text-white inline-block px-3 py-1 mb-2 uppercase transform -rotate-1 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]">Core Services</h2>
                <h3 className="text-5xl md:text-6xl font-black uppercase leading-none">My Core Services</h3>
            </div>
            <p className="text-xl font-medium max-w-md text-right">
                I architect solutions to turn your operations into an unfair competitive advantage.
            </p>
        </motion.div>

        <motion.div 
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-100px" }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
        >
          {services.map((service, index) => (
            <motion.div
              key={index}
              variants={item}
              className="bg-white border-2 border-black p-8 shadow-comic hover:shadow-comic-hover transition-all hover:-translate-y-2 group relative overflow-hidden flex flex-col"
            >
              {/* Decorative Corner */}
              <div className="absolute top-0 right-0 w-0 h-0 border-l-[50px] border-l-transparent border-t-[50px] border-t-black group-hover:scale-110 transition-transform" />

              <div className={`w-16 h-16 ${service.color} border-2 border-black flex items-center justify-center mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]`}>
                <service.icon className="text-black" size={32} strokeWidth={2.5} />
              </div>
              
              <h4 className="text-2xl font-black mb-3 uppercase">{service.title}</h4>
              <p className="text-lg font-medium leading-relaxed mb-6 flex-grow">{service.description}</p>

              <div className="flex gap-2 flex-wrap">
                {service.tags.map(tag => (
                    <span key={tag} className="text-xs font-bold uppercase border border-black px-2 py-1 bg-gray-100">
                        {tag}
                    </span>
                ))}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default Services;
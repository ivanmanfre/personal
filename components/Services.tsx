import React from 'react';
import { Bot, Zap, Database, Share2, BarChart3, Workflow } from 'lucide-react';
import { motion, Variants } from 'framer-motion';

const services = [
  {
    title: "Workflow Automation",
    description: "Your team spends hours on tasks a machine should handle. I connect your tools, eliminate manual handoffs, and give you a single source of truth.",
    icon: Workflow,
    color: "bg-accent",
    tags: ["n8n / Make / Zapier", "Multi-App Orchestration"]
  },
  {
    title: "AI Agents",
    description: "AI that qualifies your leads, answers support tickets, and processes documents 24/7, trained on your data and your playbook.",
    icon: Bot,
    color: "bg-cyan-400",
    tags: ["Lead Qualification", "Support Automation"]
  },
  {
    title: "Operations Audit",
    description: "Before building anything, I map every process in your business and find exactly where time and money are leaking.",
    icon: BarChart3,
    color: "bg-pink-400",
    tags: ["Process Mapping", "ROI Analysis"]
  },
  {
    title: "AI Knowledge Systems",
    description: "Internal tools that actually know your business. Ask questions in plain english and get answers from your own docs, SOPs, and data.",
    icon: Database,
    color: "bg-green-400",
    tags: ["RAG / Vector Search", "Document Processing"]
  },
  {
    title: "CRM Architecture",
    description: "Your CRM should drive revenue, not slow you down. I restructure, clean, and automate HubSpot, Salesforce, and more.",
    icon: Share2,
    color: "bg-orange-400",
    tags: ["Data Hygiene", "Pipeline Automation"]
  },
  {
    title: "Reporting & Dashboards",
    description: "Real-time visibility into the metrics that matter. No more spreadsheets, no more waiting for someone to pull the numbers.",
    icon: Zap,
    color: "bg-purple-400",
    tags: ["Live Analytics", "KPI Tracking"]
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
                <h2 className="text-xl font-bold bg-black text-white inline-block px-3 py-1 mb-2 uppercase transform -rotate-1 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]">What I Build</h2>
                <h3 className="text-5xl md:text-6xl font-black uppercase leading-none">Systems That Work While You Sleep</h3>
            </div>
            <p className="text-xl font-medium max-w-md text-right">
                Every system I build pays for itself. If it doesn't drive ROI, I won't build it.
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
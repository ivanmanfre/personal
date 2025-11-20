import React from 'react';
import { motion } from 'framer-motion';
import { AudioWaveform } from 'lucide-react';

const SocialProof: React.FC = () => {
  const tools = [
    { name: "n8n", slug: "n8n" },
    { name: "Twilio", slug: "twilio" },
    { name: "Retell AI", isLucide: true, icon: AudioWaveform },
    { name: "Stripe", slug: "stripe" },
    { name: "Shopify", slug: "shopify" },
    { name: "HubSpot", slug: "hubspot" },
    { name: "OpenAI", slug: "openai" },
    { name: "Zapier", slug: "zapier" },
    { name: "Slack", slug: "slack" },
    { name: "Notion", slug: "notion" },
    { name: "Make", slug: "make" },
    { name: "Airtable", slug: "airtable" },
    { name: "Salesforce", slug: "salesforce" },
  ];

  // Quadruple the list to ensure smooth infinite scrolling on large screens
  const marquee = [...tools, ...tools, ...tools, ...tools];

  return (
    <section className="border-y-4 border-black bg-accent overflow-hidden py-12 relative z-20">
        <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-accent to-transparent z-10" />
        <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-accent to-transparent z-10" />
        
        <motion.div 
            className="flex gap-20 items-center w-max"
            animate={{ x: "-50%" }}
            transition={{ 
                duration: 80,
                repeat: Infinity, 
                ease: "linear" 
            }}
        >
            {marquee.map((tool: any, i) => (
                <div key={i} className="flex items-center justify-center grayscale opacity-100 hover:scale-110 transition-transform duration-300">
                     {tool.isLucide && tool.icon ? (
                         <div className="flex items-center gap-2 text-black">
                            <tool.icon size={48} strokeWidth={1.5} />
                            <span className="font-black text-xl uppercase tracking-tighter leading-none">{tool.name}</span>
                         </div>
                    ) : (
                     <img 
                        src={`https://cdn.simpleicons.org/${tool.slug}/000000`} 
                        alt={tool.name}
                        className="h-10 md:h-12 w-auto object-contain"
                    />
                    )}
                </div>
            ))}
        </motion.div>
    </section>
  );
};

export default SocialProof;
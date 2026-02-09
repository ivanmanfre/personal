import React from 'react';
import { Linkedin, Mail } from 'lucide-react';

const Footer: React.FC = () => {
  const socials = [
    { icon: Linkedin, href: 'https://www.linkedin.com/in/iv%C3%A1n-manfredi-120841202/' },
    { icon: Mail, href: 'mailto:ivan@intelligents.agency' },
  ];

  return (
    <footer className="bg-black text-white border-t-4 border-black pt-16 pb-8">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-center mb-12 gap-8">
            
            <div className="text-center md:text-left">
                <h2 className="text-3xl font-black uppercase mb-2">Iván Manfredi</h2>
                <p className="font-medium text-gray-400">AI & Automation Architect</p>
            </div>

            <div className="flex gap-4">
                {socials.map((social, i) => (
                    <a 
                        key={i} 
                        href={social.href} 
                        target={social.href.startsWith('http') ? "_blank" : undefined}
                        rel={social.href.startsWith('http') ? "noopener noreferrer" : undefined}
                        className="w-12 h-12 border-2 border-white flex items-center justify-center hover:bg-white hover:text-black transition-colors"
                    >
                        <social.icon size={20} />
                    </a>
                ))}
            </div>
        </div>

        <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center text-sm text-gray-500 font-medium uppercase tracking-wide">
            <p>&copy; 2026 All Rights Reserved.</p>
            <div className="flex gap-6 mt-4 md:mt-0">
                <a href="mailto:ivan@intelligents.agency" className="hover:text-white">Contact</a>
            </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
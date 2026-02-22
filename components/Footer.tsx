import React from 'react';
import { Link } from 'react-router-dom';
import { Linkedin, Mail } from 'lucide-react';

const Footer: React.FC = () => {
  const socials = [
    { icon: Linkedin, href: 'https://www.linkedin.com/in/iv%C3%A1n-manfredi-120841202/' },
    { icon: Mail, href: 'mailto:ivan@intelligents.agency' },
  ];

  return (
    <footer className="bg-black text-white border-t-8 border-black pt-16 pb-8 relative z-10">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-center mb-12 gap-8">

          <div className="text-center md:text-left">
            <h2 className="text-4xl font-black uppercase mb-2 tracking-tight">Iván Manfredi</h2>
            <p className="font-bold text-gray-400">AI & Automation Architect</p>
          </div>

          <div className="flex gap-4">
            {socials.map((social, i) => (
              <a
                key={i}
                href={social.href}
                target={social.href.startsWith('http') ? "_blank" : undefined}
                rel={social.href.startsWith('http') ? "noopener noreferrer" : undefined}
                className="w-14 h-14 border-4 border-white flex items-center justify-center hover:bg-white hover:text-black hover:-translate-y-1 transition-all active:translate-y-0"
              >
                <social.icon size={24} strokeWidth={2.5} />
              </a>
            ))}
          </div>
        </div>

        <div className="border-t-4 border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-6 text-sm text-gray-400 font-bold uppercase tracking-widest">
          <p>&copy; {new Date().getFullYear()} All Rights Reserved.</p>

          <div className="flex gap-8">
            <Link to="/store" className="hover:text-white transition-colors">Store</Link>
            <a href="mailto:ivan@intelligents.agency" className="hover:text-white transition-colors">Contact</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

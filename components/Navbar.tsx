import React, { useState } from 'react';
import { Menu, X, Square } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Navbar: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navLinks = [
    { name: 'Services', href: '#services' },
    { name: 'Work', href: '#cases' },
    { name: 'About', href: '#about' },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b-4 border-black py-4">
      <div className="container mx-auto px-6 flex justify-between items-center">
        
        {/* Logo */}
        <a href="#" className="flex items-center gap-2 group">
          <div className="bg-black text-white p-1">
            <Square size={24} fill="white" />
          </div>
          <span className="text-2xl font-bold tracking-tighter uppercase group-hover:text-cyan-600 transition-colors">
            Iván <span className="text-cyan-600">Manfredi</span>
          </span>
        </a>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              className="text-lg font-bold hover:underline decoration-4 decoration-accent underline-offset-4 transition-all"
            >
              {link.name}
            </a>
          ))}
          <a 
            href="https://calendly.com/ivan-intelligents/30min" 
            target="_blank" 
            rel="noopener noreferrer"
            className="px-6 py-2 bg-accent border-2 border-black shadow-comic font-bold uppercase hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-comic-active transition-all active:translate-x-[4px] active:translate-y-[4px] active:shadow-none flex items-center"
          >
            Let's Talk
          </a>
        </div>

        {/* Mobile Toggle */}
        <button
          className="md:hidden p-2 border-2 border-black shadow-comic active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden bg-accent border-b-4 border-black overflow-hidden"
          >
            <div className="flex flex-col p-6 gap-4">
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-2xl font-bold border-b-2 border-black pb-2 hover:pl-4 transition-all"
                >
                  {link.name}
                </a>
              ))}
              <a 
                href="https://calendly.com/ivan-intelligents/30min"
                target="_blank"
                rel="noopener noreferrer" 
                className="mt-4 w-full py-4 bg-black text-white font-bold text-xl uppercase border-2 border-black hover:bg-white hover:text-black transition-colors text-center block"
              >
                Book Strategy Call
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
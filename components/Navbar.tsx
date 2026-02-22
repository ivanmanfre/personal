import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Navbar: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const isHome = location.pathname === '/';

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const homeLinks = [
    { name: 'Services', href: '#services' },
    { name: 'Work', href: '#cases' },
    { name: 'About', href: '#about' },
  ];

  return (
    <nav className={`fixed z-50 transition-all duration-500 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] ${scrolled
        ? 'top-2 left-2 right-2 md:top-6 md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-5xl py-3 bg-paper/90 backdrop-blur-md border-2 border-zinc-900 shadow-[6px_6px_0px_0px_#18181B]'
        : 'top-0 left-0 right-0 py-6 bg-transparent border-transparent'
      }`}>
      <div className="container mx-auto px-6 flex justify-between items-center">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 group">
          <div className="relative w-12 h-12 bg-black comic-border shadow-comic group-hover:shadow-comic-hover transition-all flex items-center justify-center overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-accent/20 to-cyan/20"></div>
            <span className="relative text-white font-black text-xl tracking-tighter">IM</span>
          </div>
          <span className="text-sm font-black tracking-widest uppercase text-gray-800 group-hover:text-black transition-colors">
            Iván Manfredi
          </span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-8">
          {homeLinks.map((link) =>
            isHome ? (
              <a
                key={link.name}
                href={link.href}
                className="text-lg font-bold hover:underline decoration-4 decoration-accent underline-offset-4 transition-all"
              >
                {link.name}
              </a>
            ) : (
              <Link
                key={link.name}
                to={`/${link.href}`}
                className="text-lg font-bold hover:underline decoration-4 decoration-accent underline-offset-4 transition-all"
              >
                {link.name}
              </Link>
            )
          )}

          {/* Store link */}
          <Link
            to="/store"
            className={`text-lg font-bold hover:underline decoration-4 decoration-accent underline-offset-4 transition-all ${location.pathname.startsWith('/store') ? 'underline' : ''
              }`}
          >
            Store
          </Link>

          <a
            href="https://calendly.com/ivan-intelligents/30min"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 bg-accent comic-border shadow-comic font-black uppercase tracking-wide hover:-translate-y-1 hover:shadow-comic-hover transition-all active:translate-y-0 active:shadow-comic-active flex items-center"
          >
            Let's Talk
          </a>
        </div>

        {/* Mobile Toggle */}
        <button
          className="md:hidden p-2 comic-border shadow-comic active:shadow-none bg-white active:translate-y-1 transition-all"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X size={28} strokeWidth={3} /> : <Menu size={28} strokeWidth={3} />}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden bg-accent comic-border-thick border-l-0 border-r-0 border-b-0 mt-4 overflow-hidden"
          >
            <div className="flex flex-col p-6 gap-4">
              {homeLinks.map((link) =>
                isHome ? (
                  <a
                    key={link.name}
                    href={link.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="text-3xl font-black comic-border border-l-0 border-r-0 border-t-0 border-b-2 pb-4 pt-2 hover:pl-4 transition-all"
                  >
                    {link.name}
                  </a>
                ) : (
                  <Link
                    key={link.name}
                    to={`/${link.href}`}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="text-3xl font-black comic-border border-l-0 border-r-0 border-t-0 border-b-2 pb-4 pt-2 hover:pl-4 transition-all"
                  >
                    {link.name}
                  </Link>
                )
              )}
              <Link
                to="/store"
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-3xl font-black comic-border border-l-0 border-r-0 border-t-0 border-b-2 pb-4 pt-2 hover:pl-4 transition-all"
              >
                Store
              </Link>
              <a
                href="https://calendly.com/ivan-intelligents/30min"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 w-full py-5 bg-black text-white font-black text-2xl uppercase comic-border hover:bg-white hover:text-black transition-colors text-center block shadow-comic"
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

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
    { name: 'Method', href: '#method' },
    { name: 'Work', href: '#cases' },
    { name: 'ROI', href: '#roi-calculator' },
    { name: 'About', href: '#about' },
  ];

  return (
    <nav className={`fixed z-50 transition-all duration-500 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] ${scrolled
        ? 'top-2 left-2 right-2 md:top-6 md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-5xl py-3 bg-paper/90 backdrop-blur-md border border-zinc-300 shadow-lg'
        : 'top-0 left-0 right-0 py-6 bg-transparent border-transparent'
      }`}>
      <div className="container mx-auto px-6 flex justify-between items-center">

        {/* Logo */}
        <Link to="/" className="flex items-center group">
          <span className="font-drama italic text-3xl md:text-4xl tracking-tight text-black group-hover:text-accent transition-colors leading-none">
            Manfredi
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

          <a
            href="/start"
            className="px-6 py-3 bg-accent border-subtle shadow-card font-bold tracking-wide hover:-translate-y-1 hover:shadow-card-hover transition-all active:translate-y-0 active:shadow-card-active flex items-center"
          >
            Book a call
          </a>
        </div>

        {/* Mobile Toggle */}
        <button
          className="md:hidden p-3 border-subtle shadow-card active:shadow-none bg-white active:translate-y-1 transition-all"
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
            className="md:hidden bg-accent border-subtle-thick border-l-0 border-r-0 border-b-0 mt-4 overflow-hidden"
          >
            <div className="flex flex-col p-6 gap-4">
              {homeLinks.map((link) =>
                isHome ? (
                  <a
                    key={link.name}
                    href={link.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="text-3xl font-bold border-subtle border-l-0 border-r-0 border-t-0 border-b-2 pb-4 pt-2 hover:pl-4 transition-all"
                  >
                    {link.name}
                  </a>
                ) : (
                  <Link
                    key={link.name}
                    to={`/${link.href}`}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="text-3xl font-bold border-subtle border-l-0 border-r-0 border-t-0 border-b-2 pb-4 pt-2 hover:pl-4 transition-all"
                  >
                    {link.name}
                  </Link>
                )
              )}
              <a
                href="/assessment"
                className="mt-6 w-full py-5 bg-black text-white font-bold text-2xl border-subtle hover:bg-white hover:text-black transition-colors text-center block shadow-card"
              >
                Start with the Assessment — $2,500
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;

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
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] ${scrolled
        ? 'py-3 bg-paper border-b border-[color:var(--color-hairline-bold)]'
        : 'py-6 bg-transparent border-b border-transparent'
      }`}>
      <div className="container mx-auto px-6 flex justify-between items-center">

        {/* Logo */}
        <Link to="/" className="flex items-center group">
          <span className="font-drama text-3xl md:text-4xl tracking-tight text-black group-hover:text-accent transition-colors leading-none">
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
                className="text-lg font-semibold hover:underline decoration-accent underline-offset-4 transition-all"
              >
                {link.name}
              </a>
            ) : (
              <Link
                key={link.name}
                to={`/${link.href}`}
                className="text-lg font-semibold hover:underline decoration-accent underline-offset-4 transition-all"
              >
                {link.name}
              </Link>
            )
          )}

          <a
            href="/start"
            className="px-4 py-2 bg-accent text-black font-semibold text-sm tracking-wide hover:bg-accent-ink hover:text-white transition-colors"
          >
            Book a call
          </a>
        </div>

        {/* Mobile Toggle */}
        <button
          className="md:hidden p-3 border-subtle shadow-card active:shadow-none bg-paper active:translate-y-1 transition-all"
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
                    className="text-2xl font-semibold border-b border-[color:var(--color-hairline-bold)] pb-4 pt-2 hover:pl-4 transition-all"
                  >
                    {link.name}
                  </a>
                ) : (
                  <Link
                    key={link.name}
                    to={`/${link.href}`}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="text-2xl font-semibold border-b border-[color:var(--color-hairline-bold)] pb-4 pt-2 hover:pl-4 transition-all"
                  >
                    {link.name}
                  </Link>
                )
              )}
              <a
                href="/assessment"
                className="mt-6 w-full py-5 bg-black text-white font-semibold text-2xl border-subtle hover:bg-paper hover:text-black transition-colors text-center block shadow-card-subtle"
              >
                Start with the Assessment
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;

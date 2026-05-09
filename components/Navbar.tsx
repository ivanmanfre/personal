import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const NAV_LINKS = [
  { name: 'Scorecard', href: '/scorecard', internal: true },
  { name: 'Store', href: '/store', internal: true },
];

const Navbar: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const linkBase = 'text-[11px] uppercase tracking-[0.22em] transition-colors';
  const linkColor = 'text-[rgba(26,26,26,0.55)] hover:text-[#1A1A1A]';

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] ${
        scrolled
          ? 'py-3 bg-paper/92 backdrop-blur-md border-b'
          : 'py-5 bg-transparent border-b border-transparent'
      }`}
      style={{ borderColor: scrolled ? 'rgba(26,26,26,0.08)' : 'transparent' }}
    >
      <div className="container mx-auto px-6 flex justify-between items-center">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 group">
          <span
            className="text-[26px] md:text-[28px] tracking-tight leading-none transition-colors group-hover:text-[var(--color-accent)]"
            style={{
              fontFamily: '"DM Serif Display", "Bodoni Moda", Georgia, serif',
              fontStyle: 'italic',
              fontWeight: 400,
              color: '#1A1A1A',
              letterSpacing: '-0.01em',
            }}
          >
            Manfredi
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8" style={{ fontFamily: '"IBM Plex Mono", monospace', fontWeight: 500 }}>
          {NAV_LINKS.map((link) => (
            <Link key={link.name} to={link.href} className={`${linkBase} ${linkColor}`}>
              {link.name}
            </Link>
          ))}

          <a
            href="/start"
            className="px-4 py-2 transition-colors"
            style={{
              fontFamily: '"Source Serif 4", Georgia, serif',
              fontWeight: 600,
              fontStyle: 'italic',
              fontSize: '14px',
              backgroundColor: '#1A1A1A',
              color: '#F7F4EF',
              letterSpacing: '0',
              textTransform: 'none',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-accent)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#1A1A1A')}
          >
            Book a call
          </a>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden p-2.5"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={isMobileMenuOpen}
          style={{ border: '1px solid rgba(26,26,26,0.18)', backgroundColor: 'var(--color-paper)' }}
        >
          {isMobileMenuOpen ? <X size={20} strokeWidth={2} /> : <Menu size={20} strokeWidth={2} />}
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 0.84, 0.36, 1] }}
            className="md:hidden overflow-hidden mt-3"
            style={{
              backgroundColor: 'var(--color-paper)',
              borderTop: '1px solid rgba(26,26,26,0.08)',
            }}
          >
            <div className="flex flex-col p-6 gap-1" style={{ fontFamily: '"IBM Plex Mono", monospace' }}>
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.name}
                  to={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-[13px] uppercase tracking-[0.2em] py-3 border-b"
                  style={{ borderColor: 'rgba(26,26,26,0.08)', color: 'rgba(26,26,26,0.7)' }}
                >
                  {link.name}
                </Link>
              ))}
              <a
                href="/start"
                onClick={() => setIsMobileMenuOpen(false)}
                className="mt-5 inline-flex items-center justify-center px-6 py-3"
                style={{
                  fontFamily: '"Source Serif 4", Georgia, serif',
                  fontWeight: 600,
                  fontStyle: 'italic',
                  fontSize: '16px',
                  backgroundColor: '#1A1A1A',
                  color: '#F7F4EF',
                  textTransform: 'none',
                  letterSpacing: '0',
                }}
              >
                Book a call
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;

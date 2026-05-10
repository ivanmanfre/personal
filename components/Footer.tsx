import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Linkedin, Mail, Check } from 'lucide-react';

const BEACON_URL = 'https://bjbvqvzbzczjbatgmccb.supabase.co/functions/v1/lm-beacon';

const monoLabel: React.CSSProperties = {
  fontFamily: '"IBM Plex Mono", monospace',
  fontSize: '10px',
  letterSpacing: '0.25em',
  textTransform: 'uppercase',
  color: 'rgba(26,26,26,0.45)',
};

const Footer: React.FC = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setStatus('loading');
    try {
      const res = await fetch(BEACON_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: 'capture',
          lm_slug: 'agent-ready-letter',
          email,
          src: 'site-footer',
        }),
      });
      if (!res.ok) throw new Error('subscribe failed');
      setStatus('success');
      setEmail('');
    } catch {
      setStatus('error');
    }
  };

  return (
    <footer
      id="newsletter"
      data-site-footer
      className="site-footer border-t pt-24 pb-10 relative z-10"
      style={{ borderColor: 'rgba(26,26,26,0.1)', backgroundColor: 'var(--color-paper)' }}
    >
      <div className="container mx-auto px-8 max-w-5xl">

        {/* Newsletter */}
        <div className="text-center mb-20 max-w-xl mx-auto">
          <div style={{ ...monoLabel, marginBottom: '1.5rem' }}>The Agent-Ready Letter</div>
          <h3
            style={{
              fontFamily: '"DM Serif Display", "Bodoni Moda", Georgia, serif',
              fontStyle: 'italic',
              fontWeight: 400,
              fontSize: 'clamp(2rem,3.5vw,3rem)',
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              color: '#1A1A1A',
              marginBottom: '0.75rem',
            }}
          >
            Weekly notes on systems<br />
            that actually ship.
          </h3>
          <p
            style={{
              fontFamily: '"Source Serif 4", Georgia, serif',
              fontSize: '15px',
              lineHeight: 1.65,
              color: 'rgba(26,26,26,0.62)',
              marginBottom: '2rem',
            }}
          >
            Written for founders of growing service businesses. No fluff, no AI hype. Just the patterns that work.
          </p>

          {status === 'success' ? (
            <div
              className="inline-flex items-center gap-2.5 px-5 py-3 border"
              style={{ borderColor: 'var(--color-accent)', color: 'var(--color-accent)' }}
            >
              <Check size={16} strokeWidth={2.5} />
              <span style={{ fontFamily: '"Source Serif 4", serif', fontStyle: 'italic', fontSize: '14px' }}>
                Subscribed. First letter arrives within 15 minutes.
              </span>
            </div>
          ) : (
            <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto">
              <label htmlFor="footer-newsletter-email" className="sr-only">
                Email address
              </label>
              <input
                id="footer-newsletter-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@company.com"
                disabled={status === 'loading'}
                className="flex-1 px-4 py-3"
                style={{
                  fontFamily: '"Source Serif 4", serif',
                  fontSize: '15px',
                  border: '1px solid rgba(26,26,26,0.18)',
                  backgroundColor: 'var(--color-paper)',
                  color: '#1A1A1A',
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                disabled={status === 'loading'}
                className="px-6 py-3"
                style={{
                  fontFamily: '"Source Serif 4", serif',
                  fontWeight: 600,
                  fontSize: '15px',
                  backgroundColor: '#1A1A1A',
                  color: '#F7F4EF',
                  border: 'none',
                  cursor: status === 'loading' ? 'wait' : 'pointer',
                  opacity: status === 'loading' ? 0.6 : 1,
                }}
              >
                {status === 'loading' ? 'Subscribing…' : 'Subscribe'}
              </button>
            </form>
          )}
          {status === 'error' && (
            <p
              style={{
                fontFamily: '"Source Serif 4", serif',
                fontStyle: 'italic',
                fontSize: '13px',
                color: '#B85450',
                marginTop: '12px',
              }}
            >
              Something went wrong. Try again or email im@ivanmanfredi.com.
            </p>
          )}
        </div>

        {/* Wordmark + socials */}
        <div
          className="flex flex-col md:flex-row justify-between items-center gap-8 mb-12 pt-12 border-t"
          style={{ borderColor: 'rgba(26,26,26,0.1)' }}
        >
          <div className="text-center md:text-left">
            <h2
              style={{
                fontFamily: '"DM Serif Display", "Bodoni Moda", Georgia, serif',
                fontWeight: 400,
                fontSize: 'clamp(1.8rem,2.4vw,2.4rem)',
                letterSpacing: '-0.02em',
                color: '#1A1A1A',
                marginBottom: '4px',
              }}
            >
              Iván <span style={{ fontStyle: 'italic' }}>Manfredi</span>
            </h2>
            <p style={monoLabel}>Agent-Ready Ops™</p>
          </div>

          <div className="flex gap-2.5">
            {[
              {
                Icon: Linkedin,
                href: 'https://www.linkedin.com/in/iv%C3%A1n-manfredi-120841202/',
                label: 'Iván Manfredi on LinkedIn',
              },
              {
                Icon: Mail,
                href: 'mailto:im@ivanmanfredi.com',
                label: 'Email Iván at im@ivanmanfredi.com',
              },
            ].map(({ Icon, href, label }) => (
              <a
                key={label}
                href={href}
                target={href.startsWith('http') ? '_blank' : undefined}
                rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
                aria-label={label}
                className="w-11 h-11 flex items-center justify-center transition-colors"
                style={{
                  border: '1px solid rgba(26,26,26,0.18)',
                  color: 'rgba(26,26,26,0.65)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#1A1A1A';
                  e.currentTarget.style.color = '#F7F4EF';
                  e.currentTarget.style.borderColor = '#1A1A1A';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'rgba(26,26,26,0.65)';
                  e.currentTarget.style.borderColor = 'rgba(26,26,26,0.18)';
                }}
              >
                <Icon size={18} strokeWidth={2} aria-hidden="true" />
              </a>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className="pt-8 border-t flex flex-col md:flex-row justify-between items-center gap-4"
          style={{ borderColor: 'rgba(26,26,26,0.1)', ...monoLabel, fontSize: '10px' }}
        >
          <p>© {new Date().getFullYear()} Iván Manfredi · All rights reserved</p>
          <div className="flex gap-7">
            <Link
              to="/store"
              style={{ color: 'rgba(26,26,26,0.55)', transition: 'color 0.15s' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#1A1A1A')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(26,26,26,0.55)')}
            >
              Store
            </Link>
            <Link
              to="/scorecard"
              style={{ color: 'rgba(26,26,26,0.55)', transition: 'color 0.15s' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#1A1A1A')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(26,26,26,0.55)')}
            >
              Scorecard
            </Link>
            <a
              href="mailto:im@ivanmanfredi.com"
              style={{ color: 'rgba(26,26,26,0.55)', transition: 'color 0.15s' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#1A1A1A')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(26,26,26,0.55)')}
            >
              Contact
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

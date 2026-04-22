import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Linkedin, Mail, Check } from 'lucide-react';

const BEACON_URL = 'https://bjbvqvzbzczjbatgmccb.supabase.co/functions/v1/lm-beacon';

const Footer: React.FC = () => {
  const socials = [
    { icon: Linkedin, href: 'https://www.linkedin.com/in/iv%C3%A1n-manfredi-120841202/' },
    { icon: Mail, href: 'mailto:im@ivanmanfredi.com' },
  ];

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
          src: 'footer',
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
    <footer className="bg-paper-sunk text-black border-t border-[color:var(--color-hairline)] pt-20 pb-10 relative z-10">
      <div className="container mx-auto px-6 max-w-5xl">

        {/* Newsletter capture */}
        <div id="newsletter" className="mb-20 text-center">
          <h3 className="text-2xl md:text-3xl font-semibold mb-3 tracking-tight">
            The Agent-Ready <span className="font-drama italic">Letter</span>
          </h3>
          <p className="text-ink-soft mb-6 max-w-xl mx-auto leading-relaxed">
            Weekly notes on AI systems that actually ship. Written for founders of growing service businesses.
          </p>

          {status === 'success' ? (
            <div className="inline-flex items-center gap-3 px-4 py-2 border border-[color:var(--color-hairline-bold)] text-ink-soft font-medium">
              <Check size={16} className="text-accent-ink" strokeWidth={3} />
              Subscribed. First letter arrives within 15 minutes.
            </div>
          ) : (
            <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@company.com"
                disabled={status === 'loading'}
                className="flex-1 px-4 py-3 bg-paper border border-[color:var(--color-hairline-bold)] text-black placeholder-ink-mute focus:outline-none focus:border-accent disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={status === 'loading'}
                className="px-6 py-3 bg-accent text-black font-semibold tracking-wide disabled:opacity-50 hover:bg-accent-ink hover:text-white transition-colors"
              >
                {status === 'loading' ? 'Subscribing…' : 'Subscribe'}
              </button>
            </form>
          )}
          {status === 'error' && (
            <p className="mt-4 text-sm text-red-600">Something went wrong. Try again or email im@ivanmanfredi.com.</p>
          )}
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center mb-12 gap-8">

          <div className="text-center md:text-left">
            <h2 className="text-4xl font-semibold mb-2 tracking-tight">
              Iván <span className="font-drama italic">Manfredi</span>
            </h2>
            <p className="font-mono text-xs uppercase tracking-[0.1em] text-ink-mute">Agent-Ready Ops™</p>
          </div>

          <div className="flex gap-3">
            {socials.map((social, i) => (
              <a
                key={i}
                href={social.href}
                target={social.href.startsWith('http') ? "_blank" : undefined}
                rel={social.href.startsWith('http') ? "noopener noreferrer" : undefined}
                className="w-11 h-11 border border-[color:var(--color-hairline-bold)] flex items-center justify-center text-ink-soft hover:bg-black hover:text-white hover:border-black transition-colors"
              >
                <social.icon size={18} strokeWidth={2} />
              </a>
            ))}
          </div>
        </div>

        <div className="border-t border-[color:var(--color-hairline)] pt-8 flex flex-col md:flex-row justify-between items-center gap-6 text-xs font-mono uppercase tracking-[0.1em] text-ink-mute">
          <p>&copy; {new Date().getFullYear()} All rights reserved.</p>

          <div className="flex gap-8">
            <Link to="/store" className="hover:text-black transition-colors">Store</Link>
            <a href="mailto:im@ivanmanfredi.com" className="hover:text-black transition-colors">Contact</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

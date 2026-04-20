import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Linkedin, Mail, Check } from 'lucide-react';

const BEACON_URL = 'https://bjbvqvzbzczjbatgmccb.supabase.co/functions/v1/lm-beacon';

const Footer: React.FC = () => {
  const socials = [
    { icon: Linkedin, href: 'https://www.linkedin.com/in/iv%C3%A1n-manfredi-120841202/' },
    { icon: Mail, href: 'mailto:ivan@ivanmanfredi.com' },
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
    <footer className="bg-zinc-900 text-white border-t border-zinc-800 pt-16 pb-8 relative z-10">
      <div className="container mx-auto px-6">

        {/* Newsletter capture */}
        <div id="newsletter" className="mb-16 max-w-2xl mx-auto text-center">
          <h3 className="text-2xl md:text-3xl font-semibold mb-3 tracking-tight">
            The Agent-Ready <span className="font-drama italic text-accent">Letter</span>
          </h3>
          <p className="text-zinc-400 mb-6">
            Weekly notes on AI systems that actually ship. Written for founders of growing service businesses.
          </p>

          {status === 'success' ? (
            <div className="inline-flex items-center gap-3 px-5 py-3 bg-accent/20 border border-accent text-white font-medium">
              <Check size={18} className="text-accent" strokeWidth={3} />
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
                className="flex-1 px-4 py-3 bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:border-accent disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={status === 'loading'}
                className="px-6 py-3 bg-accent text-black font-bold tracking-wide border-subtle shadow-card hover:-translate-y-1 hover:shadow-card-hover transition-all disabled:opacity-50"
              >
                {status === 'loading' ? 'Subscribing…' : 'Subscribe'}
              </button>
            </form>
          )}
          {status === 'error' && (
            <p className="mt-4 text-sm text-red-400">Something went wrong. Try again or email ivan@ivanmanfredi.com.</p>
          )}
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center mb-12 gap-8">

          <div className="text-center md:text-left">
            <h2 className="text-4xl font-semibold mb-2 tracking-tight">Iván Manfredi</h2>
            <p className="font-medium text-zinc-400">Agent-Ready Ops™</p>
          </div>

          <div className="flex gap-4">
            {socials.map((social, i) => (
              <a
                key={i}
                href={social.href}
                target={social.href.startsWith('http') ? "_blank" : undefined}
                rel={social.href.startsWith('http') ? "noopener noreferrer" : undefined}
                className="w-14 h-14 border border-white/30 flex items-center justify-center hover:bg-white hover:text-black hover:-translate-y-1 transition-all active:translate-y-0"
              >
                <social.icon size={24} strokeWidth={2.5} />
              </a>
            ))}
          </div>
        </div>

        <div className="border-t border-zinc-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-6 text-sm text-zinc-400 font-bold uppercase tracking-wide">
          <p>&copy; {new Date().getFullYear()} All Rights Reserved.</p>

          <div className="flex gap-8">
            <Link to="/store" className="hover:text-white transition-colors">Store</Link>
            <a href="mailto:ivan@ivanmanfredi.com" className="hover:text-white transition-colors">Contact</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

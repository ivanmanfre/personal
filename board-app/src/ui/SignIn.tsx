import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { publicBrand, redeem, requestLink } from '../data/api';
import type { BoardSession } from '../data/session';
import { track } from '../data/track';

const emailOk = (s: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.trim());

/* Email, then the 6-digit code from the same email (or its one-tap link), exactly like the live board:
   board-magic-link sends both; redeem_board_login turns the code into a session. */
export function SignInForm({ slug, onAuthed, compact = false, intro }: { slug: string; onAuthed: (s: BoardSession) => void; compact?: boolean; intro?: ReactNode }) {
  const [phase, setPhase] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const codeRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (phase === 'code') codeRef.current?.focus(); }, [phase]);
  const addr = email.trim().toLowerCase();

  const send = async () => {
    if (!emailOk(email) || busy) return;
    setBusy(true); setErr('');
    await requestLink(slug, addr);
    setBusy(false); setPhase('code'); setCode('');
  };
  const check = async () => {
    const c = code.replace(/\D/g, '');
    if (c.length !== 6 || busy) return;
    setBusy(true); setErr('');
    const s = await redeem(slug, c, 'code');
    setBusy(false);
    if (s) { track('sign_in', null, { how: 'code', inline: compact }); onAuthed(s); }
    else setErr('That code did not match. Check the newest email, or ask for a new code.');
  };

  const field = `block w-full rounded-[12px] border hair bg-paper px-3.5 text-ink placeholder:text-mute outline-none focus:border-[var(--line-bold)] ${compact ? 'h-10 text-[14px]' : 'h-12 text-[15px]'}`;
  return (
    <div data-testid={compact ? 'signin-inline' : 'signin'}>
      {intro}
      {phase === 'email' ? (
        <form onSubmit={e => { e.preventDefault(); void send(); }} className={compact ? 'mt-2.5' : 'mt-6'}>
          <label className="sr-only" htmlFor={`em-${compact ? 'i' : 'f'}`}>Your email</label>
          <input id={`em-${compact ? 'i' : 'f'}`} type="email" inputMode="email" autoComplete="email" autoFocus={!compact}
            value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" className={field} />
          <button type="submit" disabled={!emailOk(email) || busy} className={`btn btn-primary w-full mt-2.5 ${compact ? '' : 'btn-lg'}`} style={!emailOk(email) || busy ? { opacity: 0.5 } : undefined}>
            {busy ? 'Sending' : 'Send me a code'} {!busy && <ArrowRight size={16} />}
          </button>
        </form>
      ) : (
        <form onSubmit={e => { e.preventDefault(); void check(); }} className={compact ? 'mt-2.5' : 'mt-6'}>
          <p className={`${compact ? 'text-[12.5px]' : 'text-[14px]'} text-soft leading-[1.5]`}>
            We sent a 6-digit code and a sign-in link to <span className="text-ink font-semibold">{addr}</span>. Both work for 15 minutes.
          </p>
          <label className="sr-only" htmlFor={`cd-${compact ? 'i' : 'f'}`}>6-digit code</label>
          <input id={`cd-${compact ? 'i' : 'f'}`} ref={codeRef} type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
            value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000"
            className={`${field} mt-3 tnum tracking-[0.4em] ${compact ? '' : '!text-[22px]'}`} />
          <button type="submit" disabled={code.length !== 6 || busy} className={`btn btn-primary w-full mt-2.5 ${compact ? '' : 'btn-lg'}`} style={code.length !== 6 || busy ? { opacity: 0.5 } : undefined}>
            {busy ? 'Checking' : compact ? 'Sign in' : 'Open my board'}
          </button>
          <button type="button" className="mt-2 text-[12.5px] text-mute underline underline-offset-[3px] hover:text-ink" onClick={() => { setPhase('email'); setErr(''); }}>
            Use a different email
          </button>
        </form>
      )}
      {err && <p className="mt-2.5 text-[12.5px] leading-[1.5] text-[#E5484D]" role="alert">{err}</p>}
    </div>
  );
}

/* The full-screen way in, in the board's own look. */
export function SignInScreen({ slug, name, note, onAuthed }: { slug: string; name: string; note?: string; onAuthed: (s: BoardSession) => void }) {
  const [brand, setBrand] = useState(name);
  useEffect(() => { let live = true; publicBrand(slug).then(b => { if (live && b) setBrand(b); }); return () => { live = false; }; }, [slug]);
  return (
    <div className="app min-h-[100dvh] flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-[400px]">
        <div className="flex items-center gap-2.5">
          <span className="h-8 w-8 rounded-[9px] inline-flex items-center justify-center font-display text-[15px]" style={{ background: 'var(--accent)', color: 'var(--accent-ink)', fontWeight: 600 }}>{(brand || 'B').slice(0, 1)}</span>
          <span className="font-display text-head text-[18px]" style={{ fontWeight: 500 }}>{brand}</span>
          <span className="text-[13px] text-mute">Content board</span>
        </div>
        <h1 className="display text-[32px] mt-10 leading-[1.12]">Sign in to your board</h1>
        <SignInForm slug={slug} onAuthed={onAuthed} intro={
          <>
            {note && <p className="mt-4 text-[14px] text-ink leading-[1.55] rounded-[12px] bg-sunk px-3.5 py-3">{note}</p>}
            <p className="mt-3 text-[14.5px] text-soft leading-[1.6]">Use the email we have for you. We send a 6-digit code and a one-tap link. No password.</p>
          </>
        } />
      </div>
    </div>
  );
}

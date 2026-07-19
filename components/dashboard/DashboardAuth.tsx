import React, { useState } from 'react';
import { verifyPassword, isAuthenticated } from '../../lib/dashboardAuth';
import { supabase } from '../../lib/supabase';
import { Lock, ArrowRight } from 'lucide-react';

interface Props {
  onSuccess: () => void;
}

// Two-factor gate (both required during the RLS transition): the legacy
// password step, then a Supabase email-OTP step that mints the authenticated
// session PostgREST needs once anon reads are revoked. Only the pre-created
// user (im@ivanmanfredi.com) can complete step 2: signups are disabled
// server-side and shouldCreateUser is false, so any other address is denied
// by GoTrue itself.
const DashboardAuth: React.FC<Props> = ({ onSuccess }) => {
  const [step, setStep] = useState<'password' | 'otp'>('password');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('im@ivanmanfredi.com');
  const [code, setCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);

  // Returning visits: the password may already be remembered (localStorage).
  // The stored hash alone is NOT enough once RLS lands: without a Supabase
  // session every dashboard read fails, so jump to the OTP step instead of
  // silently passing the gate.
  React.useEffect(() => {
    (async () => {
      if (!isAuthenticated()) return;
      const { data } = await supabase.auth.getSession();
      if (data.session) onSuccess();
      else setStep('otp');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(false);
    const ok = await verifyPassword(password);
    if (ok) {
      const { data } = await supabase.auth.getSession();
      if (data.session) onSuccess();
      else setStep('otp');
    } else {
      setError(true);
      setPassword('');
    }
    setLoading(false);
  };

  const sendCode = async () => {
    setLoading(true);
    setOtpError(null);
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false },
    });
    if (err) setOtpError(err.message);
    else setOtpSent(true);
    setLoading(false);
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setOtpError(null);
    const { data, error: err } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'email',
    });
    if (err || !data.session) {
      setOtpError(err?.message ?? 'Verification failed');
      setCode('');
    } else {
      onSuccess();
    }
    setLoading(false);
  };

  if (step === 'otp') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4 relative overflow-hidden">
        <form onSubmit={verifyCode} className="w-full max-w-sm relative animate-auth-enter" data-testid="otp-step">
          <div className="flex flex-col items-center gap-8">
            <div className="text-center">
              <h1 className="text-xl tracking-tight text-white">
                <span className="font-medium">INBOUND</span>
                <span className="font-black text-[#C8361B]">ON</span>
                <span className="font-medium">STEROIDS</span>
              </h1>
              <p className="text-zinc-500 text-sm mt-1.5">
                {otpSent ? 'Enter the login code from your email' : 'Second step: email login code'}
              </p>
            </div>
            <div className="w-full space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setOtpError(null); }}
                placeholder="Email"
                disabled={otpSent}
                className="w-full px-4 py-3 bg-zinc-900/80 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600 disabled:opacity-60"
              />
              {otpSent && (
                <input
                  type="text"
                  inputMode="numeric"
                  value={code}
                  onChange={(e) => { setCode(e.target.value); setOtpError(null); }}
                  placeholder="8-digit code"
                  autoFocus
                  className="w-full px-4 py-3 bg-zinc-900/80 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 tracking-[0.3em] text-center focus:outline-none focus:border-zinc-600"
                />
              )}
              {otpError && <p className="text-red-400 text-xs text-center font-medium">{otpError}</p>}
              {!otpSent ? (
                <button
                  type="button"
                  onClick={sendCode}
                  disabled={loading || !email.trim()}
                  className="w-full py-3 bg-white text-zinc-950 font-semibold rounded-xl disabled:bg-zinc-800 disabled:text-zinc-600"
                >
                  {loading ? 'Sending' : 'Send code'}
                </button>
              ) : (
                <>
                  <button
                    type="submit"
                    disabled={loading || code.trim().length < 6}
                    className="w-full py-3 bg-white text-zinc-950 font-semibold rounded-xl disabled:bg-zinc-800 disabled:text-zinc-600"
                  >
                    {loading ? 'Verifying' : 'Verify'}
                  </button>
                  <button
                    type="button"
                    onClick={sendCode}
                    disabled={loading}
                    className="w-full py-2 text-zinc-500 text-xs hover:text-zinc-300"
                  >
                    Resend code
                  </button>
                </>
              )}
            </div>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-emerald-600/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/3 w-[300px] h-[300px] bg-blue-600/5 rounded-full blur-[100px]" />
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-sm relative animate-auth-enter">
        <div className="flex flex-col items-center gap-8">
          {/* Logo */}
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-xl shadow-emerald-500/20">
              <Lock className="w-7 h-7 text-white/90" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-zinc-950 flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping-slow" />
            </div>
          </div>

          {/* Title */}
          <div className="text-center">
            {/* Wordmark law: INBOUND+STEROIDS weight 500, ON weight 900 in Signal
                red. Paper (white) on the dark login gate. */}
            <h1 className="text-xl tracking-tight text-white">
              <span className="font-medium">INBOUND</span>
              <span className="font-black text-[#C8361B]">ON</span>
              <span className="font-medium">STEROIDS</span>
            </h1>
            <p className="text-zinc-500 text-sm mt-1.5">Enter password to access dashboard</p>
          </div>

          {/* Form */}
          <div className="w-full space-y-3">
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(false); }}
                placeholder="Password"
                autoFocus
                className={`w-full px-4 py-3 bg-zinc-900/80 backdrop-blur-sm border rounded-xl text-white placeholder-zinc-600 focus:outline-none transition-all duration-200 ${
                  error
                    ? 'border-red-500/50 focus:border-red-500 focus:ring-1 focus:ring-red-500/30'
                    : 'border-zinc-800 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20'
                }`}
              />
            </div>
            {error && (
              <p className="text-red-400 text-xs text-center font-medium">Incorrect password</p>
            )}
            <button
              type="submit"
              disabled={loading || !password}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 group"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Enter
                  <ArrowRight aria-hidden="true" className="w-4 h-4 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default DashboardAuth;

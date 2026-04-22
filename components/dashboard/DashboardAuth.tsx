import React, { useState } from 'react';
import { verifyPassword } from '../../lib/dashboardAuth';
import { Lock, ArrowRight } from 'lucide-react';

interface Props {
  onSuccess: () => void;
}

const DashboardAuth: React.FC<Props> = ({ onSuccess }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(false);
    const ok = await verifyPassword(password);
    if (ok) {
      onSuccess();
    } else {
      setError(true);
      setPassword('');
    }
    setLoading(false);
  };

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
            <h1 className="text-xl font-bold text-white tracking-tight">Ivan System</h1>
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

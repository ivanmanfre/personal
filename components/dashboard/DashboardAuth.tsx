import React, { useState } from 'react';
import { verifyPassword } from '../../lib/dashboardAuth';
import { Lock } from 'lucide-react';

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
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center">
            <Lock className="w-7 h-7 text-zinc-400" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-white">Dashboard</h1>
            <p className="text-zinc-500 text-sm mt-1">Enter password to continue</p>
          </div>
          <div className="w-full space-y-3">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoFocus
              className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
            />
            {error && (
              <p className="text-red-400 text-sm text-center">Wrong password</p>
            )}
            <button
              type="submit"
              disabled={loading || !password}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-semibold rounded-lg transition-colors"
            >
              {loading ? 'Verifying...' : 'Enter'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default DashboardAuth;

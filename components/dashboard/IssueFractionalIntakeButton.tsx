import React, { useState } from 'react';
import { Send, Copy, Check, Loader2, ChevronDown, ChevronUp, Link2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface IssuedSession {
  id: string;
  session_token: string;
  intake_url: string;
  expires_at: string;
  client_email: string;
}

const IssueFractionalIntakeButton: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [issuing, setIssuing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<IssuedSession | null>(null);
  const [copied, setCopied] = useState(false);

  const handleIssue = async () => {
    if (!email.trim()) { setError('Email required'); return; }
    setError(null);
    setIssuing(true);
    try {
      const { data, error } = await supabase.rpc('issue_fractional_session', {
        p_client_email: email.trim(),
        p_client_name: name.trim() || null,
        p_client_company: company.trim() || null,
        p_expires_in_days: expiresInDays,
      });
      if (error) throw error;
      setIssued({ ...data, client_email: email.trim() });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIssuing(false);
    }
  };

  const handleCopy = async () => {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued.intake_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard might be denied; user can still select manually */ }
  };

  const handleReset = () => {
    setIssued(null);
    setEmail('');
    setName('');
    setCompany('');
    setError(null);
  };

  return (
    <div className="bg-gradient-to-r from-orange-950/15 to-zinc-900/60 border border-orange-800/30 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-orange-900/10 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-orange-400" />
          <span className="text-sm font-semibold text-orange-100">Issue Fractional Intake Link</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded border border-orange-600/40 text-orange-300/80 bg-orange-900/30">warm referral</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-orange-400/60" /> : <ChevronDown className="w-4 h-4 text-orange-400/60" />}
      </button>

      {open && (
        <div className="border-t border-orange-800/20 px-4 py-4 space-y-3">
          {!issued && (
            <>
              <p className="text-xs text-zinc-400 leading-relaxed">
                For warm Fractional buyers post-close. Generates a unique intake URL the buyer opens to start their conversational intake (~20 min, 30 keys). Token expires in {expiresInDays} days.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <input
                  type="email"
                  placeholder="client@example.com *"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={issuing}
                  className="bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-[13px] text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-orange-500/40"
                />
                <input
                  type="text"
                  placeholder="Client name (optional)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={issuing}
                  className="bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-[13px] text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-orange-500/40"
                />
                <input
                  type="text"
                  placeholder="Company (optional)"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  disabled={issuing}
                  className="bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-[13px] text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-orange-500/40"
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                  <span>Expires in:</span>
                  <select
                    value={expiresInDays}
                    onChange={(e) => setExpiresInDays(Number(e.target.value))}
                    disabled={issuing}
                    className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[11px] text-zinc-300 focus:outline-none"
                  >
                    <option value={7}>7 days</option>
                    <option value={14}>14 days</option>
                    <option value={30}>30 days</option>
                    <option value={60}>60 days</option>
                  </select>
                </div>
                <button
                  onClick={handleIssue}
                  disabled={issuing || !email.trim()}
                  className="text-[12px] px-3 py-1.5 rounded bg-orange-700/40 text-orange-100 hover:bg-orange-700/60 border border-orange-600/40 transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {issuing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Issue link
                </button>
              </div>
              {error && (
                <p className="text-[12px] text-red-400 bg-red-950/30 border border-red-800/40 rounded px-3 py-2">{error}</p>
              )}
            </>
          )}

          {issued && (
            <div className="space-y-3">
              <div className="bg-emerald-950/20 border border-emerald-700/40 rounded p-3">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-emerald-400 mb-2">Intake link ready</p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={issued.intake_url}
                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-[12px] text-zinc-200 font-mono focus:outline-none"
                    onFocus={(e) => e.target.select()}
                  />
                  <button
                    onClick={handleCopy}
                    className="text-[11px] px-2.5 py-1.5 rounded bg-zinc-800 text-zinc-200 hover:text-white hover:bg-zinc-700 transition-colors flex items-center gap-1"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <p className="text-[11px] text-zinc-500 mt-2">
                  Issued to <span className="text-zinc-300 font-semibold">{issued.client_email}</span> · expires {new Date(issued.expires_at).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={handleReset}
                className="text-[11px] text-zinc-400 hover:text-zinc-200 underline"
              >
                Issue another link
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default IssueFractionalIntakeButton;

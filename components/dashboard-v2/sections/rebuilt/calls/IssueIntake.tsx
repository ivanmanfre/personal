import React, { useState } from 'react';
import { Send, Copy, Check, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../../../../../lib/supabase';

/*
 * Issue Fractional Intake link — Black Box v4 restyle of the v1
 * IssueFractionalIntakeButton. Orange gradient chrome replaced by a flat box.
 * The write-path (supabase.rpc('issue_fractional_session', ...)) is verbatim
 * from the v1 component; nothing about the mutation is re-implemented.
 */

interface IssuedSession {
  id: string;
  session_token: string;
  intake_url: string;
  expires_at: string;
  client_email: string;
}

const IssueIntake: React.FC = () => {
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

  const handleReset = () => { setIssued(null); setEmail(''); setName(''); setCompany(''); setError(null); };

  return (
    <div className="cl-disc">
      <button className="cl-disc-head" onClick={() => setOpen(!open)}>
        <span className="cl-disc-title">
          Issue fractional intake link
          <span className="cl-disc-badge">warm referral</span>
        </span>
        <span className="cl-disc-chev">{open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</span>
      </button>

      {open && (
        <div className="cl-disc-body">
          {!issued && (
            <>
              <p className="cl-intake-note">
                For warm Fractional buyers post-close. Generates a unique intake URL the buyer opens to start their conversational intake (about 20 min, 30 keys). Token expires in {expiresInDays} days.
              </p>
              <div className="cl-intake-grid">
                <input className="cl-input" type="email" placeholder="client@example.com *" value={email} onChange={(e) => setEmail(e.target.value)} disabled={issuing} />
                <input className="cl-input" type="text" placeholder="Client name (optional)" value={name} onChange={(e) => setName(e.target.value)} disabled={issuing} />
                <input className="cl-input" type="text" placeholder="Company (optional)" value={company} onChange={(e) => setCompany(e.target.value)} disabled={issuing} />
              </div>
              <div className="cl-intake-foot">
                <span className="cl-intake-exp">
                  Expires in
                  <select className="cl-sel" value={expiresInDays} onChange={(e) => setExpiresInDays(Number(e.target.value))} disabled={issuing}>
                    <option value={7}>7 days</option>
                    <option value={14}>14 days</option>
                    <option value={30}>30 days</option>
                    <option value={60}>60 days</option>
                  </select>
                </span>
                <button className="cl-act cl-act--primary" onClick={handleIssue} disabled={issuing || !email.trim()}>
                  {issuing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />} Issue link
                </button>
              </div>
              {error && <p className="cl-err">{error}</p>}
            </>
          )}

          {issued && (
            <div>
              <div className="cl-issued">
                <div className="cl-issued-h">Intake link ready</div>
                <div className="cl-issued-row">
                  <input className="cl-issued-url" type="text" readOnly value={issued.intake_url} onFocus={(e) => e.target.select()} />
                  <button className="cl-act" onClick={handleCopy}>
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <p className="cl-issued-meta">Issued to {issued.client_email} · expires {new Date(issued.expires_at).toLocaleDateString()}</p>
              </div>
              <button className="cl-issued-again" onClick={handleReset}>Issue another link</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default IssueIntake;

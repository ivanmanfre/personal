import React, { useState } from 'react';
import { Sparkles, ExternalLink, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';

/**
 * Client Board Generator — admin form (Reach ▸ Boards).
 * Thin caller of the n8n "Client Board Generator" webhook, which fronts the
 * deployed board-generator Railway service (single source of truth). The
 * BOARD_GEN_TOKEN lives ONLY in n8n; this form never sees it.
 * The webhook returns {slug, url, status} instantly — the board self-builds
 * (~6 min) and flips itself from the "building" state to a preview board.
 */

const BOARD_GEN_HOOK =
  (import.meta as any).env?.VITE_BOARD_GEN_WEBHOOK ||
  'https://n8n.ivanmanfredi.com/webhook/generate-client-board';
// Soft shared secret — NOT a hard secret (ships in the client bundle). The real
// gate is the dashboard's own auth (VITE_DASHBOARD_HASH) + this being an
// internal admin tool. Kept in sync with the n8n Validate & Map node.
const BOARD_GEN_KEY =
  (import.meta as any).env?.VITE_BOARD_GEN_KEY || 'bg-7a1f9c4e2d';

type Result = { slug: string; url: string; status: string };

const inputCls =
  'w-full rounded-lg bg-[var(--ds-bg)] border border-[var(--ds-line)] px-3 py-2.5 text-sm text-[var(--ds-ink)] placeholder-[var(--ds-faint)] focus:outline-none focus:border-[var(--ds-accent)] focus:ring-1 focus:ring-[var(--ds-accent)]/30 transition-all';

const ClientBoardGeneratorPanel: React.FC = () => {
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [vertical, setVertical] = useState('');
  const [company, setCompany] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const canSubmit = name.trim().length > 0 && domain.trim().length > 0 && !busy;

  const handleGenerate = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(BOARD_GEN_HOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-bg-key': BOARD_GEN_KEY },
        body: JSON.stringify({
          name: name.trim(),
          domain: domain.trim(),
          vertical: vertical.trim() || undefined,
          company: company.trim() || undefined,
        }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`Webhook returned ${res.status}`);
      let data: any = {};
      try { data = text ? JSON.parse(text) : {}; } catch { /* fall through */ }
      if (!data.url || !data.slug) {
        throw new Error('Webhook did not return a board URL — check the workflow / shared key.');
      }
      setResult({ slug: data.slug, url: data.url, status: data.status || 'generating' });
    } catch (err: any) {
      setError(err?.message || 'Failed to start board generation.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="dv-card">
        <div className="dv-card-lbl">New client board</div>
        <h3 className="text-[15px] font-semibold text-[var(--ds-ink)] mb-1">
          Spin up a white-label demo board
        </h3>
        <p className="text-[13px] text-[var(--ds-dim)] mb-4">
          Reads the prospect's brand off their live site, generates a full month of
          themed content + a live lead-magnet assessment, and returns a shareable
          board URL. The board opens in a "building" state and turns itself on in
          about six minutes.
        </p>

        <div className="space-y-4">
          <div>
            <div className="dv-field-label">Founder name</div>
            <input
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Jane Doe"
              disabled={busy}
            />
          </div>

          <div>
            <div className="dv-field-label">Domain</div>
            <input
              className={inputCls}
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="e.g. acmeagency.com"
              disabled={busy}
              onKeyDown={(e) => { if (e.key === 'Enter') handleGenerate(); }}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="dv-field-label">
                Vertical <span className="normal-case font-normal text-[var(--ds-faint)]">· optional</span>
              </div>
              <input
                className={inputCls}
                value={vertical}
                onChange={(e) => setVertical(e.target.value)}
                placeholder="e.g. SEO agency"
                disabled={busy}
              />
            </div>
            <div>
              <div className="dv-field-label">
                Company <span className="normal-case font-normal text-[var(--ds-faint)]">· optional</span>
              </div>
              <input
                className={inputCls}
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. Acme Agency"
                disabled={busy}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!canSubmit}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--ds-accent)] hover:bg-[var(--ds-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 transition-all"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {busy ? 'Starting…' : 'Generate board'}
            </button>
            <span className="text-[12px] text-[var(--ds-faint)]">Builds in ~6 min · brand read live</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="dv-card border-red-500/30">
          <div className="flex items-start gap-2 text-[13px] text-red-500">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>{error}</div>
          </div>
        </div>
      )}

      {result && (
        <div className="dv-card">
          <div className="flex items-start gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-500 flex-shrink-0" />
            <div>
              <div className="text-[14px] font-semibold text-[var(--ds-ink)]">
                Board started for {name.trim()}
              </div>
              <div className="text-[12px] text-[var(--ds-dim)]">
                Opens in its building state now — it fills itself in over ~6 min. Refresh the
                board to watch it flip to preview.
              </div>
            </div>
          </div>
          <a
            href={result.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--ds-accent)]/10 text-[var(--ds-accent)] ring-1 ring-inset ring-[var(--ds-accent)]/30 hover:bg-[var(--ds-accent)]/15 px-3 py-2 text-[13px] font-medium transition-colors break-all"
          >
            <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
            {result.url}
          </a>
          <div className="mt-2 text-[11px] text-[var(--ds-faint)]">
            slug: <code>{result.slug}</code> · status: {result.status}
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientBoardGeneratorPanel;

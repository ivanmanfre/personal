import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';

/** Self-serve growth scans for the RISE board (2026-10-20). The panel only queues a URL; the
 *  Railway worker builds the scan and two Opus reviews must pass before a link shows here. */
export type ScanRequest = {
  id: string; input_url: string; domain: string | null; company_name: string | null;
  status: 'queued' | 'working' | 'ready' | 'held' | 'failed'; stage: string | null; message: string | null;
  scan_url: string | null; created_at: string; finished_at: string | null;
};

const ERRORS: Record<string, string> = {
  bad_url: 'Paste a website (brand.com) or a LinkedIn company page.',
  daily_limit: 'That is 25 scans in the last day. Try again tomorrow.',
  not_authenticated: 'Your sign-in expired. Reload the page and sign in again.',
};

const open = (r: ScanRequest) => r.status === 'queued' || r.status === 'working';

export function statusLine(r: ScanRequest): string {
  if (r.status === 'ready') return 'Ready';
  if (r.status === 'held') return 'Ivan is checking this one before it goes out';
  if (r.status === 'failed') return r.message || 'This one did not finish';
  return r.message || 'Queued';
}

export default function RiseScanRequests({ slug, session }: { slug: string; session: string }) {
  const [url, setUrl] = useState('');
  const [rows, setRows] = useState<ScanRequest[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const alive = useRef(true);

  const load = async () => {
    const { data, error: rpcError } = await supabase.rpc('rise_scan_request_list', { p_slug: slug, p_session: session });
    if (!alive.current) return;
    if (rpcError || !data?.ok) { setError(ERRORS[data?.error] || 'Scans could not load. Reload to try again.'); return; }
    setRows(data.requests || []);
  };

  useEffect(() => { alive.current = true; void load(); return () => { alive.current = false; }; }, [slug, session]);
  // Poll only while something is still running.
  useEffect(() => {
    if (!rows.some(open)) return;
    const t = window.setInterval(() => { void load(); }, 20000);
    return () => window.clearInterval(t);
  }, [rows]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = url.trim();
    if (!value || busy) return;
    setBusy(true); setError('');
    const { data, error: rpcError } = await supabase.rpc('rise_scan_request_submit', { p_slug: slug, p_session: session, p_url: value });
    setBusy(false);
    if (rpcError || !data?.ok) { setError(ERRORS[data?.error] || 'That did not go through. Try again.'); return; }
    setUrl('');
    void load();
  };

  return (
    <section aria-labelledby="rise-scan-title" className="mb-8 max-w-[880px] rounded-xl bg-white p-4 sm:p-5" style={{ border: '1px solid var(--cb-line, rgba(26,26,26,0.15))' }}>
      <span className="block uppercase" style={{ fontFamily: 'var(--cb-mono, "IBM Plex Mono", monospace)', fontSize: 10.5, letterSpacing: '0.1em', color: 'var(--cb-ink-mute, #5A5752)' }}>Growth scan</span>
      <h2 id="rise-scan-title" className="mt-1" style={{ fontFamily: 'var(--cb-body, "Source Serif 4", Georgia, serif)', fontWeight: 600, fontSize: 18, color: 'var(--cb-ink, #1A1A1A)' }}>Run a growth scan on any brand</h2>
      <p className="mt-1 text-[14px]" style={{ color: 'var(--cb-ink-soft, #4A4A48)' }}>
        Paste the brand's website or its LinkedIn company page. We build the scan, then a final review checks every claim against the store before the link shows here. Usually 10 to 15 minutes.
      </p>
      <form onSubmit={submit} className="mt-3 flex flex-wrap gap-2">
        <label htmlFor="rise-scan-url" className="sr-only">Brand website or LinkedIn company page</label>
        <input id="rise-scan-url" type="text" inputMode="url" autoComplete="off" value={url} onChange={(e) => setUrl(e.target.value)}
          placeholder="brand.com or linkedin.com/company/brand" maxLength={300}
          className="min-h-[44px] min-w-0 flex-[1_1_260px] rounded-lg border px-3 text-[15px]" style={{ borderColor: 'var(--cb-line, rgba(26,26,26,0.15))' }} />
        <button type="submit" disabled={busy || !url.trim()} className="min-h-[44px] rounded-full px-5 text-[14px] font-bold disabled:opacity-50"
          style={{ background: 'var(--cb-ink, #1A1A1A)', color: 'var(--cb-paper, #fff)' }}>{busy ? 'Sending…' : 'Run scan'}</button>
      </form>
      {error && <p role="alert" className="mt-2 text-[14px]" style={{ color: '#9b1c1c' }}>{error}</p>}
      {rows.length > 0 && (
        <ul className="mt-4 divide-y" style={{ borderColor: 'var(--cb-line, rgba(26,26,26,0.15))' }}>
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-semibold" style={{ color: 'var(--cb-ink, #1A1A1A)' }}>{r.company_name || r.domain || r.input_url}</span>
                <span className="block text-[13px]" role={open(r) ? 'status' : undefined} style={{ color: 'var(--cb-ink-mute, #5A5752)' }}>{statusLine(r)}</span>
              </span>
              {r.status === 'ready' && r.scan_url && (
                <a href={r.scan_url} target="_blank" rel="noopener noreferrer" className="min-h-[44px] inline-flex items-center text-[14px] font-semibold underline">Open scan →</a>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

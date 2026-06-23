import React, { useMemo, useState } from 'react';
import { Mail, Download, Copy, Check } from 'lucide-react';
import PanelCard from '../../shared/PanelCard';
import EmptyState from '../../shared/EmptyState';
import type { OutreachProspect } from '../../../../types/dashboard';

// LinkedIn-active stages: these leads are already being worked on LinkedIn, so they stay OUT
// of the cold-email cohort. A lead is never touched on both channels (the dedup decision).
const LINKEDIN_ACTIVE = new Set(['connected', 'dm_sent', 'replied', 'engaged']);
const CSV_COLS = ['first_name', 'company_name', 'email', 'icebreaker', 'scan_link'] as const;

// Owner gate: the content_system offer trains on the buyer's own voice and runs their personal
// LinkedIn, so it only lands with the person who IS the brand — founder/owner/CEO/president, or a
// fractional exec who sells themselves. A VP of Sales or Director of Ops at a 50-person shop is the
// wrong target for a personal content engine, so they stay out of the cold-email CSV.
const OWNER_CORE = /\b(founder|co-?founder|owner|ceo|chief executive|managing partner|managing director|principal|proprietor)\b/i;
const VP = /\bvice president\b|\bvp\b|\bv\.p\.\b|\bevp\b|\bsvp\b/i;
const PRESIDENT = /\bpresident\b/i;
const FRACTIONAL = /\bfractional\b/i;
function isOwner(title: string | null): boolean {
  const t = title || '';
  if (OWNER_CORE.test(t) || FRACTIONAL.test(t)) return true;
  if (PRESIDENT.test(t) && !VP.test(t)) return true; // "President" yes, "Vice President" no
  return false;
}

interface Props {
  prospects: OutreachProspect[];
}

function csvEscape(v: string): string {
  return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}

export const EmailTab: React.FC<Props> = ({ prospects }) => {
  const [copied, setCopied] = useState(false);

  // Cold-email cohort: a work email, ICP-qualified, an owner/founder (the offer needs the person
  // whose voice gets trained), and not already active on LinkedIn.
  const cohort = useMemo(
    () => prospects
      .filter((p) => p.email && (p.icpScore ?? 0) >= 7 && isOwner(p.title) && !LINKEDIN_ACTIVE.has(p.stage) && !p.blacklisted)
      .sort((a, b) => (b.icpScore ?? 0) - (a.icpScore ?? 0)),
    [prospects],
  );

  const rows = useMemo(
    () => cohort.map((p) => ({
      first_name: (p.name || '').trim().split(/\s+/)[0] || '',
      company_name: p.company || '',
      email: p.email || '',
      icebreaker: '', // fills from the scan's dm_opener once the lead is scanned
      scan_link: '',  // fills with /scan/{slug} once the lead is scanned
    })),
    [cohort],
  );

  const download = () => {
    const lines = [CSV_COLS.join(',')];
    for (const r of rows) lines.push(CSV_COLS.map((c) => csvEscape(r[c])).join(','));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smartlead-cold-email-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyEmails = async () => {
    try {
      await navigator.clipboard.writeText(rows.map((r) => r.email).join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable */ }
  };

  const actions = (
    <div className="flex items-center gap-2">
      <button
        onClick={copyEmails}
        disabled={!rows.length}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border border-zinc-700 text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
      >
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        {copied ? 'Copied' : 'Copy emails'}
      </button>
      <button
        onClick={download}
        disabled={!rows.length}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40"
      >
        <Download className="w-3.5 h-3.5" /> Export CSV ({rows.length})
      </button>
    </div>
  );

  return (
    <div className="space-y-4">
      <PanelCard title="Cold email cohort" icon={<Mail className="w-4 h-4" />} headerRight={actions} accent="emerald">
        <div className="p-4 space-y-2">
          <p className="text-sm text-zinc-400 max-w-2xl leading-relaxed">
            ICP-qualified owners and founders with a work email, not already active on LinkedIn, so the
            same person never gets hit on both channels. Owner-gated because the offer trains on the
            buyer's own voice. Export the CSV and import it into Smartlead.
          </p>
          <p className="text-xs text-zinc-500">
            Columns: {CSV_COLS.join(', ')}. The icebreaker and scan_link fill in once a lead is scanned.
          </p>
        </div>
      </PanelCard>

      {rows.length === 0 ? (
        <EmptyState
          title="No emailable leads yet"
          description="Reveal work emails on the ICP pool to populate this list."
          icon={<Mail className="w-10 h-10" />}
        />
      ) : (
        <PanelCard title={`Ready to import (${cohort.length})`} scrollable>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-500 border-b border-zinc-800">
                  <th className="py-2 px-4 font-medium">Name</th>
                  <th className="py-2 px-4 font-medium">Title</th>
                  <th className="py-2 px-4 font-medium">Company</th>
                  <th className="py-2 px-4 font-medium">Email</th>
                  <th className="py-2 px-4 font-medium">ICP</th>
                  <th className="py-2 px-4 font-medium">Stage</th>
                </tr>
              </thead>
              <tbody>
                {cohort.slice(0, 300).map((p) => (
                  <tr key={p.id} className="border-b border-zinc-900/80 text-zinc-300">
                    <td className="py-2 px-4 whitespace-nowrap">{p.name}</td>
                    <td className="py-2 px-4 whitespace-nowrap text-xs text-zinc-400">{p.title || ''}</td>
                    <td className="py-2 px-4 whitespace-nowrap text-zinc-400">{p.company}</td>
                    <td className="py-2 px-4 whitespace-nowrap font-mono text-xs">{p.email}</td>
                    <td className="py-2 px-4 whitespace-nowrap text-xs text-zinc-500">{p.icpScore ?? ''}</td>
                    <td className="py-2 px-4 whitespace-nowrap text-xs text-zinc-500">{p.stage}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PanelCard>
      )}
    </div>
  );
};

export default EmailTab;

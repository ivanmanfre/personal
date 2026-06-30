// components/dashboard/outreach/HypertargetQueue.tsx
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

const REVIEW_HOOK = 'https://n8n.ivanmanfredi.com/webhook/hypertarget-review';
// Only actionable stages: rejected/failed are excluded to avoid clutter
const STAGES = ['asset_ready', 'approved', 'sent'] as const;

export default function HypertargetQueue() {
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase
      .from('hypertarget_corpus')
      .select('prospect_id, stage, company_slug, dm_text, failure_reason, built_at, outreach_prospects(name, company, profile_photo_url)')
      .in('stage', STAGES as unknown as string[])
      .order('built_at', { ascending: false });
    setRows(data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function act(prospect_id: string, action: 'approve' | 'reject', dm_text?: string) {
    setBusy(prospect_id);
    await fetch(REVIEW_HOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prospect_id, action, dm_text }),
    });
    await load();
    setBusy(null);
  }

  return (
    <div className="ht-queue">
      {rows.length === 0 && (
        <div style={{ padding: '2rem 0', color: 'var(--d-paper-dim)', fontSize: 13 }}>
          No hypertarget prospects in queue.
        </div>
      )}
      {rows.map(r => {
        const p = r.outreach_prospects || {};
        const url = r.company_slug ? `https://ivanmanfredi.com/scan/${r.company_slug}/` : null;
        return (
          <div key={r.prospect_id} className="ht-card" data-stage={r.stage}>
            <header>
              {p.profile_photo_url && (
                <img src={p.profile_photo_url} alt="" width={36} height={36} />
              )}
              <div>
                <strong>{p.name}</strong>
                <span>{p.company}</span>
              </div>
              <span className="ht-stage">{r.stage}</span>
            </header>
            {url && (
              <a href={url} target="_blank" rel="noreferrer">
                Preview scan ↗
              </a>
            )}
            {r.failure_reason && (
              <p className="ht-fail">Failed: {r.failure_reason}</p>
            )}
            <textarea defaultValue={r.dm_text ?? ''} id={`dm-${r.prospect_id}`} rows={4} />
            {r.stage === 'asset_ready' && (
              <div className="ht-actions">
                <button
                  disabled={busy === r.prospect_id}
                  onClick={() =>
                    act(
                      r.prospect_id,
                      'approve',
                      (document.getElementById(`dm-${r.prospect_id}`) as HTMLTextAreaElement)?.value,
                    )
                  }
                >
                  Approve &amp; send
                </button>
                <button
                  disabled={busy === r.prospect_id}
                  onClick={() => act(r.prospect_id, 'reject')}
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

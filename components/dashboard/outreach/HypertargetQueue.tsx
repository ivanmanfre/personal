// components/dashboard/outreach/HypertargetQueue.tsx
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

const REVIEW_HOOK = 'https://n8n.ivanmanfredi.com/webhook/hypertarget-review';
// Only actionable stages: rejected/failed are excluded to avoid clutter
const STAGES = ['asset_ready', 'approved', 'sent'] as const;

type OpenStat = { real_opens: number; last_real_open: string | null };

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default function HypertargetQueue() {
  const [rows, setRows] = useState<any[]>([]);
  const [opens, setOpens] = useState<Record<string, OpenStat>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase
      .from('hypertarget_corpus')
      .select('prospect_id, stage, company_slug, dm_text, failure_reason, built_at, outreach_prospects(name, company, profile_photo_url)')
      .in('stage', STAGES as unknown as string[])
      .order('built_at', { ascending: false });
    const list = data ?? [];
    setRows(list);

    // Pull real (non-owner) open counts for the visible slugs.
    const slugs = list.map((r: any) => r.company_slug).filter(Boolean);
    if (slugs.length) {
      const { data: stats } = await supabase
        .from('scan_open_stats')
        .select('company_slug, real_opens, last_real_open')
        .in('company_slug', slugs);
      const map: Record<string, OpenStat> = {};
      for (const s of stats ?? []) {
        map[s.company_slug] = { real_opens: s.real_opens, last_real_open: s.last_real_open };
      }
      setOpens(map);
    }
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
        // ?me=1 so opening from your own tooling never counts as a prospect open.
        const url = r.company_slug ? `https://ivanmanfredi.com/scan/${r.company_slug}/?me=1` : null;
        const stat = r.company_slug ? opens[r.company_slug] : undefined;
        const opened = !!stat && stat.real_opens > 0;
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
            {/* Open signal — only shown once the prospect (not you) has opened. */}
            {r.stage === 'sent' && (
              <div
                className="ht-open"
                title={opened ? `${stat!.real_opens} open${stat!.real_opens === 1 ? '' : 's'}` : 'No prospect opens yet'}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  fontSize: 12, margin: '2px 0 6px',
                  color: opened ? '#1F6FEB' : 'var(--d-paper-dim)',
                  fontWeight: opened ? 600 : 400,
                }}
              >
                <span>{opened ? '👁' : '○'}</span>
                {opened
                  ? <span>Opened{stat!.real_opens > 1 ? ` ×${stat!.real_opens}` : ''} · {timeAgo(stat!.last_real_open)}</span>
                  : <span>Not opened yet</span>}
              </div>
            )}
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

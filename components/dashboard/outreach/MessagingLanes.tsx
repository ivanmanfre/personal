import React, { useMemo, useState } from 'react';
import type { OutreachProspect } from '../../../types/dashboard';

// ── Messaging lanes — which connection note goes to whom ────────────────────
// Ivan kept losing track of which note copy each lane sends (2026-07-13).
// This card derives the answer from the DATA, not from a hardcoded copy of the
// templates: it classifies every sent connection note by its live fingerprint,
// shows the most recent real note text per lane, and the accept tally.
// Lane labels are fingerprints of stable template phrases; the sample text
// shown underneath is always the actual latest note stored on a prospect, so
// copy edits in n8n surface here on the next send without a dashboard change.

interface LaneRow {
  key: string;
  label: string;
  detail: string;
  sent: number;
  accepted: number;
  lastSentAt: string;
  sample: string;
  campaigns: Set<string>;
  abBadge?: 'A' | 'control';
}

const LANE_ORDER = ['kyle', 'anchor', 'wins_gift', 'agency_v2', 'gift', 'hiring', 'other'];

function laneOf(p: OutreachProspect): { key: string; label: string; detail: string; abBadge?: 'A' | 'control' } {
  const note = p.connectionNote || '';
  const variant = p.noteVariant || '';
  if (note.includes("saw you around Kyle Hunt's content")) {
    return { key: 'kyle', label: 'Kyle warm lane', detail: 'engaged Kyle’s posts · approved note' };
  }
  if (/saw you around .+'s content/.test(note)) {
    return { key: 'anchor', label: 'Anchor warm lane', detail: 'engaged an anchor creator’s posts' };
  }
  if (variant === 'wins_gift') {
    return { key: 'wins_gift', label: 'Wins gift note', detail: 'A/B arm A · promises the 3 wins', abBadge: 'A' };
  }
  if (note.startsWith('Hi') && note.includes('working with solo consultants and small agencies')) {
    return {
      key: 'agency_v2', label: 'Agency consultants · locked v2', detail: 'tribal-identity note, locked 05-17',
      abBadge: variant.endsWith('_ctl') ? 'control' : undefined,
    };
  }
  if (p.triggerType === 'hiring' && p.triggerHook && note === p.triggerHook.trim()) {
    return { key: 'hiring', label: 'Hiring intercept', detail: 'per-prospect hook as the note' };
  }
  if (/^gift_v\d/.test(variant)) {
    return {
      key: 'gift', label: 'Cold gift v1/v2/v3', detail: 'round-robin cold templates',
      abBadge: variant.endsWith('_ctl') ? 'control' : undefined,
    };
  }
  return { key: 'other', label: 'Other / legacy', detail: 'pre-template or manual sends' };
}

const card: React.CSSProperties = {
  background: 'var(--ds-card, #fff)',
  border: '1px solid var(--ds-line, #e9e9ee)',
  boxShadow: 'var(--ds-shadow-card, 0 1px 2px rgba(15,23,42,.04),0 10px 26px -18px rgba(15,23,42,.18))',
};

const daysAgo = (iso: string) => {
  if (!iso) return '';
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return d === 0 ? 'today' : d === 1 ? '1d ago' : `${d}d ago`;
};

export const MessagingLanes: React.FC<{ prospects: OutreachProspect[] }> = ({ prospects }) => {
  const [openKey, setOpenKey] = useState<string | null>(null);

  const lanes = useMemo(() => {
    const map = new Map<string, LaneRow>();
    for (const p of prospects) {
      if (!p.connectionSentAt || !p.connectionNote) continue;
      const lane = laneOf(p);
      // A/B arms tally separately inside the same visual row via abBadge split below;
      // here each (lane, badge) pair gets its own bucket so counts stay honest.
      const key = lane.abBadge ? `${lane.key}:${lane.abBadge}` : lane.key;
      let row = map.get(key);
      if (!row) {
        row = { ...lane, key, sent: 0, accepted: 0, lastSentAt: '', sample: '', campaigns: new Set() };
        map.set(key, row);
      }
      row.sent += 1;
      if (p.connectedAt) row.accepted += 1;
      if (p.campaignName) row.campaigns.add(p.campaignName);
      if (p.connectionSentAt > row.lastSentAt) {
        row.lastSentAt = p.connectionSentAt;
        row.sample = p.connectionNote;
      }
    }
    return [...map.values()].sort((a, b) => {
      const ai = LANE_ORDER.indexOf(a.key.split(':')[0]);
      const bi = LANE_ORDER.indexOf(b.key.split(':')[0]);
      return ai - bi || String(b.lastSentAt).localeCompare(String(a.lastSentAt));
    });
  }, [prospects]);

  if (lanes.length === 0) return null;

  return (
    <div className="rounded-xl p-3.5" style={card}>
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <span className="text-[11px] uppercase tracking-wider font-medium" style={{ color: 'var(--ds-dim, #475569)' }}>
          Connection notes — who gets which copy
        </span>
        <span className="text-[10px]" style={{ color: 'var(--ds-faint, #64748b)' }}>
          live from sent prospects · click a lane to read its latest real note
        </span>
      </div>
      <div className="divide-y" style={{ borderColor: 'var(--ds-line, #e9e9ee)' }}>
        {lanes.map((l) => {
          const rate = l.sent > 0 ? Math.round((l.accepted / l.sent) * 100) : 0;
          const open = openKey === l.key;
          return (
            <div key={l.key} className="py-2">
              <button
                type="button"
                onClick={() => setOpenKey(open ? null : l.key)}
                className="w-full flex items-center gap-2 text-left"
              >
                <span className="text-[12px] font-semibold shrink-0" style={{ color: 'var(--ds-ink, #0f172a)' }}>{l.label}</span>
                {l.abBadge && (
                  <span
                    className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
                    style={l.abBadge === 'A'
                      ? { background: '#eef2ff', color: '#4338ca' }
                      : { background: 'var(--ds-bg, #f6f7f9)', color: 'var(--ds-dim, #475569)' }}
                  >
                    {l.abBadge === 'A' ? 'A/B · wins arm' : 'A/B · control'}
                  </span>
                )}
                <span className="text-[10px] truncate" style={{ color: 'var(--ds-faint, #64748b)' }}>{l.detail}</span>
                <span className="ml-auto shrink-0 text-[11px] tabular-nums" style={{ color: 'var(--ds-dim, #475569)' }}>
                  {l.sent} sent · <span style={{ color: rate >= 15 ? '#047857' : 'var(--ds-ink, #0f172a)' }}>{l.accepted} accepted ({rate}%)</span>
                </span>
                <span className="shrink-0 text-[10px] w-14 text-right" style={{ color: 'var(--ds-faint, #64748b)' }}>{daysAgo(l.lastSentAt)}</span>
              </button>
              {open && (
                <div className="mt-2 rounded-lg px-3 py-2" style={{ background: 'var(--ds-bg, #f6f7f9)', border: '1px solid var(--ds-line, #e9e9ee)' }}>
                  <p className="text-[12px] leading-relaxed" style={{ color: 'var(--ds-ink, #0f172a)' }}>{l.sample}</p>
                  {l.campaigns.size > 0 && (
                    <p className="text-[10px] mt-1.5" style={{ color: 'var(--ds-faint, #64748b)' }}>
                      campaigns: {[...l.campaigns].join(' · ')}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[10px] mt-2 leading-relaxed" style={{ color: 'var(--ds-faint, #64748b)' }}>
        After an accept: 12h cool-off, then DM1 on the next run inside 6am–8pm NY, weekdays, 5 per run.
        DM1 carries the prospect’s 3 pre-built wins when they exist (Kyle lane keeps its own approved opener); otherwise the static lane opener.
      </p>
    </div>
  );
};

export default MessagingLanes;

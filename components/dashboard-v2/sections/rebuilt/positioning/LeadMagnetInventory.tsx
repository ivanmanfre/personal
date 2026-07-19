import React, { useState } from 'react';
import { ExternalLink, Pencil } from 'lucide-react';
import { StatusCue } from './shared';
import { supabase } from '../../../../../lib/supabase';
import type { StrategyLeadMagnetRow } from '../../../../../types/dashboard';

interface Props {
  leadMagnets: StrategyLeadMagnetRow[];
  campaignsWithoutLM: string[];
}

type SortKey = 'demand' | 'status' | 'title';

/**
 * Lead Magnet Inventory — a demand-sorted heat table. Rows sort by demand
 * (default), each demand cell carries an ink magnitude bar so the table reads as
 * a heat ranking, not a flat grid. Status is a non-hue lifecycle cue (5 states).
 * The gap warning is THE BOX (the one tilted human move on the page) because a
 * campaign with no mapped LM is a genuine outreach-blocking danger state.
 * Survives: sort select, show-all, open-page link, edit pencil (ledger 8-11).
 */
export const LeadMagnetInventory: React.FC<Props> = ({ leadMagnets, campaignsWithoutLM }) => {
  const [sortKey, setSortKey] = useState<SortKey>('demand');
  const [showAll, setShowAll] = useState(false);
  const [editToken, setEditToken] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  // Read-only token reveal for the inline LM editor (reused pattern; no DB write).
  async function openEditor(lm: StrategyLeadMagnetRow) {
    if (!lm.resourcePageUrl) return;
    setEditingId(lm.id);
    setEditError(null);
    try {
      let token = editToken;
      if (!token) {
        const { data, error } = await supabase.functions.invoke('lm-edit-token-reveal', { body: {} });
        if (error) throw error;
        token = (data as { token?: string } | null)?.token || null;
        if (!token) throw new Error('no token returned');
        setEditToken(token);
      }
      const sep = lm.resourcePageUrl.includes('?') ? '&' : '?';
      window.open(`${lm.resourcePageUrl}${sep}edit=${encodeURIComponent(token)}`, '_blank', 'noopener,noreferrer');
    } catch (e: any) {
      setEditError(e?.message || 'failed');
      setTimeout(() => setEditError(null), 4000);
    } finally {
      setEditingId(null);
    }
  }

  const sorted = [...leadMagnets].sort((a, b) => {
    if (sortKey === 'demand') return b.demand - a.demand;
    if (sortKey === 'status') return a.status.localeCompare(b.status);
    return a.title.localeCompare(b.title);
  });
  const visible = showAll ? sorted : sorted.slice(0, 12);
  const maxDemand = Math.max(...leadMagnets.map((l) => l.demand), 1);
  const plannedCount = leadMagnets.filter((l) => l.isPlanned).length;
  const liveCount = leadMagnets.filter(
    (l) => l.status === 'scheduled' || l.status === 'live' || l.status === 'published',
  ).length;

  return (
    <section className="pos-sec">
      <div className="pos-sec-head">
        <h2 className="pos-sec-title">Lead Magnet Inventory</h2>
        <span className="pos-sec-meta">Sorted by demand</span>
      </div>

      {/* Gap warning — THE BOX, the single tilted human move on the page. */}
      {campaignsWithoutLM.length > 0 && (
        <div className="ec-box ec-box--tilt" style={{ marginBottom: '1.2rem' }}>
          <div className="ec-box-head">
            Warning: <span className="ec-red" style={{ margin: '0 0.3rem' }}>{campaignsWithoutLM.length}</span>
            active campaign{campaignsWithoutLM.length > 1 ? 's' : ''} without a matched lead magnet
          </div>
          <p className="ec-note" style={{ marginTop: '0.5rem' }}>{campaignsWithoutLM.join(' · ')}</p>
          <p className="ec-data" style={{ marginTop: '0.4rem' }}>
            Outreach Email 1 SKIPS for prospects in these campaigns until a resource is mapped.
          </p>
        </div>
      )}

      <div className="pos-lm-sum">
        <span><b>{leadMagnets.length}</b> total</span>
        <span className="pos-sep">·</span>
        <span><b>{liveCount}</b> live / scheduled</span>
        <span className="pos-sep">·</span>
        <span><b>{plannedCount}</b> planned</span>
        <span className="pos-spacer" />
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <span>sort</span>
          <select
            className="pos-select"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
          >
            <option value="demand">Demand</option>
            <option value="status">Status</option>
            <option value="title">Title</option>
          </select>
        </label>
      </div>

      <div className="pos-tablewrap">
        <table className="pos-lm">
          <thead>
            <tr>
              <th>Title</th>
              <th>Format</th>
              <th>Status</th>
              <th>Mapped campaigns</th>
              <th className="pos-r">Demand</th>
              <th className="pos-r">Updated</th>
              <th className="pos-c" />
              <th className="pos-c" />
            </tr>
          </thead>
          <tbody>
            {visible.map((lm) => (
              <tr key={lm.id} className={lm.isPlanned ? 'pos-lm--planned' : ''}>
                <td className="pos-lm-title" title={lm.title}>{lm.title}</td>
                <td>{lm.format}</td>
                <td><StatusCue status={lm.status} /></td>
                <td className={lm.mappedCampaigns.length > 0 ? 'pos-lm-mapped' : ''} title={lm.mappedCampaigns.join(', ')}>
                  {lm.mappedCampaigns.length > 0 ? lm.mappedCampaigns.join(', ') : <span className="pos-lm-unmapped">unmapped</span>}
                </td>
                <td className="pos-r">
                  <span className="pos-demand">
                    {lm.demand > 0 && (
                      <span className="pos-demand-track">
                        <span className="pos-demand-bar" style={{ width: `${Math.round((lm.demand / maxDemand) * 100)}%` }} />
                      </span>
                    )}
                    <span className={`pos-demand-n ${lm.demand > 0 ? '' : 'pos-demand-n--zero'}`}>{lm.demand}</span>
                  </span>
                </td>
                <td className="pos-r pos-lm-updated">
                  {lm.lastUpdated ? new Date(lm.lastUpdated).toISOString().slice(0, 10) : '-'}
                </td>
                <td className="pos-c">
                  {lm.resourcePageUrl && (
                    <a href={lm.resourcePageUrl} target="_blank" rel="noopener noreferrer" className="pos-iconbtn" title="Open LM page">
                      <ExternalLink size={13} />
                    </a>
                  )}
                </td>
                <td className="pos-c">
                  {lm.resourcePageUrl && (
                    <button
                      type="button"
                      className="pos-iconbtn"
                      onClick={() => openEditor(lm)}
                      disabled={editingId === lm.id}
                      title="Edit copy inline"
                    >
                      <Pencil size={13} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!showAll && sorted.length > 12 && (
        <button type="button" className="pos-accordion-btn" onClick={() => setShowAll(true)}>
          Show all {sorted.length}
        </button>
      )}
      {editError && <p className="pos-error">Edit token reveal failed: {editError}</p>}
    </section>
  );
};

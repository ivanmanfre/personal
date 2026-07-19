import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { navigateToSection } from './shared';
import type { StrategyCampaignSummary } from '../../../../../types/dashboard';

interface Props {
  campaigns: StrategyCampaignSummary[];
  campaignsWithoutLM: string[];
}

const FOUNDER_TITLE_RX = /\b(founder|owner|managing partner|managing director|principal|partner|ceo|creative director|design principal)\b/i;
const OPERATOR_TITLE_RX = /\b(coo|chief operating officer|head of operations|director of operations|vp of operations|vp operations)\b/i;
function detectPersonas(titles: string[]) {
  return {
    founder: titles.some((t) => FOUNDER_TITLE_RX.test(t)),
    operator: titles.some((t) => OPERATOR_TITLE_RX.test(t)),
  };
}

/**
 * ICP & Active Campaigns — a compact register with per-campaign stage counts.
 * Health is DERIVED from data (ledger note: the v1 active.length===5 hardcode is
 * a soft assumption). Real health = whether every active campaign has a mapped
 * lead magnet: any gap is the genuine danger signal (red), else the roster is ok.
 * Survives: campaign expand, "outreach ->" nav, deactivated accordion (5-7).
 */
export const IcpCampaigns: React.FC<Props> = ({ campaigns, campaignsWithoutLM }) => {
  const active = campaigns.filter((c) => c.isActive);
  const inactive = campaigns.filter((c) => !c.isActive);
  const gaps = campaignsWithoutLM.length;
  // Data-derived health: gaps outstanding = danger, none but zero active = warn.
  const health: 'ok' | 'warn' | 'bad' = gaps > 0 ? 'bad' : active.length === 0 ? 'warn' : 'ok';

  return (
    <section className="pos-sec">
      <div className="pos-sec-head">
        <h2 className="pos-sec-title">ICP &amp; Active Campaigns</h2>
        <span className="pos-sec-meta">{active.length} live</span>
      </div>

      <div className="pos-icp-sum">
        <span className={`pos-icp-dot pos-icp-dot--${health}`} />
        <span><b>{active.length}</b> active</span>
        <span className="pos-sep">·</span>
        <span>{inactive.length} deactivated</span>
        {gaps > 0 && (
          <>
            <span className="pos-sep">·</span>
            <span className="pos-icp-bad">{gaps} without lead magnet</span>
          </>
        )}
      </div>

      <div className="pos-reg">
        {active.map((c) => (
          <CampaignRow
            key={c.id}
            campaign={c}
            missingLM={campaignsWithoutLM.includes(c.name)}
          />
        ))}
      </div>

      {inactive.length > 0 && <DeactivatedAccordion campaigns={inactive} />}
    </section>
  );
};

const STAGES: { key: keyof StrategyCampaignSummary['prospectCounts']; label: string }[] = [
  { key: 'enriched', label: 'enrich' },
  { key: 'warming', label: 'warm' },
  { key: 'engaged', label: 'engage' },
  { key: 'connected', label: 'conn' },
  { key: 'replied', label: 'reply' },
];

const CampaignRow: React.FC<{ campaign: StrategyCampaignSummary; missingLM: boolean }> = ({ campaign: c, missingLM }) => {
  const [expanded, setExpanded] = useState(false);
  const personas = detectPersonas(c.apolloTitles);
  return (
    <div className={`pos-camp ${missingLM ? 'pos-camp--gap' : ''}`}>
      <div className="pos-camp-head">
        <button type="button" className="pos-camp-tw" onClick={() => setExpanded((e) => !e)} aria-expanded={expanded}>
          <span className="pos-camp-chev">{expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</span>
          <span className="pos-camp-name">{c.name}</span>
        </button>
        {missingLM && <span className="pos-persona pos-nolm">no LM</span>}
        {personas.founder && <span className="pos-persona" title="Apollo titles target founder / owner / partner level">founder</span>}
        {personas.operator && <span className="pos-persona" title="Apollo titles also target COO / head of ops">operator</span>}
        <div className="pos-stages">
          {STAGES.map((s) => {
            const n = c.prospectCounts[s.key] as number;
            return (
              <div className="pos-stage" key={s.key} title={`${s.label}: ${n}`}>
                <span className={`pos-stage-n ${n > 0 ? '' : 'pos-stage-n--zero'}`}>{n}</span>
                <span className="pos-stage-l">{s.label}</span>
              </div>
            );
          })}
          <button type="button" className="pos-outreach" onClick={() => navigateToSection('outreach')}>
            outreach &rarr;
          </button>
        </div>
      </div>
      {expanded && (
        <div className="pos-camp-detail">
          <div><b>Titles:</b> {c.apolloTitles.join(', ') || '-'}</div>
          <div><b>Locations:</b> {c.apolloLocations.join(', ') || '-'}</div>
          <div><b>Sizes:</b> {c.apolloEmployeeRanges.join(', ') || '-'}</div>
          <div><b>Keywords:</b> {c.apolloKeywords.join(', ') || '-'}</div>
        </div>
      )}
    </div>
  );
};

const DeactivatedAccordion: React.FC<{ campaigns: StrategyCampaignSummary[] }> = ({ campaigns }) => {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" className="pos-accordion-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        Deactivated ({campaigns.length})
      </button>
      {open && (
        <div style={{ marginTop: '0.4rem' }}>
          {campaigns.map((c) => (
            <div className="pos-dead" key={c.id}>
              <b>{c.name}</b> ({c.prospectCounts.archived} archived)
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

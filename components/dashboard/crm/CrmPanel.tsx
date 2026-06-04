import React, { useState, useMemo } from 'react';
import './crm.css';
import { useContacts } from '../../../hooks/useContacts';
import { ContactRecord } from './ContactRecord';
import { PIPELINE, stageMeta, initials, avatarColor, relTime, TODAY } from './crmUtils';
import {
  SectionLabel, Funnel, FunnelSeg, RowList, Row, ClientRow, BtnGhost, Marginalia,
} from '../../dashboard-v2/primitives';

const ACTIVE = new Set(['engaged', 'qualified', 'call_booked', 'proposal_sent', 'negotiating']);
const FVAR: Record<string, 'win' | 'warm' | 'cold'> = {
  new: 'cold', engaged: 'warm', qualified: 'warm', call_booked: 'warm',
  proposal_sent: 'warm', negotiating: 'warm', won: 'win',
};
const fflex = (n: number) => Math.max(0.7, Math.log10((n || 0) + 1) + 0.35);

function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  return <span className="crm-av" style={{ background: avatarColor(name), width: size, height: size }}>{initials(name)}</span>;
}
function StageChip({ stage }: { stage: string }) {
  const m = stageMeta(stage);
  return <span className="dv-chip" style={{ color: m.c, background: m.bg }}>{m.label}</span>;
}
function Icp({ v }: { v: number | null }) {
  if (v == null) return <span className="crm-dim">—</span>;
  const hi = v >= 7;
  return <span className="crm-icp" style={{ color: hi ? 'var(--d-good)' : v >= 4 ? 'var(--d-paper)' : 'var(--d-paper-dimmer)', background: hi ? 'var(--d-good-bg)' : 'transparent' }}>{v}</span>;
}

type SortKey = 'name' | 'icp' | 'activity';

export default function CrmPanel() {
  const { contacts, pending, loading, resolving, resolveNow, updateField, setStage, reviewLink, stageCounts, refetch } = useContacts();
  const [selected, setSelected] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState('all');
  const [icpBand, setIcpBand] = useState('all');
  const [overdue, setOverdue] = useState(false);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<SortKey>('activity');
  const today = TODAY();

  const rows = useMemo(() => {
    const r = contacts.filter(c =>
      (stageFilter === 'all' || c.stage === stageFilter) &&
      (icpBand === 'all'
        || (icpBand === 'high' && (c.icpScore ?? 0) >= 7)
        || (icpBand === 'med' && (c.icpScore ?? -1) >= 4 && (c.icpScore ?? 99) <= 6)
        || (icpBand === 'low' && (c.icpScore ?? 99) <= 3)) &&
      (!overdue || (c.nextActionDue != null && c.nextActionDue <= today)) &&
      (!q || `${c.name} ${c.company ?? ''} ${c.email ?? ''}`.toLowerCase().includes(q.toLowerCase()))
    );
    return [...r].sort((a, b) =>
      sort === 'name' ? a.name.localeCompare(b.name)
        : sort === 'icp' ? (b.icpScore ?? -1) - (a.icpScore ?? -1)
          : (b.lastActivityAt || '').localeCompare(a.lastActivityAt || ''));
  }, [contacts, stageFilter, icpBand, overdue, q, sort, today]);

  const todayList = useMemo(() =>
    contacts.filter(c => c.nextActionDue != null && c.nextActionDue <= today)
      .sort((a, b) => (a.nextActionDue || '').localeCompare(b.nextActionDue || '')).slice(0, 5),
    [contacts, today]);
  const hasOverdue = todayList.some(c => c.nextActionDue! < today);

  const hotList = useMemo(() =>
    contacts.filter(c => (c.icpScore ?? 0) >= 7 && ACTIVE.has(c.stage))
      .sort((a, b) => (b.icpScore ?? 0) - (a.icpScore ?? 0) || (b.lastActivityAt || '').localeCompare(a.lastActivityAt || ''))
      .slice(0, 5),
    [contacts]);

  const sel = selected ? contacts.find(c => c.id === selected) || null : null;
  const nameOf = (id: string) => contacts.find(c => c.id === id)?.name ?? id.slice(0, 8);
  const sortArrow = (k: SortKey) => (sort === k ? ' ↓' : '');
  const activeTotal = ['engaged', 'qualified', 'call_booked', 'proposal_sent', 'negotiating'].reduce((n, s) => n + (stageCounts[s] || 0), 0);

  return (
    <div className="crm-root">
      {/* pipeline */}
      <SectionLabel label="Pipeline" count={activeTotal}
        hint={`${(stageCounts.nurture || 0).toLocaleString()} nurture · ${stageCounts.lost || 0} lost`} />
      <Funnel>
        {PIPELINE.map(s => (
          <FunnelSeg key={s} label={stageMeta(s).label} value={stageCounts[s] || 0}
            flex={fflex(stageCounts[s] || 0)} variant={(stageCounts[s] || 0) === 0 ? 'cold' : FVAR[s]}
            onClick={() => setStageFilter(stageFilter === s ? 'all' : s)} />
        ))}
      </Funnel>

      {/* attention — two columns when there are due actions, else hot leads full-width */}
      {(() => {
        const hot = hotList.length === 0
          ? <Marginalia>No active high-ICP leads yet.</Marginalia>
          : <RowList>{hotList.map(c => (
            <ClientRow key={c.id} name={c.name} status={c.company || '—'} severity="good"
              action={c.icpScore != null ? `ICP ${c.icpScore}` : ''} onClick={() => setSelected(c.id)} />
          ))}</RowList>;
        if (todayList.length === 0) {
          return (
            <div style={{ marginBottom: 'var(--sp-6)' }}>
              <SectionLabel label="Hot leads" count={hotList.length}
                hint={<span style={{ color: 'var(--d-good)' }}>✓ nothing due today</span>} />
              {hot}
            </div>
          );
        }
        return (
          <div className="crm-cols2">
            <div>
              <SectionLabel label="Needs you" count={todayList.length} alert={hasOverdue} />
              <RowList>{todayList.map(c => {
                const od = c.nextActionDue! < today;
                return <Row key={c.id} date={od ? 'OVERDUE' : 'TODAY'} variant={od ? 'failed' : 'amber'}
                  name={c.name} meta={c.nextAction || 'follow up'} onClick={() => setSelected(c.id)} />;
              })}</RowList>
            </div>
            <div>
              <SectionLabel label="Hot leads" count={hotList.length} />
              {hot}
            </div>
          </div>
        );
      })()}

      {/* review queue */}
      {pending.length > 0 && (
        <div style={{ marginBottom: 'var(--sp-6)' }}>
          <SectionLabel label="Matches to review" count={pending.length} alert />
          <RowList>
            {pending.slice(0, 6).map(l => {
              const label = (l.sourceRef as any)?.participant ? `Meeting attendee “${(l.sourceRef as any).participant}”` : l.sourceType;
              return (
                <Row key={l.id} date="LINK" variant="amber" name={<>{label} → <strong style={{ color: 'var(--d-paper)' }}>{nameOf(l.contactId)}</strong></>}
                  trailing={<span style={{ display: 'flex', gap: '0.4rem', marginLeft: 'auto' }}>
                    <BtnGhost variant="good" onClick={() => reviewLink(l.id, 'confirm')}>Confirm</BtnGhost>
                    <BtnGhost variant="bad" onClick={() => reviewLink(l.id, 'reject')}>Reject</BtnGhost>
                  </span>} />
              );
            })}
          </RowList>
        </div>
      )}

      {/* contacts */}
      <SectionLabel label="Contacts" count={rows.length} />
      <div className="crm-bar">
        <input className="crm-search" placeholder="Search name, company, email…" value={q} onChange={e => setQ(e.target.value)} />
        <select className="crm-sel" value={stageFilter} onChange={e => setStageFilter(e.target.value)}>
          <option value="all">All stages</option>
          {['new', 'engaged', 'qualified', 'call_booked', 'proposal_sent', 'negotiating', 'won', 'lost', 'nurture'].map(s =>
            <option key={s} value={s}>{stageMeta(s).label} ({stageCounts[s] || 0})</option>)}
        </select>
        <select className="crm-sel" value={icpBand} onChange={e => setIcpBand(e.target.value)}>
          <option value="all">All ICP</option><option value="high">High ≥7</option>
          <option value="med">Med 4–6</option><option value="low">Low ≤3</option>
        </select>
        <label className="crm-toggle"><input type="checkbox" checked={overdue} onChange={e => setOverdue(e.target.checked)} /> Overdue</label>
        <BtnGhost variant={resolving ? 'dim' : 'default'} onClick={resolving ? undefined : resolveNow}>{resolving ? 'Resolving…' : 'Resolve now'}</BtnGhost>
      </div>

      <div className="crm-list">
        <div className="crm-chead">
          <span />
          <span className="sortable" onClick={() => setSort('name')}>Contact{sortArrow('name')}</span>
          <span>Stage</span>
          <span className="sortable r" onClick={() => setSort('icp')}>ICP{sortArrow('icp')}</span>
          <span className="sortable r crm-col-last" onClick={() => setSort('activity')}>Last{sortArrow('activity')}</span>
          <span className="crm-col-next">Next action</span>
        </div>
        {loading && <div className="crm-more">Loading…</div>}
        {!loading && rows.length === 0 && <div className="crm-more">No contacts match.</div>}
        {rows.slice(0, 300).map(c => {
          const od = c.nextActionDue != null && c.nextActionDue <= today;
          return (
            <div className="crm-crow" key={c.id} data-sel={selected === c.id} onClick={() => setSelected(c.id)}>
              <Avatar name={c.name} />
              <div style={{ minWidth: 0 }}>
                <div className="crm-name">{c.name}</div>
                <div className="crm-co">{c.company || '—'}</div>
              </div>
              <StageChip stage={c.stage} />
              <div className="crm-r"><Icp v={c.icpScore} /></div>
              <div className="crm-r crm-mono crm-col-last">{relTime(c.lastActivityAt)}</div>
              <div className="crm-col-next">
                {c.nextAction
                  ? <span className={`crm-na ${od ? 'over' : ''}`}>{c.nextAction}{c.nextActionDue ? ` · ${c.nextActionDue}` : ''}</span>
                  : <span className="crm-dim">—</span>}
              </div>
            </div>
          );
        })}
        {rows.length > 300 && <div className="crm-more">Showing first 300 of {rows.length.toLocaleString()} — refine filters to narrow.</div>}
      </div>

      {/* slide-over */}
      {sel && (
        <>
          <div className="crm-scrim" onClick={() => setSelected(null)} />
          <div className="crm-over" role="dialog" aria-modal="true">
            <ContactRecord contact={sel} onClose={() => setSelected(null)}
              onChangeField={(f, v) => updateField(sel.id, f, v)}
              onSetStage={(v) => setStage(sel.id, v)} onChanged={refetch} />
          </div>
        </>
      )}
    </div>
  );
}

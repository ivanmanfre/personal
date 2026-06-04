import React, { useState, useMemo } from 'react';
import './crm.css';
import { useContacts } from '../../../hooks/useContacts';
import { ContactRecord } from './ContactRecord';
import { PIPELINE, ALL_STAGES, stageMeta, initials, avatarColor, relTime, TODAY } from './crmUtils';

const ACTIVE = new Set(['engaged', 'qualified', 'call_booked', 'proposal_sent', 'negotiating']);

function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  return (
    <span className={size > 36 ? 'crm-av-lg' : 'crm-av'} style={{ background: avatarColor(name), width: size, height: size }}>
      {initials(name)}
    </span>
  );
}
function StageBadge({ stage }: { stage: string }) {
  const m = stageMeta(stage);
  return <span className="crm-badge" style={{ ['--c' as any]: m.c, ['--bg' as any]: m.bg }}><span className="dot" />{m.label}</span>;
}
function Icp({ v }: { v: number | null }) {
  if (v == null) return <span className="crm-dim">—</span>;
  const c = v >= 7 ? 'var(--d-good)' : v >= 4 ? 'var(--d-paper)' : 'var(--d-paper-dimmer)';
  const bg = v >= 7 ? 'var(--d-good-bg)' : 'transparent';
  return <span className="crm-icp" style={{ color: c, background: bg }}>{v}</span>;
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
    let r = contacts.filter(c =>
      (stageFilter === 'all' || c.stage === stageFilter) &&
      (icpBand === 'all'
        || (icpBand === 'high' && (c.icpScore ?? 0) >= 7)
        || (icpBand === 'med' && (c.icpScore ?? -1) >= 4 && (c.icpScore ?? 99) <= 6)
        || (icpBand === 'low' && (c.icpScore ?? 99) <= 3)) &&
      (!overdue || (c.nextActionDue != null && c.nextActionDue <= today)) &&
      (!q || `${c.name} ${c.company ?? ''} ${c.email ?? ''}`.toLowerCase().includes(q.toLowerCase()))
    );
    r = [...r].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'icp') return (b.icpScore ?? -1) - (a.icpScore ?? -1);
      return (b.lastActivityAt || '').localeCompare(a.lastActivityAt || '');
    });
    return r;
  }, [contacts, stageFilter, icpBand, overdue, q, sort, today]);

  const todayList = useMemo(() =>
    contacts.filter(c => c.nextActionDue != null && c.nextActionDue <= today)
      .sort((a, b) => (a.nextActionDue || '').localeCompare(b.nextActionDue || '')).slice(0, 6),
    [contacts, today]);

  const hotList = useMemo(() =>
    contacts.filter(c => (c.icpScore ?? 0) >= 7 && ACTIVE.has(c.stage))
      .sort((a, b) => (b.icpScore ?? 0) - (a.icpScore ?? 0) || (b.lastActivityAt || '').localeCompare(a.lastActivityAt || ''))
      .slice(0, 6),
    [contacts]);

  const sel = selected ? contacts.find(c => c.id === selected) || null : null;
  const nameOf = (id: string) => contacts.find(c => c.id === id)?.name ?? id.slice(0, 8);

  return (
    <div className="crm-root">
      <div className="crm-funnel">
        {PIPELINE.map((s, i) => {
          const m = stageMeta(s);
          return (
            <React.Fragment key={s}>
              <button className="crm-fstage" style={{ ['--fc' as any]: m.c }}
                data-active={stageFilter === s} onClick={() => setStageFilter(stageFilter === s ? 'all' : s)}>
                <div className="crm-fcount">{stageCounts[s] || 0}</div>
                <div className="crm-flabel">{m.label}</div>
              </button>
              {i < PIPELINE.length - 1 && <span className="crm-farrow">▸</span>}
            </React.Fragment>
          );
        })}
        <div className="crm-fside">
          {(['nurture', 'lost'] as const).map(s => {
            const m = stageMeta(s);
            return (
              <button key={s} className="crm-fstage" style={{ ['--fc' as any]: m.c }}
                data-active={stageFilter === s} onClick={() => setStageFilter(stageFilter === s ? 'all' : s)}>
                <div className="crm-fcount">{stageCounts[s] || 0}</div>
                <div className="crm-flabel">{m.label}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="crm-attn">
        <div className="crm-panel">
          <div className="crm-panel-h">⏰ Needs you <span className="n">{todayList.length}</span></div>
          {todayList.length === 0 && <div className="crm-empty">Nothing due — you're clear.</div>}
          {todayList.map(c => (
            <div key={c.id} className="crm-attn-row" onClick={() => setSelected(c.id)}>
              <Avatar name={c.name} size={22} />
              <span className="crm-attn-name">{c.name}</span>
              <span className="crm-attn-sub">{c.nextAction || 'follow up'}</span>
              <span className="crm-attn-due" style={{ color: c.nextActionDue! < today ? 'var(--d-bad)' : 'var(--d-warn)' }}>
                {c.nextActionDue! < today ? 'overdue' : 'today'}
              </span>
            </div>
          ))}
        </div>
        <div className="crm-panel">
          <div className="crm-panel-h">🔥 Hot leads <span className="n">{hotList.length}</span></div>
          {hotList.length === 0 && <div className="crm-empty">No active high-ICP leads yet.</div>}
          {hotList.map(c => (
            <div key={c.id} className="crm-attn-row" onClick={() => setSelected(c.id)}>
              <Avatar name={c.name} size={22} />
              <span className="crm-attn-name">{c.name}</span>
              <span className="crm-attn-sub">{c.company || '—'}</span>
              <span className="crm-attn-due" style={{ marginLeft: 'auto' }}><Icp v={c.icpScore} /></span>
            </div>
          ))}
        </div>
      </div>

      {pending.length > 0 && (
        <div className="crm-review">
          <div className="crm-review-h">{pending.length} match{pending.length > 1 ? 'es' : ''} need review</div>
          {pending.slice(0, 6).map(l => {
            const who = nameOf(l.contactId);
            const label = (l.sourceRef as any)?.participant ? `meeting attendee “${(l.sourceRef as any).participant}”` : l.sourceType;
            return (
              <div key={l.id} className="crm-review-row">
                <span style={{ flex: 1 }}>Link {label} → <b style={{ color: 'var(--d-paper)' }}>{who}</b>?</span>
                <button className="crm-link" onClick={() => reviewLink(l.id, 'confirm')}>Confirm</button>
                <button className="crm-link bad" onClick={() => reviewLink(l.id, 'reject')}>Reject</button>
              </div>
            );
          })}
        </div>
      )}

      <div className="crm-bar">
        <input className="crm-search" placeholder="Search name, company, email…" value={q} onChange={e => setQ(e.target.value)} />
        <select className="crm-sel" value={stageFilter} onChange={e => setStageFilter(e.target.value)}>
          <option value="all">All stages</option>
          {ALL_STAGES.map(s => <option key={s} value={s}>{stageMeta(s).label} ({stageCounts[s] || 0})</option>)}
        </select>
        <select className="crm-sel" value={icpBand} onChange={e => setIcpBand(e.target.value)}>
          <option value="all">All ICP</option>
          <option value="high">High ≥7</option>
          <option value="med">Med 4–6</option>
          <option value="low">Low ≤3</option>
        </select>
        <label className="crm-check"><input type="checkbox" checked={overdue} onChange={e => setOverdue(e.target.checked)} /> Overdue</label>
        <button className="crm-btn" onClick={resolveNow} disabled={resolving}>{resolving ? 'Resolving…' : 'Resolve now'}</button>
      </div>

      <table className="crm-table">
        <thead>
          <tr>
            <th onClick={() => setSort('name')}>Contact {sort === 'name' ? '↓' : ''}</th>
            <th>Stage</th>
            <th className="num" onClick={() => setSort('icp')}>ICP {sort === 'icp' ? '↓' : ''}</th>
            <th className="num col-hide" onClick={() => setSort('activity')}>Last {sort === 'activity' ? '↓' : ''}</th>
            <th className="col-hide">Next action</th>
          </tr>
        </thead>
        <tbody>
          {loading && <tr><td colSpan={5} style={{ color: 'var(--d-paper-dim)', padding: '1.4rem .7rem' }}>Loading…</td></tr>}
          {!loading && rows.length === 0 && <tr><td colSpan={5} style={{ color: 'var(--d-paper-dim)', padding: '1.4rem .7rem' }}>No contacts match.</td></tr>}
          {rows.slice(0, 300).map(c => {
            const over = c.nextActionDue != null && c.nextActionDue <= today;
            return (
              <tr key={c.id} data-sel={selected === c.id} onClick={() => setSelected(c.id)}>
                <td>
                  <div className="crm-id">
                    <Avatar name={c.name} />
                    <div><div className="crm-name">{c.name}</div><div className="crm-co">{c.company || '—'}</div></div>
                  </div>
                </td>
                <td><StageBadge stage={c.stage} /></td>
                <td className="crm-num"><Icp v={c.icpScore} /></td>
                <td className="crm-num crm-dim col-hide">{relTime(c.lastActivityAt)}</td>
                <td className="col-hide">
                  {c.nextAction
                    ? <span className={`crm-na ${over ? 'over' : ''}`}>{c.nextAction}{c.nextActionDue ? ` · ${c.nextActionDue}` : ''}</span>
                    : <span className="crm-dim">—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length > 300 && <div style={{ color: 'var(--d-paper-dimmer)', fontSize: 11.5, padding: '.6rem .7rem' }}>Showing first 300 of {rows.length}. Refine filters to narrow.</div>}

      {sel && (
        <>
          <div className="crm-scrim" onClick={() => setSelected(null)} />
          <div className="crm-over" role="dialog">
            <ContactRecord
              contact={sel}
              onClose={() => setSelected(null)}
              onChangeField={(f, v) => updateField(sel.id, f, v)}
              onSetStage={(v) => setStage(sel.id, v)}
              onChanged={refetch}
            />
          </div>
        </>
      )}
    </div>
  );
}

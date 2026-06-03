import React, { useState, useMemo } from 'react';
import { useContacts } from '../../../hooks/useContacts';
import { ReviewQueueStrip } from './ReviewQueueStrip';
import { ContactRecord } from './ContactRecord';

const STAGES = ['new','engaged','qualified','call_booked','proposal_sent','negotiating','won','lost','nurture'];

export default function CrmPanel() {
  const { contacts, pending, loading, resolving, resolveNow, updateField, setStage, reviewLink, stageCounts, refetch } = useContacts();
  const [selected, setSelected] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [icpFilter, setIcpFilter] = useState<string>('all');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [q, setQ] = useState('');

  const today = new Date().toISOString().slice(0,10);

  const rows = useMemo(() => contacts.filter(c =>
    (stageFilter==='all' || c.stage===stageFilter) &&
    (icpFilter==='all'
      || (icpFilter==='high' && c.icpScore!=null && c.icpScore>=7)
      || (icpFilter==='med'  && c.icpScore!=null && c.icpScore>=4 && c.icpScore<=6)
      || (icpFilter==='low'  && c.icpScore!=null && c.icpScore<=3)) &&
    (!overdueOnly || (c.nextActionDue!=null && c.nextActionDue<=today)) &&
    (!q || `${c.name} ${c.company ?? ''}`.toLowerCase().includes(q.toLowerCase()))
  ), [contacts, stageFilter, icpFilter, overdueOnly, today, q]);

  const todayContacts = useMemo(() =>
    contacts.filter(c => c.nextActionDue!=null && c.nextActionDue<=today),
  [contacts, today]);

  return (
    <div>
      <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:12 }}>
        <input placeholder="Search name / company" value={q} onChange={e=>setQ(e.target.value)}
               style={{ flex:1, padding:'6px 10px' }} />
        <select value={stageFilter} onChange={e=>setStageFilter(e.target.value)}>
          <option value="all">All stages</option>
          {STAGES.map(s => <option key={s} value={s}>{s} ({stageCounts[s]||0})</option>)}
        </select>
        <select value={icpFilter} onChange={e=>setIcpFilter(e.target.value)}>
          <option value="all">All ICP</option>
          <option value="high">High (≥7)</option>
          <option value="med">Med (4–6)</option>
          <option value="low">Low (≤3)</option>
        </select>
        <label style={{ fontSize:12, display:'flex', alignItems:'center', gap:4 }}>
          <input type="checkbox" checked={overdueOnly} onChange={e=>setOverdueOnly(e.target.checked)} />
          Overdue only
        </label>
        <button onClick={resolveNow} disabled={resolving}>{resolving?'Resolving…':'Resolve now'}</button>
      </div>
      <ReviewQueueStrip pending={pending} contacts={contacts} onReview={reviewLink} />
      {todayContacts.length > 0 && (
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, alignItems:'center', marginBottom:12 }}>
          <span style={{ fontSize:11, textTransform:'uppercase', opacity:.6 }}>Today</span>
          {todayContacts.map(c => (
            <button key={c.id} onClick={()=>setSelected(c.id)}
              style={{ fontSize:12, padding:'3px 10px', borderRadius:12, border:'1px solid #3a3a3a',
                       background:'var(--d-paper-2,#1c1c1c)', color:'#d8d8d8', cursor:'pointer' }}>
              {c.name}
            </button>
          ))}
        </div>
      )}
      <div style={{ display:'flex', gap:16 }}>
        <div style={{ flex:'0 0 42%', maxHeight:'70vh', overflow:'auto' }}>
          {loading ? <div style={{ opacity:.6 }}>Loading…</div> :
            rows.map(c => (
              <button key={c.id} onClick={()=>setSelected(c.id)}
                style={{ display:'block', width:'100%', textAlign:'left', padding:'8px 10px',
                         background: selected===c.id?'var(--d-paper-3,#262626)':'transparent',
                         border:'none', borderBottom:'1px solid #2a2a2a', cursor:'pointer' }}>
                <div style={{ fontWeight:600, fontSize:13 }}>{c.name}</div>
                <div style={{ fontSize:11, opacity:.7 }}>
                  {c.company || '—'} · {c.stage}{c.icpScore!=null?` · ICP ${c.icpScore}`:''}
                  {c.nextActionDue?` · due ${c.nextActionDue}`:''}
                </div>
              </button>
            ))}
          {!loading && !rows.length && <div style={{ opacity:.6 }}>No contacts.</div>}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          {selected
            ? <ContactRecord contactId={selected} stages={STAGES}
                onChangeField={(f,v)=>updateField(selected,f,v)}
                onSetStage={(v)=>setStage(selected, v)} onChanged={refetch} />
            : <div style={{ opacity:.5, padding:'2rem 0' }}>Select a contact.</div>}
        </div>
      </div>
    </div>
  );
}

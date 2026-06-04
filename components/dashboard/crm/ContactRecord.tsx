import React, { useState } from 'react';
import { useContact360 } from '../../../hooks/useContact360';
import { supabase } from '../../../lib/supabase';
import { toastError, toastSuccess } from '../../../lib/dashboardActions';
import type { Contact } from '../../../types/dashboard';

const ATTACHABLE = ['transcript','proposal_clickup','paid_assessment'] as const;

export function ContactRecord({ contactId, stages, onChangeField, onSetStage, onChanged }: {
  contactId: string; stages: string[];
  onChangeField: (field: keyof Contact, value: string) => void;
  onSetStage: (value: string) => void;
  onChanged: () => void;
}) {
  const { data, loading, refetch } = useContact360(contactId);
  const [attachType, setAttachType] = useState<typeof ATTACHABLE[number]>('proposal_clickup');
  const [attachId, setAttachId] = useState('');

  if (loading || !data) return <div style={{ opacity:.6, padding:'1rem 0' }}>Loading record…</div>;
  const c = data.contact;

  const attach = async () => {
    if (!attachId.trim()) return;
    try {
      const { error } = await supabase.from('contact_links').insert({
        contact_id: contactId, source_type: attachType, source_id: attachId.trim(),
        linked_by: 'manual', confidence: 'confirmed', review_status: 'active',
      });
      if (error) throw error;
      toastSuccess('Attached'); setAttachId(''); refetch(); onChanged();
    } catch (err) { toastError('attach source', err); }
  };

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
        <div>
          <div style={{ fontSize:18, fontWeight:700 }}>{c.name}</div>
          <div style={{ fontSize:12, opacity:.7 }}>
            {c.company || '—'}{c.icpScore!=null?` · ICP ${c.icpScore}`:''}
            {c.linkedinUrl && <> · <a href={c.linkedinUrl} target="_blank" rel="noreferrer">LinkedIn</a></>}
          </div>
        </div>
        <select value={c.stage} onChange={e=>onSetStage(e.target.value)}>
          {stages.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {c.stageSuggested && c.stageSuggested !== c.stage && (
        <div style={{ marginTop:8, fontSize:12, display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ opacity:.7 }}>Suggested: <strong>{c.stageSuggested}</strong></span>
          <button onClick={() => onSetStage(c.stageSuggested!)}>Apply</button>
          {c.stageManual && <span style={{ opacity:.5 }}>(stage set manually)</span>}
        </div>
      )}

      <div style={{ marginTop:12, display:'grid', gap:8 }}>
        <label style={{ fontSize:11, opacity:.7 }}>Next action
          <input defaultValue={c.nextAction ?? ''} onBlur={e=>onChangeField('nextAction', e.target.value)}
                 style={{ width:'100%', padding:'5px 8px' }} />
        </label>
        <label style={{ fontSize:11, opacity:.7 }}>Due
          <input type="date" defaultValue={c.nextActionDue ?? ''}
                 onBlur={e=>onChangeField('nextActionDue', e.target.value)} />
        </label>
        <label style={{ fontSize:11, opacity:.7 }}>Notes
          <textarea defaultValue={c.ownerNotes ?? ''} onBlur={e=>onChangeField('ownerNotes', e.target.value)}
                    rows={3} style={{ width:'100%', padding:'5px 8px' }} />
        </label>
      </div>

      <div style={{ marginTop:14 }}>
        <div style={{ fontSize:11, textTransform:'uppercase', opacity:.6 }}>Sources</div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:6 }}>
          {data.links.map(l => (
            <span key={l.id} style={{ fontSize:11, padding:'3px 8px', borderRadius:12,
                  background:'var(--d-paper-3,#262626)', color:'#d8d8d8' }}>{l.sourceType}</span>
          ))}
          {!data.links.length && <span style={{ fontSize:11, opacity:.5 }}>none</span>}
        </div>
        <div style={{ display:'flex', gap:6, marginTop:8 }}>
          <select value={attachType} onChange={e=>setAttachType(e.target.value as any)}>
            {ATTACHABLE.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input placeholder="source id (clickup task / stripe session / transcript id)"
                 value={attachId} onChange={e=>setAttachId(e.target.value)} style={{ flex:1, padding:'4px 8px' }} />
          <button onClick={attach}>+ Attach</button>
        </div>
      </div>

      <div style={{ marginTop:16 }}>
        <div style={{ fontSize:11, textTransform:'uppercase', opacity:.6, marginBottom:6 }}>Timeline</div>
        {data.timeline.map((e, i) => (
          <div key={i} style={{ display:'flex', gap:10, fontSize:12, padding:'5px 0', borderBottom:'1px solid #242424' }}>
            <span style={{ opacity:.5, flex:'0 0 130px' }}>{new Date(e.ts).toLocaleString()}</span>
            <span style={{ flex:'0 0 90px', opacity:.8 }}>{e.kind}</span>
            <span style={{ flex:1, minWidth:0, whiteSpace:'pre-wrap' }}>
              {e.kind==='dm' ? `${(e.data as any).direction}: ${(e.data as any).text ?? ''}` : JSON.stringify(e.data)}
            </span>
          </div>
        ))}
        {!data.timeline.length && <div style={{ opacity:.5, fontSize:12 }}>No activity yet.</div>}
      </div>
    </div>
  );
}

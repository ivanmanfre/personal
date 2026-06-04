import React, { useState } from 'react';
import { useContact360 } from '../../../hooks/useContact360';
import { supabase } from '../../../lib/supabase';
import { toastError, toastSuccess } from '../../../lib/dashboardActions';
import type { Contact, TimelineEvent } from '../../../types/dashboard';
import { ALL_STAGES, stageMeta, initials, avatarColor, relTime } from './crmUtils';

const ATTACHABLE = ['transcript', 'proposal_clickup', 'paid_assessment'] as const;

const EV: Record<string, { label: string; c: string }> = {
  dm:             { label: 'Message',    c: 'var(--d-accent)' },
  email:          { label: 'Email',      c: 'var(--d-good)' },
  meeting:        { label: 'Meeting',    c: 'var(--d-warn)' },
  outreach_added: { label: 'Outreach',   c: 'var(--d-paper-dimmer)' },
  lead_added:     { label: 'Lead',       c: 'var(--d-paper-dimmer)' },
  assessment:     { label: 'Assessment', c: 'var(--d-good)' },
};
const SRC_LABEL: Record<string, string> = {
  outreach_prospect: 'Outreach', lead: 'Lead', transcript: 'Meeting',
  paid_assessment: 'Assessment', proposal_clickup: 'Proposal', email_thread: 'Email',
};

function evBody(e: TimelineEvent): { text: string; out?: boolean } {
  const d = e.data as any;
  switch (e.kind) {
    case 'dm': return { text: `${d.direction === 'outbound' ? '→ ' : '← '}${d.text || ''}`, out: d.direction === 'outbound' };
    case 'email': return { text: d.subject || '(no subject)' };
    case 'meeting': return { text: d.title || 'Call' + (d.participant ? ` · ${d.participant}` : '') };
    case 'assessment': return { text: `Paid assessment · ${d.status || ''}` };
    case 'outreach_added': return { text: `Added to outreach · ${d.stage || ''}` };
    case 'lead_added': return { text: `Engagement lead${d.engagement_type ? ` · ${d.engagement_type}` : ''}` };
    default: return { text: JSON.stringify(d) };
  }
}

export function ContactRecord({ contact, onClose, onChangeField, onSetStage, onChanged }: {
  contact: Contact;
  onClose: () => void;
  onChangeField: (field: keyof Contact, value: string) => void;
  onSetStage: (value: string) => void;
  onChanged: () => void;
}) {
  const { data, loading, refetch } = useContact360(contact.id);
  const [attachType, setAttachType] = useState<typeof ATTACHABLE[number]>('proposal_clickup');
  const [attachId, setAttachId] = useState('');
  const c = contact;
  const m = stageMeta(c.stage);
  const sources = data?.links || [];
  const timeline = data?.timeline || [];

  const attach = async () => {
    if (!attachId.trim()) return;
    try {
      const { error } = await supabase.from('contact_links').insert({
        contact_id: c.id, source_type: attachType, source_id: attachId.trim(),
        linked_by: 'manual', confidence: 'confirmed', review_status: 'active',
      });
      if (error) throw error;
      toastSuccess('Attached'); setAttachId(''); refetch(); onChanged();
    } catch (err) { toastError('attach source', err); }
  };

  const srcCounts = sources.reduce((a: Record<string, number>, l) => { a[l.sourceType] = (a[l.sourceType] || 0) + 1; return a; }, {});

  return (
    <div className="crm-over-in">
      <div className="crm-over-head">
        <span className="crm-av-lg" style={{ background: avatarColor(c.name) }}>{initials(c.name)}</span>
        <div style={{ minWidth: 0 }}>
          <div className="crm-over-name">{c.name}</div>
          <div className="crm-over-co">
            {c.company || '—'}
            {c.icpScore != null && <> · ICP {c.icpScore}</>}
            {c.linkedinUrl && <> · <a href={c.linkedinUrl} target="_blank" rel="noreferrer">LinkedIn</a></>}
            {c.email && <> · {c.email}</>}
          </div>
        </div>
        <button className="crm-x" onClick={onClose} aria-label="Close">×</button>
      </div>

      <div style={{ marginTop: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <span className="crm-badge" style={{ ['--c' as any]: m.c, ['--bg' as any]: m.bg }}><span className="dot" />{m.label}</span>
        <select className="crm-sel" value={c.stage} onChange={e => onSetStage(e.target.value)}>
          {ALL_STAGES.map(s => <option key={s} value={s}>{stageMeta(s).label}</option>)}
        </select>
      </div>

      {c.stageSuggested && c.stageSuggested !== c.stage && (
        <div className="crm-suggest">
          Suggested: <b>{stageMeta(c.stageSuggested).label}</b>
          <button className="crm-apply" onClick={() => onSetStage(c.stageSuggested!)}>Apply</button>
        </div>
      )}

      <div className="crm-grid">
        <label className="crm-field full">
          <span className="crm-field-l">Next action</span>
          <input className="crm-input" defaultValue={c.nextAction ?? ''} key={`na-${c.id}`}
            placeholder="e.g. Send proposal" onBlur={e => onChangeField('nextAction', e.target.value)} />
        </label>
        <label className="crm-field">
          <span className="crm-field-l">Due</span>
          <input className="crm-input" type="date" defaultValue={c.nextActionDue ?? ''} key={`due-${c.id}`}
            onBlur={e => onChangeField('nextActionDue', e.target.value)} />
        </label>
        <label className="crm-field full">
          <span className="crm-field-l">Notes</span>
          <textarea className="crm-area" defaultValue={c.ownerNotes ?? ''} key={`nt-${c.id}`}
            placeholder="Private notes…" onBlur={e => onChangeField('ownerNotes', e.target.value)} />
        </label>
      </div>

      <div className="crm-sec-l">Sources</div>
      <div className="crm-chips">
        {Object.entries(srcCounts).map(([t, n]) => (
          <span key={t} className="crm-chip">{SRC_LABEL[t] || t}{n > 1 ? ` ·${n}` : ''}</span>
        ))}
        {!sources.length && <span className="crm-chip" style={{ opacity: .6 }}>none yet</span>}
      </div>
      <div className="crm-attach">
        <select className="crm-sel" value={attachType} onChange={e => setAttachType(e.target.value as any)}>
          {ATTACHABLE.map(t => <option key={t} value={t}>{SRC_LABEL[t]}</option>)}
        </select>
        <input className="crm-input" style={{ flex: 1 }} placeholder="source id (clickup / stripe / transcript)"
          value={attachId} onChange={e => setAttachId(e.target.value)} />
        <button className="crm-btn" onClick={attach}>Attach</button>
      </div>

      <div className="crm-sec-l">Timeline</div>
      {loading && <div className="crm-empty">Loading activity…</div>}
      {!loading && !timeline.length && <div className="crm-empty">No activity yet.</div>}
      <div className="crm-tl">
        {timeline.map((e, i) => {
          const meta = EV[e.kind] || { label: e.kind, c: 'var(--d-paper-dimmer)' };
          const b = evBody(e);
          return (
            <div className="crm-ev" key={i}>
              <span className="crm-ev-dot" style={{ ['--ec' as any]: meta.c }} />
              <div className="crm-ev-top">
                <span className="crm-ev-kind" style={{ ['--ec' as any]: meta.c }}>{meta.label}</span>
                <span className="crm-ev-time" title={new Date(e.ts).toLocaleString()}>{relTime(e.ts)}</span>
              </div>
              <div className={`crm-ev-body ${b.out ? 'dm-out' : ''}`}>{b.text}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

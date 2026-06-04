import React from 'react';
import type { ContactLink } from '../../../types/dashboard';

export function ReviewQueueStrip({ pending, contacts, onReview }: {
  pending: ContactLink[];
  contacts: { id: string; name: string }[];
  onReview: (linkId: string, d: 'confirm' | 'reject') => void;
}) {
  if (!pending.length) return null;
  return (
    <div style={{ background:'var(--d-paper-2,#1c1c1c)', border:'1px solid #3a3a3a',
                  borderRadius:8, padding:'10px 14px', marginBottom:12 }}>
      <strong style={{ fontSize:13 }}>{pending.length} match{pending.length>1?'es':''} need review</strong>
      <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:8 }}>
        {pending.map(l => {
          const who = contacts.find(c => c.id === l.contactId)?.name ?? l.contactId.slice(0,8);
          const participant = (l.sourceRef as any)?.participant;
          const label = participant ? `meeting attendee "${participant}"` : l.sourceType;
          return (
            <div key={l.id} style={{ display:'flex', alignItems:'center', gap:10, fontSize:12 }}>
              <span style={{ opacity:.8 }}>Link {label} → {who} ?</span>
              <button onClick={() => onReview(l.id,'confirm')}>Confirm</button>
              <button onClick={() => onReview(l.id,'reject')}>Reject</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

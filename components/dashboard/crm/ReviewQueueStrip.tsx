import React from 'react';
import type { ContactLink } from '../../../types/dashboard';

export function ReviewQueueStrip({ pending, onReview }: {
  pending: ContactLink[];
  onReview: (linkId: string, d: 'confirm' | 'reject') => void;
}) {
  if (!pending.length) return null;
  return (
    <div style={{ background:'var(--d-paper-2,#1c1c1c)', border:'1px solid #3a3a3a',
                  borderRadius:8, padding:'10px 14px', marginBottom:12 }}>
      <strong style={{ fontSize:13 }}>{pending.length} match{pending.length>1?'es':''} need review</strong>
      <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:8 }}>
        {pending.map(l => (
          <div key={l.id} style={{ display:'flex', alignItems:'center', gap:10, fontSize:12 }}>
            <span style={{ opacity:.8 }}>{l.sourceType} · {l.sourceId.slice(0,8)}…</span>
            <button onClick={() => onReview(l.id,'confirm')}>Confirm</button>
            <button onClick={() => onReview(l.id,'reject')}>Reject</button>
          </div>
        ))}
      </div>
    </div>
  );
}

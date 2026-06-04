import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { ContactLink } from '../../../types/dashboard';

const EASE = [0.16, 1, 0.3, 1] as const;

export function ReviewQueueStrip({ pending, contacts, onReview }: {
  pending: ContactLink[];
  contacts: { id: string; name: string }[];
  onReview: (linkId: string, d: 'confirm' | 'reject') => void;
}) {
  return (
    <AnimatePresence initial={false}>
      {pending.length > 0 && (
        // The whole strip collapses away once the last match is resolved.
        <motion.div
          key="review-strip"
          layout
          initial={{ opacity: 0, height: 0, marginBottom: 0 }}
          animate={{ opacity: 1, height: 'auto', marginBottom: 12 }}
          exit={{ opacity: 0, height: 0, marginBottom: 0 }}
          transition={{ duration: 0.28, ease: EASE }}
          style={{ overflow: 'hidden' }}
        >
          <div className="dv-card" style={{ marginBottom: 0, padding: '12px 16px' }}>
            <strong style={{ fontSize: 13 }}>
              {pending.length} match{pending.length > 1 ? 'es' : ''} need review
            </strong>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              {/* Each resolved row slides out optimistically; the rest reflow up. */}
              <AnimatePresence initial={false} mode="popLayout">
                {pending.map(l => {
                  const who = contacts.find(c => c.id === l.contactId)?.name ?? l.contactId.slice(0, 8);
                  const participant = (l.sourceRef as any)?.participant;
                  const label = participant ? `meeting attendee "${participant}"` : l.sourceType;
                  return (
                    <motion.div
                      key={l.id}
                      layout
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: 16, transition: { duration: 0.18, ease: EASE } }}
                      transition={{ duration: 0.22, ease: EASE }}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}
                    >
                      <span style={{ opacity: 0.85, flex: 1 }}>Link {label} → {who} ?</span>
                      <button className="dv-btn dv-btn--good" style={{ height: 26, padding: '0 10px' }}
                              onClick={() => onReview(l.id, 'confirm')}>Confirm</button>
                      <button className="dv-btn dv-btn--dim" style={{ height: 26, padding: '0 10px' }}
                              onClick={() => onReview(l.id, 'reject')}>Reject</button>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

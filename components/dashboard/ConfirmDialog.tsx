import React, { useEffect } from 'react';

/**
 * In-app confirm dialog — replaces native window.confirm() across the
 * dashboard. Native confirm() blocks the render thread, can't be styled,
 * and reads as a browser chrome popup instead of part of the product.
 *
 * Escape cancels; the confirm button autofocuses so Enter confirms.
 * Backdrop click cancels (same "dismiss = no-op" semantics as Sheet).
 */
export function ConfirmDialog({ open, title, body, confirmLabel = 'Confirm', danger, onConfirm, onCancel }: {
  open: boolean; title: string; body?: string; confirmLabel?: string; danger?: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onCancel} role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-[380px] rounded-xl bg-[var(--d-surface)] border border-[var(--d-rule-strong)] shadow-lg p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="text-[14px] font-semibold text-[var(--d-paper)]">{title}</div>
        {body && <div className="text-[12.5px] text-[var(--d-paper-dim)]">{body}</div>}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onCancel} className="text-[12px] font-medium px-3 py-1.5 rounded-md border border-[var(--d-rule-strong)] focus-visible:ring-2 focus-visible:ring-[var(--ds-accent)] outline-none">Cancel</button>
          <button onClick={onConfirm} autoFocus className={`text-[12px] font-semibold px-3 py-1.5 rounded-md text-white focus-visible:ring-2 focus-visible:ring-offset-1 outline-none ${danger ? 'bg-[var(--d-bad)]' : 'bg-[var(--ds-accent)]'}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;

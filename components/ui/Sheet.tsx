import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

/**
 * Side-sheet — right-anchored panel that slides in over the list.
 *
 * Fixes the modal-panel-swap anti-pattern flagged by both the workflow + IA
 * audits: list stays visible, drawer slides in, Escape closes, click outside
 * (scrim) closes, URL stays in sync. ~80% of the master-detail value of a
 * full Radix Dialog without the dep.
 */
interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  /** sm/md/lg/xl/full. 'full' is ClickUp-style — takes 95% of the viewport. */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  children?: React.ReactNode;
}

const WIDTHS = {
  sm: 'max-w-[480px]',
  md: 'max-w-[720px]',
  lg: 'max-w-[960px]',
  xl: 'max-w-[1100px]',
  full: 'max-w-[min(1600px,95vw)]',
};

export const Sheet: React.FC<SheetProps> = ({ open, onClose, title, size = 'lg', children }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1.5px]"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 280 }}
            className={`fixed right-0 top-0 bottom-0 z-50 w-full ${WIDTHS[size]} bg-[var(--ds-card)] border-l border-[var(--ds-line)] shadow-[-12px_0_40px_rgba(0,0,0,0.12)] flex flex-col`}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--ds-line)] bg-[var(--ds-card)] shrink-0">
              <button
                onClick={onClose}
                className="p-1.5 rounded-md text-[var(--ds-dim)] hover:text-[var(--ds-ink)] hover:bg-black/5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--ds-card)]"
                title="Close (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
              {title && <div className="text-sm font-medium text-[var(--ds-ink)] truncate flex-1">{title}</div>}
            </div>
            {/* Body */}
            <div className="flex-1 overflow-y-auto px-4 py-4 bg-[var(--ds-bg)]">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default Sheet;

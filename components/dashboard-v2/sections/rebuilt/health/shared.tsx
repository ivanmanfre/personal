import React from 'react';
import type { WorkflowStat, ScheduledStatus } from '../../../../../types/dashboard';

/*
 * Health — shared status grammar. Black Box v4 register.
 *
 * The refutation this section flips: "colored icon-chips → grey, same tiles".
 * The fix is NOT one grey dot for every state. Genuine operational state stays
 * VISUALLY DISTINCT without leaning on hue — every mark differs by SHAPE
 * (fill / outline / dash) and WEIGHT, and always rides a functional uppercase
 * LABEL, so the states separate even rendered in greyscale. The one Signal red
 * (#C8361B via --ec-red) is spent only on genuine danger (OVERDUE / erroring /
 * hard workflow error), per the ledger constraint that red stays red for those.
 */

/* ── Workflow health (verbatim rule from WorkflowsPanel.getWorkflowHealth) ── */
export type WfHealth = 'healthy' | 'warning' | 'error' | 'inactive';

export function workflowHealth(wf: WorkflowStat): WfHealth {
  if (!wf.isActive) return 'inactive';
  // Only trust an acknowledge if the LAST execution was not itself an error.
  if (wf.errorAcknowledged && wf.lastExecutionStatus !== 'error') return 'healthy';
  if (wf.lastExecutionStatus === 'error' || wf.errorCount24h > 3) return 'error';
  if (wf.errorCount24h > 0) return 'warning';
  return 'healthy';
}

export const WF_LABEL: Record<WfHealth, string> = {
  error: 'Error',
  warning: 'Warn',
  healthy: 'OK',
  inactive: 'Off',
};

export const WF_PRIORITY: Record<WfHealth, number> = { error: 0, warning: 1, healthy: 2, inactive: 3 };

/* ── Scheduled-op status (5-state, distinct shape per state) ── */
export const STATUS_META: Record<ScheduledStatus, { label: string; priority: number }> = {
  OVERDUE:  { label: 'Overdue',  priority: 0 },
  ERRORING: { label: 'Erroring', priority: 1 },
  UNKNOWN:  { label: 'Unknown',  priority: 2 },
  OK:       { label: 'OK',       priority: 3 },
  DISABLED: { label: 'Disabled', priority: 4 },
};

/* Mark kinds map both taxonomies onto one shape vocabulary:
 *   overdue / error   → solid red square   (hard danger)
 *   erroring          → red outline square  (danger, distinct from overdue)
 *   warn              → solid ink square    (attention, no error yet)
 *   ok / healthy      → ink outline square  (present, calm)
 *   unknown           → dim outline square  (indeterminate)
 *   disabled/inactive → dim dash            (switched off) */
export type MarkKind =
  | 'overdue' | 'erroring' | 'error' | 'warn'
  | 'ok' | 'healthy' | 'unknown' | 'disabled' | 'inactive';

export function statusToMark(s: ScheduledStatus): MarkKind {
  switch (s) {
    case 'OVERDUE': return 'overdue';
    case 'ERRORING': return 'erroring';
    case 'UNKNOWN': return 'unknown';
    case 'OK': return 'ok';
    case 'DISABLED': return 'disabled';
  }
}

export const StatusMark: React.FC<{ kind: MarkKind; className?: string }> = ({ kind, className }) => (
  <span className={`hx-mark hx-mark--${kind}${className ? ` ${className}` : ''}`} aria-hidden="true" />
);

/* Small inline status label — mark + uppercase word. Used in rows so a state
 * never reads by colour alone. */
export const StatusTag: React.FC<{ kind: MarkKind; label: string }> = ({ kind, label }) => (
  <span className="hx-status">
    <StatusMark kind={kind} />
    <span className="hx-status-lbl">{label}</span>
  </span>
);

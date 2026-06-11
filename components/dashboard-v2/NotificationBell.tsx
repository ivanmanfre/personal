import React, { useState, useRef, useEffect, useCallback } from 'react';
import { usePendingActions, type Severity } from '../../hooks/usePendingActions';
import { navigateToDeeplink } from '../../lib/deeplink';

const CATEGORY_LABEL: Record<string, string> = {
  skill_draft: 'Skill drafts', memory_proposal: 'Memory cleanup',
  scheduled_check: 'Checks due', stuck_automation: 'Stuck automations',
  carousel_review: 'Posts in review', lm_review: 'Lead magnets in review',
  prospect_reply: 'Replies to handle', paid_intake: 'Paid assessments',
  upwork_proposal: 'Upwork proposals', call_clip: 'Call clips',
  crm_action_due: 'CRM actions due', dashboard_task: 'Tasks',
};
const SEVERITY_CLASS: Record<Severity, string> = { tier1: 'bad', tier2: 'warn', tier3: 'good' };

export function NotificationBell() {
  const { groups, unreadCount, topSeverity, markAllSeen } = usePendingActions();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const toggle = useCallback(() => {
    setOpen((o) => {
      if (!o) markAllSeen();   // opening = "seen"
      return !o;
    });
  }, [markAllSeen]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc); };
  }, [open]);

  const go = (deeplink: string) => { navigateToDeeplink(deeplink); setOpen(false); };

  return (
    <div className="nb-root" ref={ref}>
      <button type="button" className="nb-button" aria-label="Notifications" onClick={toggle}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unreadCount > 0 && (
          <span data-testid="nb-badge" className={`nb-badge nb-badge--${SEVERITY_CLASS[topSeverity ?? 'tier3']}`}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="nb-dropdown" role="menu">
          <div className="nb-dropdown-head">
            <span>Pending</span>
            <button type="button" className="nb-mark" onClick={() => markAllSeen()}>Mark all seen</button>
          </div>
          {groups.length === 0 ? (
            <div className="nb-empty">You're all caught up.</div>
          ) : (
            groups.map((g) => (
              <div key={g.category} className="nb-group">
                <div className={`nb-group-head nb-sev--${SEVERITY_CLASS[g.topSeverity]}`}>
                  <span>{CATEGORY_LABEL[g.category] ?? g.category}</span>
                  <span className="nb-count">{g.count}</span>
                </div>
                {g.items.slice(0, 3).map((it) => (
                  <button key={it.itemKey} type="button" className="nb-item" role="menuitem" onClick={() => go(it.deeplink)}>
                    <span className="nb-item-title">{it.title}</span>
                    {it.subtitle && <span className="nb-item-sub">{it.subtitle}</span>}
                  </button>
                ))}
                {g.count > 3 && (
                  <button type="button" className="nb-more" onClick={() => go(g.items[0].deeplink)}>
                    +{g.count - 3} more →
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

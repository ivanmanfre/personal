import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { usePendingActions, type Severity, type PendingItem } from '../../hooks/usePendingActions';
import { timeAgo, resolveActionFor } from '../../lib/pendingActions';
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
const stop = (e: React.MouseEvent) => e.stopPropagation();

export function NotificationBell() {
  const {
    groups, unreadCount, topSeverity, mutedCategories,
    markSeen, resolve, muteCategory, unmuteCategory,
  } = usePendingActions();
  const [open, setOpen] = useState(false);
  const [showMuted, setShowMuted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const now = Date.now();

  const toggle = useCallback(() => { setOpen((o) => !o); }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc); };
  }, [open]);

  // Row click: auto-mark seen, then navigate; close after the press settles.
  const go = (item: PendingItem) => {
    markSeen([item.itemKey]);
    navigateToDeeplink(item.deeplink);
    window.setTimeout(() => setOpen(false), 130);
  };

  const allKeys = groups.flatMap((g) => g.items.map((i) => i.itemKey));

  return (
    <div className="nb-root" ref={ref}>
      <button
        type="button"
        className={`nb-button ${unreadCount > 0 ? 'nb-button--active' : ''}`}
        aria-label="Notifications"
        onClick={toggle}
      >
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
            <span>Pending {unreadCount > 0 && <em className="nb-head-count">{unreadCount} new</em>}</span>
            <button type="button" className="nb-mark" onClick={() => markSeen(allKeys)} disabled={unreadCount === 0}>
              Mark all seen
            </button>
          </div>

          {groups.length === 0 ? (
            <div className="nb-empty">You're all caught up.</div>
          ) : (
            groups.map((g) => {
              const groupKeys = g.items.map((i) => i.itemKey);
              const groupUnread = g.items.some((i) => i.unread);
              return (
                <div key={g.category} className="nb-group">
                  <div className={`nb-group-head nb-sev--${SEVERITY_CLASS[g.topSeverity]}`}>
                    <span className="nb-group-name">{CATEGORY_LABEL[g.category] ?? g.category}</span>
                    <span className="nb-count">{g.count}</span>
                    <span className="nb-group-actions">
                      {groupUnread && (
                        <button type="button" className="nb-gbtn" title="Mark group seen" onClick={() => markSeen(groupKeys)}>✓</button>
                      )}
                      <button type="button" className="nb-gbtn" title="Mute this category" aria-label="Mute this category" onClick={() => muteCategory(g.category)}><BellOff className="w-3.5 h-3.5" /></button>
                    </span>
                  </div>
                  {g.items.slice(0, 3).map((it) => {
                    const action = resolveActionFor(it.category, it.itemKey);
                    return (
                      <button
                        key={it.itemKey}
                        type="button"
                        className={`nb-item ${it.unread ? 'nb-item--unread' : ''}`}
                        role="menuitem"
                        onClick={() => go(it)}
                      >
                        <span className="nb-dot" aria-hidden="true" />
                        <span className="nb-item-body">
                          <span className="nb-item-row">
                            <span className="nb-item-title">{it.title}</span>
                            <span className="nb-item-time">{timeAgo(it.createdAt, now)}</span>
                          </span>
                          {it.subtitle && <span className="nb-item-sub">{it.subtitle}</span>}
                        </span>
                        <span className="nb-item-actions" onClick={stop}>
                          {it.unread && (
                            <span role="button" tabIndex={0} className="nb-iaction" title="Mark seen"
                              onClick={() => markSeen([it.itemKey])}>✓</span>
                          )}
                          {action && (
                            <span role="button" tabIndex={0} className="nb-iaction nb-iaction--resolve" title={action.label}
                              onClick={() => resolve(it)}>{action.label}</span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                  {g.count > 3 && (
                    <button type="button" className="nb-more" onClick={() => go(g.items[0])}>+{g.count - 3} more →</button>
                  )}
                </div>
              );
            })
          )}

          {mutedCategories.length > 0 && (
            <div className="nb-muted">
              <button type="button" className="nb-muted-toggle" onClick={() => setShowMuted((s) => !s)}>
                Muted ({mutedCategories.length}) · manage
              </button>
              {showMuted && mutedCategories.map((c) => (
                <div key={c} className="nb-muted-row">
                  <span>{CATEGORY_LABEL[c] ?? c}</span>
                  <button type="button" className="nb-gbtn" title="Unmute" aria-label="Unmute" onClick={() => unmuteCategory(c)}><Bell className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

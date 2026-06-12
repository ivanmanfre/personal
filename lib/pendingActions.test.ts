import { describe, it, expect } from 'vitest';
import {
  mapRow, sortItems, computeUnreadCount, computeTopSeverity, groupByCategory, timeAgo,
  resolveActionFor,
  type PendingItem,
} from './pendingActions';

const NOW = '2026-06-11T12:00:00Z';
const OLD = '2026-06-01T00:00:00Z';
const LAST_OPENED = '2026-06-05T00:00:00Z';

const rawRows = [
  { category: 'skill_draft', item_key: 'skill_draft:1', title: 'A', subtitle: '', severity: 'tier3', deeplink: '?section=ops&sub=skills', created_at: NOW },
  { category: 'scheduled_check', item_key: 'scheduled_check:2', title: 'B', subtitle: 'due', severity: 'tier1', deeplink: '?section=ops&sub=checks', created_at: NOW },
  { category: 'skill_draft', item_key: 'skill_draft:3', title: 'C', subtitle: '', severity: 'tier3', deeplink: '?section=ops&sub=skills', created_at: OLD },
];

describe('pendingActions', () => {
  it('mapRow normalizes a raw RPC row', () => {
    const it0 = mapRow(rawRows[1]);
    expect(it0).toEqual<PendingItem>({
      category: 'scheduled_check', itemKey: 'scheduled_check:2', title: 'B',
      subtitle: 'due', severity: 'tier1', deeplink: '?section=ops&sub=checks', createdAt: NOW,
      unread: true, // absent r.unread defaults to unread
    });
    expect(mapRow({ ...rawRows[1], unread: true }).unread).toBe(true);
    expect(mapRow({ ...rawRows[1], unread: false }).unread).toBe(false);
  });

  it('mapRow defaults missing subtitle/severity', () => {
    const it0 = mapRow({ category: 'x', item_key: 'x:1', title: 'T', deeplink: '?section=ops', created_at: NOW });
    expect(it0.subtitle).toBe('');
    expect(it0.severity).toBe('tier3');
  });

  it('sortItems orders by severity then newest first', () => {
    const sorted = sortItems(rawRows.map(mapRow));
    expect(sorted[0].severity).toBe('tier1');            // tier1 first
    expect(sorted[1].createdAt).toBe(NOW);               // among tier3, newest first
    expect(sorted[2].createdAt).toBe(OLD);
  });

  it('computeUnreadCount = items newer than lastOpenedAt', () => {
    expect(computeUnreadCount(rawRows.map(mapRow), LAST_OPENED)).toBe(2);
  });

  it('computeTopSeverity = highest severity among unread, null if none', () => {
    expect(computeTopSeverity(rawRows.map(mapRow), LAST_OPENED)).toBe('tier1');
    expect(computeTopSeverity(rawRows.map(mapRow), NOW)).toBeNull(); // nothing newer than NOW
  });

  it('groupByCategory groups with counts + per-group top severity, sorted by severity', () => {
    const groups = groupByCategory(rawRows.map(mapRow));
    expect(groups[0].category).toBe('scheduled_check');  // tier1 group first
    const skill = groups.find((g) => g.category === 'skill_draft');
    expect(skill?.count).toBe(2);
    expect(skill?.topSeverity).toBe('tier3');
  });
});

describe('resolveActionFor', () => {
  it('returns the action + parsed id for the 5 safe categories', () => {
    const a = resolveActionFor('skill_draft', 'skill_draft:abc-123');
    expect(a).toEqual({ label: 'Approve', method: 'rpc', table: 'skill_drafts', field: 'status', value: 'approved', id: 'abc-123' });
    expect(resolveActionFor('dashboard_task', 'dashboard_task:t1')?.value).toBe('completed');
    expect(resolveActionFor('stuck_automation', 'stuck_automation:w1')).toMatchObject({ method: 'rpc', field: 'error_acknowledged', id: 'w1' });
  });
  it('overdue stuck keys are navigate-only (null)', () => {
    expect(resolveActionFor('stuck_automation', 'overdue:cron-x')).toBeNull();
  });
  it('consequential categories have no inline action', () => {
    for (const c of ['carousel_review','lm_review','upwork_proposal','prospect_reply','paid_intake','call_clip','memory_proposal']) {
      expect(resolveActionFor(c, `${c}:x`)).toBeNull();
    }
  });
  it('parses the id as everything after the first colon', () => {
    expect(resolveActionFor('skill_draft', 'skill_draft:a:b:c')?.id).toBe('a:b:c');
  });
});

describe('timeAgo', () => {
  const NOW = Date.parse('2026-06-11T12:00:00Z');
  it('formats recent/min/hr/day/week', () => {
    expect(timeAgo('2026-06-11T11:59:40Z', NOW)).toBe('just now');
    expect(timeAgo('2026-06-11T11:30:00Z', NOW)).toBe('30m ago');
    expect(timeAgo('2026-06-11T09:00:00Z', NOW)).toBe('3h ago');
    expect(timeAgo('2026-06-09T12:00:00Z', NOW)).toBe('2d ago');
    expect(timeAgo('2026-05-30T12:00:00Z', NOW)).toBe('1w ago');
  });
  it('returns empty for an unparseable timestamp', () => {
    expect(timeAgo('not-a-date', NOW)).toBe('');
  });
});

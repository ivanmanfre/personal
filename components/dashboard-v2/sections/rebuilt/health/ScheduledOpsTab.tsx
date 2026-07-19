import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { timeAgo } from '../../../../dashboard/shared/utils';
import type { ScheduledJob, ScheduledStatus } from '../../../../../types/dashboard';
import { STATUS_META, statusToMark, StatusMark, StatusTag } from './shared';

/*
 * Scheduled Ops tab — 151 rows across scheduled_ops_status, grouped and
 * searchable. Read-only (no mutation). The 5-state status stays distinct by
 * SHAPE + LABEL, never hue alone; red marks only OVERDUE / ERRORING.
 * Ledger elements 20 (search) · 21 (group-by) · 22 (status chips) · 23 (row
 * expand, hasError) · 24 (refresh — lives on the parent toolbar).
 */

const CHIPS: (ScheduledStatus | 'ALL')[] = ['ALL', 'OVERDUE', 'ERRORING', 'UNKNOWN', 'OK', 'DISABLED'];

const JobRow: React.FC<{ job: ScheduledJob }> = ({ job }) => {
  const [open, setOpen] = useState(false);
  const meta = STATUS_META[job.status];
  const hasError = !!job.lastErrorMessage;
  return (
    <div>
      <button
        className={`hx-job ${hasError ? 'hx-job--err' : ''}`}
        onClick={() => hasError && setOpen((o) => !o)}
        aria-expanded={hasError ? open : undefined}
      >
        <StatusMark kind={statusToMark(job.status)} />
        <div className="hx-job-body">
          <span className="hx-job-label">
            <span className="hx-job-labeltxt">{job.label}</span>
            <span className="hx-job-src">{job.source}</span>
          </span>
          {job.description && <div className="hx-job-desc">{job.description}</div>}
        </div>
        <div className="hx-job-sched hx-job-sched-cell">{job.scheduleHuman || 'no schedule'}</div>
        <div className="hx-job-when">{job.lastRunAt ? timeAgo(job.lastRunAt) : 'never'}</div>
        <span className="hx-job-status-cell"><StatusTag kind={statusToMark(job.status)} label={meta.label} /></span>
        <span className="hx-job-chev">{hasError ? (open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />) : ''}</span>
      </button>
      {open && hasError && <pre className="hx-job-errbox">{job.lastErrorMessage}</pre>}
    </div>
  );
};

const ScheduledOpsTab: React.FC<{ jobs: ScheduledJob[]; loading: boolean }> = ({ jobs, loading }) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ScheduledStatus | 'ALL'>('ALL');
  const [groupBy, setGroupBy] = useState<'category' | 'source'>('category');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return jobs.filter((j) => {
      if (statusFilter !== 'ALL' && j.status !== statusFilter) return false;
      if (q && !(`${j.label} ${j.description ?? ''} ${j.scheduleHuman ?? ''}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [jobs, search, statusFilter]);

  const groups = useMemo(() => {
    const m = new Map<string, ScheduledJob[]>();
    for (const j of filtered) {
      const key = groupBy === 'category' ? (j.category || 'Meta') : j.source;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(j);
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => STATUS_META[a.status].priority - STATUS_META[b.status].priority || a.label.localeCompare(b.label));
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered, groupBy]);

  if (loading && jobs.length === 0) return <div className="hx-loading">Reading scheduled_ops_status…</div>;

  return (
    <div>
      <div className="hx-toolbar">
        <input
          className="hx-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search scheduled jobs…"
          aria-label="Search scheduled jobs"
        />
        <button className="hx-chip" onClick={() => setGroupBy((g) => (g === 'category' ? 'source' : 'category'))}>
          Group: {groupBy}
        </button>
      </div>

      <div className="hx-toolbar" role="group" aria-label="Filter by status">
        {CHIPS.map((s) => (
          <button
            key={s}
            className="hx-chip"
            aria-pressed={statusFilter === s}
            onClick={() => setStatusFilter(s)}
          >
            {s !== 'ALL' && <StatusMark kind={statusToMark(s)} />}
            {s === 'ALL' ? 'All' : STATUS_META[s].label}
          </button>
        ))}
      </div>

      {groups.length === 0 ? (
        <p className="hx-empty">No scheduled jobs match.</p>
      ) : (
        groups.map(([groupName, arr]) => (
          <div className="hx-group" key={groupName}>
            <div className="hx-group-cap">
              <span className="hx-group-h">{groupName}</span>
              <span className="hx-group-n">{arr.length}</span>
            </div>
            <div className="hx-jobs">
              {arr.map((j) => <JobRow key={j.jobKey} job={j} />)}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default ScheduledOpsTab;

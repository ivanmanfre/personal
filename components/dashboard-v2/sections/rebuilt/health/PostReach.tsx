import React from 'react';
import {
  splitOf, reachedOf, topBuckets, reachShares, formatShares, weightedSplit,
} from '../../../../../lib/postReach';
import type { ReachCarrier } from '../../../../../lib/postReach';

/*
 * Who Ivan's own posts reached, in the Health register (paper, ink, radius 0).
 * Same numbers and wording as the client board Performance card
 * (components/client-board/DeskPerformanceSurface.tsx); both read lib/postReach.ts.
 * Pure presentational: no data fetching here, so it renders in a test without Supabase.
 * A post with no captured split renders nothing (no dash, no zero).
 */

export function ReachSplitBar({ inPct, outPct, className }: { inPct: number; outPct: number; className?: string }) {
  const total = inPct + outPct || 1;
  return (
    <span className={`hx-reach-bar${className ? ` ${className}` : ''}`} data-viz="split" aria-hidden="true">
      <span className="hx-reach-in" style={{ width: `${(inPct / total) * 100}%` }} />
      <span className="hx-reach-out" style={{ width: `${(outPct / total) * 100}%` }} />
    </span>
  );
}

const Swatch = ({ out }: { out?: boolean }) => <i aria-hidden="true" className={`hx-reach-sw${out ? ' hx-reach-sw--out' : ''}`} />;

/** Per post: split bar + both shares + members reached, then top 2 job titles + top industry. */
export function PostReachLine({ reach }: { reach?: ReachCarrier | null }) {
  if (!reach) return null;
  const sp = splitOf(reach);
  if (!sp) return null;
  const reached = reachedOf(reach);
  const roles = topBuckets(reach.demographics?.job_title, 2);
  const ind = topBuckets(reach.demographics?.industry, 1)[0];
  const label = `In network ${sp.inPct}%, out of network ${sp.outPct}%${reached != null ? `, reached ${reached.toLocaleString()} members` : ''}`;
  return (
    <div className="hx-reach-line" data-metric="reach" title={label}>
      <div className="hx-reach-row">
        <ReachSplitBar inPct={sp.inPct} outPct={sp.outPct} />
        <span><Swatch />In network {sp.inPct}%</span>
        <span><Swatch out />Out of network {sp.outPct}%</span>
        {reached != null && <span>Reached {reached.toLocaleString()}</span>}
      </div>
      {(roles.length > 0 || ind) && (
        <div className="hx-reach-who">
          {roles.length > 0 && <><b>Top viewer roles</b> {roles.map((b) => `${b.label} ${b.pct}%`).join(', ')}</>}
          {ind && <>{roles.length > 0 ? ' · ' : ''}<b>Industry</b> {ind.label} {ind.pct}%</>}
        </div>
      )}
    </div>
  );
}

/**
 * Roll-up over the panel's window: out-of-network share weighted by impressions, and the
 * share of members reached for the top job titles and industries. Renders nothing when no
 * post in the window carries the split.
 */
export function PostReachRollup<T extends ReachCarrier & { impressions?: number | null }>({
  posts, windowLabel,
}: { posts: T[]; windowLabel: string }) {
  const withSplit = posts.filter((p) => splitOf(p));
  const sp = weightedSplit(withSplit, (p) => p.impressions ?? null);
  if (!sp) return null;
  const roles = reachShares(withSplit, 'job_title', 3);
  const industries = reachShares(withSplit, 'industry', 3);
  const noun = sp.n === 1 ? 'post' : 'posts';
  return (
    <section className="hx-reach" data-surface="post-reach">
      <div className="ec-kicker">
        Who your posts reached <span className="hx-reach-scope">{sp.n} {noun}, {windowLabel}</span>
      </div>
      <div className="hx-reach-grid">
        <div>
          <span className="hx-stat-num">{sp.outPct}%</span>
          <span className="hx-stat-lbl hx-reach-lbl">Out of network</span>
          <span className="hx-reach-note">Impressions from people who do not follow you and are not connected to you</span>
          <ReachSplitBar inPct={sp.inPct} outPct={sp.outPct} className="hx-reach-bar--big" />
          <div className="hx-reach-row hx-reach-legend">
            <span><Swatch />In network {sp.inPct}%</span>
            <span><Swatch out />Out of network {sp.outPct}%</span>
          </div>
          <span className="hx-reach-note">Weighted by impressions across {sp.n} {noun}.</span>
        </div>
        {(roles || industries) && (
          <div>
            <span className="hx-stat-lbl hx-reach-lbl">Share of members reached</span>
            {roles && (
              <div className="hx-reach-share" data-share="role">
                <span className="hx-reach-k">Job title</span>
                <span className="hx-reach-v">{formatShares(roles.labels)}</span>
              </div>
            )}
            {industries && (
              <div className="hx-reach-share" data-share="industry">
                <span className="hx-reach-k">Industry</span>
                <span className="hx-reach-v">{formatShares(industries.labels)}</span>
              </div>
            )}
            <span className="hx-reach-note">Each figure is the share of all members these posts reached. LinkedIn lists only the largest groups per post, so smaller groups are not counted.</span>
          </div>
        )}
      </div>
    </section>
  );
}

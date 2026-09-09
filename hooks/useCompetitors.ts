import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { dashboardAction, toastError } from '../lib/dashboardActions';
import { withinWindow } from '../lib/withinWindow';
import type { CompetitorPost, CompetitorPattern } from '../types/dashboard';

/**
 * A competitor row plus the role the roster gives it. The role is carried here
 * rather than added to `CompetitorPost` in types/dashboard.ts so nothing outside
 * this panel changes shape.
 *
 * ROLES ARE NOT ONE THING (measurement contract, "Client experience and content
 * decisions"): public competitors, buyer/industry voices and FORMAT REFERENCES
 * are different jobs, and "accounts with a different audience may remain format
 * references but do not become peer-performance baselines". So a `style_only`
 * account is kept and labelled, and is excluded from every average and median.
 */
export type CompetitorPostWithRole = CompetitorPost & { competitorRole: string | null };

function mapPost(row: any): CompetitorPostWithRole {
  return {
    competitorRole: row.competitor_role ?? null,
    id: row.id,
    competitorName: row.competitor_name || '',
    postText: row.post_text || '',
    postDate: row.post_date,
    likesCount: row.likes_count || 0,
    commentsCount: row.comments_count || 0,
    repostsCount: row.reposts_count || 0,
    postType: row.post_type || '',
    topicCategory: row.topic_category,
    hookPattern: row.hook_pattern,
    isTopPerformer: row.is_top_performer || false,
    hasOpportunity: row.has_opportunity || false,
    theOpportunity: row.the_opportunity,
    suggestedAngle: row.suggested_angle,
    suggestedFormat: row.suggested_format,
    opportunityActioned: row.opportunity_actioned || false,
    linkedinPostUrl: row.linkedin_post_url,
    linkedinProfileUrl: row.linkedin_profile_url,
  };
}

function mapPattern(row: any): CompetitorPattern {
  return {
    id: row.id,
    competitorName: row.competitor_name || '',
    postCount: row.post_count || 0,
    patternsJson: row.patterns_json,
    patternText: row.pattern_text,
  };
}

/** Median of a numeric list. Empty list -> null, never 0. */
export function medianOf(values: number[]): number | null {
  if (!values.length) return null;
  const v = [...values].sort((a, b) => a - b);
  const mid = v.length >> 1;
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

export type CompetitorStatRow = CompetitorPattern & {
  /** Arithmetic mean over the window. NULL when no post of theirs falls inside
   *  it: an average over nothing is not 0, and rendering 0 told the operator that
   *  an account with no posts in the window was a flat performer (ledger C13). */
  avgLikes: number | null;
  avgComments: number | null;
  /** Median over the same window. LinkedIn engagement is right-skewed, so the
   *  mean over a handful of posts is carried by one outlier; the median is the
   *  figure to read first (ledger C13). Null on an empty window, like the mean. */
  median: number | null;
  medianComments: number | null;
  /** The eligible sample behind both figures. Always rendered beside them. */
  recentPostCount: number;
};

export type CompetitorStatsResult = {
  stats: CompetitorStatRow[];
  /** Accounts whose roster role is `style_only`: kept, labelled, and never part
   *  of a performance baseline. */
  styleOnly: CompetitorStatRow[];
  /** How many baseline posts in the window carry no role yet. Shown, not hidden:
   *  the roster is being classified and an unclassified row is an unknown, not a
   *  peer. */
  unclassified: number;
  windowDays: number | null;
  /** The most recent post date inside the window. This is what "as of" means on
   *  screen: the data behind the figures, not the moment the page rendered. */
  asOf: string | null;
};

/**
 * The whole stats computation, as a pure function so it can be tested without a
 * hook, a network call or a clock (ledger C12 / C13 / C14).
 *
 * ROLE HANDLING. The ledger's proposal was a literal
 * `.eq('competitor_role','topical')` on the query. That is applied here as a
 * PARTITION rather than a query filter, because every existing row predates the
 * column: an equality filter would empty the panel the day it shipped. The rule
 * that matters is preserved exactly, and is stricter than it looks: a
 * `style_only` account can never enter an average or a median. A row with no
 * role yet stays in the baseline and is COUNTED as unclassified on screen.
 */
export function competitorStatsFor(
  patterns: CompetitorPattern[],
  posts: CompetitorPostWithRole[],
  days: number | null | undefined,
  now: number,
): CompetitorStatsResult {
  const inWindow = days == null ? posts : posts.filter((cp) => withinWindow(cp.postDate, days, now));
  const isStyleOnly = (r: string | null | undefined) => r === 'style_only';

  const rowFor = (p: CompetitorPattern, pool: CompetitorPostWithRole[]): CompetitorStatRow => {
    const cPosts = pool.filter((cp) => cp.competitorName === p.competitorName);
    const n = cPosts.length;
    return {
      ...p,
      avgLikes: n ? Math.round(cPosts.reduce((s, c) => s + c.likesCount, 0) / n) : null,
      avgComments: n ? Math.round(cPosts.reduce((s, c) => s + c.commentsCount, 0) / n) : null,
      median: medianOf(cPosts.map((c) => c.likesCount)),
      medianComments: medianOf(cPosts.map((c) => c.commentsCount)),
      recentPostCount: n,
    };
  };

  // An account is a format reference when EVERY windowed post of theirs carries
  // that role. A mixed roster row stays in the baseline and its style_only posts
  // are dropped from the figures.
  const namesInWindow = new Set(inWindow.map((p) => p.competitorName));
  const styleOnlyNames = new Set(
    [...namesInWindow].filter((name) => {
      const theirs = inWindow.filter((p) => p.competitorName === name);
      return theirs.length > 0 && theirs.every((p) => isStyleOnly(p.competitorRole));
    }),
  );

  const baselinePool = inWindow.filter((p) => !isStyleOnly(p.competitorRole));
  const stylePool = inWindow.filter((p) => isStyleOnly(p.competitorRole));

  const dates = inWindow.map((p) => p.postDate).filter(Boolean).sort();
  return {
    stats: patterns.filter((p) => !styleOnlyNames.has(p.competitorName)).map((p) => rowFor(p, baselinePool)),
    styleOnly: patterns.filter((p) => styleOnlyNames.has(p.competitorName)).map((p) => rowFor(p, stylePool)),
    unclassified: baselinePool.filter((p) => !p.competitorRole).length,
    windowDays: days ?? null,
    asOf: dates.length ? dates[dates.length - 1] : null,
  };
}

export function useCompetitors(days?: number) {
  const [posts, setPosts] = useState<CompetitorPostWithRole[]>([]);
  const [patterns, setPatterns] = useState<CompetitorPattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
    const [postsRes, patternsRes] = await Promise.all([
      supabase
        .from('competitor_posts')
        .select('id, competitor_name, competitor_role, post_text, post_date, likes_count, comments_count, reposts_count, post_type, topic_category, hook_pattern, is_top_performer, has_opportunity, the_opportunity, suggested_angle, suggested_format, opportunity_actioned, linkedin_post_url, linkedin_profile_url')
        .order('post_date', { ascending: false })
        .limit(200),
      supabase
        .from('competitor_patterns')
        .select('id, competitor_name, post_count, patterns_json, pattern_text')
        .order('post_count', { ascending: false }),
    ]);
    if (postsRes.error) throw postsRes.error;
    if (patternsRes.error) throw patternsRes.error;
    setPosts((postsRes.data || []).map(mapPost));
    setPatterns((patternsRes.data || []).map(mapPattern));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load competitors');
      toastError('load competitors', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  // Aggregate stats per competitor over the caller's window. All of the real work
  // is in the pure competitorStatsFor above so it can be tested directly.
  const competitorWindow = useMemo(
    () => competitorStatsFor(patterns, posts, days, Date.now()),
    [patterns, posts, days],
  );
  const competitorStats = competitorWindow.stats;

  const opportunities = useMemo(() =>
    posts.filter((p) => p.hasOpportunity && !p.opportunityActioned),
    [posts]
  );

  const markOpportunityActioned = async (id: string) => {
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, opportunityActioned: true } : p)));
    try {
      await dashboardAction('competitor_posts', id, 'opportunity_actioned', 'true');
      await fetch();
    } catch (err) {
      toastError('mark opportunity', err);
      setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, opportunityActioned: false } : p)));
    }
  };

  return {
    posts, patterns, competitorStats,
    styleOnly: competitorWindow.styleOnly,
    unclassified: competitorWindow.unclassified,
    windowDays: competitorWindow.windowDays,
    asOf: competitorWindow.asOf,
    opportunities, loading, error, refresh: fetch, markOpportunityActioned,
  };
}

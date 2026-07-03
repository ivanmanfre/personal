import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { dashboardAction, toastError } from '../lib/dashboardActions';
import { withinWindow } from '../lib/withinWindow';
import type { CompetitorPost, CompetitorPattern } from '../types/dashboard';

function mapPost(row: any): CompetitorPost {
  return {
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

export function useCompetitors(days?: number) {
  const [posts, setPosts] = useState<CompetitorPost[]>([]);
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
        .select('id, competitor_name, post_text, post_date, likes_count, comments_count, reposts_count, post_type, topic_category, hook_pattern, is_top_performer, has_opportunity, the_opportunity, suggested_angle, suggested_format, opportunity_actioned, linkedin_post_url, linkedin_profile_url')
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

  // Aggregate stats per competitor. When `days` is provided, only competitor
  // posts inside that window count toward the averages + recentPostCount, so the
  // benchmark reflects the same range the rest of the panel is showing.
  const competitorStats = useMemo(() => {
    const now = Date.now();
    const inWindow = days == null ? posts : posts.filter((cp) => withinWindow(cp.postDate, days, now));
    return patterns.map((p) => {
      const cPosts = inWindow.filter((cp) => cp.competitorName === p.competitorName);
      const avgLikes = cPosts.length ? Math.round(cPosts.reduce((s, c) => s + c.likesCount, 0) / cPosts.length) : 0;
      const avgComments = cPosts.length ? Math.round(cPosts.reduce((s, c) => s + c.commentsCount, 0) / cPosts.length) : 0;
      return { ...p, avgLikes, avgComments, recentPostCount: cPosts.length };
    });
  }, [patterns, posts, days]);

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

  return { posts, patterns, competitorStats, opportunities, loading, error, refresh: fetch, markOpportunityActioned };
}

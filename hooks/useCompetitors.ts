import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { dashboardAction } from '../lib/dashboardActions';
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

export function useCompetitors() {
  const [posts, setPosts] = useState<CompetitorPost[]>([]);
  const [patterns, setPatterns] = useState<CompetitorPattern[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
    const [postsRes, patternsRes] = await Promise.all([
      supabase
        .from('competitor_posts')
        .select('id, competitor_name, post_text, post_date, likes_count, comments_count, reposts_count, post_type, topic_category, hook_pattern, is_top_performer, has_opportunity, the_opportunity, suggested_angle, suggested_format, opportunity_actioned')
        .order('post_date', { ascending: false })
        .limit(200),
      supabase
        .from('competitor_patterns')
        .select('id, competitor_name, post_count, patterns_json, pattern_text')
        .order('post_count', { ascending: false }),
    ]);
    setPosts((postsRes.data || []).map(mapPost));
    setPatterns((patternsRes.data || []).map(mapPattern));
    } catch (err) {
      console.error('Failed to fetch competitors:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  // Aggregate stats per competitor
  const competitorStats = patterns.map((p) => {
    const cPosts = posts.filter((cp) => cp.competitorName === p.competitorName);
    const avgLikes = cPosts.length ? Math.round(cPosts.reduce((s, c) => s + c.likesCount, 0) / cPosts.length) : 0;
    const avgComments = cPosts.length ? Math.round(cPosts.reduce((s, c) => s + c.commentsCount, 0) / cPosts.length) : 0;
    return { ...p, avgLikes, avgComments, recentPostCount: cPosts.length };
  });

  const opportunities = posts.filter((p) => p.hasOpportunity && !p.opportunityActioned);

  const markOpportunityActioned = async (id: string) => {
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, opportunityActioned: true } : p)));
    await dashboardAction('competitor_posts', id, 'opportunity_actioned', 'true');
  };

  return { posts, patterns, competitorStats, opportunities, loading, refresh: fetch, markOpportunityActioned };
}

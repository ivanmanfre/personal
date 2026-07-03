import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { toastError } from '../lib/dashboardActions';
import { isPostScraped } from '../lib/scrapeStatus';
import type { OwnPost } from '../types/dashboard';

function mapPost(row: any): OwnPost {
  return {
    id: row.id,
    text: row.post_text || '',
    postType: row.post_type || 'unknown',
    likes: row.num_likes || 0,
    comments: row.num_comments || 0,
    shares: row.num_shares || 0,
    impressions: row.num_impressions || 0,
    postedAt: row.posted_at,
    linkedinUrl: row.linkedin_url || '',
    topicCategory: row.topic_category,
    hookPattern: row.hook_pattern,
    pillar: row.pillar ?? null,
    metricsUpdatedAt: row.metrics_updated_at ?? null,
  };
}

export function useOwnPosts(days: number = 30) {
  const [posts, setPosts] = useState<OwnPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const since = new Date(Date.now() - days * 86400000).toISOString();
      const { data, error: qErr } = await supabase
        .from('own_posts')
        .select('id, post_text, post_type, num_likes, num_comments, num_shares, num_impressions, posted_at, linkedin_url, topic_category, hook_pattern, pillar, metrics_updated_at')
        .gte('posted_at', since)
        .order('posted_at', { ascending: false });
      if (qErr) throw qErr;
      setPosts((data || []).map(mapPost));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load posts');
      toastError('load posts', err);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { fetch(); }, [fetch]);

  const totalImpressions = posts.reduce((s, p) => s + p.impressions, 0);
  const totalLikes = posts.reduce((s, p) => s + p.likes, 0);
  const totalComments = posts.reduce((s, p) => s + p.comments, 0);
  const totalShares = posts.reduce((s, p) => s + p.shares, 0);

  // Averages are honest: only scraped posts count (never-scraped placeholders
  // would otherwise drag the mean to zero). Legacy rows with real metrics but no
  // timestamp still count (see isPostScraped).
  const scraped = posts.filter(isPostScraped);
  const scrapedImpressions = scraped.reduce((s, p) => s + p.impressions, 0);
  const scrapedEngagements = scraped.reduce((s, p) => s + p.likes + p.comments + p.shares, 0);
  const avgImpressions = scraped.length ? Math.round(scrapedImpressions / scraped.length) : 0;
  const engagementRate = scrapedImpressions > 0
    ? (scrapedEngagements / scrapedImpressions * 100).toFixed(2)
    : '0';
  const lastScrapedAt = posts.reduce<string | null>((max, p) => {
    if (!p.metricsUpdatedAt) return max;
    return !max || p.metricsUpdatedAt > max ? p.metricsUpdatedAt : max;
  }, null);

  return {
    posts,
    loading,
    error,
    refresh: fetch,
    stats: {
      totalImpressions, totalLikes, totalComments, totalShares,
      avgImpressions, engagementRate, count: posts.length,
      scrapedCount: scraped.length, unscrapedCount: posts.length - scraped.length,
      lastScrapedAt,
    },
  };
}

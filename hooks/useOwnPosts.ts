import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { toastError } from '../lib/dashboardActions';
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
  };
}

export function useOwnPosts(days: number = 30) {
  const [posts, setPosts] = useState<OwnPost[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const since = new Date(Date.now() - days * 86400000).toISOString();
      const { data } = await supabase
        .from('own_posts')
        .select('id, post_text, post_type, num_likes, num_comments, num_shares, num_impressions, posted_at, linkedin_url, topic_category, hook_pattern')
        .gte('posted_at', since)
        .order('posted_at', { ascending: false });
      setPosts((data || []).map(mapPost));
    } catch (err) {
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
  const avgImpressions = posts.length ? Math.round(totalImpressions / posts.length) : 0;
  const engagementRate = totalImpressions > 0
    ? ((totalLikes + totalComments + totalShares) / totalImpressions * 100).toFixed(2)
    : '0';

  return {
    posts,
    loading,
    refresh: fetch,
    stats: { totalImpressions, totalLikes, totalComments, totalShares, avgImpressions, engagementRate, count: posts.length },
  };
}

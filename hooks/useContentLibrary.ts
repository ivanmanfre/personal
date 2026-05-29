import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { toastError } from '../lib/dashboardActions';

export interface CarouselDraft {
  id: string;
  title: string;
  topic: string | null;
  status: string;
  imageUrls: string[];
  postBody: string | null;
  igCaption: string | null;
  qa: { verdict?: string; failing_slides?: number[]; feedback?: string } | null;
  styleId: string | null;
  scheduledAt: string | null;
  updatedAt: string;
}

function mapDraft(row: any): CarouselDraft {
  return {
    id: row.id,
    title: row.title || '(untitled)',
    topic: row.topic,
    status: row.status || 'draft',
    imageUrls: row.image_urls || [],
    postBody: row.post_body,
    igCaption: row.ig_caption,
    qa: row.qa,
    styleId: row.style_id,
    scheduledAt: row.scheduled_at,
    updatedAt: row.updated_at,
  };
}

export function useContentLibrary() {
  const [drafts, setDrafts] = useState<CarouselDraft[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('carousel_drafts')
        .select('id, title, topic, status, image_urls, post_body, ig_caption, qa, style_id, scheduled_at, updated_at')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      setDrafts((data || []).map(mapDraft));
    } catch (err) {
      toastError('load carousel drafts', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { drafts, loading, refresh };
}

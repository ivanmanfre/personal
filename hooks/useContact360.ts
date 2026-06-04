import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { toastError } from '../lib/dashboardActions';
import { mapContact } from './useContacts';
import type { Contact360, ContactLink } from '../types/dashboard';

const mapLink = (r: any): ContactLink => ({
  id: r.id, contactId: r.contact_id, sourceType: r.source_type, sourceId: r.source_id,
  sourceRef: r.source_ref, linkedBy: r.linked_by, confidence: r.confidence,
  reviewStatus: r.review_status, createdAt: r.created_at,
});

export function useContact360(contactId: string | null) {
  const [data, setData] = useState<Contact360 | null>(null);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!contactId) { setData(null); return; }
    setLoading(true);
    try {
      const { data: res, error } = await supabase.rpc('get_contact_360', { p_contact: contactId });
      if (error) throw error;
      const raw = res as any;
      setData(raw ? { contact: mapContact(raw.contact), links: (raw.links ?? []).map(mapLink), timeline: raw.timeline ?? [] } : null);
    } catch (err) { toastError('load contact record', err); }
    finally { setLoading(false); }
  }, [contactId]);

  useEffect(() => { fetch(); }, [fetch]);
  return { data, loading, refetch: fetch };
}

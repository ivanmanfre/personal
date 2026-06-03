import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { toastError } from '../lib/dashboardActions';
import type { Contact360 } from '../types/dashboard';

export function useContact360(contactId: string | null) {
  const [data, setData] = useState<Contact360 | null>(null);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!contactId) { setData(null); return; }
    setLoading(true);
    try {
      const { data: res, error } = await supabase.rpc('get_contact_360', { p_contact: contactId });
      if (error) throw error;
      setData(res as Contact360);
    } catch (err) { toastError('load contact record', err); }
    finally { setLoading(false); }
  }, [contactId]);

  useEffect(() => { fetch(); }, [fetch]);
  return { data, loading, refetch: fetch };
}

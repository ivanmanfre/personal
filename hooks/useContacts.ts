import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { dashboardAction, toastError, toastSuccess } from '../lib/dashboardActions';
import type { Contact, ContactLink } from '../types/dashboard';

export const mapContact = (r: any): Contact => ({
  id: r.id, name: r.name, company: r.company,
  linkedinUrl: r.linkedin_url, email: r.email, icpScore: r.icp_score,
  stage: r.stage, nextAction: r.next_action, nextActionDue: r.next_action_due,
  ownerNotes: r.owner_notes, referredBy: r.referred_by,
  stageSuggested: r.stage_suggested ?? null,
  stageManual: r.stage_manual ?? false,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

export function useContacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [pending, setPending] = useState<ContactLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: cs }, { data: pl }] = await Promise.all([
        supabase.from('contacts').select('*').is('merged_into', null)
          .order('next_action_due', { ascending: true, nullsFirst: false }).limit(500),
        supabase.from('contact_links').select('*').eq('review_status', 'pending'),
      ]);
      setContacts((cs || []).map(mapContact));
      setPending((pl || []).map((r: any): ContactLink => ({
        id: r.id, contactId: r.contact_id, sourceType: r.source_type, sourceId: r.source_id,
        sourceRef: r.source_ref, linkedBy: r.linked_by, confidence: r.confidence,
        reviewStatus: r.review_status, createdAt: r.created_at,
      })));
    } catch (err) { toastError('load contacts', err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const resolveNow = useCallback(async () => {
    setResolving(true);
    try {
      const { data, error } = await supabase.rpc('resolve_contacts');
      if (error) throw error;
      toastSuccess(`Resolver: +${data?.created ?? 0} new, ${data?.linked ?? 0} linked, ${data?.pending ?? 0} to review`);
      await fetchAll();
    } catch (err) { toastError('resolve contacts', err); }
    finally { setResolving(false); }
  }, [fetchAll]);

  const updateField = useCallback(async (id: string, field: keyof Contact, value: string) => {
    const col = ({ stage:'stage', nextAction:'next_action', nextActionDue:'next_action_due',
                   ownerNotes:'owner_notes' } as Record<string,string>)[field];
    if (!col) return;
    setContacts(cs => cs.map(c => c.id === id ? { ...c, [field]: value } as Contact : c));
    try { await dashboardAction('contacts', id, col, value); }
    catch (err) { toastError('update contact', err); fetchAll(); }
  }, [fetchAll]);

  const setStage = useCallback(async (id: string, value: string) => {
    setContacts(cs => cs.map(c => c.id === id ? { ...c, stage: value, stageManual: true } as Contact : c));
    try {
      const { error } = await supabase.from('contacts').update({ stage: value, stage_manual: true }).eq('id', id);
      if (error) throw error;
    } catch (err) { toastError('set stage', err); fetchAll(); }
  }, [fetchAll]);

  const reviewLink = useCallback(async (linkId: string, decision: 'confirm' | 'reject') => {
    const patch = decision === 'confirm'
      ? { review_status: 'active', confidence: 'confirmed' }
      : { review_status: 'rejected' };
    setPending(p => p.filter(l => l.id !== linkId));
    try {
      const { error } = await supabase.from('contact_links').update(patch).eq('id', linkId);
      if (error) throw error;
      if (decision === 'confirm') await fetchAll();
    } catch (err) { toastError('review match', err); fetchAll(); }
  }, [fetchAll]);

  const stageCounts = useMemo(() => contacts.reduce((a, c) => {
    a[c.stage] = (a[c.stage] || 0) + 1; return a;
  }, {} as Record<string, number>), [contacts]);

  return { contacts, pending, loading, resolving, resolveNow, updateField, setStage, reviewLink, stageCounts, refetch: fetchAll };
}

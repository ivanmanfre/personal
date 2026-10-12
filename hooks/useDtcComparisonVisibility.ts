import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { DtcComparisonV1 } from '../lib/dtcComparisonTypes';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HTTPS = /^https:\/\//i;
const nonempty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

export function validComparison(value: unknown, now = Date.now()): value is DtcComparisonV1 {
  if (!value || typeof value !== 'object') return false;
  const c = value as DtcComparisonV1;
  if (c.version !== 'dtc-comparison-v1' || c.status !== 'approved' || !UUID.test(c.revision_id || '')
      || !nonempty(c.base_fingerprint) || !Number.isFinite(Date.parse(c.observed_at))
      || !Number.isFinite(Date.parse(c.expires_at)) || Date.parse(c.expires_at) <= now
      || !Array.isArray(c.observations) || c.observations.length < 1 || c.observations.length > 2) return false;
  if (new Set(c.observations.map(o => o?.id)).size !== c.observations.length) return false;
  return c.observations.every(o => {
    if (!o || !['close_alternative', 'category_benchmark'].includes(o.relationship)
      || ![o.id, o.title, o.capability, o.why_relevant, o.own_observation, o.peer_observation, o.proposed_test, o.limitations,
            o.store_names?.prospect, o.store_names?.peer, o.store_domains?.prospect, o.store_domains?.peer].every(nonempty)
      || !nonempty(o.store_entity_ids?.prospect) || !nonempty(o.store_entity_ids?.peer)
      || o.store_entity_ids.prospect === o.store_entity_ids.peer
      || !Array.isArray(o.source_links) || o.source_links.length < 2) return false;
    const ids = new Set<string>();
    for (const link of o.source_links) {
      if (!nonempty(link?.entity_id) || !nonempty(link?.url) || !HTTPS.test(link.url)
          || (link.label !== undefined && typeof link.label !== 'string')) return false;
      try { if (!new URL(link.url).hostname) return false; } catch { return false; }
      ids.add(link.entity_id);
    }
    if (ids.size !== 2 || !ids.has(o.store_entity_ids.prospect) || !ids.has(o.store_entity_ids.peer)) return false;
    if (o.evidence_images && (!Array.isArray(o.evidence_images) || o.evidence_images.some(i =>
      !nonempty(i?.alt) || !nonempty(i?.source_id) || !nonempty(i?.url) || !HTTPS.test(i.url)))) return false;
    return true;
  });
}

export function useDtcComparisonVisibility(slug: string, raw: unknown): DtcComparisonV1 | null {
  const comparison = validComparison(raw) ? raw : null;
  const revision = comparison?.revision_id || '';
  const expiry = comparison?.expires_at || '';
  const [approvedKey, setApprovedKey] = useState('');
  const key = `${slug}:${revision}:${expiry}`;

  useEffect(() => {
    setApprovedKey('');
    if (!comparison || !slug) return;
    let cancelled = false;
    const until = Date.parse(expiry) - Date.now();
    if (until <= 0) return;
    const timer = window.setTimeout(() => { if (!cancelled) setApprovedKey(''); }, Math.min(until, 2147483647));
    void (async () => {
      try {
        const { data, error } = await supabase.rpc('dtc_comparison_visible', { scan_slug: slug, revision_id: revision });
        if (cancelled || error) return;
        const reply = Array.isArray(data) ? data[0] : data;
        if (reply?.displayable === true && reply.revision_id_out === revision
          && Number.isFinite(Date.parse(reply.expires_at))
          && Date.parse(reply.expires_at) > Date.now()
          && Date.parse(expiry) > Date.now()) setApprovedKey(key);
      } catch { /* Fail closed for this section only. */ }
    })();
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [key, comparison, slug, revision, expiry]);

  return comparison && approvedKey === key && Date.parse(expiry) > Date.now() ? comparison : null;
}

/// <reference types="vite/client" />
import type { JourneyFixture } from './model';

const url = import.meta.env.VITE_SUPABASE_URL || 'https://bjbvqvzbzczjbatgmccb.supabase.co';
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

/** Builds the journey fixture from a completed scan row, the same anonymous read the public report uses. */
export async function loadFixture(slug: string): Promise<JourneyFixture> {
  const query = `${url}/rest/v1/scans?select=company_slug,company_name,domain,report_json&company_slug=eq.${encodeURIComponent(slug)}&status=eq.complete&limit=1`;
  const res = await window.fetch(query, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!res.ok) throw new Error(`Scan read failed (${res.status})`);
  const rows = await res.json() as { company_slug: string; company_name: string | null; domain: string | null; report_json: { content_system?: Record<string, unknown> } | null }[];
  const data = rows[0];
  if (!data) throw new Error(`No completed scan for ${slug}`);
  const cs = data.report_json?.content_system || {};
  const founder = (cs.founder || {}) as { name?: string; first_name?: string; headline?: string; avatar_url?: string };
  const samples = (cs.sample_output || {}) as JourneyFixture['samples'];
  const icp = (samples as { icp_targeting?: { icp_line?: string; segments?: { label: string; note: string }[] } }).icp_targeting;
  const segment = icp?.segments?.[0];
  const name = founder.name || data.company_name || slug;
  return {
    slug, domain: data.domain || '',
    pillars: cs.pillars as JourneyFixture['pillars'], audience: cs.audience as JourneyFixture['audience'], thesis: typeof cs.thesis === 'string' ? cs.thesis : undefined,
    founder: { name, firstName: founder.first_name || name.split(' ')[0], company: data.company_name || '', headline: founder.headline || '', avatarUrl: founder.avatar_url },
    buyer: { role: segment?.label || 'A reader from your feed', project: segment?.note || icp?.icp_line || '' },
    samples,
    lm_cover_local: samples.lm?.cover_url || '',
    source: { kind: 'original-scan', url: `https://inboundonsteroids.com/scan/${slug}/`, capturedOn: new Date().toISOString().slice(0, 10) },
  };
}

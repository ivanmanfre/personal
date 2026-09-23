/// <reference types="vite/client" />
import type { JourneyFixture } from './model';
import {toStoryFixture,type StoryScanRow} from '../../../scan/story/adapter';

const url = import.meta.env.VITE_SUPABASE_URL || 'https://bjbvqvzbzczjbatgmccb.supabase.co';
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

/** Builds the journey fixture from a completed scan row, the same anonymous read the public report uses. */
export async function loadFixture(slug: string): Promise<JourneyFixture> {
  const query = `${url}/rest/v1/scans?select=company_slug,company_name,domain,completed_at,report_json&company_slug=eq.${encodeURIComponent(slug)}&status=eq.complete&limit=1`;
  type Row = StoryScanRow;
  // A published standalone page carries its scan inline: the artifact sandbox blocks outside fetches.
  const baked = (window as unknown as { __SCAN_ROW__?: Row }).__SCAN_ROW__;
  let data: Row | undefined;
  if (baked && baked.company_slug === slug) data = baked;
  else {
    const res = await window.fetch(query, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!res.ok) throw new Error(`Scan read failed (${res.status})`);
    data = (await res.json() as Row[])[0];
  }
  if (!data) throw new Error(`No completed scan for ${slug}`);
  return toStoryFixture(data);
}

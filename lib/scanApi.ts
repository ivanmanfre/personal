// lib/scanApi.ts
import { supabase } from './supabase';
import type { ProspectToken, WebhookResponse } from './scanTypes';

const N8N_WEBHOOK = 'https://n8n.ivanmanfredi.com/webhook/ai-opportunity-scan';

export async function submitScan(params: {
  url: string;
  email: string;
  prospectToken?: string | null;
}): Promise<WebhookResponse> {
  const res = await fetch(N8N_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: params.url,
      email: params.email,
      prospect_token: params.prospectToken ?? null,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => 'Network error');
    throw new Error(`Scan submission failed: ${text}`);
  }

  return res.json() as Promise<WebhookResponse>;
}

export async function lookupProspectToken(token: string): Promise<ProspectToken | null> {
  const { data, error } = await supabase
    .from('scan_prospect_tokens')
    .select('token, company_name, company_domain, connection_name')
    .eq('token', token)
    .maybeSingle();

  if (error || !data) return null;
  return data as ProspectToken;
}

export function gradeColor(grade: string): string {
  // Colors picked for WCAG AA contrast on #F7F4EF paper bg.
  if (grade.startsWith('A')) return '#4C6E3D'; // sage — 5.31:1
  if (grade.startsWith('B')) return '#5C8049'; // muted sage — 4.7:1
  if (grade.startsWith('C')) return '#B45309'; // amber-700 — 4.04:1 (was D97706 = 2.90, fails)
  if (grade.startsWith('D')) return '#A85439'; // terra — 4.79:1 (was EA580C = 3.5, borderline)
  return '#9B2C2C';                            // crimson — 6.0:1 (was DC2626 = 4.4)
}

export function scoreToGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B+';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C+';
  if (score >= 50) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

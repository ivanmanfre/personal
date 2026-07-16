// Hook Grader API — n8n webhook, same chassis pattern as scanApi.ts.
const N8N_WEBHOOK = 'https://n8n.ivanmanfredi.com/webhook/hook-grader';

export interface GradeVerdict {
  hook: string;
  width_verdict: 'WIDE' | 'NARROW' | 'MIXED';
  lets_in: string;
  turns_away: string;
  fit_estimate_pct: number;
  fit_reasoning: string;
  the_leak: string;
  rewrite: string;
  rewrite_fit_estimate_pct: number;
  one_move: string;
}

export async function submitGrade(hook: string, audience: string): Promise<GradeVerdict> {
  const res = await fetch(N8N_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hook, audience }),
  });
  if (!res.ok) throw new Error(`grade failed (${res.status})`);
  const data = await res.json();
  if (!data?.ok || !data?.verdict) throw new Error(data?.error || 'grade failed');
  return data.verdict as GradeVerdict;
}

export async function submitGradeCapture(params: {
  email: string;
  hook: string;
  audience: string;
  verdict: GradeVerdict | null;
}): Promise<void> {
  const utm = window.location.search || null;
  const res = await fetch(N8N_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'capture', ...params, utm }),
  });
  if (!res.ok) throw new Error(`capture failed (${res.status})`);
}

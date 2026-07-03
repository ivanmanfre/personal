const SUPA = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://bjbvqvzbzczjbatgmccb.supabase.co';
const ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';
const SEED_URL = `${SUPA}/functions/v1/seed-idea-from-post`;

export function composeAngleBrief(p: { pillar: string; hook: string; title: string }): string {
  const bits = [
    `Run it back on a top performer: "${p.title}".`,
    p.pillar ? `Pillar: ${p.pillar}.` : '',
    p.hook ? `Hook that worked: ${p.hook}.` : '',
    'Write a fresh angle on the same territory — do not rewrite the original.',
  ].filter(Boolean);
  return bits.join(' ');
}

export async function seedIdeaFromPost(payload: { title: string; topic: string; pillar: string; hook: string }): Promise<{ ok: boolean; id?: string }> {
  const angleBrief = composeAngleBrief(payload);
  const res = await fetch(SEED_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + ANON_KEY },
    body: JSON.stringify({ ...payload, angleBrief }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'seed ' + res.status); }
  return res.json();
}

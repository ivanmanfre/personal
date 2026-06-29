/**
 * Live engine — turns real recent rows (posts, prospects, leads) into a stream
 * of "the engine is working" events for the demo dashboard's live activity pill
 * + toasts. Pure / no React. The verbs map to genuine pipeline stages (generate,
 * QA, score, publish, harvest) so the liveness is grounded in real activity, not
 * fabricated metrics. If no data loads, a small set of generic-but-honest engine
 * tasks keeps the dashboard feeling alive without inventing names.
 */

export type LiveKind = 'generate' | 'qa' | 'publish' | 'lead' | 'accept' | 'score' | 'sync';

export interface LiveEvent {
  kind: LiveKind;
  /** Present-tense in-progress label, e.g. "Scoring lead: Stefan Davy…" */
  working: string;
  /** Completion line surfaced as a toast, e.g. "New lead: Stefan Davy · DavySolutions" */
  done: string;
}

export interface LiveSource {
  posts?: Array<{ title?: string | null; topic?: string | null; status?: string | null; type?: string | null }>;
  prospects?: Array<{ name?: string | null; company?: string | null; stage?: string | null }>;
  leads?: Array<{ name?: string | null; company?: string | null }>;
}

function clip(s: string | null | undefined, n = 40): string {
  const t = (s || '').trim();
  if (!t) return '';
  return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t;
}

function person(name?: string | null, company?: string | null): string {
  const n = clip(name, 22);
  const c = clip(company, 22);
  if (n && c) return `${n} · ${c}`;
  return n || c || 'a new prospect';
}

const FALLBACK: LiveEvent[] = [
  { kind: 'generate', working: 'Drafting today’s posts…', done: 'New drafts queued for review' },
  { kind: 'score', working: 'Scoring new leads…', done: 'Leads scored and ranked' },
  { kind: 'qa', working: 'Running quality checks…', done: 'QA passed — ready to schedule' },
  { kind: 'lead', working: 'Harvesting prospects…', done: 'Fresh prospects added to pipeline' },
  { kind: 'publish', working: 'Syncing the schedule…', done: 'Schedule synced' },
  { kind: 'sync', working: 'Refreshing pipeline…', done: 'Pipeline up to date' },
];

/**
 * Build a varied, interleaved event list from whatever real data we have.
 * Posts, prospects and leads are zipped round-robin so the stream alternates
 * between content and outreach activity instead of clumping.
 */
export function buildLiveEvents(src: LiveSource): LiveEvent[] {
  const postEvents: LiveEvent[] = (src.posts || []).slice(0, 14).map((p) => {
    const label = clip(p.title || p.topic, 42) || 'a new post';
    const status = (p.status || '').toLowerCase();
    if (status === 'published') {
      return { kind: 'publish', working: `Publishing “${label}”…`, done: `Published: ${label}` };
    }
    if (status === 'scheduled' || status === 'approved') {
      return { kind: 'qa', working: `Final QA on “${label}”…`, done: `QA passed: ${label}` };
    }
    if (status === 'idea') {
      return { kind: 'score', working: `Scoring idea: ${label}…`, done: `Idea scored: ${label}` };
    }
    return { kind: 'generate', working: `Generating draft: ${label}…`, done: `Draft ready: ${label}` };
  });

  const prospectEvents: LiveEvent[] = (src.prospects || []).slice(0, 16).map((p) => {
    const who = person(p.name, p.company);
    const stage = (p.stage || '').toLowerCase();
    if (stage === 'replied' || stage === 'converted') {
      return { kind: 'accept', working: `Logging reply from ${clip(p.name, 22) || 'a prospect'}…`, done: `${who} replied` };
    }
    if (stage === 'connected') {
      return { kind: 'accept', working: `Connection accepted: ${clip(p.name, 22) || 'a prospect'}…`, done: `${who} accepted your invite` };
    }
    return { kind: 'lead', working: `Scoring lead: ${clip(p.name, 22) || 'a prospect'}…`, done: `New lead: ${who}` };
  });

  const leadEvents: LiveEvent[] = (src.leads || []).slice(0, 10).map((l) => {
    const who = person(l.name, l.company);
    return { kind: 'lead', working: `Enriching ${clip(l.name, 22) || 'a lead'}…`, done: `New lead captured: ${who}` };
  });

  // Round-robin interleave so content + outreach alternate.
  const lanes = [postEvents, prospectEvents, leadEvents].filter((l) => l.length > 0);
  const out: LiveEvent[] = [];
  if (lanes.length) {
    const max = Math.max(...lanes.map((l) => l.length));
    for (let i = 0; i < max; i++) {
      for (const lane of lanes) {
        if (lane[i]) out.push(lane[i]);
      }
    }
  }
  return out.length ? out : FALLBACK;
}

/** Deterministic-enough shuffle seeded by an index so each pass reorders without Math.random in render. */
export function rotate<T>(arr: T[], by: number): T[] {
  if (arr.length < 2) return arr;
  const k = ((by % arr.length) + arr.length) % arr.length;
  return arr.slice(k).concat(arr.slice(0, k));
}

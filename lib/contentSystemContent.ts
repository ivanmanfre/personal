// All buyer-facing copy for /content-system. Outcome-led; the `how` line is the
// only place implementation sophistication appears (reason-to-believe).
// HONESTY RULE: only claim live capabilities. Anything not fully live is marked.

export interface ContentPromise { headline: string; benefit: string; how: string; }
export const PROMISES: ContentPromise[] = [
  { headline: 'Never face a blank page', benefit: "It decides what to post — pulling ideas from across the web and your own calls, then ranking them by what'll actually land.", how: '6-source idea curator + nightly fit-scoring brain.' },
  { headline: 'It sounds like you — not AI', benefit: 'Trained on your voice and grounded in your real conversations, so every post reads like you wrote it on your best day.', how: 'Voice training + retrieval over your transcripts.' },
  { headline: 'It never ships slop', benefit: 'Every post is quality-checked against the tells that make content feel AI-written — and rewritten until it passes.', how: 'Deterministic quality gates + a 9-point review that self-rewrites.' },
  { headline: 'One idea becomes everything', benefit: 'A single idea turns into a post, a carousel (9 on-brand styles), a short video, and a lead magnet — all at once.', how: 'Multi-format engine with real-logo, on-brand rendering.' },
  { headline: 'Always first to the trend', benefit: "The moment a big AI story breaks, you've got an on-brand post ready — while everyone else is still reading the news.", how: 'News radar scanning every 2h + an instant alert to you.' },
  { headline: 'It runs — and learns', benefit: 'Publishes natively to LinkedIn, captures qualified leads through self-publishing lead magnets, and tracks what works.', how: 'Native publishing + 10 lead-magnet formats + a performance loop.' },
];

export interface Metric { value: string; label: string; }
export const METRICS: Metric[] = [
  { value: '5+',  label: 'posts a week, in your voice' },
  { value: '0',   label: 'blank pages — ever' },
  { value: '10',  label: 'lead-magnet formats that build themselves' },
  { value: 'hrs', label: 'on a breaking trend — not days' },
];

export interface LmFormat { name: string; blurb: string; coming?: boolean; }
export const LM_FORMATS: LmFormat[] = [
  { name: 'Interactive Assessment',  blurb: 'Scored quiz that qualifies the reader and books the right next step.' },
  { name: 'Calculator',              blurb: 'Live ROI / cost calculator tailored to your offer.' },
  { name: 'Guide',                   blurb: 'Deep, on-brand playbook — every promise delivered inline.' },
  { name: 'AI Kit',                  blurb: 'Ready-to-run prompts and agents — proof you actually build.' },
  { name: 'n8n Workflow',            blurb: 'A real importable automation, not a screenshot.' },
  { name: 'Stack Picker',            blurb: "Guided tool selector for the reader's situation." },
  { name: 'Annotated Architecture',  blurb: 'A diagrammed system teardown they can copy.' },
  { name: 'Skill Pack',              blurb: 'Packaged capabilities the reader installs.' },
  { name: 'Checklist',               blurb: 'The fast-win format — instant, shareable.' },
  { name: 'Live AI Walkthrough',     blurb: "Runs on the reader's own input, live.", coming: true },
];

export interface LmPromise { headline: string; benefit: string; how: string; }
export const LM_PROMISES: LmPromise[] = [
  { headline: 'It builds AND publishes itself', benefit: 'One request → a finished, interactive asset on a live page at your domain. No designer, no dev, no upload.', how: 'Auto-generated + auto-deployed hosted resource pages.' },
  { headline: 'It qualifies leads for you', benefit: 'Every signup is scored by fit — top prospects get a call link, the rest get nurtured. No wasted calendar slots.', how: 'Qualification-gated CTAs that route by persona + score.' },
  { headline: 'It launches the whole campaign', benefit: 'Each magnet ships with its launch post, DM, email sequence, and cover — written and scheduled in one pass.', how: 'One run produces the asset + the full distribution kit.' },
];

export const ONE_IDEA_FORMATS: string[] = ['Text post', 'Single image', 'Carousel (9 styles)', 'Short video', 'Lead magnet', 'IG caption', 'Newsletter'];

export const SCOPE: { inScope: string[]; notInScope: string[] } = {
  inScope: [
    'Voice training on your real posts + calls',
    'The idea curator, scorer, and newsjack radar',
    'Multi-format generation (posts, carousels, video, lead magnets)',
    'Quality + anti-slop gating on every piece',
    'Native LinkedIn publishing + the performance loop',
    'A dashboard where you approve and schedule',
  ],
  notInScope: [
    "We don't write your content by hand",
    'No paid ads management',
    'No general marketing strategy coaching',
    'No guaranteed follower or engagement numbers',
  ],
};

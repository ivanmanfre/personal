// All buyer-facing copy for /content-system. Outcome-led; the `how` line is the
// only place implementation sophistication appears (reason-to-believe).
// HONESTY RULE: only claim live capabilities. Anything not fully live is marked.

export interface ContentPromise { headline: string; benefit: string; how: string; }
export const PROMISES: ContentPromise[] = [
  { headline: 'Never face a blank page', benefit: "It decides what to post, pulling ideas from across the web and your own calls, then ranking them by what'll actually land.", how: '6-source idea curator + nightly fit-scoring brain.' },
  { headline: 'It sounds like you, not AI', benefit: 'Trained on your voice and grounded in your real conversations, so every post reads like you wrote it on your best day.', how: 'Voice training + retrieval over your transcripts.' },
  { headline: 'It never ships slop', benefit: 'Every post is quality-checked against the tells that make content feel AI-written, then rewritten until it passes.', how: 'Deterministic quality gates + a 9-point review that self-rewrites.' },
  { headline: 'One idea becomes everything', benefit: 'A single idea turns into a post, a carousel (9 on-brand styles), and a lead magnet, all at once.', how: 'Multi-format engine with real-logo, on-brand rendering.' },
  { headline: 'Always first to the trend', benefit: "The moment a big AI story breaks, you've got an on-brand post ready while everyone else is still reading the news.", how: 'News radar scanning every 2h + an instant alert to you.' },
  { headline: 'It ships, then tells you what works', benefit: 'Publishes natively to LinkedIn, captures qualified leads through self-publishing lead magnets, and tracks what works.', how: 'Native publishing + 10 lead-magnet formats + a performance loop.' },
];

export interface Metric { value: string; label: string; }
// Concrete engine specs (reason-to-believe), not client outcomes (those live in
// the fold proof bar + case studies) and not pitch restatement.
export const METRICS: Metric[] = [
  { value: '6',  label: 'sources feeding the idea curator' },
  { value: '9',  label: 'on-brand carousel styles' },
  { value: '10', label: 'self-building lead-magnet formats' },
  { value: '2h', label: 'news radar cadence for breaking trends' },
];

// Each format shows a REAL, currently-live lead magnet the engine published,
// scraped from resources.ivanmanfredi.com. Only live formats are listed here
// (honesty rule). Breadth beyond these is acknowledged in copy, not faked.
export interface LmFormat { name: string; blurb: string; shot: string; alt: string; }
export const LM_FORMATS: LmFormat[] = [
  { name: 'Interactive Assessment', blurb: 'A scored quiz that qualifies the reader and books the right next step.', shot: '/content-system/lm/assessment-live.webp', alt: 'A live interactive assessment lead magnet, on-brand and scored' },
  { name: 'Calculator',             blurb: 'A live ROI or capacity calculator tailored to your offer.', shot: '/content-system/lm/calculator-live.webp', alt: 'A live capacity calculator lead magnet' },
  { name: 'Guide',                  blurb: 'A deep, on-brand playbook with every promise delivered inline.', shot: '/content-system/lm/guide.webp', alt: 'A live, published Guide lead magnet on a hosted page' },
  { name: 'AI Kit',                 blurb: 'Ready-to-run prompts and agents, proof you actually build.', shot: '/content-system/lm/ai-kit.webp', alt: 'A live AI Kit lead magnet with ready-to-run prompts' },
  { name: 'n8n Workflow',           blurb: 'A working automation the reader imports and runs.', shot: '/content-system/lm/n8n.webp', alt: 'A live n8n workflow lead magnet, importable and ready to run' },
  { name: 'Checklist',              blurb: 'The fast-win format: an interactive, shareable checklist.', shot: '/content-system/lm/checklist.webp', alt: 'A live interactive checklist lead magnet' },
];

export interface LmPromise { headline: string; benefit: string; how: string; }
export const LM_PROMISES: LmPromise[] = [
  { headline: 'It builds AND publishes itself', benefit: 'One request → a finished, interactive asset on a live page at your domain. No designer, no dev, no upload.', how: 'Auto-generated + auto-deployed hosted resource pages.' },
  { headline: 'It captures and qualifies leads', benefit: 'Every signup lands on your email list, then gets scored by fit: top prospects get a call link, the rest get nurtured. No wasted calendar slots.', how: 'Email capture + qualification-gated CTAs that route by persona and score.' },
  { headline: 'It launches the whole campaign', benefit: 'Each magnet ships with its launch post, DM, email sequence, and cover, written and scheduled in one pass.', how: 'One run produces the asset + the full distribution kit.' },
];

export const ONE_IDEA_FORMATS: string[] = ['Text post', 'Single image', 'Carousel (9 styles)', 'Lead magnet', 'Newsletter'];

// How the engine actually works, end to end (adapted from the Interlude proposal
// signal-flow: sources → brain → pipeline → you approve → post + lead magnet).
export interface FlowStep { n: string; title: string; body: string; }
export const SYSTEM_FLOW: FlowStep[] = [
  { n: '01', title: 'It finds the idea', body: 'Pulls topics from your calls, the web, and your past winners, then ranks them by what will actually land with your audience.' },
  { n: '02', title: 'It writes it in your voice', body: 'A multi-step pipeline drafts the hook and body, grounded in your real conversations, and strips every AI tell before it reaches you.' },
  { n: '03', title: 'You approve in one tap', body: 'Read the finished draft, tweak the copy, image, or timing, and approve. Once it is running, your daily lift is under ten minutes.' },
  { n: '04', title: 'It ships your whole funnel', body: 'Schedules the post to LinkedIn and builds a matching lead magnet on a live page that captures every signup onto your email list.' },
];

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

// All buyer-facing copy for /content-system. Outcome-led; the `how` line is the
// only place implementation sophistication appears (reason-to-believe).
// HONESTY RULE: only claim live capabilities. Anything not fully live is marked.

// The reframe pillars for the "why this isn't 'AI writes my posts'" section.
// Distilled to four: decide, voice, quality, full funnel. No em dashes, no AI tells.
export interface ContentPromise { headline: string; benefit: string; }
export const PROMISES: ContentPromise[] = [
  { headline: 'It decides what to post', benefit: 'It pulls ideas from your calls, the web and your past winners, then ranks them by what will land. You are not feeding a prompt box.' },
  { headline: 'It sounds like you', benefit: 'Trained on your voice and built on your real conversations, so every post reads like you wrote it, not a model.' },
  { headline: 'It refuses to ship slop', benefit: 'Every draft clears a nine-point QA agent and a deterministic lint that strips the AI tells, rewritten until it passes.' },
  { headline: 'It runs the whole funnel', benefit: 'It publishes to LinkedIn, builds the lead magnets, captures the leads, and learns from what performs. All of it, without you in the loop.' },
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
  { name: 'Interactive Assessment', blurb: 'A scored quiz that qualifies the reader and books the right next step.', shot: '/content-system/lm/assessment.webp', alt: 'A live interactive assessment quiz, mid-question with multiple-choice answers' },
  { name: 'Calculator',             blurb: 'A live ROI or capacity calculator tailored to your offer.', shot: '/content-system/lm/calculator.webp', alt: 'A live capacity calculator with input fields and a computed result' },
  { name: 'Guide',                  blurb: 'A deep, on-brand playbook with every promise delivered inline.', shot: '/content-system/lm/guide.webp', alt: 'A live Guide lead magnet showing a detailed reference table' },
  { name: 'AI Kit',                 blurb: 'Ready-to-run prompts and agents, proof you actually build.', shot: '/content-system/lm/ai-kit.webp', alt: 'A live AI Kit lead magnet showing its files and prompts in a browser' },
  { name: 'n8n Workflow',           blurb: 'A working automation the reader imports and runs.', shot: '/content-system/lm/n8n.webp', alt: 'A live n8n workflow lead magnet showing import and setup steps' },
  { name: 'Checklist',              blurb: 'A guided audit the reader works through, scored as they go.', shot: '/content-system/lm/checklist.webp', alt: 'A live checklist audit lead magnet' },
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
    'Multi-format generation (posts, carousels, lead magnets)',
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

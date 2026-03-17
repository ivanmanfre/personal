export interface PipelineConfig {
  id: string;
  name: string;
  color: string;
  workflows: string[];
}

export interface PipelineEdge {
  source: string;
  target: string;
  label?: string;
}

// Order matters: first-match-wins. Put specific groups before generic ones.
export const pipelineConfig: PipelineConfig[] = [
  {
    id: 'content',
    name: 'Content Pipeline',
    color: 'blue',
    workflows: [
      'Editorial Agent', 'Post Generation', 'Carousel', 'Re-run Image',
      'Post Ready', 'Own Post Performance', 'Content Manager', 'Execute Content Plan',
      'Weekly Topic Research', 'Weekly Suggestions', 'Weekly Trends',
    ],
  },
  {
    id: 'competitors',
    name: 'Competitor Intel',
    color: 'purple',
    workflows: ['Competitors Scraping', 'Extract Patterns', 'Competitor Alert', 'Process Single Post'],
  },
  {
    id: 'leads',
    name: 'Lead Pipeline',
    color: 'emerald',
    workflows: ['Lead Pipeline', 'Leadshark', 'Email Outreach', 'Email Personalization', 'Lead Magnets', 'Unipile'],
  },
  {
    id: 'agent',
    name: 'Agent System',
    color: 'cyan',
    workflows: [
      'n8nClaw', 'Reminder Scheduler', 'Daily Conversation',
      'Proactive Notifications', 'Daily Standup', 'Daily Night',
    ],
  },
  {
    id: 'clients',
    name: 'Client Operations',
    color: 'orange',
    workflows: ['Client Health Monitor', 'Error Handler', 'CLIENT BACKUPS', 'Connect Client', 'Call Transcription', 'Post-Payment', 'Onboarding'],
  },
  {
    // Before Proposals so "Upwork Proposal*" matches here first
    id: 'upwork',
    name: 'Upwork',
    color: 'green',
    workflows: ['Upwork'],
  },
  {
    id: 'proposals',
    name: 'Proposals',
    color: 'amber',
    workflows: ['Proposal', 'Portfolio Embeddings', 'Send Proposal'],
  },
  {
    id: 'system',
    name: 'System & Backups',
    color: 'zinc',
    workflows: [
      'Dashboard Data Sync', 'Execution Log Sync', 'Supabase Schema', 'ClickUp Prompts',
      'Slack Channel Notifier', 'Backup Health', 'GITHUB BACKUPS', 'Apple Health',
    ],
  },
];

export const pipelineEdges: PipelineEdge[] = [
  { source: 'competitors', target: 'content', label: 'patterns' },
  { source: 'upwork', target: 'proposals', label: 'jobs' },
  { source: 'agent', target: 'content', label: 'triggers' },
  { source: 'agent', target: 'clients', label: 'alerts' },
  { source: 'clients', target: 'agent', label: 'errors' },
  { source: 'system', target: 'content', label: 'sync' },
  { source: 'system', target: 'agent', label: 'sync' },
  { source: 'system', target: 'clients', label: 'sync' },
];

/** Map pipeline IDs to GitHub repo name patterns (first-match-wins) */
export const pipelineRepoMapping: Record<string, string[]> = {
  content: ['content', 'editorial', 'carousel', 'post-gen', 'linkedin'],
  competitors: ['competitor', 'scraping', 'scraper'],
  leads: ['lead', 'outreach', 'email', 'leadshark'],
  agent: ['n8nclaw', 'claw', 'agent', 'reminder'],
  clients: ['client', 'onboarding'],
  upwork: ['upwork'],
  proposals: ['proposal', 'portfolio'],
  system: ['dashboard', 'personal-site', 'ivan-system', 'github-backup', 'supabase'],
};

/** Fixed SVG positions for topology map (viewBox 800x350) */
export const pipelinePositions: Record<string, { x: number; y: number }> = {
  content: { x: 400, y: 175 },
  competitors: { x: 150, y: 80 },
  leads: { x: 150, y: 270 },
  agent: { x: 560, y: 175 },
  clients: { x: 720, y: 175 },
  upwork: { x: 150, y: 175 },
  proposals: { x: 560, y: 280 },
  system: { x: 560, y: 70 },
};

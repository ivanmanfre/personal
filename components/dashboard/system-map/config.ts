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

export const pipelineConfig: PipelineConfig[] = [
  {
    id: 'content',
    name: 'Content Pipeline',
    color: 'blue',
    workflows: [
      'Editorial Agent', 'Post Generation', 'Carousel Generation', 'Carousel Slide Re-gen',
      'Post Ready', 'Own Post Performance', 'Content Manager Agent', 'Execute Content Plan',
      'Weekly Topic Research',
    ],
  },
  {
    id: 'competitors',
    name: 'Competitor Intel',
    color: 'purple',
    workflows: ['Competitors Scraping', 'Extract Patterns', 'Competitor Alert Monitor'],
  },
  {
    id: 'leads',
    name: 'Lead Pipeline',
    color: 'emerald',
    workflows: ['Lead Pipeline', 'Leadshark', 'Email Outreach', 'Email Personalization', 'Lead Magnets'],
  },
  {
    id: 'agent',
    name: 'Agent System',
    color: 'cyan',
    workflows: [
      'n8nClaw', 'Reminder Scheduler', 'Daily Conversation Summarizer',
      'Proactive Notifications', 'Daily Standup', 'Daily Night Brief',
    ],
  },
  {
    id: 'clients',
    name: 'Client Operations',
    color: 'orange',
    workflows: ['Client Health Monitor', 'Error Handler', 'CLIENT BACKUPS', 'Connect Client Calendar', 'Call Transcription'],
  },
  {
    id: 'upwork',
    name: 'Upwork',
    color: 'green',
    workflows: ['Upwork Job Assessor', 'Upwork Invite Handler', 'Upwork Cookies', 'Zenfl'],
  },
  {
    id: 'proposals',
    name: 'Proposals',
    color: 'amber',
    workflows: ['Proposal Generator', 'Proposal Comment', 'Send Proposal', 'Portfolio Embeddings'],
  },
  {
    id: 'system',
    name: 'System & Backups',
    color: 'zinc',
    workflows: [
      'Dashboard Data Sync', 'Supabase Schema Backup', 'ClickUp Prompts Backup',
      'Slack Channel Notifier', 'Backup Health Check', 'GITHUB BACKUPS', 'Apple Health Sync',
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

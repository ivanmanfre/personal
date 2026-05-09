/**
 * Migrate v1 dashboard URLs (?tab=foo) to v2 (?section=bar&sub=baz).
 * Called when v2 is active and the URL contains ?tab=.
 */

const TAB_TO_SECTION: Record<string, { section: string; sub?: string }> = {
  // Briefing absorbs Overview + Needs attention
  overview: { section: 'briefing' },

  // Content Studio absorbs 7 tabs
  content: { section: 'content', sub: 'pipeline' },
  performance: { section: 'content', sub: 'performance' },
  audience: { section: 'content', sub: 'audience' },
  strategy: { section: 'content', sub: 'strategy' },
  letter: { section: 'content', sub: 'newsletter' },
  recordings: { section: 'content', sub: 'recordings' },
  video: { section: 'content', sub: 'video' },

  // Reach & Pipeline absorbs 6 tabs
  outreach: { section: 'reach', sub: 'outreach' },
  leads: { section: 'reach', sub: 'leads' },
  competitors: { section: 'reach', sub: 'competitors' },
  upwork: { section: 'reach', sub: 'upwork' },
  meetings: { section: 'reach', sub: 'meetings' },
  'agent-ready': { section: 'reach', sub: 'agentready' },
  agentready: { section: 'reach', sub: 'agentready' },

  // Operations absorbs 5 tabs
  workflows: { section: 'ops', sub: 'workflows' },
  code: { section: 'ops', sub: 'logs' },
  usage: { section: 'ops', sub: 'usage' },
  'auto-research': { section: 'ops', sub: 'research' },
  tasks: { section: 'ops', sub: 'tasks' },

  // Standalone sections
  clients: { section: 'clients' },
  brain: { section: 'knowledge', sub: 'brain' },
  prompts: { section: 'knowledge', sub: 'prompts' },
  agent: { section: 'agent' },
  health: { section: 'personal', sub: 'health' },
  settings: { section: 'personal', sub: 'settings' },
};

export function migrateV1Url(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab');
  if (!tab) return false;
  const target = TAB_TO_SECTION[tab];
  if (!target) return false;

  params.delete('tab');
  params.set('section', target.section);
  if (target.sub) params.set('sub', target.sub);
  else params.delete('sub');

  const newUrl = `${window.location.pathname.replace(/^\/dashboard\b/, '/dashboard-v2')}?${params.toString()}${window.location.hash}`;
  window.history.replaceState(null, '', newUrl);
  return true;
}

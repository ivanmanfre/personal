import { Workflow } from 'lucide-react';
import { Product } from '../types';

export const products: Product[] = [
  {
    slug: 'callbrief',
    name: 'CallBrief',
    headline: 'Every client call becomes 8-14 LinkedIn content briefs. Automatically.',
    description:
      'An n8n workflow that listens for completed client calls via Fireflies webhook, identifies the client from your Google Drive folder structure, pulls all their reference documents (brand voice, strategy decks, past posts), and feeds everything to Claude Opus — which generates 8-14 detailed LinkedIn content briefs with verbatim soundbites, timestamped quotes, hook options, and a full overlap audit. Output lands as a formatted Google Doc in the client\'s Briefs folder, shared with your team, with a Slack notification.',
    category: 'workflow',
    icon: Workflow,
    previewImage: '/callbrief-workflow.png',
    sampleImage: '/callbrief-sample.png',
    samplePdf: '/callbrief-sample.pdf',
    features: [
      'Automatic client detection from call metadata',
      'Pulls all reference docs from client Google Drive folder',
      'Claude Opus generates 8-14 LinkedIn content briefs per call',
      'Verbatim soundbite extraction with clickable timestamps',
      'Content pillar assignment (from strategy deck or AI-inferred)',
      'Overlap audit to prevent duplicate topics',
      'Hook generation using proven LinkedIn hook templates',
      'Auto-creates Transcripts & Briefs folders per client',
      'Formatted Google Doc output with hyperlinked timestamps',
      'Slack notification when briefs are ready',
    ],
    includes: [
      'n8n workflow JSON (ready to import)',
      'Step-by-step setup guide with screenshots',
      'Google Cloud OAuth2 setup walkthrough',
      'Fireflies webhook configuration guide',
      'Environment variables template',
      'Sample client folder structure template',
    ],
    setup: [
      'Fireflies.ai account (for call recording & webhook)',
      'Anthropic API key (Claude Opus for brief generation)',
      'Google Cloud project with Drive + Docs OAuth2 credentials',
      'Slack app with OAuth2 (optional, for notifications)',
      'n8n instance (self-hosted or cloud)',
    ],
    tiers: [
      {
        id: 'workflow-only',
        name: 'Workflow Only',
        price: 197,
        label: '$197',
        description: 'The workflow JSON, setup guide, and all templates. You configure everything yourself.',
        checkoutUrl: 'https://ivanmanfredi.lemonsqueezy.com/checkout/buy/dec8868c-a42b-495b-aa81-2dfaf589a1d6',
      },
      {
        id: 'with-setup-call',
        name: 'Workflow + Setup Call',
        price: 347,
        label: '$347',
        description: 'Everything above plus a 45-min live setup call where I walk you through the entire configuration and make sure it runs.',
        checkoutUrl: 'https://ivanmanfredi.lemonsqueezy.com/checkout/buy/dec8868c-a42b-495b-aa81-2dfaf589a1d6',
        highlighted: true,
      },
      {
        id: 'custom-install',
        name: 'Done-For-You Install',
        price: null,
        label: 'From $1,000',
        description: 'I install it in your n8n instance, configure all APIs, set up your client folders, and adapt the workflow to your requirements and toolkit. Fully operational when I hand it over.',
        checkoutUrl: 'https://calendly.com/ivan-intelligents/30min',
      },
    ],
  },
];

export const categoryLabels: Record<string, string> = {
  all: 'All',
  workflow: 'Workflows',
  template: 'Templates',
  agent: 'Agents',
};

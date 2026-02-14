import { Workflow, Bot, FileSpreadsheet, Zap } from 'lucide-react';
import { Product } from '../types';

export const products: Product[] = [
  {
    slug: 'outbound-sales-engine',
    name: 'Outbound Sales Engine',
    headline: 'Fully automated outbound that books meetings while you sleep.',
    description:
      'A complete n8n workflow that scrapes leads from LinkedIn, scores them against your ICP, writes personalized outreach sequences with AI, and sends them on autopilot. Includes follow-up logic, CRM sync, and Slack notifications when a lead replies.',
    price: 297,
    category: 'workflow',
    icon: Zap,
    features: [
      'AI-powered lead scoring against your ICP criteria',
      'Personalized email sequences generated per prospect',
      'Automatic follow-up cadence (3-touch sequence)',
      'CRM integration (HubSpot / Airtable)',
      'Slack alerts on replies and booked meetings',
      'LinkedIn profile enrichment',
    ],
    includes: [
      'n8n workflow JSON (ready to import)',
      'Setup guide with screenshots',
      'Environment variables template',
      'Video walkthrough (15 min)',
    ],
    checkoutUrl: '#', // Replace with LemonSqueezy checkout URL
  },
  {
    slug: 'ai-content-repurposer',
    name: 'AI Content Repurposer',
    headline: 'One video becomes 20 pieces of content. Automatically.',
    description:
      'Drop a video or podcast URL and this workflow transcribes it, extracts key insights with AI, and generates LinkedIn posts, Twitter threads, blog outlines, and newsletter drafts — all in your voice. Publishes to a scheduling queue so your content runs on autopilot.',
    price: 197,
    category: 'workflow',
    icon: Workflow,
    features: [
      'Automatic transcription (Whisper API)',
      'AI insight extraction and topic clustering',
      'LinkedIn post generation in your brand voice',
      'Twitter/X thread formatting',
      'Blog outline + newsletter draft generation',
      'Scheduling queue integration',
    ],
    includes: [
      'n8n workflow JSON (ready to import)',
      'Voice calibration prompt template',
      'Setup guide with screenshots',
      'Video walkthrough (12 min)',
    ],
    checkoutUrl: '#',
  },
  {
    slug: 'client-onboarding-agent',
    name: 'Client Onboarding Agent',
    headline: 'From signed contract to fully onboarded in 10 minutes.',
    description:
      'An AI agent workflow that triggers when a deal closes in your CRM. It creates project folders, sends welcome emails, generates onboarding docs, schedules the kickoff call, and sets up Slack channels — all without human intervention. Your clients feel like they hired a Fortune 500 company.',
    price: 347,
    category: 'agent',
    icon: Bot,
    features: [
      'CRM trigger (deal stage change)',
      'Auto-generated onboarding documents',
      'Welcome email sequence (3 emails)',
      'Google Drive / Notion folder creation',
      'Slack channel setup with client',
      'Calendly kickoff scheduling',
    ],
    includes: [
      'n8n workflow JSON (ready to import)',
      'Email templates (customizable)',
      'Onboarding doc templates',
      'Setup guide with screenshots',
      'Video walkthrough (18 min)',
    ],
    checkoutUrl: '#',
  },
  {
    slug: 'operations-dashboard-template',
    name: 'Operations Dashboard Kit',
    headline: 'Real-time visibility into every metric that matters.',
    description:
      'A pre-built data pipeline that pulls from your CRM, project management tool, and financial systems into a unified dashboard. Tracks revenue, pipeline health, team utilization, and client satisfaction scores. Includes automated weekly report generation sent to your inbox every Monday.',
    price: 147,
    category: 'template',
    icon: FileSpreadsheet,
    features: [
      'Multi-source data aggregation (CRM, PM, Finance)',
      'Real-time KPI dashboard',
      'Automated weekly PDF reports',
      'Revenue and pipeline tracking',
      'Team utilization metrics',
      'Client health scoring',
    ],
    includes: [
      'n8n workflow JSON (data pipeline)',
      'Dashboard template (Airtable / Notion)',
      'KPI definitions document',
      'Setup guide with screenshots',
      'Video walkthrough (10 min)',
    ],
    checkoutUrl: '#',
  },
];

export const categoryLabels: Record<string, string> = {
  all: 'All',
  workflow: 'Workflows',
  template: 'Templates',
  agent: 'Agents',
};

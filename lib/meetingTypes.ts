import type { MeetingType } from '../types/dashboard';

export interface MeetingTypeConfig {
  value: MeetingType;
  label: string;
  shortLabel: string;
  badgeStyle: string;
  ringStyle: string;
}

export const MEETING_TYPES: Record<MeetingType, MeetingTypeConfig> = {
  discovery_sales: {
    value: 'discovery_sales',
    label: 'Discovery Sales',
    shortLabel: 'Discovery',
    badgeStyle: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    ringStyle: 'ring-emerald-500/40',
  },
  technical_audit: {
    value: 'technical_audit',
    label: 'Technical Audit',
    shortLabel: 'Tech',
    badgeStyle: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    ringStyle: 'ring-cyan-500/40',
  },
  client_kickoff: {
    value: 'client_kickoff',
    label: 'Client Kickoff',
    shortLabel: 'Kickoff',
    badgeStyle: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    ringStyle: 'ring-purple-500/40',
  },
  internal: {
    value: 'internal',
    label: 'Internal',
    shortLabel: 'Internal',
    badgeStyle: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
    ringStyle: 'ring-zinc-500/40',
  },
  unknown: {
    value: 'unknown',
    label: 'Unknown',
    shortLabel: '?',
    badgeStyle: 'bg-zinc-700/40 text-zinc-500 border-zinc-700/60',
    ringStyle: 'ring-zinc-700/40',
  },
};

export const MEETING_TYPE_OPTIONS: MeetingType[] = [
  'discovery_sales',
  'technical_audit',
  'client_kickoff',
  'internal',
  'unknown',
];

const DISCOVERY_RX = /\b(discovery|intro|fit\s*call|sales|consult|consultation|first\s*call)\b/i;
const TECHNICAL_RX = /\b(audit|review|technical|deep\s*dive|architecture|stack|debug)\b/i;
const KICKOFF_RX = /\b(kickoff|kick.?off|onboarding|start[- ]?up|launch)\b/i;
const INTERNAL_RX = /\b(team|standup|stand.?up|internal|1:1|sync|retro)\b/i;

export function resolveMeetingTypeFromTitle(title: string | null | undefined): MeetingType {
  if (!title) return 'unknown';
  if (DISCOVERY_RX.test(title)) return 'discovery_sales';
  if (TECHNICAL_RX.test(title)) return 'technical_audit';
  if (KICKOFF_RX.test(title)) return 'client_kickoff';
  if (INTERNAL_RX.test(title)) return 'internal';
  return 'unknown';
}

export function meetingTypeConfig(type: MeetingType | null | undefined): MeetingTypeConfig {
  return MEETING_TYPES[type ?? 'unknown'] ?? MEETING_TYPES.unknown;
}

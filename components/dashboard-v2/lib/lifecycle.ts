export type LifecycleSeverity = 'neutral' | 'warn' | 'good' | 'accent';

export interface LifecycleStage {
  key: string;
  label: string;
  severity: LifecycleSeverity;
}

export const LIFECYCLE_STAGES: LifecycleStage[] = [
  { key: 'idea',       label: 'Idea',       severity: 'neutral' },
  { key: 'generating', label: 'Generating', severity: 'accent'  },
  { key: 'review',     label: 'Review',     severity: 'warn'    },
  { key: 'approved',   label: 'Approved',   severity: 'good'    },
  { key: 'scheduled',  label: 'Scheduled',  severity: 'accent'  },
  { key: 'published',  label: 'Published',  severity: 'good'    },
];

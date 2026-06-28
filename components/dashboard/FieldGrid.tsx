import React from 'react';
import { CarouselDraft } from '../../hooks/useContentLibrary';
import { statusLabel } from '../../lib/statusLabels';

// All-fields dense grid — mirrors ClickUp's task `Fields` block. Renders every
// known field on a carousel_drafts row as a 2-col stacked label/value list.
// Lives below the main editor surfaces in CarouselEditor; collapsed by default.
//
// Why this exists: ClickUp's task interior stacks all 37 custom fields
// vertically with inline-editable values. Our editor surfaces ~10 fields. This
// panel covers the gap for `pillar`, `hook_type`, `value_tier`, `source`,
// `format`, `topicStrength`, `style_id`, `render_engine`, `source_post_id`,
// `scheduled_at`, etc. Read-only for now — edit-in-place can come later.

function fmt(value: any): string {
  if (value == null || value === '') return '—';
  if (Array.isArray(value)) return value.length === 0 ? '—' : `[${value.length}]`;
  if (typeof value === 'object') return JSON.stringify(value).slice(0, 80);
  if (typeof value === 'string' && value.length > 80) return value.slice(0, 80) + '…';
  return String(value);
}

const FieldRow: React.FC<{ label: string; value: any; mono?: boolean }> = ({ label, value, mono }) => (
  <div className="flex items-center gap-3 px-2 py-1 border-b border-[var(--ds-line)] last:border-b-0 text-xs">
    <span className="text-[var(--ds-dim)] w-32 shrink-0">{label}</span>
    <span className={`text-[var(--ds-ink)] truncate flex-1 ${mono ? 'font-mono text-xs' : ''}`}>{fmt(value)}</span>
  </div>
);

interface Props {
  draft: CarouselDraft;
}

const FieldGrid: React.FC<Props> = ({ draft }) => {
  const tax = (draft.taxonomy as Record<string, any>) || {};
  return (
    <div className="rounded-md border border-[var(--ds-line)] bg-[var(--ds-bg)]">
      <div className="px-2 py-1.5 text-xs uppercase tracking-wider text-[var(--ds-dim)] font-medium border-b border-[var(--ds-line)]">
        All fields
      </div>
      <FieldRow label="Status" value={statusLabel(draft.status)} />
      <FieldRow label="Type" value={draft.type} />
      <FieldRow label="Topic" value={draft.topic} />
      <FieldRow label="Scheduled" value={draft.scheduledAt ? new Date(draft.scheduledAt).toLocaleString() : null} />
      <FieldRow label="Updated" value={new Date(draft.updatedAt).toLocaleString()} />
      <FieldRow label="Pillar" value={tax.pillar} />
      <FieldRow label="Hook type" value={tax.hook_type} />
      <FieldRow label="Value tier" value={tax.value_tier} />
      <FieldRow label="Source" value={tax.source} />
      <FieldRow label="Source candidate" value={tax.source_candidate_id} mono />
      <FieldRow label="Topic strength" value={draft.topicStrength} />
      <FieldRow label="Style" value={draft.styleId} mono />
      <FieldRow label="Render engine" value={draft.renderEngine} />
      <FieldRow label="LinkedIn URN" value={draft.sourcePostId} mono />
      <FieldRow label="Image count" value={Array.isArray(draft.imageUrls) ? draft.imageUrls.length : 0} />
      <FieldRow label="Slide count" value={Array.isArray(draft.slides) ? draft.slides.length : 0} />
      <FieldRow label="Agent log entries" value={Array.isArray(draft.agentLog) ? draft.agentLog.length : 0} />
      <FieldRow label="QA verdict" value={draft.qa?.verdict} />
    </div>
  );
};

export default FieldGrid;

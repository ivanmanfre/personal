import React from 'react';

const AUDIENCES: Record<string, string> = {
  reach: 'Reach · TOFU',
  trust: 'Trust · MOFU',
  buyers: 'Buyers · BOFU',
};

/** Editorial metadata is separate from the native Video / Carousel format. */
export default function PostReviewTags({ item }: { item: {
  funnel_stage?: string | null;
  topic_label?: string | null;
  creative_style?: string | null;
} }) {
  const topic = item.topic_label?.trim();
  const style = item.creative_style?.trim();
  // Older queues retain their existing funnel chip and layout.
  if (!topic && !style) return null;
  const tags = [
    ['Audience', AUDIENCES[item.funnel_stage || '']],
    ['Topic', topic],
    ['Style', style],
  ].filter(([, value]) => value);
  return (
    <div data-post-review-tags aria-label="Post metadata" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', margin: '8px 0', fontFamily: 'var(--cb-body)', color: 'var(--cb-ink)', fontSize: 12.5, lineHeight: 1.5, overflowWrap: 'anywhere' }}>
      {tags.map(([label, value]) => <span key={label}><span style={{ color: 'var(--cb-ink-mute)' }}>{label}: </span>{value}</span>)}
    </div>
  );
}

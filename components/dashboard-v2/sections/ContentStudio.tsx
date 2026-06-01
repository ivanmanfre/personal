import React, { useState, lazy, Suspense } from 'react';
import { HeadRow, SubTabs, SubTab } from '../primitives';
import { InternalTabs } from '../../dashboard/InternalTabs';

/**
 * Phase 2 — Content Studio.
 *
 * Strategy: WRAP existing panels in v2 sub-tabs. Zero risk of breaking
 * write paths (drag-reschedule timezone math, dashboardAction calls,
 * RPCs, webhooks all stay inside the original components).
 *
 * Existing panels render with their internal styling (zinc-dark Tailwind).
 * Visual continuity with v2 chrome is acceptable for now — restyle is
 * a separate phase that can be done per-panel later.
 *
 * Absorbs: ContentPanel, PerformancePanel, AudiencePanel, StrategyPanel,
 * LetterPanel, RecordingsPanel, VideoIdeasPanel, AgentReadyPanel
 * (Lead Magnets surface as a Briefing pulse cell rather than dedicated tab).
 */

const ContentPanel = lazy(() => import('../../dashboard/ContentPanel'));
const PerformancePanel = lazy(() => import('../../dashboard/PerformancePanel'));
const AudiencePanel = lazy(() => import('../../dashboard/AudiencePanel'));
const StrategyPanel = lazy(() => import('../../dashboard/StrategyPanel'));
const LetterPanel = lazy(() => import('../../dashboard/LetterPanel'));
const RecordingsPanel = lazy(() => import('../../dashboard/RecordingsPanel'));
const VideoIdeasPanel = lazy(() => import('../../dashboard/VideoIdeasPanel'));
const CallClipsPanel = lazy(() => import('../../dashboard/CallClipsPanel'));
const PostStudioPanel = lazy(() => import('../../dashboard/PostStudioPanel'));
const LeadMagnetStudioPanel = lazy(() => import('../../dashboard/LeadMagnetStudioPanel'));

// IA reorg 2026-06-01: collapse 10 sub-tabs → 6. Pipeline (kanban) removed —
// Posts panel already has a Board view that does the same job. Performance now
// houses both Post Performance + Site Audience via internal tabs. Video now
// houses Recordings/Video Pipeline/Call Clips via internal tabs. Old `sub` values
// are remapped to the new tabs on URL load so existing deeplinks keep working.
type SubKey = 'posts' | 'leadmagnets' | 'performance' | 'video' | 'newsletter' | 'strategy';

const SUB_LABELS: Record<SubKey, string> = {
  posts: 'Posts',
  leadmagnets: 'Lead Magnets',
  performance: 'Performance',
  video: 'Video & Clips',
  newsletter: 'Newsletter',
  strategy: 'Strategy',
};

const SUB_ORDER: SubKey[] = ['posts', 'leadmagnets', 'performance', 'video', 'newsletter', 'strategy'];

// Map legacy ?sub= values to the new tab they live under.
const LEGACY_SUB_REMAP: Record<string, SubKey> = {
  pipeline: 'posts',         // kanban now lives inside Posts (Board view)
  audience: 'performance',   // folded into Performance internal tabs
  recordings: 'video',
  clips: 'video',
};

function getInitialSub(): SubKey {
  if (typeof window === 'undefined') return 'posts';
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('sub');
  if (raw && SUB_ORDER.includes(raw as SubKey)) return raw as SubKey;
  if (raw && LEGACY_SUB_REMAP[raw]) return LEGACY_SUB_REMAP[raw];
  return 'posts';
}

function syncSubToUrl(sub: SubKey) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (url.searchParams.get('sub') !== sub) {
    url.searchParams.set('sub', sub);
    window.history.replaceState(null, '', url.toString());
  }
}

const Loading = () => (
  <div style={{ padding: '2rem 0', color: 'var(--d-paper-dim)', fontSize: 13 }}>
    Loading panel…
  </div>
);

export function ContentStudio() {
  const [sub, setSub] = useState<SubKey>(getInitialSub);

  const handleSub = (s: string) => {
    setSub(s as SubKey);
    syncSubToUrl(s as SubKey);
  };

  const renderSub = () => {
    switch (sub) {
      case 'posts':       return <PostStudioPanel />;
      case 'leadmagnets': return <LeadMagnetStudioPanel />;
      case 'performance':
        return (
          <InternalTabs
            storageKey="content-studio-performance-tab"
            tabs={[
              { key: 'posts', label: 'Post Performance', render: () => <PerformancePanel /> },
              { key: 'audience', label: 'Site Audience', render: () => <AudiencePanel /> },
              { key: 'pipeline', label: 'Pipeline Kanban', render: () => <ContentPanel /> },
            ]}
          />
        );
      case 'video':
        return (
          <InternalTabs
            storageKey="content-studio-video-tab"
            tabs={[
              { key: 'recordings', label: 'Recordings · Calls', render: () => <RecordingsPanel /> },
              { key: 'video', label: 'Video Pipeline', render: () => <VideoIdeasPanel /> },
              { key: 'clips', label: 'Call Clips', render: () => <CallClipsPanel /> },
            ]}
          />
        );
      case 'newsletter':  return <LetterPanel />;
      case 'strategy':    return <StrategyPanel />;
    }
  };

  return (
    <>
      <HeadRow
        title={<>Content <em>Studio</em></>}
        meta={<>Posts · Lead Magnets · Performance<br />Video & Clips · Newsletter · Strategy</>}
      />
      <SubTabs>
        {SUB_ORDER.map(key => (
          <SubTab key={key} id={key} active={sub} onChange={handleSub}>
            {SUB_LABELS[key]}
          </SubTab>
        ))}
      </SubTabs>
      <div className="dv-content-studio-body">
        <Suspense fallback={<Loading />}>
          {renderSub()}
        </Suspense>
      </div>
    </>
  );
}

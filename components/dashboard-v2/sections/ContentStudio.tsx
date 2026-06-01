import React, { useState, lazy, Suspense } from 'react';
import { HeadRow, SubTabs, SubTab } from '../primitives';

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
// Two top-level content-creation sections: Posts (unified text/single-image/carousel)
// and Lead Magnets (Ideas + Drafts nested).
const Posts = lazy(() => import('./Posts').then((m) => ({ default: m.Posts })));
const LeadMagnets = lazy(() => import('./LeadMagnets').then((m) => ({ default: m.LeadMagnets })));

type SubKey = 'posts' | 'leadmagnets' | 'pipeline' | 'performance' | 'audience' | 'strategy' | 'newsletter' | 'recordings' | 'video' | 'clips';

const SUB_LABELS: Record<SubKey, string> = {
  posts: 'Posts',
  leadmagnets: 'Lead Magnets',
  pipeline: 'Pipeline',
  performance: 'Post Performance',
  audience: 'Site Audience',
  strategy: 'Strategy',
  newsletter: 'Newsletter',
  recordings: 'Recordings · Calls',
  video: 'Video Pipeline',
  clips: 'Call Clips',
};

const SUB_ORDER: SubKey[] = ['posts', 'leadmagnets', 'pipeline', 'performance', 'audience', 'strategy', 'newsletter', 'recordings', 'video', 'clips'];

function getInitialSub(): SubKey {
  if (typeof window === 'undefined') return 'pipeline';
  const params = new URLSearchParams(window.location.search);
  const s = params.get('sub') as SubKey | null;
  if (s && SUB_ORDER.includes(s)) return s;
  return 'pipeline';
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
      case 'posts':       return <Posts />;
      case 'leadmagnets': return <LeadMagnets />;
      case 'pipeline':    return <ContentPanel />;
      case 'performance': return <PerformancePanel />;
      case 'audience':    return <AudiencePanel />;
      case 'strategy':    return <StrategyPanel />;
      case 'newsletter':  return <LetterPanel />;
      case 'recordings':  return <RecordingsPanel />;
      case 'video':       return <VideoIdeasPanel />;
      case 'clips':       return <CallClipsPanel />;
    }
  };

  return (
    <>
      <HeadRow
        title={<>Content <em>Studio</em></>}
        meta={<>Pipeline · Performance · Audience · Strategy<br />Newsletter · Recordings · Video · Ideas · Clips</>}
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

import React, { useState, useEffect, lazy, Suspense } from 'react';
import { HeadRow, SubTabs, SubTab } from '../primitives';
import { InternalTabs } from '../../dashboard/InternalTabs';
import { onNav } from '../lib/navBus';

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

const PerformancePanel = lazy(() => import('../../dashboard/PerformancePanel'));
const StrategyPanel = lazy(() => import('../../dashboard/StrategyPanel'));
const LetterPanel = lazy(() => import('../../dashboard/LetterPanel'));
const RecordingsPanel = lazy(() => import('../../dashboard/RecordingsPanel'));
const VideoIdeasPanel = lazy(() => import('../../dashboard/VideoIdeasPanel'));
const CallClipsPanel = lazy(() => import('../../dashboard/CallClipsPanel'));
const VideoStudioPanel = lazy(() => import('../../dashboard/VideoStudioPanel'));
// Round-3 reading-first review flows. They own the Posts / Lead Magnets sub-tab
// by default (Review mode when drafts are pending) and carry their own toggle
// back to the classic board/studio panel above. No shell/data-layer changes.
const PostReviewFlow = lazy(() => import('../review/PostReviewFlow'));
const LmReviewFlow = lazy(() => import('../review/LmReviewFlow'));
const StyleGalleryPanel = lazy(() => import('../../dashboard/StyleGalleryPanel'));
const PromptLibraryPanel = lazy(() => import('../../dashboard/PromptLibraryPanel'));
const CalendarSection = lazy(() => import('./Calendar').then((m) => ({ default: m.Calendar })));

// IA reorg 2026-06-01: collapse 10 sub-tabs → 6. Pipeline (kanban) removed —
// Posts panel already has a Board view that does the same job. Performance now
// houses both Post Performance + Site Audience via internal tabs. Video now
// houses Recordings/Video Pipeline/Call Clips via internal tabs. Old `sub` values
// are remapped to the new tabs on URL load so existing deeplinks keep working.
type SubKey = 'posts' | 'leadmagnets' | 'styles' | 'prompts' | 'calendar' | 'performance' | 'video' | 'newsletter' | 'strategy';

const SUB_LABELS: Record<SubKey, string> = {
  posts: 'Posts',
  leadmagnets: 'Lead Magnets',
  styles: 'Styles',
  prompts: 'Prompts',
  calendar: 'Calendar',
  performance: 'Performance',
  video: 'Video & Clips',
  newsletter: 'Newsletter',
  strategy: 'Strategy',
};

const SUB_ORDER: SubKey[] = ['posts', 'leadmagnets', 'styles', 'prompts', 'calendar', 'performance', 'video', 'newsletter', 'strategy'];

// Map legacy ?sub= values to the new tab they live under.
const LEGACY_SUB_REMAP: Record<string, SubKey> = {
  pipeline: 'posts',         // kanban now lives inside Posts (Board view)
  ideas: 'posts',            // content ideas are now the Idea STAGE on the Posts board
  audience: 'performance',   // Site Audience moved to Reach & Pipeline; old ?sub=audience deeplink lands on Performance
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

  useEffect(() => {
    return onNav(({ section, sub: nextSub }) => {
      if (section === 'content' && nextSub) {
        handleSub(nextSub);
      }
    });
  }, []);

  const renderSub = () => {
    switch (sub) {
      case 'posts':       return <PostReviewFlow />;
      case 'leadmagnets': return <LmReviewFlow />;
      case 'styles':      return <StyleGalleryPanel />;
      case 'prompts':     return <PromptLibraryPanel />;
      case 'calendar':    return <CalendarSection />;
      case 'performance':  return <PerformancePanel />;
      case 'video':
        return (
          <InternalTabs
            storageKey="content-studio-video-tab"
            tabs={[
              { key: 'animated', label: 'Animated', render: () => <VideoStudioPanel /> },
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
      <HeadRow title={<>Content <em>Studio</em></>} />
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

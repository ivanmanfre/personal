// components/dev/LinkedInFeedMockupPreview.tsx
import React from 'react';
import LinkedInFeedMockup from '../ui/LinkedInFeedMockup';
import { sampleFeedSpec } from '../ui/linkedInFeedMockup.fixtures';
import type { RenderMode } from '../../lib/linkedinFeedSpec';

/**
 * Dev-only preview for the LinkedIn feed mockup. Demonstrates the split visual register:
 * Ivan's brand frame (paper/ink/serif) wrapping the neutral LinkedIn feed.
 * Route: /dev/linkedin-feed  (add ?mode=full to include the LM document card)
 */
const LinkedInFeedMockupPreview: React.FC = () => {
  const mode: RenderMode =
    new URLSearchParams(window.location.search).get('mode') === 'full' ? 'full' : 'tease';
  const firstName = sampleFeedSpec.profile.name.split(' ')[0];

  return (
    <div className="min-h-screen w-full" style={{ backgroundColor: 'var(--color-paper)' }}>
      <div className="max-w-2xl mx-auto px-6 py-16">
        <p
          className="text-[12px] uppercase tracking-[0.2em] mb-2"
          style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-ink-mute)' }}
        >
          Preview · {mode === 'full' ? 'full reveal' : 'their feed, leveled up'}
        </p>
        <h1
          className="text-4xl mb-10"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--color-ink)' }}
        >
          What {firstName}'s feed could be doing
        </h1>
        <LinkedInFeedMockup spec={sampleFeedSpec} mode={mode} />
      </div>
    </div>
  );
};

export default LinkedInFeedMockupPreview;

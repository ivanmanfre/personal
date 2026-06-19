// components/ui/LinkedInFeedMockup.tsx
import React from 'react';
import LinkedInPostPreview from './LinkedInPostPreview';
import { normalizeFeedSpec, type FeedSpec, type RenderMode } from '../../lib/linkedinFeedSpec';

interface Props {
  spec: FeedSpec;
  /** 'tease' (reply: posts only) or 'full' (call: posts + LM card). Default 'tease'. */
  mode?: RenderMode;
  className?: string;
}

/**
 * Renders a believable LinkedIn feed for a prospect from a FeedSpec.
 * Composes the existing LinkedInPostPreview (one card per post), threading the
 * prospect's profile into each. Pure presentation — feed it a spec, it renders.
 * The feed mimics LinkedIn's neutral UI on purpose; the surrounding page supplies Ivan's brand frame.
 */
const LinkedInFeedMockup: React.FC<Props> = ({ spec, mode = 'tease', className = '' }) => {
  const feed = normalizeFeedSpec(spec, mode);
  const { profile, posts } = feed;

  return (
    <div className={`flex flex-col items-center gap-3 w-full ${className}`}>
      {posts.map((post, i) => (
        <LinkedInPostPreview
          key={i}
          text={post.body}
          author={profile.name}
          headline={profile.headline}
          avatarUrl={profile.avatarUrl}
          mediaUrl={post.type === 'image' ? post.imageUrl : null}
          stats={{ reactions: post.reactions, comments: post.comments }}
        />
      ))}
      {/* LM document card (full mode) wired in Task 4 */}
    </div>
  );
};

export default LinkedInFeedMockup;

// components/ui/LinkedInFeedMockup.tsx
import React from 'react';
import LinkedInPostPreview from './LinkedInPostPreview';
import LinkedInCarouselCard from './LinkedInCarouselCard';
import { normalizeFeedSpec, type FeedSpec, type RenderMode } from '../../lib/linkedinFeedSpec';

interface Props {
  spec: FeedSpec;
  /** 'tease' (reply: posts only) or 'full' (call). Default 'tease'. */
  mode?: RenderMode;
  className?: string;
}

/**
 * Renders a believable LinkedIn feed for a prospect from a FeedSpec.
 * Layout: the visual post (image/carousel) runs full-size on top; the text posts
 * sit below in a single tidy row of compact cards. The lead magnet / live scorecard
 * is surfaced separately by the page (a bold CTA), not inside this feed.
 * The feed mimics LinkedIn's neutral UI on purpose; the surrounding page supplies Ivan's brand frame.
 */
const LinkedInFeedMockup: React.FC<Props> = ({ spec, mode = 'tease', className = '' }) => {
  const feed = normalizeFeedSpec(spec, mode);
  const { profile, posts } = feed;

  const mediaPosts = posts.filter((p) => p.type === 'image' || p.type === 'carousel');
  const textPosts = posts.filter((p) => p.type === 'text');

  return (
    <div className={`w-full ${className}`}>
      {/* Full-size visual post(s) on top */}
      {mediaPosts.map((post, i) => (
        <div key={`m-${i}`} className="max-w-[552px] mx-auto mb-3">
          {post.type === 'carousel' ? (
            <LinkedInCarouselCard
              text={post.body}
              slides={post.slides}
              author={profile.name}
              headline={profile.headline}
              avatarUrl={profile.avatarUrl}
              showFold
              stats={{ reactions: post.reactions, comments: post.comments }}
            />
          ) : (
            <LinkedInPostPreview
              text={post.body}
              author={profile.name}
              headline={profile.headline}
              avatarUrl={profile.avatarUrl}
              mediaUrl={post.imageUrl}
              showFold
              stats={{ reactions: post.reactions, comments: post.comments }}
            />
          )}
        </div>
      ))}

      {/* Text posts — one row of compact cards */}
      {textPosts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-stretch">
          {textPosts.map((post, i) => (
            <LinkedInPostPreview
              key={`t-${i}`}
              compact
              text={post.body}
              author={profile.name}
              headline={profile.headline}
              avatarUrl={profile.avatarUrl}
              mediaUrl={null}
              stats={{ reactions: post.reactions, comments: post.comments }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default LinkedInFeedMockup;

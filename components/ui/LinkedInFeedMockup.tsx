// components/ui/LinkedInFeedMockup.tsx
import React from 'react';
import LinkedInPostPreview from './LinkedInPostPreview';
import LinkedInCarouselCard from './LinkedInCarouselCard';
import LinkedInDocumentCard from './LinkedInDocumentCard';
import { normalizeFeedSpec, type FeedSpec, type RenderMode } from '../../lib/linkedinFeedSpec';

interface Props {
  spec: FeedSpec;
  /** 'tease' (reply: posts only) or 'full' (call: posts + LM card). Default 'tease'. */
  mode?: RenderMode;
  className?: string;
  /** Forwarded to each post; false shows full copy (no LinkedIn truncation fold). Default true. */
  showFold?: boolean;
  /** When set, the LM document card becomes clickable and calls this (opens an in-page preview). */
  onLmClick?: () => void;
  /** When true, the LM card advertises itself as a LIVE interactive assessment (not a static PDF). */
  lmInteractive?: boolean;
}

/**
 * Renders a believable LinkedIn feed for a prospect from a FeedSpec.
 * Composes the existing LinkedInPostPreview (one card per post), threading the
 * prospect's profile into each. Pure presentation — feed it a spec, it renders.
 * The feed mimics LinkedIn's neutral UI on purpose; the surrounding page supplies Ivan's brand frame.
 */
const LinkedInFeedMockup: React.FC<Props> = ({ spec, mode = 'tease', className = '', showFold = true, onLmClick, lmInteractive }) => {
  const feed = normalizeFeedSpec(spec, mode);
  const { profile, posts } = feed;

  const mediaPosts = posts.filter((p) => p.type === 'image' || p.type === 'carousel');
  const textPosts = posts.filter((p) => p.type === 'text');

  return (
    <div className={`flex flex-col items-center gap-3 w-full ${className}`}>
      {/* Full-width image/carousel posts */}
      {mediaPosts.map((post, i) => {
        if (post.type === 'carousel') {
          return (
            <LinkedInCarouselCard
              key={`media-${i}`}
              text={post.body}
              slides={post.slides}
              author={profile.name}
              headline={profile.headline}
              avatarUrl={profile.avatarUrl}
              showFold={showFold}
              stats={{ reactions: post.reactions, comments: post.comments }}
            />
          );
        }
        return (
          <LinkedInPostPreview
            key={`media-${i}`}
            text={post.body}
            author={profile.name}
            headline={profile.headline}
            avatarUrl={profile.avatarUrl}
            mediaUrl={post.imageUrl}
            showFold={showFold}
            stats={{ reactions: post.reactions, comments: post.comments }}
          />
        );
      })}

      {/* Compact 2-column grid for text-only posts */}
      {textPosts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-[552px] mx-auto">
          {textPosts.map((post, i) => (
            <LinkedInPostPreview
              key={`text-${i}`}
              text={post.body}
              author={profile.name}
              headline={profile.headline}
              avatarUrl={profile.avatarUrl}
              mediaUrl={null}
              showFold={false}
              stats={{ reactions: post.reactions, comments: post.comments }}
              compact
            />
          ))}
        </div>
      )}

      {/* LM document card */}
      {feed.lmCard && (
        <LinkedInDocumentCard
          profile={profile}
          card={feed.lmCard}
          caption={`Put together a quick scorecard for anyone running the same kind of operation we do: "${feed.lmCard.title}". Two minutes, you get your score on the spot. Link's in the comments.`}
          onCardClick={onLmClick}
          interactive={lmInteractive}
        />
      )}
    </div>
  );
};

export default LinkedInFeedMockup;

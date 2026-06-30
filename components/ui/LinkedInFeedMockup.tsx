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

/** Keep the feed scannable: a couple of posts and the scorecard, not a wall. */
const MAX_POSTS = 3;

/**
 * Renders a believable LinkedIn feed for a prospect from a FeedSpec.
 * One clean column: every card is the same 552px LinkedIn width, stacked with
 * even spacing — media leads (it carries the most visual weight), then text,
 * capped so the section reads as a tidy sample and not a cluttered grid. The LM
 * scorecard closes it. Pure presentation — feed it a spec, it renders.
 * The feed mimics LinkedIn's neutral UI on purpose; the surrounding page supplies Ivan's brand frame.
 */
const LinkedInFeedMockup: React.FC<Props> = ({ spec, mode = 'tease', className = '', showFold = true, onLmClick, lmInteractive }) => {
  const feed = normalizeFeedSpec(spec, mode);
  const { profile, posts } = feed;

  // Media first (carousel/image carry the most visual weight), then text, capped.
  const ordered = [
    ...posts.filter((p) => p.type === 'image' || p.type === 'carousel'),
    ...posts.filter((p) => p.type === 'text'),
  ].slice(0, MAX_POSTS);

  return (
    <div className={`flex flex-col items-center gap-4 w-full ${className}`}>
      {ordered.map((post, i) => {
        if (post.type === 'carousel') {
          return (
            <LinkedInCarouselCard
              key={`post-${i}`}
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
            key={`post-${i}`}
            text={post.body}
            author={profile.name}
            headline={profile.headline}
            avatarUrl={profile.avatarUrl}
            mediaUrl={post.type === 'image' ? post.imageUrl : null}
            showFold={showFold}
            stats={{ reactions: post.reactions, comments: post.comments }}
          />
        );
      })}

      {/* LM document card — the live interactive scorecard closes the feed */}
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

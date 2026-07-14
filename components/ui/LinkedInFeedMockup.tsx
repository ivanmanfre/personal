// components/ui/LinkedInFeedMockup.tsx
import React from 'react';
import LinkedInPostPreview from './LinkedInPostPreview';
import LinkedInCarouselCard from './LinkedInCarouselCard';
import { normalizeFeedSpec, type BrandKitSpec, type FeedSpec, type RenderMode } from '../../lib/linkedinFeedSpec';

interface Props {
  spec: FeedSpec;
  /** 'tease' (reply: posts only) or 'full' (call). Default 'tease'. */
  mode?: RenderMode;
  className?: string;
  /** Prospect brand, mirrored onto text-slide carousels so they read as the founder's own. */
  accentHex?: string;
  brandName?: string;
  /** FULL prospect brand kit — threaded into carousel slides and designed image cards. */
  brand?: BrandKitSpec | null;
  /** Company name — wordmark fallback on branded artifacts when there's no logo. */
  companyName?: string;
}

/**
 * Renders a believable LinkedIn feed for a prospect from a FeedSpec.
 * Order: the image post runs full-size on top, then the text posts, then the carousel.
 * The text posts form a clean 3-across row ONLY when there are three; with one or two they
 * render full-width and fully readable (a single post in a 3-col grid would sit cramped at
 * a third width). The lead magnet is surfaced separately by the page, not inside this feed.
 */
const LinkedInFeedMockup: React.FC<Props> = ({ spec, mode = 'tease', className = '', accentHex, brandName, brand, companyName }) => {
  const feed = normalizeFeedSpec(spec, mode);
  const { profile, posts } = feed;

  const imagePosts = posts.filter((p) => p.type === 'image');
  const textPosts = posts.filter((p) => p.type === 'text');
  const carouselPosts = posts.filter((p) => p.type === 'carousel');

  const author = { author: profile.name, headline: profile.headline, avatarUrl: profile.avatarUrl };

  return (
    <div className={`w-full ${className}`}>
      {/* 1 — image post(s), full-size */}
      {imagePosts.map((post, i) => (
        <div key={`img-${i}`} className="max-w-[552px] mx-auto mb-3">
          <LinkedInPostPreview
            {...author}
            text={post.body}
            mediaUrl={post.imageUrl ?? null}
            imageCard={post.imageCard}
            brand={brand}
            companyName={companyName}
            showFold
            stats={{ reactions: post.reactions, comments: post.comments }}
          />
        </div>
      ))}

      {/* 2 — text posts. Three → a tidy 3-across row of compact cards. Fewer → full-width so
              nothing sits cramped at a third of the column and every line stays visible. */}
      {textPosts.length >= 3 ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-stretch mb-3">
          {textPosts.slice(0, 3).map((post, i) => (
            <LinkedInPostPreview
              key={`t-${i}`}
              compact
              {...author}
              text={post.body}
              mediaUrl={null}
              stats={{ reactions: post.reactions, comments: post.comments }}
            />
          ))}
        </div>
      ) : (
        textPosts.map((post, i) => (
          <div key={`t-${i}`} className="max-w-[552px] mx-auto mb-3">
            <LinkedInPostPreview
              {...author}
              text={post.body}
              mediaUrl={null}
              showFold
              stats={{ reactions: post.reactions, comments: post.comments }}
            />
          </div>
        ))
      )}

      {/* 3 — carousel post(s), full-size */}
      {carouselPosts.map((post, i) => (
        <div key={`car-${i}`} className="max-w-[552px] mx-auto mb-3">
          <LinkedInCarouselCard
            {...author}
            text={post.body}
            slides={post.slides}
            textSlides={post.textSlides}
            accentHex={accentHex}
            brandName={brandName}
            brand={brand}
            companyName={companyName}
            showFold
            stats={{ reactions: post.reactions, comments: post.comments }}
          />
        </div>
      ))}
    </div>
  );
};

export default LinkedInFeedMockup;

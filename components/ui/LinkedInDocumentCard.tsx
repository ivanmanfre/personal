// components/ui/LinkedInDocumentCard.tsx
import React from 'react';
import { ThumbsUp, MessageSquare, Repeat2, Send, Globe, MoreHorizontal, FileText } from 'lucide-react';
import type { NormalizedLmCard, ProfileSpec } from '../../lib/linkedinFeedSpec';
import { avatarInitials } from './LinkedInPostPreview';

interface Props {
  profile: ProfileSpec;
  card: NormalizedLmCard;
  caption?: string;
  /** When set, the document block is clickable and opens an in-page preview. */
  onCardClick?: () => void;
  /** When true, the card advertises a LIVE interactive assessment (not a static PDF). */
  interactive?: boolean;
}

/**
 * LinkedIn "document" post (PDF/carousel) for a lead-magnet preview.
 * Self-contained header (does NOT refactor the shared LinkedInPostPreview).
 */
const LinkedInDocumentCard: React.FC<Props> = ({ profile, card, caption, onCardClick, interactive }) => {
  return (
    <div className="rounded-lg bg-white text-[#1d2226] shadow-sm border border-[#dce6f1] overflow-hidden font-sans w-full max-w-[552px] mx-auto">
      {/* Header */}
      <div className="flex items-start gap-2 px-4 py-3">
        {profile.avatarUrl ? (
          <img
            src={profile.avatarUrl}
            alt={profile.name}
            className="w-12 h-12 rounded-full object-cover bg-zinc-200 shrink-0"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-[#e3ebf3] text-[#0a66c2] shrink-0 flex items-center justify-center text-[15px] font-semibold" aria-hidden>{avatarInitials(profile.name)}</div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-semibold leading-tight text-[#0a66c2] truncate">{profile.name}</div>
          <div className="text-[12px] text-[#666] leading-tight mt-0.5 truncate">{profile.headline}</div>
          <div className="text-[12px] text-[#666] leading-tight mt-0.5 flex items-center gap-1">
            <span>2d</span><span>·</span><Globe className="w-3 h-3 inline-block" />
          </div>
        </div>
        <button className="p-1.5 rounded-full hover:bg-[#f3f2ef] text-[#666] transition-colors">
          <MoreHorizontal className="w-5 h-5" />
        </button>
      </div>

      {/* Caption */}
      {caption && (
        <div className="px-4 pb-3">
          <div className="text-[14px] text-[#1d2226] leading-[1.4] whitespace-pre-wrap">{caption}</div>
        </div>
      )}

      {/* Document block */}
      <div
        className={`group relative border-y border-[#dce6f1] bg-[#f3f6f8] ${onCardClick ? 'cursor-pointer' : ''}`}
        onClick={onCardClick}
        role={onCardClick ? 'button' : undefined}
        tabIndex={onCardClick ? 0 : undefined}
        onKeyDown={onCardClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onCardClick(); } } : undefined}
      >
        <img src={card.coverUrl} alt={card.title} className="w-full max-h-[520px] object-contain" loading="lazy" />
        {onCardClick && (
          interactive ? (
            <>
              <span className="absolute top-3 right-3 inline-flex items-center gap-1.5 bg-[#1d2226] text-white text-[11px] font-semibold px-2.5 py-1 rounded-full shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-[#3fae7a] animate-pulse" aria-hidden /> Interactive
              </span>
              {/* hover overlay makes it unmistakable this opens a live tool */}
              <div className="absolute inset-0 flex items-center justify-center bg-[#1d2226]/0 group-hover:bg-[#1d2226]/35 transition-colors">
                <span className="inline-flex items-center gap-2 bg-white text-[#1d2226] text-[13px] font-semibold px-4 py-2 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity">
                  Try the live scorecard <span aria-hidden>→</span>
                </span>
              </div>
            </>
          ) : (
            <span className="absolute top-3 right-3 bg-white/95 text-[#0a66c2] text-[11px] font-semibold px-2.5 py-1 rounded-full shadow-sm opacity-90 group-hover:opacity-100 transition-opacity">
              Preview →
            </span>
          )
        )}
        <div className="absolute left-0 right-0 bottom-0 bg-[#1d2226]/85 text-white px-4 py-3 flex items-center gap-2">
          <FileText className="w-4 h-4 shrink-0" />
          <span className="text-[14px] font-semibold leading-tight truncate">{card.title}</span>
          <span className="ml-auto text-[12px] text-white/70 shrink-0">{interactive ? 'Live · 2 min' : `${card.pages} pages`}</span>
        </div>
      </div>

      {/* Reaction strip */}
      <div className="px-4 pt-3 pb-2 text-[12px] text-[#666] flex items-center gap-1">
        <span className="inline-flex -space-x-1">
          <span className="w-4 h-4 rounded-full bg-[#0a66c2] flex items-center justify-center ring-1 ring-white text-white text-[9px]">👍</span>
          <span className="w-4 h-4 rounded-full bg-[#df704d] flex items-center justify-center ring-1 ring-white text-white text-[9px]">❤</span>
        </span>
        <span className="ml-1">128</span>
        <span className="ml-auto">14 comments</span>
      </div>

      {/* Action bar */}
      <div className="border-t border-[#dce6f1] px-2 py-1 flex items-center justify-around">
        {[
          { icon: ThumbsUp, label: 'Like' },
          { icon: MessageSquare, label: 'Comment' },
          { icon: Repeat2, label: 'Repost' },
          { icon: Send, label: 'Send' },
        ].map((a) => (
          <button
            key={a.label}
            className="flex items-center gap-1.5 px-3 py-2 rounded text-[#666] hover:bg-[#f3f2ef] transition-colors text-[13px] font-semibold"
          >
            <a.icon className="w-5 h-5" />
            <span>{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default LinkedInDocumentCard;

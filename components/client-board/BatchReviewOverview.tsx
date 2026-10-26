import React, { useEffect, useState } from 'react';
import { FileText, Play, MessageCircle, AtSign } from 'lucide-react';
import { useBoardTeam } from './team';
import { openCommentThreads } from './commentMentions';
import type { QueueItem } from '../ClientBoardPage';
import PostReviewTags from './PostReviewTags';
import { postSourceOrigin } from './postSourceOrigin';

const isVideoUrl = (url: string) => /\.(mp4|webm|mov|m4v)(?:[?#]|$)/i.test(url);
const hasVideo = (item: QueueItem) => item.style === 'video' || !!item.video_url || !!(item.media_url && isVideoUrl(item.media_url));
function formatOf(item: QueueItem): string {
  if (hasVideo(item)) return 'Video';
  if (item.kind === 'lm' || item.lm_launch || item.lm_gate) return 'Lead magnet';
  if (item.kind === 'carousel' || item.style === 'carousel' || (item.image_urls?.length || 0) > 1) return 'Carousel';
  return item.image || item.image_urls?.length || (item.media_url && !isVideoUrl(item.media_url)) ? 'Single image' : 'Text post';
}

function Preview({ item }: { item: QueueItem }) {
  const src = [...(item.image_urls || []), item.image, item.media_url].find((url): url is string => !!url && !isVideoUrl(url));
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  // A text post has no media, so it gets no media box: the card's title and the review
  // already carry the copy, and a box of body text only repeated it.
  if (!src && !hasVideo(item)) return null;
  return (
    <div className="cb-batch-media">
      {src && !failed ? <img src={src} alt={`Preview of ${item.title || item.hook || 'post'}`} loading="lazy" onError={() => setFailed(true)} /> : (
        <div className="cb-batch-fallback">
          {hasVideo(item) ? <Play size={28} aria-hidden="true" /> : <FileText size={28} aria-hidden="true" />}
          <p>{hasVideo(item) ? 'Video preview opens in review.' : 'Image preview opens in review.'}</p>
        </div>
      )}
      {hasVideo(item) && <span className="cb-batch-video"><Play size={14} aria-hidden="true" /> Video</span>}
    </div>
  );
}

/** The batch shows the mix. The existing full review owns all decisions and writes. */
export default function BatchReviewOverview({ items, onOpen, statusFor, dateFor, cardAction, hideFilters = false }: {
  items: QueueItem[];
  onOpen: (item: QueueItem) => void;
  statusFor: (item: QueueItem) => string;
  dateFor?: (item: QueueItem) => string | null;
  /** Extra control under Open review (board Archive / Restore). Returns null for cards that get none. */
  cardAction?: (item: QueueItem) => React.ReactNode;
  /** The Archive grid reuses this card; it has no feedback filter row of its own. */
  hideFilters?: boolean;
}) {
  const team = useBoardTeam();
  const [feedbackFilter,setFeedbackFilter] = useState<'all'|'open'|'mentioned'>('all');
  const collaborative = !!team?.resolveComment;
  const filtering = collaborative && !hideFilters;
  const feedback = (item: QueueItem) => openCommentThreads(team?.comments || [],item.id,team?.me || '');
  const shown = filtering ? items.filter(item => feedbackFilter==='all' || (feedbackFilter==='open' ? feedback(item).open>0 : feedback(item).mentioned>0)) : items;
  const mentionedPosts = items.filter(item => feedback(item).mentioned>0).length;
  return (<>
    {filtering && <div role="group" aria-label="Feedback filters" style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:16}}>
      {([['all','All posts'],['open','Open feedback'],['mentioned',`Mentioned you${mentionedPosts?` (${mentionedPosts})`:''}`]] as const).map(([key,label])=><button key={key} type="button" aria-pressed={feedbackFilter===key} onClick={()=>setFeedbackFilter(key)}
        style={{minHeight:44,padding:'8px 14px',border:'1px solid var(--cb-line-bold)',borderRadius:999,background:feedbackFilter===key?'var(--cb-ink)':'var(--cb-paper)',color:feedbackFilter===key?'var(--cb-paper)':'var(--cb-ink)',font:'inherit',fontSize:13,fontWeight:600,cursor:'pointer'}}>{label}</button>)}
    </div>}
    {filtering && shown.length===0 && <p role="status" style={{fontSize:14,color:'var(--cb-ink-mute)',marginTop:16}}>{feedbackFilter==='mentioned'?'No open threads mention you in this batch.':'No open feedback in this batch.'}</p>}
    <div data-batch-review-overview className="cb-batch-grid">
      <style>{`
        .cb-batch-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(min(100%,250px),1fr)); gap:18px; margin-top:16px; font-family:var(--cb-body); }
        .cb-batch-card { display:flex; flex-direction:column; min-width:0; overflow:hidden; border:1px solid var(--cb-line); border-radius:26px; background:var(--cb-paper); color:var(--cb-ink); }
        .cb-batch-media { position:relative; background:var(--cb-paper-sunk); aspect-ratio:4/3; min-width:0; overflow:hidden; }
        .cb-batch-media img { position:absolute; inset:0; display:block; width:100%; height:100%; object-fit:contain; }
        .cb-batch-fallback { position:absolute; inset:0; display:flex; height:100%; flex-direction:column; align-items:center; justify-content:center; gap:12px; padding:22px; color:var(--cb-ink-mute); }
        .cb-batch-fallback p { margin:0; font-size:14px; line-height:1.5; overflow-wrap:anywhere; }
        .cb-batch-video { position:absolute; bottom:10px; left:12px; display:inline-flex; align-items:center; gap:6px; padding:5px 9px; border-radius:999px; background:var(--cb-paper); color:var(--cb-ink); font-size:12px; font-weight:700; }
        .cb-batch-info { display:flex; flex:1; flex-direction:column; padding:18px; min-width:0; }
        .cb-batch-format { font-size:12.5px; color:var(--cb-ink-mute); font-weight:700; }
        .cb-batch-info h3 { margin:7px 0 4px; font:500 22px/1.25 var(--cb-serif); overflow-wrap:anywhere; }
        .cb-batch-state { margin-top:auto; padding-top:12px; font-size:13px; font-weight:700; }
        .cb-batch-date { margin:4px 0 0; color:var(--cb-ink-mute); font-size:12.5px; line-height:1.5; }
        .cb-batch-open { display:flex; justify-content:center; align-items:center; width:100%; margin-top:14px; padding:10px 16px; border:1px solid var(--cb-line-bold); border-radius:999px; background:var(--cb-paper); color:var(--cb-ink); font:700 14px/1.4 var(--cb-body); cursor:pointer; }
        .cb-batch-open:hover { background:var(--cb-paper-sunk); }
        .cb-batch-open:focus-visible, [data-post-source-origin] a:focus-visible { outline:3px solid var(--cb-ink); outline-offset:3px; }
        @media (max-width:600px) { .cb-batch-grid { grid-template-columns:minmax(0,1fr); } .cb-batch-media { aspect-ratio:16/10; } }
      `}</style>
      {shown.map(item => {
        const title = (item.title || item.hook || 'Untitled post').replace(/^\[[^\]]*\]\s*/, '');
        const date = dateFor?.(item);
        const commentCount = team?.comments.filter(comment => comment.ref === item.id).length || 0;
        const origin = postSourceOrigin(item);
        return (
          <article data-batch-review-card={item.id} key={item.id} className="cb-batch-card">
            <Preview item={item} />
            <div className="cb-batch-info">
              <span className="cb-batch-format">{formatOf(item)}</span>
              <h3>{title}</h3>
              <PostReviewTags item={item} />
              <div data-post-source-origin style={{ display:'flex', alignItems:'center', flexWrap:'wrap', gap:'0 12px', marginTop:4, fontSize:12.5, lineHeight:1.5, overflowWrap:'anywhere' }}>
                <span><span style={{ color:'var(--cb-ink-mute)' }}>{origin.label === 'Source pending' ? '' : 'Source: '}</span>{origin.label}</span>
                {origin.href && <a href={origin.href} target="_blank" rel="noopener noreferrer" onClick={event => event.stopPropagation()} style={{ display:'inline-flex', alignItems:'center', minHeight:44, color:'inherit', textDecoration:'underline', textUnderlineOffset:3 }}>Open source</a>}
              </div>
              {collaborative && feedback(item).open>0 && <div data-batch-feedback style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center',fontSize:12.5,fontWeight:600,marginTop:12}}>
                <span style={{display:'inline-flex',alignItems:'center',gap:5}}><MessageCircle size={14} aria-hidden="true"/>{feedback(item).open} open thread{feedback(item).open===1?'':'s'}</span>
                {feedback(item).mentioned>0 && <span style={{display:'inline-flex',alignItems:'center',gap:5}}><AtSign size={14} aria-hidden="true"/>Mentioned you</span>}
              </div>}
              {!collaborative && commentCount > 0 && <div data-batch-feedback style={{ display:'flex', gap:5, alignItems:'center', fontSize:12.5, fontWeight:600, marginTop:12 }}>
                <MessageCircle size={14} aria-hidden="true" />{commentCount} {commentCount === 1 ? 'comment' : 'comments'}
              </div>}
              <div className="cb-batch-state">{statusFor(item)}</div>
              {date && <p className="cb-batch-date">{date}</p>}
              <button type="button" className="cb-batch-open" style={{ minHeight:44, minWidth:44 }} aria-label={`Open review: ${title}`} onClick={() => onOpen(item)}>Open review <span aria-hidden="true">&nbsp;→</span></button>
              {cardAction?.(item)}
            </div>
          </article>
        );
      })}
    </div>
  </>);
}

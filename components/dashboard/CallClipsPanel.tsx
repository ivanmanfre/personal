import React, { useState } from 'react';
import {
  Check,
  X,
  AlertTriangle,
  Loader2,
  Film,
  Clock,
  ShieldAlert,
  UserCheck,
  Play,
  ExternalLink,
  RotateCcw,
  Calendar,
  Instagram,
  Send,
  CheckCircle2,
} from 'lucide-react';
import { useCallClips } from '../../hooks/useCallClips';
import { HARD_BLOCK_FLAGS, type CallClip, type ClipStatus } from '../../types/callClips';
import PanelCard from './shared/PanelCard';
import EmptyState from './shared/EmptyState';
import LoadingSkeleton from './shared/LoadingSkeleton';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type View = 'inbox' | 'ready' | 'posted';

const VIEW_FILTERS: Record<View, ClipStatus[]> = {
  inbox:  ['pending', 'rendering', 'render_error'],
  ready:  ['ready', 'scheduled', 'posting', 'publish_error'],
  posted: ['posted'],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const isHardBlocked = (clip: CallClip): boolean =>
  clip.anonymizationFlags.some((f) =>
    (HARD_BLOCK_FLAGS as readonly string[]).includes(f)
  );

function formatSeconds(s: number): string {
  const m = Math.floor(s / 60);
  const rem = Math.floor(s % 60);
  return m > 0 ? `${m}m ${rem}s` : `${rem}s`;
}

function scoreColor(score: number): string {
  if (score >= 8) return 'text-emerald-400';
  if (score >= 5) return 'text-amber-400';
  return 'text-zinc-500';
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_STYLES: Partial<Record<ClipStatus, string>> = {
  pending:       'bg-zinc-800/60 text-zinc-400 border-zinc-700/40',
  rendering:     'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  render_error:  'bg-red-500/10 text-red-400 border-red-500/20',
  ready:         'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  scheduled:     'bg-blue-500/10 text-blue-400 border-blue-500/20',
  posting:       'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  publish_error: 'bg-red-500/10 text-red-400 border-red-500/20',
  posted:        'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
  approved:      'bg-teal-500/10 text-teal-400 border-teal-500/20',
  rejected:      'bg-zinc-700/30 text-zinc-500 border-zinc-700/40',
};

const StatusBadge: React.FC<{ status: ClipStatus }> = ({ status }) => {
  const cls = STATUS_STYLES[status] ?? 'bg-zinc-800/60 text-zinc-400 border-zinc-700/40';
  const isSpinning = status === 'rendering' || status === 'posting';
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-medium ${cls}`}
    >
      {isSpinning && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
      {status.replace(/_/g, ' ')}
    </span>
  );
};

// ---------------------------------------------------------------------------
// InboxClipCard
// ---------------------------------------------------------------------------

interface InboxClipCardProps {
  clip: CallClip;
  onApprove: () => void;
  onReject: () => void;
}

const InboxClipCard: React.FC<InboxClipCardProps> = ({ clip, onApprove, onReject }) => {
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const blocked = isHardBlocked(clip);
  const consentBlocked = clip.needsExplicitConsent && !clip.consentReceived;
  const approvable = !blocked && !consentBlocked && clip.status === 'pending';

  const handleApprove = async () => {
    setApproving(true);
    try { await onApprove(); } finally { setApproving(false); }
  };

  const handleReject = async () => {
    setRejecting(true);
    try { await onReject(); } finally { setRejecting(false); }
  };

  const isRendering = clip.status === 'rendering';
  const hasError = clip.status === 'render_error';

  return (
    <article
      className={`group border rounded-xl overflow-hidden transition-colors ${
        blocked || clip.status === 'render_error'
          ? 'bg-red-950/10 border-red-500/20'
          : clip.status === 'rendering'
          ? 'bg-cyan-950/10 border-cyan-500/20'
          : 'bg-zinc-900/60 border-zinc-800/60 hover:border-zinc-700/60'
      }`}
    >
      {/* Header row */}
      <div className="flex items-start gap-3 px-4 py-3">
        {/* Preview slot — wire to composite/video_url once renderer ships */}
        <div className="flex-shrink-0 w-16 h-20 rounded-lg bg-zinc-800/60 border border-zinc-700/40 flex items-center justify-center overflow-hidden">
          {clip.videoUrl ? (
            <a
              href={clip.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-1 text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <Play className="w-5 h-5" />
              <span className="text-[9px]">play</span>
            </a>
          ) : (
            <Film className="w-6 h-6 text-zinc-700" />
          )}
        </div>

        {/* Meta */}
        <div className="flex-1 min-w-0">
          {/* Hook line — serif italic, Ivan brand */}
          <p className="text-sm italic font-medium text-zinc-200 leading-snug mb-1.5 line-clamp-2"
             style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}>
            &ldquo;{clip.hookLine || 'No hook line extracted'}&rdquo;
          </p>

          {/* Inline meta chips */}
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <StatusBadge status={clip.status} />

            <span className={`text-[10px] font-semibold ${scoreColor(clip.score)}`}>
              Score {clip.score}
            </span>

            <span className="text-[10px] text-zinc-500 flex items-center gap-0.5">
              <Clock className="w-3 h-3" />
              {formatSeconds(clip.durationSeconds)}
            </span>

            <span className="text-[10px] text-zinc-600 font-mono truncate max-w-[120px]">
              {clip.sourceRecordingId}
            </span>
          </div>

          {/* Anonymization flags */}
          {clip.anonymizationFlags.length > 0 && (
            <div className={`flex items-start gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg border mb-2 ${
              blocked
                ? 'bg-red-950/30 border-red-500/25 text-red-300'
                : 'bg-amber-950/20 border-amber-500/20 text-amber-300'
            }`}>
              <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>
                {blocked ? <strong>Hard block: </strong> : <strong>Soft warn: </strong>}
                {clip.anonymizationFlags.join(', ')}
                {blocked && (
                  <span className="block text-[10px] text-red-400/70 mt-0.5">
                    Edit the clip transcript to remove identifying detail before approving.
                  </span>
                )}
              </span>
            </div>
          )}

          {/* Consent gate */}
          {consentBlocked && (
            <div className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg border bg-amber-950/20 border-amber-500/20 text-amber-300 mb-2">
              <UserCheck className="w-3 h-3 flex-shrink-0" />
              <span>Awaiting explicit client consent before publish.</span>
            </div>
          )}

          {/* Render error */}
          {hasError && clip.renderError && (
            <div className="flex items-start gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg border bg-red-950/20 border-red-500/25 text-red-300 mb-2">
              <ShieldAlert className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span className="font-mono text-[10px] break-all">{clip.renderError}</span>
            </div>
          )}
        </div>
      </div>

      {/* Action bar */}
      <div className="px-4 py-2.5 border-t border-zinc-800/40 bg-zinc-900/40 flex items-center gap-2">
        {clip.status === 'pending' && (
          <>
            <button
              onClick={handleApprove}
              disabled={!approvable || approving}
              title={
                blocked ? 'Clear anonymization flags first'
                : consentBlocked ? 'Awaiting client consent'
                : 'Approve for render'
              }
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {approving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              Approve
            </button>

            <button
              onClick={handleReject}
              disabled={rejecting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700/50 hover:text-red-400 hover:border-red-500/30 disabled:opacity-40 transition-colors"
            >
              {rejecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
              Reject
            </button>
          </>
        )}

        {clip.status === 'rendering' && (
          <span className="flex items-center gap-1.5 text-[11px] text-cyan-400">
            <Loader2 className="w-3 h-3 animate-spin" /> Rendering…
          </span>
        )}

        {clip.status === 'render_error' && (
          <button
            onClick={handleApprove}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-amber-600/20 text-amber-400 border border-amber-500/30 hover:bg-amber-600/30 transition-colors"
          >
            <RotateCcw className="w-3 h-3" /> Retry render
          </button>
        )}

        {clip.videoUrl && (
          <a
            href={clip.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <ExternalLink className="w-3 h-3" /> View clip
          </a>
        )}

        {clip.linkedinPostUrl && (
          <a
            href={clip.linkedinPostUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
          >
            <ExternalLink className="w-3 h-3" /> LinkedIn
          </a>
        )}
      </div>
    </article>
  );
};

// ---------------------------------------------------------------------------
// ReadyClipCard
// ---------------------------------------------------------------------------

interface ReadyClipCardProps {
  clip: CallClip;
  onSchedule: (id: string, scheduledAt: string, postCopy: string, igCrossPost: boolean) => Promise<void>;
}

const ReadyClipCard: React.FC<ReadyClipCardProps> = ({ clip, onSchedule }) => {
  const [postCopy, setPostCopy] = useState(clip.postCopyLinkedIn || clip.suggestedCaption);
  const [scheduledAt, setScheduledAt] = useState(clip.scheduledAt || '');
  const [igCross, setIgCross] = useState(clip.instagramCrossPost);
  const [scheduling, setScheduling] = useState(false);

  const isScheduled = clip.status === 'scheduled' || clip.status === 'posting';
  const canSubmit = !!scheduledAt && !!postCopy.trim() && !isScheduled;

  const handleSchedule = async () => {
    setScheduling(true);
    try { await onSchedule(clip.id, scheduledAt, postCopy, igCross); }
    finally { setScheduling(false); }
  };

  return (
    <article className={`group border rounded-xl overflow-hidden transition-colors ${
      clip.status === 'publish_error'
        ? 'bg-red-950/10 border-red-500/20'
        : clip.status === 'posting'
        ? 'bg-cyan-950/10 border-cyan-500/20'
        : clip.status === 'scheduled'
        ? 'bg-blue-950/10 border-blue-500/20'
        : 'bg-zinc-900/60 border-zinc-800/60 hover:border-zinc-700/60'
    }`}>

      {/* Header row */}
      <div className="flex items-start gap-3 px-4 py-3">
        {/* Video preview / render-pending placeholder */}
        <div className="flex-shrink-0 w-16 h-20 rounded-lg bg-zinc-800/60 border border-zinc-700/40 flex items-center justify-center overflow-hidden">
          {clip.videoUrl ? (
            <video
              src={clip.videoUrl}
              controls
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center gap-1 text-zinc-600">
              <Film className="w-5 h-5" />
              <span className="text-[8px] text-center leading-tight px-0.5">render pending</span>
            </div>
          )}
        </div>

        {/* Meta + controls */}
        <div className="flex-1 min-w-0">
          {/* Hook line */}
          <p
            className="text-sm italic font-medium text-zinc-200 leading-snug mb-1.5 line-clamp-2"
            style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
          >
            &ldquo;{clip.hookLine || 'No hook line extracted'}&rdquo;
          </p>

          {/* Meta chips */}
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <StatusBadge status={clip.status} />
            <span className={`text-[10px] font-semibold ${scoreColor(clip.score)}`}>
              Score {clip.score}
            </span>
            <span className="text-[10px] text-zinc-500 flex items-center gap-0.5">
              <Clock className="w-3 h-3" />
              {formatSeconds(clip.durationSeconds)}
            </span>
          </div>

          {/* LinkedIn copy editor */}
          <div className="mb-2">
            <label className="block text-[10px] text-zinc-400 font-medium mb-1">
              LinkedIn copy
            </label>
            <textarea
              value={postCopy}
              onChange={(e) => setPostCopy(e.target.value)}
              disabled={isScheduled}
              rows={5}
              className="w-full text-[11px] bg-zinc-800/60 border border-zinc-700/40 rounded-lg px-2.5 py-2 text-zinc-200 placeholder-zinc-600 resize-none focus:outline-none focus:border-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="LinkedIn post copy…"
            />
          </div>

          {/* IG cross-post toggle */}
          <label className="flex items-center gap-2 text-[11px] text-zinc-400 mb-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={igCross}
              onChange={(e) => setIgCross(e.target.checked)}
              disabled={isScheduled}
              className="w-3 h-3 rounded accent-teal-500 disabled:cursor-not-allowed"
            />
            <Instagram className="w-3 h-3" />
            Also post to Instagram
          </label>

          {/* Schedule datetime picker */}
          <div className="mb-3">
            <label className="block text-[10px] text-zinc-400 font-medium mb-1 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Schedule for
            </label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              disabled={isScheduled}
              className="text-[11px] bg-zinc-800/60 border border-zinc-700/40 rounded-lg px-2.5 py-1.5 text-zinc-200 focus:outline-none focus:border-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
        </div>
      </div>

      {/* Publish error banner */}
      {clip.status === 'publish_error' && clip.publishError && (
        <div className="mx-4 mb-3 flex items-start gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg border bg-red-950/20 border-red-500/25 text-red-300" role="alert">
          <ShieldAlert className="w-3 h-3 mt-0.5 flex-shrink-0" />
          <span>Publish failed: {clip.publishError}</span>
        </div>
      )}

      {/* Action bar */}
      <div className="px-4 py-2.5 border-t border-zinc-800/40 bg-zinc-900/40 flex items-center gap-2">
        {clip.status === 'ready' && (
          <button
            onClick={handleSchedule}
            disabled={!canSubmit || scheduling}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {scheduling
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <Send className="w-3 h-3" />
            }
            Send to LinkedIn queue
          </button>
        )}

        {clip.status === 'publish_error' && (
          <button
            onClick={handleSchedule}
            disabled={!canSubmit || scheduling}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-amber-600/20 text-amber-400 border border-amber-500/30 hover:bg-amber-600/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {scheduling
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <RotateCcw className="w-3 h-3" />
            }
            Reschedule
          </button>
        )}

        {clip.status === 'scheduled' && (
          <span className="flex items-center gap-1.5 text-[11px] text-blue-400">
            <CheckCircle2 className="w-3 h-3" /> Scheduled — waiting for publisher
          </span>
        )}

        {clip.status === 'posting' && (
          <span className="flex items-center gap-1.5 text-[11px] text-cyan-400">
            <Loader2 className="w-3 h-3 animate-spin" /> Posting now…
          </span>
        )}

        {clip.videoUrl && (
          <a
            href={clip.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <ExternalLink className="w-3 h-3" /> View clip
          </a>
        )}
      </div>
    </article>
  );
};

// ---------------------------------------------------------------------------
// PostedClipCard
// ---------------------------------------------------------------------------

interface PostedClipCardProps {
  clip: CallClip;
}

const PostedClipCard: React.FC<PostedClipCardProps> = ({ clip }) => (
  <article className="group border rounded-xl overflow-hidden bg-zinc-900/60 border-zinc-800/60 hover:border-zinc-700/60 transition-colors">

    {/* Header row */}
    <div className="flex items-start gap-3 px-4 py-3">
      {/* Video preview */}
      <div className="flex-shrink-0 w-16 h-20 rounded-lg bg-zinc-800/60 border border-zinc-700/40 flex items-center justify-center overflow-hidden">
        {clip.videoUrl ? (
          <video
            src={clip.videoUrl}
            controls
            className="w-full h-full object-cover"
          />
        ) : (
          <Film className="w-6 h-6 text-zinc-700" />
        )}
      </div>

      {/* Meta */}
      <div className="flex-1 min-w-0">
        {/* Hook line */}
        <p
          className="text-sm italic font-medium text-zinc-200 leading-snug mb-1.5 line-clamp-2"
          style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
        >
          &ldquo;{clip.hookLine || 'No hook line'}&rdquo;
        </p>

        {/* Meta chips */}
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <StatusBadge status={clip.status} />
          <span className={`text-[10px] font-semibold ${scoreColor(clip.score)}`}>
            Score {clip.score}
          </span>
          {clip.postedAt && (
            <span className="text-[10px] text-zinc-500">
              {new Date(clip.postedAt).toLocaleString(undefined, {
                month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </span>
          )}
        </div>

        {/* Post link(s) */}
        <div className="flex items-center gap-3 flex-wrap">
          {clip.linkedinPostUrl && (
            <a
              href={clip.linkedinPostUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
            >
              <ExternalLink className="w-3 h-3" /> View on LinkedIn ↗
            </a>
          )}
          {clip.instagramPostUrl && (
            <a
              href={clip.instagramPostUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-[11px] text-pink-400 hover:text-pink-300 transition-colors"
            >
              <Instagram className="w-3 h-3" /> View on Instagram ↗
            </a>
          )}
        </div>
        {/* Future: impressions/reactions/comments once Own Post Performance Tracker
            is extended in Task 17 */}
      </div>
    </div>
  </article>
);

// ---------------------------------------------------------------------------
// View tab nav
// ---------------------------------------------------------------------------

const VIEW_LABELS: Record<View, string> = {
  inbox:  'Inbox',
  ready:  'Ready',
  posted: 'Posted',
};

// ---------------------------------------------------------------------------
// CallClipsPanel (exported)
// ---------------------------------------------------------------------------

export const CallClipsPanel: React.FC = () => {
  const [view, setView] = useState<View>('inbox');
  const { clips, loading, approve, reject, schedule } = useCallClips(VIEW_FILTERS[view]);

  if (loading) return <LoadingSkeleton cards={3} rows={4} />;

  return (
    <div className="space-y-4">
      {/* Title + tab row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Call Clips</h1>
          {clips.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700/40">
              {clips.length}
            </span>
          )}
        </div>

        {/* View tabs */}
        <nav className="flex items-center gap-1">
          {(Object.keys(VIEW_LABELS) as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              aria-current={view === v ? 'page' : undefined}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                view === v
                  ? 'bg-zinc-700 text-white border-zinc-600'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-300'
              }`}
            >
              {VIEW_LABELS[v]}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      {clips.length === 0 ? (
        <EmptyState
          title={`No clips in ${VIEW_LABELS[view].toLowerCase()}`}
          description={
            view === 'inbox'
              ? 'Call clips will appear here after the extractor workflow processes a recording. Approve to queue for render.'
              : view === 'ready'
              ? 'Clips approved and rendered will show here, ready to schedule or publish.'
              : 'Published clips are stored here for reference.'
          }
          icon={<Film className="w-10 h-10" />}
        />
      ) : (
        <PanelCard
          title={`${VIEW_LABELS[view]} · Call Clips`}
          icon={<Film className="w-4 h-4" />}
          badge={clips.length}
          accent="cyan"
          scrollable
        >
          <div className="divide-y divide-zinc-800/40">
            {view === 'inbox' && clips.map((clip) => (
              <div key={clip.id} className="px-1 py-1">
                <InboxClipCard
                  clip={clip}
                  onApprove={() => approve(clip.id)}
                  onReject={() => reject(clip.id)}
                />
              </div>
            ))}

            {view === 'ready' && clips.map((clip) => (
              <div key={clip.id} className="px-1 py-1">
                <ReadyClipCard clip={clip} onSchedule={schedule} />
              </div>
            ))}

            {view === 'posted' && clips.map((clip) => (
              <div key={clip.id} className="px-1 py-1">
                <PostedClipCard clip={clip} />
              </div>
            ))}
          </div>
        </PanelCard>
      )}
    </div>
  );
};

export default CallClipsPanel;

import React, { useState, useEffect } from 'react';
import { X, ExternalLink, Send, Archive, Ban, MessageSquare, Heart, Clock } from 'lucide-react';
import { timeAgo } from '../shared/utils';
import type { OutreachProspect, OutreachMessage, OutreachEngagementLog } from '../../../types/dashboard';

interface Props {
  prospect: OutreachProspect;
  messages: OutreachMessage[];
  engagements: OutreachEngagementLog[];
  onClose: () => void;
  onUpdateStage: (id: string, stage: string) => void;
  onUpdateNotes: (id: string, notes: string) => void;
  onUpdateIcpScore: (id: string, score: number) => void;
  onArchive: (id: string, reason?: string) => void;
  onToggleBlacklist: (id: string) => void;
  onToggleNeedsReply: (id: string) => void;
  onSendDm: (id: string, text: string) => void;
  onApproveDraft: (prospectId: string, messageId: string, text: string) => void;
  onRejectDraft: (prospectId: string, messageId: string) => void;
  onFetchMessages: (id: string) => void;
  onFetchEngagements: (id: string) => void;
}

const allStages = ['identified', 'enriched', 'warming', 'engaged', 'connection_sent', 'connected', 'dm_sent', 'replied', 'converted', 'archived'];

const stageColors: Record<string, string> = {
  identified: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
  enriched: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  warming: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  engaged: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  connection_sent: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  connected: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  dm_sent: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  replied: 'bg-emerald-500/25 text-emerald-300 border-emerald-500/40',
  converted: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  archived: 'bg-zinc-500/15 text-zinc-500 border-zinc-600/30',
};

function icpColor(score: number | null): string {
  if (score == null) return 'text-zinc-500';
  if (score >= 8) return 'text-emerald-400';
  if (score >= 6) return 'text-amber-400';
  return 'text-red-400';
}

const actionTypeLabels: Record<string, string> = {
  profile_view: 'Viewed profile',
  like: 'Liked post',
  comment: 'Commented on post',
  connection_request: 'Connection request sent',
  dm: 'DM sent',
};

export const ProspectDetailModal: React.FC<Props> = ({
  prospect, messages, engagements, onClose,
  onUpdateStage, onUpdateNotes, onUpdateIcpScore,
  onArchive, onToggleBlacklist, onToggleNeedsReply, onSendDm,
  onApproveDraft, onRejectDraft,
  onFetchMessages, onFetchEngagements,
}) => {
  const [notes, setNotes] = useState(prospect.notes || '');
  const [dmText, setDmText] = useState('');
  const [notesTimer, setNotesTimer] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    onFetchMessages(prospect.id);
    onFetchEngagements(prospect.id);
  }, [prospect.id, onFetchMessages, onFetchEngagements]);

  const handleNotesChange = (value: string) => {
    setNotes(value);
    if (notesTimer) clearTimeout(notesTimer);
    setNotesTimer(setTimeout(() => onUpdateNotes(prospect.id, value), 1000));
  };

  const handleSendDm = () => {
    if (!dmText.trim()) return;
    onSendDm(prospect.id, dmText.trim());
    setDmText('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-2xl bg-zinc-900 border-l border-zinc-800 h-full overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-zinc-900/95 backdrop-blur-sm border-b border-zinc-800/60 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {prospect.profilePhotoUrl ? (
              <img src={prospect.profilePhotoUrl} alt="" className="w-10 h-10 rounded-full" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 text-sm font-medium">
                {prospect.name.charAt(0)}
              </div>
            )}
            <div>
              <h2 className="text-lg font-semibold text-white">{prospect.name}</h2>
              <p className="text-sm text-zinc-400">{prospect.headline || prospect.company || ''}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-800 transition-colors">
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-5">
          {/* Needs Reply Banner */}
          {prospect.needsManualReply && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2.5 flex items-center justify-between">
              <span className="text-xs font-medium text-emerald-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Needs manual reply
              </span>
              <button
                onClick={() => onToggleNeedsReply(prospect.id)}
                className="text-[10px] text-zinc-400 hover:text-zinc-300 px-2 py-0.5 rounded bg-zinc-800/60"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Profile Info */}
          <div className="bg-zinc-800/40 border border-zinc-700/40 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-4 flex-wrap">
              {prospect.company && <span className="text-sm text-zinc-300">{prospect.company}</span>}
              {(prospect.title || prospect.headline) && <span className="text-xs text-zinc-400">{prospect.title || prospect.headline}</span>}
              {prospect.seniority && <span className="text-xs text-zinc-500 capitalize">{prospect.seniority}</span>}
            </div>
            <div className="flex items-center gap-3 flex-wrap text-xs text-zinc-500">
              {prospect.location && <span>{prospect.location}</span>}
              {prospect.industry && <span>{prospect.industry}</span>}
              {prospect.employeeCount && <span>{prospect.employeeCount} emp</span>}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className={`text-sm font-medium ${icpColor(prospect.icpScore)}`}>
                ICP: {prospect.icpScore ?? '-'}/10
              </span>
              <span className={`text-sm font-medium ${icpColor(prospect.activityScore)}`}>
                Activity: {prospect.activityScore ?? '-'}/10
              </span>
              <select
                value={prospect.stage}
                onChange={(e) => onUpdateStage(prospect.id, e.target.value)}
                className={`px-2 py-0.5 rounded text-xs font-medium border bg-transparent cursor-pointer ${stageColors[prospect.stage] || stageColors.identified}`}
              >
                {allStages.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {prospect.campaignName && (
                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] bg-purple-500/15 text-purple-400 border border-purple-500/20">
                  {prospect.campaignName}
                </span>
              )}
              {prospect.email && (
                <a href={`mailto:${prospect.email}`} className="inline-flex items-center gap-1 text-[10px] text-zinc-400 hover:text-zinc-300">
                  {prospect.email}
                </a>
              )}
            </div>
            <a
              href={prospect.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              Open LinkedIn <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Research Trigger - Full Reasoning Chain */}
          {prospect.triggerType && prospect.triggerType !== 'none' && (
            <div className="bg-zinc-800/40 border border-cyan-500/20 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-cyan-400 uppercase tracking-wider font-medium">Research Trigger</span>
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded border ${prospect.preferredChannel === 'email' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                    {prospect.preferredChannel || 'linkedin'}
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    {prospect.triggerType?.replace('_', ' ')} ({prospect.triggerConfidence}/5)
                  </span>
                </div>
              </div>
              {prospect.triggerDetail && (
                <p className="text-xs text-zinc-300">{prospect.triggerDetail}</p>
              )}
              {/* Micro Persona */}
              {prospect.microPersona && (
                <div className="bg-zinc-900/60 rounded-lg p-2.5">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] text-zinc-500">Micro Persona:</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${
                      ({ scaling_pain: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
                         process_pain: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                         cost_pain: 'bg-red-500/10 text-red-400 border-red-500/20',
                         compliance_pain: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
                         transition_pain: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
                         competitive_pain: 'bg-pink-500/10 text-pink-400 border-pink-500/20'
                      } as Record<string, string>)[prospect.microPersona] || 'bg-zinc-700/50 text-zinc-400 border-zinc-600/30'
                    }`}>
                      {prospect.microPersona.replace('_', ' ')}
                    </span>
                  </div>
                  {prospect.researchSources?.micro_persona_reasoning && (
                    <p className="text-[10px] text-zinc-400 italic">{prospect.researchSources.micro_persona_reasoning}</p>
                  )}
                </div>
              )}
              {/* Messaging Pattern */}
              {prospect.messagingPattern && (
                <div className="bg-zinc-900/60 rounded-lg p-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-zinc-500">Pattern:</span>
                    <span className="text-[10px] text-zinc-300 font-medium">{prospect.messagingPattern.replace('_', ' ')}</span>
                  </div>
                </div>
              )}
              {/* Research Sources */}
              {prospect.researchSources && (
                <div className="bg-zinc-900/60 rounded-lg p-2.5">
                  <p className="text-[10px] text-zinc-500 mb-1.5">Research Sources:</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px]">
                    <span className={prospect.researchSources.linkedin_posts > 0 ? 'text-emerald-400' : 'text-zinc-600'}>
                      {prospect.researchSources.linkedin_posts > 0 ? '✓' : '○'} LinkedIn: {prospect.researchSources.linkedin_posts || 0} posts
                    </span>
                    <span className={prospect.researchSources.website_chars > 0 ? 'text-emerald-400' : 'text-zinc-600'}>
                      {prospect.researchSources.website_chars > 0 ? '✓' : '○'} Website: {prospect.researchSources.website_chars > 0 ? `${Math.round(prospect.researchSources.website_chars / 100) / 10}K` : 'none'}
                    </span>
                    <span className={prospect.researchSources.job_postings > 0 ? 'text-emerald-400' : 'text-zinc-600'}>
                      {prospect.researchSources.job_postings > 0 ? '✓' : '○'} Jobs: {prospect.researchSources.job_postings || 0}
                    </span>
                    <span className={prospect.researchSources.intel_chars > 0 ? 'text-emerald-400' : 'text-zinc-600'}>
                      {prospect.researchSources.intel_chars > 0 ? '✓' : '○'} Intel: {prospect.researchSources.intel_chars > 0 ? `${Math.round(prospect.researchSources.intel_chars / 100) / 10}K` : 'none'}
                    </span>
                  </div>
                </div>
              )}
              {/* Hook + Ask */}
              {prospect.triggerHook && (
                <div className="bg-zinc-900/60 rounded-lg p-2.5">
                  <p className="text-[10px] text-zinc-500 mb-1">Hook:</p>
                  <p className="text-xs text-zinc-200 italic">"{prospect.triggerHook}"</p>
                </div>
              )}
              {prospect.triggerAsk && (
                <div className="bg-zinc-900/60 rounded-lg p-2.5">
                  <p className="text-[10px] text-zinc-500 mb-1">Ask:</p>
                  <p className="text-xs text-zinc-200 italic">"{prospect.triggerAsk}"</p>
                </div>
              )}
              <div className="flex items-center justify-between text-[10px] text-zinc-600">
                {prospect.triggerSourceUrl && (
                  <a href={prospect.triggerSourceUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-400/60 hover:text-cyan-400">Source</a>
                )}
                {prospect.researchedAt && <span>Researched {timeAgo(prospect.researchedAt)}</span>}
              </div>
            </div>
          )}

          {/* Outreach Timeline */}
          {(prospect.profileViewedAt || prospect.connectionSentAt || prospect.connectedAt || prospect.lastDmSentAt || prospect.lastReplyAt) && (
            <div className="bg-zinc-800/40 border border-zinc-700/40 rounded-xl p-4">
              <span className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium block mb-3">Outreach Timeline</span>
              <div className="space-y-1.5">
                {[
                  { label: 'Profile viewed', date: prospect.profileViewedAt },
                  { label: 'Last engaged', date: prospect.lastEngagedAt },
                  { label: 'Connection sent', date: prospect.connectionSentAt },
                  { label: 'Connected', date: prospect.connectedAt },
                  { label: `DMs sent (${prospect.dmCount})`, date: prospect.lastDmSentAt },
                  { label: `Replies (${prospect.replyCount})`, date: prospect.lastReplyAt },
                ].filter(e => e.date).map((e, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400">{e.label}</span>
                    <span className="text-zinc-500">{timeAgo(e.date!)}</span>
                  </div>
                ))}
              </div>
              {prospect.connectionNote && (
                <div className="mt-2 pt-2 border-t border-zinc-700/30">
                  <p className="text-[10px] text-zinc-500">Connection note: <span className="text-zinc-400">"{prospect.connectionNote}"</span></p>
                </div>
              )}
            </div>
          )}

          {/* Scores */}
          <div className="bg-zinc-800/40 border border-zinc-700/40 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium">Scores & Topics</span>
              <select
                value={prospect.icpScore ?? ''}
                onChange={(e) => onUpdateIcpScore(prospect.id, Number(e.target.value))}
                className="px-2 py-0.5 rounded text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 cursor-pointer"
              >
                <option value="">-</option>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            {prospect.icpReasoning && (
              <p className="text-xs text-zinc-400">{prospect.icpReasoning}</p>
            )}
            {prospect.recentTopics.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {prospect.recentTopics.map((t, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-full text-[10px] bg-zinc-700/60 text-zinc-400">{t}</span>
                ))}
              </div>
            )}
            <div className="flex gap-4 text-xs text-zinc-500">
              <span>Posts (30d): {prospect.postCount30d ?? '-'}</span>
              <span>Liked: {prospect.postsLiked}</span>
              <span>Commented: {prospect.postsCommented}</span>
            </div>
          </div>

          {/* Engagement Timeline */}
          <div className="bg-zinc-800/40 border border-zinc-700/40 rounded-xl p-4">
            <span className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium block mb-3">Engagement Timeline</span>
            {engagements.length === 0 ? (
              <p className="text-xs text-zinc-600">No engagement yet</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {engagements.map((e) => (
                  <div key={e.id} className="flex items-start gap-2 text-xs">
                    <span className="text-zinc-600 whitespace-nowrap w-20 shrink-0">
                      {new Date(e.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    <span className={`${e.success ? 'text-zinc-400' : 'text-red-400'}`}>
                      {actionTypeLabels[e.actionType] || e.actionType}
                      {e.commentText && <span className="text-zinc-500 ml-1">"{e.commentText.slice(0, 60)}..."</span>}
                      {!e.success && e.errorMessage && <span className="text-red-400/70 ml-1">({e.errorMessage})</span>}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Messages */}
          <div className="bg-zinc-800/40 border border-zinc-700/40 rounded-xl p-4">
            <span className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium block mb-3">Messages</span>
            {messages.length === 0 ? (
              <p className="text-xs text-zinc-600">No messages yet</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto mb-3">
                {messages.map((m) => (
                  <div key={m.id} className={`flex ${m.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-xl px-3 py-2 text-xs ${
                      m.isDraft
                        ? 'bg-amber-500/15 text-amber-200 border-2 border-amber-500/40 border-dashed'
                        : m.direction === 'outbound'
                        ? 'bg-blue-500/15 text-blue-200 border border-blue-500/20'
                        : 'bg-zinc-700/50 text-zinc-300 border border-zinc-600/30'
                    }`}>
                      {m.isDraft && (
                        <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider block mb-1">Draft - Awaiting Approval</span>
                      )}
                      {m.isDraft && m.matchedContentType && (
                        <div className="mb-2 px-2 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
                          <span className="text-[10px] font-medium text-blue-400 uppercase tracking-wider">
                            Matched {m.matchedContentType === 'post' ? 'Post' : 'Lead Magnet'}
                          </span>
                          {m.industryCluster && (
                            <span className="ml-2 px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400 border border-purple-500/20 text-[9px]">
                              {m.industryCluster}
                            </span>
                          )}
                          <p className="text-blue-300 text-[10px] mt-0.5 line-clamp-2">{m.matchedContentTitle}</p>
                          {m.matchedContentUrl && (
                            <a href={m.matchedContentUrl} target="_blank" rel="noopener noreferrer"
                               className="text-blue-400/70 hover:text-blue-300 underline text-[10px] mt-0.5 inline-block">
                              View content
                            </a>
                          )}
                        </div>
                      )}
                      <p className="whitespace-pre-wrap">{m.messageText}</p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {m.channel === 'email' ? (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20">
                            ✉️ Email {m.emailStep ?? 1}/3
                          </span>
                        ) : m.messageType === 'connection_note' ? (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            🤝 Connection
                          </span>
                        ) : (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            💬 DM {m.sequenceStep ? `${m.sequenceStep}/3` : ''}
                          </span>
                        )}
                        {m.emailSequenceStoppedAt && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-700/30 text-zinc-400 border border-zinc-600/30" title={m.emailSequenceStoppedReason || ''}>
                            ⏹ sequence stopped{m.emailSequenceStoppedReason ? ` (${m.emailSequenceStoppedReason})` : ''}
                          </span>
                        )}
                        <span className="text-[10px] text-zinc-500">
                          {m.isDraft ? `Generated ${timeAgo(m.createdAt)}` : timeAgo(m.sentAt)}
                        </span>
                      </div>
                      {m.isDraft && (
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => onApproveDraft(prospect.id, m.id, m.messageText)}
                            className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 text-[11px] font-medium transition-colors"
                          >
                            Approve & Send
                          </button>
                          <button
                            onClick={() => onRejectDraft(prospect.id, m.id)}
                            className="px-3 py-1 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 text-[11px] font-medium transition-colors"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {/* DM Compose */}
            {(['connected', 'dm_sent', 'replied'].includes(prospect.stage)) && (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={dmText}
                  onChange={(e) => setDmText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSendDm(); }}
                  placeholder="Type a message..."
                  className="flex-1 px-3 py-2 bg-zinc-800/60 border border-zinc-700/40 rounded-lg text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500/40"
                />
                <button
                  onClick={handleSendDm}
                  disabled={!dmText.trim()}
                  className="px-3 py-2 rounded-lg text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors disabled:opacity-40"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="bg-zinc-800/40 border border-zinc-700/40 rounded-xl p-4">
            <span className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium block mb-2">Notes</span>
            <textarea
              value={notes}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder="Add notes about this prospect..."
              rows={3}
              className="w-full px-3 py-2 bg-zinc-800/60 border border-zinc-700/40 rounded-lg text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => onToggleBlacklist(prospect.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-colors ${
                prospect.blacklisted
                  ? 'bg-red-500/15 text-red-400 border-red-500/20 hover:bg-red-500/25'
                  : 'bg-zinc-700/30 text-zinc-400 border-zinc-600/30 hover:bg-zinc-700/50'
              }`}
            >
              <Ban className="w-3 h-3" /> {prospect.blacklisted ? 'Blacklisted' : 'Blacklist'}
            </button>
            <button
              onClick={() => onArchive(prospect.id, 'manual')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-zinc-700/30 text-zinc-400 border border-zinc-600/30 hover:bg-zinc-700/50 transition-colors"
            >
              <Archive className="w-3 h-3" /> Archive
            </button>
            {prospect.nextTouchAfter && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-zinc-500">
                <Clock className="w-3 h-3" /> Next touch: {new Date(prospect.nextTouchAfter).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

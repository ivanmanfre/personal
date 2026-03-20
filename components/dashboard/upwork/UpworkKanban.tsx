import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { ExternalLink, XCircle, FileText, Loader2, ChevronDown, ChevronUp, DollarSign, Users, Star, MessageSquare, Send, RefreshCw, Mail, Edit3, Save } from 'lucide-react';
import { timeAgo } from '../shared/utils';
import type { UpworkJob, UpworkProposal } from '../../../types/dashboard';

function KanbanDiagramPreview({ html }: { html: string }) {
  const [expanded, setExpanded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleLoad = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentDocument?.body) return;
    const h = iframe.contentDocument.body.scrollHeight;
    iframe.style.height = Math.min(h, expanded ? 600 : 200) + 'px';
  }, [expanded]);

  return (
    <div className="rounded-lg border border-purple-500/20 overflow-hidden mt-2">
      <div className="flex items-center justify-between px-2 py-1 bg-purple-950/20 border-b border-purple-500/15">
        <span className="text-[9px] text-purple-400/70 font-medium uppercase tracking-wider">Diagram</span>
        <button onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }} className="text-[9px] text-purple-400/50 hover:text-purple-400 transition-colors">
          {expanded ? 'Collapse' : 'Expand'}
        </button>
      </div>
      <div className={`relative ${expanded ? 'max-h-[600px]' : 'max-h-[200px]'} overflow-hidden transition-all duration-300`}>
        <iframe
          ref={iframeRef}
          srcDoc={html}
          onLoad={handleLoad}
          sandbox="allow-scripts"
          className="w-full border-0 bg-white"
          style={{ height: expanded ? 600 : 200, minHeight: 150 }}
        />
        {!expanded && (
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-zinc-900 to-transparent pointer-events-none" />
        )}
      </div>
    </div>
  );
}

interface Column {
  id: string;
  label: string;
  color: string;
  dotColor: string;
}

const columns: Column[] = [
  { id: 'invites', label: 'Invites', color: 'border-purple-500/30 bg-purple-500/5', dotColor: 'bg-purple-400' },
  { id: 'assessed', label: 'Assessed', color: 'border-blue-500/30 bg-blue-500/5', dotColor: 'bg-blue-400' },
  { id: 'proposal', label: 'Proposal', color: 'border-violet-500/30 bg-violet-500/5', dotColor: 'bg-violet-400' },
  { id: 'review', label: 'Review', color: 'border-amber-500/30 bg-amber-500/5', dotColor: 'bg-amber-400' },
  { id: 'submitted', label: 'Submitted', color: 'border-green-500/30 bg-green-500/5', dotColor: 'bg-green-400' },
];

const EIGHT_HOURS = 8 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

function jobAge(job: UpworkJob): number {
  const ts = job.postedAt || job.createdAt;
  return Date.now() - new Date(ts).getTime();
}

/** Returns true if the job is too stale for the kanban */
function isStale(job: UpworkJob, proposal: UpworkProposal | undefined): boolean {
  // Jobs with proposals in progress or submitted are never stale
  if (proposal) return false;
  const age = jobAge(job);
  // Invites: keep for 24h
  if (job.source === 'invite') return age > TWENTY_FOUR_HOURS;
  // Assessed jobs without a proposal: hide after 8h
  if (job.status === 'assessed' || job.status === 'new') return age > EIGHT_HOURS;
  return false;
}

function icpColor(score: number | null): string {
  if (score == null) return 'text-zinc-500 bg-zinc-500/15 border-zinc-600/30';
  if (score >= 8) return 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30';
  if (score >= 6) return 'text-amber-400 bg-amber-500/15 border-amber-500/30';
  return 'text-red-400 bg-red-500/15 border-red-500/30';
}

function formatBudget(job: UpworkJob): string {
  if (!job.budgetMin && !job.budgetMax) return '';
  if (job.budgetType === 'hourly') return `$${job.budgetMin || 0}-$${job.budgetMax || 0}/hr`;
  if (job.budgetMax) return `$${job.budgetMax.toLocaleString()}`;
  if (job.budgetMin) return `$${job.budgetMin.toLocaleString()}+`;
  return '';
}

function formatClientSpend(amount: number): string {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
  return `$${Math.round(amount)}`;
}

function getColumn(job: UpworkJob, proposal: UpworkProposal | undefined): string | null {
  if (job.status === 'won' || job.status === 'skipped' || job.status === 'rejected') return null;
  if (job.source === 'invite' && !proposal) return 'invites';
  if (job.source === 'invite' && proposal && proposal.status !== 'submitted') return 'invites';
  if (proposal?.status === 'submitted' || job.status === 'submitted' || job.status === 'submitting') return 'submitted';
  if (proposal?.status === 'approved') return 'review';
  if (proposal?.status === 'pending_approval' || proposal?.status === 'draft') return 'review';
  if (proposal && !['submitted', 'approved', 'pending_approval', 'draft'].includes(proposal.status)) return 'proposal';
  if (job.status === 'drafted') return 'proposal';
  if (job.status === 'assessed' || (job.status === 'new' && job.icpScore != null)) return 'assessed';
  return 'assessed';
}

interface Props {
  jobs: UpworkJob[];
  proposals: UpworkProposal[];
  generatingJobs: Set<string>;
  onSkip: (jobId: string) => void;
  onGenerate: (jobId: string, comment?: string) => void;
  onCancelGeneration: (jobId: string) => void;
  onApprove: (proposalId: string) => void;
  onReject: (proposalId: string) => void;
  onSubmit: (proposalId: string) => Promise<void>;
  onEdit: (proposalId: string, field: 'cover_letter' | 'proposal_text', value: string) => void;
}

export const UpworkKanban: React.FC<Props> = ({
  jobs, proposals, generatingJobs,
  onSkip, onGenerate, onCancelGeneration, onApprove, onReject, onSubmit, onEdit,
}) => {
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [, setTick] = useState(0);

  // Re-render every 5 min so stale jobs get pruned continuously
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const proposalMap = useMemo(() => {
    const map = new Map<string, UpworkProposal>();
    for (const p of proposals) {
      const existing = map.get(p.jobId);
      if (!existing || p.createdAt > existing.createdAt) map.set(p.jobId, p);
    }
    return map;
  }, [proposals]);

  const grouped = useMemo(() => {
    const groups: Record<string, { job: UpworkJob; proposal?: UpworkProposal }[]> = {};
    columns.forEach((c) => { groups[c.id] = []; });

    for (const job of jobs) {
      const prop = proposalMap.get(job.id);
      if (isStale(job, prop)) continue;
      const col = getColumn(job, prop);
      if (col && groups[col]) groups[col].push({ job, proposal: prop });
    }
    return groups;
  }, [jobs, proposalMap]);

  const expandedColId = useMemo(() => {
    if (!expandedCard) return null;
    for (const col of columns) {
      if ((grouped[col.id] || []).some(({ job }) => job.id === expandedCard)) return col.id;
    }
    return null;
  }, [expandedCard, grouped]);

  const handleSubmit = async (propId: string) => {
    setActionLoading(propId);
    try { await onSubmit(propId); } finally { setActionLoading(null); }
  };

  return (
    <LayoutGroup>
      <div className="flex gap-3 min-h-[500px]">
        {columns.map((col) => {
          const items = grouped[col.id] || [];
          const hasExpanded = expandedColId === col.id;
          return (
            <div
              key={col.id}
              className={`rounded-xl border ${col.color} p-2.5 flex flex-col min-w-0 transition-all duration-300 ease-out ${hasExpanded ? 'flex-[2.5]' : 'flex-1'}`}
            >
              {/* Column header */}
              <div className="flex items-center justify-between px-1 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${col.dotColor}`} />
                  <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">{col.label}</span>
                </div>
                <span className="text-[11px] text-zinc-500 bg-zinc-800/60 px-2 py-0.5 rounded-md font-medium">{items.length}</span>
              </div>

              {/* Cards */}
              <div className="flex-1 space-y-2 overflow-y-auto max-h-[600px] dashboard-scroll">
                <AnimatePresence mode="popLayout">
                  {items.map(({ job, proposal: prop }) => {
                    const isExpanded = expandedCard === job.id;
                    const isGenerating = generatingJobs.has(job.id);
                    const isInvite = job.source === 'invite';
                    const budget = formatBudget(job);
                    const isLoading = prop && actionLoading === prop.id;

                    return (
                      <motion.div
                        key={job.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        className="bg-zinc-900/80 border border-zinc-700/30 rounded-lg overflow-hidden hover:border-zinc-600/50 transition-colors"
                      >
                        {/* Card header */}
                        <button
                          onClick={() => setExpandedCard(isExpanded ? null : job.id)}
                          className="w-full p-3 text-left"
                        >
                          <div className="flex items-start justify-between gap-1.5">
                            <p className="text-[13px] font-medium text-zinc-200 line-clamp-2 leading-snug">{job.title}</p>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-zinc-600 shrink-0 mt-0.5" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-600 shrink-0 mt-0.5" />}
                          </div>

                          {/* Tags row */}
                          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                            {isInvite && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center gap-0.5">
                                <Mail className="w-3 h-3" /> Invite
                              </span>
                            )}
                            {job.icpScore != null && (
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${icpColor(job.icpScore)}`}>
                                ICP {job.icpScore}
                              </span>
                            )}
                            {budget && (
                              <span className="text-[10px] text-zinc-400 font-medium">{budget}</span>
                            )}
                          </div>

                          {/* Client + time */}
                          <div className="flex items-center gap-2 mt-2">
                            {job.clientHistory?.total_spent != null && job.clientHistory.total_spent > 0 && (
                              <span className="text-[10px] text-zinc-500 flex items-center gap-0.5">
                                <DollarSign className="w-3 h-3" />{formatClientSpend(job.clientHistory.total_spent)}
                              </span>
                            )}
                            {job.clientHistory?.payment_verified && (
                              <span className="text-[10px] text-emerald-500 font-medium">verified</span>
                            )}
                            <span className="text-[10px] text-zinc-600 ml-auto">{timeAgo(job.postedAt)}</span>
                          </div>

                        </button>

                        {/* Expanded content */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                              className="overflow-hidden"
                            >
                              <div className="px-3 pb-3 space-y-2.5 border-t border-zinc-800/40 pt-2.5">
                                {/* Description */}
                                {job.description && (
                                  <p className="text-xs text-zinc-400 leading-relaxed max-h-36 overflow-y-auto dashboard-scroll whitespace-pre-wrap">{job.description}</p>
                                )}

                                {/* ICP reasoning */}
                                {job.icpReasoning && (
                                  <div className="p-2.5 bg-blue-950/20 border border-blue-500/15 rounded-lg text-xs text-blue-300/80 leading-relaxed">
                                    <span className="text-blue-400/60 font-medium">AI: </span>{job.icpReasoning}
                                  </div>
                                )}

                                {/* Client details */}
                                {job.clientHistory && Object.keys(job.clientHistory).length > 0 && (
                                  <div className="flex items-center gap-3 text-[11px] text-zinc-500 flex-wrap">
                                    {job.clientHistory.total_spent != null && job.clientHistory.total_spent > 0 && (
                                      <span className="flex items-center gap-0.5"><DollarSign className="w-3 h-3" />{formatClientSpend(job.clientHistory.total_spent)} spent</span>
                                    )}
                                    {job.clientHistory.total_hires != null && (
                                      <span className="flex items-center gap-0.5"><Users className="w-3 h-3" />{job.clientHistory.total_hires} hires</span>
                                    )}
                                    {job.clientHistory.rating != null && job.clientHistory.rating > 0 && (
                                      <span className="flex items-center gap-0.5"><Star className="w-3 h-3" />{job.clientHistory.rating.toFixed(1)}</span>
                                    )}
                                    {job.clientHistory.country && <span>{job.clientHistory.country}</span>}
                                  </div>
                                )}

                                {/* Skills */}
                                {job.skills.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {job.skills.map((s) => (
                                      <span key={s} className="text-[10px] text-zinc-500 bg-zinc-800/60 px-1.5 py-0.5 rounded">{s}</span>
                                    ))}
                                  </div>
                                )}

                                {/* Screening questions */}
                                {job.screeningQuestions && job.screeningQuestions.length > 0 && (
                                  <div className="p-2.5 bg-amber-950/20 border border-amber-500/15 rounded-lg">
                                    <span className="text-amber-400/70 font-medium text-[11px] block mb-1">Screening:</span>
                                    {job.screeningQuestions.map((q, i) => (
                                      <p key={i} className="text-[11px] text-amber-300/80 ml-1.5 mb-0.5">{i + 1}. {q.question}</p>
                                    ))}
                                  </div>
                                )}

                                {/* Proposal preview */}
                                {prop && (
                                  <div className="p-2.5 bg-emerald-950/10 border border-emerald-500/15 rounded-lg space-y-2">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] text-emerald-400/70 font-medium uppercase tracking-wider">Proposal</span>
                                        <span className="text-[10px] text-zinc-600">v{prop.version}</span>
                                      </div>
                                      {(prop.status === 'pending_approval' || prop.status === 'draft') && editingId !== prop.id && (
                                        <button
                                          onClick={(e) => { e.stopPropagation(); setEditingId(prop.id); setEditValue(prop.coverLetter || prop.proposalText); }}
                                          className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-emerald-400 transition-colors"
                                        >
                                          <Edit3 className="w-3 h-3" /> Edit
                                        </button>
                                      )}
                                    </div>
                                    {editingId === prop.id ? (
                                      <div className="space-y-2">
                                        <textarea
                                          value={editValue}
                                          onChange={(e) => setEditValue(e.target.value)}
                                          className="w-full p-2.5 bg-zinc-800/60 border border-emerald-500/30 rounded-lg text-xs text-zinc-200 leading-relaxed min-h-[160px] focus:outline-none focus:border-emerald-500/50 resize-y"
                                          autoFocus
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                        <div className="flex gap-2">
                                          <button
                                            onClick={(e) => { e.stopPropagation(); onEdit(prop.id, 'cover_letter', editValue); setEditingId(null); }}
                                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                                          >
                                            <Save className="w-3 h-3" /> Save
                                          </button>
                                          <button
                                            onClick={(e) => { e.stopPropagation(); setEditingId(null); setEditValue(''); }}
                                            className="px-2 py-1 rounded-lg text-[11px] font-medium text-zinc-400 hover:text-white transition-colors"
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <p className="text-xs text-zinc-300 leading-relaxed max-h-44 overflow-y-auto dashboard-scroll whitespace-pre-wrap">
                                        {prop.coverLetter || prop.proposalText}
                                      </p>
                                    )}
                                    <div className="flex items-center gap-2.5 text-[10px] text-zinc-500">
                                      {prop.rateAmount != null && <span>${prop.rateAmount}{prop.rateType === 'hourly' ? '/hr' : ' fixed'}</span>}
                                      {prop.estimatedHours != null && <span>{prop.estimatedHours}h est.</span>}
                                      {prop.screeningAnswers && prop.screeningAnswers.length > 0 && (
                                        <span className="flex items-center gap-0.5 text-amber-400/60">
                                          <MessageSquare className="w-3 h-3" />{prop.screeningAnswers.length} answers
                                        </span>
                                      )}
                                    </div>
                                    {prop.screeningAnswers && prop.screeningAnswers.length > 0 && (
                                      <div className="space-y-1.5 pt-1.5 border-t border-emerald-500/10">
                                        {prop.screeningAnswers.map((qa, i) => (
                                          <div key={i}>
                                            <p className="text-[10px] text-amber-400/50 font-medium">Q{i + 1}: {qa.question}</p>
                                            <p className="text-xs text-zinc-300/80 mt-0.5">{qa.answer}</p>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    {prop.diagramData?.html && (
                                      <KanbanDiagramPreview html={prop.diagramData.html} />
                                    )}
                                  </div>
                                )}

                                {/* Actions */}
                                <div className="flex flex-wrap gap-2 pt-1">
                                  <a
                                    href={job.upworkUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-zinc-800 text-zinc-300 border border-zinc-700/50 hover:bg-zinc-700 transition-colors"
                                  >
                                    <ExternalLink className="w-3 h-3" /> Upwork
                                  </a>

                                  {isGenerating ? (
                                    <span className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-purple-400 animate-pulse">
                                      <Loader2 className="w-3 h-3 animate-spin" /> Generating...
                                      <button onClick={() => onCancelGeneration(job.id)} className="text-zinc-500 hover:text-red-400 ml-0.5"><XCircle className="w-3 h-3" /></button>
                                    </span>
                                  ) : !prop && job.icpScore != null ? (
                                    <button
                                      onClick={() => onGenerate(job.id)}
                                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                                    >
                                      <FileText className="w-3 h-3" /> Generate
                                    </button>
                                  ) : null}

                                  {prop && (prop.status === 'pending_approval' || prop.status === 'approved' || prop.status === 'draft') && (
                                    <button
                                      onClick={() => handleSubmit(prop.id)}
                                      disabled={!!isLoading}
                                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-colors disabled:opacity-50"
                                    >
                                      {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />} Submit
                                    </button>
                                  )}

                                  {prop && prop.status !== 'submitted' && (
                                    <button
                                      onClick={() => onGenerate(job.id)}
                                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 transition-colors"
                                    >
                                      <RefreshCw className="w-3 h-3" /> Regen
                                    </button>
                                  )}

                                  {job.status !== 'skipped' && job.status !== 'submitted' && job.status !== 'won' && (
                                    <button
                                      onClick={() => onSkip(job.id)}
                                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-zinc-500 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                                    >
                                      <XCircle className="w-3 h-3" /> Skip
                                    </button>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

                {items.length === 0 && (
                  <p className="text-xs text-zinc-600 text-center py-6">Empty</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </LayoutGroup>
  );
};

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { ExternalLink, XCircle, FileText, Loader2, ChevronDown, ChevronUp, DollarSign, Users, Star, MessageSquare, Send, RefreshCw, Edit3, Save } from 'lucide-react';
import { timeAgo } from '../shared/utils';
import type { UpworkJob, UpworkProposal } from '../../../types/dashboard';

interface Column {
  id: string;
  label: string;
  color: string;
  dotColor: string;
}

const columns: Column[] = [
  { id: 'new', label: 'New', color: 'border-zinc-600/40 bg-zinc-600/5', dotColor: 'bg-zinc-400' },
  { id: 'assessed', label: 'Assessed', color: 'border-blue-500/30 bg-blue-500/5', dotColor: 'bg-blue-400' },
  { id: 'proposal', label: 'Proposal', color: 'border-purple-500/30 bg-purple-500/5', dotColor: 'bg-purple-400' },
  { id: 'review', label: 'Review', color: 'border-amber-500/30 bg-amber-500/5', dotColor: 'bg-amber-400' },
  { id: 'submitted', label: 'Submitted', color: 'border-green-500/30 bg-green-500/5', dotColor: 'bg-green-400' },
  { id: 'outcome', label: 'Won', color: 'border-emerald-500/30 bg-emerald-500/5', dotColor: 'bg-emerald-400' },
];

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

function getColumn(job: UpworkJob, proposal: UpworkProposal | undefined): string {
  if (job.status === 'won') return 'outcome';
  if (job.status === 'skipped' || job.status === 'rejected') return 'outcome';
  if (proposal?.status === 'submitted' || job.status === 'submitted' || job.status === 'submitting') return 'submitted';
  if (proposal?.status === 'approved') return 'review';
  if (proposal?.status === 'pending_approval' || proposal?.status === 'draft') return 'review';
  if (proposal && !['submitted', 'approved', 'pending_approval', 'draft'].includes(proposal.status)) return 'proposal';
  if (job.status === 'drafted') return 'proposal';
  if (job.status === 'assessed' || (job.status === 'new' && job.icpScore != null)) return 'assessed';
  return 'new';
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

    const visibleJobs = jobs.filter((j) => j.status !== 'skipped');
    for (const job of visibleJobs) {
      const prop = proposalMap.get(job.id);
      const col = getColumn(job, prop);
      if (groups[col]) groups[col].push({ job, proposal: prop });
    }
    return groups;
  }, [jobs, proposalMap]);

  const handleSubmit = async (propId: string) => {
    setActionLoading(propId);
    try { await onSubmit(propId); } finally { setActionLoading(null); }
  };

  return (
    <LayoutGroup>
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 min-h-[500px]">
        {columns.map((col) => {
          const items = grouped[col.id] || [];
          return (
            <div key={col.id} className={`rounded-xl border ${col.color} p-2 flex flex-col`}>
              {/* Column header */}
              <div className="flex items-center justify-between px-1 pb-2">
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${col.dotColor}`} />
                  <span className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">{col.label}</span>
                </div>
                <span className="text-[10px] text-zinc-500 bg-zinc-800/60 px-1.5 py-0.5 rounded">{items.length}</span>
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
                        {/* Card header - always visible */}
                        <button
                          onClick={() => setExpandedCard(isExpanded ? null : job.id)}
                          className="w-full p-2.5 text-left"
                        >
                          <div className="flex items-start justify-between gap-1">
                            <p className="text-xs font-medium text-zinc-200 line-clamp-2 leading-tight">{job.title}</p>
                            {isExpanded ? <ChevronUp className="w-3 h-3 text-zinc-600 shrink-0 mt-0.5" /> : <ChevronDown className="w-3 h-3 text-zinc-600 shrink-0 mt-0.5" />}
                          </div>

                          {/* Tags row */}
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            {isInvite && (
                              <span className="px-1 py-0.5 rounded text-[9px] font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30">Invite</span>
                            )}
                            {job.icpScore != null && (
                              <span className={`px-1 py-0.5 rounded text-[9px] font-bold border ${icpColor(job.icpScore)}`}>
                                ICP {job.icpScore}
                              </span>
                            )}
                            {budget && (
                              <span className="text-[9px] text-zinc-500">{budget}</span>
                            )}
                          </div>

                          {/* Client + time */}
                          <div className="flex items-center gap-2 mt-1.5">
                            {job.clientHistory?.total_spent != null && job.clientHistory.total_spent > 0 && (
                              <span className="text-[9px] text-zinc-500 flex items-center gap-0.5">
                                <DollarSign className="w-2.5 h-2.5" />{formatClientSpend(job.clientHistory.total_spent)}
                              </span>
                            )}
                            {job.clientHistory?.payment_verified && (
                              <span className="text-[9px] text-emerald-500">verified</span>
                            )}
                            <span className="text-[9px] text-zinc-600 ml-auto">{timeAgo(job.postedAt)}</span>
                          </div>

                          {/* Proposal status badge */}
                          {prop && (
                            <div className="mt-1.5 flex items-center gap-1.5">
                              <span className="text-[9px] text-zinc-500">Proposal:</span>
                              <span className={`px-1 py-0.5 rounded text-[9px] font-medium border ${
                                prop.status === 'submitted' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                                prop.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                                prop.status === 'pending_approval' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                                'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'
                              }`}>
                                {prop.status === 'pending_approval' ? 'review' : prop.status}
                              </span>
                            </div>
                          )}
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
                              <div className="px-2.5 pb-2.5 space-y-2 border-t border-zinc-800/40 pt-2">
                                {/* Description */}
                                {job.description && (
                                  <p className="text-[10px] text-zinc-400 leading-relaxed line-clamp-4">{job.description}</p>
                                )}

                                {/* ICP reasoning */}
                                {job.icpReasoning && (
                                  <div className="p-2 bg-blue-950/20 border border-blue-500/15 rounded text-[10px] text-blue-300/80 leading-relaxed">
                                    <span className="text-blue-400/60 font-medium">AI: </span>{job.icpReasoning}
                                  </div>
                                )}

                                {/* Skills */}
                                {job.skills.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {job.skills.slice(0, 5).map((s) => (
                                      <span key={s} className="text-[9px] text-zinc-500 bg-zinc-800/60 px-1.5 py-0.5 rounded">{s}</span>
                                    ))}
                                  </div>
                                )}

                                {/* Proposal preview */}
                                {prop && (
                                  <div className="p-2 bg-emerald-950/10 border border-emerald-500/15 rounded space-y-1.5">
                                    <p className="text-[10px] text-zinc-300 leading-relaxed line-clamp-6 whitespace-pre-wrap">
                                      {prop.coverLetter || prop.proposalText}
                                    </p>
                                    <div className="flex items-center gap-2 text-[9px] text-zinc-500">
                                      {prop.rateAmount != null && <span>${prop.rateAmount}{prop.rateType === 'hourly' ? '/hr' : ' fixed'}</span>}
                                      {prop.screeningAnswers && prop.screeningAnswers.length > 0 && (
                                        <span className="flex items-center gap-0.5 text-amber-400/60">
                                          <MessageSquare className="w-2.5 h-2.5" />{prop.screeningAnswers.length} answers
                                        </span>
                                      )}
                                      <span>v{prop.version}</span>
                                    </div>
                                  </div>
                                )}

                                {/* Actions */}
                                <div className="flex flex-wrap gap-1.5 pt-0.5">
                                  <a
                                    href={job.upworkUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-zinc-800 text-zinc-300 border border-zinc-700/50 hover:bg-zinc-700 transition-colors"
                                  >
                                    <ExternalLink className="w-2.5 h-2.5" /> Upwork
                                  </a>

                                  {isGenerating ? (
                                    <span className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-purple-400 animate-pulse">
                                      <Loader2 className="w-2.5 h-2.5 animate-spin" /> Generating...
                                      <button onClick={() => onCancelGeneration(job.id)} className="text-zinc-500 hover:text-red-400 ml-0.5"><XCircle className="w-2.5 h-2.5" /></button>
                                    </span>
                                  ) : !prop && job.icpScore != null ? (
                                    <button
                                      onClick={() => onGenerate(job.id)}
                                      className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                                    >
                                      <FileText className="w-2.5 h-2.5" /> Generate
                                    </button>
                                  ) : null}

                                  {prop && (prop.status === 'pending_approval' || prop.status === 'approved' || prop.status === 'draft') && (
                                    <button
                                      onClick={() => handleSubmit(prop.id)}
                                      disabled={!!isLoading}
                                      className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-colors disabled:opacity-50"
                                    >
                                      {isLoading ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Send className="w-2.5 h-2.5" />} Submit
                                    </button>
                                  )}

                                  {prop && prop.status !== 'submitted' && (
                                    <button
                                      onClick={() => onGenerate(job.id)}
                                      className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 transition-colors"
                                    >
                                      <RefreshCw className="w-2.5 h-2.5" /> Regen
                                    </button>
                                  )}

                                  {job.status !== 'skipped' && job.status !== 'submitted' && job.status !== 'won' && (
                                    <button
                                      onClick={() => onSkip(job.id)}
                                      className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium text-zinc-500 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                                    >
                                      <XCircle className="w-2.5 h-2.5" /> Skip
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
                  <p className="text-[10px] text-zinc-600 text-center py-4">Empty</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </LayoutGroup>
  );
};

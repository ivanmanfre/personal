import React, { useState, useRef } from 'react';
import { Briefcase, ExternalLink, ChevronDown, ChevronRight, XCircle, CheckCircle2, FileText, Zap, Trophy, Mail, Send, Edit3, Save, RefreshCw, Loader2, MessageSquare, DollarSign, Star, Users, LayoutList, Columns3 } from 'lucide-react';
import { useUpworkPipeline } from '../../hooks/useUpworkPipeline';
import { useAutoRefresh, pauseRefresh, resumeRefresh } from '../../hooks/useAutoRefresh';
import StatCard from './shared/StatCard';
import LoadingSkeleton from './shared/LoadingSkeleton';
import RefreshIndicator from './shared/RefreshIndicator';
import EmptyState from './shared/EmptyState';
import { timeAgo } from './shared/utils';
import { UpworkKanban } from './upwork/UpworkKanban';
import { UpworkFunnel } from './upwork/UpworkFunnel';
import type { UpworkJob, UpworkProposal } from '../../types/dashboard';

function formatBudget(job: UpworkJob): string {
  if (!job.budgetMin && !job.budgetMax) return '--';
  if (job.budgetType === 'hourly') return `$${job.budgetMin || 0}-$${job.budgetMax || 0}/hr`;
  if (job.budgetMax) return `$${job.budgetMax.toLocaleString()}`;
  if (job.budgetMin) return `$${job.budgetMin.toLocaleString()}+`;
  return '--';
}

function formatClientSpend(amount: number): string {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
  return `$${Math.round(amount)}`;
}

const statusColors: Record<string, string> = {
  new: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
  assessed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  drafted: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  pending_approval: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  approved: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  submitting: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  submitted: 'bg-green-500/20 text-green-400 border-green-500/30',
  won: 'bg-green-500/25 text-green-300 border-green-500/40',
  skipped: 'bg-zinc-500/15 text-zinc-500 border-zinc-600/30',
  rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
  draft: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
};

const statusLabels: Record<string, string> = {
  pending_approval: 'review',
  draft: 'draft',
};

function icpColor(score: number | null): string {
  if (score == null) return 'text-zinc-500';
  if (score >= 8) return 'text-emerald-400';
  if (score >= 6) return 'text-amber-400';
  return 'text-red-400';
}

function icpBg(score: number | null): string {
  if (score == null) return 'bg-zinc-500/15 border-zinc-600/30';
  if (score >= 8) return 'bg-emerald-500/15 border-emerald-500/30';
  if (score >= 6) return 'bg-amber-500/15 border-amber-500/30';
  return 'bg-red-500/15 border-red-500/30';
}

function statusLabel(s: string): string {
  return statusLabels[s] || s.replace('_', ' ');
}

function getUrlParam(key: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  return new URLSearchParams(window.location.search).get(key) || fallback;
}

function setUrlParam(key: string, value: string) {
  const url = new URL(window.location.href);
  url.searchParams.set(key, value);
  window.history.replaceState({}, '', url.toString());
}

/* ── Inline Regen Input ──────────────────────────────── */

function RegenButton({ onGenerate }: { onGenerate: (comment?: string) => void }) {
  const [showInput, setShowInput] = useState(false);
  const [comment, setComment] = useState('');

  const submit = () => {
    onGenerate(comment.trim() || undefined);
    setComment('');
    setShowInput(false);
  };

  if (showInput) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') { setShowInput(false); setComment(''); } }}
          placeholder="Instructions (optional)..."
          className="px-2 py-1 bg-zinc-800/60 border border-purple-500/30 rounded-lg text-[11px] text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-purple-500/50 w-48"
          autoFocus
        />
        <button onClick={submit} className="px-2 py-1 rounded-lg text-[11px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 transition-colors">Go</button>
        <button onClick={() => { setShowInput(false); setComment(''); }} className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors">Cancel</button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowInput(true)}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 transition-colors"
    >
      <RefreshCw className="w-3 h-3" /> Regenerate
    </button>
  );
}

/* ── Main Panel ──────────────────────────────────────── */

const UpworkPanel: React.FC = () => {
  const { jobs, proposals, stats, loading, generatingJobs, refresh, skipJob, generateProposal, cancelGeneration, approveProposal, rejectProposal, editProposal, submitProposal } = useUpworkPipeline();
  const { lastRefreshed } = useAutoRefresh(refresh);
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>(getUrlParam('filter', 'action'));
  const [editingField, setEditingField] = useState<{ id: string; field: 'proposal_text' | 'cover_letter' } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleFilterChange = (filter: string) => {
    setStatusFilter(filter);
    setUrlParam('filter', filter);
  };

  if (loading) return <LoadingSkeleton cards={5} rows={6} />;

  // Build proposal map: jobId → latest proposal
  const proposalMap = new Map<string, UpworkProposal>();
  for (const p of proposals) {
    const existing = proposalMap.get(p.jobId);
    if (!existing || p.createdAt > existing.createdAt) {
      proposalMap.set(p.jobId, p);
    }
  }

  // Action needed: jobs that need user attention
  const SIX_HOURS = 6 * 60 * 60 * 1000;
  const actionNeeded = jobs.filter((j) => {
    if (j.status === 'skipped' || j.status === 'submitted' || j.status === 'won') return false;
    // Auto-hide non-invite jobs older than 6 hours
    if (j.source !== 'invite' && j.postedAt && Date.now() - new Date(j.postedAt).getTime() > SIX_HOURS) return false;
    const prop = proposalMap.get(j.id);
    // Assessed jobs with decent ICP (ready to generate)
    if ((j.status === 'assessed' || j.status === 'new') && j.icpScore != null && j.icpScore >= 6) return true;
    // Jobs with proposals needing review
    if (prop && (prop.status === 'pending_approval' || prop.status === 'draft' || prop.status === 'approved')) return true;
    return false;
  });

  const actionCount = actionNeeded.length;
  const filteredJobs = statusFilter === 'action' ? actionNeeded
    : statusFilter === 'all' ? jobs.filter((j) => j.status !== 'skipped')
    : statusFilter === 'invites' ? jobs.filter((j) => j.source === 'invite')
    : jobs.filter((j) => j.status === statusFilter);

  const filters = [
    { key: 'action', label: 'Action Needed', count: actionCount },
    { key: 'all', label: 'All', count: stats.totalJobs - stats.skipped },
    { key: 'invites', label: 'Invites', count: stats.invites },
    { key: 'submitted', label: 'Submitted', count: stats.submitted },
    { key: 'skipped', label: 'Skipped', count: stats.skipped },
  ];

  if (jobs.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Upwork Pipeline</h1>
          <RefreshIndicator lastRefreshed={lastRefreshed} onRefresh={refresh} />
        </div>
        <EmptyState title="No Upwork jobs yet" description="Jobs will appear here as the scraper discovers and assesses them." icon={<Briefcase className="w-10 h-10" />} />
      </div>
    );
  }

  // Editing helpers
  const startEdit = (id: string, field: 'proposal_text' | 'cover_letter', currentValue: string) => {
    setEditingField({ id, field });
    setEditValue(currentValue);
    pauseRefresh();
  };

  const saveEdit = () => {
    if (editingField) {
      editProposal(editingField.id, editingField.field, editValue);
      setEditingField(null);
    }
    resumeRefresh();
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue('');
    resumeRefresh();
  };

  const handleSubmit = async (id: string, needsApproval: boolean) => {
    setActionLoading(id);
    try {
      if (needsApproval) await approveProposal(id);
      await submitProposal(id);
    } finally { setActionLoading(null); }
  };

  const handleReject = async (id: string) => {
    setActionLoading(id);
    try { await rejectProposal(id); } finally { setActionLoading(null); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Upwork Pipeline</h1>
          <div className="flex items-center bg-zinc-800/50 rounded-lg p-0.5 border border-zinc-700/30">
            <button
              onClick={() => setView('kanban')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${view === 'kanban' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <Columns3 className="w-3.5 h-3.5" /> Kanban
            </button>
            <button
              onClick={() => setView('list')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${view === 'list' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <LayoutList className="w-3.5 h-3.5" /> List
            </button>
          </div>
        </div>
        <RefreshIndicator lastRefreshed={lastRefreshed} onRefresh={refresh} />
      </div>

      {/* Stats + Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <StatCard label="Action Needed" value={actionCount} icon={<Zap className="w-5 h-5" />} color="text-amber-400" />
          <StatCard label="Invites" value={stats.invites} icon={<Mail className="w-5 h-5" />} color="text-purple-400" />
          <StatCard label="Pending Review" value={stats.pendingApproval} icon={<CheckCircle2 className="w-5 h-5" />} color="text-amber-400" />
          <StatCard label="Submitted" value={stats.submitted} icon={<Send className="w-5 h-5" />} color="text-green-400" subValue={stats.submissionsToday > 0 ? `${stats.submissionsToday} today` : undefined} />
          <StatCard label="Total Jobs" value={stats.totalJobs} icon={<Briefcase className="w-5 h-5" />} color="text-zinc-400" />
        </div>
        <UpworkFunnel stats={stats} />
      </div>

      {/* Kanban or List view */}
      {view === 'kanban' ? (
        <UpworkKanban
          jobs={jobs}
          proposals={proposals}
          generatingJobs={generatingJobs}
          onSkip={skipJob}
          onGenerate={generateProposal}
          onCancelGeneration={cancelGeneration}
          onApprove={approveProposal}
          onReject={rejectProposal}
          onSubmit={submitProposal}
          onEdit={editProposal}
        />
      ) : (
      <>
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => handleFilterChange(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFilter === f.key ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'}`}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {/* Jobs list */}
      <div className="bg-zinc-900/90 border border-zinc-800/60 rounded-2xl shadow-sm shadow-black/10 overflow-hidden">
        {filteredJobs.length === 0 ? (
          <p className="px-4 py-8 text-zinc-500 text-center text-sm">No jobs match this filter</p>
        ) : (
          <div className="divide-y divide-zinc-800/40">
            {filteredJobs.map((job) => {
              const isExpanded = expandedJob === job.id;
              const isSkipped = job.status === 'skipped';
              const isInvite = job.source === 'invite';
              const prop = proposalMap.get(job.id);
              const isGenerating = generatingJobs.has(job.id);
              const isEditingThis = editingField?.id === prop?.id;
              const propEditable = prop && (prop.status === 'draft' || prop.status === 'pending_approval');
              const propSubmittable = prop && (prop.status === 'pending_approval' || prop.status === 'approved');
              const isLoading = prop && actionLoading === prop.id;

              return (
                <div key={job.id}>
                  {/* Job row */}
                  <button
                    onClick={() => setExpandedJob(isExpanded ? null : job.id)}
                    className={`w-full px-4 py-3 flex items-start gap-3 hover:bg-zinc-800/30 transition-colors text-left ${isSkipped ? 'opacity-60' : ''}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isInvite && (
                          <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30">Invite</span>
                        )}
                        <p className={`text-sm font-medium text-zinc-200 truncate ${isSkipped ? 'line-through' : ''}`} title={job.title}>{job.title}</p>
                        <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium border ${statusColors[job.status] || statusColors.new}`}>
                          {statusLabel(job.status)}
                        </span>
                        {prop && (
                          <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium border ${statusColors[prop.status] || statusColors.new}`}>
                            proposal: {statusLabel(prop.status)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        <span className="text-xs text-zinc-400">{formatBudget(job)}</span>
                        {job.icpScore != null && (
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded border ${icpBg(job.icpScore)} ${icpColor(job.icpScore)}`} title={`ICP Score: ${job.icpScore}/10 — ${job.icpScore >= 8 ? 'Strong fit' : job.icpScore >= 6 ? 'Moderate fit' : 'Weak fit'}`}>ICP {job.icpScore}</span>
                        )}
                        <ClientBadge history={job.clientHistory} />
                        {job.skills.slice(0, 3).map((skill) => (
                          <span key={skill} className="text-[10px] text-zinc-500 bg-zinc-800/60 px-1.5 py-0.5 rounded">{skill}</span>
                        ))}
                        {job.skills.length > 3 && <span className="text-[10px] text-zinc-600">+{job.skills.length - 3}</span>}
                        <span className="text-[10px] text-zinc-600">{timeAgo(job.postedAt)}</span>
                      </div>
                    </div>
                    <div className="shrink-0 mt-1">
                      {isExpanded ? <ChevronDown className="w-4 h-4 text-zinc-600" /> : <ChevronRight className="w-4 h-4 text-zinc-600" />}
                    </div>
                  </button>

                  {/* Expanded: job details + inline proposal */}
                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3">
                      {/* Job description */}
                      {job.description && (
                        <div className="p-3 bg-zinc-800/40 border border-zinc-700/40 rounded-lg text-xs text-zinc-300 leading-relaxed max-h-40 overflow-y-auto dashboard-scroll whitespace-pre-wrap">
                          {job.description}
                        </div>
                      )}

                      {job.icpReasoning && (
                        <div className="p-3 bg-blue-950/20 border border-blue-500/15 rounded-lg text-xs text-blue-300/90 leading-relaxed">
                          <span className="text-blue-400/70 font-medium">AI Reasoning: </span>{job.icpReasoning}
                        </div>
                      )}

                      {/* Client history */}
                      {job.clientHistory && Object.keys(job.clientHistory).length > 0 && (
                        <div className="p-3 bg-zinc-800/30 border border-zinc-700/30 rounded-lg">
                          <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider block mb-1.5">Client</span>
                          <div className="flex items-center gap-4 text-xs text-zinc-400 flex-wrap">
                            {job.clientHistory.total_spent != null && job.clientHistory.total_spent > 0 && (
                              <span className="flex items-center gap-1"><DollarSign className="w-3 h-3 text-zinc-500" /> {formatClientSpend(job.clientHistory.total_spent)} spent</span>
                            )}
                            {job.clientHistory.total_hires != null && (
                              <span className="flex items-center gap-1"><Users className="w-3 h-3 text-zinc-500" /> {job.clientHistory.total_hires} hires</span>
                            )}
                            {job.clientHistory.rating != null && job.clientHistory.rating > 0 && (
                              <span className="flex items-center gap-1"><Star className="w-3 h-3 text-zinc-500" /> {job.clientHistory.rating.toFixed(1)}/5</span>
                            )}
                            {job.clientHistory.hire_rate != null && <span>{Math.round(job.clientHistory.hire_rate * 100)}% hire rate</span>}
                            {job.clientHistory.country && <span className="text-zinc-500">{job.clientHistory.country}</span>}
                            {job.clientHistory.payment_verified && <span className="text-emerald-400/70 text-[10px]">Payment verified</span>}
                          </div>
                        </div>
                      )}

                      {/* Screening questions */}
                      {job.screeningQuestions && job.screeningQuestions.length > 0 && (
                        <div className="p-3 bg-amber-950/20 border border-amber-500/15 rounded-lg">
                          <span className="text-amber-400/70 font-medium text-xs block mb-1.5">Screening Questions:</span>
                          {job.screeningQuestions.map((q, i) => (
                            <p key={i} className="text-xs text-amber-300/80 ml-2 mb-1">{i + 1}. {q.question}</p>
                          ))}
                        </div>
                      )}

                      {/* Fit tags */}
                      {(job.fitTags.length > 0 || job.matchedProjects.length > 0) && (
                        <div className="flex flex-wrap gap-2">
                          {job.fitTags.map((tag) => (
                            <span key={tag} className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">{tag}</span>
                          ))}
                          {job.matchedProjects.map((proj) => (
                            <span key={proj} className="text-[10px] text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full">{proj}</span>
                          ))}
                        </div>
                      )}

                      {/* ── Inline Proposal ── */}
                      {prop && (
                        <div className="p-3 bg-emerald-950/10 border border-emerald-500/15 rounded-lg space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-emerald-400/70 font-medium uppercase tracking-wider">Proposal Draft</span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${statusColors[prop.status] || statusColors.new}`}>
                                {statusLabel(prop.status)}
                              </span>
                              <span className="text-[10px] text-zinc-600">v{prop.version}</span>
                              {prop.screeningAnswers && prop.screeningAnswers.length > 0 && (
                                <span className="text-[10px] text-amber-400/60 flex items-center gap-0.5">
                                  <MessageSquare className="w-2.5 h-2.5" /> {prop.screeningAnswers.length} answers
                                </span>
                              )}
                            </div>
                            {propEditable && !isEditingThis && (
                              <button onClick={() => startEdit(prop.id, 'cover_letter', prop.coverLetter || prop.proposalText)} className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-emerald-400 transition-colors">
                                <Edit3 className="w-3 h-3" /> Edit
                              </button>
                            )}
                          </div>

                          {/* Cover letter */}
                          {isEditingThis && editingField!.field === 'cover_letter' ? (
                            <div className="space-y-2">
                              <textarea
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="w-full p-3 bg-zinc-800/60 border border-emerald-500/30 rounded-lg text-xs text-zinc-200 leading-relaxed min-h-[200px] focus:outline-none focus:border-emerald-500/50 resize-y"
                                autoFocus
                              />
                              <div className="flex gap-2">
                                <button onClick={saveEdit} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors">
                                  <Save className="w-3 h-3" /> Save
                                </button>
                                <button onClick={cancelEdit} className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-zinc-400 hover:text-white transition-colors">Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <div className="p-3 bg-zinc-800/40 border border-zinc-700/40 rounded-lg text-xs text-zinc-300 leading-relaxed max-h-64 overflow-y-auto dashboard-scroll whitespace-pre-wrap">
                              {prop.coverLetter || prop.proposalText}
                            </div>
                          )}

                          {/* Screening answers */}
                          {prop.screeningAnswers && prop.screeningAnswers.length > 0 && (
                            <div className="p-3 bg-amber-950/20 border border-amber-500/15 rounded-lg space-y-2">
                              <span className="text-amber-400/70 font-medium text-xs block">Screening Answers:</span>
                              {prop.screeningAnswers.map((qa, i) => (
                                <div key={i} className="ml-2">
                                  <p className="text-[10px] text-amber-400/60 font-medium">Q{i + 1}: {qa.question}</p>
                                  <p className="text-xs text-amber-200/80 mt-0.5">{qa.answer}</p>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Rate info */}
                          <div className="flex items-center gap-3 text-[10px] text-zinc-500">
                            {prop.rateAmount != null && <span>${prop.rateAmount}{prop.rateType === 'hourly' ? '/hr' : ' fixed'}</span>}
                            {prop.estimatedHours != null && <span>{prop.estimatedHours}h est.</span>}
                            {prop.aiModel && <span>{prop.aiModel}</span>}
                            <span>{timeAgo(prop.createdAt)}</span>
                          </div>

                          {/* Proposal actions */}
                          <div className="flex items-center gap-2">
                            {(propEditable || propSubmittable) && prop.status !== 'submitted' && (
                              <button
                                onClick={() => handleSubmit(prop.id, !!propEditable)}
                                disabled={!!isLoading}
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-colors disabled:opacity-50"
                              >
                                {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />} Submit to Upwork
                              </button>
                            )}
                            {prop.status !== 'submitting' && prop.status !== 'submitted' && (
                              <RegenButton onGenerate={(comment) => generateProposal(job.id, comment)} />
                            )}
                            {prop.pdfUrl && (
                              <a href={prop.pdfUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[11px] text-zinc-400 hover:text-emerald-400 transition-colors">
                                <FileText className="w-3 h-3" /> PDF
                              </a>
                            )}
                            {propEditable && (
                              <button
                                onClick={() => handleReject(prop.id)}
                                disabled={!!isLoading}
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium text-red-400/70 hover:bg-red-500/10 hover:text-red-400 transition-colors disabled:opacity-50"
                              >
                                {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />} Reject
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Job actions */}
                      <div className="flex items-center gap-2 pt-1">
                        <a
                          href={job.upworkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-zinc-800 text-zinc-300 border border-zinc-700/50 hover:bg-zinc-700 transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" /> View on Upwork
                        </a>
                        {isGenerating ? (
                          <span className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-purple-400 animate-pulse">
                            <Loader2 className="w-3 h-3 animate-spin" /> Generating...
                            <button
                              onClick={(e) => { e.stopPropagation(); cancelGeneration(job.id); }}
                              className="ml-1 text-zinc-500 hover:text-red-400 transition-colors"
                              title="Cancel"
                            >
                              <XCircle className="w-3 h-3" />
                            </button>
                          </span>
                        ) : !prop && (job.status === 'assessed' || job.status === 'new') && job.icpScore != null ? (
                          <button
                            onClick={() => generateProposal(job.id)}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                          >
                            <FileText className="w-3 h-3" /> Generate Proposal
                          </button>
                        ) : !prop && job.status !== 'skipped' && job.status !== 'won' ? (
                          <RegenButton onGenerate={(comment) => generateProposal(job.id, comment)} />
                        ) : null}
                        {job.status !== 'skipped' && job.status !== 'submitted' && job.status !== 'won' && (
                          <button
                            onClick={() => skipJob(job.id)}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700/50 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-colors"
                          >
                            <XCircle className="w-3 h-3" /> Skip
                          </button>
                        )}
                      </div>

                      {job.skipReason && <p className="text-[11px] text-zinc-500 italic">Skip reason: {job.skipReason}</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      </>
      )}
    </div>
  );
};

/* ── Client History Badge ──────────────────────────────── */

function ClientBadge({ history }: { history: Record<string, any> | null }) {
  if (!history || Object.keys(history).length === 0) return null;
  const spent = history.total_spent;
  const hires = history.total_hires;
  const rating = history.rating;
  const verified = history.payment_verified;
  if (spent == null && hires == null) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] text-zinc-500">
      {verified && <span className="text-emerald-500" title="Payment verified">$</span>}
      {spent != null && spent > 0 && <span title="Total spent">{formatClientSpend(spent)}</span>}
      {hires != null && <span title={`${hires} hires`}><Users className="w-2.5 h-2.5 inline" /> {hires}</span>}
      {rating != null && rating > 0 && <span title={`${rating}/5 rating`}><Star className="w-2.5 h-2.5 inline" /> {rating.toFixed(1)}</span>}
    </span>
  );
}

export default UpworkPanel;

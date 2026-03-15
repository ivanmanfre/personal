import React, { useState } from 'react';
import { Briefcase, ExternalLink, ChevronDown, ChevronRight, XCircle, CheckCircle2, FileText, Zap, Trophy, Mail, Send, Edit3, Save, RefreshCw } from 'lucide-react';
import { useUpworkPipeline } from '../../hooks/useUpworkPipeline';
import { useAutoRefresh, pauseRefresh, resumeRefresh } from '../../hooks/useAutoRefresh';
import StatCard from './shared/StatCard';
import LoadingSkeleton from './shared/LoadingSkeleton';
import RefreshIndicator from './shared/RefreshIndicator';
import EmptyState from './shared/EmptyState';
import { timeAgo } from './shared/utils';
import type { UpworkJob, UpworkProposal } from '../../types/dashboard';

function formatBudget(job: UpworkJob): string {
  if (!job.budgetMin && !job.budgetMax) return '--';
  if (job.budgetType === 'hourly') {
    return `$${job.budgetMin || 0}-$${job.budgetMax || 0}/hr`;
  }
  if (job.budgetMax) return `$${job.budgetMax.toLocaleString()}`;
  if (job.budgetMin) return `$${job.budgetMin.toLocaleString()}+`;
  return '--';
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

const UpworkPanel: React.FC = () => {
  const { jobs, proposals, stats, loading, refresh, skipJob, generateProposal, approveProposal, rejectProposal, editProposal, submitProposal } = useUpworkPipeline();
  const { lastRefreshed } = useAutoRefresh(refresh, { realtimeTables: ['upwork_jobs', 'upwork_proposals'] });
  const [activeTab, setActiveTab] = useState<'pipeline' | 'proposals'>('pipeline');
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [expandedProposal, setExpandedProposal] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  if (loading) return <LoadingSkeleton cards={5} rows={6} />;

  if (jobs.length === 0 && proposals.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Upwork Pipeline</h1>
          <RefreshIndicator lastRefreshed={lastRefreshed} onRefresh={refresh} />
        </div>
        <EmptyState title="No Upwork jobs yet" description="The Upwork scraping workflow will populate this panel as new jobs are discovered and assessed." icon={<Briefcase className="w-10 h-10" />} />
      </div>
    );
  }

  const filteredJobs = statusFilter === 'all' ? jobs.filter((j) => j.status !== 'skipped') : statusFilter === 'invites' ? jobs.filter((j) => j.source === 'invite') : jobs.filter((j) => j.status === statusFilter);
  const jobMap = new Map(jobs.map((j) => [j.id, j]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Upwork Pipeline</h1>
        <RefreshIndicator lastRefreshed={lastRefreshed} onRefresh={refresh} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <StatCard label="New Jobs" value={stats.new} icon={<Briefcase className="w-5 h-5" />} color="text-blue-400" />
        <StatCard label="Invites" value={stats.invites} icon={<Mail className="w-5 h-5" />} color="text-purple-400" />
        <StatCard label="Assessed" value={stats.assessed} icon={<Zap className="w-5 h-5" />} color="text-blue-400" />
        <StatCard label="Drafted" value={stats.drafted} icon={<FileText className="w-5 h-5" />} color="text-purple-400" />
        <StatCard label="Pending" value={stats.pendingApproval} icon={<CheckCircle2 className="w-5 h-5" />} color="text-amber-400" />
        <StatCard label="Submitted" value={stats.submitted} icon={<Trophy className="w-5 h-5" />} color="text-green-400" subValue={stats.submissionsToday > 0 ? `${stats.submissionsToday} today` : undefined} />
      </div>

      {/* Tab Switcher */}
      <div className="flex border-b border-zinc-800/60">
        <button
          onClick={() => setActiveTab('pipeline')}
          className={`px-4 py-2.5 text-sm font-medium transition-colors ${activeTab === 'pipeline' ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          Pipeline ({jobs.length})
        </button>
        <button
          onClick={() => setActiveTab('proposals')}
          className={`px-4 py-2.5 text-sm font-medium transition-colors ${activeTab === 'proposals' ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          Proposals ({proposals.length})
        </button>
      </div>

      {activeTab === 'pipeline' ? (
        <PipelineTab
          jobs={filteredJobs}
          statusFilter={statusFilter}
          onStatusFilter={setStatusFilter}
          expandedJob={expandedJob}
          onToggleJob={(id) => setExpandedJob(expandedJob === id ? null : id)}
          onSkip={skipJob}
          onGenerateProposal={generateProposal}
          stats={stats}
        />
      ) : (
        <ProposalsTab
          proposals={proposals}
          jobMap={jobMap}
          expandedProposal={expandedProposal}
          onToggleProposal={(id) => setExpandedProposal(expandedProposal === id ? null : id)}
          onApprove={approveProposal}
          onReject={rejectProposal}
          onEdit={editProposal}
          onSubmit={submitProposal}
          onGenerateProposal={generateProposal}
        />
      )}
    </div>
  );
};

/* ── Pipeline Tab ────────────────────────────────────────── */

interface PipelineTabProps {
  jobs: UpworkJob[];
  statusFilter: string;
  onStatusFilter: (s: string) => void;
  expandedJob: string | null;
  onToggleJob: (id: string) => void;
  onSkip: (id: string, reason?: string) => void;
  onGenerateProposal: (id: string) => void;
  stats: { totalJobs: number; new: number; assessed: number; drafted: number; submitted: number; won: number; skipped: number; invites: number };
}

const PipelineTab: React.FC<PipelineTabProps> = ({ jobs, statusFilter, onStatusFilter, expandedJob, onToggleJob, onSkip, onGenerateProposal, stats }) => {
  const filters = [
    { key: 'all', label: 'All', count: stats.totalJobs },
    { key: 'invites', label: 'Invites', count: stats.invites },
    { key: 'new', label: 'New', count: stats.new },
    { key: 'assessed', label: 'Assessed', count: stats.assessed },
    { key: 'drafted', label: 'Drafted', count: stats.drafted },
    { key: 'submitted', label: 'Submitted', count: stats.submitted },
    { key: 'won', label: 'Won', count: stats.won },
    { key: 'skipped', label: 'Skipped', count: stats.skipped },
  ];

  return (
    <div className="space-y-4">
      {/* Status filter pills */}
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => onStatusFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFilter === f.key ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {/* Jobs list */}
      <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl overflow-hidden">
        {jobs.length === 0 ? (
          <p className="px-4 py-8 text-zinc-500 text-center text-sm">No jobs match this filter</p>
        ) : (
          <div className="divide-y divide-zinc-800/50">
            {jobs.map((job) => {
              const isExpanded = expandedJob === job.id;
              const isSkipped = job.status === 'skipped';
              const isInvite = job.source === 'invite';
              return (
                <div key={job.id}>
                  <button
                    onClick={() => onToggleJob(job.id)}
                    className={`w-full px-4 py-3 flex items-start gap-3 hover:bg-zinc-800/20 transition-colors text-left ${isSkipped ? 'opacity-60' : ''}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isInvite && (
                          <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30">
                            Invite
                          </span>
                        )}
                        <p className={`text-sm font-medium text-zinc-200 truncate ${isSkipped ? 'line-through' : ''}`} title={job.title}>
                          {job.title}
                        </p>
                        <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium border ${statusColors[job.status] || statusColors.new}`}>
                          {job.status.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        <span className="text-xs text-zinc-400">{formatBudget(job)}</span>
                        {job.icpScore != null && (
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded border ${icpBg(job.icpScore)} ${icpColor(job.icpScore)}`}>
                            ICP {job.icpScore}
                          </span>
                        )}
                        {job.skills.slice(0, 3).map((skill) => (
                          <span key={skill} className="text-[10px] text-zinc-500 bg-zinc-800/60 px-1.5 py-0.5 rounded">{skill}</span>
                        ))}
                        {job.skills.length > 3 && (
                          <span className="text-[10px] text-zinc-600">+{job.skills.length - 3}</span>
                        )}
                        <span className="text-[10px] text-zinc-600">{timeAgo(job.postedAt)}</span>
                      </div>
                    </div>
                    <div className="shrink-0 mt-1">
                      {isExpanded ? <ChevronDown className="w-4 h-4 text-zinc-600" /> : <ChevronRight className="w-4 h-4 text-zinc-600" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3">
                      {job.description && (
                        <div className="p-3 bg-zinc-800/40 border border-zinc-700/40 rounded-lg text-xs text-zinc-300 leading-relaxed max-h-40 overflow-y-auto whitespace-pre-wrap">
                          {job.description}
                        </div>
                      )}

                      {job.icpReasoning && (
                        <div className="p-3 bg-blue-950/20 border border-blue-500/15 rounded-lg text-xs text-blue-300/90 leading-relaxed">
                          <span className="text-blue-400/70 font-medium">AI Reasoning: </span>
                          {job.icpReasoning}
                        </div>
                      )}

                      {job.screeningQuestions && job.screeningQuestions.length > 0 && (
                        <div className="p-3 bg-amber-950/20 border border-amber-500/15 rounded-lg">
                          <span className="text-amber-400/70 font-medium text-xs block mb-1.5">Screening Questions:</span>
                          {job.screeningQuestions.map((q, i) => (
                            <p key={i} className="text-xs text-amber-300/80 ml-2 mb-1">{i + 1}. {q.question}</p>
                          ))}
                        </div>
                      )}

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

                      {job.skills.length > 3 && (
                        <div className="flex flex-wrap gap-1.5">
                          {job.skills.map((skill) => (
                            <span key={skill} className="text-[10px] text-zinc-400 bg-zinc-800/60 px-1.5 py-0.5 rounded">{skill}</span>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-1">
                        <a
                          href={job.upworkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-zinc-800 text-zinc-300 border border-zinc-700/50 hover:bg-zinc-700 transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" /> View on Upwork
                        </a>
                        {job.status === 'drafted' ? (
                          <span className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-purple-400 animate-pulse">
                            <Zap className="w-3 h-3" /> Generating...
                          </span>
                        ) : (job.status === 'assessed' || job.status === 'new') && job.icpScore != null ? (
                          <button
                            onClick={() => onGenerateProposal(job.id)}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                          >
                            <FileText className="w-3 h-3" /> Generate Proposal
                          </button>
                        ) : job.status !== 'skipped' && job.status !== 'won' ? (
                          <button
                            onClick={() => onGenerateProposal(job.id)}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 transition-colors"
                          >
                            <RefreshCw className="w-3 h-3" /> Regenerate
                          </button>
                        ) : null}
                        {job.status !== 'skipped' && job.status !== 'submitted' && job.status !== 'won' && (
                          <button
                            onClick={() => onSkip(job.id)}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700/50 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-colors"
                          >
                            <XCircle className="w-3 h-3" /> Skip
                          </button>
                        )}
                      </div>

                      {job.skipReason && (
                        <p className="text-[11px] text-zinc-500 italic">Skip reason: {job.skipReason}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

/* ── Proposals Tab ───────────────────────────────────────── */

interface ProposalsTabProps {
  proposals: UpworkProposal[];
  jobMap: Map<string, UpworkJob>;
  expandedProposal: string | null;
  onToggleProposal: (id: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onEdit: (id: string, field: 'proposal_text' | 'cover_letter', value: string) => void;
  onSubmit: (id: string) => void;
  onGenerateProposal: (jobId: string) => void;
}

const ProposalsTab: React.FC<ProposalsTabProps> = ({ proposals, jobMap, expandedProposal, onToggleProposal, onApprove, onReject, onEdit, onSubmit, onGenerateProposal }) => {
  const [editingField, setEditingField] = useState<{ id: string; field: 'proposal_text' | 'cover_letter' } | null>(null);
  const [editValue, setEditValue] = useState('');

  if (proposals.length === 0) {
    return (
      <EmptyState title="No proposals yet" description="Proposals will appear here as the AI drafts them for assessed jobs." icon={<FileText className="w-10 h-10" />} />
    );
  }

  const startEdit = (id: string, field: 'proposal_text' | 'cover_letter', currentValue: string) => {
    setEditingField({ id, field });
    setEditValue(currentValue);
    pauseRefresh();
  };

  const saveEdit = () => {
    if (editingField) {
      onEdit(editingField.id, editingField.field, editValue);
      setEditingField(null);
    }
    resumeRefresh();
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue('');
    resumeRefresh();
  };

  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const visibleProposals = proposals.filter((p) => {
    const job = jobMap.get(p.jobId);
    if (job?.source === 'invite') return true;
    if (p.status === 'pending_approval' || p.status === 'draft') return true;
    return p.createdAt >= sixHoursAgo;
  });

  if (visibleProposals.length === 0) {
    return (
      <EmptyState title="No recent proposals" description="Proposals older than 6 hours are hidden. Invite proposals always stay visible." icon={<FileText className="w-10 h-10" />} />
    );
  }

  return (
    <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl overflow-hidden divide-y divide-zinc-800/50">
      {visibleProposals.map((prop) => {
        const job = jobMap.get(prop.jobId);
        const isExpanded = expandedProposal === prop.id;
        const isEditable = prop.status === 'draft' || prop.status === 'pending_approval';
        const isSubmittable = prop.status === 'pending_approval' || prop.status === 'approved';
        const isEditingThis = editingField?.id === prop.id;

        return (
          <div key={prop.id}>
            <button
              onClick={() => onToggleProposal(prop.id)}
              className="w-full px-4 py-3 flex items-start gap-3 hover:bg-zinc-800/20 transition-colors text-left"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {job?.source === 'invite' && (
                    <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30">
                      Invite
                    </span>
                  )}
                  <p className="text-sm font-medium text-zinc-200 truncate" title={job?.title || prop.jobId}>{job?.title || prop.jobId}</p>
                  <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium border ${statusColors[prop.status] || statusColors.new}`}>
                    {prop.status === 'pending_approval' ? 'pending' : prop.status}
                  </span>
                  <span className="text-[10px] text-zinc-600">v{prop.version}</span>
                </div>
                <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{prop.proposalText.slice(0, 200)}{prop.proposalText.length > 200 ? '...' : ''}</p>
                <div className="flex items-center gap-3 mt-1.5 text-[10px] text-zinc-500">
                  {prop.rateAmount != null && (
                    <span>${prop.rateAmount}{prop.rateType === 'hourly' ? '/hr' : ' fixed'}</span>
                  )}
                  {prop.estimatedHours != null && <span>{prop.estimatedHours}h est.</span>}
                  <span>{prop.aiModel}</span>
                  <span>{timeAgo(prop.createdAt)}</span>
                </div>
              </div>
              <div className="shrink-0 mt-1">
                {isExpanded ? <ChevronDown className="w-4 h-4 text-zinc-600" /> : <ChevronRight className="w-4 h-4 text-zinc-600" />}
              </div>
            </button>

            {isExpanded && (
              <div className="px-4 pb-4 space-y-3">
                {/* Proposal text - editable */}
                <div className="relative">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Cover Letter</span>
                    {isEditable && !isEditingThis && (
                      <button
                        onClick={() => startEdit(prop.id, 'proposal_text', prop.proposalText)}
                        className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-emerald-400 transition-colors"
                      >
                        <Edit3 className="w-3 h-3" /> Edit
                      </button>
                    )}
                  </div>
                  {isEditingThis && editingField.field === 'proposal_text' ? (
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
                        <button onClick={cancelEdit} className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-zinc-400 hover:text-white transition-colors">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-zinc-800/40 border border-zinc-700/40 rounded-lg text-xs text-zinc-300 leading-relaxed max-h-64 overflow-y-auto whitespace-pre-wrap">
                      {prop.proposalText}
                    </div>
                  )}
                </div>


                {/* Screening Q&A */}
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

                {/* Portfolio refs */}
                {prop.portfolioRefs.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {prop.portfolioRefs.map((ref) => (
                      <span key={ref} className="text-[10px] text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full">{ref}</span>
                    ))}
                  </div>
                )}

                {/* PDF link */}
                {prop.pdfUrl && (
                  <a
                    href={prop.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[11px] text-zinc-400 hover:text-emerald-400 transition-colors"
                  >
                    <FileText className="w-3 h-3" /> View PDF
                  </a>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1">
                  {isEditable && (
                    <>
                      <button
                        onClick={() => onApprove(prop.id)}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                      >
                        <CheckCircle2 className="w-3 h-3" /> Approve
                      </button>
                      <button
                        onClick={async () => { await onApprove(prop.id); onSubmit(prop.id); }}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-colors"
                      >
                        <Send className="w-3 h-3" /> Approve & Submit
                      </button>
                      <button
                        onClick={() => onReject(prop.id)}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors"
                      >
                        <XCircle className="w-3 h-3" /> Reject
                      </button>
                    </>
                  )}
                  {isSubmittable && prop.status !== 'pending_approval' && (
                    <button
                      onClick={() => onSubmit(prop.id)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-colors"
                    >
                      <Send className="w-3 h-3" /> Submit
                    </button>
                  )}
                  {prop.status !== 'submitting' && prop.status !== 'submitted' && (
                    <button
                      onClick={() => onGenerateProposal(prop.jobId)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 transition-colors"
                    >
                      <RefreshCw className="w-3 h-3" /> Regenerate
                    </button>
                  )}
                  {prop.status === 'submitting' && (
                    <span className="text-[11px] text-yellow-400 animate-pulse">Submitting...</span>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default UpworkPanel;

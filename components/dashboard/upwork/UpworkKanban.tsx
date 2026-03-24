import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { ExternalLink, XCircle, FileText, Loader2, ChevronDown, ChevronUp, DollarSign, Users, Star, MessageSquare, Send, RefreshCw, Mail, Edit3, Save, X, Trash2, CheckCircle, AlertTriangle, Eye } from 'lucide-react';
import { timeAgo } from '../shared/utils';
import type { UpworkJob, UpworkProposal } from '../../../types/dashboard';

interface Column {
  id: string;
  label: string;
  color: string;
  dotColor: string;
}

const columns: Column[] = [
  { id: 'invites', label: 'Invites', color: 'border-purple-500/30 bg-purple-500/5', dotColor: 'bg-purple-400' },
  { id: 'assessed', label: 'Assessed', color: 'border-blue-500/30 bg-blue-500/5', dotColor: 'bg-blue-400' },
  { id: 'review', label: 'Review', color: 'border-amber-500/30 bg-amber-500/5', dotColor: 'bg-amber-400' },
  { id: 'submitted', label: 'Submitted', color: 'border-green-500/30 bg-green-500/5', dotColor: 'bg-green-400' },
];

const SIX_HOURS = 6 * 60 * 60 * 1000;

function jobAge(job: UpworkJob): number {
  const ts = job.postedAt || job.createdAt;
  return Date.now() - new Date(ts).getTime();
}

/** Returns true if the job is too stale for the kanban */
function isStale(job: UpworkJob, proposal: UpworkProposal | undefined): boolean {
  // Jobs with proposals in progress or submitted are never stale
  if (proposal) return false;
  return jobAge(job) > SIX_HOURS;
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
  if (proposal && !['submitted', 'approved', 'pending_approval', 'draft'].includes(proposal.status)) return 'review';
  if (job.status === 'drafted') return 'review';
  if (job.status === 'assessed' || (job.status === 'new' && job.icpScore != null)) return 'assessed';
  return 'assessed';
}

/* ─── Modal overlay for job details ─── */
function DetailModal({
  job, proposal: prop, generatingJobs, actionLoading, editingId, editValue,
  onClose, onSkip, onGenerate, onCancelGeneration, onSubmit, onEdit,
  onStartEdit, onCancelEdit, onEditChange,
}: {
  job: UpworkJob; proposal?: UpworkProposal;
  generatingJobs: Set<string>; actionLoading: string | null;
  editingId: string | null; editValue: string;
  onClose: () => void;
  onSkip: (id: string) => void; onGenerate: (id: string) => void; onCancelGeneration: (id: string) => void;
  onSubmit: (id: string) => void; onEdit: (id: string, field: 'cover_letter' | 'proposal_text', value: string) => void;
  onStartEdit: (id: string, text: string) => void; onCancelEdit: () => void; onEditChange: (v: string) => void;
}) {
  const isGenerating = generatingJobs.has(job.id);
  const isLoading = prop && actionLoading === prop.id;
  const budget = formatBudget(job);
  const [qaExpanded, setQaExpanded] = useState(false);
  const [qaShowOriginal, setQaShowOriginal] = useState(false);
  const diagramHeight = useMemo(() => {
    const html = prop?.diagramData?.html || '';
    const m = html.match(/height:(\d+)px;overflow/);
    return m ? parseInt(m[1], 10) + 16 : 700;
  }, [prop?.diagramData?.html]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 w-[95vw] max-w-5xl max-h-[90vh] mt-[5vh] rounded-2xl border border-zinc-700/50 bg-zinc-900 shadow-2xl shadow-black/40 flex flex-col overflow-hidden"
      >
        {/* Sticky header */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-zinc-800/60 bg-zinc-900/95 backdrop-blur shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {job.source === 'invite' && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center gap-0.5 shrink-0">
                <Mail className="w-3 h-3" /> Invite
              </span>
            )}
            {job.icpScore != null && (
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border shrink-0 ${icpColor(job.icpScore)}`}>
                ICP {job.icpScore}
              </span>
            )}
            {budget && <span className="text-[11px] text-zinc-400 font-medium shrink-0">{budget}</span>}
            <h3 className="text-sm font-semibold text-zinc-100 truncate">{job.title}</h3>
            <span className="text-[10px] text-zinc-600 shrink-0">{timeAgo(job.postedAt)}</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors shrink-0">
            <X className="w-4 h-4 text-zinc-400 hover:text-zinc-200" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto dashboard-scroll p-5 space-y-5">
          {/* Two-column: job info + proposal */}
          <div className={`grid gap-5 ${prop ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
            {/* Left: Job details */}
            <div className="space-y-3">
              {job.description && (
                <p className="text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap">{job.description}</p>
              )}

              {job.icpReasoning && (
                <div className="p-2.5 bg-blue-950/20 border border-blue-500/15 rounded-lg text-xs text-blue-300/80 leading-relaxed">
                  <span className="text-blue-400/60 font-medium">AI: </span>{job.icpReasoning}
                </div>
              )}

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

              {job.skills.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {job.skills.map((s) => (
                    <span key={s} className="text-[10px] text-zinc-500 bg-zinc-800/60 px-1.5 py-0.5 rounded">{s}</span>
                  ))}
                </div>
              )}

              {job.screeningQuestions && job.screeningQuestions.length > 0 && (
                <div className="p-2.5 bg-amber-950/20 border border-amber-500/15 rounded-lg">
                  <span className="text-amber-400/70 font-medium text-[11px] block mb-1">Screening:</span>
                  {job.screeningQuestions.map((q, i) => (
                    <p key={i} className="text-[11px] text-amber-300/80 ml-1.5 mb-0.5">{i + 1}. {q.question}</p>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Proposal */}
            {prop && (
              <div className="space-y-3">
                <div className="p-3 bg-emerald-950/10 border border-emerald-500/15 rounded-lg space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-emerald-400/70 font-medium uppercase tracking-wider">Proposal</span>
                      <span className="text-[10px] text-zinc-600">v{prop.version}</span>
                      <span className="text-[10px] text-zinc-500 px-1.5 py-0.5 bg-zinc-800/60 rounded">{prop.status}</span>
                      {prop.submissionMethod === 'local' && <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 border border-green-500/30">Local</span>}
                      {prop.submissionMethod === 'cloud' && <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30">Cloud</span>}
                      {prop.qaResult && (
                        <span className={`flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded ${
                          prop.qaResult.status === 'pass'
                            ? 'text-emerald-400 bg-emerald-500/10'
                            : prop.qaResult.status === 'rewrite'
                            ? 'text-amber-400 bg-amber-500/10'
                            : 'text-zinc-500 bg-zinc-800/40'
                        }`}>
                          {prop.qaResult.status === 'pass' ? <CheckCircle className="w-2.5 h-2.5" /> : <AlertTriangle className="w-2.5 h-2.5" />}
                          QA {prop.qaResult.status}
                        </span>
                      )}
                    </div>
                    {(prop.status === 'pending_approval' || prop.status === 'draft') && editingId !== prop.id && (
                      <button
                        onClick={() => onStartEdit(prop.id, prop.coverLetter || prop.proposalText)}
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
                        onChange={(e) => onEditChange(e.target.value)}
                        className="w-full p-2.5 bg-zinc-800/60 border border-emerald-500/30 rounded-lg text-xs text-zinc-200 leading-relaxed min-h-[200px] focus:outline-none focus:border-emerald-500/50 resize-y"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => { onEdit(prop.id, 'cover_letter', editValue); onCancelEdit(); }}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                        >
                          <Save className="w-3 h-3" /> Save
                        </button>
                        <button
                          onClick={onCancelEdit}
                          className="px-2 py-1 rounded-lg text-[11px] font-medium text-zinc-400 hover:text-white transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">
                      {prop.coverLetter || prop.proposalText}
                    </p>
                  )}
                  <div className="flex items-center gap-2.5 text-[10px] text-zinc-500">
                    {prop.rateAmount != null && <span>${prop.rateAmount}{prop.rateType === 'hourly' ? '/hr' : ' fixed'}</span>}
                    {prop.estimatedHours != null && <span>{prop.estimatedHours}h est.</span>}
                  </div>
                  {prop.screeningAnswers && prop.screeningAnswers.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-emerald-500/10">
                      <span className="text-[10px] text-amber-400/60 font-medium">Screening Answers:</span>
                      {prop.screeningAnswers.map((qa, i) => (
                        <div key={i}>
                          <p className="text-[10px] text-amber-400/50 font-medium">Q{i + 1}: {qa.question}</p>
                          <p className="text-xs text-zinc-300/80 mt-0.5">{qa.answer}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {prop.qaResult && (
                    <div className="pt-2 border-t border-emerald-500/10">
                      <button
                        onClick={() => setQaExpanded(!qaExpanded)}
                        className="flex items-center gap-1 text-[10px] font-medium text-zinc-400 hover:text-zinc-200 transition-colors w-full"
                      >
                        {qaExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        QA Checks ({prop.qaResult.checks.filter(c => c.result === 'pass').length}/{prop.qaResult.checks.length} passed)
                      </button>
                      {qaExpanded && (
                        <div className="mt-2 space-y-1">
                          {prop.qaResult.checks.map((check, i) => (
                            <div key={i} className="flex items-start gap-1.5 text-[10px]">
                              {check.result === 'pass' ? (
                                <CheckCircle className="w-3 h-3 text-emerald-500/60 mt-0.5 shrink-0" />
                              ) : check.result === 'fail' ? (
                                <XCircle className="w-3 h-3 text-red-400/70 mt-0.5 shrink-0" />
                              ) : (
                                <AlertTriangle className="w-3 h-3 text-amber-400/60 mt-0.5 shrink-0" />
                              )}
                              <span className="text-zinc-400">{check.name}</span>
                              {check.detail && <span className="text-zinc-600 truncate">{check.detail}</span>}
                            </div>
                          ))}
                          {prop.qaResult.status === 'rewrite' && prop.qaResult.original_cover_letter && (
                            <div className="mt-2 pt-2 border-t border-zinc-800/60">
                              <button
                                onClick={() => setQaShowOriginal(!qaShowOriginal)}
                                className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
                              >
                                <Eye className="w-3 h-3" />
                                {qaShowOriginal ? 'Hide' : 'Show'} original (pre-QA)
                              </button>
                              {qaShowOriginal && (
                                <p className="mt-1.5 text-[11px] text-zinc-500 leading-relaxed whitespace-pre-wrap bg-zinc-900/50 p-2 rounded border border-zinc-800/50">
                                  {prop.qaResult.original_cover_letter}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Diagram — full width, auto-height */}
          {prop?.diagramData?.html && (
            <div className="rounded-xl border border-purple-500/20 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-1.5 bg-purple-950/20 border-b border-purple-500/15">
                <span className="text-[10px] text-purple-400/70 font-medium uppercase tracking-wider">Workflow Diagram</span>
              </div>
              <iframe
                srcDoc={prop.diagramData.html}
                sandbox="allow-scripts allow-same-origin"
                className="w-full border-0 bg-[#111116]"
                style={{ height: diagramHeight }}
              />
            </div>
          )}
        </div>

        {/* Sticky actions bar */}
        <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-t border-zinc-800/60 bg-zinc-900/95 backdrop-blur shrink-0">
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
              onClick={() => onSubmit(prop.id)}
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
      </motion.div>
    </div>
  );
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
      // Only show jobs scored 6+ (unless they already have a proposal in progress)
      if (!prop && (job.icpScore == null || job.icpScore < 6)) continue;
      const col = getColumn(job, prop);
      if (col && groups[col]) groups[col].push({ job, proposal: prop });
    }
    return groups;
  }, [jobs, proposalMap]);

  const handleSubmit = async (propId: string) => {
    setActionLoading(propId);
    try { await onSubmit(propId); } finally { setActionLoading(null); }
  };

  // Find the expanded job + proposal for the detail panel
  const expandedData = useMemo(() => {
    if (!expandedCard) return null;
    for (const col of columns) {
      const item = (grouped[col.id] || []).find(({ job }) => job.id === expandedCard);
      if (item) return item;
    }
    return null;
  }, [expandedCard, grouped]);

  return (
    <>
      <LayoutGroup>
        <div className="flex gap-3 min-h-[500px] overflow-x-auto pb-2 dashboard-scroll">
          {columns.map((col) => {
            const items = grouped[col.id] || [];
            return (
              <div
                key={col.id}
                className={`rounded-xl border ${col.color} p-2.5 flex flex-col flex-1 min-w-[200px]`}
              >
                {/* Column header */}
                <div className="flex items-center justify-between px-1 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${col.dotColor}`} />
                    <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">{col.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {items.length > 0 && (
                      <button
                        onClick={() => items.forEach(({ job }) => onSkip(job.id))}
                        className="text-zinc-600 hover:text-red-400 transition-colors p-0.5 rounded hover:bg-red-500/10"
                        title={`Clear all ${items.length} items`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                    <span className="text-[11px] text-zinc-500 bg-zinc-800/60 px-2 py-0.5 rounded-md font-medium">{items.length}</span>
                  </div>
                </div>

                {/* Compact cards */}
                <div className="flex-1 space-y-1.5 overflow-y-auto max-h-[600px] dashboard-scroll">
                  <AnimatePresence mode="popLayout">
                    {items.map(({ job, proposal: prop }) => {
                      const isExpanded = expandedCard === job.id;
                      const isGenerating = generatingJobs.has(job.id);
                      const isInvite = job.source === 'invite';
                      const budget = formatBudget(job);

                      return (
                        <motion.div
                          key={job.id}
                          layout
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                          className={`rounded-lg overflow-hidden cursor-pointer transition-colors ${isExpanded ? 'bg-zinc-800/90 border-2 border-blue-500/50 ring-1 ring-blue-500/20' : 'bg-zinc-900/80 border border-zinc-700/30 hover:border-zinc-600/50'}`}
                          onClick={() => setExpandedCard(isExpanded ? null : job.id)}
                        >
                          <div className="p-2.5">
                            <p className="text-[12px] font-medium text-zinc-200 line-clamp-2 leading-snug">{job.title}</p>
                            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                              {isInvite && (
                                <span className="px-1 py-0.5 rounded text-[9px] font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center gap-0.5">
                                  <Mail className="w-2.5 h-2.5" /> Invite
                                </span>
                              )}
                              {job.icpScore != null && (
                                <span className={`px-1 py-0.5 rounded text-[9px] font-bold border ${icpColor(job.icpScore)}`}>
                                  {job.icpScore}
                                </span>
                              )}
                              {budget && <span className="text-[9px] text-zinc-500">{budget}</span>}
                              {isGenerating && <Loader2 className="w-3 h-3 text-purple-400 animate-spin" />}
                              {prop && <span className="text-[9px] text-emerald-500/70">{prop.status}</span>}
                              {prop?.submissionMethod === 'local' && <span className="text-[9px] px-1 py-0.5 rounded bg-green-500/15 text-green-400 border border-green-500/30">Local</span>}
                              {prop?.submissionMethod === 'cloud' && <span className="text-[9px] px-1 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30">Cloud</span>}
                              <span className="text-[9px] text-zinc-600 ml-auto">{timeAgo(job.postedAt)}</span>
                            </div>
                          </div>
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

      {/* Modal overlay — portaled to body */}
      {expandedData && createPortal(
        <AnimatePresence>
          <DetailModal
            job={expandedData.job}
            proposal={expandedData.proposal}
            generatingJobs={generatingJobs}
            actionLoading={actionLoading}
            editingId={editingId}
            editValue={editValue}
            onClose={() => setExpandedCard(null)}
            onSkip={onSkip}
            onGenerate={onGenerate}
            onCancelGeneration={onCancelGeneration}
            onSubmit={handleSubmit}
            onEdit={onEdit}
            onStartEdit={(id, text) => { setEditingId(id); setEditValue(text); }}
            onCancelEdit={() => { setEditingId(null); setEditValue(''); }}
            onEditChange={setEditValue}
          />
        </AnimatePresence>,
        document.body
      )}
    </>
  );
};

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { dashboardAction } from '../lib/dashboardActions';
import type { UpworkJob, UpworkProposal, UpworkPipelineStats } from '../types/dashboard';

// Tracks optimistic status overrides so auto-refresh doesn't stomp them
interface OptimisticLock {
  status: string;
  expiry: number; // timestamp when the lock expires
}

const LOCK_TTL = 2 * 60 * 1000; // 2 minutes

function mapJob(r: any): UpworkJob {
  return {
    id: r.id,
    upworkUrl: r.upwork_url,
    title: r.title,
    description: r.description,
    budgetType: r.budget_type,
    budgetMin: r.budget_min,
    budgetMax: r.budget_max,
    skills: r.skills || [],
    clientHistory: r.client_history,
    postedAt: r.posted_at,
    scrapedAt: r.scraped_at,
    icpScore: r.icp_score,
    icpReasoning: r.icp_reasoning,
    fitTags: r.fit_tags || [],
    matchedProjects: r.matched_projects || [],
    status: r.status,
    skipReason: r.skip_reason,
    source: r.source,
    screeningQuestions: r.screening_questions,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapProposal(r: any): UpworkProposal {
  return {
    id: r.id,
    jobId: r.job_id,
    proposalText: r.proposal_text,
    coverLetter: r.cover_letter,
    rateAmount: r.rate_amount,
    rateType: r.rate_type,
    estimatedHours: r.estimated_hours,
    portfolioRefs: r.portfolio_refs || [],
    aiModel: r.ai_model,
    pdfUrl: r.pdf_url,
    version: r.version,
    status: r.status,
    submittedAt: r.submitted_at,
    screeningAnswers: r.screening_answers,
    diagramData: r.diagram_data || null,
    createdAt: r.created_at,
  };
}

function mapStats(r: any): UpworkPipelineStats {
  return {
    totalJobs: r.total_jobs || 0,
    new: r.new || 0,
    assessed: r.assessed || 0,
    drafted: r.drafted || 0,
    pendingApproval: r.pending_approval || 0,
    submitted: r.submitted || 0,
    won: r.won || 0,
    skipped: r.skipped || 0,
    submissionsToday: r.submissions_today || 0,
    invites: r.invites || 0,
  };
}

const emptyStats: UpworkPipelineStats = {
  totalJobs: 0,
  new: 0,
  assessed: 0,
  drafted: 0,
  pendingApproval: 0,
  submitted: 0,
  won: 0,
  skipped: 0,
  submissionsToday: 0,
  invites: 0,
};

export function useUpworkPipeline() {
  const [jobs, setJobs] = useState<UpworkJob[]>([]);
  const [proposals, setProposals] = useState<UpworkProposal[]>([]);
  const [stats, setStats] = useState<UpworkPipelineStats>(emptyStats);
  const [loading, setLoading] = useState(true);
  const [generatingJobs, setGeneratingJobs] = useState<Set<string>>(new Set());

  // Optimistic locks — prevent auto-refresh from overwriting in-flight states
  const jobLocks = useRef<Map<string, OptimisticLock>>(new Map());
  const proposalLocks = useRef<Map<string, OptimisticLock>>(new Map());

  const lockJob = (id: string, status: string) => {
    jobLocks.current.set(id, { status, expiry: Date.now() + LOCK_TTL });
  };
  const lockProposal = (id: string, status: string) => {
    proposalLocks.current.set(id, { status, expiry: Date.now() + LOCK_TTL });
  };
  const clearJobLock = (id: string) => { jobLocks.current.delete(id); };
  const clearProposalLock = (id: string) => { proposalLocks.current.delete(id); };
  const hasLoaded = useRef(false);

  const fetch = useCallback(async () => {
    if (!hasLoaded.current) setLoading(true);
    try {
      const [jobsRes, proposalsRes, statsRes] = await Promise.all([
        supabase
          .from('upwork_jobs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(500),
        supabase
          .from('upwork_proposals')
          .select('*')
          .neq('status', 'superseded')
          .order('created_at', { ascending: false })
          .limit(100),
        supabase.rpc('upwork_pipeline_stats'),
      ]);

      const now = Date.now();
      const serverJobs = (jobsRes.data || []).map(mapJob);
      const serverProposals = (proposalsRes.data || []).map(mapProposal);

      // Apply optimistic locks: keep local status if server hasn't caught up
      setJobs(serverJobs.map((j) => {
        const lock = jobLocks.current.get(j.id);
        if (lock && now < lock.expiry) {
          // Server caught up (status changed) — release lock
          if (j.status !== 'assessed' && j.status !== 'new') {
            jobLocks.current.delete(j.id);
            return j;
          }
          return { ...j, status: lock.status };
        }
        jobLocks.current.delete(j.id);
        return j;
      }));

      setProposals(serverProposals.map((p) => {
        const lock = proposalLocks.current.get(p.id);
        if (lock && now < lock.expiry) {
          if (p.status !== lock.status && p.status !== 'pending_approval' && p.status !== 'draft') {
            proposalLocks.current.delete(p.id);
            return p;
          }
          return { ...p, status: lock.status };
        }
        proposalLocks.current.delete(p.id);
        return p;
      }));

      // Clear generating spinners for jobs that now have new proposals
      setGeneratingJobs((prev) => {
        if (prev.size === 0) return prev;
        const next = new Set(prev);
        for (const jobId of prev) {
          if (serverProposals.some((p) => p.jobId === jobId)) next.delete(jobId);
        }
        return next.size === prev.size ? prev : next;
      });

      const rawStats = statsRes.data;
      setStats(rawStats ? mapStats(Array.isArray(rawStats) ? rawStats[0] : rawStats) : emptyStats);
      hasLoaded.current = true;
    } catch (err) {
      console.error('Failed to fetch upwork data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const skipJob = async (id: string, reason?: string) => {
    const prev = jobs.find((j) => j.id === id);
    lockJob(id, 'skipped');
    setJobs((p) => p.map((j) => (j.id === id ? { ...j, status: 'skipped', skipReason: reason || null } : j)));
    try {
      await dashboardAction('upwork_jobs', id, 'status', 'skipped');
      if (reason) await dashboardAction('upwork_jobs', id, 'skip_reason', reason);
      clearJobLock(id);
    } catch {
      clearJobLock(id);
      if (prev) setJobs((p) => p.map((j) => (j.id === id ? { ...j, status: prev.status, skipReason: prev.skipReason } : j)));
    }
  };

  const approveProposal = async (id: string) => {
    const prev = proposals.find((p) => p.id === id);
    lockProposal(id, 'approved');
    setProposals((p) => p.map((x) => (x.id === id ? { ...x, status: 'approved' } : x)));
    try {
      await dashboardAction('upwork_proposals', id, 'status', 'approved');
      clearProposalLock(id);
    } catch {
      clearProposalLock(id);
      if (prev) setProposals((p) => p.map((x) => (x.id === id ? { ...x, status: prev.status } : x)));
    }
  };

  const rejectProposal = async (id: string) => {
    const prev = proposals.find((p) => p.id === id);
    lockProposal(id, 'rejected');
    setProposals((p) => p.map((x) => (x.id === id ? { ...x, status: 'rejected' } : x)));
    try {
      await dashboardAction('upwork_proposals', id, 'status', 'rejected');
      clearProposalLock(id);
    } catch {
      clearProposalLock(id);
      if (prev) setProposals((p) => p.map((x) => (x.id === id ? { ...x, status: prev.status } : x)));
    }
  };

  const editProposal = async (id: string, field: 'proposal_text' | 'cover_letter', value: string) => {
    const prev = proposals.find((p) => p.id === id);
    const optimistic = field === 'proposal_text' ? { proposalText: value } : { coverLetter: value };
    setProposals((p) => p.map((x) => (x.id === id ? { ...x, ...optimistic } : x)));
    try {
      await dashboardAction('upwork_proposals', id, field, value);
    } catch {
      if (prev) {
        const rollback = field === 'proposal_text' ? { proposalText: prev.proposalText } : { coverLetter: prev.coverLetter };
        setProposals((p) => p.map((x) => (x.id === id ? { ...x, ...rollback } : x)));
      }
    }
  };

  const submitProposal = async (id: string) => {
    lockProposal(id, 'submitting');
    setProposals((prev) => prev.map((p) => (p.id === id ? { ...p, status: 'submitting' } : p)));
    try {
      const res = await window.fetch('https://n8n.intelligents.agency/webhook/upwork-submit-proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposal_id: id }),
      });
      const raw = await res.json();
      const data = Array.isArray(raw) ? raw[0] : raw;
      if (data?.success) {
        clearProposalLock(id);
        setProposals((prev) => prev.map((p) => (p.id === id ? { ...p, status: 'submitted', submittedAt: new Date().toISOString() } : p)));
      } else {
        clearProposalLock(id);
        setProposals((prev) => prev.map((p) => (p.id === id ? { ...p, status: 'pending_approval' } : p)));
      }
    } catch {
      clearProposalLock(id);
      setProposals((prev) => prev.map((p) => (p.id === id ? { ...p, status: 'pending_approval' } : p)));
    }
  };

  const cancelGeneration = useCallback((jobId: string) => {
    setGeneratingJobs((prev) => { const next = new Set(prev); next.delete(jobId); return next; });
  }, []);

  const generateProposal = (jobId: string, comment?: string) => {
    const payload: Record<string, string> = { job_id: jobId };
    if (comment) payload.comment = comment;

    // Snapshot current latest proposal ID for this job so we can detect a new one
    const currentLatest = proposals
      .filter((p) => p.jobId === jobId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.id;

    setGeneratingJobs((prev) => new Set(prev).add(jobId));

    window.fetch('https://n8n.intelligents.agency/webhook/upwork-draft-proposal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch((err) => console.error('Proposal generation error:', err));

    // Poll every 10s until a new proposal appears for this job (up to 5 min)
    let polls = 0;
    const pollId = setInterval(async () => {
      polls++;
      const { data } = await supabase
        .from('upwork_proposals')
        .select('id')
        .eq('job_id', jobId)
        .neq('status', 'superseded')
        .order('created_at', { ascending: false })
        .limit(1);
      const latestId = data?.[0]?.id;
      if ((latestId && latestId !== currentLatest) || polls >= 30) {
        clearInterval(pollId);
        setGeneratingJobs((prev) => { const next = new Set(prev); next.delete(jobId); return next; });
        fetch();
      }
    }, 10_000);
  };

  return {
    jobs,
    proposals,
    stats,
    loading,
    generatingJobs,
    refresh: fetch,
    skipJob,
    generateProposal,
    cancelGeneration,
    approveProposal,
    rejectProposal,
    editProposal,
    submitProposal,
  };
}

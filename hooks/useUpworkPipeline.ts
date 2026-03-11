import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { dashboardAction } from '../lib/dashboardActions';
import type { UpworkJob, UpworkProposal, UpworkPipelineStats } from '../types/dashboard';

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

  const fetch = useCallback(async () => {
    setLoading(true);
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
          .order('created_at', { ascending: false })
          .limit(100),
        supabase.rpc('upwork_pipeline_stats'),
      ]);

      setJobs((jobsRes.data || []).map(mapJob));
      setProposals((proposalsRes.data || []).map(mapProposal));
      const rawStats = statsRes.data;
      setStats(rawStats ? mapStats(Array.isArray(rawStats) ? rawStats[0] : rawStats) : emptyStats);
    } catch (err) {
      console.error('Failed to fetch upwork data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const skipJob = async (id: string, reason?: string) => {
    const prev = jobs.find((j) => j.id === id);
    setJobs((p) => p.map((j) => (j.id === id ? { ...j, status: 'skipped', skipReason: reason || null } : j)));
    try {
      await dashboardAction('upwork_jobs', id, 'status', 'skipped');
      if (reason) await dashboardAction('upwork_jobs', id, 'skip_reason', reason);
    } catch {
      if (prev) setJobs((p) => p.map((j) => (j.id === id ? { ...j, status: prev.status, skipReason: prev.skipReason } : j)));
    }
  };

  const approveProposal = async (id: string) => {
    const prev = proposals.find((p) => p.id === id);
    setProposals((p) => p.map((x) => (x.id === id ? { ...x, status: 'approved' } : x)));
    try {
      await dashboardAction('upwork_proposals', id, 'status', 'approved');
    } catch {
      if (prev) setProposals((p) => p.map((x) => (x.id === id ? { ...x, status: prev.status } : x)));
    }
  };

  const rejectProposal = async (id: string) => {
    const prev = proposals.find((p) => p.id === id);
    setProposals((p) => p.map((x) => (x.id === id ? { ...x, status: 'rejected' } : x)));
    try {
      await dashboardAction('upwork_proposals', id, 'status', 'rejected');
    } catch {
      if (prev) setProposals((p) => p.map((x) => (x.id === id ? { ...x, status: prev.status } : x)));
    }
  };

  const editProposal = async (id: string, field: 'proposal_text' | 'cover_letter', value: string) => {
    const prev = proposals.find((p) => p.id === id);
    setProposals((p) => p.map((x) => (x.id === id ? { ...x, proposalText: value, coverLetter: value } : x)));
    try {
      await dashboardAction('upwork_proposals', id, 'proposal_text', value);
      await dashboardAction('upwork_proposals', id, 'cover_letter', value);
    } catch {
      if (prev) setProposals((p) => p.map((x) => (x.id === id ? { ...x, proposalText: prev.proposalText, coverLetter: prev.coverLetter } : x)));
    }
  };

  const submitProposal = async (id: string) => {
    setProposals((prev) => prev.map((p) => (p.id === id ? { ...p, status: 'submitting' } : p)));
    try {
      const res = await window.fetch('https://n8n.intelligents.agency/webhook/upwork-submit-proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposal_id: id }),
      });
      const data = await res.json();
      if (data.success) {
        setProposals((prev) => prev.map((p) => (p.id === id ? { ...p, status: 'submitted', submittedAt: new Date().toISOString() } : p)));
      } else {
        setProposals((prev) => prev.map((p) => (p.id === id ? { ...p, status: 'pending_approval' } : p)));
      }
    } catch {
      setProposals((prev) => prev.map((p) => (p.id === id ? { ...p, status: 'pending_approval' } : p)));
    }
  };

  const generateProposal = async (jobId: string) => {
    setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, status: 'drafted' } : j)));
    try {
      const res = await window.fetch('https://n8n.intelligents.agency/webhook/upwork-draft-proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: jobId }),
      });
      const data = await res.json();
      if (!data.success && !data.proposal_id) {
        setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, status: 'assessed' } : j)));
      } else {
        await fetch();
      }
    } catch {
      setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, status: 'assessed' } : j)));
    }
  };

  return {
    jobs,
    proposals,
    stats,
    loading,
    refresh: fetch,
    skipJob,
    generateProposal,
    approveProposal,
    rejectProposal,
    editProposal,
    submitProposal,
  };
}

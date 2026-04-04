import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { dashboardAction, toastError, toastSuccess } from '../lib/dashboardActions';
import type {
  OutreachProspect,
  OutreachCampaign,
  OutreachMessage,
  OutreachEngagementLog,
  OutreachPipelineStats,
} from '../types/dashboard';

interface OptimisticLock {
  value: string;
  expiry: number;
}

const LOCK_TTL = 2 * 60 * 1000;

function mapProspect(r: any): OutreachProspect {
  return {
    id: r.id,
    campaignId: r.campaign_id,
    campaignName: r.outreach_campaigns?.name || null,
    campaignTags: r.outreach_campaigns?.niche_tags || [],
    linkedinUrl: r.linkedin_url,
    linkedinProfileId: r.linkedin_profile_id,
    apolloId: r.apollo_id,
    name: r.name,
    headline: r.headline,
    company: r.company,
    location: r.location,
    industry: r.industry,
    seniority: r.seniority,
    department: r.department,
    title: r.title,
    employeeCount: r.employee_count,
    foundedYear: r.founded_year,
    companyDomain: r.company_domain,
    companyLinkedinUrl: r.company_linkedin_url,
    companyDescription: r.company_description,
    companyKeywords: r.company_keywords || [],
    annualRevenue: r.annual_revenue,
    email: r.email,
    phone: r.phone,
    emailStatus: r.email_status,
    city: r.city,
    state: r.state,
    country: r.country,
    profilePhotoUrl: r.profile_photo_url,
    icpScore: r.icp_score,
    icpReasoning: r.icp_reasoning,
    activityScore: r.activity_score,
    lastPostDate: r.last_post_date,
    lastEngagementDate: r.last_engagement_date,
    postCount30d: r.post_count_30d,
    recentTopics: r.recent_topics || [],
    stage: r.stage,
    profileViewedAt: r.profile_viewed_at,
    postsLiked: r.posts_liked || 0,
    postsCommented: r.posts_commented || 0,
    lastEngagedAt: r.last_engaged_at,
    connectionSentAt: r.connection_sent_at,
    connectionNote: r.connection_note,
    connectedAt: r.connected_at,
    lastDmSentAt: r.last_dm_sent_at,
    dmCount: r.dm_count || 0,
    lastReplyAt: r.last_reply_at,
    replyCount: r.reply_count || 0,
    needsManualReply: r.needs_manual_reply || false,
    nextTouchAfter: r.next_touch_after,
    blacklisted: r.blacklisted || false,
    notes: r.notes,
    skipReason: r.skip_reason,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapCampaign(r: any): OutreachCampaign {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    apolloFilters: r.apollo_filters || {},
    nicheTags: r.niche_tags || [],
    isActive: r.is_active,
    maxProspects: r.max_prospects,
    warmupDays: r.warmup_days,
    prospectCount: r.prospect_count || 0,
    connectedCount: r.connected_count || 0,
    repliedCount: r.replied_count || 0,
    lastImportAt: r.last_import_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapMessage(r: any): OutreachMessage {
  return {
    id: r.id,
    prospectId: r.prospect_id,
    direction: r.direction,
    messageText: r.message_text,
    messageType: r.message_type,
    sequenceStep: r.sequence_step,
    unipileMessageId: r.unipile_message_id,
    unipileChatId: r.unipile_chat_id,
    sentAt: r.sent_at,
    createdAt: r.created_at,
    isDraft: !r.sent_at,
    matchedContentType: r.matched_content_type || null,
    matchedContentTitle: r.matched_content_title || null,
    matchedContentUrl: r.matched_content_url || null,
    industryCluster: r.industry_cluster || null,
  };
}

function mapEngagement(r: any): OutreachEngagementLog {
  return {
    id: r.id,
    prospectId: r.prospect_id,
    actionType: r.action_type,
    targetUrl: r.target_url,
    commentText: r.comment_text,
    success: r.success,
    errorMessage: r.error_message,
    createdAt: r.created_at,
  };
}

function mapStats(r: any): OutreachPipelineStats {
  return {
    totalProspects: r.total_prospects || 0,
    identified: r.identified || 0,
    enriched: r.enriched || 0,
    warming: r.warming || 0,
    engaged: r.engaged || 0,
    connectionSent: r.connection_sent || 0,
    connected: r.connected || 0,
    dmSent: r.dm_sent || 0,
    replied: r.replied || 0,
    converted: r.converted || 0,
    archived: r.archived || 0,
    activeCampaigns: r.active_campaigns || 0,
    avgIcpScore: r.avg_icp_score || 0,
    replyRate: r.reply_rate || 0,
    connectionRate: r.connection_rate || 0,
    engagementsToday: r.engagements_today || 0,
    dmsToday: r.dms_today || 0,
    needsAttention: r.needs_attention || 0,
  };
}

const emptyStats: OutreachPipelineStats = {
  totalProspects: 0, identified: 0, enriched: 0, warming: 0, engaged: 0,
  connectionSent: 0, connected: 0, dmSent: 0, replied: 0, converted: 0,
  archived: 0, activeCampaigns: 0, avgIcpScore: 0, replyRate: 0,
  connectionRate: 0, engagementsToday: 0, dmsToday: 0, needsAttention: 0,
};

export function useOutreachPipeline(timezone?: string) {
  const [prospects, setProspects] = useState<OutreachProspect[]>([]);
  const [campaigns, setCampaigns] = useState<OutreachCampaign[]>([]);
  const [stats, setStats] = useState<OutreachPipelineStats>(emptyStats);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Record<string, OutreachMessage[]>>({});
  const [engagementLog, setEngagementLog] = useState<Record<string, OutreachEngagementLog[]>>({});
  const [recentActivity, setRecentActivity] = useState<OutreachEngagementLog[]>([]);
  const [rateLimits, setRateLimits] = useState<Record<string, { count: number; daily_limit: number }>>({});
  const [featureFlags, setFeatureFlags] = useState<Record<string, boolean>>({});
  const [workflowStatuses, setWorkflowStatuses] = useState<Record<string, boolean>>({});

  // Optimistic locks
  const locks = useRef<Map<string, OptimisticLock>>(new Map());
  const hasLoaded = useRef(false);

  const lockField = (key: string, value: string) => {
    locks.current.set(key, { value, expiry: Date.now() + LOCK_TTL });
  };
  const clearLock = (key: string) => { locks.current.delete(key); };

  const fetch = useCallback(async () => {
    if (!hasLoaded.current) setLoading(true);
    try {
      const outreachWfIds = ['35HJE7eOpvEdxRwq', 'kr2lSH1eRGZcDWmO', '5ZXtArhobWrDDpfJ', 'joU7VaM5OiRAwLwP', 'KWxb6JFdpvb3y8w5'];
      const [prospectsRes, campaignsRes, statsRes, activityRes, rateLimitRes, flagsRes, wfStatusRes] = await Promise.all([
        supabase
          .from('outreach_prospects')
          .select('*, outreach_campaigns(name, niche_tags)')
          .order('updated_at', { ascending: false })
          .limit(500),
        supabase
          .from('outreach_campaigns')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase.rpc('outreach_pipeline_stats'),
        supabase
          .from('outreach_engagement_log')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('linkedin_daily_actions')
          .select('action_type, count, daily_limit')
          .eq('date', (() => {
            const now = new Date();
            if (!timezone) return now.toISOString().split('T')[0];
            const formatter = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
            const parts = formatter.formatToParts(now);
            const year = parts.find(p => p.type === 'year')?.value;
            const month = parts.find(p => p.type === 'month')?.value;
            const day = parts.find(p => p.type === 'day')?.value;
            return `${year}-${month}-${day}`;
          })()),
        supabase
          .from('integration_config')
          .select('key, value')
          .like('key', 'outreach_%'),
        supabase
          .from('dashboard_workflow_stats')
          .select('workflow_id, is_active')
          .in('workflow_id', outreachWfIds),
      ]);

      const now = Date.now();

      // Apply optimistic locks
      const serverProspects = (prospectsRes.data || []).map(mapProspect);
      setProspects(serverProspects.map((p) => {
        const stageLock = locks.current.get(`${p.id}:stage`);
        if (stageLock && now < stageLock.expiry) {
          return { ...p, stage: stageLock.value };
        }
        locks.current.delete(`${p.id}:stage`);
        const notesLock = locks.current.get(`${p.id}:notes`);
        if (notesLock && now < notesLock.expiry) {
          return { ...p, notes: notesLock.value };
        }
        locks.current.delete(`${p.id}:notes`);
        return p;
      }));

      setCampaigns((campaignsRes.data || []).map(mapCampaign));

      const rawStats = statsRes.data;
      setStats(rawStats ? mapStats(Array.isArray(rawStats) ? rawStats[0] : rawStats) : emptyStats);

      setRecentActivity((activityRes.data || []).map(mapEngagement));

      // Rate limits
      const rl: Record<string, { count: number; daily_limit: number }> = {};
      (rateLimitRes.data || []).forEach((r: any) => {
        rl[r.action_type] = { count: r.count, daily_limit: r.daily_limit };
      });
      setRateLimits(rl);

      // Feature flags
      const ff: Record<string, boolean> = {};
      (flagsRes.data || []).forEach((r: any) => {
        ff[r.key] = r.value === 'true';
      });
      setFeatureFlags(ff);

      // Workflow statuses
      const ws: Record<string, boolean> = {};
      (wfStatusRes.data || []).forEach((r: any) => {
        ws[r.workflow_id] = r.is_active === true;
      });
      setWorkflowStatuses(ws);

      hasLoaded.current = true;
    } catch (err) {
      toastError('load outreach data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  // Lazy loaders
  const fetchMessages = useCallback(async (prospectId: string) => {
    try {
      const { data } = await supabase
        .from('outreach_messages')
        .select('*')
        .eq('prospect_id', prospectId)
        .order('created_at', { ascending: true });
      setMessages((prev) => ({ ...prev, [prospectId]: (data || []).map(mapMessage) }));
    } catch (err) {
      toastError('load messages', err);
    }
  }, []);

  const fetchEngagementLog = useCallback(async (prospectId: string) => {
    try {
      const { data } = await supabase
        .from('outreach_engagement_log')
        .select('*')
        .eq('prospect_id', prospectId)
        .order('created_at', { ascending: false })
        .limit(50);
      setEngagementLog((prev) => ({ ...prev, [prospectId]: (data || []).map(mapEngagement) }));
    } catch (err) {
      toastError('load engagement log', err);
    }
  }, []);

  // Mutations
  const updateStage = useCallback(async (id: string, stage: string) => {
    const prev = prospects.find((p) => p.id === id);
    lockField(`${id}:stage`, stage);
    setProspects((p) => p.map((x) => (x.id === id ? { ...x, stage } : x)));
    try {
      await dashboardAction('outreach_prospects', id, 'stage', stage);
      clearLock(`${id}:stage`);
    } catch (err) {
      toastError('update stage', err);
      clearLock(`${id}:stage`);
      if (prev) setProspects((p) => p.map((x) => (x.id === id ? { ...x, stage: prev.stage } : x)));
    }
  }, [prospects]);

  const updateNotes = useCallback(async (id: string, notes: string) => {
    lockField(`${id}:notes`, notes);
    setProspects((p) => p.map((x) => (x.id === id ? { ...x, notes } : x)));
    try {
      await dashboardAction('outreach_prospects', id, 'notes', notes);
      clearLock(`${id}:notes`);
    } catch (err) {
      toastError('save notes', err);
      clearLock(`${id}:notes`);
    }
  }, []);

  const updateIcpScore = useCallback(async (id: string, score: number) => {
    setProspects((p) => p.map((x) => (x.id === id ? { ...x, icpScore: score } : x)));
    try {
      await dashboardAction('outreach_prospects', id, 'icp_score', String(score));
    } catch (err) {
      toastError('update ICP score', err);
    }
  }, []);

  const archiveProspect = useCallback(async (id: string, reason?: string) => {
    lockField(`${id}:stage`, 'archived');
    setProspects((p) => p.map((x) => (x.id === id ? { ...x, stage: 'archived', skipReason: reason || x.skipReason } : x)));
    try {
      await dashboardAction('outreach_prospects', id, 'stage', 'archived');
      if (reason) await dashboardAction('outreach_prospects', id, 'skip_reason', reason);
      clearLock(`${id}:stage`);
    } catch (err) {
      toastError('archive prospect', err);
      clearLock(`${id}:stage`);
    }
  }, []);

  const skipProspect = useCallback(async (id: string, reason: string) => {
    lockField(`${id}:stage`, 'archived');
    setProspects((p) => p.map((x) => (x.id === id ? { ...x, stage: 'archived', skipReason: reason } : x)));
    try {
      await dashboardAction('outreach_prospects', id, 'stage', 'archived');
      await dashboardAction('outreach_prospects', id, 'skip_reason', reason);
      clearLock(`${id}:stage`);
    } catch (err) {
      toastError('skip prospect', err);
      clearLock(`${id}:stage`);
    }
  }, []);

  const toggleBlacklist = useCallback(async (id: string) => {
    const current = prospects.find((p) => p.id === id);
    if (!current) return;
    const newVal = !current.blacklisted;
    setProspects((p) => p.map((x) => (x.id === id ? { ...x, blacklisted: newVal } : x)));
    try {
      await dashboardAction('outreach_prospects', id, 'blacklisted', String(newVal));
    } catch (err) {
      toastError('toggle blacklist', err);
      setProspects((p) => p.map((x) => (x.id === id ? { ...x, blacklisted: !newVal } : x)));
    }
  }, [prospects]);

  const toggleNeedsReply = useCallback(async (id: string) => {
    const current = prospects.find((p) => p.id === id);
    if (!current) return;
    const newVal = !current.needsManualReply;
    setProspects((p) => p.map((x) => (x.id === id ? { ...x, needsManualReply: newVal } : x)));
    try {
      await dashboardAction('outreach_prospects', id, 'needs_manual_reply', String(newVal));
    } catch (err) {
      toastError('toggle needs reply', err);
    }
  }, [prospects]);

  // Campaign mutations
  const toggleCampaign = useCallback(async (id: string, isActive: boolean) => {
    setCampaigns((p) => p.map((c) => (c.id === id ? { ...c, isActive } : c)));
    try {
      await dashboardAction('outreach_campaigns', id, 'is_active', String(isActive));
    } catch (err) {
      toastError('toggle campaign', err);
      setCampaigns((p) => p.map((c) => (c.id === id ? { ...c, isActive: !isActive } : c)));
    }
  }, []);

  const updateCampaignField = useCallback(async (id: string, field: string, value: string) => {
    try {
      await dashboardAction('outreach_campaigns', id, field, value);
      await fetch();
    } catch (err) {
      toastError('update campaign', err);
    }
  }, [fetch]);

  const createCampaign = useCallback(async (name: string, description: string, nicheTags: string[], apolloFilters: Record<string, any>) => {
    try {
      const { error } = await supabase.from('outreach_campaigns').insert({
        name,
        description: description || null,
        niche_tags: nicheTags,
        apollo_filters: apolloFilters,
      });
      if (error) throw error;
      toastSuccess('Campaign created');
      await fetch();
    } catch (err) {
      toastError('create campaign', err);
    }
  }, [fetch]);

  const deleteCampaign = useCallback(async (id: string) => {
    try {
      // Archive all prospects in campaign first
      await supabase.from('outreach_prospects').update({ stage: 'archived' }).eq('campaign_id', id);
      await supabase.from('outreach_campaigns').delete().eq('id', id);
      toastSuccess('Campaign deleted');
      await fetch();
    } catch (err) {
      toastError('delete campaign', err);
    }
  }, [fetch]);

  // Feature flag toggle
  const toggleFeatureFlag = useCallback(async (key: string) => {
    const current = featureFlags[key] || false;
    const newVal = !current;
    setFeatureFlags((prev) => ({ ...prev, [key]: newVal }));
    try {
      const { error } = await supabase.from('integration_config').update({ value: String(newVal), updated_at: new Date().toISOString() }).eq('key', key);
      if (error) throw error;
      toastSuccess(`${key.replace('outreach_', '').replace(/_/g, ' ')} ${newVal ? 'enabled' : 'disabled'}`);
    } catch (err) {
      toastError('toggle flag', err);
      setFeatureFlags((prev) => ({ ...prev, [key]: current }));
    }
  }, [featureFlags]);

  // Workflow activation toggle (via Supabase edge function)
  const toggleWorkflow = useCallback(async (workflowId: string) => {
    const current = workflowStatuses[workflowId] ?? true;
    const newActive = !current;
    setWorkflowStatuses((prev) => ({ ...prev, [workflowId]: newActive }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await window.fetch(
        'https://bjbvqvzbzczjbatgmccb.supabase.co/functions/v1/n8n-workflow-control',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ workflow_id: workflowId, action: newActive ? 'activate' : 'deactivate' }),
        }
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed');
      toastSuccess(`Workflow ${newActive ? 'activated' : 'deactivated'}`);
    } catch (err) {
      toastError('toggle workflow', err);
      setWorkflowStatuses((prev) => ({ ...prev, [workflowId]: current }));
    }
  }, [workflowStatuses]);

  // Webhook triggers
  const importProspects = useCallback(async (campaignId: string) => {
    try {
      toastSuccess('Import started...');
      await window.fetch('https://n8n.intelligents.agency/webhook/outreach-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id: campaignId }),
      });
    } catch (err) {
      toastError('trigger import', err);
    }
  }, []);

  const sendManualDm = useCallback(async (prospectId: string, messageText: string) => {
    try {
      const res = await window.fetch('https://n8n.intelligents.agency/webhook/outreach-manual-dm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospect_id: prospectId, message: messageText }),
      });
      const data = await res.json();
      if (data?.success) {
        toastSuccess('DM sent');
        await fetchMessages(prospectId);
        await fetch();
      } else {
        toastError('send DM — server rejected');
      }
    } catch (err) {
      toastError('send DM', err);
    }
  }, [fetch, fetchMessages]);

  const approveDraft = useCallback(async (prospectId: string, messageId: string, messageText: string) => {
    try {
      // Send via manual DM webhook
      const res = await window.fetch('https://n8n.intelligents.agency/webhook/outreach-manual-dm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospect_id: prospectId, message: messageText }),
      });
      const data = await res.json();
      if (data?.success) {
        // Mark draft as sent
        await supabase.from('outreach_messages').update({ sent_at: new Date().toISOString() }).eq('id', messageId);
        // Clear needs_manual_reply
        await supabase.from('outreach_prospects').update({ needs_manual_reply: false, updated_at: new Date().toISOString() }).eq('id', prospectId);
        toastSuccess('DM approved & sent');
        await fetchMessages(prospectId);
        await fetch();
      } else {
        toastError('approve DM — send failed');
      }
    } catch (err) {
      toastError('approve DM', err);
    }
  }, [fetch, fetchMessages]);

  const rejectDraft = useCallback(async (prospectId: string, messageId: string) => {
    try {
      await supabase.from('outreach_messages').delete().eq('id', messageId);
      // Revert dm_count so workflow can retry
      await supabase.from('outreach_prospects').update({ needs_manual_reply: false, updated_at: new Date().toISOString() }).eq('id', prospectId);
      toastSuccess('Draft rejected');
      await fetchMessages(prospectId);
      await fetch();
    } catch (err) {
      toastError('reject draft', err);
    }
  }, [fetch, fetchMessages]);

  // Derived state
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    prospects.forEach((p) => {
      counts[p.stage] = (counts[p.stage] || 0) + 1;
    });
    return counts;
  }, [prospects]);

  const actionNeeded = useMemo(() =>
    prospects.filter((p) => p.needsManualReply || p.stage === 'replied'),
    [prospects]
  );

  return {
    prospects,
    campaigns,
    stats,
    loading,
    messages,
    engagementLog,
    recentActivity,
    rateLimits,
    featureFlags,
    stageCounts,
    actionNeeded,
    refresh: fetch,
    fetchMessages,
    fetchEngagementLog,
    updateStage,
    updateNotes,
    updateIcpScore,
    archiveProspect,
    skipProspect,
    toggleBlacklist,
    toggleNeedsReply,
    toggleCampaign,
    updateCampaignField,
    createCampaign,
    deleteCampaign,
    toggleFeatureFlag,
    workflowStatuses,
    toggleWorkflow,
    importProspects,
    sendManualDm,
    approveDraft,
    rejectDraft,
  };
}

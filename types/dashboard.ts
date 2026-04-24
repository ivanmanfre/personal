export interface OwnPost {
  id: string;
  text: string;
  postType: string;
  likes: number;
  comments: number;
  shares: number;
  impressions: number;
  postedAt: string;
  linkedinUrl: string;
  topicCategory: string | null;
  hookPattern: string | null;
}

export interface WorkflowStat {
  id: string;
  workflowId: string;
  workflowName: string;
  isActive: boolean;
  triggerType: string;
  scheduleExpression: string | null;
  lastExecutionAt: string | null;
  lastExecutionStatus: string | null;
  lastExecutionDurationMs: number | null;
  successCount24h: number;
  errorCount24h: number;
  totalExecutions24h: number;
  lastErrorMessage: string | null;
  nodeCount: number;
  errorAcknowledged: boolean;
  updatedAt: string;
}

export interface CompetitorPost {
  id: string;
  competitorName: string;
  postText: string;
  postDate: string;
  likesCount: number;
  commentsCount: number;
  repostsCount: number;
  postType: string;
  topicCategory: string | null;
  hookPattern: string | null;
  isTopPerformer: boolean;
  hasOpportunity: boolean;
  theOpportunity: string | null;
  suggestedAngle: string | null;
  suggestedFormat: string | null;
  linkedinPostUrl: string | null;
  linkedinProfileUrl: string | null;
  opportunityActioned: boolean;
}

export interface CompetitorPattern {
  id: string;
  competitorName: string;
  postCount: number;
  patternsJson: any;
  patternText: string | null;
}

export interface ProactiveAlert {
  id: string;
  alertType: string;
  title: string;
  body: string;
  sent: boolean;
  sentAt: string | null;
  createdAt: string;
}

export interface Reminder {
  id: number;
  reminderText: string;
  remindAt: string;
  status: string;
  recurrence: string | null;
  createdAt: string;
}

export interface Lead {
  id: string;
  linkedinUrl: string | null;
  name: string | null;
  headline: string | null;
  company: string | null;
  icpScore: number | null;
  status: string | null;
  source: string | null;
  createdAt: string;
}

export interface ChatMessage {
  id: number;
  role: string;
  content: string;
  createdAt: string;
}

export interface DailySummary {
  id: string;
  date: string;
  summary: string;
  topics: string[];
  actionItems: string[];
  messageCount: number;
  createdAt: string;
}

export interface ClientInstance {
  id: string;
  clientName: string;
  n8nUrl: string;
  isActive: boolean;
  lastCheckedAt: string | null;
  consecutiveFailures: number;
  createdAt: string;
  updatedAt: string;
}

export interface ClientWorkflowError {
  id: string;
  clientId: string;
  clientName?: string;
  workflowId: string;
  workflowName: string | null;
  errorHash: string;
  errorMessage: string | null;
  aiAnalysis: string | null;
  severity: string;
  firstSeen: string;
  lastSeen: string;
  occurrenceCount: number;
  isResolved: boolean;
  createdAt: string;
  executionId?: string;
  n8nUrl?: string;
  fixStatus: string | null;
  fixAnalysis: string | null;
  fixDescription: string | null;
  fixAppliedAt: string | null;
}

export interface ScheduledPost {
  id: string;
  clickupTaskId: string | null;
  postText: string;
  postFormat: string | null;
  mediaUrls: string[];
  scheduledAt: string;
  status: string;
  errorMessage: string | null;
  createdAt: string;
  postedAt: string | null;
}

export interface PipelineTask {
  id: string;
  source: 'clickup' | 'reminder' | 'agent' | 'leadshark';
  sourceId: string;
  title: string;
  description: string | null;
  status: string;
  priority: string | null;
  dueDate: string | null;
  listName: string | null;
  metadata: Record<string, any>;
  updatedAt: string;
  parentTaskId: string | null;
  isRecurring: boolean;
  subtasks?: PipelineTask[];
}

export interface ClientMonitoredWorkflow {
  id: string;
  clientId: string;
  clientName: string;
  workflowId: string;
  workflowName: string;
  isActive: boolean;
  notificationsEnabled: boolean;
  lastErrorAt: string | null;
  errorCount: number;
  updatedAt: string;
}

export interface UpworkJob {
  id: string;
  upworkUrl: string;
  title: string;
  description: string | null;
  budgetType: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  skills: string[];
  clientHistory: Record<string, any> | null;
  postedAt: string | null;
  scrapedAt: string;
  icpScore: number | null;
  icpReasoning: string | null;
  fitTags: string[];
  matchedProjects: string[];
  status: string;
  skipReason: string | null;
  source: string | null;
  screeningQuestions: { question: string; required?: boolean }[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpworkProposal {
  id: string;
  jobId: string;
  proposalText: string;
  coverLetter: string | null;
  rateAmount: number | null;
  rateType: string | null;
  estimatedHours: number | null;
  portfolioRefs: string[];
  aiModel: string;
  pdfUrl: string | null;
  version: number;
  status: string;
  submittedAt: string | null;
  screeningAnswers: { question: string; answer: string }[] | null;
  diagramData: { html: string; json: any } | null;
  qaResult: {
    status: 'pass' | 'rewrite' | 'skip' | 'skip_parse_error';
    checks: { name: string; result: string; detail: string | null }[];
    original_cover_letter?: string;
    original_screening?: { question: string; answer: string }[];
    rewrite_model?: string;
  } | null;
  submissionMethod: 'local' | 'cloud' | null;
  createdAt: string;
}

export interface UpworkConversation {
  id: string;
  roomId: string;
  clientName: string | null;
  jobTitle: string | null;
  jobId: string | null;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  isUnread: boolean;
  unreadCount: number;
  status: string;
  firstSeenAt: string;
}

export interface UpworkPipelineStats {
  totalJobs: number;
  new: number;
  assessed: number;
  drafted: number;
  pendingApproval: number;
  submitted: number;
  won: number;
  skipped: number;
  submissionsToday: number;
  invites: number;
  unreadConversations: number;
}

export interface ExecutionLog {
  id: string;
  executionId: string;
  workflowId: string;
  workflowName: string | null;
  status: string;
  mode: string | null;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  isFinished: boolean;
  errorMessage: string | null;
  errorNode: string | null;
  lastNodeExecuted: string | null;
  nodesExecuted: string[] | null;
  retryOf: string | null;
  retrySuccessId: string | null;
}

// ─── Health Types ───

export interface HealthMedication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  scheduleDays: number[];
  scheduleTime: string;
  lastTakenAt: string | null;
  nextDueAt: string | null;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
}

export interface MedicationLog {
  id: string;
  medicationId: string;
  takenAt: string;
  source: string;
  notes: string | null;
}

export interface WeightLog {
  id: string;
  weightKg: number;
  loggedAt: string;
  source: string;
  notes: string | null;
}

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  lowStockThreshold: number;
  isActive: boolean;
  lastUpdatedAt: string;
  notes: string | null;
}

export interface TrainingDay {
  id: string;
  dayOfWeek: number;
  routineName: string;
  exercises: string | null;
  isActive: boolean;
}

export interface TrainingLog {
  id: string;
  scheduleId: string;
  completedAt: string;
  notes: string | null;
}

// ─── Outreach Types ───

export interface OutreachCampaign {
  id: string;
  name: string;
  description: string | null;
  apolloFilters: Record<string, any>;
  nicheTags: string[];
  isActive: boolean;
  maxProspects: number;
  warmupDays: number;
  prospectCount: number;
  connectedCount: number;
  repliedCount: number;
  lastImportAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OutreachProspect {
  id: string;
  campaignId: string | null;
  campaignName?: string;
  campaignTags?: string[];
  linkedinUrl: string;
  linkedinProfileId: string | null;
  apolloId: string | null;
  name: string;
  headline: string | null;
  company: string | null;
  location: string | null;
  industry: string | null;
  seniority: string | null;
  department: string | null;
  title: string | null;
  employeeCount: string | null;
  foundedYear: number | null;
  companyDomain: string | null;
  companyLinkedinUrl: string | null;
  companyDescription: string | null;
  companyKeywords: string[];
  annualRevenue: string | null;
  email: string | null;
  phone: string | null;
  emailStatus: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  profilePhotoUrl: string | null;
  icpScore: number | null;
  icpReasoning: string | null;
  activityScore: number | null;
  lastPostDate: string | null;
  lastEngagementDate: string | null;
  postCount30d: number | null;
  recentTopics: string[];
  stage: string;
  profileViewedAt: string | null;
  postsLiked: number;
  postsCommented: number;
  lastEngagedAt: string | null;
  connectionSentAt: string | null;
  connectionNote: string | null;
  connectedAt: string | null;
  lastDmSentAt: string | null;
  dmCount: number;
  lastReplyAt: string | null;
  replyCount: number;
  needsManualReply: boolean;
  nextTouchAfter: string | null;
  blacklisted: boolean;
  notes: string | null;
  skipReason: string | null;
  preferredChannel: string | null;
  triggerType: string | null;
  triggerDetail: string | null;
  triggerHook: string | null;
  triggerAsk: string | null;
  triggerSourceUrl: string | null;
  triggerConfidence: number | null;
  researchedAt: string | null;
  noteVariant: string | null;
  microPersona: string | null;
  messagingPattern: string | null;
  researchSources: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

export interface OutreachMessage {
  id: string;
  prospectId: string;
  direction: string;
  messageText: string;
  messageType: string;
  sequenceStep: number | null;
  unipileMessageId: string | null;
  unipileChatId: string | null;
  sentAt: string | null;
  approvedAt: string | null;
  createdAt: string;
  isDraft?: boolean;
  channel: string | null;
  matchedContentType: string | null;
  matchedContentTitle: string | null;
  matchedContentUrl: string | null;
  industryCluster: string | null;
  // Email follow-up sequence (Day 0 / 3 / 10)
  emailStep: number | null;
  emailSequenceStoppedAt: string | null;
  emailSequenceStoppedReason: string | null; // 'reply' | 'bounce' | 'completed' | 'unsubscribed'
  recipientEmail: string | null;
}

export interface CommentDraft {
  id: string;
  targetId: string;
  targetName: string | null;
  postExcerpt: string | null;
  postUrl: string | null;
  postSocialId: string | null;
  commentText: string;
  status: string;
  draftedAt: string | null;
}

export interface OutreachEngagementLog {
  id: string;
  prospectId: string;
  actionType: string;
  targetUrl: string | null;
  commentText: string | null;
  success: boolean;
  errorMessage: string | null;
  createdAt: string;
}

export interface OutreachPipelineStats {
  totalProspects: number;
  identified: number;
  enriched: number;
  warming: number;
  engaged: number;
  connectionSent: number;
  connected: number;
  dmSent: number;
  replied: number;
  converted: number;
  archived: number;
  activeCampaigns: number;
  avgIcpScore: number;
  replyRate: number;
  connectionRate: number;
  engagementsToday: number;
  dmsToday: number;
  emailsSentToday: number;
  needsAttention: number;
}

// ─── Recording Types ───

export interface Recording {
  id: string;
  title: string;
  description: string | null;
  originalPath: string;
  processedPath: string | null;
  thumbnailPath: string | null;
  audioPath: string | null;
  durationSeconds: number | null;
  fileSizeBytes: number | null;
  resolution: string | null;
  hasWebcam: boolean;
  hasAudio: boolean;
  status: string;
  processingError: string | null;
  shareToken: string | null;
  shareExpiresAt: string | null;
  isPublic: boolean;
  viewCount: number;
  expiresAt: string | null;
  keepTranscript: boolean;
  createdAt: string;
  updatedAt: string;
  transcriptText: string | null;
  autoTitle: string | null;
  autoTitleStatus: string | null;
}

export interface RecordingSegment {
  id: string;
  recordingId: string;
  segmentType: string;
  startTime: number;
  endTime: number;
  confidence: number | null;
  label: string | null;
  isIncluded: boolean;
}

export interface RecordingTranscript {
  id: string;
  recordingId: string;
  fullText: string | null;
  language: string;
  words: TranscriptWord[];
}

export interface TranscriptWord {
  id: string;
  word: string;
  startTime: number;
  endTime: number;
  confidence: number | null;
  wordIndex: number;
}

export interface RecordingComment {
  id: string;
  recordingId: string;
  authorName: string;
  commentText: string;
  timestampSeconds: number | null;
  parentId: string | null;
  createdAt: string;
}

export interface RecordingStats {
  total: number;
  uploading: number;
  processing: number;
  ready: number;
  shared: number;
  totalViews: number;
  totalComments: number;
  expiringSoon: number;
  totalSizeBytes: number;
}

// ─── Auto Research Types ───

export interface AutoResearchSession {
  id: string;
  name: string;
  description: string | null;
  targetType: 'prompt' | 'workflow_config' | 'parameter';
  targetRef: string;
  workflowId: string | null;
  promptPageId: string | null;
  metricName: string;
  metricUnit: string;
  metricDirection: 'lower_is_better' | 'higher_is_better';
  baselineValue: number | null;
  currentBestValue: number | null;
  improvementPct: number | null;
  totalRuns: number;
  keptRuns: number;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed';
  category: 'content' | 'outreach' | 'operations';
  config: Record<string, any>;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AutoResearchIteration {
  id: string;
  sessionId: string;
  runNumber: number;
  changeDescription: string;
  metricBefore: number | null;
  metricAfter: number | null;
  improvementPct: number | null;
  kept: boolean;
  details: Record<string, any>;
  createdAt: string;
}

// ─── Meeting/Call Transcript Types ───

export interface MeetingTranscript {
  id: string;
  firefliesId: string | null;
  title: string;
  date: string;
  durationMinutes: number;
  participants: string[];
  transcriptText: string;
  summary: string | null;
  actionItems: string[];
  topics: string[];
  followUpDraft: string | null;
  followUpSent: boolean;
  source: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MeetingStats {
  total: number;
  thisWeek: number;
  withActionItems: number;
  avgDurationMinutes: number;
}

// ─── Calendar Event Types ───

export interface CalendarEvent {
  id: string;
  googleEventId: string;
  title: string;
  startTime: string;
  endTime: string;
  attendees: string[];
  meetingUrl: string | null;
  platform: string | null;
  location: string | null;
  description: string | null;
  isAllDay: boolean;
  createdAt: string;
}

export interface VideoIdea {
  id: string;
  title: string;
  description: string | null;
  script: string | null;
  videoType: string;
  sourcePostId: string | null;
  sourceClickupTaskId: string | null;
  status: string;
  priority: string | null;
  platform: string;
  durationSeconds: number | null;
  tags: string[] | null;
  videoUrl: string | null;
  audioUrl: string | null;
  thumbnailUrl: string | null;
  renderStatus: string | null;
  renderError: string | null;
  carouselFolderId: string | null;
  recordingPath: string | null;
  recordingDurationSeconds: number | null;
  transcriptText: string | null;
  transcriptWords: { word: string; start: number; end: number }[] | null;
  renderProgress: {
    totalChunks: number;
    completedChunks: number;
    currentStep: string;
    estimatedCost: number;
    actualCost: number;
    steps: { name: string; status: string; detail?: string; startedAt?: string; completedAt?: string }[];
    chunkDetails: { index: number; status: string; heygenVideoId?: string; videoUrl?: string; durationSeconds?: number; cost?: number }[];
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface VideoShort {
  id: string;
  videoIdeaId: string;
  title: string;
  startTime: number;
  endTime: number;
  durationSeconds: number;
  format: 'short' | 'long';
  transcriptText: string | null;
  status: string;
  renderError: string | null;
  videoUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export type RefreshRate = 30000 | 60000 | 300000;
export type Tab = 'overview' | 'performance' | 'content' | 'workflows' | 'competitors' | 'leads' | 'agent' | 'clients' | 'tasks' | 'upwork' | 'health' | 'outreach' | 'recordings' | 'auto-research' | 'meetings' | 'code' | 'video' | 'agent-ready' | 'audience' | 'settings';

export interface PaidAssessmentRow {
  stripe_session_id: string;
  email: string;
  name: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  paid_at: string;
  pipeline_stage: string;
  day2_scheduled_at: string | null;
  day2_completed_at: string | null;
  day7_completed_at: string | null;
  followon_engagement: string | null;
  notes: string | null;
  intake_status: 'not_started' | 'in_progress' | 'submitted';
  intake_answers: Record<string, unknown>;
  intake_submitted_at: string | null;
}
export type SystemHealth = 'healthy' | 'degraded' | 'critical';

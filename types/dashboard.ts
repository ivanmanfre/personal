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
  createdAt: string;
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

export type RefreshRate = 30000 | 60000 | 300000;
export type Tab = 'overview' | 'performance' | 'content' | 'workflows' | 'competitors' | 'leads' | 'agent' | 'clients' | 'tasks' | 'upwork' | 'health' | 'settings';
export type SystemHealth = 'healthy' | 'degraded' | 'critical';

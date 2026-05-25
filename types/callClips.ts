export type ClipStatus =
  | "pending"
  | "approved"
  | "rendering"
  | "ready"
  | "scheduled"
  | "posting"
  | "posted"
  | "render_error"
  | "publish_error"
  | "rejected";

export type LayoutMode = "screen" | "webcam" | null;

export interface CallClip {
  id: string;
  sourceRecordingId: string;
  hookLine: string;
  transcriptText: string;
  suggestedCaption: string;
  postCopyLinkedIn: string | null;
  postCopyInstagram: string | null;
  instagramCrossPost: boolean;
  score: number;
  startTime: number;
  endTime: number;
  durationSeconds: number;
  anonymizationFlags: string[];
  needsExplicitConsent: boolean;
  consentReceived: boolean;
  layoutOverride: LayoutMode;
  status: ClipStatus;
  renderError: string | null;
  publishError: string | null;
  videoUrl: string | null;
  linkedinPostUrl: string | null;
  instagramPostUrl: string | null;
  scheduledAt: string | null;
  postedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const HARD_BLOCK_FLAGS = [
  "mentions_company_name",
  "mentions_personal_detail",
  "mentions_revenue_figure",
] as const;

export const SOFT_WARN_FLAGS = [
  "industry_identifying_detail",
  "mentions_specific_tool",
] as const;

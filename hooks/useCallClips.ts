import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { toastError, toastSuccess } from "../lib/dashboardActions";
import type { CallClip, ClipStatus } from "../types/callClips";

function mapRow(row: any): CallClip {
  return {
    id: row.id,
    sourceRecordingId: row.source_recording_id,
    hookLine: row.hook_line || "",
    transcriptText: row.transcript_text || "",
    suggestedCaption: row.suggested_caption || "",
    postCopyLinkedIn: row.post_copy_linkedin,
    postCopyInstagram: row.post_copy_instagram,
    instagramCrossPost: row.instagram_cross_post ?? true,
    score: Number(row.score ?? 0),
    startTime: Number(row.start_time),
    endTime: Number(row.end_time),
    durationSeconds: Number(row.duration_seconds),
    anonymizationFlags: row.anonymization_flags || [],
    needsExplicitConsent: !!row.needs_explicit_consent,
    consentReceived: !!row.consent_received,
    layoutOverride: row.layout_override ?? null,
    status: row.status as ClipStatus,
    renderError: row.render_error,
    publishError: row.publish_error,
    videoUrl: row.video_url,
    linkedinPostUrl: row.linkedin_post_url,
    instagramPostUrl: row.instagram_post_url,
    scheduledAt: row.scheduled_at,
    postedAt: row.posted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const RENDERER_URL = import.meta.env.VITE_CLIP_RENDERER_URL || "";

export function useCallClips(statusFilter: ClipStatus[] | "all" = "all") {
  const [clips, setClips] = useState<CallClip[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchClips = useCallback(async () => {
    setLoading(true);
    try {
      let q = supabase
        .from("video_shorts")
        .select("*")
        .eq("source_type", "call_recording")
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        q = q.in("status", statusFilter as string[]);
      }

      const { data, error } = await q;
      if (error) throw error;
      setClips((data || []).map(mapRow));
    } catch (e) {
      toastError("load call clips", e);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchClips();
  }, [fetchClips]);

  const update = useCallback(
    async (id: string, patch: Record<string, unknown>) => {
      try {
        const { error } = await supabase
          .from("video_shorts")
          .update({ ...patch, updated_at: new Date().toISOString() })
          .eq("id", id);
        if (error) throw error;
        await fetchClips();
      } catch (e) {
        toastError("update clip", e);
        throw e;
      }
    },
    [fetchClips]
  );

  const approve = useCallback(
    async (id: string) => {
      await update(id, { status: "approved" });
      toastSuccess("Approved, render starting");
      if (RENDERER_URL) {
        try {
          await fetch(`${RENDERER_URL}/render`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ clip_id: id }),
          });
        } catch (e) {
          toastError("trigger render", e);
        }
      }
    },
    [update]
  );

  const reject = useCallback(
    async (id: string) => {
      await update(id, { status: "rejected" });
      toastSuccess("Rejected");
    },
    [update]
  );

  const schedule = useCallback(
    async (id: string, scheduledAt: string, postCopy: string, igCrossPost: boolean) => {
      await update(id, {
        status: "scheduled",
        scheduled_at: scheduledAt,
        post_copy_linkedin: postCopy,
        instagram_cross_post: igCrossPost,
      });
      toastSuccess("Scheduled");
    },
    [update]
  );

  return { clips, loading, refresh: fetchClips, update, approve, reject, schedule };
}

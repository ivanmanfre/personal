// components/dashboard-v2/review/ScanVideoReview.tsx
//
// Operator review queue for scan walkthrough videos.
//
// The dashboard is authenticated, so RLS lets us read EVERY scan_videos row
// (public /scan pages only ever see status='approved'). Approve/Reject go
// through the gated SECURITY DEFINER RPC operator_approve_scan_video — same
// clientops-gate idiom as every other operator_* write on the cockpit.
//
// Sections, most-actionable first:
//   draft      → actionable cards (player + collapsible script + Approve/Reject)
//   rendering  → passive spinner cards (nothing to do yet)
//   failed     → error_message shown
//   approved / rejected → small recent-10 history list with status chips
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, ChevronDown, Check, X } from 'lucide-react';
import '../editorial-cockpit.css';
import { supabase } from '../../../lib/supabase';
import type { ScanVideo } from '../../../lib/scanTypes';

const GATE = 'clientops';

const fmtDate = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

const fmtDuration = (seconds: number | null | undefined): string | null => {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return null;
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

const STATUS_CHIP: Record<string, { label: string; color: string; bg: string }> = {
  approved: { label: 'Approved', color: 'var(--d-good)', bg: 'var(--d-good-bg)' },
  rejected: { label: 'Rejected', color: 'var(--d-bad)', bg: 'var(--d-bad-bg)' },
  draft: { label: 'Draft', color: 'var(--d-warn)', bg: 'var(--d-warn-bg)' },
  rendering: { label: 'Rendering', color: 'var(--d-paper-dim)', bg: 'transparent' },
  failed: { label: 'Failed', color: 'var(--d-bad)', bg: 'var(--d-bad-bg)' },
};

const Chip: React.FC<{ children: React.ReactNode; color?: string; bg?: string }> = ({ children, color, bg }) => (
  <span
    style={{
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '0.05em',
      color: color ?? 'var(--d-paper-dim)',
      background: bg ?? 'transparent',
      border: '1px solid var(--d-rule)',
      padding: '2px 8px',
      whiteSpace: 'nowrap',
    }}
  >
    {children}
  </span>
);

const DurationChip: React.FC<{ seconds: number | null | undefined }> = ({ seconds }) => {
  const d = fmtDuration(seconds);
  if (!d) return null;
  return <Chip>{d}</Chip>;
};

// ── One actionable draft card ──────────────────────────────────────────────
const DraftCard: React.FC<{
  video: ScanVideo;
  busy: boolean;
  onDecision: (id: string, decision: 'approved' | 'rejected') => void;
}> = ({ video, busy, onDecision }) => {
  const [scriptOpen, setScriptOpen] = useState(false);
  const scriptText = video.script?.full_text ?? null;

  return (
    <div style={{ border: '1px solid var(--d-rule-strong)', background: 'var(--d-surface)', padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--d-ink)', wordBreak: 'break-word' }}>
            {video.company_slug}
          </div>
          <div style={{ fontSize: 12, color: 'var(--d-paper-dim)', marginTop: 2 }}>{fmtDate(video.created_at)}</div>
        </div>
        <DurationChip seconds={video.duration_seconds} />
      </div>

      {video.video_url ? (
        <video
          controls
          playsInline
          preload="metadata"
          src={video.video_url}
          style={{ display: 'block', width: '100%', height: 'auto', background: '#000', marginBottom: 12 }}
        />
      ) : (
        <div style={{ fontSize: 12, color: 'var(--d-bad)', marginBottom: 12 }}>No video_url on this row.</div>
      )}

      {scriptText && (
        <div style={{ marginBottom: 12 }}>
          <button
            type="button"
            onClick={() => setScriptOpen((o) => !o)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
              cursor: 'pointer', color: 'var(--d-paper-dim)', fontSize: 12, fontWeight: 600, padding: 0,
            }}
          >
            <ChevronDown size={14} style={{ transform: scriptOpen ? 'rotate(180deg)' : 'none', transition: 'transform 120ms' }} />
            {scriptOpen ? 'Hide script' : 'Show script'}
          </button>
          {scriptOpen && (
            <pre
              style={{
                whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: '8px 0 0', padding: 12,
                background: 'var(--d-paper)', border: '1px solid var(--d-rule)', fontSize: 12.5,
                lineHeight: 1.55, color: 'var(--d-ink)', fontFamily: 'inherit',
              }}
            >
              {scriptText}
            </pre>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          type="button"
          disabled={busy}
          onClick={() => onDecision(video.id, 'approved')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', cursor: busy ? 'default' : 'pointer',
            border: '1px solid var(--d-good)', color: 'var(--d-good)', background: 'var(--d-good-bg)',
            fontSize: 13, fontWeight: 700, opacity: busy ? 0.5 : 1,
          }}
        >
          <Check size={15} /> Approve
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onDecision(video.id, 'rejected')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', cursor: busy ? 'default' : 'pointer',
            border: '1px solid var(--d-bad)', color: 'var(--d-bad)', background: 'var(--d-bad-bg)',
            fontSize: 13, fontWeight: 700, opacity: busy ? 0.5 : 1,
          }}
        >
          <X size={15} /> Reject
        </button>
      </div>
    </div>
  );
};

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase',
      color: 'var(--d-paper-dim)', margin: '24px 0 12px',
    }}
  >
    {children}
  </div>
);

const ScanVideoReview: React.FC = () => {
  const [videos, setVideos] = useState<ScanVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('scan_videos')
      .select('*')
      .order('created_at', { ascending: false });
    if (err) setError(err.message);
    else {
      setError(null);
      setVideos((data as ScanVideo[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const decide = useCallback(async (id: string, decision: 'approved' | 'rejected') => {
    setBusyId(id);
    // Optimistic — move the row to its decided status immediately.
    const prev = videos;
    setVideos((vs) => vs.map((v) => (v.id === id ? { ...v, status: decision } : v)));
    const { data, error: err } = await supabase.rpc('operator_approve_scan_video', {
      p_gate: GATE,
      p_video_id: id,
      p_decision: decision,
    });
    setBusyId(null);
    if (err || !(data as any)?.ok) {
      // Rollback on failure.
      setVideos(prev);
      setError(err?.message ?? 'Approval failed.');
      return;
    }
    setError(null);
  }, [videos]);

  const drafts = useMemo(() => videos.filter((v) => v.status === 'draft'), [videos]);
  const rendering = useMemo(() => videos.filter((v) => v.status === 'rendering'), [videos]);
  const failed = useMemo(() => videos.filter((v) => v.status === 'failed'), [videos]);
  const history = useMemo(
    () => videos.filter((v) => v.status === 'approved' || v.status === 'rejected').slice(0, 10),
    [videos],
  );

  return (
    <div style={{ padding: '2rem 2.5rem', maxWidth: 820 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--d-ink)', margin: 0 }}>Scan videos</h1>
          <p style={{ fontSize: 13, color: 'var(--d-paper-dim)', margin: '4px 0 0' }}>
            Approve walkthrough recordings before they show on a prospect's /scan report.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', cursor: 'pointer',
            border: '1px solid var(--d-rule)', color: 'var(--d-paper-dim)', fontSize: 12, fontWeight: 600, padding: '6px 12px',
          }}
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {error && (
        <div style={{ marginTop: 16, padding: 12, border: '1px solid var(--d-bad)', color: 'var(--d-bad)', background: 'var(--d-bad-bg)', fontSize: 13 }}>
          {error}
        </div>
      )}

      {loading && videos.length === 0 ? (
        <div style={{ marginTop: 24, color: 'var(--d-paper-dim)', fontSize: 13 }}>Loading…</div>
      ) : videos.length === 0 ? (
        <div style={{ marginTop: 24, color: 'var(--d-paper-dim)', fontSize: 13 }}>No scan videos yet.</div>
      ) : (
        <>
          {/* Drafts — the actionable queue. */}
          {drafts.length > 0 && (
            <>
              <SectionLabel>Awaiting review · {drafts.length}</SectionLabel>
              <div style={{ display: 'grid', gap: 16 }}>
                {drafts.map((v) => (
                  <DraftCard key={v.id} video={v} busy={busyId === v.id} onDecision={decide} />
                ))}
              </div>
            </>
          )}

          {/* Rendering — passive, nothing to do. */}
          {rendering.length > 0 && (
            <>
              <SectionLabel>Rendering · {rendering.length}</SectionLabel>
              <div style={{ display: 'grid', gap: 10 }}>
                {rendering.map((v) => (
                  <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--d-rule)', padding: '12px 14px' }}>
                    <span
                      aria-hidden
                      style={{
                        width: 14, height: 14, border: '2px solid var(--d-rule)', borderTopColor: 'var(--d-paper-dim)',
                        borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0,
                      }}
                    />
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--d-ink)' }}>{v.company_slug}</span>
                    <span style={{ fontSize: 12, color: 'var(--d-paper-dim)', marginLeft: 'auto' }}>{fmtDate(v.created_at)}</span>
                  </div>
                ))}
              </div>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </>
          )}

          {/* Failed — surface the error. */}
          {failed.length > 0 && (
            <>
              <SectionLabel>Failed · {failed.length}</SectionLabel>
              <div style={{ display: 'grid', gap: 10 }}>
                {failed.map((v) => (
                  <div key={v.id} style={{ border: '1px solid var(--d-bad)', background: 'var(--d-bad-bg)', padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--d-ink)' }}>{v.company_slug}</span>
                      <span style={{ fontSize: 12, color: 'var(--d-paper-dim)' }}>{fmtDate(v.created_at)}</span>
                    </div>
                    {v.error_message && (
                      <div style={{ fontSize: 12.5, color: 'var(--d-bad)', marginTop: 6, wordBreak: 'break-word' }}>{v.error_message}</div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* History — recent decided. */}
          {history.length > 0 && (
            <>
              <SectionLabel>Recent decisions</SectionLabel>
              <div style={{ display: 'grid', gap: 6 }}>
                {history.map((v) => {
                  const chip = STATUS_CHIP[v.status] ?? STATUS_CHIP.draft;
                  return (
                    <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--d-rule)', padding: '8px 2px' }}>
                      <span style={{ fontSize: 13, color: 'var(--d-ink)', minWidth: 0, wordBreak: 'break-word' }}>{v.company_slug}</span>
                      <span style={{ fontSize: 12, color: 'var(--d-paper-dim)', marginLeft: 'auto' }}>{fmtDate(v.approved_at ?? v.updated_at ?? v.created_at)}</span>
                      <Chip color={chip.color} bg={chip.bg}>{chip.label}</Chip>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default ScanVideoReview;

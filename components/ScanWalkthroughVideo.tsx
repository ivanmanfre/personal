// components/ScanWalkthroughVideo.tsx
//
// A compact, click-to-play "personal walkthrough" card shown at the top of a
// scan report when — and only when — an APPROVED walkthrough video exists for
// this company_slug. Zero footprint otherwise (returns null): no card, no
// skeleton, no layout shift.
//
// Design language matches the Black Box scan page: paper white, ink #131210,
// serif accents, flat sharp corners, one signal red. Loom-raw — no autoplay,
// no heavy chrome, just a real recording of Ivan walking the reader through
// their own report.
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { ScanVideo } from '../lib/scanTypes';

const SERIF = '"Schibsted Grotesk", system-ui, -apple-system, sans-serif';
const BODY_SERIF = '"Source Serif 4", Georgia, serif';
const INK = '#131210';
const PAPER = '#FFFFFF';
const MUTED = '#6B675E';
const HAIR = '#C9C2B2';

function fmtDuration(seconds: number | null | undefined): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return null;
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

type Row = Pick<ScanVideo, 'id' | 'video_url' | 'duration_seconds' | 'created_at'>;

const ScanWalkthroughVideo: React.FC<{ slug: string | null | undefined }> = ({ slug }) => {
  const [row, setRow] = useState<Row | null>(null);

  useEffect(() => {
    if (!slug) return;
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from('scan_videos')
        .select('id,video_url,duration_seconds,created_at')
        .eq('company_slug', slug)
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (alive) setRow((data as Row) ?? null);
    })();
    return () => {
      alive = false;
    };
  }, [slug]);

  // No approved walkthrough → render nothing at all.
  if (!row || !row.video_url) return null;

  const duration = fmtDuration(row.duration_seconds);

  return (
    <div style={{ background: PAPER }}>
      <div
        className="max-w-6xl mx-auto px-5 sm:px-6"
        style={{ paddingTop: 20, paddingBottom: 4 }}
      >
        <figure
          style={{
            margin: 0,
            border: `1px solid ${HAIR}`,
            background: PAPER,
          }}
        >
          {/* Label row — one line, serif, with a duration chip. */}
          <figcaption
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 14px',
              borderBottom: `1px solid ${HAIR}`,
            }}
          >
            <span
              aria-hidden
              style={{ width: 7, height: 7, background: '#C8361B', flexShrink: 0, display: 'inline-block' }}
            />
            <span
              style={{
                fontFamily: BODY_SERIF,
                fontSize: 14,
                color: INK,
                lineHeight: 1.3,
                flex: '1 1 auto',
                minWidth: 0,
              }}
            >
              I recorded a walkthrough of this page.
            </span>
            {duration && (
              <span
                style={{
                  fontFamily: SERIF,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  color: MUTED,
                  border: `1px solid ${HAIR}`,
                  padding: '2px 7px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {duration}
              </span>
            )}
          </figcaption>

          {/* Click-to-play — no autoplay, metadata preload keeps it cheap. */}
          <video
            controls
            playsInline
            preload="metadata"
            src={row.video_url}
            style={{
              display: 'block',
              width: '100%',
              height: 'auto',
              background: '#000',
            }}
          />
        </figure>
      </div>
    </div>
  );
};

export default ScanWalkthroughVideo;

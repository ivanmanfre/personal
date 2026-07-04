// components/dashboard/ImageEditor/SelectionCanvas.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Selection } from '../../../lib/imageEditModel';
import { buildSegmentReq, segmentAt } from '../../../lib/imageEditApi';

export interface SelectionCanvasProps {
  imageUrl: string;
  mode: 'click' | 'brush';
  selection: Selection | null;
  busy?: boolean;
  onSegmentStart: () => void;
  onSegmented: (sel: Selection) => void;
  onError: (msg: string) => void;
  brushMaskRef?: React.MutableRefObject<HTMLCanvasElement | null>;
}

// Drive-safe render helper — copied locally from CarouselEditor.tsx:209-212 so
// Google-Drive "/file/d/<id>/view" URLs (which don't render as <img src>)
// resolve to the Drive thumbnail endpoint instead.
function toImgSrc(u: string): string {
  const m = u.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  return m ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w1200` : u;
}

const BRUSH_RADIUS_RATIO = 0.02; // brush radius as a fraction of the larger natural dimension

export default function SelectionCanvas(props: SelectionCanvasProps) {
  const { imageUrl, mode, selection, busy, onSegmentStart, onSegmented, onError, brushMaskRef } = props;

  const imgRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  const captureNaturalSize = useCallback(() => {
    const el = imgRef.current;
    if (el && el.naturalWidth > 0) {
      setNaturalSize({ w: el.naturalWidth, h: el.naturalHeight });
    }
  }, []);

  useEffect(() => {
    // Handle the cached-image case where onLoad never fires because the
    // browser already had it decoded before this effect ran.
    if (imgRef.current?.complete) captureNaturalSize();
  }, [imageUrl, captureNaturalSize]);

  // Callback ref: forwards the live canvas element to the parent so it can
  // export the painted mask later (per the SelectionCanvasProps contract).
  const setCanvasRef = useCallback(
    (el: HTMLCanvasElement | null) => {
      canvasRef.current = el;
      if (brushMaskRef) brushMaskRef.current = el;
    },
    [brushMaskRef],
  );

  // (Re)initialize the brush canvas backing store at the image's natural
  // pixel resolution, filled black (unselected), whenever we enter brush
  // mode or the natural size becomes known.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || mode !== 'brush' || naturalSize.w === 0) return;
    canvas.width = naturalSize.w;
    canvas.height = naturalSize.h;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }, [mode, naturalSize]);

  const handleClick = useCallback(
    async (e: React.MouseEvent<HTMLDivElement>) => {
      if (busy) return;
      const imgEl = imgRef.current;
      if (!imgEl) return;
      const rect = imgEl.getBoundingClientRect();
      const relX = e.clientX - rect.left;
      const relY = e.clientY - rect.top;
      if (relX < 0 || relY < 0 || relX > rect.width || relY > rect.height) return;

      const naturalW = imgEl.naturalWidth || rect.width;
      const naturalH = imgEl.naturalHeight || rect.height;
      const natX = (relX / rect.width) * naturalW;
      const natY = (relY / rect.height) * naturalH;

      onSegmentStart();
      try {
        const sel = await segmentAt(buildSegmentReq(imageUrl, natX, natY));
        onSegmented(sel);
      } catch (err) {
        onError(err instanceof Error ? err.message : 'Segmentation failed');
      }
    },
    [busy, imageUrl, onSegmentStart, onSegmented, onError],
  );

  const pointToNatural = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas || canvas.width === 0) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return {
      x: ((clientX - rect.left) / rect.width) * canvas.width,
      y: ((clientY - rect.top) / rect.height) * canvas.height,
    };
  }, []);

  const paintAt = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      const pt = pointToNatural(clientX, clientY);
      if (!canvas || !pt) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const radius = Math.max(canvas.width, canvas.height) * BRUSH_RADIUS_RATIO;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
      ctx.fill();
    },
    [pointToNatural],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (busy) return;
      drawingRef.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      paintAt(e.clientX, e.clientY);
    },
    [busy, paintAt],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current || busy) return;
      paintAt(e.clientX, e.clientY);
    },
    [busy, paintAt],
  );

  const handlePointerUp = useCallback(() => {
    drawingRef.current = false;
  }, []);

  return (
    <div className="relative w-full select-none" style={{ lineHeight: 0 }}>
      <img
        ref={imgRef}
        src={toImgSrc(imageUrl)}
        alt="Editable"
        className="block w-full h-auto rounded-[var(--ds-radius)] border border-[var(--ds-line)]"
        draggable={false}
        onLoad={captureNaturalSize}
      />

      {selection && (
        <>
          {/* Scrim dims everything so the highlighted mask reads as "this is what's locked" */}
          <div className="absolute inset-0 rounded-[var(--ds-radius)] bg-[var(--ds-ink)]/55 pointer-events-none" />
          <img
            src={selection.maskUrl}
            alt="Selected region"
            className="absolute inset-0 w-full h-full object-fill mix-blend-screen opacity-90 pointer-events-none"
          />
        </>
      )}

      {mode === 'click' && !busy && (
        <div
          className="absolute inset-0 rounded-[var(--ds-radius)] cursor-crosshair"
          onClick={handleClick}
          role="button"
          tabIndex={0}
          aria-label="Click a spot in the image to select it"
        />
      )}

      {mode === 'brush' && (
        <canvas
          ref={setCanvasRef}
          className="absolute inset-0 w-full h-full rounded-[var(--ds-radius)] opacity-45 touch-none cursor-crosshair"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
      )}

      {busy && (
        <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-[var(--ds-radius)] bg-[var(--ds-bg)]/70">
          <span
            className="h-5 w-5 rounded-full border-2 border-[var(--ds-accent)] border-t-transparent animate-spin"
            aria-hidden="true"
          />
          <span className="text-sm font-medium text-[var(--ds-ink)]">Finding edges…</span>
        </div>
      )}
    </div>
  );
}

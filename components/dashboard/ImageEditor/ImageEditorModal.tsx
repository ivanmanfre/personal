// components/dashboard/ImageEditor/ImageEditorModal.tsx
//
// Shell that wires the proposal state machine (lib/imageEditModel) to the
// four leaf components: SelectionCanvas (click/brush → segment), ActionPopover
// (preset chips + free text on a selection), CommandBar (always-visible
// whole-image plain-English input), and ProposalPanel (the safety lever —
// Keep / Try again / Go back). No AI result ever lands in imageUrls until
// the user explicitly hits Keep (commitImageEdit).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  initEditState,
  onSegmentStart,
  onSegmented,
  onEditStart,
  onProposal,
  onKeep,
  onTryAgain,
  onGoBack,
  onUndo,
  onError,
  canUndo,
  overCostCap,
} from '../../../lib/imageEditModel';
import type { EditState, Selection } from '../../../lib/imageEditModel';
import { buildEditReq, editImage } from '../../../lib/imageEditApi';
import { commitImageEdit, revertImageEdit } from '../../../lib/studioActions';
import ProposalPanel from './ProposalPanel';
import SelectionCanvas from './SelectionCanvas';
import ActionPopover from './ActionPopover';
import CommandBar from './CommandBar';

export interface ImageEditorModalProps {
  open: boolean;
  draftId: string;
  imageUrls: string[];
  index: number;
  onClose: () => void;
  onCommitted: (nextUrls: string[]) => void;
}

type EditOp = 'erase' | 'replace' | 'refine';

interface LastEditArgs {
  op: EditOp;
  prompt?: string;
  maskUrl?: string;
  wholeImage?: boolean;
}

export default function ImageEditorModal(props: ImageEditorModalProps) {
  const { open, draftId, imageUrls, index, onClose, onCommitted } = props;

  const [state, setState] = useState<EditState>(() => initEditState(imageUrls[index] || ''));
  const [mode, setMode] = useState<'click' | 'brush'>('click');
  const [lastEditArgs, setLastEditArgs] = useState<LastEditArgs | null>(null);
  const [committing, setCommitting] = useState(false);
  const brushMaskRef = useRef<HTMLCanvasElement | null>(null);

  // Re-arm the machine fresh whenever the modal opens for a given draft/index.
  useEffect(() => {
    if (!open) return;
    setState(initEditState(imageUrls[index] || ''));
    setMode('click');
    setLastEditArgs(null);
    setCommitting(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, draftId, index]);

  const overCap = overCostCap(state);
  const busy = state.phase === 'segmenting' || state.phase === 'editing' || committing;

  const runEdit = useCallback(
    async (args: LastEditArgs) => {
      setLastEditArgs(args);
      setState((s) => onEditStart(s));
      try {
        const { resultUrl } = await editImage(
          buildEditReq({
            imageUrl: state.imageUrl,
            op: args.op,
            maskUrl: args.maskUrl,
            prompt: args.prompt,
            wholeImage: args.wholeImage,
            draftId,
          }),
        );
        setState((s) => onProposal(s, resultUrl));
      } catch (e) {
        setState((s) => onError(s, e instanceof Error ? e.message : 'Edit failed'));
      }
    },
    [state.imageUrl, draftId],
  );

  // --- CLICK path -----------------------------------------------------
  const handleSegmentStart = useCallback(() => setState((s) => onSegmentStart(s)), []);
  const handleSegmented = useCallback((sel: Selection) => setState((s) => onSegmented(s, sel)), []);
  const handleSegmentError = useCallback((msg: string) => setState((s) => onError(s, msg)), []);

  const handleAction = useCallback(
    (a: { op: EditOp; prompt: string }) => {
      if (!state.selection) return;
      runEdit({ op: a.op, prompt: a.prompt, maskUrl: state.selection.maskUrl, wholeImage: false });
    },
    [state.selection, runEdit],
  );

  // Brush mode: paint a mask directly, then hand it to the same segmented
  // flow as a click-derived selection (no object class known from a brush).
  const handleUseBrushSelection = useCallback(() => {
    const canvas = brushMaskRef.current;
    if (!canvas || canvas.width === 0) return;
    const maskUrl = canvas.toDataURL('image/png');
    const sel: Selection = { maskUrl, bbox: [0, 0, canvas.width, canvas.height] };
    setState((s) => onSegmented(s, sel));
  }, []);

  // --- COMMAND path -----------------------------------------------------
  const handleCommandSubmit = useCallback(
    (prompt: string) => {
      runEdit({ op: 'refine', prompt, wholeImage: true });
    },
    [runEdit],
  );

  // --- Proposal actions -----------------------------------------------------
  const handleKeep = useCallback(async () => {
    if (!state.proposalUrl) return;
    setCommitting(true);
    try {
      const nextUrls = await commitImageEdit({
        draftId,
        imageUrls,
        index,
        newUrl: state.proposalUrl,
        op: lastEditArgs?.op || 'refine',
        prompt: lastEditArgs?.prompt,
      });
      setState((s) => onKeep(s));
      onCommitted(nextUrls);
    } catch (e) {
      setState((s) => onError(s, e instanceof Error ? e.message : 'Failed to save edit'));
    } finally {
      setCommitting(false);
    }
  }, [state.proposalUrl, draftId, imageUrls, index, lastEditArgs, onCommitted]);

  const handleTryAgain = useCallback(() => {
    if (!lastEditArgs) {
      setState((s) => onTryAgain(s));
      return;
    }
    setState((s) => onTryAgain(s));
    runEdit(lastEditArgs);
  }, [lastEditArgs, runEdit]);

  const handleGoBack = useCallback(() => setState((s) => onGoBack(s)), []);

  const handleRetryError = useCallback(() => {
    if (lastEditArgs) {
      runEdit(lastEditArgs);
    } else {
      setState((s) => onGoBack(s));
    }
  }, [lastEditArgs, runEdit]);

  const handleUndo = useCallback(async () => {
    if (!canUndo(state) || committing) return;
    const prevUrl = state.versions[state.versions.length - 1];
    setCommitting(true);
    try {
      const nextUrls = await revertImageEdit({ draftId, imageUrls, index, prevUrl });
      setState((s) => onUndo(s));
      onCommitted(nextUrls);
    } catch (e) {
      setState((s) => onError(s, e instanceof Error ? e.message : 'Undo failed'));
    } finally {
      setCommitting(false);
    }
  }, [state, committing, draftId, imageUrls, index, onCommitted]);

  // Esc / backdrop: dismiss the current step first; only close the modal
  // outright once we're already idle.
  const handleRequestClose = useCallback(() => {
    if (state.phase === 'idle') {
      onClose();
      return;
    }
    setState((s) => onGoBack(s));
  }, [state.phase, onClose]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') handleRequestClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, handleRequestClose]);

  if (!open) return null;

  const progressText =
    state.phase === 'editing'
      ? lastEditArgs?.wholeImage
        ? 'Applying whole-image edit… ~10s'
        : 'Repainting that region… ~10s'
      : null;

  const showCanvasStep = state.phase === 'idle' || state.phase === 'segmenting' || state.phase === 'selected';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={handleRequestClose}
      role="dialog"
      aria-modal="true"
      aria-label="Edit image"
    >
      <div className="absolute inset-0 bg-[var(--ds-ink)]/60" />
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[var(--ds-radius)] border border-[var(--ds-line)] bg-[var(--ds-bg)] shadow-[var(--ds-shadow-card)] p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-[var(--ds-ink)]">Edit image</h2>
          <div className="flex items-center gap-2">
            {canUndo(state) && (
              <button
                onClick={handleUndo}
                disabled={committing}
                className="min-h-[44px] px-3 rounded-[var(--ds-radius)] border border-[var(--ds-line)] text-[var(--ds-ink)] text-sm disabled:opacity-50 hover:bg-[var(--ds-card)]"
              >
                Undo last edit
              </button>
            )}
            <button
              onClick={handleRequestClose}
              aria-label="Close editor"
              className="min-h-[44px] min-w-[44px] px-2 rounded-[var(--ds-radius)] text-[var(--ds-dim)] hover:bg-[var(--ds-card)]"
            >
              ✕
            </button>
          </div>
        </div>

        {overCap && (
          <div className="mb-3 rounded-[var(--ds-radius)] border border-[var(--ds-warn)] bg-[var(--ds-card)] p-3 text-sm text-[var(--ds-warn)]">
            You've made a lot of edits this session — reopen to continue.
          </div>
        )}

        {state.phase === 'error' && (
          <div className="mb-3 rounded-[var(--ds-radius)] border border-[var(--ds-warn)] bg-[var(--ds-card)] p-4">
            <p className="text-sm text-[var(--ds-warn)]">{state.error}</p>
            <button
              onClick={handleRetryError}
              className="mt-3 min-h-[44px] px-4 rounded-[var(--ds-radius)] bg-[var(--ds-accent)] text-white font-medium hover:bg-[var(--ds-accent-hover)]"
            >
              Try again
            </button>
          </div>
        )}

        {state.phase === 'editing' && (
          <div className="mb-3 flex items-center gap-3 rounded-[var(--ds-radius)] border border-[var(--ds-line)] bg-[var(--ds-card)] p-6">
            <span
              className="h-5 w-5 rounded-full border-2 border-[var(--ds-accent)] border-t-transparent animate-spin"
              aria-hidden="true"
            />
            <span className="text-sm text-[var(--ds-ink)]">{progressText}</span>
          </div>
        )}

        {state.phase === 'proposing' && state.proposalUrl && (
          <ProposalPanel
            beforeUrl={state.imageUrl}
            afterUrl={state.proposalUrl}
            busy={committing}
            onKeep={handleKeep}
            onTryAgain={handleTryAgain}
            onGoBack={handleGoBack}
            wholeImageHint={lastEditArgs?.wholeImage}
          />
        )}

        {showCanvasStep && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <button
                onClick={() => setMode('click')}
                disabled={overCap}
                className={`min-h-[44px] px-3 rounded-[var(--ds-radius)] border text-sm disabled:opacity-50 ${
                  mode === 'click'
                    ? 'border-[var(--ds-accent)] bg-[var(--ds-accent)] text-white'
                    : 'border-[var(--ds-line)] text-[var(--ds-ink)] hover:bg-[var(--ds-card)]'
                }`}
              >
                Click a spot
              </button>
              <button
                onClick={() => setMode('brush')}
                disabled={overCap}
                className={`min-h-[44px] px-3 rounded-[var(--ds-radius)] border text-sm disabled:opacity-50 ${
                  mode === 'brush'
                    ? 'border-[var(--ds-accent)] bg-[var(--ds-accent)] text-white'
                    : 'border-[var(--ds-line)] text-[var(--ds-ink)] hover:bg-[var(--ds-card)]'
                }`}
              >
                Brush
              </button>
              {mode === 'brush' && (
                <button
                  onClick={handleUseBrushSelection}
                  disabled={overCap || busy}
                  className="min-h-[44px] px-3 rounded-[var(--ds-radius)] border border-[var(--ds-line)] text-[var(--ds-ink)] text-sm disabled:opacity-50 hover:bg-[var(--ds-card)]"
                >
                  Use this selection
                </button>
              )}
            </div>

            <SelectionCanvas
              imageUrl={state.imageUrl}
              mode={mode}
              selection={state.selection}
              busy={state.phase === 'segmenting' || overCap}
              onSegmentStart={handleSegmentStart}
              onSegmented={handleSegmented}
              onError={handleSegmentError}
              brushMaskRef={brushMaskRef}
            />

            {state.phase === 'selected' && state.selection && (
              <ActionPopover
                objectClass={state.selection.objectClass}
                busy={overCap || busy}
                onAction={handleAction}
                onCancel={handleGoBack}
              />
            )}

            <CommandBar busy={overCap || busy} onSubmit={handleCommandSubmit} />
          </div>
        )}
      </div>
    </div>
  );
}

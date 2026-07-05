export type EditPhase = 'idle' | 'segmenting' | 'selected' | 'editing' | 'proposing' | 'error';

export interface Selection {
  maskUrl: string;
  bbox: [number, number, number, number];
  objectClass?: string;
}

export interface EditState {
  phase: EditPhase;
  imageUrl: string;
  selection: Selection | null;
  proposalUrl: string | null;
  versions: string[];
  error: string | null;
  editCount: number;
}

export const MAX_EDITS_PER_SESSION = 40;

export function initEditState(imageUrl: string): EditState {
  return { phase: 'idle', imageUrl, selection: null, proposalUrl: null, versions: [], error: null, editCount: 0 };
}

export function onSegmentStart(s: EditState): EditState {
  return { ...s, phase: 'segmenting', error: null };
}

export function onSegmented(s: EditState, sel: Selection): EditState {
  return { ...s, phase: 'selected', selection: sel };
}

export function onEditStart(s: EditState): EditState {
  // count every generation start (click edit, command-bar, or Try-again) — NOT just
  // Keeps — so overCostCap actually caps a retry loop (each generation costs money).
  return { ...s, phase: 'editing', error: null, editCount: s.editCount + 1 };
}

export function onProposal(s: EditState, proposalUrl: string): EditState {
  return { ...s, phase: 'proposing', proposalUrl }; // imageUrl deliberately untouched
}

export function onKeep(s: EditState): EditState {
  if (!s.proposalUrl) return s;
  // editCount is bumped at generation start (onEditStart), not here.
  return {
    ...s,
    imageUrl: s.proposalUrl,
    versions: [...s.versions, s.imageUrl],
    proposalUrl: null,
    selection: null,
    phase: 'idle',
  };
}

export function onTryAgain(s: EditState): EditState {
  return { ...s, proposalUrl: null, phase: s.selection ? 'selected' : 'idle' };
}

export function onGoBack(s: EditState): EditState {
  return { ...s, proposalUrl: null, selection: null, phase: 'idle' };
}

export function onUndo(s: EditState): EditState {
  if (s.versions.length === 0) return s;
  const versions = [...s.versions];
  const prev = versions.pop()!;
  return { ...s, imageUrl: prev, versions, phase: 'idle', selection: null, proposalUrl: null };
}

export function onError(s: EditState, msg: string): EditState {
  return { ...s, phase: 'error', error: msg };
}

export function canUndo(s: EditState): boolean {
  return s.versions.length > 0;
}

export function overCostCap(s: EditState): boolean {
  return s.editCount >= MAX_EDITS_PER_SESSION;
}

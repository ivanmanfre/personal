// lib/imageEditModel.test.ts
import { describe, it, expect } from 'vitest';
import {
  initEditState, onSegmentStart, onSegmented, onEditStart, onProposal,
  onKeep, onTryAgain, onGoBack, onUndo, onError, canUndo, overCostCap,
  MAX_EDITS_PER_SESSION,
} from './imageEditModel';

const sel = { maskUrl: 'https://x/mask.png', bbox: [10, 10, 50, 50] as [number,number,number,number], objectClass: 'laptop' };

describe('imageEditModel proposal machine', () => {
  it('starts idle with the original image and no versions', () => {
    const s = initEditState('https://x/orig.png');
    expect(s.phase).toBe('idle');
    expect(s.imageUrl).toBe('https://x/orig.png');
    expect(s.versions).toEqual([]);
    expect(canUndo(s)).toBe(false);
  });

  it('segment → selected carries the selection', () => {
    let s = onSegmentStart(initEditState('o'));
    expect(s.phase).toBe('segmenting');
    s = onSegmented(s, sel);
    expect(s.phase).toBe('selected');
    expect(s.selection?.objectClass).toBe('laptop');
  });

  it('edit → proposing holds proposalUrl without touching imageUrl', () => {
    let s = onSegmented(onSegmentStart(initEditState('orig')), sel);
    s = onEditStart(s);
    expect(s.phase).toBe('editing');
    s = onProposal(s, 'https://x/prop.png');
    expect(s.phase).toBe('proposing');
    expect(s.proposalUrl).toBe('https://x/prop.png');
    expect(s.imageUrl).toBe('orig'); // NOT mutated yet — the safety promise
  });

  it('Keep commits proposal and pushes the prior image onto versions', () => {
    let s = onProposal(onEditStart(onSegmented(onSegmentStart(initEditState('orig')), sel)), 'prop');
    s = onKeep(s);
    expect(s.imageUrl).toBe('prop');
    expect(s.versions).toEqual(['orig']);
    expect(s.proposalUrl).toBeNull();
    expect(s.selection).toBeNull();
    expect(s.phase).toBe('idle');
    expect(s.editCount).toBe(1);
  });

  it('Try again discards the proposal but keeps the selection', () => {
    let s = onProposal(onEditStart(onSegmented(onSegmentStart(initEditState('orig')), sel)), 'prop');
    s = onTryAgain(s);
    expect(s.imageUrl).toBe('orig');
    expect(s.proposalUrl).toBeNull();
    expect(s.selection).not.toBeNull();
    expect(s.phase).toBe('selected');
  });

  it('Go back discards proposal and clears selection to idle', () => {
    let s = onProposal(onEditStart(onSegmented(onSegmentStart(initEditState('orig')), sel)), 'prop');
    s = onGoBack(s);
    expect(s.imageUrl).toBe('orig');
    expect(s.selection).toBeNull();
    expect(s.phase).toBe('idle');
  });

  it('Undo pops the version stack back onto imageUrl', () => {
    let s = onKeep(onProposal(onEditStart(onSegmented(onSegmentStart(initEditState('orig')), sel)), 'prop'));
    expect(canUndo(s)).toBe(true);
    s = onUndo(s);
    expect(s.imageUrl).toBe('orig');
    expect(s.versions).toEqual([]);
  });

  it('error sets phase error with message', () => {
    const s = onError(initEditState('o'), 'fal 500');
    expect(s.phase).toBe('error');
    expect(s.error).toBe('fal 500');
  });

  it('cost cap trips at the session max', () => {
    const s = { ...initEditState('o'), editCount: MAX_EDITS_PER_SESSION };
    expect(overCostCap(s)).toBe(true);
  });
});

import { test, expect } from 'vitest';
import { resolveLmChipTarget } from './resolveLmChipTarget';

const base = { kind: 'lm', title: 't', scheduledAt: null } as any;

test('pending repost LM chip → queue editor (edits the actual queued text)', () => {
  expect(resolveLmChipTarget({ ...base, id: 'sp-1', editId: 'lm-1', tone: 'scheduled', isRepost: true }))
    .toEqual({ target: 'queue', id: 'sp-1' });
});

test('normal scheduled LM chip → full LM editor', () => {
  expect(resolveLmChipTarget({ ...base, id: 'sp-2', editId: 'lm-2', tone: 'scheduled', isRepost: false }))
    .toEqual({ target: 'lm-editor', id: 'lm-2' });
});

test('posted repost LM chip → LM editor (read-only revive path lives there)', () => {
  expect(resolveLmChipTarget({ ...base, id: 'sp-3', editId: 'lm-3', tone: 'published', isRepost: true }))
    .toEqual({ target: 'lm-editor', id: 'lm-3' });
});

test('LM chip with no editId → error', () => {
  expect(resolveLmChipTarget({ ...base, id: 'sp-4', tone: 'published' }))
    .toEqual({ target: 'error' });
});

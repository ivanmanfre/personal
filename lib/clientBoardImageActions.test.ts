import { describe, it, expect } from 'vitest';
import { swapBoardItemImage } from './clientBoardImageActions';

describe('swapBoardItemImage', () => {
  it('swaps media_url on a matching queue item, leaving siblings intact', () => {
    const board = {
      queue: [
        { id: 'a', media_url: 'old-a' },
        { id: 'b', media_url: 'old-b' },
      ],
    };
    const next = swapBoardItemImage(board, 'a', 'media_url', 'new-a');
    expect(next.queue[0].media_url).toBe('new-a');
    expect(next.queue[1].media_url).toBe('old-b');
    expect(next).not.toBe(board);
  });

  it('is a no-op clone (not same ref) when id not found', () => {
    const board = { queue: [{ id: 'a', media_url: 'old-a' }] };
    const next = swapBoardItemImage(board, 'zzz', 'media_url', 'new-url');
    expect(next).not.toBe(board);
    expect(next).toEqual(board);
  });

  it('finds an item in ideas too', () => {
    const board = {
      queue: [{ id: 'a', media_url: 'old-a' }],
      ideas: [{ id: 'idea-1', cover_url: 'old-cover' }],
    };
    const next = swapBoardItemImage(board, 'idea-1', 'cover_url', 'new-cover');
    expect(next.ideas[0].cover_url).toBe('new-cover');
    expect(next.queue[0].media_url).toBe('old-a');
  });
});

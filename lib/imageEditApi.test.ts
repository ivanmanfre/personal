// lib/imageEditApi.test.ts
import { describe, it, expect } from 'vitest';
import { buildSegmentReq, buildEditReq } from './imageEditApi';

describe('request builders', () => {
  it('buildSegmentReq rounds coordinates to integers', () => {
    expect(buildSegmentReq('u', 12.6, 40.2)).toEqual({ image_url: 'u', x: 13, y: 40 });
  });
  it('buildEditReq for a masked erase omits whole_image and carries mask', () => {
    const r = buildEditReq({ imageUrl: 'u', op: 'erase', maskUrl: 'm', draftId: 'd' });
    expect(r).toEqual({ image_url: 'u', op: 'erase', mask_url: 'm', draft_id: 'd' });
    expect('whole_image' in r).toBe(false);
  });
  it('buildEditReq for a whole-image refine sets whole_image true and no mask', () => {
    const r = buildEditReq({ imageUrl: 'u', op: 'refine', prompt: 'warmer', wholeImage: true, draftId: 'd' });
    expect(r).toEqual({ image_url: 'u', op: 'refine', prompt: 'warmer', whole_image: true, draft_id: 'd' });
  });
});

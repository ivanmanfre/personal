import { describe, expect, it } from 'vitest';
import { salesChannelTag, type OutreachProspect } from './shared';

const lead = (fit?: string, is_d2c = true) => ({
  is_d2c,
  channel_tag: fit ? { fit } : null,
} as OutreachProspect);

describe('salesChannelTag', () => {
  it('shows the sales route in plain language without implying unknown is blocked', () => {
    expect(salesChannelTag(lead('direct'))?.label).toBe('Buy on brand website');
    expect(salesChannelTag(lead('retail_first'))?.label).toBe('Mainly stores/delivery');
    expect(salesChannelTag(lead('unknown'))?.label).toBe('Sales route unclear');
    expect(salesChannelTag(lead('unknown'))?.title).toContain('does not block outreach');
    expect(salesChannelTag(lead())?.label).toBe('Not checked yet');
    expect(salesChannelTag(lead(undefined, false))).toBeNull();
  });
});

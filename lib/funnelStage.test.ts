import { describe, it, expect } from 'vitest';
import { funnelStageFor } from './funnelStage';

describe('funnelStageFor', () => {
  it('maps call sources to buyers', () => {
    expect(funnelStageFor('calls')).toBe('buyers');
    expect(funnelStageFor('kyle_call')).toBe('buyers');
    expect(funnelStageFor('ivan_call')).toBe('buyers');
  });

  it('maps news/scan sources to reach', () => {
    for (const s of ['breaking_news', 'hacker_news', 'model_launch', 'x_search', 'reddit_se']) {
      expect(funnelStageFor(s)).toBe('reach');
    }
  });

  it('defaults everything else to trust', () => {
    expect(funnelStageFor('claude_sessions')).toBe('trust');
    expect(funnelStageFor('unknown_source')).toBe('trust');
  });

  it('lets format override source', () => {
    expect(funnelStageFor('breaking_news', 'case study')).toBe('buyers');
    expect(funnelStageFor('calls', 'teardown')).toBe('reach');
  });
});

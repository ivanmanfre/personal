// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import PostReviewTags from './PostReviewTags';
afterEach(cleanup);
it.each([['reach', 'Reach · TOFU'], ['trust', 'Trust · MOFU'], ['buyers', 'Buyers · BOFU']])('shows %s with actual topic and creative style', (stage, label) => {
  render(<PostReviewTags item={{ funnel_stage: stage, topic_label: 'AI shopping', creative_style: 'Animated explainer' }} />);
  const tags = screen.getByLabelText('Post metadata');
  expect(tags.textContent).toContain(`Audience: ${label}`);
  expect(tags.textContent).toContain('Topic: AI shopping');
  expect(tags.textContent).toContain('Style: Animated explainer');
});
it('leaves legacy empty metadata unchanged even with its original funnel stage', () => {
  const view = render(<PostReviewTags item={{ funnel_stage: 'reach' }} />);
  expect(view.container.innerHTML).toBe('');
  view.rerender(<PostReviewTags item={{ topic_label: ' ', creative_style: '' }} />);
  expect(view.container.innerHTML).toBe('');
});
it('does not invent an audience or a missing topic', () => {
  render(<PostReviewTags item={{ funnel_stage: 'unknown', creative_style: 'Diagnostic framework' }} />);
  expect(screen.getByLabelText('Post metadata').textContent).toBe('Style: Diagnostic framework');
});

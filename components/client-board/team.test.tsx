// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { ApprovedBy, BoardTeamProvider, PostComments, actorLabel, memberName, setBoardViewer, type BoardTeamValue } from './team';

const base = (over: Partial<BoardTeamValue> = {}): BoardTeamValue => ({
  me: 'lyndsay@swishdm.com', comments: [], approvalMeta: {}, canComment: true,
  addComment: vi.fn().mockResolvedValue({ ok: true }), ...over,
});

describe('board team attribution', () => {
  afterEach(() => { cleanup(); setBoardViewer(''); });

  it('names members from their email and keeps operators unnamed', () => {
    expect(memberName('lyndsay@swishdm.com')).toBe('Lyndsay');
    expect(memberName('zeke.daldy@swishdm.com')).toBe('Zeke Daldy');
    expect(memberName('test+swish@acme.com')).toBe('Test');
    expect(memberName('im@ivanmanfredi.com')).toBeNull();
    expect(memberName('board link')).toBeNull();
    setBoardViewer('john@swishdm.com');
    expect(actorLabel('john@swishdm.com')).toBe('You');
    expect(actorLabel('leah@swishdm.com')).toBe('Leah');
  });

  it('shows who approved and when, only with a receipt', () => {
    const r = render(<BoardTeamProvider value={base({ approvalMeta: { p1: { by: 'leah@swishdm.com', at: '2026-10-14T13:02:00Z' } } })}>
      <ApprovedBy refId="p1" /><ApprovedBy refId="p2" />
    </BoardTeamProvider>);
    const labels = r.container.querySelectorAll('[data-approved-by]');
    expect(labels.length).toBe(1);
    expect(labels[0].textContent).toMatch(/^Approved by Leah, /);
  });

  it('threads comments per post and posts a new one as the member', async () => {
    const value = base({ comments: [
      { id: 'c1', ref: 'p1', at: '2026-10-14T10:00:00Z', by: 'john@swishdm.com', text: 'Shorter hook?', parent: null },
      { id: 'c2', ref: 'p1', at: '2026-10-14T10:05:00Z', by: 'im@ivanmanfredi.com', text: 'On it.', parent: 'c1' },
      { id: 'c3', ref: 'p2', at: '2026-10-14T10:06:00Z', by: 'leah@swishdm.com', text: 'Other post', parent: null },
    ] });
    const r = render(<BoardTeamProvider value={value}><PostComments refId="p1" /></BoardTeamProvider>);
    const text = r.container.textContent || '';
    expect(text).toContain('Comments (2)');
    expect(text).toContain('John');
    expect(text).toContain('john@swishdm.com');
    expect(text).toContain('InboundOnSteroids');
    expect(text).not.toContain('im@ivanmanfredi.com');
    expect(text).not.toContain('Other post');
    fireEvent.change(r.getByLabelText('Add a comment'), { target: { value: 'Love it' } });
    fireEvent.click(r.getByRole('button', { name: 'Comment' }));
    await waitFor(() => expect(value.addComment).toHaveBeenCalledWith('p1', 'Love it', null));
  });

  it('asks the board-link visitor to sign in before commenting', () => {
    const r = render(<BoardTeamProvider value={base({ canComment: false })}><PostComments refId="p1" /></BoardTeamProvider>);
    expect(r.queryByLabelText('Add a comment')).toBeNull();
    expect(r.container.textContent).toContain('Sign in with your email to comment');
  });

  it('renders nothing without the provider (preview boards)', () => {
    const r = render(<PostComments refId="p1" />);
    expect(r.container.innerHTML).toBe('');
  });
});

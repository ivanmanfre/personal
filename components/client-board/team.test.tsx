// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { ApprovedBy, BoardTeamProvider, PostComments, actorLabel, authorParts, isOperatorEmail, memberName, setBoardHouse, setBoardNames, setBoardRoles, setBoardViewer, type BoardTeamValue } from './team';
import { boardCanonicalUrl, boardShareUrl, isWhiteLabelBoard } from '../../lib/boardHost';

const base = (over: Partial<BoardTeamValue> = {}): BoardTeamValue => ({
  me: 'lyndsay@swishdm.com', comments: [], approvalMeta: {}, canComment: true, canApprove: true,
  addComment: vi.fn().mockResolvedValue({ ok: true }), ...over,
});

describe('board team attribution', () => {
  afterEach(() => { cleanup(); setBoardViewer(''); setBoardNames({}); setBoardRoles({}); });

  it('prefers the name the team gave over the one guessed from the email', () => {
    setBoardNames({ 'zd@swishdm.com': 'Zeke Daldy' });
    expect(memberName('zd@swishdm.com')).toBe('Zeke');
    expect(memberName('lyndsay@swishdm.com')).toBe('Lyndsay');
  });

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
    expect(labels[0].textContent).toMatch(/^Approved by Leah · /);
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

  it('white-label boards name no operator agency', () => {
    expect(isWhiteLabelBoard('swishdm-live')).toBe(true);
    expect(isWhiteLabelBoard('risedtc-com')).toBe(false);
    expect(boardShareUrl('swishdm-live')).toBe('https://madebyswishdm.com/board');
    expect(isWhiteLabelBoard('arch-agency')).toBe(true);
    expect(boardShareUrl('arch-agency')).toBe('https://madebyarch.com/board');
    expect(boardCanonicalUrl('arch-agency')).toBe('https://madebyarch.com/board');
    expect(boardCanonicalUrl('risedtc-com')).toBe('https://ivanmanfredi.com/client/risedtc-com');
    expect(boardShareUrl('risedtc-com')).toBe('https://inboundonsteroids.com/client/risedtc-com');
    expect(isOperatorEmail('im@ivanmanfredi.com')).toBe(true);
    expect(isOperatorEmail('john@swishdm.com')).toBe(false);
    setBoardHouse(true);
    try {
      const value = base({
        comments: [{ id: 'c2', ref: 'p1', at: '2026-10-14T10:05:00Z', by: 'im@ivanmanfredi.com', text: 'On it.', parent: null }],
        approvalMeta: { p1: { by: 'im@ivanmanfredi.com', at: '2026-10-14T13:02:00Z' } },
      });
      const r = render(<BoardTeamProvider value={value}><ApprovedBy refId="p1" /><PostComments refId="p1" /><PostComments refId="p9" /></BoardTeamProvider>);
      const text = r.container.textContent || '';
      expect(text).toContain('Approved by Content team');
      expect(text).toContain('Everyone on this board sees what you write here.');
      expect(text).not.toMatch(/InboundOnSteroids|ivanmanfredi|Ivan/);
      cleanup();
      // Once the team list names our member, comments and sign-offs carry that person's name.
      setBoardNames({ 'im@ivanmanfredi.com': 'Ivan Manfredi' });
      const r2 = render(<BoardTeamProvider value={value}><ApprovedBy refId="p1" /><PostComments refId="p1" /></BoardTeamProvider>);
      const t2 = r2.container.textContent || '';
      expect(t2).toMatch(/Approved by Ivan · /);
      expect(r2.container.querySelector('[data-comment-author]')?.textContent).toBe('Ivan Manfredi');
      expect(r2.container.querySelector('[data-comment-role]')?.textContent).toBe('Content team');
      expect(t2).not.toMatch(/InboundOnSteroids|ivanmanfredi\.com/);
    } finally { setBoardHouse(false); }
  });

  it('names every comment author with their role, and never invents one', () => {
    setBoardNames({ 'john@swishdm.com': 'Jonathan Kiekbusch' });
    setBoardRoles({ 'john@swishdm.com': 'admin', 'lyndsay@swishdm.com': 'viewer' });
    expect(authorParts('john@swishdm.com')).toEqual({ name: 'Jonathan Kiekbusch', tag: 'Admin', email: 'john@swishdm.com' });
    expect(authorParts('lyndsay@swishdm.com').tag).toBe('Viewer');
    expect(authorParts(null).name).toBe('Unknown');
    expect(authorParts('').name).toBe('Unknown');
    expect(authorParts('board link')).toEqual({ name: 'Board link', tag: 'not signed in', email: null });
    const value = base({ comments: [
      { id: 'c1', ref: 'p1', at: '2026-10-14T10:00:00Z', by: 'john@swishdm.com', text: 'Shorter hook?', parent: null },
      { id: 'c2', ref: 'p1', at: '2026-10-14T10:05:00Z', by: null, text: 'Old note', parent: null },
    ], approvalMeta: { p1: { by: null, at: '2026-10-14T13:02:00Z' }, p2: { by: 'board link', at: '2026-10-14T13:02:00Z' } } });
    const r = render(<BoardTeamProvider value={value}><PostComments refId="p1" /><ApprovedBy refId="p1" /><ApprovedBy refId="p2" /></BoardTeamProvider>);
    const authors = Array.from(r.container.querySelectorAll('[data-comment-author]')).map((n) => n.textContent);
    expect(authors).toEqual(['Jonathan Kiekbusch', 'Unknown']);
    const approvals = Array.from(r.container.querySelectorAll('[data-approved-by]')).map((n) => n.textContent || '');
    expect(approvals[0]).toMatch(/^Approved by Unknown · /);
    expect(approvals[1]).toMatch(/^Approved via the board link \(not signed in\) · /);
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

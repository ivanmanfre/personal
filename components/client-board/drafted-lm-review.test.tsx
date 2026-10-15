// @vitest-environment jsdom
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { LmDetailDrawer, type Board, type LeadMagnetEntry } from '../ClientBoardPage';
import DeskLeadMagnetsSurface from './DeskLeadMagnetsSurface';

const entry: LeadMagnetEntry = { id: 'report', title: 'AI Buyer Comparison Report', format: 'report_card', status: 'drafted', url: 'https://madebyswishdm.com/ai-buyer-scan/', promo: { announcement: 'Exact approved draft copy.' } };
const board = { company_name: 'SwishDM', queue: [], lead_magnets: [entry] } as Board;
describe('Draft lead-magnet review', () => {
  it('offers review from the existing Lead magnets tab without adding a live count', () => {
    const html = renderToStaticMarkup(<DeskLeadMagnetsSurface board={board} accent="#FC5B06" mint="#0668FC" fontStack="Lato" live />);
    expect(html).toContain('Review lead magnet');
    expect(html).toContain('Page drafted');
    expect(html).toContain('No lead magnets live yet');
  });
  it('shows the preview link and authored launch copy with review status', () => {
    const html = renderToStaticMarkup(<LmDetailDrawer entry={entry} board={board} accent="#FC5B06" mint="#0668FC" fontStack="Lato" live onClose={() => {}} />);
    expect(html).toContain('For review');
    expect(html).toContain('href="https://madebyswishdm.com/ai-buyer-scan/"');
    expect(html).toContain('Exact approved draft copy.');
    expect(html).not.toContain('capture on');
  });
});

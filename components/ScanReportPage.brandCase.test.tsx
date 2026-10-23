import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useScan } from '../hooks/useScan';
import { useMetadata } from '../hooks/useMetadata';
import type { Scan } from '../lib/scanTypes';
import ScanReportPage from './ScanReportPage';

vi.mock('../hooks/useScan', () => ({ useScan: vi.fn() }));
vi.mock('../hooks/useMetadata', () => ({ useMetadata: vi.fn() }));
vi.mock('./ScanWalkthroughVideo', () => ({ default: () => null }));

describe('DTC scan brand spelling', () => {
  it('passes the saved uppercase brand through the report route to metadata, hero and close', () => {
    const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'dev/scanlab/yananails-standard.json'), 'utf8'));
    const scan = {
      company_name: 'LMNT',
      company_slug: 'brand-case',
      domain: fixture.domain,
      matched_offer: 'dtc_growth',
      status: 'complete',
      created_at: '2026-10-23T00:00:00Z',
      report_json: { matched_offer: 'dtc_growth', dtc: fixture.dtc },
    } as Scan;
    vi.mocked(useScan).mockReturnValue({ scan, loading: false, error: null } as ReturnType<typeof useScan>);

    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/scan/brand-case']}>
        <Routes><Route path="/scan/:slug" element={<ScanReportPage />} /></Routes>
      </MemoryRouter>,
    );

    expect(html).toContain('>LMNT</h1>');
    expect(html).toContain('Let’s RISE LMNT');
    expect(vi.mocked(useMetadata)).toHaveBeenCalledWith(expect.objectContaining({
      title: expect.stringMatching(/^LMNT: /),
      description: expect.stringContaining("LMNT's public storefront"),
    }));
  });
});

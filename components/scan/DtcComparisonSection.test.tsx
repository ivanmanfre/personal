// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { DtcComparisonSection } from './DtcComparisonSection';
import { useDtcComparisonVisibility, validComparison } from '../../hooks/useDtcComparisonVisibility';
import type { DtcComparisonV1 } from '../../lib/dtcComparisonTypes';

const rpc = vi.fn();
vi.mock('../../lib/supabase', () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) } }));
const revision = '11111111-1111-4111-8111-111111111111';
const future = '2099-01-01T00:00:00Z';
const sample = (count = 1): DtcComparisonV1 => ({
  version: 'dtc-comparison-v1', revision_id: revision, base_fingerprint: 'base-a',
  observed_at: '2026-10-09T10:00:00Z', expires_at: future, status: 'approved',
  observations: Array.from({ length: count }, (_, i) => ({
    id: `obs-${i + 1}`, title: 'Selection guidance differs', capability: 'selection_help',
    relationship: 'close_alternative', store_names: { prospect: 'Own Store', peer: 'Peer Store' },
    store_domains: { prospect: 'own.example', peer: 'peer.example' },
    store_entity_ids: { prospect: 'own-entity', peer: 'peer-entity' },
    why_relevant: 'Both address the same shopper question.', own_observation: 'A size chart is visible.',
    peer_observation: 'The peer offers a guided selector.', proposed_test: 'Test a guide beside the size chart.',
    source_links: [
      { url: 'https://www.facebook.com/ads/library/?id=1', entity_id: 'own-entity', checked_at: '2026-10-09T10:00:00Z' },
      { url: 'https://www.facebook.com/ads/library/?id=2', entity_id: 'peer-entity', checked_at: '2026-10-09T10:00:00Z' },
    ], limitations: 'Sampled public ads only.',
  })),
});
function Harness({ comparison = sample(), slug = 'store' }: { comparison?: unknown; slug?: string }) {
  return <><h1>Base report</h1><DtcComparisonSection comparison={useDtcComparisonVisibility(slug, comparison)} /></>;
}
afterEach(() => { cleanup(); rpc.mockReset(); vi.useRealTimers(); });

describe('DTC comparison public section', () => {
  it('renders zero, one and two observations adaptively, with side-bound links and revision attributes', async () => {
    rpc.mockResolvedValue({ data: [{ displayable: true, revision_id_out: revision, expires_at: future }], error: null });
    const page = render(<Harness comparison={null} />);
    expect(page.container.querySelector('[data-comparison-revision]')).toBeNull();
    page.rerender(<Harness comparison={sample(1)} />);
    await waitFor(() => expect(page.container.querySelectorAll('[data-comparison-observation]')).toHaveLength(1));
    expect(page.container.querySelector('[data-comparison-revision]')?.getAttribute('data-comparison-revision')).toBe(revision);
    expect(page.container.querySelector('[data-comparison-source="prospect"]')?.getAttribute('href')).toContain('id=1');
    expect(page.container.querySelector('[data-comparison-source="peer"]')?.getAttribute('href')).toContain('id=2');
    page.rerender(<Harness comparison={sample(2)} />);
    await waitFor(() => expect(page.container.querySelectorAll('[data-comparison-observation]')).toHaveLength(2));
    expect(screen.getAllByText('Worth testing')).toHaveLength(2);
  });

  it('fails closed for malformed, expired and held payloads', () => {
    expect(validComparison(sample(0))).toBe(false);
    expect(validComparison(sample(3))).toBe(false);
    expect(validComparison({ ...sample(), status: 'held' })).toBe(false);
    expect(validComparison({ ...sample(), expires_at: '2020-01-01T00:00:00Z' })).toBe(false);
    const noIds = sample(); delete (noIds.observations[0] as any).store_entity_ids;
    expect(validComparison(noIds)).toBe(false);
    const wrongSide = sample(); wrongSide.observations[0].source_links[1].entity_id = 'third';
    expect(validComparison(wrongSide)).toBe(false);
    const parity = sample(); (parity.observations[0] as any).relationship = 'parity';
    expect(validComparison(parity)).toBe(false);
    const noCapability = sample(); delete (noCapability.observations[0] as any).capability;
    expect(validComparison(noCapability)).toBe(false);
    const numericCapability = sample(); (numericCapability.observations[0] as any).capability = 42;
    expect(validComparison(numericCapability)).toBe(false);
    const objectLabel = sample(); (objectLabel.observations[0].source_links[0] as any).label = { bad: true };
    expect(validComparison(objectLabel)).toBe(false);
  });

  it('keeps the base report intact when malformed capability or source label reaches the renderer', () => {
    for (const mutate of [
      (c: DtcComparisonV1) => { delete (c.observations[0] as any).capability; },
      (c: DtcComparisonV1) => { (c.observations[0] as any).capability = 42; },
      (c: DtcComparisonV1) => { (c.observations[0].source_links[0] as any).label = { bad: true }; },
    ]) {
      const comparison = sample(); mutate(comparison);
      const page = render(<Harness comparison={comparison} />);
      expect(screen.getByText('Base report')).toBeTruthy();
      expect(page.container.querySelector('[data-comparison-revision]')).toBeNull();
      page.unmount();
      expect(render(<DtcComparisonSection comparison={comparison} />).container.firstChild).toBeNull();
      cleanup();
    }
    const valid = sample(); valid.observations[0].source_links[0].label = 'View official source';
    expect(validComparison(valid)).toBe(true);
    expect(render(<DtcComparisonSection comparison={valid} />).container.textContent).toContain('View official source');
  });

  it('keeps the base report visible on RPC denial or failure, and rejects a mismatched revision', async () => {
    for (const reply of [
      { data: null, error: Error('blocked') },
      { data: [{ displayable: false, revision_id_out: revision, expires_at: future }], error: null },
      { data: [{ displayable: true, revision_id_out: '22222222-2222-4222-8222-222222222222', expires_at: future }], error: null },
    ]) {
      rpc.mockResolvedValueOnce(reply);
      const page = render(<Harness />);
      await waitFor(() => expect(rpc).toHaveBeenCalled());
      expect(screen.getByText('Base report')).toBeTruthy();
      expect(page.container.querySelector('[data-comparison-revision]')).toBeNull();
      page.unmount(); rpc.mockClear();
    }
  });

  it('keeps the base report visible when the visibility RPC never resolves', async () => {
    rpc.mockImplementation(() => new Promise(() => {}));
    const page = render(<Harness />);
    await new Promise(resolve => setTimeout(resolve, 80));
    expect(screen.getByText('Base report')).toBeTruthy();
    expect(page.container.querySelector('[data-comparison-revision]')).toBeNull();
  });

  it('ignores a superseded RPC response', async () => {
    let resolveOld!: (value: unknown) => void;
    rpc.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
    rpc.mockResolvedValue({ data: [{ displayable: false, revision_id_out: revision, expires_at: future }], error: null });
    const page = render(<Harness />);
    const next = { ...sample(), revision_id: '22222222-2222-4222-8222-222222222222' };
    page.rerender(<Harness comparison={next} slug="new-store" />);
    await act(async () => resolveOld({ data: [{ displayable: true, revision_id_out: revision, expires_at: future }], error: null }));
    expect(page.container.querySelector('[data-comparison-revision]')).toBeNull();
  });

  it('hides locally when an approved comparison expires without another RPC', async () => {
    const soon = new Date(Date.now() + 120).toISOString();
    rpc.mockResolvedValue({ data: [{ displayable: true, revision_id_out: revision, expires_at: soon }], error: null });
    const c = { ...sample(), expires_at: soon };
    const page = render(<Harness comparison={c} />);
    await waitFor(() => expect(page.container.querySelector('[data-comparison-revision]')).not.toBeNull());
    await waitFor(() => expect(page.container.querySelector('[data-comparison-revision]')).toBeNull(), { timeout: 1000 });
    expect(screen.getByText('Base report')).toBeTruthy();
  });

  it('wraps very long names and drops missing images without an empty image slot', () => {
    const c = sample(); c.observations[0].store_names.peer = 'Very long category peer name '.repeat(5);
    const html = render(<DtcComparisonSection comparison={c} />).container;
    expect(html.textContent).toContain(c.observations[0].store_names.peer);
    expect(html.querySelector('.rise-comparison-images')).toBeNull();
  });
});

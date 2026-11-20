// @vitest-environment jsdom
import React from 'react';
import {describe, it, expect, afterEach} from 'vitest';
import {render, screen, cleanup} from '@testing-library/react';
import {OfferBlock} from './OfferBlock';
import {OFFER, OFFER_SHORT, TEAM} from './copy';
afterEach(cleanup);

describe('OfferBlock', () => {
 it('shows the three lines and the price', () => {
  render(<OfferBlock slug="marta-quillfeather-fx1" shape="fast"/>);
  for (const t of [OFFER.run.text, OFFER.you.text, OFFER.start.text, OFFER.price]) expect(screen.getByText(t)).toBeTruthy();
  for (const t of [OFFER.run.label, OFFER.you.label, OFFER.start.label]) expect(screen.getByText(t)).toBeTruthy();
 });
 it('the share link appears for larger firms only', () => {
  render(<OfferBlock slug="marta-quillfeather-fx1" shape="fast"/>);
  expect(screen.queryByText(TEAM.share)).toBeNull();
  cleanup();
  render(<OfferBlock slug="marta-quillfeather-fx1" shape="considered"/>);
  expect(screen.getByText(TEAM.share)).toBeTruthy();
 });
 it('the share link points at /scan/<slug>/team/', () => {
  render(<OfferBlock slug="marta-quillfeather-fx1" shape="considered"/>);
  expect(screen.getByText(TEAM.share).closest('a')!.getAttribute('href')).toBe('/scan/marta-quillfeather-fx1/team/');
 });
 it('the compact form shows the three short lines and the same price', () => {
  const {container} = render(<OfferBlock slug="marta-quillfeather-fx1" shape="fast" compact/>);
  for (const t of [OFFER_SHORT.run.text, OFFER_SHORT.you.text, OFFER_SHORT.start.text, OFFER.price]) expect(screen.getByText(t)).toBeTruthy();
  expect(container.querySelectorAll('dd')).toHaveLength(3);
  expect(container.querySelector('section')!.classList.contains('is-compact')).toBe(true);
  expect(OFFER_SHORT.start.text.length).toBeLessThan(OFFER.start.text.length);
 });
 it('carries the section hook', () => {
  const {container} = render(<OfferBlock slug="x" shape="fast"/>);
  expect(container.querySelector('section')!.getAttribute('data-scan-section')).toBe('offer');
  expect(container.querySelector('section')!.id).toBe('offer');
 });
});

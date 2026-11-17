// @vitest-environment jsdom
import React from 'react';
import {describe, it, expect, afterEach} from 'vitest';
import {render, screen, cleanup} from '@testing-library/react';
afterEach(cleanup);
import {HeroBuyer} from './HeroBuyer';
import {heroFixture, richHero, janna} from './__fixtures__/heroFixture';
import {BRAND_SUB} from './copy';

describe('HeroBuyer', () => {
 it('renders the buyer sentence as the h1', () => {
  render(<HeroBuyer fixture={heroFixture(richHero)}/>);
  expect(screen.getByRole('heading', {level: 1}).textContent).toBe('Janna Dougherty, Head of Growth at Thanks.co, commented on a post by Acceleration Partners on 10 Nov.');
 });
 it("keeps Ivan's line word for word", () => {
  render(<HeroBuyer fixture={heroFixture(richHero)}/>);
  const line = screen.getByText('Make your LinkedIn into a true revenue line.');
  expect(line.tagName).not.toBe('H1');
 });
 it('the name links to the profile and opens in a new tab', () => {
  render(<HeroBuyer fixture={heroFixture(richHero)}/>);
  const links = screen.getAllByRole('link', {name: /Janna Dougherty/});
  expect(links.length).toBeGreaterThan(0);
  for (const a of links) { expect(a.getAttribute('href')).toBe(janna.profileUrl); expect(a.getAttribute('rel')).toContain('noreferrer'); expect(a.getAttribute('target')).toBe('_blank'); }
 });
 it('no link when the read gave none', () => {
  const lead = {...janna, profileUrl: undefined};
  const {container} = render(<HeroBuyer fixture={heroFixture({...richHero, lead, rows: [lead]})}/>);
  expect([...container.querySelectorAll('a')].some(a => a.textContent?.includes('Janna Dougherty'))).toBe(false);
 });
 it('no count line below 2', () => {
  const {container} = render(<HeroBuyer fixture={heroFixture({...richHero, count: {buyers: 3, own: 1, outside: 2, windowDays: 14, authors: ['Barrel']}})}/>);
  expect(screen.queryByText(/more buyers|within reach/)).toBeNull();
  expect([...container.querySelectorAll('*')].some(el => /^\s*\d+\s*$/.test(el.textContent || ''))).toBe(false);
 });
 it('shows the count line when it has one', () => {
  render(<HeroBuyer fixture={heroFixture(richHero)}/>);
  expect(screen.getByText(/27 buyers within reach/)).toBeTruthy();
 });
 it('profile tier', () => {
  const {container} = render(<HeroBuyer fixture={heroFixture({tier: 'profile', rows: [], count: {buyers: 0, own: 0, outside: 0, authors: []}, profile: {quote: 'Building my way out, in public', fix: 'Open with the clinics you sell to.'}})}/>);
  const h1 = screen.getByRole('heading', {level: 1});
  expect(h1.textContent).toBe('Your headline says “Building my way out, in public”.');
  expect(h1.nextElementSibling?.textContent).toContain('Open with the clinics you sell to.');
  expect(container.querySelector('.sv2-rows')).toBeNull();
  expect(screen.getByRole('link', {name: /See the profile changes/}).getAttribute('href')).toBe('#profile');
 });
 it('the sub is not hidden on phone', () => {
  render(<HeroBuyer fixture={heroFixture(richHero)}/>);
  expect(screen.getByText(BRAND_SUB).classList.contains('sp-hero-sub')).toBe(false);
 });
 it('says where the data comes from', () => {
  render(<HeroBuyer fixture={heroFixture(richHero)}/>);
  expect(screen.getByText(/From public likes and comments on LinkedIn/)).toBeTruthy();
 });
 it('rows carry the dated signal, and a See more link on phone', () => {
  const {container} = render(<HeroBuyer fixture={heroFixture(richHero)}/>);
  expect(container.querySelectorAll('.sv2-rows > li')).toHaveLength(3);
  expect(screen.getByText('See 2 more').getAttribute('href')).toBe('#buyers');
  expect(screen.getByText('Liked a post by Acceleration Partners · 8 Nov')).toBeTruthy();
  expect(container.textContent).not.toMatch(/undefined/);
 });
 it('a single row is not repeated under the sentence', () => {
  const {container} = render(<HeroBuyer fixture={heroFixture({...richHero, rows: [janna]})}/>);
  expect(container.querySelector('.sv2-rows')).toBeNull();
 });
});

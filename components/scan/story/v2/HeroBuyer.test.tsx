// @vitest-environment jsdom
import React from 'react';
import {describe, it, expect, afterEach} from 'vitest';
import {render, screen, cleanup} from '@testing-library/react';
afterEach(cleanup);
import {HeroBuyer} from './HeroBuyer';
import {heroFixture, richHero, hollis} from './__fixtures__/heroFixture';
import {BRAND_SUB} from './copy';

describe('HeroBuyer', () => {
 it('renders the buyer sentence as the h1', () => {
  render(<HeroBuyer fixture={heroFixture(richHero)}/>);
  expect(screen.getByRole('heading', {level: 1}).textContent).toBe('Hollis Fernwhistle, Head of Growth at Pebblefold, commented on a post by Brindlemoor Partners on 10 Nov.');
 });
 it("keeps Ivan's line word for word", () => {
  render(<HeroBuyer fixture={heroFixture(richHero)}/>);
  const line = screen.getByText('Make your LinkedIn into a true revenue line.');
  expect(line.tagName).not.toBe('H1');
 });
 it('the name links to the profile and opens in a new tab', () => {
  render(<HeroBuyer fixture={heroFixture(richHero)}/>);
  const links = screen.getAllByRole('link', {name: /Hollis Fernwhistle/});
  expect(links.length).toBeGreaterThan(0);
  // R-LINK: the printed link is the rebuilt canonical URL (trailing slash, no query or fragment).
  for (const a of links) { expect(a.getAttribute('href')).toBe(hollis.profileUrl!.replace(/\/?$/, '/')); expect(a.getAttribute('rel')).toContain('noreferrer'); expect(a.getAttribute('target')).toBe('_blank'); }
 });
 it('no link when the read gave none', () => {
  const lead = {...hollis, profileUrl: undefined};
  const {container} = render(<HeroBuyer fixture={heroFixture({...richHero, lead, rows: [lead]})}/>);
  expect([...container.querySelectorAll('a')].some(a => a.textContent?.includes('Hollis Fernwhistle'))).toBe(false);
 });
 it('no count line below 2', () => {
  const {container} = render(<HeroBuyer fixture={heroFixture({...richHero, count: {buyers: 3, own: 1, outside: 2, windowDays: 14, authors: ['Larchmere Studio']}})}/>);
  expect(screen.queryByText(/more buyers|within reach/)).toBeNull();
  expect([...container.querySelectorAll('*')].some(el => /^\s*\d+\s*$/.test(el.textContent || ''))).toBe(false);
 });
 it('shows the count line when it has one', () => {
  render(<HeroBuyer fixture={heroFixture(richHero)}/>);
  expect(screen.getByText(/27 buyers within reach/)).toBeTruthy();
 });
 it('profile tier', () => {
  const {container} = render(<HeroBuyer fixture={heroFixture({tier: 'profile', rows: [], count: {buyers: 0, own: 0, outside: 0, authors: []}, profile: {quote: 'Writing about clinic bookings, in plain words', fix: 'Open with the clinics you sell to.'}}, {profileAudit: {findings: []}})}/>);
  const h1 = screen.getByRole('heading', {level: 1});
  expect(h1.textContent).toBe('Your headline says “Writing about clinic bookings, in plain words”.');
  expect(h1.nextElementSibling?.textContent).toContain('Open with the clinics you sell to.');
  expect(container.querySelector('.sv2-rows')).toBeNull();
  expect(screen.getByRole('link', {name: /See the profile changes/}).getAttribute('href')).toBe('#profile');
 });
 it('profile tier quotes the first part of a long headline and links on to the offer without an audit', () => {
  render(<HeroBuyer fixture={heroFixture({tier: 'profile', rows: [], count: {buyers: 0, own: 0, outside: 0, authors: []}, profile: {quote: 'Writing about clinic bookings, in plain words | Helping physio clinics fill calendars | Founder, Applewick Clinic Marketing', fix: 'Open with your clinic buyers.'}})}/>);
  expect(screen.getByRole('heading', {level: 1}).textContent).toBe('Your headline says “Writing about clinic bookings, in plain words”.');
  expect(screen.getByRole('link', {name: /See what we run/}).getAttribute('href')).toBe('#offer');
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
  expect(screen.getByText('Liked a post by Brindlemoor Partners · 8 Nov')).toBeTruthy();
  expect(container.textContent).not.toMatch(/undefined/);
 });
 it('a single row is not repeated under the sentence', () => {
  const {container} = render(<HeroBuyer fixture={heroFixture({...richHero, rows: [hollis]})}/>);
  expect(container.querySelector('.sv2-rows')).toBeNull();
 });
});

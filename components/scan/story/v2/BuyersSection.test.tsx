// @vitest-environment jsdom
import React from 'react';
import {describe, it, expect, afterEach} from 'vitest';
import {render, screen, cleanup} from '@testing-library/react';
import './__fixtures__/dom';
import {BuyersSection} from './BuyersSection';
import {heroFixture, richHero, janna} from './__fixtures__/heroFixture';
import type {CompetitorEngagers, JourneyFixture} from '../../../dev/scan-walkthrough/journey/model';
afterEach(cleanup);

const person = (name: string, i: number) => ({name, headline: `Head of Growth at Brand ${i}`, company: `Brand ${i}`, profileUrl: `https://www.linkedin.com/in/p${i}`, reason: 'Runs growth at a brand you sell to.', engaged: (i % 2 ? 'liked' : 'commented') as 'liked' | 'commented', competitor: 'Acceleration Partners', postUrl: `https://www.linkedin.com/posts/ap_${i}`, postExcerpt: '', postedAt: '2026-11-0' + (i % 9 + 1)});
const ce: CompetitorEngagers = {count: 15, windowDays: 14, readOn: '2026-11-12', competitors: ['Acceleration Partners'], postsRead: 9, engagersRead: 348, people: ['Janna Dougherty', 'Brian Garofalow', 'Ana Ruiz', 'Tom Lee', 'Kai Berg', 'Ola Nord', 'Rui Sá'].map(person), notes: [{to: 'Janna Dougherty', headline: 'Head of Growth at Thanks.co', note: 'Saw your comment on creator payback. How do you measure it today?'}]};
const audience = (n: number) => ({engager_icp_count: n, named: [{name: 'Mette Holm', headline: 'COO at Fjord Clinics', role: 'COO at Fjord Clinics'}, {name: 'Lars Vik', headline: 'Founder at Vik Dental'}].slice(0, Math.max(1, Math.min(n, 2))), existing_clients: []}) as unknown as JourneyFixture['audience'];
const fx = (over: Partial<JourneyFixture> = {}, hero = richHero) => heroFixture(hero, {competitorEngagers: ce, audience: audience(12), ...over});

describe('BuyersSection', () => {
 it('shows people checked and passed in one line', () => { render(<BuyersSection fixture={fx()}/>); expect(screen.getByText('348 people checked. 15 passed.')).toBeTruthy(); });
 it('drops the repeated sentence', () => { render(<BuyersSection fixture={fx()}/>); expect(screen.queryByText(/good people to start a conversation with/)).toBeNull(); });
 it('shows the pair for the lead only', () => {
  render(<BuyersSection fixture={fx()}/>);
  expect(screen.getAllByText('On a bought list')).toHaveLength(1);
  expect(screen.getAllByText('What we saw')).toHaveLength(1);
  expect(screen.getByText(/Commented on a post by Acceleration Partners on 10 Nov: “Creator campaigns only pay back when the brand owns the list.”/)).toBeTruthy();
 });
 it('no pair without a post excerpt', () => { render(<BuyersSection fixture={fx({}, {...richHero, lead: {...janna, postExcerpt: ''}})}/>); expect(screen.queryByText('What we saw')).toBeNull(); });
 it('own buyers lead when the hero is an own engager', () => {
  const lead = {...janna, source: 'own' as const, author: undefined};
  const {container} = render(<BuyersSection fixture={fx({}, {...richHero, tier: 'own_engager', lead, rows: [lead]})}/>);
  const heads = [...container.querySelectorAll('h2')].map(h => h.textContent);
  expect(heads.indexOf('Buyers already engaging with you')).toBeLessThan(heads.indexOf('Buyers reading posts in your market'));
  expect(heads.indexOf('Buyers already engaging with you')).toBeGreaterThanOrEqual(0);
 });
 it('outside buyers lead otherwise', () => {
  const {container} = render(<BuyersSection fixture={fx()}/>);
  const heads = [...container.querySelectorAll('h2')].map(h => h.textContent);
  expect(heads.indexOf('Buyers reading posts in your market')).toBeLessThan(heads.indexOf('Buyers already engaging with you'));
 });
 it('one booking moment with the placement', () => {
  const {container} = render(<BuyersSection fixture={fx()}/>);
  const links = [...container.querySelectorAll('a')].filter(a => a.href.includes('utm_content=after-buyers'));
  expect(links).toHaveLength(1);
  expect(links[0].getAttribute('data-scan-click')).toBe('book-after-buyers');
  expect(links[0].getAttribute('target')).toBe('_blank');
 });
 it('a single own buyer shows no numeral', () => {
  const {container} = render(<BuyersSection fixture={fx({audience: audience(1), competitorEngagers: undefined})}/>);
  const own = container.querySelector('[data-part="own"]')!;
  expect(own.textContent).toContain('Mette Holm');
  expect(own.textContent).not.toMatch(/\d/);
 });
 it('lists five then a Show more button, and the drafted note', () => {
  render(<BuyersSection fixture={fx()}/>);
  expect(screen.getByRole('button', {name: 'Show 2 more people'})).toBeTruthy();
  expect(screen.getByText('A first message to Janna')).toBeTruthy();
 });
 it('profile tier with no people renders nothing', () => {
  const {container} = render(<BuyersSection fixture={heroFixture({tier: 'profile', rows: [], count: {buyers: 0, own: 0, outside: 0, authors: []}, profile: {quote: 'q', fix: 'f'}}, {audience: audience(0)})}/>);
  expect(container.innerHTML).toBe('');
 });
 it('section hooks', () => { const {container} = render(<BuyersSection fixture={fx()}/>); const s = container.querySelector('section')!; expect(s.id).toBe('buyers'); expect(s.getAttribute('data-scan-section')).toBe('buyers'); });
});

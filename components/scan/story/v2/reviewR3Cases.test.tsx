// @vitest-environment jsdom
import React from 'react';
import {describe, it, expect, afterEach, vi} from 'vitest';
import {render, cleanup} from '@testing-library/react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import './__fixtures__/dom';
import ScanStoryReport, {useV2} from '../ScanStoryReport';
import {toStoryFixture, parseHero} from '../adapter';
import {validateEdition} from '../validate';
import {profileLink, profileUrlOf, uniqueByProfile} from '../profileLink';
import {hasScanV2, teamSlugs} from '../../../../scripts/scan-hero-switch.mjs';
import {heroSentence} from './hero';
import {signalText} from './HeroBuyer';
import rich from '../../../dev/scanlab/v2-rich.json';

/** The round 3 reviewer's six inputs (2026-11-18), ported to assert the corrected behaviour, plus the R-SIGNAL and
 *  R-LINK tables. Invented people, hosts and ids only. */
const copy = () => JSON.parse(JSON.stringify(rich));
const load = (row: any) => { const f = toStoryFixture(row), {edition} = validateEdition(row.report_json.content_system.story_v1, f, true); return {fixture: f, edition: edition!}; };
const dom = (html: string) => { const d = document.createElement('div'); d.innerHTML = html; return d; };
afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('finding 1: the invented DTC lab fixture shares no URL or id with the file it was copied from', () => {
 const tokens = (path: string) => new Set((readFileSync(new URL(path, import.meta.url), 'utf8').match(/https?:\/\/[^\s"'\\]+|\b\d{10,}\b/g) || []).map(t => t.replace(/[),.;]+$/, '')));
 it('lunanails-story.json vs yananails-story.json: 0 shared URLs or 10+ digit ids', () => {
  const a = tokens('../../../dev/scanlab/lunanails-story.json'), b = tokens('../../../dev/scanlab/yananails-story.json');
  // Kept on purpose: RISE's own public assets (its logo, share image and booking link), which every RISE page carries.
  const RISE_OWN = /^https:\/\/(risedtc\.com\/wp-content\/uploads\/|meetings\.hubspot\.com\/mattan5\/)/;
  expect([...a].filter(t => b.has(t) && !RISE_OWN.test(t))).toEqual([]);
  // No storefront CDN account path, and every ad id is an invented 9000... placeholder.
  expect([...a].filter(t => /cdn\.shopify\.com/.test(t) || /facebook\.com\/ads\/library\/\?id=(?!9000000000000)\d/.test(t))).toEqual([]);
 });
});

describe('finding 2 / R-LINK: one validator for every buyer and partner profile link', () => {
 const TRAVERSAL = 'https://www.linkedin.com/in/../redir/redirect?url=https%3A%2F%2Fattacker.example';
 it('the reviewer\'s traversal URL gives no link anywhere on the new layout, the row still shows', () => {
  vi.stubEnv('VITE_SCAN_HERO', '1');
  const r = copy(), cs = r.report_json.content_system;
  cs.hero.lead.profile_url = TRAVERSAL; cs.competitor_engagers.people[0].profile_url = TRAVERSAL;
  cs.audience.named[0].profile_url = TRAVERSAL;
  const props = load(r);
  expect(props.fixture.hero?.lead?.profileUrl).toBeUndefined();
  expect(props.fixture.competitorEngagers!.uniquePeople![0].profileUrl).toBe('');
  const html = renderToStaticMarkup(<ScanStoryReport {...props}/>), d = dom(html);
  expect(html).not.toMatch(/redir|attacker/);
  const lead = cs.hero.lead.name, first = cs.competitor_engagers.people[0].name;
  expect(d.querySelector('[data-part="outside"] b.sv2-name')?.textContent).toBe(first);
  expect(html).toContain(lead);
  for (const a of d.querySelectorAll<HTMLAnchorElement>('a.sv2-name')) expect(profileLink(a.getAttribute('href'))?.url).toBe(a.getAttribute('href'));
  const team = renderToStaticMarkup(<ScanStoryReport {...props} view="team"/>);
  expect(team).toContain('data-scan-section="team"');
  expect(team).not.toMatch(/redir|attacker/);
 });
 it('switch off: today\'s layout keeps its existing behaviour (the stored engager link, unchanged)', () => {
  vi.stubEnv('VITE_SCAN_HERO', '0');
  const r = copy(); r.report_json.content_system.competitor_engagers.people[0].profile_url = TRAVERSAL;
  const props = load(r);
  expect(props.fixture.competitorEngagers!.people[0].profileUrl).toBe(TRAVERSAL);
  expect(renderToStaticMarkup(<ScanStoryReport {...props}/>)).toContain(`href="${TRAVERSAL.replace(/&/g, '&amp;')}"`);
 });
 const H = 'fixture-jane-quill-000';
 const TABLE: [unknown, string | undefined][] = [
  [`https://www.linkedin.com/in/${H}`, `https://www.linkedin.com/in/${H}/`],
  [`https://www.linkedin.com/in/${H}/`, `https://www.linkedin.com/in/${H}/`],
  [`https://linkedin.com/in/${H}`, `https://linkedin.com/in/${H}/`],
  [TRAVERSAL, undefined],
  ['https://www.linkedin.com/in/%2E%2E/redir/redirect', undefined],
  [`https://www.linkedin.com/in/${H}/../../redir/redirect`, undefined],
  [`https://www.linkedin.com/in/./${H}`, `https://www.linkedin.com/in/${H}/`],
  [`https://www.linkedin.com/in/${H}%2Fredir`, undefined],
  [`https://www.linkedin.com/in/${H}%5Credir`, undefined],
  [`https://www.linkedin.com/in/${H}%2E`, undefined],
  [`https://www.linkedin.com/in/${H}%00`, undefined],
  [`https://www.linkedin.com/in/${H}/detail/recent-activity/`, undefined],
  [`https://www.linkedin.com/in/${H}//`, undefined],
  [`https://www.linkedin.com/in/${H};x=1`, undefined],
  ['https://www.linkedin.com/in/', undefined],
  [`https://evil.example/in/${H}`, undefined],
  [`https://www.linkedin.com.evil.example/in/${H}`, undefined],
  [`https://wwwlinkedin.com/in/${H}`, undefined],
  [`https://www.linkedın.com/in/${H}`, undefined],
  [`https://www.linkedin.com./in/${H}`, undefined],
  [`https://www.linkedin.com@evil.example/in/${H}`, undefined],
  [`https://user:pass@www.linkedin.com/in/${H}`, undefined],
  [`https://user@www.linkedin.com/in/${H}`, undefined],
  [`HTTPS://WWW.LINKEDIN.COM/in/Fixture-Jane-Quill-000`, 'https://www.linkedin.com/in/Fixture-Jane-Quill-000/'],
  [`https://www.linkedin.com/IN/${H}`, undefined],
  ['https://www.linkedin.com/company/fixture-widgets/', undefined],
  ['https://www.linkedin.com/school/fixture-college/', undefined],
  [`https://m.linkedin.com/in/${H}`, undefined],
  [`https://uk.linkedin.com/in/${H}`, `https://uk.linkedin.com/in/${H}/`],
  [`https://de.linkedin.com/in/${H}/?originalSubdomain=de`, `https://de.linkedin.com/in/${H}/`],
  [`https://www2.linkedin.com/in/${H}`, undefined],
  [`https://abc.linkedin.com/in/${H}`, undefined],
  [`https://www.linkedin.com/in/${H}?trk=public_profile#about`, `https://www.linkedin.com/in/${H}/`],
  [`https://www.linkedin.com/in/${H}/?url=https://evil.example`, `https://www.linkedin.com/in/${H}/`],
  [`https://www.linkedin.com:8443/in/${H}`, undefined],
  [`https://www.linkedin.com:443/in/${H}`, `https://www.linkedin.com/in/${H}/`],
  [`http://www.linkedin.com/in/${H}`, undefined],
  [`//www.linkedin.com/in/${H}`, undefined],
  ['javascript:alert(1)//www.linkedin.com/in/x', undefined],
  [`mailto:x@www.linkedin.com`, undefined],
  ['https://www.linkedin.com/redir/redirect?url=https%3A%2F%2Fevil.example', undefined],
  ['https://www.linkedin.com/in/jos%C3%A9-fixture', 'https://www.linkedin.com/in/jos%C3%A9-fixture/'],
  ['https://www.linkedin.com/in/josé-fixture', 'https://www.linkedin.com/in/jos%C3%A9-fixture/'],
  [`  https://www.linkedin.com/in/${H}  `, `https://www.linkedin.com/in/${H}/`],
  [`https://www.linkedin.com\\in\\${H}`, `https://www.linkedin.com/in/${H}/`],
  [42, undefined],
  [null, undefined],
 ];
 it.each(TABLE)('%j -> %s', (input, expected) => {
  expect(profileUrlOf(input)).toBe(expected);
  console.log(`RLINK\t${JSON.stringify(input)}\t${expected ?? 'no link'}`);
 });
});

describe('finding 3 / R-SIGNAL: the sentence says only what the signal says', () => {
 const SOURCES = ['competitor', 'topic', 'own'] as const, HOWS = ['commented', 'liked', 'engaged'] as const;
 const withLead = (source: string, how: string, where: 'lead' | 'row') => {
  const r = copy(), h = r.report_json.content_system.hero;
  if (where === 'lead') { h.lead = {...h.lead, source, how}; h.rows = [h.lead]; } else { h.rows = [h.lead, {...h.rows[1], source, how}]; }
  return r;
 };
 for (const source of SOURCES) for (const how of HOWS) {
  const ok = how !== 'engaged' || source === 'own';
  it(`${source} x ${how}: ${ok ? 'accepted' : 'rejected'}`, () => {
   vi.stubEnv('VITE_SCAN_HERO', '1');
   const r = withLead(source, how, 'lead'), props = load(r), name = r.report_json.content_system.hero.lead.name;
   expect(!!parseHero(r.report_json.content_system.hero)).toBe(ok);
   expect(!!parseHero(withLead(source, how, 'row').report_json.content_system.hero)).toBe(ok);
   const d = dom(renderToStaticMarkup(<ScanStoryReport {...props}/>)), h1 = d.querySelector('h1')!.textContent!;
   const pair = d.querySelector('.sv2-pair .is-seen p')?.textContent ?? '';
   if (!ok) { expect(props.fixture.heroRejected).toBeDefined(); expect(h1).not.toContain(name); expect(d.querySelector('[data-scan-section="hero"]')!.textContent).not.toContain(name); expect(d.querySelector('.sv2-pair')).toBeNull(); }
   else {
    const words = source === 'own' ? {commented: 'commented on your', liked: 'liked your', engaged: 'engages with your posts.'}[how] : {commented: 'commented on a', liked: 'liked a'}[how as 'commented' | 'liked'];
    expect(h1).toContain(words);
    if (how === 'engaged') { expect(h1).not.toMatch(/\d/); expect(pair).toMatch(/^Engages with your posts: /); expect(signalText(props.fixture.hero!.lead!)).toBe('Engages with your posts'); }
    if (how !== 'commented') expect(h1).not.toContain('commented');
    if (how !== 'liked') expect(h1).not.toContain('liked');
   }
   console.log(`RSIGNAL\t${source}\t${how}\t${ok ? 'accepted' : 'rejected'}\t${ok ? h1 : '(plain first screen) ' + h1}`);
  });
 }
 it('the reviewer\'s input: competitor + engaged is rejected and nothing says "commented on"', () => {
  vi.stubEnv('VITE_SCAN_HERO', '1');
  const r = copy(); r.report_json.content_system.hero.lead.how = 'engaged';
  const props = load(r);
  expect(props.fixture.hero).toBeUndefined();
  expect(props.fixture.heroRejected).toBeDefined();
  const d = dom(renderToStaticMarkup(<ScanStoryReport {...props}/>));
  expect(d.querySelector('h1')!.textContent).not.toContain('commented on');
  expect(d.querySelector('[data-scan-section="hero"]')!.textContent).not.toContain(r.report_json.content_system.hero.lead.name);
  expect(d.querySelector('.sv2-pair')).toBeNull();
 });
 it('heroSentence: own + engaged ignores any date', () => {
  expect(heroSentence({name: 'Fixture Person', role: 'CMO', headline: '', source: 'own', how: 'engaged', postExcerpt: '', reason: '', date: '2026-11-10'})).toBe('Fixture Person, CMO, engages with your posts.');
 });
});

describe('finding 4: one predicate decides the partner page, for the app and the prerender', () => {
 const SHAPES: [string, unknown][] = [['absent', undefined], ['null', null], ['valid', 'VALID'], ['{v:2}', {v: 2}], ['{}', {}], ['[]', []], ['"hero"', 'hero'], ['0', 0], ['false', false], ['""', '']];
 for (const flag of [undefined, '0', '1']) for (const [label, shape] of SHAPES) {
  it(`switch ${flag ?? 'unset'}, hero ${label}`, () => {
   if (flag !== undefined) vi.stubEnv('VITE_SCAN_HERO', flag);
   const r = copy(), cs = r.report_json.content_system;
   if (label === 'absent') delete cs.hero; else if (shape !== 'VALID') cs.hero = shape;
   const raw = cs.hero, props = load(r);
   const app = useV2(props.fixture), pre = teamSlugs([{company_slug: r.company_slug, hero: raw}], flag).length === 1;
   expect(app).toBe(pre);
   expect(pre).toBe(hasScanV2(flag, raw));
   expect(pre).toBe(flag === '1' && label !== 'absent' && label !== 'null');
   expect(renderToStaticMarkup(<ScanStoryReport {...props} view="team"/>).includes('data-scan-section="team"')).toBe(pre);
  });
 }
 it('teamSlugs keeps only rows with a slug and a present hero', () => {
  expect(teamSlugs([{company_slug: 'a', hero: {v: 1}}, {company_slug: 'b', hero: null}, {company_slug: 'c'}, {company_slug: '', hero: {}}, null, {company_slug: 'd', hero: []}], '1')).toEqual(['a', 'd']);
  expect(teamSlugs([{company_slug: 'a', hero: {v: 1}}], '0')).toEqual([]);
  expect(teamSlugs('not rows', '1')).toEqual([]);
 });
});

describe('finding 5: one row per person in the buyers list', () => {
 it('the reviewer\'s input: same profile on two rows gives 14 rows and "Show 9 more people"', () => {
  vi.stubEnv('VITE_SCAN_HERO', '1');
  const r = copy(), ce = r.report_json.content_system.competitor_engagers;
  ce.people[6] = {...ce.people[0], post_url: 'https://www.linkedin.com/posts/fixture-second-post'};
  const d = dom(renderToStaticMarkup(<ScanStoryReport {...load(r)}/>));
  const links = [...d.querySelectorAll('[data-part="outside"] .sv2-name')].map(a => a.getAttribute('href'));
  expect(links).toHaveLength(14);
  expect(new Set(links).size).toBe(14);
  expect(d.querySelector('summary .sv2-show-closed')?.textContent).toBe('Show 9 more people');
 });
 it('dedup runs before the cap: a 16th person moves up when a duplicate leaves', () => {
  vi.stubEnv('VITE_SCAN_HERO', '1');
  const r = copy(), ce = r.report_json.content_system.competitor_engagers;
  ce.people.push({...ce.people[1], name: 'Fixture Sixteenth', profile_url: 'https://www.linkedin.com/in/fixture-sixteenth-000'});
  ce.people[6] = {...ce.people[0], profile_url: ce.people[0].profile_url.replace('https://www.', 'https://uk.').toUpperCase().replace('HTTPS://UK.LINKEDIN.COM/IN/', 'https://uk.linkedin.com/in/') + '?trk=x'};
  const f = load(r).fixture, names = f.competitorEngagers!.uniquePeople!.map(p => p.name);
  expect(names).toHaveLength(15);
  expect(names).toContain('Fixture Sixteenth');
  expect(names.filter(n => n === ce.people[0].name)).toHaveLength(1);
 });
 it('rows without a valid profile link are never merged with each other', () => {
  const rows = [{u: 'https://evil.example/in/a'}, {u: 'https://evil.example/in/a'}, {u: undefined}, {u: undefined}, {u: 'https://www.linkedin.com/in/fixture-a'}, {u: 'https://de.linkedin.com/in/FIXTURE-A/'}];
  expect(uniqueByProfile(rows, r => r.u)).toHaveLength(5);
 });
 it('switch off: today\'s layout still prints every stored row', () => {
  vi.stubEnv('VITE_SCAN_HERO', '0');
  const r = copy(), ce = r.report_json.content_system.competitor_engagers;
  ce.people[6] = {...ce.people[0], post_url: 'https://www.linkedin.com/posts/fixture-second-post'};
  const f = load(r).fixture;
  expect(f.competitorEngagers!.people).toHaveLength(15);
  expect(f.competitorEngagers!.people[6].profileUrl).toBe(f.competitorEngagers!.people[0].profileUrl);
  expect(renderToStaticMarkup(<ScanStoryReport {...load(r)}/>)).not.toContain('sv2-');
 });
});

describe('finding 6: print captures the disclosure state once', () => {
 it('beforeprint, beforeprint, afterprint restores every closed disclosure', () => {
  vi.stubEnv('VITE_SCAN_HERO', '1');
  const {container} = render(<ScanStoryReport {...load(copy())}/>);
  const ds = [...container.querySelectorAll('details')], states = () => ds.map(d => d.open);
  expect(ds.length).toBeGreaterThan(1);
  ds[1].open = true;
  const before = states();
  window.dispatchEvent(new Event('beforeprint'));
  expect(states().every(Boolean)).toBe(true);
  window.dispatchEvent(new Event('beforeprint'));
  window.dispatchEvent(new Event('afterprint'));
  expect(states()).toEqual(before);
  window.dispatchEvent(new Event('afterprint'));
  expect(states()).toEqual(before);
 });
});

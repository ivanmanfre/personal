import type {JourneyFixture, HeroRow, ScanHero} from '../../../../dev/scan-walkthrough/journey/model';

/** Test fixtures shaped like the stored interface. Names are the real saved ones from the round 2 evidence. */
export const janna: HeroRow = {name: 'Janna Dougherty', role: 'Head of Growth at Thanks.co', headline: 'Head of Growth at Thanks.co | Creator partnerships', profileUrl: 'https://www.linkedin.com/in/janna-dougherty', source: 'competitor', how: 'commented', author: 'Acceleration Partners', postUrl: 'https://www.linkedin.com/posts/acceleration-partners_123', postExcerpt: 'Creator campaigns only pay back when the brand owns the list.', date: '2026-11-10', dateKind: 'comment', reason: 'Leads growth at a consumer brand.'};
export const second: HeroRow = {...janna, name: 'Brian Garofalow', role: 'CMO at Vessi', profileUrl: 'https://www.linkedin.com/in/brian-g', how: 'liked', date: '2026-11-08', dateKind: 'post', postExcerpt: ''};
export const third: HeroRow = {...janna, name: 'Natasha T.', role: 'Partnerships at Circle', profileUrl: undefined, postUrl: undefined, date: undefined, dateKind: undefined, postExcerpt: ''};

export function heroFixture(hero: ScanHero | undefined, over: Partial<JourneyFixture> = {}): JourneyFixture {
 return {
  slug: 'fabio-soprano-c2', domain: 'example.com',
  founder: {name: 'Fabio Soprano', firstName: 'Fabio', company: 'Soprano Studio', headline: 'Founder'},
  buyer: {role: 'Head of Growth', project: ''}, samples: {} as JourneyFixture['samples'], lm_cover_local: '',
  source: {kind: 'original-scan', url: '', capturedOn: '2026-11-12'},
  firm: {band: 'unknown'},
  ...(hero ? {hero} : {}),
  ...over,
 } as JourneyFixture;
}
export const richHero: ScanHero = {tier: 'competitor_commenter', lead: janna, rows: [janna, second, third], count: {buyers: 27, own: 12, outside: 15, windowDays: 14, authors: ['Acceleration Partners', 'NeoReach']}, checked: {people: 348, passed: 15}};

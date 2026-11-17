import type {JourneyFixture, HeroRow, ScanHero} from '../../../../dev/scan-walkthrough/journey/model';

/** Test fixtures shaped like the stored interface. Names are the real saved ones from the round 2 evidence. */
export const hollis: HeroRow = {name: 'Hollis Fernwhistle', role: 'Head of Growth at Pebblefold', headline: 'Head of Growth at Pebblefold | Creator partnerships', profileUrl: 'https://www.linkedin.com/in/hollis-fernwhistle', source: 'competitor', how: 'commented', author: 'Brindlemoor Partners', postUrl: 'https://www.linkedin.com/posts/brindlemoor-partners_123', postExcerpt: 'Creator campaigns only pay back when the brand owns the list.', date: '2026-11-10', dateKind: 'comment', reason: 'Leads growth at a consumer brand.'};
export const second: HeroRow = {...hollis, name: 'Corin Mossbury', role: 'CMO at Kettlewick', profileUrl: 'https://www.linkedin.com/in/corin-m', how: 'liked', date: '2026-11-08', dateKind: 'post', postExcerpt: ''};
export const third: HeroRow = {...hollis, name: 'Imogen T.', role: 'Partnerships at Larchmere', profileUrl: undefined, postUrl: undefined, date: undefined, dateKind: undefined, postExcerpt: ''};

export function heroFixture(hero: ScanHero | undefined, over: Partial<JourneyFixture> = {}): JourneyFixture {
 return {
  slug: 'marta-quillfeather-fx1', domain: 'example.com',
  founder: {name: 'Marta Quillfeather', firstName: 'Marta', company: 'Quillfeather Studio', headline: 'Founder'},
  buyer: {role: 'Head of Growth', project: ''}, samples: {} as JourneyFixture['samples'], lm_cover_local: '',
  source: {kind: 'original-scan', url: '', capturedOn: '2026-11-12'},
  firm: {band: 'unknown'},
  ...(hero ? {hero} : {}),
  ...over,
 } as JourneyFixture;
}
export const richHero: ScanHero = {tier: 'competitor_commenter', lead: hollis, rows: [hollis, second, third], count: {buyers: 27, own: 12, outside: 15, windowDays: 14, authors: ['Brindlemoor Partners', 'Quillreach']}, checked: {people: 348, passed: 15}};

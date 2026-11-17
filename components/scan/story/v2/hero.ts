import type {FirmSize, HeroRow, ScanHero} from '../../../dev/scan-walkthrough/journey/model';

/** Pure sentence builders for the V2 scan page. Every name, role and date comes from the stored hero. */
export const BOOK_BASE = 'https://calendly.com/im-ivanmanfredi/30min';

export const shortDate = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', {day: 'numeric', month: 'short', timeZone: 'UTC'}); };
export const windowWords = (days?: number) => days === 14 ? 'in the last two weeks' : days ? `in the last ${days} days` : 'recently';
export const joinNames = (names: string[]) => names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

/** "{name}, {role}, …" with the role clause left out cleanly when a row has none. */
export function heroSentence(row: HeroRow): string {
 const who = row.role ? `${row.name}, ${row.role},` : row.name;
 const d = row.date ? shortDate(row.date) : '';
 const by = row.author ? ` by ${row.author}` : '';
 if (row.source === 'own') {
  if (row.how === 'engaged' || !d) return `${who} engages with your posts.`;
  return `${who} ${row.how === 'commented' ? 'commented on' : 'liked'} your ${d} post.`;
 }
 const verb = row.how === 'liked' ? 'liked' : 'commented on';
 if (!d) return `${who} ${verb} a post${by}.`;
 if (row.how !== 'liked' && row.dateKind === 'comment') return `${who} ${verb} a post${by} on ${d}.`;
 return `${who} ${verb} a ${d} post${by}.`;
}

/** One positive count line, or null. Every number it prints is 2 or more. */
export function countLine(count: ScanHero['count'], leadSource: HeroRow['source'] | undefined): string | null {
 const {buyers, own, outside, windowDays, authors} = count, when = windowWords(windowDays);
 if (own >= 2 && outside >= 2) return `${buyers} buyers within reach: ${own} engage with your posts, ${outside} engaged with ${authors.length ? joinNames(authors) : 'posts in your market'} ${when}.`;
 if (leadSource && leadSource !== 'own' && outside - 1 >= 2) return `${outside - 1} more buyers did the same ${when}.`;
 if (leadSource === 'own' && own - 1 >= 2) return `${own - 1} more buyers engage with your posts.`;
 return null;
}

export const pageShape = (firm: FirmSize): 'fast' | 'considered' => firm.band === 'larger' ? 'considered' : 'fast';

export const bookUrl = (slug: string, placement: string) => `${BOOK_BASE}?utm_source=scan&utm_medium=page&utm_campaign=${encodeURIComponent(slug)}&utm_content=${encodeURIComponent(placement)}`;
export const teamUrl = (slug: string) => `/scan/${encodeURIComponent(slug)}/team/`;

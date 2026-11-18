/** All fixed wording on the V2 scan page. Sources are listed in the plan (2026-11-17-ivan-scan-page.md, Task 2). */
export const BRAND_LINE = 'Make your LinkedIn into a true revenue line.';   // Ivan 09-29, verbatim
export const BRAND_SUB = 'Create inbound and outbound opportunities by content, lead magnets and signal based outreach.';   // live sub, verbatim
export const PUBLIC_NOTE = (date: string) => `From public likes and comments on LinkedIn${date ? `, read on ${date}` : ''}.`;
export const PROFILE_HERO = (quote: string) => `Your headline says “${quote}”.`;
export const OFFER = {
  run: {label: 'What we run', text: 'Posts, lead magnets, outreach and follow-up, every week, through to the booked call.'},
  you: {label: 'Your part', text: 'Share your expertise, review as agreed and take the sales calls.'},
  start: {label: 'How it starts', text: 'Connect LinkedIn and your booking link, tell us who to leave out, and your first list of buyers and first posts follow.'},
  price: 'From $3,000 a month, month to month. Extra team accounts are $1,000 a month each.',
};
/** The compact offer for small firms, right under the hero: the same three lines, shortened from the approved wording above. */
export const OFFER_SHORT = {
  run: {label: 'What we run', text: 'Posts, lead magnets, outreach and follow-up, through to the booked call.'},
  you: {label: 'Your part', text: 'Share your expertise, review as agreed and take the sales calls.'},
  start: {label: 'How it starts', text: 'Connect LinkedIn and your booking link. Your first list of buyers and first posts follow.'},
};
export const START_STEPS = [
  {title: 'Set up', items: ['Connect LinkedIn and your booking link', 'Get your client board', 'Send who to leave out']},
  {title: 'First list. First posts.', items: ['First list of buyers', 'Your content calendar', 'You review posts on your board']},
  {title: 'Go live', items: ['Posts go out', 'Outreach starts from one account', 'Replies handled through booking']},
];
export const START_NOTE = 'Plan for roughly 4-8 weeks of audience development where needed.';
/** Statements already on the sales deck. Add a line here only when Ivan has approved its wording. */
export const SAFETY_LINES = ['You review posts on your board.', 'You tell us who to leave out.', 'Your audience, content and email list stay with you.'];
export const CHECKED = (people: number, passed: number) => `${people} people checked. ${passed} passed.`;
export const AFTER_BUYERS = {title: 'We start these conversations for you.', cta: 'Book a call with Iván'};
export const TEAM = {
  eyebrow: (company: string) => `For the team at ${company}`,
  intro: (name: string) => `Iván Manfredi runs LinkedIn content, lead magnets and outreach for owners of agencies and service firms. This is the short version of the plan made for ${name}.`,
  numbers: 'Who we found',
  start: 'How we start',
  cta: 'Book a call together',
  back: 'See the full plan',
  share: 'Deciding with a partner? Send them the short version.',
  moreStories: 'More client results in the full plan',
};
export const FOLD = {open: 'Open the samples', close: 'Close'};
/** People stories, word for word from StudioResults (the proof already on every scan page). */
export const STORIES = {
  kyle: {name: 'Kyle Hunt', role: 'Agency ops coach', photo: '/content-system/kyle-portrait.webp', metric: '$30k → $80k a month', line: 'Across the 90 days we ran his LinkedIn.', link: 'https://inboundonsteroids.com/case/kyle-hunt/', linkText: 'See Kyle’s case study'},
  mattan: {name: 'Mattan Danino', role: 'Founder, RISE DTC', photo: 'https://resources.risedtc.com/tools/assets/mattan.jpg', metric: '+$20k/mo', line: 'In new revenue closed by month 3. We run his content, lead magnets and outreach.', link: 'https://resources.risedtc.com/tools/', linkText: 'See his lead magnets'},
  davorin: {name: 'Davorin Smit', role: 'Founder, ARCH. Influencer Agency', photo: '/content-system/davorin-portrait.webp', metric: '2 clients', line: 'Closed in month 1. We run his LinkedIn content and outreach.', link: '', linkText: ''},
} as const;
export const CLOSE = {title: 'Your next clients are already on LinkedIn.', body: 'We find them, start the conversation and put them on your calendar. Let’s map the process around your business.', cta: 'Book a call with me', note: '30 minutes with me. You leave with the plan either way.'};
export const PREVIEW = {content: 'First slide', resource: 'The lead magnet', conversations: 'First message', calls: 'The booked call'};
export const CHAPTERS = {
  resource: {label: 'Lead magnets', title: 'Turn readers into a list you own.'},
  conversations: {label: 'Conversations', title: 'Every raised hand gets a conversation.', why: 'We message the people who engage, keep readers warm by email and reach buyers with a live project, even if they never saw your posts.'},
  calls: {label: 'Booked calls', title: 'You only take calls that already fit.', why: 'We check fit, timing and who decides before anything gets booked. You walk in knowing the project.'},
};
export const PLAN_TITLE = (first: string) => `${first}, your LinkedIn plan for qualified calls`;

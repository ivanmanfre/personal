// Plain-word copy for everything the client sees. Internal slugs and notes never reach the screen.

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function plainSource(label?: string | null): string | undefined {
  if (!label) return undefined;
  const s = label.trim();
  const l = s.toLowerCase();
  if (/lead magnet|lm launch/.test(l)) return 'Your free resource';
  if (/^reel from/.test(l)) return 'From a reel you shared';
  if (/clip teardown/.test(l)) return 'From a video clip in your market';
  if (/call \+ approved copy/.test(l)) return 'From your call, in copy you approved';
  if (/\bivan\b|@\w/.test(l)) return 'Picked by your content team';
  if (/repurposed from your/.test(l)) return cap(s.replace(/\s*\(.*\)\s*$/, ''));
  if (/winner replica|proven winner|copy test|format adapted|format test|copied shape|repurposed from|shape ·|· competitor|barry hott/.test(l))
    return 'A post format that already works on LinkedIn';
  if (/newsjack|rich lane|news,|ai search news/.test(l)) return 'Timely news in your market';
  if (/picked by ivan|hand-picked|ivan-directed|inbox selection|content brain|tools hub|year-ladder|topic slate/.test(l)) return 'Picked by your content team';
  if (/goal-run|ballot|voice rows|reverted|gate/.test(l)) return 'Picked by your content team';
  if (/^from top posts/.test(l)) return 'From top posts on LinkedIn';
  if (/^week one plan/.test(l)) return 'From your first-week plan';
  if (/competitor feeds/.test(l)) return 'From posts doing well in your market';
  // Another creator's post named by person and platform: say where it sits, never whose it was.
  if (/·\s*(x|linkedin|twitter|instagram|tiktok|youtube)\b/.test(l) && !/^(from your|your|team call|arch team call|call with)/.test(l)) return 'From a post in your market';
  let out = s
    .replace(/;.*$/, '')
    .replace(/\s*\((personal pass|reviewed)[^)]*\)/i, '')
    .replace(/\s*·\s*(summary|topic reference)$/i, '')
    .replace(/^ARCH team call:\s*/i, 'Team call: ')
    .replace(/^Original ARCH resource.*$/i, 'Your free resource')
    .replace(/\bhis\b/g, 'your')
    .replace(/\s+-\s+/g, ', ');
  if (out.length > 64) out = out.slice(0, 61).replace(/[\s,·]+\S*$/, '') + '...';
  return cap(out);
}

const LANES: Record<string, string> = {
  engager_warm: 'Engaged with posts in your space',
  warm_engager: 'Engaged with posts in your space',
  company_expansion: 'More people at companies you target',
  hiring_signal: 'Teams hiring for growth',
  cold_apps: 'App teams, first hello',
  cold_games: 'Game teams, first hello',
  cold: 'Store owners found by search',
  new_in_role: 'New in their role',
  sponsor_team: 'Brands already sponsoring creators',
  sponsor_mined: 'Brands already sponsoring creators',
  soft_launch: 'Games in soft launch',
  profile_view: 'Looked at your profile',
  orbit_pilot_fintech: 'Close to your current clients',
  orbit_pilot_csaas: 'Close to your current clients',
  client_orbit: 'Close to your current clients',
  israel_trip: 'Your Israel trip list',
  funding_signal: 'Recently raised money',
  hand_raise: 'Asked to hear more',
  referral: 'Referrals',
  warm_games: 'People you already know',
  warm_apps: 'People you already know',
  inbound_request: 'Asked to connect with you',
  network_activation: 'Already in your network',
};
export const plainLane = (slug: string) => LANES[slug] || 'Everything else';

const LM: Record<string, string> = {
  live: 'Live', live_unannounced: 'Ready to announce', parked: 'On hold', drafted: 'Being written',
  draft: 'Being written', building: 'Being built', planned: 'Planned', retired: 'Retired',
};
export const plainLmStatus = (s?: string | null) => LM[s || ''] || 'In the works';

export function plainActor(by?: string | null, founderFirst?: string): string {
  const b = (by || '').trim();
  if (!b || /legacy|system|content team|unattributed/i.test(b)) return 'Your content team';
  if (/ivanmanfredi|^ivan$/i.test(b)) return 'Ivan';
  if (/board link/i.test(b)) return 'You';
  if (b.includes('@')) {
    const local = b.split('@')[0];
    if (founderFirst && founderFirst.toLowerCase().startsWith(local.toLowerCase().slice(0, 3))) return founderFirst;
    return cap(local);
  }
  return b;
}

export const INTENT: Record<string, string> = {
  booked: 'Booked a call', positive: 'Interested', soft_yes: 'Open to it', booking: 'Wants to book',
  neutral: 'Talking', info_ask: 'Asked a question', negative: 'Not right now', vendor_pitch: 'Selling to you',
  unclear: 'Replied', invited: 'Invite sent', connected: 'Connected',
};
export const intentLabel = (i?: string | null) => INTENT[i || ''] || 'Replied';
export const intentTone = (i?: string | null): 'accent' | 'soft' | 'mute' =>
  i === 'booked' || i === 'positive' || i === 'soft_yes' || i === 'booking' ? 'accent' : i === 'negative' || i === 'vendor_pitch' ? 'mute' : 'soft';

export const VERB: Record<string, string> = {
  request_changes: 'asked for changes on', hide_draft: 'took', operator_buffer_approve: 'added',
  undo_approve: 'took back the approval on', comment_resolved: 'resolved a comment on', comment_reopened: 'reopened a comment on',
  post_removed: 'pulled', post_restored: 'put back', angle_swap: 'swapped the angle on', unarchive_draft: 'restored',
  approve: 'approved', set_schedule: 'moved', edit_copy: 'edited', archive_draft: 'archived', note: 'left a note on',
  comment: 'commented on', set_media: 'changed the picture on', restore: 'restored', publish: 'published',
};
export const verbFor = (a: string) => VERB[a] || 'updated';
/** Words that go after the post title ("added 3 posts to your board"). */
export const SUFFIX: Record<string, string> = { operator_buffer_approve: 'to your board', hide_draft: 'off the board' };
export const suffixFor = (a: string) => SUFFIX[a] || '';

export type ActKind = 'ok' | 'edit' | 'note' | 'move' | 'out';
export const actKind = (a: string): ActKind =>
  a === 'approve' || a === 'operator_buffer_approve' ? 'ok'
    : a === 'note' || a === 'comment' || a === 'request_changes' ? 'note'
      : a === 'set_schedule' ? 'move'
        : a === 'archive_draft' || a === 'hide_draft' || a === 'post_removed' ? 'out'
          : a === 'undo_approve' ? 'move' : a === 'comment_resolved' || a === 'comment_reopened' ? 'note' : 'edit';


export function plural(n: number, one: string, many?: string) {
  return `${n} ${n === 1 ? one : many || one + 's'}`;
}

export function listNames(names: string[], max = 2) {
  if (names.length <= 1) return names.join('');
  if (names.length <= max) return names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
  return names.slice(0, max).join(', ') + ` and ${names.length - max} more`;
}

import React from 'react';
import type { ProfileAudit, ProfileFinding } from './model';
import './profile-audit.css';

/** The booking path first: the profile is the step between a buyer engaging and a booked call. */
const ORDER = ['booking', 'headline', 'banner', 'about', 'featured'];
const rank = (area: string) => { const i = ORDER.indexOf(area); return i < 0 ? ORDER.length : i; };
const SHOWN = 3;

/** A web address reads as softstorm.in, never https://www.softstorm.in/. */
export const bareUrls = (text: string) => text
  .replace(/\bhttps?:\/\/(?:www\.)?([^\s<>"“”]+?)\/?(?=[\s"“”)]|[.,;:!?](?:\s|$)|$)/gi, '$1')
  .replace(/\bwww\.(?=[a-z0-9-]+\.)/gi, '');

const SERVICES_NOTE = 'Buyers can also send a proposal request from your LinkedIn Services page.';
const BANNER_QUOTE_MAX = 90;

/** What the grey line under a fix says: the lead-in, the quote, then any side note.
 *  The line is clamped to 2-3 lines, so the quote comes before the side note, and a long banner quote
 *  keeps only its top line: the banner image beside the list already shows every other word. */
export function todayLine(f: ProfileFinding) {
  let lead = f.today, quote = f.quote, note = '';
  if (quote && lead.includes(SERVICES_NOTE)) { lead = lead.replace(SERVICES_NOTE, '').trim(); note = 'You also get proposal requests on Services.'; }
  if (f.area === 'banner' && quote.length > BANNER_QUOTE_MAX && quote.includes(' · ')) {
    quote = quote.split(' · ')[0];
    lead = lead.replace(/^Your banner reads:/, 'Your banner top line reads:');
  }
  return { lead: bareUrls(lead), quote: bareUrls(quote), note };
}

/** Every quote was checked against the lead's own profile when the scan was built. */
export function ProfileAuditSection({ audit }: { audit: ProfileAudit }) {
  const [open, setOpen] = React.useState(false);
  const sorted = [...audit.findings].sort((a, b) => rank(a.area) - rank(b.area));
  const hidden = sorted.length > SHOWN + 1 && !open ? sorted.length - SHOWN : 0;
  const findings = hidden ? sorted.slice(0, SHOWN) : sorted;
  const hasImages = Boolean(audit.bannerUrl || audit.avatarUrl);
  return <section className="story-scene profile-audit" id="profile" aria-label="Your LinkedIn profile">
    <div className={`profile-audit-layout${hasImages ? '' : ' is-text-only'}`}>
      <header className="profile-audit-head">
        <h2>What a buyer sees on your profile</h2>
        <p>Before someone books a call with you, they open your LinkedIn profile to check who you are and what you do. This is what they find on yours today, and what to change so they book.</p>
        {hasImages && <div className="profile-audit-images">
          {audit.bannerUrl && <img className="profile-audit-banner" src={audit.bannerUrl} alt="Banner from the audited LinkedIn profile" loading="lazy" />}
          {audit.avatarUrl && <img className="profile-audit-avatar" src={audit.avatarUrl} alt="Photo from the audited LinkedIn profile" loading="lazy" />}
        </div>}
      </header>
      <ol className="profile-findings">{findings.map(f => { const t = todayLine(f); return <li key={f.area || f.label} className="profile-finding" data-state={f.state}>
        <span className="profile-finding-label">{f.label}</span>
        <div className="profile-finding-body">
          <p className="profile-finding-fix">{bareUrls(f.fix)}</p>
          <p className="profile-finding-today">{t.lead}{t.quote && <> <q>{t.quote}</q></>}{t.note && <>. {t.note}</>}</p>
        </div>
      </li>; })}
        {hidden > 0 && <li className="profile-finding-more"><button type="button" onClick={() => setOpen(true)}>Show {hidden} more changes</button></li>}
      </ol>
    </div>
  </section>;
}

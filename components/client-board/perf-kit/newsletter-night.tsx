/**
 * NewsletterNight: the Newsletter tab on the night board (NIGHT MOCKUP, local only,
 * 2026-09-29). Rendered by DeskNewsletterSurface only when `?night` is on the URL.
 *
 * NIGHT v4 (Ivan: v3 "looks way less cool"): v2's look is back, the panel with a dot grid,
 * the caps eyebrow with the yellow rule, and the lit stepper (vertical on a phone, left to
 * right on desktop) whose rail fills ONCE as it comes into view; nothing loops, and with
 * reduced motion it is simply full. Every word is v3's: the status said once, each step as
 * one plain sentence, the sender and the untracked subscriber count as one line, and a plain
 * empty state. Presentation only: steps, sender and issues arrive from `board.newsletter`.
 */
import React, { type CSSProperties } from 'react';
import { MotionRoot, useReveal } from './motion';
import { DotPattern } from './magicui';
import { PK_CSS } from './styles';

type Step = { step: string; detail?: string };
type Issue = { date?: string; sent_at?: string; subject?: string; title?: string };

export type NewsletterNightProps = {
  name: string;
  fromDomain?: string;
  cadence?: string;
  steps: Step[];
  issues: Issue[];
  onOpenIssue?: (issue: unknown) => void;
};

const NLN_CSS = `
.nln { position: relative; isolation: isolate; color: rgb(var(--nt-fg, 255 255 255)); font-family: var(--cb-body, Manrope), 'Helvetica Neue', Arial, sans-serif; font-size: 16px; line-height: 1.55; letter-spacing: -0.004em; -webkit-font-smoothing: antialiased; padding: 2px 0 8px; }
.nln-h1 { margin: 4px 0 0; max-width: 34ch; font-family: var(--cb-serif, Sora), sans-serif; font-weight: 400; font-size: clamp(21px, 5.4vw, 28px); line-height: 1.22; letter-spacing: -0.025em; text-wrap: balance; }
.nln-h1 b { font-weight: 500; color: var(--cb-accent-fg, var(--cb-accent)); }

.nln-seq { margin-top: 22px; padding: 20px 18px 20px; overflow: hidden; display: grid; grid-template-columns: minmax(0,1fr); grid-template-areas: 'head' 'steps' 'from'; }
.nln-seq .pk-dots { mask-image: radial-gradient(360px 260px at 100% 0%, #000 0%, transparent 72%); -webkit-mask-image: radial-gradient(360px 260px at 100% 0%, #000 0%, transparent 72%); }
.nln-seq-head { grid-area: head; min-width: 0; }
.nln-seq .nln-steps { grid-area: steps; }
.nln-seq .nln-from { grid-area: from; }
.nln-count { margin-top: 8px; font-size: 15px; font-weight: 600; line-height: 1.4; color: rgb(var(--nt-fg, 255 255 255) / .62); }
.nln-count b { font-family: var(--cb-serif, Sora), sans-serif; font-weight: 400; font-size: 17px; letter-spacing: -0.02em; color: rgb(var(--nt-fg, 255 255 255)); }

/* phone: vertical stepper, rail on the left */
.nln-steps { position: relative; list-style: none; margin: 22px 0 0; padding: 0 0 0 54px; }
.nln-seg { position: absolute; left: -36px; top: 46px; bottom: -4px; width: 2px; border-radius: 2px; background: rgb(var(--nt-fg, 255 255 255) / .08); }
.nln-fill { position: absolute; inset: 0; border-radius: inherit; transform-origin: top; background: linear-gradient(to bottom, var(--cb-accent), color-mix(in srgb, var(--pk-acc, #FFC71D) 60%, transparent)); box-shadow: 0 0 12px color-mix(in srgb, var(--pk-acc, #FFC71D) 45%, transparent); }
.nln-step { position: relative; padding-bottom: 14px; }
.nln-step:last-child { padding-bottom: 0; }
.nln-node { position: absolute; left: -54px; top: 6px; width: 38px; height: 38px; display: grid; place-items: center; border-radius: 999px; background: #151515; border: 1px solid var(--cb-accent); box-shadow: 0 0 0 5px color-mix(in srgb, var(--pk-acc, #FFC71D) 10%, transparent); font-family: var(--cb-serif, Sora), sans-serif; font-size: 15px; font-weight: 500; font-variant-numeric: tabular-nums; color: var(--cb-accent-fg, var(--cb-accent)); }
.nln-card { border-radius: 18px 6px 6px 6px; border: 1px solid rgb(var(--nt-fg, 255 255 255) / .08); background: linear-gradient(160deg, rgb(var(--nt-fg, 255 255 255) / .05), rgb(var(--nt-fg, 255 255 255) / .015)); padding: 14px 16px 15px; }
.nln-card h3 { margin: 0; font-size: 16.5px; font-weight: 700 !important; line-height: 1.3; letter-spacing: -0.01em; }
.nln-card p { margin: 5px 0 0; font-size: 14.5px; line-height: 1.5; color: rgb(var(--nt-fg, 255 255 255) / .62); text-wrap: pretty; }

/* desktop: the same four steps read left to right across the full panel, the rail runs
   between the nodes, and the heading and sender share one row above it */
@media (min-width: 900px) {
  .nln-seq { padding: 26px 30px 28px; grid-template-columns: minmax(0,1fr) auto; grid-template-areas: 'head from' 'steps steps'; column-gap: 32px; align-items: end; }
  .nln-steps { display: grid; grid-template-columns: repeat(var(--n, 4), minmax(0,1fr)); gap: 16px; margin-top: 24px; padding: 0; }
  .nln-step { display: flex; flex-direction: column; padding-bottom: 0; }
  .nln-node { position: relative; left: auto; top: auto; margin: 0 0 14px 4px; }
  .nln-seg { left: 56px; right: -12px; top: 19px; bottom: auto; width: auto; height: 2px; }
  .nln-fill { transform-origin: left; background: linear-gradient(to right, var(--cb-accent), color-mix(in srgb, var(--pk-acc, #FFC71D) 60%, transparent)); }
  .nln-card { flex: 1 1 auto; }
  .nln-seq .nln-from { margin-top: 0; padding-top: 0; border-top: 0; justify-content: flex-end; }
}
/* one-shot fill on first view; with reduced motion the rail is simply full */
@media (prefers-reduced-motion: no-preference) {
  .nln-steps.arm .nln-node { border-color: rgb(var(--nt-fg, 255 255 255) / .16); color: rgb(var(--nt-fg, 255 255 255) / .55); box-shadow: 0 0 0 0 color-mix(in srgb, var(--pk-acc, #FFC71D) 0%, transparent); transition: border-color .2s ease, color .2s ease, box-shadow .2s ease; }
  .nln-steps.arm .nln-fill { transform: scaleY(0); transition: transform .15s linear; }
  .nln-steps.on .nln-node { border-color: var(--cb-accent); color: var(--cb-accent-fg, var(--cb-accent)); box-shadow: 0 0 0 5px color-mix(in srgb, var(--pk-acc, #FFC71D) 10%, transparent); }
  .nln-steps.on .nln-fill { transform: scaleY(1); }
}
@media (min-width: 900px) and (prefers-reduced-motion: no-preference) {
  .nln-steps.arm .nln-fill { transform: scaleX(0); }
  .nln-steps.on .nln-fill { transform: scaleX(1); }
}
.nln-from { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 12px; margin-top: 20px; padding-top: 16px; border-top: 1px solid rgb(var(--nt-fg, 255 255 255) / .08); }
.nln-from-t { font-size: 14px; font-weight: 700; color: rgb(var(--nt-fg, 255 255 255) / .7); }
.nln-chip { display: inline-flex; align-items: center; padding: 4px 11px; border-radius: 999px; border: 1px solid rgb(var(--nt-fg, 255 255 255) / .16); background: rgb(var(--nt-fg, 255 255 255) / .04); font-size: 12.5px; font-weight: 700; line-height: 1.35; color: rgb(var(--nt-fg, 255 255 255) / .75); }
.nln-chip.blank { border-style: dashed; color: rgb(var(--nt-fg, 255 255 255) / .5); background: none; }

.nln-empty { position: relative; overflow: hidden; margin-top: 16px; display: flex; align-items: center; gap: 16px; padding: 18px 20px; border-radius: 22px 8px 8px 8px; border: 1px dashed rgb(var(--nt-fg, 255 255 255) / .18); background: linear-gradient(180deg, rgb(var(--nt-fg, 255 255 255) / .035), rgb(var(--nt-fg, 255 255 255) / .01)); }
.nln-empty-ic { flex: none; display: grid; place-items: center; width: 44px; height: 44px; border-radius: 999px; border: 1px dashed rgb(var(--nt-fg, 255 255 255) / .25); background: #141414; color: rgb(var(--nt-fg, 255 255 255) / .55); }
.nln-empty-t { font-size: 16px; font-weight: 700; line-height: 1.3; color: rgb(var(--nt-fg, 255 255 255) / .82); }
.nln-empty-s { margin-top: 2px; font-size: 14px; line-height: 1.4; color: rgb(var(--nt-fg, 255 255 255) / .5); }

.nln-issue { display: flex; width: 100%; align-items: baseline; gap: 14px; padding: 14px 0; border: 0; border-bottom: 1px solid rgb(var(--nt-fg, 255 255 255) / .08); background: none; color: inherit; font: inherit; text-align: left; }
.nln-issue .d { flex: none; width: 68px; font-size: 12.5px; font-weight: 800; color: rgb(var(--nt-fg, 255 255 255) / .5); }
.nln-issue .s { flex: 1 1 auto; min-width: 0; font-size: 15px; font-weight: 600; }
/* NIGHT v4: v3's plain sentence per step sits in v2's card; readability floor on the greys */
.nln-card .nln-t { margin: 0; font-size: 15.5px; font-weight: 600; line-height: 1.45; color: rgb(var(--nt-fg, 255 255 255)); text-wrap: pretty; }
.nln-from-t { font-weight: 600; color: rgb(var(--nt-fg, 255 255 255) / .72); }
.nln-issue .d { width: 76px; font-size: 13px; font-weight: 700; color: rgb(var(--nt-fg, 255 255 255) / .66); }
.nln-empty-ic { color: rgb(var(--nt-fg, 255 255 255) / .62); }
.nln-sec { padding-top: 44px; }

/* QUIET (2026-09-29, "private-bank quiet, receipts first"): the sequence in a white panel,
   numbered grey discs on a plain grey rail, the step sentences in ink on light wells. No
   glow, no lit ring, no yellow text. Night never matches [data-quiet]. */
[data-quiet] .nln-h1 b { color: #111; }
[data-quiet] .nln-seq { background: #FFFFFF; border: 1px solid rgba(17,17,17,.09); }
[data-quiet] .nln-node, [data-quiet] .nln-steps.on .nln-node, [data-quiet] .nln-steps.arm .nln-node { background: #E9E9E6; border: 1px solid #E9E9E6; box-shadow: none; color: #111; }
[data-quiet] .nln-seg { background: rgba(17,17,17,.10); }
[data-quiet] .nln-fill { background: rgba(17,17,17,.22); box-shadow: none; }
[data-quiet] .nln-card { background: #F5F5F3; border-color: rgba(17,17,17,.07); }
[data-quiet] .nln-from { border-top-color: rgba(17,17,17,.09); }
[data-quiet] .nln-empty { background: #FFFFFF; border-color: rgba(17,17,17,.18); }
[data-quiet] .nln-empty-ic { background: #E9E9E6; border: 0; color: #111; }
`;

/** NIGHT v3: the same four steps in the words a founder uses. The board's own step titles
 *  are our working names ("Lead completes an assessment", "Call ask"), so a known step is
 *  said plainly here; any other step falls back to the board's words. For the live board this
 *  belongs in the data (a client line per step), not in a lookup. */
const PLAIN: Record<string, string> = {
  'lead completes an assessment': 'Someone downloads a lead magnet and we get their email.',
  'welcome email, same hour': 'The same hour, they get a welcome email with their score and one fix.',
  'weekly memo': 'Every week they get one practical idea from you.',
  'call ask': 'After three opens in a row or two clicks in one week, they get one line asking them to book a call.',
};
const plainStep = (st: Step) => PLAIN[st.step.trim().toLowerCase()] || null;

const Mail = ({ s = 20 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 20 20" aria-hidden="true"><rect x="2.5" y="4.5" width="15" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.5" fill="none" /><path d="M3.5 6l6.5 5 6.5-5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

/** One-shot fill: node i lights at AT(i), the rail after it fills on the way to node i+1.
 *  The whole rail is lit in well under a second, once. */
const AT = (i: number) => 0.1 + i * 0.15;

function Stepper({ steps }: { steps: Step[] }) {
  const [ref, shown] = useReveal<HTMLOListElement>(0.2);
  const n = steps.length;
  // CSS-driven: the lit state is the default, so with reduced motion (or no JS) the rail is
  // simply full. With motion allowed, `.arm` holds the dark state until `.on` lands.
  return (
    <ol ref={ref} className={shown ? 'nln-steps arm on' : 'nln-steps arm'} style={{ '--n': n } as CSSProperties}>
      {steps.map((st, i) => {
        const said = plainStep(st);
        return (
          <li key={i} className="nln-step">
            <span className="nln-node" aria-hidden="true" style={{ transitionDelay: `${AT(i)}s` } as CSSProperties}>{i + 1}</span>
            {i < n - 1 && (
              <span className="nln-seg" aria-hidden="true">
                <span className="nln-fill" style={{ transitionDelay: `${AT(i) + 0.05}s` } as CSSProperties} />
              </span>
            )}
            <div className="nln-card">
              <span className="pk-sr">Step {i + 1}: </span>
              {said ? <p className="nln-t">{said}</p> : <><h3>{st.step}</h3>{st.detail && <p>{st.detail}</p>}</>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default function NewsletterNight({ name, fromDomain, steps, issues, onOpenIssue }: NewsletterNightProps) {
  return (
    <MotionRoot>
      <style>{PK_CSS + NLN_CSS}</style>
      <div className="nln" data-newsletter-night="">
        {/* v3: the status said once, in plain words; v2: Sora headline with the state in yellow. */}
        <h1 className="nln-h1" id="nln-hero">
          {issues.length > 0
            ? <>{name} has <b>{issues.length} {issues.length === 1 ? 'issue' : 'issues'} out</b>.</>
            : <>{name} is <b>written</b>. The first issue goes out once we pick a send day.</>}
        </h1>

        {steps.length > 0 && (
          <section className="pk-panel nln-seq" aria-labelledby="nln-steps" data-viz="">
            <DotPattern />
            <div className="nln-seq-head">
              <div id="nln-steps" role="heading" aria-level={2} className="pk-cap pk-capline">What a new reader gets</div>
            </div>
            <Stepper steps={steps} />
            <div className="nln-from">
              <span className="nln-from-t">Sends from {fromDomain || 'your domain'}. Subscribers are not counted here yet.</span>
            </div>
          </section>
        )}

        <section className="nln-sec" aria-labelledby="nln-issues">
          <div id="nln-issues" role="heading" aria-level={2} className="pk-cap pk-capline">Issues</div>
          {issues.length === 0 ? (
            <div className="nln-empty">
              <span className="nln-empty-ic"><Mail s={20} /></span>
              <div className="nln-empty-t">No issues sent yet.</div>
            </div>
          ) : (
            <div style={{ marginTop: 16, borderTop: '1px solid rgb(var(--nt-fg, 255 255 255) / .14)' }}>
              {issues.map((iss, i) => (
                <button key={i} type="button" className="nln-issue" onClick={() => onOpenIssue && onOpenIssue(iss)} style={{ cursor: onOpenIssue ? 'pointer' : 'default' }}>
                  <span className="d">{iss.date || iss.sent_at || ''}</span>
                  <span className="s">{iss.subject || iss.title || 'Issue'}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </MotionRoot>
  );
}

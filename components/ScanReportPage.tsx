// components/ScanReportPage.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, animate, useInView, useReducedMotion } from 'framer-motion';
import {
  ExternalLink, CheckCircle, XCircle, AlertCircle, ArrowLeft, ArrowRight,
} from 'lucide-react';
import { useScan } from '../hooks/useScan';
import { ScoreBar } from './scan/ScoreBar';
import { OpportunityCard } from './scan/OpportunityCard';
import type { ReportJson, AdCreative } from '../lib/scanTypes';

const CALENDLY_BASE = 'https://calendly.com/im-ivanmanfredi/30min';

const SERIF = '"DM Serif Display", "Bodoni Moda", Georgia, serif';
const BODY_SERIF = '"Source Serif 4", Georgia, serif';
const MONO = '"IBM Plex Mono", monospace';
const EASE = [0.22, 0.84, 0.36, 1] as const;

// ── Editorial primitives ──────────────────────────────────────────────────────

const Kicker: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p
    style={{
      fontFamily: MONO,
      fontSize: '11px',
      letterSpacing: '0.22em',
      textTransform: 'uppercase',
      color: 'rgba(26,26,26,0.65)', // bumped from 0.5 — fails AA at this size
    }}
  >
    {children}
  </p>
);

// Helper: image onError that swaps to a no-preview block. Kills broken images everywhere.
const fallbackOnError: React.ReactEventHandler<HTMLImageElement> = (e) => {
  (e.target as HTMLImageElement).style.display = 'none';
};

// Motion presets — match landing page vocabulary.
// Sections render fully visible by default; subtle decoration only.
// (Earlier version used opacity:0 reveals — caused below-fold sections to vanish on slower viewports.)
const inViewProps = {
  initial: { y: 14 },
  whileInView: { y: 0 },
  viewport: { once: true, margin: '-100px' } as const,
  transition: { duration: 0.7, ease: EASE },
};

// Blur-in headline on scroll — same as landing page RevealH2
const RevealHeadline: React.FC<{ children: React.ReactNode; as?: 'h2' | 'h3'; style?: React.CSSProperties }> = ({
  children, as = 'h2', style,
}) => {
  const reduceMotion = useReducedMotion();
  const Tag = as === 'h2' ? motion.h2 : motion.h3;
  return (
    <Tag
      initial={reduceMotion ? false : { y: 18, filter: 'blur(6px)' }}
      whileInView={{ y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.9, ease: EASE }}
      style={style}
    >
      {children}
    </Tag>
  );
};

// Animated counter — counts from 0 to value when in view
const Counter: React.FC<{ value: number; style?: React.CSSProperties }> = ({ value, style }) => {
  const [displayed, setDisplayed] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!isInView) return;
    if (reduceMotion) { setDisplayed(value); return; }
    const controls = animate(0, value, {
      duration: 1.2,
      ease: EASE as unknown as [number, number, number, number],
      onUpdate: (v) => setDisplayed(Math.round(v)),
    });
    return () => controls.stop();
  }, [value, isInView, reduceMotion]);

  return <span ref={ref} style={style}>{displayed}</span>;
};

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2
    style={{
      fontFamily: SERIF,
      fontWeight: 400,
      fontSize: 'clamp(1.875rem, 3.4vw, 2.75rem)',
      lineHeight: 1.05,
      letterSpacing: '-0.02em',
      color: '#1A1A1A',
    }}
  >
    {children}
  </h2>
);

const Section: React.FC<{ kicker: string; title: React.ReactNode; children: React.ReactNode }> = ({
  kicker, title, children,
}) => (
  <motion.section
    {...inViewProps}
    className="border-t border-[color:var(--color-hairline)] py-16 lg:py-24"
  >
    <div className="mb-12 lg:mb-16 space-y-3">
      <Kicker>{kicker}</Kicker>
      <RevealHeadline
        style={{
          fontFamily: SERIF,
          fontWeight: 400,
          fontSize: 'clamp(2rem, 4vw, 3.25rem)',
          lineHeight: 1.05,
          letterSpacing: '-0.02em',
          color: '#1A1A1A',
        }}
      >
        {title}
      </RevealHeadline>
    </div>
    {children}
  </motion.section>
);

// Highlight: matches landing-page Hero pattern exactly. Marker-sweep animation, sage strip behind text.
const Italic: React.FC<{ children: React.ReactNode; highlight?: boolean }> = ({ children, highlight = false }) => {
  const reduceMotion = useReducedMotion();
  if (!highlight) {
    return <span style={{ fontStyle: 'italic', color: 'var(--color-accent)' }}>{children}</span>;
  }
  return (
    <span style={{ fontStyle: 'italic', position: 'relative', color: '#1A1A1A' }}>
      {children}
      <motion.span
        aria-hidden
        initial={reduceMotion ? false : { scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true, margin: '-30px' }}
        transition={{ duration: 0.9, ease: EASE, delay: 0.2 }}
        style={{
          position: 'absolute',
          left: '-2%',
          right: '-2%',
          bottom: '0.18em',
          height: '0.42em',
          backgroundColor: 'var(--color-accent)',
          transformOrigin: 'left',
          opacity: 0.25,
          zIndex: -1,
        }}
      />
    </span>
  );
};

const SerifBody: React.FC<{ children: React.ReactNode; large?: boolean; className?: string }> = ({
  children, large, className = '',
}) => (
  <p
    className={className}
    style={{
      fontFamily: BODY_SERIF,
      // Bigger on desktop, slightly smaller on mobile so 45+ char/line at 390px
      fontSize: large ? 'clamp(17px, 2.4vw, 19px)' : 'clamp(15.5px, 2.2vw, 17px)',
      lineHeight: 1.65,
      color: '#3D3D3B',
      fontWeight: 400,
    }}
  >
    {children}
  </p>
);

const Chip: React.FC<{ label: string; variant?: 'found' | 'missing' | 'neutral' }> = ({
  label, variant = 'neutral',
}) => {
  const styles =
    variant === 'found' ? { color: 'var(--color-accent)', borderColor: 'rgba(76,110,61,0.25)', background: 'rgba(76,110,61,0.06)' } :
    variant === 'missing' ? { color: '#A85439', borderColor: 'rgba(168,84,57,0.25)', background: 'rgba(168,84,57,0.05)' } :
    { color: 'rgba(26,26,26,0.7)', borderColor: 'rgba(26,26,26,0.12)', background: 'transparent' };
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1.5"
      style={{
        fontFamily: MONO,
        fontSize: '11px',
        letterSpacing: '0.04em',
        border: '1px solid',
        ...styles,
      }}
    >
      {variant === 'found' && <CheckCircle className="w-3 h-3" />}
      {variant === 'missing' && <XCircle className="w-3 h-3" />}
      {label}
    </span>
  );
};

// ── Sections ──────────────────────────────────────────────────────────────────

function Section1CompanyBrief({ report }: { report: ReportJson }) {
  const { company_snapshot, anthropic_verified, openai_verified, tech_stack_assessment, linkedin_summary, github } = report;
  const { domain_age_years, email_infra, company_size, revenue_range } = report;

  const facts: string[] = [];
  if (company_size) facts.push(`${company_size} employees`);
  if (revenue_range) facts.push(`${revenue_range} revenue`);
  if (domain_age_years) facts.push(`${domain_age_years}-year-old domain`);
  if (email_infra === 'google_workspace') facts.push('Google Workspace');
  else if (email_infra === 'microsoft_365') facts.push('Microsoft 365');

  return (
    <Section kicker="01 / The Company" title={<>Who they are, <Italic highlight>what they run on</Italic>.</>}>
      <div className="grid lg:grid-cols-[1fr_280px] gap-10 lg:gap-12">
        <div className="space-y-6 max-w-2xl min-w-0">
          <SerifBody large>{company_snapshot.one_liner}</SerifBody>

          {facts.length > 0 && (
            <div className="flex flex-wrap gap-x-6 gap-y-2" style={{ fontFamily: MONO, fontSize: '12px', letterSpacing: '0.04em', color: 'rgba(26,26,26,0.6)' }}>
              {facts.map((f, i) => (
                <span key={i}>{f}</span>
              ))}
            </div>
          )}

          {(anthropic_verified || openai_verified) && (
            <div
              className="px-5 py-4 border-l-2"
              style={{ borderColor: 'var(--color-accent)', background: 'rgba(76,110,61,0.04)' }}
            >
              <SerifBody>
                DNS records confirm active{' '}
                <Italic>
                  {anthropic_verified && 'Anthropic'}
                  {anthropic_verified && openai_verified && ' + '}
                  {openai_verified && 'OpenAI'}
                </Italic>{' '}
                API usage. The gap here isn't awareness; it's operationalization.
              </SerifBody>
            </div>
          )}

          {linkedin_summary && (linkedin_summary.followers || linkedin_summary.posts_30d != null) && (
            <div className="pt-2">
              <Kicker>LinkedIn presence</Kicker>
              <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 mt-3" style={{ fontFamily: BODY_SERIF, fontSize: '17px', color: '#3D3D3B' }}>
                {linkedin_summary.followers != null && (
                  <span><span style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: '24px', color: '#1A1A1A' }}>{linkedin_summary.followers.toLocaleString()}</span> followers</span>
                )}
                {linkedin_summary.posts_30d != null && (
                  <span><span style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: '24px', color: '#1A1A1A' }}>{linkedin_summary.posts_30d}</span> posts / 30d</span>
                )}
                {linkedin_summary.last_post_days != null && (
                  <span style={{ color: linkedin_summary.last_post_days > 30 ? '#A85439' : '#3D3D3B' }}>
                    Last post {linkedin_summary.last_post_days}d ago
                  </span>
                )}
                {!!linkedin_summary.ai_mentions && linkedin_summary.ai_mentions > 0 && (
                  <span style={{ color: 'var(--color-accent)' }}>{linkedin_summary.ai_mentions} AI/automation posts</span>
                )}
              </div>
            </div>
          )}

          {github && (
            <SerifBody>
              GitHub: <Italic>{github.repos} public repositories</Italic>. Engineers on staff.
            </SerifBody>
          )}
        </div>

        {/* Tech stack column — sticky on desktop so it doesn't dead-air */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <Kicker>Tech stack</Kicker>
          <div className="mt-4 space-y-5">
            <div>
              <p style={{ fontFamily: MONO, fontSize: '10px', color: 'var(--color-accent)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>Confirmed</p>
              <div className="flex flex-wrap gap-1.5">
                {tech_stack_assessment.confirmed_tools.length > 0
                  ? tech_stack_assessment.confirmed_tools.map(t => <Chip key={t} label={t} variant="found" />)
                  : <p style={{ fontFamily: MONO, fontSize: '11px', color: 'rgba(26,26,26,0.6)' }}>None detected</p>}
              </div>
            </div>
            <div>
              <p style={{ fontFamily: MONO, fontSize: '10px', color: '#A85439', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>Missing</p>
              <div className="flex flex-wrap gap-1.5">
                {tech_stack_assessment.missing_critical_tools.length > 0
                  ? tech_stack_assessment.missing_critical_tools.slice(0, 6).map(t => <Chip key={t} label={t} variant="missing" />)
                  : <p style={{ fontFamily: MONO, fontSize: '11px', color: 'rgba(26,26,26,0.6)' }}>No critical gaps</p>}
              </div>
            </div>
            <SerifBody className="pt-2 border-t border-[color:var(--color-hairline)]">{tech_stack_assessment.sophistication_notes}</SerifBody>
          </div>
        </div>
      </div>
    </Section>
  );
}

function SectionFundingTraffic({ report }: { report: ReportJson }) {
  const f = report.funding;
  const t = report.traffic;
  // Build the list of stats that ACTUALLY have values — no "—" placeholders ever.
  type Stat = { label: string; display: string };
  const stats: Stat[] = [];

  if (f?.total_funding_usd) {
    const v = f.total_funding_usd;
    stats.push({ label: 'Total raised', display: v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M` : `$${(v / 1000).toFixed(0)}K` });
  }
  if (f?.last_round_type) stats.push({ label: 'Last round', display: f.last_round_type });
  if (f?.last_round_date) stats.push({ label: 'Last round date', display: f.last_round_date });
  if (f && Array.isArray(f.investors) && f.investors.length > 0) {
    stats.push({ label: 'Investors', display: String(f.investors.length) });
  }
  if (t?.monthly_visits) stats.push({ label: 'Monthly visits', display: t.monthly_visits.toLocaleString() });
  if (t?.global_rank) stats.push({ label: 'Global rank', display: `#${t.global_rank.toLocaleString()}` });
  if (t?.bounce_rate != null) stats.push({ label: 'Bounce rate', display: `${(t.bounce_rate * 100).toFixed(0)}%` });
  if (t?.avg_visit_duration) {
    // SimilarWeb returns "00:00:53" string; show as-is or convert
    const v = t.avg_visit_duration as unknown;
    stats.push({ label: 'Avg visit', display: typeof v === 'string' ? v : String(v) });
  }
  if (t?.top_country) stats.push({ label: 'Top country', display: t.top_country });

  // Hide section entirely if nothing populated
  if (stats.length === 0) return null;

  return (
    <Section kicker="02 / Signals" title={<>The numbers <Italic highlight>behind the brand</Italic>.</>}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-12">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ y: 12 }}
            whileInView={{ y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.7, ease: EASE, delay: i * 0.06 }}
            className="border-l-2 border-[color:var(--color-hairline)] pl-4"
          >
            <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.65)' }}>
              {s.label}
            </p>
            <p style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 'clamp(2.25rem, 3.6vw, 3.25rem)', lineHeight: 1.05, letterSpacing: '-0.02em', color: '#1A1A1A', marginTop: 8 }}>
              {s.display}
            </p>
          </motion.div>
        ))}
      </div>
      {f?.crunchbase_url && (
        <a
          href={f.crunchbase_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 mt-10 py-3 -my-3 transition-colors"
          style={{ fontFamily: MONO, fontSize: '12px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.7)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#1A1A1A')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(26,26,26,0.7)')}
        >
          View Crunchbase profile <ArrowRight className="w-3 h-3" />
        </a>
      )}
    </Section>
  );
}

function Section3Opportunities({ report }: { report: ReportJson }) {
  return (
    <Section
      kicker={`03 / ${report.opportunities.length} Opportunities`}
      title={<>Where time <Italic highlight>quietly leaks</Italic>.</>}
    >
      <SerifBody className="mb-10 max-w-2xl">
        Each gap is sourced from specific data signals: DNS records, tech stack, ad activity, hiring patterns. No speculation.
      </SerifBody>
      <div className="space-y-2">
        {report.opportunities.map((opp, i) => (
          <OpportunityCard key={i} opportunity={opp} index={i} prominent={i === 0} />
        ))}
      </div>
    </Section>
  );
}

function AdCreativeCard({ creative, platform }: { creative: AdCreative; platform: 'google' | 'linkedin' | 'meta' }) {
  const isRenderableImage = (url: string | null | undefined): boolean => {
    if (!url) return false;
    if (/\.(js|html?)(\?|$)/i.test(url)) return false; // Google JS iframes don't render as <img>
    return true;
  };

  const candidateImage = (creative.images && creative.images[0]) || creative.preview_url || null;
  const initialImage = isRenderableImage(candidateImage) ? candidateImage : null;
  const [imgFailed, setImgFailed] = React.useState(false);
  const showImage = initialImage && !imgFailed;
  const realTitle = creative.title || creative.headline || null;
  const body = (creative.body || '').trim();
  const cta = creative.cta_text || null;
  const link = creative.link_url || creative.ad_url || creative.advertiser_url || null;
  const platformLabel = platform === 'google' ? 'Google' : platform === 'linkedin' ? 'LinkedIn' : 'Meta';

  // Three render modes — chosen by what data the platform actually returns:
  // (a) Image card  — Meta + image-bearing creatives
  // (b) Pull-quote  — LinkedIn ads (rich body, no image)
  // (c) Compact tag — Google text-only ads (no body, only ad_format)
  const mode: 'image' | 'quote' | 'tag' = showImage ? 'image' : (body.length > 30 ? 'quote' : 'tag');

  const platformChip = (
    <div className="flex items-center gap-2">
      <span style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.65)' }}>{platformLabel}</span>
      {creative.is_active && (
        <span style={{ fontFamily: MONO, fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-accent)' }}>● Active</span>
      )}
    </div>
  );

  if (mode === 'quote') {
    return (
      <div
        className="p-7 flex flex-col gap-4 hover:bg-paper-sunk/30 transition-colors"
        style={{ borderLeft: '2px solid var(--color-accent)' }}
      >
        {platformChip}
        <blockquote
          style={{
            fontFamily: SERIF,
            fontStyle: 'italic',
            fontSize: 'clamp(18px, 2.2vw, 22px)',
            lineHeight: 1.35,
            letterSpacing: '-0.01em',
            color: '#1A1A1A',
          }}
        >
          "{body.length > 220 ? body.slice(0, 217) + '…' : body}"
        </blockquote>
        {realTitle && (
          <p style={{ fontFamily: BODY_SERIF, fontSize: '14px', color: 'rgba(26,26,26,0.65)' }}>from {realTitle}</p>
        )}
        {link && (
          <a href={link} target="_blank" rel="noopener noreferrer"
             style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--color-accent)' }}
             className="inline-flex items-center gap-1.5 mt-auto py-2 -my-2 hover:underline">
            {cta || 'View ad'} <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    );
  }

  if (mode === 'tag') {
    // Google text-only ad: render the ad_format + advertiser_name as a quiet badge
    return (
      <div className="p-6 border border-[color:var(--color-hairline)] flex flex-col gap-3 hover:border-ink/20 transition-colors">
        {platformChip}
        <p style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: '20px', lineHeight: 1.2, color: '#1A1A1A' }}>
          {creative.ad_format ? `${creative.ad_format.charAt(0).toUpperCase()}${creative.ad_format.slice(1)} creative` : 'Active campaign'}
        </p>
        {(creative.first_shown || creative.last_shown) && (
          <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.16em', color: 'rgba(26,26,26,0.6)' }}>
            {creative.first_shown && creative.last_shown ? `${creative.first_shown} → ${creative.last_shown}` : (creative.first_shown || creative.last_shown)}
          </p>
        )}
        {link && (
          <a href={link} target="_blank" rel="noopener noreferrer"
             style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--color-accent)' }}
             className="inline-flex items-center gap-1.5 mt-auto py-2 -my-2 hover:underline">
            View on transparency center <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    );
  }

  // mode === 'image'
  return (
    <div className="border border-[color:var(--color-hairline)] hover:border-ink/20 transition-colors flex flex-col min-h-[44px]">
      <div className="aspect-[16/10] overflow-hidden" style={{ background: '#EFEAE2' }}>
        <img src={initialImage!} alt={realTitle ?? `${platformLabel} ad creative`} className="w-full h-full object-cover" loading="lazy" onError={() => setImgFailed(true)} />
      </div>
      <div className="p-5 flex-1 flex flex-col gap-3">
        {platformChip}
        {realTitle && (
          <p style={{ fontFamily: SERIF, fontSize: '17px', lineHeight: 1.25, letterSpacing: '-0.01em', color: '#1A1A1A' }} className="line-clamp-2">{realTitle}</p>
        )}
        {body && <SerifBody className="line-clamp-3"><span style={{ fontSize: '14px' }}>{body}</span></SerifBody>}
        {cta && link && (
          <div className="mt-auto pt-3 border-t border-[color:var(--color-hairline)]">
            <a href={link} target="_blank" rel="noopener noreferrer"
               style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--color-accent)' }}
               className="inline-flex items-center gap-1.5 py-1 -my-1 hover:underline">
              {cta} <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionAdActivity({ report }: { report: ReportJson }) {
  const ads = report.ads;
  if (!ads) return null;

  // Frontend safety filter: drop creatives that have NO showable content at all.
  // Body counts as content (LinkedIn ads are body-only), as does image, title, headline.
  // Google text-only ads (no body, no image) still pass via ad_format → "tag" mode.
  const isUsable = (c: AdCreative) => {
    const hasText = !!(c.title || c.headline || (c.body && c.body.trim().length > 5));
    const hasImage = !!((c.images && c.images[0]) || c.preview_url);
    const hasGoogleTag = !!(c.ad_format && (c.first_shown || c.last_shown || c.ad_url));
    return hasText || hasImage || hasGoogleTag;
  };

  const all: Array<{ platform: 'google' | 'linkedin' | 'meta'; creative: AdCreative }> = [];
  (ads.google_ads?.creatives || []).filter(isUsable).slice(0, 3).forEach(c => all.push({ platform: 'google', creative: c }));
  (ads.linkedin_ads?.creatives || []).filter(isUsable).slice(0, 3).forEach(c => all.push({ platform: 'linkedin', creative: c }));
  (ads.meta_ads?.creatives || []).filter(isUsable).slice(0, 3).forEach(c => all.push({ platform: 'meta', creative: c }));
  if (all.length === 0) return null;

  return (
    <Section kicker="04 / Live Ad Activity" title={<>What they're <Italic highlight>spending on, right now</Italic>.</>}>
      <SerifBody className="mb-10 max-w-2xl">
        Pulled live from public ad libraries: Google Ads Transparency Center, Meta Ads Library, LinkedIn Ad Library. Active campaigns, surfaced for context.
      </SerifBody>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {all.map((item, i) => (
          <AdCreativeCard key={i} creative={item.creative} platform={item.platform} />
        ))}
      </div>
    </Section>
  );
}

function Section4AiAdoption({ report }: { report: ReportJson }) {
  const { company_snapshot, anthropic_verified, openai_verified, linkedin_summary } = report;
  const signal = company_snapshot.ai_adoption_signal;

  // P1 #13: "Unknown" reframed as a sales motion (loss-frame) rather than a non-statement
  const meta: Record<string, { label: string; suffix?: string; tone: string; description: string }> = {
    early_adopter: { label: 'Early Adopter.', tone: 'var(--color-accent)', description: 'Actively integrating AI into operations. Ahead of the peer group.' },
    on_par: { label: 'On Par.', tone: '#A85439', description: 'Awareness is there, but deployment lags behind leading firms.' },
    behind: { label: 'Behind.', tone: '#9B2C2C', description: 'No AI tooling detected. Each month of delay compounds the gap.' },
    unknown: {
      label: 'Unknown.',
      suffix: "and that's data.",
      tone: 'rgba(26,26,26,0.85)',
      description: 'No verified AI provider, no LLM tooling in the public stack, no AI-themed posts in the last 30 days. Either the team is still scoping or the work is happening off-site. Both are gaps the Assessment closes.',
    },
  };
  const m = meta[signal] ?? meta.unknown;

  return (
    <Section kicker="05 / AI Adoption" title={<>Where they sit <Italic highlight>on the curve</Italic>.</>}>
      <div className="space-y-6 max-w-2xl">
        <h3 style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 'clamp(2.5rem, 5vw, 4rem)', lineHeight: 1, letterSpacing: '-0.02em', color: m.tone }}>
          {m.label}
          {m.suffix && <span style={{ fontStyle: 'italic', color: 'var(--color-accent)' }}> {m.suffix}</span>}
        </h3>
        <SerifBody large>{m.description}</SerifBody>
        {(anthropic_verified || openai_verified) && (
          <div className="px-5 py-4 border-l-2" style={{ borderColor: 'var(--color-accent)', background: 'rgba(76,110,61,0.04)' }}>
            <SerifBody>
              DNS verification confirms{' '}
              <Italic>
                {anthropic_verified && 'Anthropic'}{anthropic_verified && openai_verified && ' + '}{openai_verified && 'OpenAI'}
              </Italic>{' '}
              API usage. They're not experimenting. They're shipping.
            </SerifBody>
          </div>
        )}
        {!!linkedin_summary?.ai_mentions && linkedin_summary.ai_mentions > 0 && (
          <SerifBody>
            <Italic>{linkedin_summary.ai_mentions}</Italic> LinkedIn posts mentioning AI/automation in the last 30 days.
          </SerifBody>
        )}
      </div>
    </Section>
  );
}

function Section5Competitive({ report }: { report: ReportJson }) {
  if (!report.competitive_context && (!report.competitors || report.competitors.length === 0)) return null;
  return (
    <Section kicker="06 / Competitive Context" title={<>The <Italic highlight>field they play in</Italic>.</>}>
      <SerifBody large className="mb-8 max-w-2xl">{report.competitive_context}</SerifBody>
      {report.competitors.length > 0 && (
        <div className="space-y-px border-y border-[color:var(--color-hairline)]">
          {report.competitors.map((c, i) => (
            <a key={i} href={c.url} target="_blank" rel="noopener noreferrer"
               className="flex items-start gap-4 py-5 hover:bg-[rgba(26,26,26,0.02)] transition-colors group border-b border-[color:var(--color-hairline)] last:border-b-0">
              <div className="flex-1">
                <p style={{ fontFamily: SERIF, fontSize: '20px', letterSpacing: '-0.01em', color: '#1A1A1A' }} className="group-hover:text-accent transition-colors">{c.title}</p>
                {c.description && <SerifBody className="mt-1 line-clamp-2"><span style={{ fontSize: '15px' }}>{c.description}</span></SerifBody>}
              </div>
              <ExternalLink className="w-4 h-4 text-ink-mute mt-1.5 group-hover:text-accent transition-colors shrink-0" />
            </a>
          ))}
        </div>
      )}
    </Section>
  );
}

function Section6CTA({ report, companyName }: { report: ReportJson; companyName: string }) {
  const calendlyUrl = `${CALENDLY_BASE}?utm_source=scan&utm_content=${encodeURIComponent(companyName)}&a1=${encodeURIComponent(report.top_gap_title)}`;

  return (
    <section className="border-t border-[color:var(--color-hairline)] py-24 lg:py-32">
      <div className="max-w-3xl">
        <Kicker>Your next step</Kicker>
        <h2
          className="mt-6 mb-8"
          style={{
            fontFamily: SERIF,
            fontWeight: 400,
            fontSize: 'clamp(2.5rem, 6vw, 5rem)',
            lineHeight: 1,
            letterSpacing: '-0.02em',
            color: '#1A1A1A',
          }}
        >
          Your highest-priority gap is{' '}
          <Italic highlight>{report.top_gap_title}</Italic>.
        </h2>
        <SerifBody large className="mb-3 max-w-xl">{report.top_gap_summary}</SerifBody>
        <SerifBody className="mb-10 max-w-xl"><span style={{ color: 'rgba(26,26,26,0.55)' }}>In the Agent-Ready Assessment, we turn this into a 90-day implementation plan with tool selection, build sequence, and ROI model specific to your team.</span></SerifBody>
        <div className="flex flex-col sm:flex-row items-start gap-3">
          <a
            href={calendlyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2.5 px-7 py-3.5"
            style={{
              fontFamily: BODY_SERIF,
              fontWeight: 600,
              fontSize: '16px',
              backgroundColor: '#1A1A1A',
              color: '#F7F4EF',
            }}
          >
            Book your Agent-Ready Assessment <ArrowRight size={18} />
          </a>
          <Link
            to="/audit"
            className="inline-flex items-center gap-2 px-7 py-3.5 transition-colors"
            style={{
              fontFamily: BODY_SERIF,
              fontWeight: 600,
              fontSize: '16px',
              fontStyle: 'italic',
              color: 'rgba(26,26,26,0.55)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#1A1A1A')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(26,26,26,0.55)')}
          >
            Scan another company <ArrowRight size={16} />
          </Link>
        </div>
        <p className="mt-8" style={{ fontFamily: MONO, fontSize: '12px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.7)' }}>
          $2,000 · 1 week · 60-min findings walkthrough
        </p>
      </div>
    </section>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

const ScanReportPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { scan, loading, error } = useScan(slug ?? null);
  const reduceMotion = useReducedMotion();

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
          <p style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.65)' }}>Loading report</p>
        </div>
      </div>
    );
  }

  if (error || !scan || !scan.report_json) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="text-center max-w-sm px-6">
          <AlertCircle className="w-12 h-12 text-ink-mute mx-auto mb-4" />
          <h1 style={{ fontFamily: SERIF, fontSize: '32px', color: '#1A1A1A' }} className="mb-2">Report not available</h1>
          <SerifBody className="mb-6">
            {error ?? "This scan report isn't ready yet, or the link may be incorrect."}
          </SerifBody>
          <Link to="/audit" className="inline-flex items-center gap-2 hover:underline"
                style={{ fontFamily: MONO, fontSize: '12px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--color-accent)' }}>
            <ArrowLeft className="w-4 h-4" /> Run a new scan
          </Link>
        </div>
      </div>
    );
  }

  const report = scan.report_json;
  const companyName = scan.company_name ?? scan.domain;

  return (
    <div className="min-h-screen bg-paper text-ink">
      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur-sm border-b border-[color:var(--color-hairline)]" style={{ background: 'rgba(247,244,239,0.9)' }}>
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-4 flex items-center justify-between gap-3">
          <Link to="/" className="transition-colors hover:text-accent"
                style={{ fontFamily: BODY_SERIF, fontSize: '15px', fontWeight: 600, color: '#1A1A1A' }}>
            Iván Manfredi
          </Link>
          <span className="hidden md:block" style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.65)' }}>
            AI Opportunity Scan · {companyName}
          </span>
          <a
            href={`https://calendly.com/im-ivanmanfredi/30min?utm_source=scan`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-4"
            style={{
              fontFamily: BODY_SERIF,
              fontSize: '14px',
              fontWeight: 600,
              backgroundColor: '#1A1A1A',
              color: '#F7F4EF',
              minHeight: 44,
            }}
          >
            Book a call <ArrowRight size={14} />
          </a>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-5 sm:px-6 pb-24">
        {/* Hero */}
        <motion.div
          initial={reduceMotion ? false : { y: 16 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.7, ease: EASE }}
          className="pt-10 lg:pt-16 pb-12 lg:pb-20"
        >
          <div className="flex items-center gap-3 mb-8">
            <motion.span
              animate={reduceMotion ? undefined : { opacity: [1, 0.3, 1] }}
              transition={reduceMotion ? undefined : { duration: 2, repeat: Infinity }}
              style={{ color: 'var(--color-accent)', fontSize: '8px' }}
            >
              ●
            </motion.span>
            <span style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.65)' }}>
              AI Opportunity Scan · {new Date(scan.completed_at ?? scan.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>

          <div className="grid lg:grid-cols-[1fr_auto] gap-10 lg:gap-16 items-end">
            <div>
              {report.logo_url && (
                <img
                  src={report.logo_url}
                  alt=""
                  loading="lazy"
                  className="w-16 h-16 object-contain mb-6"
                  style={{ background: '#fff', border: '1px solid rgba(26,26,26,0.08)', padding: 6 }}
                  onError={fallbackOnError}
                />
              )}
              <motion.h1
                initial={reduceMotion ? false : { y: 10 }}
                animate={{ y: 0 }}
                transition={{ delay: 0.15, duration: 0.7, ease: EASE }}
                style={{
                  fontFamily: SERIF,
                  fontWeight: 400,
                  fontSize: 'clamp(3rem, 7vw, 6rem)',
                  lineHeight: 0.94,
                  letterSpacing: '-0.025em',
                  color: '#1A1A1A',
                  marginBottom: '1.25rem',
                }}
              >
                {companyName}
              </motion.h1>
              <SerifBody large className="max-w-xl">{report.score_rationale}</SerifBody>
            </div>

            {/* Score */}
            <div className="lg:w-80 lg:shrink-0">
              <Kicker>Automation Opportunity Score</Kicker>
              <div className="mt-4">
                <ScoreBar score={report.automation_score} grade={report.automation_grade} size="lg" />
              </div>
            </div>
          </div>

          {/* Teaser signals */}
          {report.teaser_signals && report.teaser_signals.length > 0 && (
            <motion.div
              initial={reduceMotion ? false : { y: 8 }}
              animate={{ y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="mt-16 grid sm:grid-cols-3 gap-6 lg:gap-10"
            >
              {report.teaser_signals.map((s, i) => (
                <div key={i} className="border-t-2 pt-4" style={{ borderColor: 'var(--color-accent)' }}>
                  <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.65)', marginBottom: 8 }}>
                    Signal {String(i + 1).padStart(2, '0')}
                  </p>
                  <SerifBody>{s.replace(/^⚠\s?/, '')}</SerifBody>
                </div>
              ))}
            </motion.div>
          )}
        </motion.div>

        {/* Sections */}
        <Section1CompanyBrief report={report} />
        <SectionFundingTraffic report={report} />
        <Section3Opportunities report={report} />
        <SectionAdActivity report={report} />
        <Section4AiAdoption report={report} />
        <Section5Competitive report={report} />
        <Section6CTA report={report} companyName={companyName} />
      </div>
    </div>
  );
};

export default ScanReportPage;

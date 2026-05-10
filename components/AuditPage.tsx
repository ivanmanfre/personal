// components/AuditPage.tsx
import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ArrowRight, AlertCircle, ExternalLink } from 'lucide-react';
import { useMetadata } from '../hooks/useMetadata';
import { submitScan, lookupProspectToken } from '../lib/scanApi';
import { useScan } from '../hooks/useScan';
import { ScoreBar } from './scan/ScoreBar';

type Stage = 'form' | 'processing' | 'teaser' | 'error';

const SERIF = '"DM Serif Display", "Bodoni Moda", Georgia, serif';
const BODY_SERIF = '"Source Serif 4", Georgia, serif';
const MONO = '"IBM Plex Mono", monospace';
const EASE = [0.22, 0.84, 0.36, 1] as const;

// Pipeline phases. Each starts at the listed elapsed second.
// Real pipeline averages 150-200s. The bar fills against EXPECTED_SECONDS — if the
// real scan completes earlier, useScan flips us to teaser immediately. If it takes
// longer, the bar caps at 95% so we never claim done before the data is in.
const EXPECTED_SECONDS = 180;
const PHASES: Array<{ at: number; label: string }> = [
  { at: 0,   label: 'Pulling DNS records and homepage stack' },
  { at: 25,  label: 'Reading their LinkedIn, jobs, and ad libraries' },
  { at: 75,  label: 'Cross-checking traffic and headcount signals' },
  { at: 130, label: 'Stitching the report together' },
  { at: 175, label: 'Almost ready' },
];

const AuditPage: React.FC = () => {
  useMetadata({
    title: 'Free AI Opportunity Scan | Manfredi',
    description:
      'See your business through the lens of an AI consultant. Enter your URL and get a full automation gap analysis in three minutes.',
    canonical: 'https://ivanmanfredi.com/audit',
  });

  const [searchParams] = useSearchParams();
  const ref = searchParams.get('ref');
  const reduceMotion = useReducedMotion();

  const [stage, setStage] = useState<Stage>('form');
  const [urlInput, setUrlInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [honeypot, setHoneypot] = useState(''); // Anti-spam: real users never see this. Bots auto-fill it.
  const [companySlug, setCompanySlug] = useState<string | null>(null);
  const [prospectCompanyName, setProspectCompanyName] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [formMountedAt] = useState(() => Date.now());

  // Pre-fill from prospect token
  useEffect(() => {
    if (!ref) return;
    lookupProspectToken(ref).then((token) => {
      if (!token) return;
      if (token.company_domain) setUrlInput(token.company_domain);
      if (token.company_name) setProspectCompanyName(token.company_name);
    });
  }, [ref]);

  // Subscribe to realtime once we have a company_slug
  const { scan } = useScan(companySlug, { realtime: true });

  // Transition to teaser only when complete AND the report payload has arrived.
  // Without the report_json gate, status can flip first and leave the teaser render blank.
  useEffect(() => {
    if (scan && scan.status === 'complete' && scan.report_json && stage === 'processing') {
      setStage('teaser');
    }
  }, [scan, stage]);

  // Safety: if status is complete but report_json never arrives within 8s, just redirect to /scan/<slug>.
  // Avoids a permanently-blank screen if the realtime subscription loses the report payload.
  useEffect(() => {
    if (stage !== 'processing' || !companySlug) return;
    if (!scan || scan.status !== 'complete' || scan.report_json) return;
    const id = setTimeout(() => { window.location.href = `/scan/${companySlug}`; }, 8000);
    return () => clearTimeout(id);
  }, [stage, scan, companySlug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const urlVal = urlInput.trim();
    const emailVal = emailInput.trim().toLowerCase();
    if (!urlVal || !emailVal) return;

    // Anti-spam: bot caught
    if (honeypot.trim().length > 0) {
      // Silent fail. Pretend it succeeded but never actually submit.
      setStage('processing');
      return;
    }
    // Anti-spam: form filled in <3 seconds → almost certainly a bot
    const fillTime = Date.now() - formMountedAt;
    if (fillTime < 3000) {
      setSubmitError('Please take a moment to verify the details and try again.');
      return;
    }

    setStage('processing');

    try {
      const result = await submitScan({ url: urlVal, email: emailVal, prospectToken: ref });
      setCompanySlug(result.company_slug);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Submission failed. Please try again.');
      setStage('form');
    }
  };

  return (
    <div className="min-h-screen bg-paper text-ink overflow-hidden">
      {/* Top progress sliver — only during processing, lives at the very edge of the viewport */}
      <ProcessingTopBar visible={stage === 'processing'} />

      <section className="pt-28 lg:pt-36 pb-24 px-5 sm:px-6">
        <div className="max-w-2xl mx-auto">

          {/* Byline — same vocabulary as landing hero */}
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="mb-7 flex items-center gap-3"
            style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.65)' }}
          >
            <motion.span
              animate={reduceMotion ? undefined : { opacity: [1, 0.3, 1] }}
              transition={reduceMotion ? undefined : { duration: 2, repeat: Infinity }}
              style={{ color: 'var(--color-accent)', fontSize: '8px' }}
            >●</motion.span>
            <span>Free · No credit card · ~3 minutes</span>
          </motion.div>

          {/* Editorial headline — sage marker-sweep on the italic word, matches landing Hero */}
          <motion.h1
            initial={reduceMotion ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85, ease: EASE }}
            className="mb-7"
            style={{
              fontFamily: SERIF, fontWeight: 400,
              fontSize: 'clamp(2.5rem, 6.5vw, 5rem)',
              lineHeight: 0.96,
              letterSpacing: '-0.02em',
              color: '#1A1A1A',
            }}
          >
            {prospectCompanyName ? (
              <>Scanning <Italic highlight reduce={!!reduceMotion}>{prospectCompanyName}</Italic>.</>
            ) : (
              <>See your business <Italic highlight reduce={!!reduceMotion}>through the lens</Italic> of an AI consultant.</>
            )}
          </motion.h1>

          {/* Lede — body serif, no em-dashes */}
          <motion.p
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.7 }}
            className="mb-12 max-w-xl"
            style={{
              fontFamily: BODY_SERIF, fontWeight: 400,
              fontSize: 'clamp(17px, 2.4vw, 19px)',
              lineHeight: 1.55,
              color: '#3D3D3B',
            }}
          >
            We pull your tech stack, ad activity, hiring, and traffic from 14 public sources. AI synthesizes the patterns. Ivan reviews every report before it ships.
          </motion.p>

          <AnimatePresence mode="wait">

            {/* ── FORM STAGE ───────────────────────────────────────── */}
            {stage === 'form' && (
              <motion.form
                key="form"
                initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.5 }}
                onSubmit={handleSubmit}
                className="space-y-7"
              >
                <FieldRow label="Company website" hint="we accept any format">
                  <input
                    id="scan-url"
                    type="text"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="acmerevops.com"
                    required
                    style={{ fontFamily: BODY_SERIF, fontSize: '18px', color: '#1A1A1A' }}
                    className="w-full bg-transparent border-0 border-b border-[color:var(--color-hairline-bold)] py-3 placeholder:text-[rgba(26,26,26,0.35)] focus:outline-none focus:border-accent transition-colors"
                  />
                </FieldRow>

                <FieldRow label="Work email" hint="we send the full report here">
                  <input
                    id="scan-email"
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="you@company.com"
                    required
                    style={{ fontFamily: BODY_SERIF, fontSize: '18px', color: '#1A1A1A' }}
                    className="w-full bg-transparent border-0 border-b border-[color:var(--color-hairline-bold)] py-3 placeholder:text-[rgba(26,26,26,0.35)] focus:outline-none focus:border-accent transition-colors"
                  />
                </FieldRow>

                {/* Honeypot: hidden from real users via off-screen positioning + tab-skip + autocomplete-off.
                    Bots that auto-fill all form fields will populate this and get silently rejected. */}
                <input
                  type="text"
                  name="company_role"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                  aria-hidden="true"
                  style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
                />

                {submitError && (
                  <div className="flex items-center gap-2" style={{ fontFamily: MONO, fontSize: '12px', color: '#9B2C2C' }}>
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {submitError}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full inline-flex items-center justify-center gap-2.5 px-7 py-4 transition-colors"
                  style={{
                    fontFamily: BODY_SERIF, fontWeight: 600, fontSize: '16px',
                    backgroundColor: '#1A1A1A', color: '#F7F4EF',
                  }}
                >
                  Run free scan
                  <ArrowRight className="w-4 h-4" />
                </button>

                <p className="text-center" style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.55)' }}>
                  14 public sources · 3 min · No spam, no follow-ups
                </p>
              </motion.form>
            )}

            {/* ── PROCESSING STAGE ─────────────────────────────────── */}
            {stage === 'processing' && (
              <ProcessingPanel
                key="processing"
                companyName={prospectCompanyName ?? extractDomainFromInput(urlInput)}
                onComplete={() => { /* useScan realtime fires the transition */ }}
              />
            )}

            {/* ── TEASER STAGE ─────────────────────────────────────── */}
            {stage === 'teaser' && scan && scan.report_json && (
              <motion.div
                key="teaser"
                initial={reduceMotion ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6, ease: EASE }}
                className="space-y-8"
              >
                <div className="border-t-2 border-[color:var(--color-accent)] pt-8 space-y-7">
                  {/* Company header */}
                  <div className="flex items-start gap-4">
                    {scan.logo_url && (
                      <img
                        src={scan.logo_url}
                        alt=""
                        className="w-12 h-12 object-contain shrink-0 mt-1"
                        style={{ background: '#fff', border: '1px solid rgba(26,26,26,0.08)', padding: 4 }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                    <div className="min-w-0">
                      <h2 style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 'clamp(1.75rem, 3vw, 2.25rem)', lineHeight: 1.1, color: '#1A1A1A' }}>
                        {scan.company_name || scan.domain}
                      </h2>
                      <p className="mt-1.5" style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.6)' }}>
                        {[
                          scan.company_size && `${scan.company_size} employees`,
                          scan.revenue_range,
                          scan.domain_age_years && `${scan.domain_age_years}-year-old domain`,
                        ].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  </div>

                  {/* Score */}
                  <div>
                    <p className="mb-3" style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.65)' }}>
                      Automation Maturity Score
                    </p>
                    <ScoreBar
                      score={scan.automation_score ?? 0}
                      grade={scan.automation_grade ?? 'N/A'}
                    />
                  </div>

                  {/* Signals */}
                  <div>
                    <p className="mb-4" style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.65)' }}>
                      What we found
                    </p>
                    <ul className="space-y-3">
                      {scan.report_json.teaser_signals.map((signal, i) => (
                        <li key={i} className="flex items-start gap-3" style={{ fontFamily: BODY_SERIF, fontSize: '16px', lineHeight: 1.5, color: '#1A1A1A' }}>
                          <span aria-hidden style={{ color: 'var(--color-accent)', fontSize: '14px', marginTop: 4 }}>—</span>
                          <span>{signal.replace(/^⚠\s?/, '')}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* CTA + email line */}
                <div className="space-y-4">
                  {companySlug && (
                    <Link
                      to={`/scan/${companySlug}`}
                      className="w-full inline-flex items-center justify-center gap-2.5 px-7 py-4 transition-colors"
                      style={{
                        fontFamily: BODY_SERIF, fontWeight: 600, fontSize: '16px',
                        backgroundColor: '#1A1A1A', color: '#F7F4EF',
                      }}
                    >
                      View full report on {scan.company_name || scan.domain}
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  )}
                  <p className="text-center" style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.55)' }}>
                    Full report also sent to {emailInput || 'your inbox'}
                  </p>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </section>
    </div>
  );
};

// ── Pieces ──────────────────────────────────────────────────────────────────

// Shared label/hint chrome above each editorial form field
const FieldRow: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({
  label, hint, children,
}) => (
  <div>
    <div className="flex items-baseline justify-between gap-3 mb-1">
      <label style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.65)' }}>
        {label}
      </label>
      {hint && (
        <span style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.45)' }}>
          {hint}
        </span>
      )}
    </div>
    {children}
  </div>
);

// Italic with optional sage marker-sweep behind text — same primitive used in Hero + ScanReport
const Italic: React.FC<{ children: React.ReactNode; highlight?: boolean; reduce?: boolean }> = ({
  children, highlight, reduce,
}) => {
  if (!highlight) return <span style={{ fontStyle: 'italic', color: 'var(--color-accent)' }}>{children}</span>;
  return (
    <span style={{ fontStyle: 'italic', position: 'relative', color: '#1A1A1A' }}>
      {children}
      <motion.span
        aria-hidden
        initial={reduce ? false : { scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: 0.9, duration: 0.9, ease: EASE }}
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

// Top-of-viewport sage progress sliver — fills against EXPECTED_SECONDS, caps at 95%.
const ProcessingTopBar: React.FC<{ visible: boolean }> = ({ visible }) => {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    if (!visible) { setPct(0); return; }
    const start = Date.now();
    const id = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000;
      // Cap at 95% — last 5% reserved for the "complete" transition
      setPct(Math.min(95, (elapsed / EXPECTED_SECONDS) * 100));
    }, 200);
    return () => clearInterval(id);
  }, [visible]);
  if (!visible) return null;
  return (
    <div
      aria-hidden
      style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 2, background: 'rgba(26,26,26,0.06)', zIndex: 60 }}
    >
      <div
        style={{
          height: '100%',
          width: `${pct}%`,
          background: 'var(--color-accent)',
          transition: 'width 0.2s linear',
        }}
      />
    </div>
  );
};

// Processing stage panel — phase copy, big typographic progress bar, elapsed / expected counter.
const ProcessingPanel: React.FC<{ companyName: string; onComplete: () => void }> = ({
  companyName,
}) => {
  const reduceMotion = useReducedMotion();
  const [elapsed, setElapsed] = useState(0);
  const start = useRef(Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed((Date.now() - start.current) / 1000);
    }, 250);
    return () => clearInterval(id);
  }, []);

  const phase = PHASES.slice().reverse().find((p) => elapsed >= p.at) ?? PHASES[0];
  // Progress against EXPECTED_SECONDS, capped at 95% so we never claim done early
  const pct = Math.min(95, (elapsed / EXPECTED_SECONDS) * 100);
  const elapsedDisplay = formatElapsed(elapsed);
  const remainingDisplay = elapsed >= EXPECTED_SECONDS
    ? 'finishing up'
    : `${Math.ceil((EXPECTED_SECONDS - elapsed) / 5) * 5}s left`;

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.5 }}
      className="space-y-10"
    >
      {/* Phase headline */}
      <div className="border-t-2 border-[color:var(--color-accent)] pt-8">
        <p style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.65)' }}>
          Scanning {companyName || 'your company'}
        </p>
        <AnimatePresence mode="wait">
          <motion.h2
            key={phase.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="mt-3"
            style={{
              fontFamily: SERIF, fontWeight: 400,
              fontSize: 'clamp(1.5rem, 3vw, 2.25rem)', lineHeight: 1.15, letterSpacing: '-0.015em',
              color: '#1A1A1A',
            }}
          >
            {phase.label}<span style={{ color: 'var(--color-accent)' }}>.</span>
          </motion.h2>
        </AnimatePresence>
      </div>

      {/* Big progress bar */}
      <div>
        <div className="flex items-baseline justify-between gap-3 mb-3">
          <p style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.65)' }}>
            Progress
          </p>
          <p style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.5)' }}>
            <span style={{ color: '#1A1A1A' }}>{elapsedDisplay}</span> elapsed · {remainingDisplay}
          </p>
        </div>
        <div style={{ height: 4, background: 'rgba(26,26,26,0.08)', position: 'relative', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${pct}%`,
              background: 'var(--color-accent)',
              transition: 'width 0.3s linear',
            }}
          />
          {/* Subtle pulse shimmer at the leading edge so it reads as alive even when width updates are slow */}
          {!reduceMotion && (
            <motion.div
              animate={{ opacity: [0.4, 0.85, 0.4] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                position: 'absolute', top: 0, bottom: 0,
                left: `calc(${pct}% - 4px)`,
                width: 8,
                background: 'var(--color-accent)',
                filter: 'blur(3px)',
              }}
            />
          )}
        </div>

        {/* Phase ticks under the bar — visualizes the pipeline as 5 beats */}
        <div className="flex items-center mt-4" style={{ fontFamily: MONO, fontSize: '9px', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
          {PHASES.map((p, i) => {
            const reached = elapsed >= p.at;
            const flex = i === PHASES.length - 1 ? 0 : (PHASES[i + 1].at - p.at);
            return (
              <div
                key={p.at}
                style={{ flex: flex || 0, color: reached ? 'var(--color-accent)' : 'rgba(26,26,26,0.35)' }}
                className="relative flex items-start gap-2"
              >
                <span style={{ fontSize: '7px', lineHeight: '12px' }}>●</span>
                <span className="hidden sm:inline truncate" style={{ paddingRight: 8 }}>{p.label.split(' ').slice(0, 3).join(' ')}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Reassurance line — generic; never name vendors */}
      <p style={{ fontFamily: BODY_SERIF, fontSize: '15px', lineHeight: 1.55, color: 'rgba(26,26,26,0.6)' }}>
        Pulling tech stack, traffic, ad activity, hiring, and public DNS. The full report typically lands in two to three minutes. Leave this tab open or close it. We'll email the link when it's ready.
      </p>
    </motion.div>
  );
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatElapsed(seconds: number): string {
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m === 0) return `${r}s`;
  return `${m}m ${String(r).padStart(2, '0')}s`;
}

// Strip protocol + path so we can show "acmerevops.com" instead of "https://acmerevops.com/about"
function extractDomainFromInput(raw: string): string {
  const t = raw.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '').replace(/^www\./i, '');
  return t || 'your company';
}

export default AuditPage;

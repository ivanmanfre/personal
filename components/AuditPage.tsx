// components/AuditPage.tsx
import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, AlertCircle, ExternalLink, Zap } from 'lucide-react';
import { useMetadata } from '../hooks/useMetadata';
import { submitScan, lookupProspectToken, gradeColor } from '../lib/scanApi';
import { useScan } from '../hooks/useScan';
import { ScoreBar } from './scan/ScoreBar';

type Stage = 'form' | 'processing' | 'teaser' | 'error';

const PROCESSING_STEPS = [
  'Scanning company data...',
  'Analyzing tech stack and job postings...',
  'Identifying automation gaps...',
  'Generating your report...',
];

const AuditPage: React.FC = () => {
  useMetadata({
    title: 'Free AI Opportunity Scan | Manfredi',
    description:
      'See what your business looks like from the outside — and what it\'s costing you. Enter your website URL and get a full automation gap analysis.',
    canonical: 'https://ivanmanfredi.com/audit',
  });

  const [searchParams] = useSearchParams();
  const ref = searchParams.get('ref');

  const [stage, setStage] = useState<Stage>('form');
  const [urlInput, setUrlInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [honeypot, setHoneypot] = useState(''); // Anti-spam: real users never see this. Bots auto-fill it.
  const [companySlug, setCompanySlug] = useState<string | null>(null);
  const [prospectCompanyName, setProspectCompanyName] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [processingStep, setProcessingStep] = useState(0);
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

  // Cycle processing step text while pipeline runs
  useEffect(() => {
    if (stage !== 'processing') return;
    const interval = setInterval(() => {
      setProcessingStep((s) => Math.min(s + 1, PROCESSING_STEPS.length - 1));
    }, 20000);
    return () => clearInterval(interval);
  }, [stage]);

  // Subscribe to realtime once we have a company_slug
  const { scan } = useScan(companySlug, { realtime: true });

  // Transition to teaser when scan completes
  useEffect(() => {
    if (scan && scan.status === 'complete' && stage === 'processing') {
      setStage('teaser');
    }
  }, [scan, stage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const urlVal = urlInput.trim();
    const emailVal = emailInput.trim().toLowerCase();
    if (!urlVal || !emailVal) return;

    // Anti-spam: bot caught
    if (honeypot.trim().length > 0) {
      // Silent fail — don't tell the bot why. Pretend it succeeded but never actually submit.
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
    setProcessingStep(0);

    try {
      const result = await submitScan({ url: urlVal, email: emailVal, prospectToken: ref });
      setCompanySlug(result.company_slug);

      // If already cached (< 7 days), it's already complete — fetch directly
      if (result.is_cached) {
        // useScan will pick it up on next render since company_slug is now set
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Submission failed. Please try again.');
      setStage('form');
    }
  };

  return (
    <div className="min-h-screen bg-paper">
      <section className="pt-32 pb-24 px-6">
        <div className="container mx-auto max-w-2xl">

          {/* Eyebrow */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <span className="inline-block text-xs uppercase tracking-[0.1em] font-medium text-ink-soft border border-[color:var(--color-hairline-bold)] rounded px-2 py-1">
              Free · No credit card · 60 seconds
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="text-4xl sm:text-5xl font-bold font-display text-ink leading-tight mb-4"
          >
            {prospectCompanyName
              ? `Scanning ${prospectCompanyName}`
              : 'AI Opportunity Scan'}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg text-ink-soft mb-12 leading-relaxed"
          >
            See what your business looks like from the outside — and what it's costing you.
          </motion.p>

          <AnimatePresence mode="wait">

            {/* ── FORM STAGE ───────────────────────────────────────── */}
            {stage === 'form' && (
              <motion.form
                key="form"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                onSubmit={handleSubmit}
                className="space-y-4"
              >
                <div>
                  <label htmlFor="scan-url" className="block text-sm font-medium text-ink mb-1.5">
                    Company website
                  </label>
                  <input
                    id="scan-url"
                    type="text"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="acmerevops.com"
                    required
                    className="w-full px-4 py-3 bg-paper-raise border border-[color:var(--color-hairline-bold)] rounded-lg text-ink placeholder:text-ink-mute focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="scan-email" className="block text-sm font-medium text-ink mb-1.5">
                    Work email <span className="text-ink-mute font-normal">(we'll send the full report here)</span>
                  </label>
                  <input
                    id="scan-email"
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="you@company.com"
                    required
                    className="w-full px-4 py-3 bg-paper-raise border border-[color:var(--color-hairline-bold)] rounded-lg text-ink placeholder:text-ink-mute focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-colors"
                  />
                </div>

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
                  <div className="flex items-center gap-2 text-red-600 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {submitError}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 bg-accent text-white font-semibold px-6 py-3.5 rounded-lg hover:bg-accent-ink transition-colors"
                >
                  Run Free Scan
                  <ArrowRight className="w-4 h-4" />
                </button>

                <p className="text-xs text-ink-mute text-center">
                  Pulls from 14+ public data sources · Takes ~60 seconds · No spam
                </p>
              </motion.form>
            )}

            {/* ── PROCESSING STAGE ─────────────────────────────────── */}
            {stage === 'processing' && (
              <motion.div
                key="processing"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="text-center space-y-6"
              >
                <div className="relative mx-auto w-16 h-16">
                  <div className="absolute inset-0 rounded-full border-2 border-accent/20" />
                  <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent animate-spin" />
                  <Zap className="absolute inset-0 m-auto w-6 h-6 text-accent" />
                </div>

                <div>
                  <p className="font-semibold text-ink text-lg">
                    {PROCESSING_STEPS[processingStep]}
                  </p>
                  <p className="text-ink-mute text-sm mt-1">
                    Usually completes in 60–90 seconds
                  </p>
                </div>

                <div className="flex justify-center gap-1.5">
                  {PROCESSING_STEPS.map((_, i) => (
                    <div
                      key={i}
                      className={`h-1 rounded-full transition-all duration-500 ${
                        i <= processingStep
                          ? 'w-6 bg-accent'
                          : 'w-2 bg-[color:var(--color-hairline-bold)]'
                      }`}
                    />
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── TEASER STAGE ─────────────────────────────────────── */}
            {stage === 'teaser' && scan && scan.report_json && (
              <motion.div
                key="teaser"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                {/* Teaser card */}
                <div className="border border-[color:var(--color-hairline-bold)] rounded-xl p-6 bg-paper-raise shadow-card-lift space-y-5">
                  {/* Company header */}
                  <div className="flex items-center gap-4">
                    {scan.logo_url && (
                      <img
                        src={scan.logo_url}
                        alt=""
                        className="w-12 h-12 rounded-lg object-contain bg-white border border-[color:var(--color-hairline)] p-1"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                    <div>
                      <p className="font-bold text-ink text-lg leading-tight">
                        {scan.company_name || scan.domain}
                      </p>
                      <p className="text-xs text-ink-mute mt-0.5">
                        {[
                          scan.company_size && `${scan.company_size} employees`,
                          scan.revenue_range,
                          scan.domain_age_years && `Founded ~${new Date().getFullYear() - scan.domain_age_years}`,
                        ].filter(Boolean).join(' · ')}
                      </p>
                      <p className="text-xs text-ink-mute">
                        {[
                          scan.email_infra === 'google_workspace' ? '📧 Google Workspace' :
                          scan.email_infra === 'microsoft_365' ? '📧 Microsoft 365' : null,
                          scan.domain_age_years && `🌐 Domain age: ${scan.domain_age_years} years`,
                        ].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  </div>

                  {/* Score */}
                  <div>
                    <p className="text-xs uppercase tracking-wider font-medium text-ink-mute mb-3">
                      Automation Opportunity Score
                    </p>
                    <ScoreBar
                      score={scan.automation_score ?? 0}
                      grade={scan.automation_grade ?? 'N/A'}
                    />
                  </div>

                  {/* Signals */}
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wider font-medium text-ink-mute">
                      3 signals found
                    </p>
                    {scan.report_json.teaser_signals.map((signal, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-ink-soft">
                        <span className="shrink-0 mt-0.5">⚠</span>
                        <span>{signal.replace(/^⚠\s?/, '')}</span>
                      </div>
                    ))}
                  </div>

                  {/* Count */}
                  <p className="text-sm text-ink font-medium">
                    We found {scan.report_json.opportunities.length} automation gaps in{' '}
                    {scan.company_name || scan.domain}.
                  </p>
                </div>

                {/* Email + report CTA */}
                <div className="text-center space-y-3">
                  <p className="text-sm text-ink-mute">
                    Full analysis in your inbox — usually &lt; 5 min.
                  </p>
                  {companySlug && (
                    <Link
                      to={`/scan/${companySlug}`}
                      className="inline-flex items-center gap-2 bg-accent text-white font-semibold px-6 py-3 rounded-lg hover:bg-accent-ink transition-colors"
                    >
                      View Full Report
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  )}
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </section>
    </div>
  );
};

export default AuditPage;

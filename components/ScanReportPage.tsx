// components/ScanReportPage.tsx
import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Building2, Globe, Mail, Calendar, Zap, TrendingUp,
  ExternalLink, CheckCircle, XCircle, AlertCircle, ArrowLeft
} from 'lucide-react';
import { useScan } from '../hooks/useScan';
import { ScoreBar } from './scan/ScoreBar';
import { OpportunityCard } from './scan/OpportunityCard';
import { gradeColor } from '../lib/scanApi';
import type { ReportJson } from '../lib/scanTypes';

const CALENDLY_BASE = 'https://calendly.com/im-ivanmanfredi/30min';

// ── Section wrapper ───────────────────────────────────────────────────────────
const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({
  title, icon, children,
}) => (
  <section className="border-b border-[color:var(--color-hairline)] py-12">
    <div className="flex items-center gap-3 mb-8">
      <span className="text-accent">{icon}</span>
      <h2 className="text-xl font-bold text-ink font-display">{title}</h2>
    </div>
    {children}
  </section>
);

// ── Chip ─────────────────────────────────────────────────────────────────────
const Chip: React.FC<{ label: string; variant?: 'found' | 'missing' | 'neutral' }> = ({
  label, variant = 'neutral',
}) => {
  const cls =
    variant === 'found' ? 'bg-accent-soft text-accent-ink border-accent/20' :
    variant === 'missing' ? 'bg-red-50 text-red-700 border-red-200' :
    'bg-paper-sunk text-ink-soft border-[color:var(--color-hairline)]';
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded border font-medium ${cls}`}>
      {variant === 'found' && <CheckCircle className="w-3 h-3" />}
      {variant === 'missing' && <XCircle className="w-3 h-3" />}
      {label}
    </span>
  );
};

// ── Report sections ───────────────────────────────────────────────────────────

function Section1CompanyBrief({ report }: { report: ReportJson }) {
  const { company_snapshot, company_name, logo_url, company_size, revenue_range,
    domain_age_years, email_infra, anthropic_verified, openai_verified,
    tech_stack_assessment, clutch_data, linkedin_summary, github, ads_summary } = report;

  return (
    <Section title="Company Intelligence Brief" icon={<Building2 className="w-5 h-5" />}>
      {/* Snapshot */}
      <div className="flex items-start gap-5 mb-8">
        {logo_url && (
          <img
            src={logo_url}
            alt=""
            className="w-16 h-16 rounded-xl object-contain bg-white border border-[color:var(--color-hairline)] p-1.5 shrink-0"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        )}
        <div>
          <h3 className="text-2xl font-bold font-display text-ink">{company_name}</h3>
          <p className="text-ink-soft mt-1 leading-relaxed">{company_snapshot.one_liner}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-ink-mute">
            {company_size && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{company_size} employees</span>}
            {revenue_range && <span>{revenue_range} revenue</span>}
            {domain_age_years && <span className="flex items-center gap-1"><Globe className="w-3 h-3" />Domain age: {domain_age_years} years</span>}
            {email_infra && (
              <span className="flex items-center gap-1">
                <Mail className="w-3 h-3" />
                {email_infra === 'google_workspace' ? 'Google Workspace' :
                 email_infra === 'microsoft_365' ? 'Microsoft 365' : 'Custom email infra'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* AI adoption signal */}
      {(anthropic_verified || openai_verified) && (
        <div className="flex items-center gap-3 bg-accent-soft border border-accent/20 rounded-lg px-4 py-3 mb-6">
          <Zap className="w-5 h-5 text-accent shrink-0" />
          <p className="text-sm text-accent-ink font-medium">
            DNS records confirm active {anthropic_verified ? 'Anthropic' : ''}{anthropic_verified && openai_verified ? ' + ' : ''}{openai_verified ? 'OpenAI' : ''} API usage — this company is already experimenting with AI. The gap is operationalization, not awareness.
          </p>
        </div>
      )}

      {/* Tech stack */}
      <div className="mb-6">
        <p className="text-sm font-semibold text-ink mb-3">Tech Stack</p>
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-ink-mute w-20 shrink-0 pt-1">Confirmed</span>
            <div className="flex flex-wrap gap-1.5">
              {tech_stack_assessment.confirmed_tools.length > 0
                ? tech_stack_assessment.confirmed_tools.map(t => <Chip key={t} label={t} variant="found" />)
                : <span className="text-xs text-ink-mute">None detected</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-ink-mute w-20 shrink-0 pt-1">Missing</span>
            <div className="flex flex-wrap gap-1.5">
              {tech_stack_assessment.missing_critical_tools.length > 0
                ? tech_stack_assessment.missing_critical_tools.map(t => <Chip key={t} label={t} variant="missing" />)
                : <span className="text-xs text-ink-mute">No critical gaps detected</span>}
            </div>
          </div>
        </div>
        <p className="text-sm text-ink-soft mt-3 leading-relaxed">{tech_stack_assessment.sophistication_notes}</p>
      </div>

      {/* Ad signals */}
      {ads_summary && (
        <div className="mb-6">
          <p className="text-sm font-semibold text-ink mb-3">Advertising Activity</p>
          <div className="flex flex-wrap gap-2">
            <Chip
              label={`Google Ads: ${ads_summary.google_ads ?? 'unknown'}`}
              variant={ads_summary.google_ads === 'confirmed' || ads_summary.google_ads === 'probable' ? 'found' : 'neutral'}
            />
            <Chip
              label={`LinkedIn Ads: ${ads_summary.linkedin_ads ? 'confirmed' : 'not detected'}`}
              variant={ads_summary.linkedin_ads ? 'found' : 'neutral'}
            />
            <Chip
              label={`Meta Ads: ${ads_summary.meta_ads === null ? 'n/a' : ads_summary.meta_ads ? 'confirmed' : 'not detected'}`}
              variant={ads_summary.meta_ads ? 'found' : 'neutral'}
            />
          </div>
        </div>
      )}

      {/* Clutch */}
      {clutch_data && (
        <div className="mb-6 border border-[color:var(--color-hairline)] rounded-lg p-4">
          <p className="text-sm font-semibold text-ink mb-2">Clutch Profile</p>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink-soft">
            {clutch_data.rating && <span>⭐ {clutch_data.rating} rating</span>}
            {clutch_data.hourly_rate && <span>💰 {clutch_data.hourly_rate}/hr</span>}
            {clutch_data.services?.length > 0 && (
              <span>🎯 {clutch_data.services.slice(0, 2).map(s => s.name).join(', ')}</span>
            )}
          </div>
        </div>
      )}

      {/* LinkedIn */}
      {linkedin_summary && (
        <div>
          <p className="text-sm font-semibold text-ink mb-2">LinkedIn Activity</p>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink-soft">
            {linkedin_summary.followers != null && <span>{linkedin_summary.followers.toLocaleString()} followers</span>}
            {linkedin_summary.posts_30d != null && <span>{linkedin_summary.posts_30d} posts in last 30d</span>}
            {linkedin_summary.last_post_days != null && (
              <span className={linkedin_summary.last_post_days > 30 ? 'text-amber-600' : ''}>
                Last post: {linkedin_summary.last_post_days} days ago
              </span>
            )}
            {linkedin_summary.ai_mentions != null && linkedin_summary.ai_mentions > 0 && (
              <span className="text-accent">{linkedin_summary.ai_mentions} AI/automation posts</span>
            )}
          </div>
        </div>
      )}

      {/* GitHub */}
      {github && (
        <div className="mt-4">
          <p className="text-sm font-semibold text-ink mb-1">GitHub Presence</p>
          <p className="text-sm text-ink-soft">{github.repos} public repositories — engineers on staff.</p>
        </div>
      )}
    </Section>
  );
}

function Section2GapTable({ report }: { report: ReportJson }) {
  const { tech_stack_assessment } = report;
  return (
    <Section title="Automation Stack Assessment" icon={<TrendingUp className="w-5 h-5" />}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-lg border border-[color:var(--color-hairline)] p-4">
          <p className="text-xs uppercase tracking-wider font-medium text-accent mb-3">Confirmed tools</p>
          <div className="flex flex-wrap gap-2">
            {tech_stack_assessment.confirmed_tools.length > 0
              ? tech_stack_assessment.confirmed_tools.map(t => <Chip key={t} label={t} variant="found" />)
              : <p className="text-sm text-ink-mute">No tools confirmed</p>}
          </div>
        </div>
        <div className="rounded-lg border border-red-100 bg-red-50/30 p-4">
          <p className="text-xs uppercase tracking-wider font-medium text-red-600 mb-3">Missing / gaps</p>
          <div className="flex flex-wrap gap-2">
            {tech_stack_assessment.missing_critical_tools.length > 0
              ? tech_stack_assessment.missing_critical_tools.map(t => <Chip key={t} label={t} variant="missing" />)
              : <p className="text-sm text-ink-mute">No critical gaps identified</p>}
          </div>
        </div>
      </div>
      <p className="text-sm text-ink-soft mt-4 leading-relaxed">{tech_stack_assessment.sophistication_notes}</p>
    </Section>
  );
}

function Section3Opportunities({ report }: { report: ReportJson }) {
  return (
    <Section title={`${report.opportunities.length} Automation Opportunities`} icon={<AlertCircle className="w-5 h-5" />}>
      <p className="text-sm text-ink-soft mb-6">
        Each gap is sourced from specific data signals — job postings, tech stack, Clutch reviews, ad activity.
      </p>
      <div className="space-y-3">
        {report.opportunities.map((opp, i) => (
          <OpportunityCard key={i} opportunity={opp} index={i} />
        ))}
      </div>
    </Section>
  );
}

function Section4AiAdoption({ report }: { report: ReportJson }) {
  const { company_snapshot, anthropic_verified, openai_verified, linkedin_summary } = report;
  const signal = company_snapshot.ai_adoption_signal;

  const labels: Record<string, { label: string; color: string; description: string }> = {
    early_adopter: {
      label: 'Early Adopter',
      color: '#4C6E3D',
      description: 'This company is actively integrating AI into operations — ahead of their peer group.',
    },
    on_par: {
      label: 'On Par',
      color: '#D97706',
      description: 'Awareness is there, but deployment lags behind leading firms in this space.',
    },
    behind: {
      label: 'Behind',
      color: '#EA580C',
      description: 'No AI tooling detected. Every month of delay is compounding opportunity cost.',
    },
    unknown: {
      label: 'Unknown',
      color: '#9CA3AF',
      description: 'Insufficient signals to benchmark AI adoption for this company.',
    },
  };

  const meta = labels[signal] ?? labels.unknown;

  return (
    <Section title="AI Adoption Signal" icon={<Zap className="w-5 h-5" />}>
      <div className="flex items-center gap-3 mb-4">
        <span
          className="text-xl font-bold font-display"
          style={{ color: meta.color }}
        >
          {meta.label}
        </span>
      </div>
      <p className="text-sm text-ink-soft leading-relaxed mb-4">{meta.description}</p>
      {(anthropic_verified || openai_verified) && (
        <div className="bg-accent-soft border border-accent/20 rounded-lg px-4 py-3 text-sm text-accent-ink">
          DNS verification confirms {anthropic_verified ? 'Anthropic API' : ''}{anthropic_verified && openai_verified ? ' + ' : ''}{openai_verified ? 'OpenAI API' : ''} usage. They're not experimenting — they're shipping.
        </div>
      )}
      {linkedin_summary?.ai_mentions != null && linkedin_summary.ai_mentions > 0 && (
        <p className="text-sm text-ink-soft mt-3">
          {linkedin_summary.ai_mentions} LinkedIn posts mentioning AI/automation in the past 30 days.
        </p>
      )}
    </Section>
  );
}

function Section5Competitive({ report }: { report: ReportJson }) {
  return (
    <Section title="Competitive Context" icon={<Globe className="w-5 h-5" />}>
      <p className="text-sm text-ink-soft leading-relaxed mb-6">{report.competitive_context}</p>
      {report.competitors.length > 0 && (
        <div className="space-y-3">
          {report.competitors.map((c, i) => (
            <a
              key={i}
              href={c.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 p-3 rounded-lg border border-[color:var(--color-hairline)] hover:border-accent/30 hover:bg-accent-soft/50 transition-colors group"
            >
              <ExternalLink className="w-4 h-4 text-ink-mute shrink-0 mt-0.5 group-hover:text-accent" />
              <div>
                <p className="text-sm font-medium text-ink group-hover:text-accent">{c.title}</p>
                <p className="text-xs text-ink-mute mt-0.5 line-clamp-2">{c.description}</p>
              </div>
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
    <section className="py-16 text-center">
      <p className="text-xs uppercase tracking-wider font-medium text-ink-mute mb-4">Your next step</p>
      <h2 className="text-3xl font-bold font-display text-ink mb-4 leading-tight max-w-xl mx-auto">
        Your highest-priority gap is{' '}
        <span className="text-accent">{report.top_gap_title}</span>.
      </h2>
      <p className="text-ink-soft leading-relaxed max-w-lg mx-auto mb-2">
        {report.top_gap_summary}
      </p>
      <p className="text-sm text-ink-mute mb-8 max-w-lg mx-auto">
        In the Agent-Ready Assessment, we'd turn this into a 90-day implementation plan with tool selection, build sequence, and ROI model specific to your team.
      </p>
      <a
        href={calendlyUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 bg-accent text-white font-semibold px-8 py-4 rounded-lg hover:bg-accent-ink transition-colors text-lg"
      >
        Book Your Agent-Ready Assessment
        <Calendar className="w-5 h-5" />
      </a>
      <p className="text-xs text-ink-mute mt-4">
        $2,500 · 1 week · 60-min findings walkthrough
      </p>
    </section>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
const ScanReportPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { scan, loading, error } = useScan(slug ?? null);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
          <p className="text-sm text-ink-mute">Loading report...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !scan || !scan.report_json) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="text-center max-w-sm px-6">
          <AlertCircle className="w-12 h-12 text-ink-mute mx-auto mb-4" />
          <h1 className="text-xl font-bold font-display text-ink mb-2">Report not available</h1>
          <p className="text-sm text-ink-soft mb-6">
            {error ?? 'This scan report isn\'t ready yet, or the link may be incorrect.'}
          </p>
          <Link
            to="/audit"
            className="inline-flex items-center gap-2 text-accent font-medium text-sm hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            Run a new scan
          </Link>
        </div>
      </div>
    );
  }

  const report = scan.report_json;
  const companyName = scan.company_name ?? scan.domain;

  return (
    <div className="min-h-screen bg-paper">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-paper/90 backdrop-blur-sm border-b border-[color:var(--color-hairline)]">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="text-sm font-semibold text-ink hover:text-accent transition-colors">
            Ivan Manfredi
          </Link>
          <span className="text-xs text-ink-mute hidden sm:block">
            AI Opportunity Scan · {companyName}
          </span>
          <a
            href={`https://calendly.com/im-ivanmanfredi/30min?utm_source=scan`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium bg-accent text-white px-3 py-1.5 rounded-md hover:bg-accent-ink transition-colors"
          >
            Book a call →
          </a>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 pb-24">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="pt-16 pb-12 border-b border-[color:var(--color-hairline)]"
        >
          <div className="flex items-center gap-4 mb-6">
            {report.logo_url && (
              <img
                src={report.logo_url}
                alt=""
                className="w-14 h-14 rounded-xl object-contain bg-white border border-[color:var(--color-hairline)] p-1.5"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
            <div>
              <p className="text-xs uppercase tracking-wider text-ink-mute font-medium mb-1">AI Opportunity Scan</p>
              <h1 className="text-3xl font-bold font-display text-ink">{companyName}</h1>
            </div>
          </div>

          <div className="max-w-xs">
            <p className="text-xs uppercase tracking-wider font-medium text-ink-mute mb-3">
              Automation Opportunity Score
            </p>
            <ScoreBar score={report.automation_score} grade={report.automation_grade} size="lg" />
          </div>
          <p className="text-sm text-ink-soft mt-4 leading-relaxed max-w-xl">{report.score_rationale}</p>

          {/* Teaser signals */}
          <div className="mt-6 space-y-2">
            {report.teaser_signals.map((s, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-ink-soft">
                <span className="text-amber-500 shrink-0 mt-0.5">⚠</span>
                <span>{s.replace(/^⚠\s?/, '')}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Report sections */}
        <Section1CompanyBrief report={report} />
        <Section2GapTable report={report} />
        <Section3Opportunities report={report} />
        <Section4AiAdoption report={report} />
        <Section5Competitive report={report} />
        <Section6CTA report={report} companyName={companyName} />
      </div>
    </div>
  );
};

export default ScanReportPage;

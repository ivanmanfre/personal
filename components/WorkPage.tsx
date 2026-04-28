import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useMetadata } from '../hooks/useMetadata';

type Case = {
  id: string;
  client: string;
  anonymized?: boolean;
  industry: string;
  title: React.ReactNode;
  metric: string;
  problem: string;
  solution: string;
  outcome: string;
  images?: string[];
  imageAlts?: string[];
};

const cases: Case[] = [
  {
    id: '01',
    client: 'ProvalTech',
    industry: 'Sales Tech',
    title: <>AI call auditing, <span className="font-drama italic">at 100% coverage.</span></>,
    metric: '5% sampled → 100% graded',
    problem: "ProvalTech records every sales call in Fireflies. But with multiple call types and a shared recording account, there was no consistent view of rep performance, no fast escalation path when customer risk appeared, and no way to compare reps fairly across different call shapes.",
    solution: "Built a system that ingests every finished call, evaluates it on service and expertise criteria, calculates a final score that adapts to the call type, emails each participant their own summary and action items, and alerts leadership when real risk surfaces, with the excerpt and recording link attached. Internal and solo calls filter out automatically so reports stay clean. Airtable dashboards surface per-call detail, per-rep scorecards, trends, and an issues board.",
    outcome: "Coverage moved from 5% sampled to 100% of calls, escalation from days to the next morning, and every rep now gets personalized feedback after every customer conversation. Zero additional manual work for the team.",
    images: ['/cases/provaltech.png', '/cases/provaltech-detail.png'],
    imageAlts: ['ProvalTech Call Performance Dashboard showing per-call scores and trends', 'Individual call scorecard with criteria scores and quality assessment'],
  },
  {
    id: '02',
    client: 'Marketing Coach',
    anonymized: true,
    industry: 'Agency Operations',
    title: <>A lead magnet system that <span className="font-drama italic">runs itself after approval.</span></>,
    metric: '15 min · idea to launched',
    problem: "Every lead magnet took days of manual work across disconnected tools: writing the content, building landing and resource pages, configuring the email sequence, wiring the tracking link, formatting the spreadsheet if it was a calculator. Output was capped by how much assembly one person could grind through each week.",
    solution: "Built a system where a single idea submitted in the project tool generates the full package in under 15 minutes. AI drafts everything grounded on the founder's masterclass transcripts and top-performing posts via RAG, in the founder's voice. He reviews and approves. The system then auto-builds every downstream asset in parallel: live landing page, live resource page on the founder's subdomain, email draft ready to activate, geo-routed smart link, Google Sheet with working formulas if it's a calculator, and a scheduled LinkedIn post with comment monitoring and DM sequences.",
    outcome: "Human review preserved at the one gate that matters (content approval), zero manual asset-building after that. Output is no longer capped by assembly time, it's capped by how many good ideas he has in a week.",
  },
  {
    id: '03',
    client: 'ProSWPPP',
    industry: 'Compliance · 50 states',
    title: <>Environmental compliance, <span className="font-drama italic">no researcher in the loop.</span></>,
    metric: 'Multi-FTE → same-day',
    problem: "Every stormwater permit required hours of manual research: MS4 operators, endangered species assessments, soil composition, watershed data, state-specific permit terminology. At scale this would have demanded several full-time researchers, and same-day delivery was impossible.",
    solution: "Built an end-to-end n8n automation from intake to delivery. Gravity Forms feeds a research layer that pulls EPA ECHO for MS4 detection with distance-weighted scoring and fallback logic for delegated states; FWS IPaC for endangered species with project-centered polygons (99.9% reduction in query area vs the county-centroid approach); USDA SSURGO for area-scaled soil sampling; Census and TIGERweb for watershed boundaries. State-specific document chains route through alphabetically ordered switches with continueOnFail resilience. A client-facing audit interface lets the team review and correct pre-populated data before generation runs.",
    outcome: "Same-day document delivery is now on the table. What would have needed multiple full-time researchers plus document specialists runs end-to-end without manual research, with defensible compliance data and a full audit trail.",
    images: ['/cases/proswppp-swppp.png'],
    imageAlts: ['ProSWPPP n8n workflow canvas with state-routed document generation chains'],
  },
  {
    id: '04',
    client: 'ProSWPPP',
    industry: 'SEO Content Ops',
    title: <>Multi-format content, <span className="font-drama italic">from a single interface.</span></>,
    metric: '1 → 3 article formats',
    problem: "The SEO content pipeline lived in a single Google Sheet supporting only one article type (keyword spokes, 1,000-1,500 words). Derek wanted to scale across three formats (spokes, state pillars, competitor comparisons), but the existing setup had no concept of article types, no pillar-to-spoke relationships, no production visibility, and no way to see coverage gaps across 50 states.",
    solution: "Built a dedicated AI Content module inside ProSWPPP's internal Railway app. 50-state dashboard shows coverage color-coded at a glance: has pillar, articles but no pillar, untouched. Bulk operations replace one-at-a-time entry. WordPress syncs every 5 minutes. The n8n workflow routes each article through a format-specific research and writing branch (1,500w spoke / 3,500w pillar / comparison table), all converging on a shared image pipeline that embeds the ProSWPPP logo naturally into worker photographs via Gemini.",
    outcome: "Three content formats from one interface, Google Sheet dependency eliminated, pillar-to-spoke internal linking automated, comparison articles built from the ground up to be the canonical AI-citation source for 'best SWPPP service' queries.",
    images: ['/cases/proswppp-content-states.png', '/cases/proswppp-content-list.png'],
    imageAlts: ['50-state coverage dashboard showing pillar status color-coded by state', 'AI Content article list with 76 published articles across pillar and spoke types'],
  },
  {
    id: '05',
    client: 'ProSWPPP',
    industry: 'Sales Operations',
    title: <>State-aware sales follow-up, <span className="font-drama italic">zero-touch.</span></>,
    metric: 'Manual → zero-touch',
    problem: "The sales team was manually managing post-bid follow-up across four sequence types and three reps, copy-pasting templates and swapping regulatory acronyms per state. Misfires happened. Follow-up slipped. Regulatory terminology varied by rep.",
    solution: "Built a Pipedrive-integrated SDR automation that classifies every lead into the right sequence based on project stage, auto-detects the project state and inserts the correct environmental acronym (TCEQ Texas, GA EPD Georgia, CASQUA California, and so on across all 50 states), rotates sender assignment across the team (or honors manual overrides), and sends every email from the assigned rep's actual inbox so deliverability and reply tracking stay authentic. Sequence progression is automatic: as leads move through stages, old trigger fields clear and new sequences fire. Overlap detection surfaces conflicts as Pipedrive tasks.",
    outcome: "Sales follow-up became zero-touch. Every lead, from the right rep, in the right regulatory language, with zero template confusion.",
    images: ['/cases/proswppp-sdr.png'],
    imageAlts: ['n8n SDR automation workflow with Pipedrive integration and state-routing logic'],
  },
  {
    id: '06',
    client: 'Destino Farms',
    industry: 'Cannabis Distribution',
    title: <>A supplier menu that <span className="font-drama italic">reconciles itself.</span></>,
    metric: '15+ hrs/week eliminated',
    problem: "A cannabis distributor was manually consolidating inventory from multiple suppliers across WhatsApp messages, supplier websites, and Google Sheets. Hours daily of data entry. Pricing errors and stale listings slipped through constantly.",
    solution: "Built an intelligent n8n automation that auto-consolidates inventory from every channel into a single master Google Sheet, standardizes product classifications across inconsistent supplier formats (strain types, flower categories, THC percentages), protects supplier identity through vendor coding and automated COA redaction, maintains data integrity with automatic out-of-stock tracking and duplicate management, and mirrors supplier images and documents to the client's own Google Drive so nothing depends on external hosting.",
    outcome: "15+ hours a week of manual work eliminated. Inventory refreshes every 60-120 minutes. Zero supplier information leakage to end clients. Consistent pricing rules apply automatically. The team focuses on sales instead of spreadsheet reconciliation.",
  },
  {
    id: '07',
    client: 'easyGapps',
    industry: 'Cloud Reseller',
    title: <>Month-end billing, <span className="font-drama italic">down to hours.</span></>,
    metric: 'Days → hours',
    problem: "A Google Workspace reseller was running month-end billing through manual spreadsheet calculations. Errors compounded, margins drifted inconsistent, and tax allocation from Google's aggregated exports, where voice taxes arrived without customer attribution, was a particular reconciliation nightmare.",
    solution: "Built a cloud-native billing automation handling the complete flow from raw usage data to verified invoices in Xero. Daily billing exports ingest into BigQuery. Subscriptions classify automatically as New, Renewal, or Transfer using customer history and heuristic logic. A three-tier pricing engine applies dynamic markup rules with support for customer and SKU-specific overrides. Aggregated voice taxes distribute proportionally based on usage, solving the attribution problem that previously required hours of manual mapping. A dry-run mode lets the team simulate a full billing cycle without touching the live ledger.",
    outcome: "Monthly close time went from days to hours. The tax allocation problem that had driven weeks of reconciliation effort is fully solved. Every invoice is traceable from raw Google Channel data to final customer bill.",
    images: ['/cases/easygapps-billing.png', '/cases/easygapps.png'],
    imageAlts: ['easyGapps Partner Sales Console showing billing accounts', 'Generated invoice in Xero with Google Workspace line items and automated tax allocation'],
  },
];

const WorkPage: React.FC = () => {
  useMetadata({
    title: 'Work | Iván Manfredi',
    description: 'Selected Agent-Ready Ops case studies. AI call auditing, lead magnet systems, compliance automation, content operations, sales follow-up, inventory management, reseller billing.',
    canonical: 'https://ivanmanfredi.com/work',
  });

  return (
    <div className="min-h-screen bg-paper">

      {/* Header */}
      <section className="pt-32 pb-16 px-6 border-b border-[color:var(--color-hairline)]">
        <div className="container mx-auto max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <span className="inline-block text-xs uppercase tracking-[0.1em] font-medium text-ink-soft border border-[color:var(--color-hairline-bold)] rounded px-2 py-1">
              Work
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl lg:text-6xl font-semibold leading-[1.05] tracking-tighter mb-6 max-w-4xl"
          >
            Systems that <span className="font-drama italic">shipped.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-ink-soft max-w-2xl leading-relaxed"
          >
            Selected Agent-Ready Ops engagements. Each one followed the same method: score the 4 preconditions, pick the narrow first scope, encode the judgment, design the review loop, build.
          </motion.p>
        </div>
      </section>

      {/* Cases */}
      <section className="py-20 px-6">
        <div className="container mx-auto max-w-5xl space-y-32">
          {cases.map((c, i) => (
            <motion.article
              key={c.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.5 }}
              className="grid md:grid-cols-12 gap-8 md:gap-12"
            >
              {/* Meta column */}
              <div className="md:col-span-4 space-y-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-mono text-xs uppercase tracking-[0.1em] text-ink-mute">{c.id}</span>
                  <span className="font-mono text-xs uppercase tracking-[0.1em] text-ink-soft border border-[color:var(--color-hairline-bold)] px-2 py-1">
                    {c.client}
                  </span>
                </div>
                <p className="font-mono text-xs uppercase tracking-[0.1em] text-ink-mute">
                  {c.industry}
                </p>
                {/* Metric */}
                <div className="pt-6 border-t border-[color:var(--color-hairline)]">
                  <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute mb-2">Outcome</p>
                  <p className="font-drama italic text-2xl md:text-3xl text-black leading-tight">
                    {c.metric}
                  </p>
                </div>
              </div>

              {/* Content column */}
              <div className="md:col-span-8 space-y-6">
                <h2 className="text-3xl md:text-4xl font-semibold tracking-tight leading-[1.1]">
                  {c.title}
                </h2>

                {c.images && c.images.length > 0 && (
                  <div className={`my-8 ${c.images.length > 1 ? 'grid grid-cols-1 sm:grid-cols-2 gap-3' : ''}`}>
                    {c.images.map((src, i) => (
                      <div key={i} className="border border-[color:var(--color-hairline)] overflow-hidden bg-paper-sunk">
                        <img
                          src={src}
                          alt={c.imageAlts?.[i] ?? ''}
                          loading="lazy"
                          className="w-full h-auto"
                        />
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute mb-2">The problem</p>
                    <p className="text-lg text-ink-soft leading-relaxed">{c.problem}</p>
                  </div>
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute mb-2">What shipped</p>
                    <p className="text-lg text-ink-soft leading-relaxed">{c.solution}</p>
                  </div>
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute mb-2">The result</p>
                    <p className="text-lg text-ink-soft leading-relaxed">{c.outcome}</p>
                  </div>
                </div>

                {c.anonymized && (
                  <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute pt-4 border-t border-[color:var(--color-hairline)]">
                    Client name withheld at their request.
                  </p>
                )}
              </div>
            </motion.article>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-6 border-t border-[color:var(--color-hairline)] bg-paper-sunk">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4">
            Have a system you need <span className="font-drama italic">shipped like this?</span>
          </h2>
          <p className="text-lg text-ink-soft mb-8 max-w-xl mx-auto leading-relaxed">
            The Agent-Ready Blueprint evaluates your operation against the 4 preconditions and hands back your 90-Day AI Rollout Plan.
          </p>
          <a
            href="/assessment"
            className="inline-flex items-center gap-3 px-8 py-4 bg-accent text-black font-semibold tracking-wide hover:bg-accent-ink hover:text-white transition-colors"
          >
            Build your Blueprint <ArrowRight size={18} />
          </a>
        </div>
      </section>
    </div>
  );
};

export default WorkPage;
